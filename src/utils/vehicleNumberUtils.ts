export type VehicleBarcodeTarget = 'both' | 'engine' | 'chassis';

export interface VehicleBarcodeScanResult {
  engineNumber: string;
  chassisNumber: string;
  detectedBarcodeText?: string;
  confidenceNote?: string;
}

/**
 * Normalize motorcycle engine / chassis / VIN serial numbers.
 * Keeps standard uppercase ASCII alphanumeric & safe separator characters (- / . *).
 */
export function normalizeVehicleSerial(raw?: string | null, maxLen = 60): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[\r\n\t\s]+/g, '')
    .replace(/[^A-Z0-9\-/.*_]/g, '')
    .slice(0, maxLen);
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

/**
 * Compress an uploaded image file cleanly while keeping barcode bars and printed serials crisp.
 */
export async function compressImageForBarcodeScan(file: File): Promise<{
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
    if (previewDataUrl.length > 1_400_000) {
      previewDataUrl = canvas.toDataURL('image/jpeg', 0.72);
    }
    const commaIdx = previewDataUrl.indexOf(',');
    const base64 = commaIdx >= 0 ? previewDataUrl.slice(commaIdx + 1) : previewDataUrl;

    return {
      base64,
      mimeType: 'image/jpeg',
      previewDataUrl,
    };
  } catch (decodeErr) {
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

export function captureVideoFrameAsJpeg(video: HTMLVideoElement): {
  base64: string;
  mimeType: string;
  previewDataUrl: string;
} {
  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;
  const maxDim = 1400;
  const scale = Math.min(1, maxDim / Math.max(vw, vh));
  const w = Math.max(1, Math.round(vw * scale));
  const h = Math.max(1, Math.round(vh * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('ไม่สามารถจับภาพจากกล้องได้');
  }
  ctx.drawImage(video, 0, 0, w, h);

  const previewDataUrl = canvas.toDataURL('image/jpeg', 0.88);
  const commaIdx = previewDataUrl.indexOf(',');
  const base64 = commaIdx >= 0 ? previewDataUrl.slice(commaIdx + 1) : previewDataUrl;
  return {
    base64,
    mimeType: 'image/jpeg',
    previewDataUrl,
  };
}

/**
 * Heuristic check to guess whether a single decoded barcode looks more like a 17-char VIN/Chassis or Engine No.
 */
export function classifySingleBarcodeSerial(
  code: string,
  preferredTarget: VehicleBarcodeTarget
): { engineNumber: string; chassisNumber: string } {
  const clean = normalizeVehicleSerial(code);
  if (!clean) return { engineNumber: '', chassisNumber: '' };

  if (preferredTarget === 'engine') {
    return { engineNumber: clean, chassisNumber: '' };
  }
  if (preferredTarget === 'chassis') {
    return { engineNumber: '', chassisNumber: clean };
  }

  // Standard ISO 3779 VIN / Thai motorcycle chassis numbers are often 17 chars (e.g. MLH..., MH3..., LWB...)
  const looksLikeVin =
    clean.length === 17 && /^(MLH|MTH|L|M|J|K|R|V|Z|1|2|3|4|5|6|9)/.test(clean);
  if (looksLikeVin) {
    return { engineNumber: '', chassisNumber: clean };
  }

  // Engine codes often contain a hyphen (e.g. JC75E-1234567, KF40E-0012345, E33NE-...) or 10-15 chars
  if (clean.includes('-') || /^[A-Z0-9]{4,7}E/.test(clean)) {
    return { engineNumber: clean, chassisNumber: '' };
  }

  // Default fallback when 'both' is selected: put in chassis if long (>= 15), otherwise engine
  if (clean.length >= 15) {
    return { engineNumber: '', chassisNumber: clean };
  }
  return { engineNumber: clean, chassisNumber: '' };
}
