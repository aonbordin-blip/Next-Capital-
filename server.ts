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
  'You are a high-speed, high-accuracy Thai National ID Card (บัตรประจำตัวประชาชน) OCR extractor.',
  'Images may be slightly tilted, rotated, cropped, photocopied (including "สำเนาถูกต้อง" watermarks), or ThaiD digital ID screenshots.',
  'Always rotate mentally if needed and extract all readable fields accurately.',
  'Rules:',
  '- idNumber: 13 digits only (no hyphens/spaces). Check confusing digits carefully (0/8, 1/7, 5/6, 3/8).',
  '- fullNameTh: Thai honorific + first name + last name (e.g. "นายสมชาย ใจดี").',
  '- dateOfBirthIso: Convert Buddhist Era year on card (e.g. 2535 -> 2535 - 543 = 1992) to YYYY-MM-DD. If only month/year or year is shown, use 01 for missing day/month.',
  '- expiryDateIso & isLifetime: If "ตลอดชีพ" set isLifetime=true and expiryDateIso="". Otherwise convert BE date to YYYY-MM-DD.',
  '- addressTh: Single-line clean Thai address as printed on card (do not invent postal code).',
  '- Set isThaiNationalId=false ONLY when the image is clearly not a Thai ID card / photocopy / ThaiD ID and no name or ID digits can be read.',
].join('\n');

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
                text: 'อ่านข้อมูลจากบัตรประชาชนไทยในภาพนี้แล้วส่งกลับเป็น JSON ตามสคีมา',
              },
            ],
          },
          config: {
            systemInstruction: ID_SCAN_SYSTEM_INSTRUCTION,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
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

      console.log(
        `[scan-id-card] OK in ${Date.now() - reqStart}ms (${Math.round(approxBytes / 1024)}KB)`
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
