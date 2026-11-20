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

export async function compressImageForIdScan(file: File): Promise<{
  base64: string;
  mimeType: string;
  previewDataUrl: string;
}> {
  if (!file) {
    throw new Error('ไม่พบไฟล์ภาพ');
  }

  const MAX_DIMENSION = 1400;
  const JPEG_QUALITY = 0.86;

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('ไม่สามารถเปิดอ่านไฟล์ภาพนี้ได้ (รองรับ JPG, PNG, WebP)'));
      el.src = objectUrl;
    });

    const naturalW = img.naturalWidth || img.width || 0;
    const naturalH = img.naturalHeight || img.height || 0;
    if (!naturalW || !naturalH) {
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
      throw new Error('เบราว์เซอร์ไม่รองรับการประมวลผลภาพ');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const previewDataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    const commaIdx = previewDataUrl.indexOf(',');
    const base64 = commaIdx >= 0 ? previewDataUrl.slice(commaIdx + 1) : previewDataUrl;

    return {
      base64,
      mimeType: 'image/jpeg',
      previewDataUrl,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
