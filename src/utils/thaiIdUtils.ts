export interface FaceBoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

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
  cardOrientationDeg?: number;
  cardBox?: FaceBoundingBox;
  faceBox?: FaceBoundingBox;
  headBox?: FaceBoundingBox;
}

export interface PortraitCropOptions {
  headBox?: FaceBoundingBox | null;
  cardOrientationDeg?: number;
  innerInsetRatio?: number;
  offsetXRatio?: number;
  offsetYRatio?: number;
  zoom?: number;
}

const MAX_CUSTOMER_PHOTO_DATA_URL_LEN = 45000;

export function sanitizeCustomerPhotoDataUrl(raw?: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_CUSTOMER_PHOTO_DATA_URL_LEN) {
    return undefined;
  }
  if (!/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return undefined;
  }
  return trimmed;
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

function normalizeOrientationDeg(deg?: number): 0 | 90 | 180 | 270 {
  if (typeof deg !== 'number' || !Number.isFinite(deg)) return 0;
  const mod = ((Math.round(deg / 90) * 90) % 360 + 360) % 360;
  if (mod === 90 || mod === 180 || mod === 270) return mod;
  return 0;
}

function rotateNormBoxClockwise(
  box: FaceBoundingBox,
  deg: 0 | 90 | 180 | 270
): FaceBoundingBox {
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
  return {
    ymin: 1000 - box.xmax,
    xmin: box.ymin,
    ymax: 1000 - box.xmin,
    xmax: box.ymax,
  };
}

export async function cropIdCardFacePortrait(
  sourceDataUrl: string,
  faceBox?: FaceBoundingBox | null,
  options?: PortraitCropOptions
): Promise<string | undefined> {
  if (!sourceDataUrl || !faceBox) return undefined;
  const { ymin, xmin, ymax, xmax } = faceBox;
  if (
    !Number.isFinite(ymin) ||
    !Number.isFinite(xmin) ||
    !Number.isFinite(ymax) ||
    !Number.isFinite(xmax)
  ) {
    return undefined;
  }
  if (ymax <= ymin || xmax <= xmin) return undefined;

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image decode failed'));
      el.src = sourceDataUrl;
    });

    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;
    if (!natW || !natH) return undefined;

    const deg = normalizeOrientationDeg(options?.cardOrientationDeg);
    let drawSource: CanvasImageSource = img;
    let uW = natW;
    let uH = natH;
    let uFaceNorm: FaceBoundingBox = {
      ymin: Math.max(0, Math.min(1000, ymin)),
      xmin: Math.max(0, Math.min(1000, xmin)),
      ymax: Math.max(0, Math.min(1000, ymax)),
      xmax: Math.max(0, Math.min(1000, xmax)),
    };
    let uHeadNorm: FaceBoundingBox | undefined = options?.headBox
      ? {
          ymin: Math.max(0, Math.min(1000, options.headBox.ymin)),
          xmin: Math.max(0, Math.min(1000, options.headBox.xmin)),
          ymax: Math.max(0, Math.min(1000, options.headBox.ymax)),
          xmax: Math.max(0, Math.min(1000, options.headBox.xmax)),
        }
      : undefined;

    if (deg !== 0) {
      const rotCanvas = document.createElement('canvas');
      const swapDims = deg === 90 || deg === 270;
      uW = swapDims ? natH : natW;
      uH = swapDims ? natW : natH;
      rotCanvas.width = uW;
      rotCanvas.height = uH;
      const rCtx = rotCanvas.getContext('2d');
      if (rCtx) {
        rCtx.translate(uW / 2, uH / 2);
        rCtx.rotate((deg * Math.PI) / 180);
        rCtx.drawImage(img, -natW / 2, -natH / 2, natW, natH);
        drawSource = rotCanvas;
        uFaceNorm = rotateNormBoxClockwise(uFaceNorm, deg);
        if (uHeadNorm) {
          uHeadNorm = rotateNormBoxClockwise(uHeadNorm, deg);
        }
      } else {
        uW = natW;
        uH = natH;
      }
    }

    const bx1 = (uFaceNorm.xmin / 1000) * uW;
    const by1 = (uFaceNorm.ymin / 1000) * uH;
    const bx2 = (uFaceNorm.xmax / 1000) * uW;
    const by2 = (uFaceNorm.ymax / 1000) * uH;

    const bw = bx2 - bx1;
    const bh = by2 - by1;
    if (bw < 16 || bh < 16) return undefined;

    // Trim slightly inside the detected portrait slot / red border line
    // so annotation strokes or outer card text never leak into the avatar
    const inset = Math.max(0, Math.min(0.12, options?.innerInsetRatio ?? 0.025));
    const ix1 = bx1 + bw * inset;
    const ix2 = bx2 - bw * inset;
    const iy1 = by1 + bh * inset;
    const iy2 = by2 - bh * inset;
    const ibw = Math.max(12, ix2 - ix1);
    const ibh = Math.max(12, iy2 - iy1);

    const zoom = Math.max(0.7, Math.min(1.45, options?.zoom ?? 1));
    // Thai ID portrait box is ~4:5 vertical; Math.min(ibw, ibh) keeps square crop 100% inside left/right boundaries
    const baseSide = Math.min(ibw, ibh);
    const side = Math.max(20, Math.min(Math.min(uW, uH), baseSide / zoom));

    let centerX = (ix1 + ix2) / 2;
    let sy = iy1 + Math.max(0, (ibh - side) * 0.1);

    if (
      uHeadNorm &&
      uHeadNorm.xmax > uHeadNorm.xmin &&
      uHeadNorm.ymax > uHeadNorm.ymin
    ) {
      const hx1 = (uHeadNorm.xmin / 1000) * uW;
      const hx2 = (uHeadNorm.xmax / 1000) * uW;
      const hy1 = (uHeadNorm.ymin / 1000) * uH;
      const headCx = (hx1 + hx2) / 2;
      if (headCx >= ix1 - ibw * 0.1 && headCx <= ix2 + ibw * 0.1) {
        centerX = headCx * 0.72 + centerX * 0.28;
      }
      // Leave ~13% headroom above top of hair so head + shoulders frame nicely
      const candidateSy = hy1 - side * 0.13;
      if (candidateSy >= iy1 - bh * 0.05 && candidateSy <= iy2 - side * 0.5) {
        sy = candidateSy;
      }
    }

    const offsetXRatio = options?.offsetXRatio ?? 0;
    const offsetYRatio = options?.offsetYRatio ?? 0;
    let sx = centerX - side / 2 + offsetXRatio * side;
    sy = sy + offsetYRatio * side;

    // Keep strictly inside portrait frame horizontally/vertically when zoomed in (>= 1)
    if (zoom >= 1 && side <= ibw) {
      sx = Math.max(ix1, Math.min(ix2 - side, sx));
    } else {
      sx = Math.max(0, Math.min(uW - side, sx));
    }

    if (zoom >= 1 && side <= ibh) {
      sy = Math.max(iy1, Math.min(iy2 - side, sy));
    } else {
      sy = Math.max(0, Math.min(uH - side, sy));
    }

    const sw = Math.max(1, Math.round(Math.min(side, uW - sx)));
    const sh = Math.max(1, Math.round(Math.min(side, uH - sy)));
    const rx = Math.max(0, Math.round(sx));
    const ry = Math.max(0, Math.round(sy));

    const renderAvatar = (targetPx: number, quality: number): string => {
      const canvas = document.createElement('canvas');
      canvas.width = targetPx;
      canvas.height = targetPx;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetPx, targetPx);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(drawSource, rx, ry, sw, sh, 0, 0, targetPx, targetPx);
      return canvas.toDataURL('image/jpeg', quality);
    };

    let result = renderAvatar(160, 0.85);
    if (result.length > 28000) {
      result = renderAvatar(160, 0.72);
    }
    if (result.length > 36000) {
      result = renderAvatar(128, 0.7);
    }
    return sanitizeCustomerPhotoDataUrl(result);
  } catch {
    return undefined;
  }
}
