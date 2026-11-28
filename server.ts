import 'dotenv/config';
import express from 'express';
import path from 'path';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

interface RawBoundingBox {
  ymin?: number;
  xmin?: number;
  ymax?: number;
  xmax?: number;
}

type NormalizedBox = {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
};

interface RawScanResult {
  isThaiNationalId?: boolean;
  idNumber?: string;
  titleTh?: string;
  firstNameTh?: string;
  lastNameTh?: string;
  fullNameTh?: string;
  dateOfBirthIso?: string;
  dateOfBirthTh?: string;
  expiryDateIso?: string;
  isLifetime?: boolean;
  addressTh?: string;
  cardOrientationDeg?: number;
  cardBox?: RawBoundingBox;
  faceBox?: RawBoundingBox;
  headBox?: RawBoundingBox;
  unreadableReason?: string;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
      timeout: 25000,
    },
  });
}

function cleanThaiIdDigits(raw?: string): string {
  return String(raw || '').replace(/\D/g, '').slice(0, 13);
}

function isValidIsoDate(val?: string): string {
  const s = String(val || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const [y, m, d] = s.split('-').map(Number);
  if (y < 1900 || y > 2150 || m < 1 || m > 12 || d < 1 || d > 31) return '';
  return s;
}

function normalizeWhitespace(val?: string, maxLen = 500): string {
  return String(val || '')
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function cleanVehicleSerial(raw?: string, maxLen = 60): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[\r\n\t\s]+/g, '')
    .replace(/[^A-Z0-9\-/.*_]/g, '')
    .slice(0, maxLen);
}

function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1].trim();
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

function getErrorStatus(error: unknown): number {
  if (!error || typeof error !== 'object') return 0;
  const errObj = error as { status?: unknown; statusCode?: unknown; code?: unknown };
  const candidate = Number(errObj.status ?? errObj.statusCode ?? errObj.code);
  return Number.isFinite(candidate) ? candidate : 0;
}

function isTransientError(error: unknown): boolean {
  const status = getErrorStatus(error);
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  const msg = error instanceof Error ? error.message.toLowerCase() : '';
  return (
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('unavailable')
  );
}

const ID_SCAN_SYSTEM_INSTRUCTION = [
  'You are a high-speed, high-accuracy Thai National ID Card (บัตรประจำตัวประชาชน) OCR and portrait-box locator.',
  'Images may be tilted, rotated (0/90/180/270 deg), photographed on a table, photocopied ("สำเนาถูกต้อง"), or ThaiD digital ID screenshots.',
  'Always read all fields accurately and locate the cardholder portrait photo precisely.',
  'Rules:',
  '- idNumber: 13 digits only (no hyphens/spaces). Check confusing digits carefully (0/8, 1/7, 5/6, 3/8).',
  '- fullNameTh: Thai honorific + first name + last name (e.g. "นายสมชาย ใจดี").',
  '- dateOfBirthIso: Convert Buddhist Era year on card (e.g. 2535 -> 2535 - 543 = 1992) to YYYY-MM-DD. If only month/year or year is shown, use 01 for missing day/month.',
  '- expiryDateIso & isLifetime: If "ตลอดชีพ" set isLifetime=true and expiryDateIso="". Otherwise convert BE date to YYYY-MM-DD.',
  '- addressTh: Single-line clean Thai address as printed on card (do not invent postal code).',
  '- cardOrientationDeg: Return 0, 90, 180, or 270 indicating the clockwise rotation in degrees needed to make the Thai ID card upright (text reading normally left-to-right).',
  '- cardBox: Normalized 0-1000 coordinates { ymin, xmin, ymax, xmax } in the EXACT input image orientation tightly framing the entire Thai ID card rectangle (excluding surrounding background/table).',
  '- faceBox: Normalized 0-1000 coordinates { ymin, xmin, ymax, xmax } in the EXACT input image orientation framing ONLY the cardholder\'s solid main portrait photograph rectangle on the bottom-right side of the card (the rectangular photo zone containing the head, shoulders, and the 170/160/150/140 height scale lines). NEVER pick the small faint/transparent ghost watermark face in the middle of the card. Keep coordinates strictly inside the portrait zone (do not include text to the left like "Date of Expiry", do not include numbers below the portrait, and if a colored highlight rectangle is drawn around the portrait, keep coordinates cleanly inside the colored border line).',
  '- headBox: Normalized 0-1000 coordinates { ymin, xmin, ymax, xmax } in the EXACT input image orientation tightly framing just the cardholder\'s head/hair (top of hair to chin, ear to ear) inside faceBox.',
  '- Set isThaiNationalId=false ONLY when the image is clearly not a Thai ID card / photocopy / ThaiD ID and no name or ID digits can be read.',
].join('\n');

const BOUNDING_BOX_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    ymin: { type: Type.NUMBER },
    xmin: { type: Type.NUMBER },
    ymax: { type: Type.NUMBER },
    xmax: { type: Type.NUMBER },
  },
  required: ['ymin', 'xmin', 'ymax', 'xmax'],
};

const ID_SCAN_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    isThaiNationalId: {
      type: Type.BOOLEAN,
      description: 'True if the image shows a Thai National ID card, photocopy, or ThaiD ID.',
    },
    idNumber: {
      type: Type.STRING,
      description: '13-digit Thai National ID number (digits only, no hyphens).',
    },
    titleTh: {
      type: Type.STRING,
      description: 'Thai honorific prefix such as นาย, นาง, นางสาว.',
    },
    firstNameTh: {
      type: Type.STRING,
      description: 'Thai first name.',
    },
    lastNameTh: {
      type: Type.STRING,
      description: 'Thai last name.',
    },
    fullNameTh: {
      type: Type.STRING,
      description: 'Full Thai name including prefix and surname cleanly spaced.',
    },
    dateOfBirthIso: {
      type: Type.STRING,
      description: 'Gregorian birth date in YYYY-MM-DD format converted from Buddhist Era.',
    },
    dateOfBirthTh: {
      type: Type.STRING,
      description: 'Thai date of birth string as printed on the card.',
    },
    expiryDateIso: {
      type: Type.STRING,
      description: 'Gregorian card expiry date in YYYY-MM-DD format, or empty if lifetime.',
    },
    isLifetime: {
      type: Type.BOOLEAN,
      description: 'True if card expiry says ตลอดชีพ / lifetime.',
    },
    addressTh: {
      type: Type.STRING,
      description: 'Full Thai address printed on the card.',
    },
    cardOrientationDeg: {
      type: Type.INTEGER,
      description: 'Clockwise rotation degrees (0, 90, 180, or 270) needed to orient the card upright.',
    },
    cardBox: {
      ...BOUNDING_BOX_SCHEMA,
      description: 'Normalized 0-1000 bounding box of the entire Thai ID card rectangle in input orientation.',
    },
    faceBox: {
      ...BOUNDING_BOX_SCHEMA,
      description:
        'Normalized 0-1000 bounding box of the main cardholder portrait rectangle (bottom-right with 170/160/150/140 height scale) in input orientation.',
    },
    headBox: {
      ...BOUNDING_BOX_SCHEMA,
      description:
        'Normalized 0-1000 tight bounding box of the cardholder head/hair inside faceBox in input orientation.',
    },
    unreadableReason: {
      type: Type.STRING,
      description: 'Short Thai explanation if unreadable or not a Thai ID card.',
    },
  },
  required: [
    'isThaiNationalId',
    'idNumber',
    'fullNameTh',
    'dateOfBirthIso',
    'addressTh',
  ],
};

interface RawVehicleBarcodeResult {
  isReadable?: boolean;
  engineNumber?: string;
  chassisNumber?: string;
  detectedBarcodeText?: string;
  confidenceNote?: string;
  unreadableReason?: string;
}

const VEHICLE_BARCODE_SYSTEM_INSTRUCTION = [
  'You are an ultra-fast, high-accuracy motorcycle VIN / Chassis / Engine Number & Barcode extractor.',
  'Images may show motorcycle box/crate barcode stickers, frame/chassis plates, engine crankcases, vehicle registration books (เล่มทะเบียนรถจักรยานยนต์), or sales delivery stickers.',
  'Read BOTH 1D/2D barcodes (Code128, Code39, QR, DataMatrix) and the human-readable printed or stamped text carefully.',
  'Rules:',
  '- chassisNumber: Vehicle chassis / frame / VIN number (often 17 characters like MLH..., MH3..., LWB..., or labeled VIN / FRAME / CHASSIS / F/N / เลขตัวถัง / เลขถัง).',
  '- engineNumber: Motorcycle engine serial number (often contains engine model prefix + E + digits like JA14E-0123456, KF40E0012345, E33NE-123456, or labeled ENGINE / ENG.NO / E/N / เลขเครื่อง).',
  '- detectedBarcodeText: Raw primary barcode string if only a single unlabeled barcode is shown.',
  '- Return ONLY uppercase alphanumeric serial characters (plus hyphen - or / if printed inside the serial). Do NOT include labels like "VIN:", "E/N:", or spaces.',
  '- Check visually similar characters carefully (0 vs O, 1 vs I, 5 vs S, 8 vs B, 2 vs Z).',
  '- Set isReadable=false ONLY if no serial number or barcode can be read at all.',
].join('\n');

const VEHICLE_BARCODE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    isReadable: {
      type: Type.BOOLEAN,
      description: 'True if at least one barcode, engine number, or chassis/VIN number is readable.',
    },
    engineNumber: {
      type: Type.STRING,
      description: 'Extracted motorcycle engine number (เลขเครื่อง), uppercase without spaces, or empty string if not present.',
    },
    chassisNumber: {
      type: Type.STRING,
      description: 'Extracted motorcycle chassis / frame / VIN number (เลขถัง/เลขตัวถัง), uppercase without spaces, or empty string if not present.',
    },
    detectedBarcodeText: {
      type: Type.STRING,
      description: 'Raw decoded text from the clearest barcode in the image if unlabeled.',
    },
    confidenceNote: {
      type: Type.STRING,
      description: 'Brief Thai note describing what was detected (e.g. อ่านจากสติ๊กเกอร์บาร์โค้ดคู่).',
    },
    unreadableReason: {
      type: Type.STRING,
      description: 'Short Thai explanation if the barcode/serial text cannot be read clearly.',
    },
  },
  required: ['isReadable', 'engineNumber', 'chassisNumber'],
};

const THAI_MONTH_MAP: Record<string, string> = {
  'ม.ค.': '01',
  'มกราคม': '01',
  'ก.พ.': '02',
  'กุมภาพันธ์': '02',
  'มี.ค.': '03',
  'มีนาคม': '03',
  'เม.ย.': '04',
  'เมษายน': '04',
  'พ.ค.': '05',
  'พฤษภาคม': '05',
  'มิ.ย.': '06',
  'มิถุนายน': '06',
  'ก.ค.': '07',
  'กรกฎาคม': '07',
  'ส.ค.': '08',
  'สิงหาคม': '08',
  'ก.ย.': '09',
  'กันยายน': '09',
  'ต.ค.': '10',
  'ตุลาคม': '10',
  'พ.ย.': '11',
  'พฤศจิกายน': '11',
  'ธ.ค.': '12',
  'ธันวาคม': '12',
};

function parseThaiDateFallback(rawThaiDate?: string): string {
  const s = normalizeWhitespace(rawThaiDate, 80);
  if (!s) return '';
  const yearMatch = s.match(/(24\d{2}|25\d{2}|26\d{2})/);
  if (!yearMatch) return '';
  const beYear = Number(yearMatch[1]);
  const ceYear = beYear - 543;
  if (ceYear < 1900 || ceYear > 2150) return '';

  let month = '01';
  for (const [label, mm] of Object.entries(THAI_MONTH_MAP)) {
    if (s.includes(label)) {
      month = mm;
      break;
    }
  }

  const dayMatch = s.match(/(?:^|\s)(\d{1,2})(?=\s)/);
  const dayNum = dayMatch ? Math.min(31, Math.max(1, Number(dayMatch[1]))) : 1;
  return `${ceYear}-${month}-${String(dayNum).padStart(2, '0')}`;
}

function normalizeCardOrientation(rawDeg?: unknown): 0 | 90 | 180 | 270 {
  const n = Number(rawDeg);
  if (!Number.isFinite(n)) return 0;
  const mod = ((Math.round(n / 90) * 90) % 360 + 360) % 360;
  if (mod === 90 || mod === 180 || mod === 270) return mod;
  return 0;
}

function sanitizeBox(raw?: RawBoundingBox | null, minSize = 30, allowFull = false): NormalizedBox | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const ymin = Number(raw.ymin);
  const xmin = Number(raw.xmin);
  const ymax = Number(raw.ymax);
  const xmax = Number(raw.xmax);
  if (
    !Number.isFinite(ymin) ||
    !Number.isFinite(xmin) ||
    !Number.isFinite(ymax) ||
    !Number.isFinite(xmax)
  ) {
    return undefined;
  }
  const cymin = Math.max(0, Math.min(1000, Math.round(ymin)));
  const cxmin = Math.max(0, Math.min(1000, Math.round(xmin)));
  const cymax = Math.max(0, Math.min(1000, Math.round(ymax)));
  const cxmax = Math.max(0, Math.min(1000, Math.round(xmax)));
  const h = cymax - cymin;
  const w = cxmax - cxmin;
  if (h < minSize || w < minSize) return undefined;
  if (!allowFull && h > 920 && w > 920) return undefined;
  return { ymin: cymin, xmin: cxmin, ymax: cymax, xmax: cxmax };
}

function rotateBoxClockwise(box: NormalizedBox, deg: 0 | 90 | 180 | 270): NormalizedBox {
  if (deg === 0) return { ...box };
  if (deg === 90) {
    return {
      ymin: box.xmin,
      xmin: 1000 - box.ymax,
      ymax: box.xmax,
      xmax: 1000 - box.ymin,
    };
  }
  if (deg === 180) {
    return {
      ymin: 1000 - box.ymax,
      xmin: 1000 - box.xmax,
      ymax: 1000 - box.ymin,
      xmax: 1000 - box.xmin,
    };
  }
  // 270 clockwise
  return {
    ymin: 1000 - box.xmax,
    xmin: box.ymin,
    ymax: 1000 - box.xmin,
    xmax: box.ymax,
  };
}

function refineThaiIdGeometry(parsed: RawScanResult): {
  cardOrientationDeg: 0 | 90 | 180 | 270;
  cardBox?: NormalizedBox;
  faceBox?: NormalizedBox;
  headBox?: NormalizedBox;
} {
  const deg = normalizeCardOrientation(parsed.cardOrientationDeg);
  const invDeg = ((360 - deg) % 360) as 0 | 90 | 180 | 270;

  const rawCardBox = sanitizeBox(parsed.cardBox, 180, true);
  const rawFaceBox = sanitizeBox(parsed.faceBox, 30, false);
  const rawHeadBox = sanitizeBox(parsed.headBox, 20, false);

  const uCard = rawCardBox ? rotateBoxClockwise(rawCardBox, deg) : undefined;
  let uFace = rawFaceBox ? rotateBoxClockwise(rawFaceBox, deg) : undefined;
  let uHead = rawHeadBox ? rotateBoxClockwise(rawHeadBox, deg) : undefined;

  // Cross-validate against physical Thai National ID bottom-right portrait geometry
  // (Portrait slot sits cleanly in 74.5%..97.6% width and 44.5%..92.0% height of the card)
  if (uCard) {
    const cardW = uCard.xmax - uCard.xmin;
    const cardH = uCard.ymax - uCard.ymin;
    if (cardW >= 180 && cardH >= 150) {
      const tmpl: NormalizedBox = {
        xmin: Math.round(uCard.xmin + cardW * 0.745),
        xmax: Math.round(uCard.xmin + cardW * 0.976),
        ymin: Math.round(uCard.ymin + cardH * 0.445),
        ymax: Math.round(uCard.ymin + cardH * 0.92),
      };

      const isFaceInPortraitZone = (b: NormalizedBox): boolean => {
        const cx = (b.xmin + b.xmax) / 2;
        const cy = (b.ymin + b.ymax) / 2;
        const bw = b.xmax - b.xmin;
        const bh = b.ymax - b.ymin;
        // Reject ghost watermark face (center-left of card) or whole-card mistakes
        return (
          cx >= uCard.xmin + cardW * 0.62 &&
          cx <= uCard.xmax + cardW * 0.04 &&
          cy >= uCard.ymin + cardH * 0.3 &&
          cy <= uCard.ymax + cardH * 0.04 &&
          bw <= cardW * 0.36 &&
          bh <= cardH * 0.68
        );
      };

      if (!uFace || !isFaceInPortraitZone(uFace)) {
        uFace = tmpl;
        if (uHead && !isFaceInPortraitZone(uHead)) {
          uHead = undefined;
        }
      } else {
        // Clamp against leaking left onto text or bottom onto laser digits,
        // and expand gently if Gemini returned an overly tight face-only crop instead of the portrait frame
        const minLeft = Math.round(uCard.xmin + cardW * 0.718);
        const maxRight = Math.round(uCard.xmin + cardW * 0.99);
        const minTop = Math.round(uCard.ymin + cardH * 0.38);
        const maxBottom = Math.round(uCard.ymin + cardH * 0.945);

        uFace = {
          xmin: Math.max(minLeft, uFace.xmin),
          xmax: Math.min(maxRight, uFace.xmax),
          ymin: Math.max(minTop, uFace.ymin),
          ymax: Math.min(maxBottom, uFace.ymax),
        };

        // If Gemini's faceBox is much smaller than the portrait slot (e.g. tight face only),
        // widen/extend toward the standard portrait slot bounds while preserving face center
        const bw = uFace.xmax - uFace.xmin;
        const bh = uFace.ymax - uFace.ymin;
        if (bw < cardW * 0.14 || bh < cardH * 0.25) {
          if (!uHead) {
            uHead = { ...uFace };
          }
          uFace = {
            xmin: Math.min(uFace.xmin, tmpl.xmin),
            xmax: Math.max(uFace.xmax, tmpl.xmax),
            ymin: Math.min(uFace.ymin, tmpl.ymin),
            ymax: Math.max(uFace.ymax, tmpl.ymax),
          };
        }
      }
    }
  }

  // Ensure headBox stays consistent inside faceBox
  if (uFace && uHead) {
    const hcx = (uHead.xmin + uHead.xmax) / 2;
    const hcy = (uHead.ymin + uHead.ymax) / 2;
    const insideFace =
      hcx >= uFace.xmin - 15 &&
      hcx <= uFace.xmax + 15 &&
      hcy >= uFace.ymin - 15 &&
      hcy <= uFace.ymax + 15;
    if (!insideFace) {
      uHead = undefined;
    }
  }

  return {
    cardOrientationDeg: deg,
    cardBox: rawCardBox,
    faceBox: uFace ? sanitizeBox(rotateBoxClockwise(uFace, invDeg), 24, false) : undefined,
    headBox: uHead ? sanitizeBox(rotateBoxClockwise(uHead, invDeg), 16, false) : undefined,
  };
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));

  app.post('/api/scan-id-card', async (req, res) => {
    const reqStart = Date.now();
    try {
      const body = (req.body || {}) as {
        imageBase64?: unknown;
        mimeType?: unknown;
      };

      if (typeof body.imageBase64 !== 'string' || !body.imageBase64.trim()) {
        res.status(400).json({
          ok: false,
          error: 'ไม่พบข้อมูลรูปภาพสำหรับสแกน กรุณาเลือกรูปหรือถ่ายภาพใหม่อีกครั้ง',
        });
        return;
      }

      const rawInput = body.imageBase64.trim();
      const dataUrlMatch = rawInput.match(/^data:([^;]+);base64,(.+)$/i);
      const base64Data = (dataUrlMatch ? dataUrlMatch[2] : rawInput).replace(/\s+/g, '');

      const requestedMime = (
        (typeof body.mimeType === 'string' && body.mimeType.trim()) ||
        (dataUrlMatch ? dataUrlMatch[1] : '') ||
        'image/jpeg'
      ).toLowerCase();

      const mimeType = ALLOWED_MIME_TYPES.has(requestedMime)
        ? requestedMime === 'image/jpg'
          ? 'image/jpeg'
          : requestedMime
        : 'image/jpeg';

      // Guard payload binary size (~6MB max)
      const approxBytes = Math.floor((base64Data.length * 3) / 4);
      if (approxBytes < 100 || approxBytes > 6 * 1024 * 1024) {
        res.status(400).json({
          ok: false,
          error: 'ขนาดไฟล์ภาพไม่เหมาะสม (ต้องไม่เกิน 6MB)',
        });
        return;
      }

      const ai = getGeminiClient();

      const callModel = () =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
              {
                text: 'อ่านข้อมูลบัตรประชาชนไทยในภาพนี้ พร้อมระบุ cardOrientationDeg, cardBox, faceBox (กรอบรูปถ่ายบุคคลมุมขวาล่างที่มีสเกลวัดส่วนสูง 170/160/150/140) และ headBox แล้วส่งกลับเป็น JSON ตามสคีมา',
              },
            ],
          },
          config: {
            systemInstruction: ID_SCAN_SYSTEM_INSTRUCTION,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: ID_SCAN_RESPONSE_SCHEMA,
          },
        });

      let response;
      try {
        response = await callModel();
      } catch (firstErr) {
        if (!isTransientError(firstErr) || Date.now() - reqStart > 12000) {
          throw firstErr;
        }
        await new Promise((r) => setTimeout(r, 350));
        response = await callModel();
      }

      const rawText = (response.text || '').trim();
      if (!rawText) {
        res.status(502).json({
          ok: false,
          error: 'ระบบวิเคราะห์ภาพไม่ได้ส่งผลลัพธ์กลับมา กรุณาลองใหม่อีกครั้ง',
        });
        return;
      }

      let parsed: RawScanResult;
      try {
        parsed = JSON.parse(extractJsonText(rawText)) as RawScanResult;
      } catch {
        res.status(502).json({
          ok: false,
          error: 'ไม่สามารถอ่านรูปแบบผลลัพธ์จากระบบวิเคราะห์ภาพได้ กรุณาลองใหม่อีกครั้ง',
        });
        return;
      }

      const idNumber = cleanThaiIdDigits(parsed.idNumber);
      const composedFallbackName = [
        normalizeWhitespace(parsed.titleTh, 40),
        normalizeWhitespace(parsed.firstNameTh, 100),
        normalizeWhitespace(parsed.lastNameTh, 100),
      ]
        .filter(Boolean)
        .join(' ')
        .trim();

      const fullNameTh =
        normalizeWhitespace(parsed.fullNameTh, 200) || composedFallbackName;
      const dateOfBirthTh = normalizeWhitespace(parsed.dateOfBirthTh, 80);
      const dateOfBirthIso =
        isValidIsoDate(parsed.dateOfBirthIso) || parseThaiDateFallback(dateOfBirthTh);
      const expiryDateIso = parsed.isLifetime ? '' : isValidIsoDate(parsed.expiryDateIso);
      const addressTh = normalizeWhitespace(parsed.addressTh, 500);

      // Only reject if neither classified as Thai ID NOR extracted useful ID/name fields
      const hasUsefulExtraction =
        idNumber.length >= 10 || (Boolean(fullNameTh) && Boolean(addressTh || dateOfBirthIso));

      if (!parsed.isThaiNationalId && !hasUsefulExtraction) {
        res.status(422).json({
          ok: false,
          error:
            normalizeWhitespace(parsed.unreadableReason, 240) ||
            'ภาพนี้ไม่ใช่บัตรประจำตัวประชาชนไทย หรือภาพไม่ชัดเจนพอ กรุณาถ่ายภาพใหม่ให้แสงสว่างเพียงพอและเห็นข้อความชัด',
        });
        return;
      }

      if (!idNumber && !fullNameTh && !addressTh) {
        res.status(422).json({
          ok: false,
          error:
            normalizeWhitespace(parsed.unreadableReason, 240) ||
            'ไม่สามารถอ่านข้อมูลสำคัญบนบัตรได้ กรุณาถ่ายภาพให้ชัดขึ้นและเห็นบัตรเต็มใบ',
        });
        return;
      }

      const geometry = refineThaiIdGeometry(parsed);

      console.log(
        `[scan-id-card] OK in ${Date.now() - reqStart}ms (${Math.round(approxBytes / 1024)}KB, rot=${geometry.cardOrientationDeg}${geometry.faceBox ? ', faceBox' : ''}${geometry.headBox ? ', headBox' : ''})`
      );

      res.json({
        ok: true,
        data: {
          idNumber,
          titleTh: normalizeWhitespace(parsed.titleTh, 40),
          firstNameTh: normalizeWhitespace(parsed.firstNameTh, 100),
          lastNameTh: normalizeWhitespace(parsed.lastNameTh, 100),
          fullNameTh,
          dateOfBirthIso,
          dateOfBirthTh,
          expiryDateIso,
          isLifetime: Boolean(parsed.isLifetime),
          addressTh,
          cardOrientationDeg: geometry.cardOrientationDeg,
          ...(geometry.cardBox ? { cardBox: geometry.cardBox } : {}),
          ...(geometry.faceBox ? { faceBox: geometry.faceBox } : {}),
          ...(geometry.headBox ? { headBox: geometry.headBox } : {}),
        },
      });
    } catch (error) {
      const status = getErrorStatus(error);
      const rawMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `[scan-id-card] ERROR after ${Date.now() - reqStart}ms (status=${status}):`,
        rawMessage
      );

      let httpStatus = 500;
      let msg = 'เกิดข้อผิดพลาดในการสแกนบัตรประชาชน กรุณาลองใหม่อีกครั้ง';

      if (rawMessage.includes('GEMINI_API_KEY') || status === 401 || status === 403) {
        httpStatus = 500;
        msg =
          'ยังไม่ได้ตั้งค่า GEMINI_API_KEY หรือสิทธิ์คีย์ไม่ถูกต้อง กรุณาตรวจสอบใน Settings > Secrets';
      } else if (status === 429) {
        httpStatus = 429;
        msg = 'ขณะนี้มีผู้ใช้งานจำนวนมาก (Quota เต็มชั่วคราว) กรุณารอสักครู่แล้วลองใหม่อีกครั้ง';
      } else if (status === 404) {
        httpStatus = 502;
        msg = 'ไม่พบบริการโมเดลวิเคราะห์ภาพ กรุณาลองใหม่อีกครั้ง';
      } else if (
        rawMessage.toLowerCase().includes('timeout') ||
        rawMessage.toLowerCase().includes('aborted')
      ) {
        httpStatus = 504;
        msg = 'การประมวลผลใช้เวลานานเกินกำหนด กรุณาลองถ่ายใหม่หรือเช็กสัญญาณอินเทอร์เน็ต';
      }

      res.status(httpStatus).json({ ok: false, error: msg });
    }
  });

  app.post('/api/scan-vehicle-barcode', async (req, res) => {
    const reqStart = Date.now();
    try {
      const body = (req.body || {}) as {
        imageBase64?: unknown;
        mimeType?: unknown;
        scanTarget?: unknown;
      };

      if (typeof body.imageBase64 !== 'string' || !body.imageBase64.trim()) {
        res.status(400).json({
          ok: false,
          error: 'ไม่พบข้อมูลรูปภาพสำหรับสแกน กรุณาถ่ายภาพหรือเลือกรูปใหม่อีกครั้ง',
        });
        return;
      }

      const rawInput = body.imageBase64.trim();
      const dataUrlMatch = rawInput.match(/^data:([^;]+);base64,(.+)$/i);
      const base64Data = (dataUrlMatch ? dataUrlMatch[2] : rawInput).replace(/\s+/g, '');

      const requestedMime = (
        (typeof body.mimeType === 'string' && body.mimeType.trim()) ||
        (dataUrlMatch ? dataUrlMatch[1] : '') ||
        'image/jpeg'
      ).toLowerCase();

      const mimeType = ALLOWED_MIME_TYPES.has(requestedMime)
        ? requestedMime === 'image/jpg'
          ? 'image/jpeg'
          : requestedMime
        : 'image/jpeg';

      const approxBytes = Math.floor((base64Data.length * 3) / 4);
      if (approxBytes < 100 || approxBytes > 6 * 1024 * 1024) {
        res.status(400).json({
          ok: false,
          error: 'ขนาดไฟล์ภาพไม่เหมาะสม (ต้องไม่เกิน 6MB)',
        });
        return;
      }

      const scanTarget =
        body.scanTarget === 'engine' || body.scanTarget === 'chassis' ? body.scanTarget : 'both';
      const targetHint =
        scanTarget === 'engine'
          ? 'ผู้ใช้กำลังต้องการอ่านเลขเครื่อง (Engine No.) เป็นหลัก แต่ถ้าเห็นเลขถังด้วยให้ส่งกลับมาด้วย'
          : scanTarget === 'chassis'
          ? 'ผู้ใช้กำลังต้องการอ่านเลขถัง / VIN (Chassis/Frame No.) เป็นหลัก แต่ถ้าเห็นเลขเครื่องด้วยให้ส่งกลับมาด้วย'
          : 'อ่านทั้งเลขเครื่อง (Engine No.) และเลขถัง (Chassis/Frame/VIN No.) ที่พบในภาพนี้';

      const ai = getGeminiClient();

      const callModel = () =>
        ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
              {
                text: `${targetHint} แล้วส่งกลับเป็น JSON ตามสคีมา`,
              },
            ],
          },
          config: {
            systemInstruction: VEHICLE_BARCODE_SYSTEM_INSTRUCTION,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            responseMimeType: 'application/json',
            responseSchema: VEHICLE_BARCODE_RESPONSE_SCHEMA,
          },
        });

      let response;
      try {
        response = await callModel();
      } catch (firstErr) {
        if (!isTransientError(firstErr) || Date.now() - reqStart > 12000) {
          throw firstErr;
        }
        await new Promise((r) => setTimeout(r, 350));
        response = await callModel();
      }

      const rawText = (response.text || '').trim();
      if (!rawText) {
        res.status(502).json({
          ok: false,
          error: 'ระบบวิเคราะห์ภาพไม่ได้ส่งผลลัพธ์กลับมา กรุณาลองใหม่อีกครั้ง',
        });
        return;
      }

      let parsed: RawVehicleBarcodeResult;
      try {
        parsed = JSON.parse(extractJsonText(rawText)) as RawVehicleBarcodeResult;
      } catch {
        res.status(502).json({
          ok: false,
          error: 'ไม่สามารถอ่านรูปแบบผลลัพธ์จากระบบวิเคราะห์ภาพได้ กรุณาลองใหม่อีกครั้ง',
        });
        return;
      }

      let engineNumber = cleanVehicleSerial(parsed.engineNumber, 60);
      let chassisNumber = cleanVehicleSerial(parsed.chassisNumber, 60);
      const detectedBarcodeText = cleanVehicleSerial(parsed.detectedBarcodeText, 60);

      if (!engineNumber && !chassisNumber && detectedBarcodeText) {
        if (scanTarget === 'engine') {
          engineNumber = detectedBarcodeText;
        } else if (scanTarget === 'chassis') {
          chassisNumber = detectedBarcodeText;
        } else if (detectedBarcodeText.length >= 16) {
          chassisNumber = detectedBarcodeText;
        } else {
          engineNumber = detectedBarcodeText;
        }
      }

      if (!parsed.isReadable && !engineNumber && !chassisNumber && !detectedBarcodeText) {
        res.status(422).json({
          ok: false,
          error:
            normalizeWhitespace(parsed.unreadableReason, 240) ||
            'ไม่พบบาร์โค้ด หรือตัวอักษรเลขเครื่อง/เลขถังที่อ่านได้ชัด กรุณาถ่ายภาพให้ใกล้ขึ้นและโฟกัสชัดเจน',
        });
        return;
      }

      console.log(
        `[scan-vehicle-barcode] OK in ${Date.now() - reqStart}ms (${Math.round(approxBytes / 1024)}KB)`
      );

      res.json({
        ok: true,
        data: {
          engineNumber,
          chassisNumber,
          detectedBarcodeText,
          confidenceNote: normalizeWhitespace(parsed.confidenceNote, 180),
        },
      });
    } catch (error) {
      const status = getErrorStatus(error);
      const rawMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `[scan-vehicle-barcode] ERROR after ${Date.now() - reqStart}ms (status=${status}):`,
        rawMessage
      );

      let httpStatus = 500;
      let msg = 'เกิดข้อผิดพลาดในการสแกนเลขเครื่อง/เลขถัง กรุณาลองใหม่อีกครั้ง';

      if (rawMessage.includes('GEMINI_API_KEY') || status === 401 || status === 403) {
        httpStatus = 500;
        msg =
          'ยังไม่ได้ตั้งค่า GEMINI_API_KEY หรือสิทธิ์คีย์ไม่ถูกต้อง กรุณาตรวจสอบใน Settings > Secrets';
      } else if (status === 429) {
        httpStatus = 429;
        msg = 'ขณะนี้มีผู้ใช้งานจำนวนมาก (Quota เต็มชั่วคราว) กรุณารอสักครู่แล้วลองใหม่อีกครั้ง';
      } else if (status === 404) {
        httpStatus = 502;
        msg = 'ไม่พบบริการโมเดลวิเคราะห์ภาพ กรุณาลองใหม่อีกครั้ง';
      } else if (
        rawMessage.toLowerCase().includes('timeout') ||
        rawMessage.toLowerCase().includes('aborted')
      ) {
        httpStatus = 504;
        msg = 'การประมวลผลใช้เวลานานเกินกำหนด กรุณาลองถ่ายใหม่หรือเช็กสัญญาณอินเทอร์เน็ต';
      }

      res.status(httpStatus).json({ ok: false, error: msg });
    }
  });

  if (!IS_PRODUCTION) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MotoLease Calc server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
