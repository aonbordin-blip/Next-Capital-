export interface ThaiIdScanData {
  idNumber: string;
  titleTh?: string;
  firstNameTh?: string;
  lastNameTh?: string;
  fullNameTh: string;
  dateOfBirthIso: string;
  dateOfBirthTh?: string;
  expiryDateIso?: string;
  isLifetime?: boolean;
  addressTh: string;
}

export function normalizeThaiIdDigits(raw?: string | null): string {
  return String(raw || '').replace(/\D/g, '').slice(0, 13);
}

export function formatThaiIdDisplay(raw?: string | null): string {
  const digits = normalizeThaiIdDigits(raw);
  if (!digits) return '';
  const p1 = digits.slice(0, 1);
  const p2 = digits.slice(1, 5);
  const p3 = digits.slice(5, 10);
  const p4 = digits.slice(10, 12);
  const p5 = digits.slice(12, 13);
  return [p1, p2, p3, p4, p5].filter(Boolean).join('-');
}

export function maskThaiIdDisplay(raw?: string | null): string {
  const digits = normalizeThaiIdDigits(raw);
  if (digits.length !== 13) return formatThaiIdDisplay(digits);
  return `${digits[0]}-${digits.slice(1, 5)}-XXXXX-${digits.slice(10, 12)}-${digits[12]}`;
}

export function validateThaiNationalId(raw?: string | null): {
  isValid: boolean;
  digits: string;
  reason?: string;
} {
  const digits = normalizeThaiIdDigits(raw);
  if (!digits) {
    return { isValid: false, digits, reason: 'ยังไม่ได้ระบุเลขประจำตัวประชาชน' };
  }
  if (digits.length !== 13) {
    return {
      isValid: false,
      digits,
      reason: `ตัวเลขยังไม่ครบ 13 หลัก (มี ${digits.length} หลัก)`,
    };
  }
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(digits[i]) * (13 - i);
  }
  const checkDigit = (11 - (sum % 11)) % 10;
  if (checkDigit !== Number(digits[12])) {
    return {
      isValid: false,
      digits,
      reason: 'เลขหลักที่ 13 ไม่ตรงตามสูตรตรวจสอบ กรุณาตรวจทานตัวเลขกับบัตรจริงอีกครั้ง',
    };
  }
  return { isValid: true, digits };
}

export function calculateAgeFromIsoDate(isoDate?: string | null): number | null {
  const s = String(isoDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const now = new Date();
  const currentYear = now.getFullYear();
  if (y < 1900 || y > currentYear) return null;
  let age = currentYear - y;
  const monthDiff = now.getMonth() + 1 - m;
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d)) {
    age--;
  }
  if (age < 0 || age > 120) return null;
  return age;
}

const THAI_MONTH_SHORTS = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

export function formatThaiDateFromIso(isoDate?: string | null): string {
  const s = String(isoDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return '';
  return `${d} ${THAI_MONTH_SHORTS[m - 1]} ${y + 543}`;
}

export function isThaiIdExpired(
  expiryIso?: string | null,
  isLifetime?: boolean
): boolean {
  if (isLifetime) return false;
  const s = String(expiryIso || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
  return s < todayIso;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result) {
        resolve(reader.result);
      } else {
        reject(new Error('ไม่สามารถอ่านไฟล์ภาพได้'));
      }
    };
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์ภาพได้'));
    reader.readAsDataURL(file);
  });
}

export async function compressImageForIdScan(file: File): Promise<{
  base64: string;
  mimeType: string;
  previewDataUrl: string;
}> {
  if (!file) {
    throw new Error('ไม่พบไฟล์ภาพ');
  }

  const MAX_DIMENSION = 1152;
  const JPEG_QUALITY = 0.8;

  const objectUrl = URL.createObjectURL(file);
  try {
    let source: CanvasImageSource | null = null;
    let naturalW = 0;
    let naturalH = 0;
    let bitmap: ImageBitmap | null = null;

    if (typeof createImageBitmap === 'function') {
      try {
        bitmap = await createImageBitmap(file);
        naturalW = bitmap.width;
        naturalH = bitmap.height;
        source = bitmap;
      } catch {
        bitmap = null;
      }
    }

    if (!source) {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () =>
          reject(new Error('ไม่สามารถเปิดอ่านไฟล์ภาพนี้ได้ (รองรับ JPG, PNG, WebP, HEIC)'));
        el.src = objectUrl;
      });
      naturalW = img.naturalWidth || img.width || 0;
      naturalH = img.naturalHeight || img.height || 0;
      source = img;
    }

    if (!naturalW || !naturalH) {
      if (bitmap) bitmap.close();
      throw new Error('ขนาดภาพไม่ถูกต้อง');
    }

    const scale = Math.min(1, MAX_DIMENSION / Math.max(naturalW, naturalH));
    const targetW = Math.max(1, Math.round(naturalW * scale));
    const targetH = Math.max(1, Math.round(naturalH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      if (bitmap) bitmap.close();
      throw new Error('เบราว์เซอร์ไม่รองรับการประมวลผลภาพ');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, targetW, targetH);

    if (bitmap) bitmap.close();

    let previewDataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    if (previewDataUrl.length > 1_100_000) {
      previewDataUrl = canvas.toDataURL('image/jpeg', 0.7);
    }
    const commaIdx = previewDataUrl.indexOf(',');
    const base64 = commaIdx >= 0 ? previewDataUrl.slice(commaIdx + 1) : previewDataUrl;

    return {
      base64,
      mimeType: 'image/jpeg',
      previewDataUrl,
    };
  } catch (decodeErr) {
    // Fallback for HEIC/HEIF or formats browser <img> cannot decode directly:
    // send original image bytes up to 5.5MB directly to Gemini.
    if (file.size > 0 && file.size <= 5.5 * 1024 * 1024) {
      const dataUrl = await readFileAsDataUrl(file);
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/i);
      if (match) {
        const detectedMime =
          file.type && file.type.startsWith('image/')
            ? file.type.toLowerCase()
            : match[1].toLowerCase();
        return {
          base64: match[2],
          mimeType: detectedMime || 'image/jpeg',
          previewDataUrl: dataUrl,
        };
      }
    }
    throw decodeErr;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
