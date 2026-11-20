import 'dotenv/config';
import express from 'express';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';

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

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));

  app.post('/api/scan-id-card', async (req, res) => {
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

      const prompt = [
        'คุณคือผู้เชี่ยวชาญในการอ่านข้อมูลจากบัตรประจำตัวประชาชนไทย (Thai National ID Card) ให้มีความแม่นยำสูงสุด',
        'จงตรวจสอบรูปภาพที่แนบมาและสกัดข้อมูลเป็น JSON ตามสคีมาที่กำหนด:',
        '1. ตรวจสอบว่าภาพนี้คือ "บัตรประจำตัวประชาชนไทย" ที่พออ่านข้อความได้หรือไม่ (isThaiNationalId)',
        '   - หากไม่ใช่บัตรประชาชนไทย (เช่น ใบขับขี่ พาสปอร์ต ภาพทั่วไป หรือภาพเบลอ/มืดจนอ่านชื่อหรือเลขบัตรไม่ได้เลย) ให้กำหนด isThaiNationalId = false และระบุเหตุผลสั้นๆ เป็นภาษาไทยใน unreadableReason',
        '2. เลขประจำตัวประชาชน 13 หลัก (idNumber): ดึงเป็นตัวเลข 13 หลักติดกันไม่มีขีดหรือช่องว่าง ตรวจทานตัวเลขที่คล้ายกัน เช่น 0 กับ 8, 1 กับ 7, 5 กับ 6, 3 กับ 8 ให้แม่นยำ',
        '3. ชื่อ-นามสกุลภาษาไทย (titleTh, firstNameTh, lastNameTh, fullNameTh): ดึงให้ถูกต้องตามสะกดภาษาไทยบนบัตร (เช่น "นายสมชาย ใจดี" หรือ "นางสาวสมหญิง รักไทย")',
        '4. วันเกิด (dateOfBirthIso): แปลงจาก พ.ศ. บนบัตร (เช่น เกิดวันที่ 14 พ.ค. 2535 -> 2535 - 543 = 1992) เป็นรูปแบบ ค.ศ. YYYY-MM-DD เท่านั้น หากบนบัตรระบุเฉพาะเดือนหรือปี ให้ใช้วันที่ 01 ของเดือน/ปีนั้น หรือหากอ่านไม่ได้ให้ใส่ค่าว่าง',
        '5. วันบัตรหมดอายุ (expiryDateIso, isLifetime): หากระบุ "ตลอดชีพ" ให้ตั้ง isLifetime = true และ expiryDateIso = "" หากระบุวันที่ ให้แปลงจาก พ.ศ. เป็น ค.ศ. รูปแบบ YYYY-MM-DD',
        '6. ที่อยู่ตามบัตร (addressTh): ดึงที่อยู่ภาษาไทยทั้งหมดตามที่พิมพ์บนบัตรในบรรทัดเดียวเว้นวรรคสะอาดตา (บ้านเลขที่ หมู่ ซอย ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด) ห้ามแต่งเติมรหัสไปรษณีย์หรือข้อความที่ไม่มีบนบัตร',
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isThaiNationalId: {
                type: Type.BOOLEAN,
                description: 'True only if the image shows a readable Thai National ID card.',
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
                description: 'Thai explanation if not a Thai ID card or too blurry to read.',
              },
            },
            required: [
              'isThaiNationalId',
              'idNumber',
              'fullNameTh',
              'dateOfBirthIso',
              'addressTh',
            ],
          },
        },
      });

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
        parsed = JSON.parse(rawText) as RawScanResult;
      } catch {
        res.status(502).json({
          ok: false,
          error: 'ไม่สามารถอ่านรูปแบบผลลัพธ์จากระบบวิเคราะห์ภาพได้ กรุณาลองใหม่อีกครั้ง',
        });
        return;
      }

      if (!parsed.isThaiNationalId) {
        res.status(422).json({
          ok: false,
          error:
            normalizeWhitespace(parsed.unreadableReason, 240) ||
            'ภาพนี้ไม่ใช่บัตรประจำตัวประชาชนไทย หรือภาพไม่ชัดเจนพอ กรุณาถ่ายภาพใหม่ให้แสงสว่างเพียงพอและไม่สะท้อนแสง',
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
      const dateOfBirthIso = isValidIsoDate(parsed.dateOfBirthIso);
      const expiryDateIso = parsed.isLifetime ? '' : isValidIsoDate(parsed.expiryDateIso);
      const addressTh = normalizeWhitespace(parsed.addressTh, 500);

      if (!idNumber && !fullNameTh && !addressTh) {
        res.status(422).json({
          ok: false,
          error:
            normalizeWhitespace(parsed.unreadableReason, 240) ||
            'ไม่สามารถอ่านข้อมูลสำคัญบนบัตรได้ กรุณาถ่ายภาพให้ชัดขึ้นและเห็นบัตรเต็มใบ',
        });
        return;
      }

      res.json({
        ok: true,
        data: {
          idNumber,
          titleTh: normalizeWhitespace(parsed.titleTh, 40),
          firstNameTh: normalizeWhitespace(parsed.firstNameTh, 100),
          lastNameTh: normalizeWhitespace(parsed.lastNameTh, 100),
          fullNameTh,
          dateOfBirthIso,
          dateOfBirthTh: normalizeWhitespace(parsed.dateOfBirthTh, 80),
          expiryDateIso,
          isLifetime: Boolean(parsed.isLifetime),
          addressTh,
        },
      });
    } catch (error) {
      console.error('Error scanning Thai ID card:', error);
      const msg =
        error instanceof Error && error.message.includes('GEMINI_API_KEY')
          ? 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์'
          : 'เกิดข้อผิดพลาดในการสแกนบัตรประชาชน กรุณาลองใหม่อีกครั้ง';
      res.status(500).json({ ok: false, error: msg });
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
