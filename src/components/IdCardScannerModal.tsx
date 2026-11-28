import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  CreditCard,
  AlertTriangle,
  ImagePlus,
  Loader2,
  MapPin,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  User,
  X,
  Calendar,
  Pencil,
  Crop,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useModalTransition } from '../hooks/useModalTransition';
import { triggerHaptic } from '../utils/haptics';
import {
  FaceBoundingBox,
  ThaiIdScanData,
  calculateAgeFromIsoDate,
  compressImageForIdScan,
  cropIdCardFacePortrait,
  formatThaiDateFromIso,
  formatThaiIdDisplay,
  isThaiIdExpired,
  normalizeThaiIdDigits,
  validateThaiNationalId,
} from '../utils/thaiIdUtils';

export interface AppliedThaiIdData {
  fullName: string;
  idCard: string;
  address: string;
  birthDateIso: string;
  age: string;
  photoUrl?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onApply: (data: AppliedThaiIdData) => void;
  existingCustomerName?: string;
}

type ScannerStep = 'pick' | 'scanning' | 'review' | 'error';

export const IdCardScannerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onApply,
  existingCustomerName,
}) => {
  const [step, setStep] = useState<ScannerStep>('pick');
  const [scanStageText, setScanStageText] = useState<string>('กำลังเตรียมภาพ...');
  const [scanElapsedSec, setScanElapsedSec] = useState<number>(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Editable review state
  const [fullName, setFullName] = useState<string>('');
  const [idDigits, setIdDigits] = useState<string>('');
  const [birthDateIso, setBirthDateIso] = useState<string>('');
  const [ageInput, setAgeInput] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [expiryDateIso, setExpiryDateIso] = useState<string>('');
  const [isLifetimeCard, setIsLifetimeCard] = useState<boolean>(false);
  const [facePhotoUrl, setFacePhotoUrl] = useState<string>('');
  const [includeFacePhoto, setIncludeFacePhoto] = useState<boolean>(true);
  const [autoFaceBox, setAutoFaceBox] = useState<FaceBoundingBox | null>(null);
  const [autoHeadBox, setAutoHeadBox] = useState<FaceBoundingBox | null>(null);
  const [cardOrientationDeg, setCardOrientationDeg] = useState<number>(0);
  const [activeFaceBox, setActiveFaceBox] = useState<FaceBoundingBox | null>(null);
  const [isManualCrop, setIsManualCrop] = useState<boolean>(false);
  const [showCropAdjuster, setShowCropAdjuster] = useState<boolean>(false);
  const [cropZoom, setCropZoom] = useState<number>(1);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cropStageRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    originBox: FaceBoundingBox;
  } | null>(null);

  const { shouldRender, isClosing, backdropAnimClass, sheetAnimClass } =
    useModalTransition(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      setStep('pick');
      setScanElapsedSec(0);
      setPreviewUrl(null);
      setErrorMessage('');
      setFullName('');
      setIdDigits('');
      setBirthDateIso('');
      setAgeInput('');
      setAddress('');
      setExpiryDateIso('');
      setIsLifetimeCard(false);
      setFacePhotoUrl('');
      setIncludeFacePhoto(true);
      setAutoFaceBox(null);
      setAutoHeadBox(null);
      setCardOrientationDeg(0);
      setActiveFaceBox(null);
      setIsManualCrop(false);
      setShowCropAdjuster(false);
      setCropZoom(1);
    } else {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (step !== 'scanning') {
      setScanElapsedSec(0);
      return;
    }
    const startMs = Date.now();
    const timer = window.setInterval(() => {
      setScanElapsedSec(Math.floor((Date.now() - startMs) / 1000));
    }, 500);
    return () => window.clearInterval(timer);
  }, [step]);

  const handleFileSelected = async (file?: File) => {
    if (!file) return;
    triggerHaptic('light');
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    let didTimeout = false;
    const timeoutId = window.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, 28000);

    setStep('scanning');
    setScanElapsedSec(0);
    setErrorMessage('');
    setScanStageText('กำลังย่อขนาดภาพ...');

    try {
      const compressed = await compressImageForIdScan(file);
      if (controller.signal.aborted) return;

      setPreviewUrl(compressed.previewDataUrl);
      setScanStageText('กำลังอ่านข้อมูลจากบัตรประชาชน...');

      const response = await fetch('/api/scan-id-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: compressed.base64,
          mimeType: compressed.mimeType,
        }),
        signal: controller.signal,
      });

      const json = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; data?: ThaiIdScanData }
        | null;

      if (controller.signal.aborted) return;

      if (!response.ok || !json?.ok || !json.data) {
        triggerHaptic('warning');
        setErrorMessage(
          json?.error ||
            'ไม่สามารถอ่านข้อมูลจากภาพได้ กรุณาลองถ่ายใหม่ในที่สว่างและไม่สะท้อนแสง'
        );
        setStep('error');
        return;
      }

      const d = json.data;
      const cleanedDigits = normalizeThaiIdDigits(d.idNumber);
      const computedAge = calculateAgeFromIsoDate(d.dateOfBirthIso);
      const detectedOrientation = typeof d.cardOrientationDeg === 'number' ? d.cardOrientationDeg : 0;
      const detectedFaceBox = d.faceBox || null;
      const detectedHeadBox = d.headBox || null;
      const croppedFace = await cropIdCardFacePortrait(compressed.previewDataUrl, detectedFaceBox, {
        headBox: detectedHeadBox,
        cardOrientationDeg: detectedOrientation,
        zoom: 1,
      });
      if (controller.signal.aborted) return;

      setFullName(d.fullNameTh || '');
      setIdDigits(cleanedDigits);
      setBirthDateIso(d.dateOfBirthIso || '');
      setAgeInput(computedAge !== null ? String(computedAge) : '');
      setAddress(d.addressTh || '');
      setExpiryDateIso(d.expiryDateIso || '');
      setIsLifetimeCard(Boolean(d.isLifetime));
      setAutoFaceBox(detectedFaceBox);
      setAutoHeadBox(detectedHeadBox);
      setCardOrientationDeg(detectedOrientation);
      setActiveFaceBox(detectedFaceBox);
      setIsManualCrop(false);
      setShowCropAdjuster(false);
      setCropZoom(1);
      setFacePhotoUrl(croppedFace || '');
      setIncludeFacePhoto(Boolean(croppedFace));

      triggerHaptic('success');
      setStep('review');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (!didTimeout) return;
        triggerHaptic('warning');
        setErrorMessage(
          'การสแกนใช้เวลานานเกินกำหนด กรุณาลองถ่ายใหม่ในที่สว่างหรือเช็กสัญญาณอินเทอร์เน็ต'
        );
        setStep('error');
        return;
      }
      triggerHaptic('warning');
      setErrorMessage(
        err instanceof Error && err.message
          ? err.message
          : 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง'
      );
      setStep('error');
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  useEffect(() => {
    if (step !== 'review' || !previewUrl || !activeFaceBox) return;
    if (!isManualCrop && cropZoom === 1) return;
    let cancelled = false;
    void cropIdCardFacePortrait(previewUrl, activeFaceBox, {
      headBox: isManualCrop ? null : autoHeadBox,
      cardOrientationDeg,
      innerInsetRatio: isManualCrop ? 0.015 : 0.025,
      zoom: cropZoom,
    }).then((url) => {
      if (!cancelled && url) {
        setFacePhotoUrl(url);
        setIncludeFacePhoto(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [step, previewUrl, activeFaceBox, isManualCrop, cropZoom, autoHeadBox, cardOrientationDeg]);

  const nudgeActiveBox = (dx: number, dy: number) => {
    setActiveFaceBox((prev) => {
      const base: FaceBoundingBox = prev || {
        ymin: 445,
        xmin: 710,
        ymax: 890,
        xmax: 920,
      };
      const w = base.xmax - base.xmin;
      const h = base.ymax - base.ymin;
      const nextXmin = Math.max(0, Math.min(1000 - w, Math.round(base.xmin + dx)));
      const nextYmin = Math.max(0, Math.min(1000 - h, Math.round(base.ymin + dy)));
      return {
        xmin: nextXmin,
        ymin: nextYmin,
        xmax: nextXmin + w,
        ymax: nextYmin + h,
      };
    });
    setIsManualCrop(true);
    triggerHaptic('selection');
  };

  const handleResetAutoCrop = async () => {
    if (!previewUrl || !autoFaceBox) return;
    triggerHaptic('light');
    setIsManualCrop(false);
    setCropZoom(1);
    setActiveFaceBox(autoFaceBox);
    const url = await cropIdCardFacePortrait(previewUrl, autoFaceBox, {
      headBox: autoHeadBox,
      cardOrientationDeg,
      zoom: 1,
    });
    if (url) {
      setFacePhotoUrl(url);
      setIncludeFacePhoto(true);
    }
  };

  const handleOpenManualCropInit = async () => {
    if (!previewUrl) return;
    triggerHaptic('selection');
    const fallbackBox: FaceBoundingBox = activeFaceBox ||
      autoFaceBox || { ymin: 445, xmin: 700, ymax: 860, xmax: 910 };
    setActiveFaceBox(fallbackBox);
    setShowCropAdjuster(true);
    if (!facePhotoUrl) {
      setIsManualCrop(true);
      const url = await cropIdCardFacePortrait(previewUrl, fallbackBox, {
        cardOrientationDeg,
        zoom: cropZoom,
      });
      if (url) {
        setFacePhotoUrl(url);
        setIncludeFacePhoto(true);
      }
    }
  };

  const handleCropPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = cropStageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const px = ((e.clientX - rect.left) / rect.width) * 1000;
    const py = ((e.clientY - rect.top) / rect.height) * 1000;

    const current: FaceBoundingBox = activeFaceBox || {
      ymin: 445,
      xmin: 700,
      ymax: 860,
      xmax: 910,
    };
    const w = current.xmax - current.xmin;
    const h = current.ymax - current.ymin;

    let origin = current;
    const inside =
      px >= current.xmin &&
      px <= current.xmax &&
      py >= current.ymin &&
      py <= current.ymax;
    if (!inside) {
      const nextXmin = Math.max(0, Math.min(1000 - w, Math.round(px - w / 2)));
      const nextYmin = Math.max(0, Math.min(1000 - h, Math.round(py - h / 2)));
      origin = {
        xmin: nextXmin,
        ymin: nextYmin,
        xmax: nextXmin + w,
        ymax: nextYmin + h,
      };
      setActiveFaceBox(origin);
      setIsManualCrop(true);
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originBox: origin,
    };
  };

  const handleCropPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    const el = cropStageRef.current;
    if (!drag || !el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dx = ((e.clientX - drag.startX) / rect.width) * 1000;
    const dy = ((e.clientY - drag.startY) / rect.height) * 1000;
    const w = drag.originBox.xmax - drag.originBox.xmin;
    const h = drag.originBox.ymax - drag.originBox.ymin;
    const nextXmin = Math.max(0, Math.min(1000 - w, Math.round(drag.originBox.xmin + dx)));
    const nextYmin = Math.max(0, Math.min(1000 - h, Math.round(drag.originBox.ymin + dy)));
    setActiveFaceBox({
      xmin: nextXmin,
      ymin: nextYmin,
      xmax: nextXmin + w,
      ymax: nextYmin + h,
    });
    setIsManualCrop(true);
  };

  const handleCropPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current) {
      dragStateRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const handleBirthDateChange = (nextIso: string) => {
    setBirthDateIso(nextIso);
    const calc = calculateAgeFromIsoDate(nextIso);
    if (calc !== null) {
      setAgeInput(String(calc));
    }
  };

  const handleOpenManualFallback = () => {
    triggerHaptic('light');
    if (
      !fullName &&
      existingCustomerName &&
      existingCustomerName.trim() !== 'คุณลูกค้า'
    ) {
      setFullName(existingCustomerName.trim());
    }
    setStep('review');
  };

  const handleConfirmApply = () => {
    const cleanDigits = normalizeThaiIdDigits(idDigits);
    const cleanName = fullName.trim();
    const cleanAddress = address.trim();
    const cleanAge = ageInput.trim();

    if (!cleanName && !cleanDigits && !cleanAddress) {
      triggerHaptic('warning');
      setErrorMessage('กรุณาระบุข้อมูลอย่างน้อย 1 รายการก่อนนำเข้าสู่เคส');
      return;
    }

    triggerHaptic('success');
    onApply({
      fullName: cleanName,
      idCard: cleanDigits,
      address: cleanAddress,
      birthDateIso: birthDateIso.trim(),
      age: cleanAge,
      photoUrl: includeFacePhoto && facePhotoUrl ? facePhotoUrl : undefined,
    });
    onClose();
  };

  if (!shouldRender) return null;

  const idValidation = validateThaiNationalId(idDigits);
  const expiredCard = isThaiIdExpired(expiryDateIso, isLifetimeCard);
  const thaiBirthDisplay = formatThaiDateFromIso(birthDateIso);
  const thaiExpiryDisplay = isLifetimeCard
    ? 'ตลอดชีพ'
    : formatThaiDateFromIso(expiryDateIso);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="สแกนบัตรประชาชน"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isClosing) {
          onClose();
        }
      }}
      className={`fixed inset-0 z-[72] flex items-center justify-center p-2 sm:p-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-slate-950/75 backdrop-blur-sm overflow-y-auto overscroll-contain ${backdropAnimClass}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] min-h-0 my-auto bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl border border-emerald-200/80 dark:border-slate-700/80 flex flex-col overflow-hidden relative ${sheetAnimClass}`}
      >
        {/* Top Specular Accent */}
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-emerald-400 via-teal-400 to-sky-500 opacity-95" />

        {/* Hidden native file inputs for reliable iOS/Android camera & gallery triggers */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            void handleFileSelected(f);
          }}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            void handleFileSelected(f);
          }}
        />

        {/* Header */}
        <div className="p-4 pb-3 border-b border-emerald-100 dark:border-slate-800 bg-gradient-to-b from-emerald-50/80 dark:from-slate-800/80 to-transparent flex items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/25 shrink-0">
              <ScanLine className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 tracking-tight truncate">
                สแกนบัตรประชาชนลูกค้า
              </h2>
              <p className="text-[10.5px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate">
                นำเข้าชื่อ อายุ เลข 13 หลัก และที่อยู่ลงในเคส (ไม่แสดงในใบเสนอราคา)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="ปิดหน้าต่างสแกนบัตร"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5 overscroll-contain">
          {/* STEP 1: PICK CAMERA OR GALLERY */}
          {step === 'pick' && (
            <div className="space-y-3.5 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    cameraInputRef.current?.click();
                  }}
                  className="group p-4 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50/70 to-white dark:from-emerald-950/60 dark:via-teal-950/40 dark:to-slate-900 border border-emerald-200 dark:border-emerald-800/70 hover:border-emerald-400 dark:hover:border-emerald-500 text-left transition-all cursor-pointer active:scale-[0.98] shadow-xs"
                >
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-sm shadow-emerald-500/25 mb-3 group-hover:scale-105 transition-transform">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div className="font-black text-sm text-slate-900 dark:text-slate-100">
                    เปิดกล้องถ่ายรูป
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    ถ่ายบัตรประชาชนตัวจริงหน้างานด้วยกล้องหลังทันที
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    galleryInputRef.current?.click();
                  }}
                  className="group p-4 rounded-2xl bg-gradient-to-br from-sky-50 via-cyan-50/70 to-white dark:from-sky-950/60 dark:via-cyan-950/40 dark:to-slate-900 border border-sky-200 dark:border-sky-800/70 hover:border-sky-400 dark:hover:border-sky-500 text-left transition-all cursor-pointer active:scale-[0.98] shadow-xs"
                >
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-sm shadow-sky-500/25 mb-3 group-hover:scale-105 transition-transform">
                    <ImagePlus className="w-5 h-5" />
                  </div>
                  <div className="font-black text-sm text-slate-900 dark:text-slate-100">
                    เลือกรูปจากคลังภาพ
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    เลือกรูปบัตรประชาชนที่ลูกค้าส่งมาทางแชทหรือ LINE
                  </p>
                </button>
              </div>

              {/* Photo Tips */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                <div className="font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>เคล็ดลับเพื่อให้ระบบอ่านข้อมูลแม่นยำ 100%</span>
                </div>
                <ul className="space-y-1 pl-4 list-disc text-slate-500 dark:text-slate-400 leading-relaxed">
                  <li>วางบัตรบนพื้นเรียบ ให้เห็นครบทั้ง 4 มุมของบัตรประชาชน</li>
                  <li>ถ่ายในที่แสงสว่างเพียงพอ หลีกเลี่ยงแสงแฟลชหรือเงาสะท้อนทับตัวเลข</li>
                  <li>หากนิ้วบังข้อความบางส่วน ระบบอาจอ่านที่อยู่หรือวันเกิดได้ไม่ครบ</li>
                </ul>
              </div>

              {/* PDPA Note */}
              <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/60 flex items-start gap-2 text-[10.5px] text-emerald-900 dark:text-emerald-200">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  <strong>ความปลอดภัยข้อมูลส่วนบุคคล:</strong> รูปบัตรเต็มใบใช้ประมวลผลข้อความชั่วคราวเท่านั้น (ตัดเก็บเฉพาะรูปใบหน้าโปรไฟล์ขนาดย่อไว้ในข้อมูลเคส และไม่แสดงข้อมูลบัตร/รูปในใบเสนอราคาหรือข้อความ LINE)
                </span>
              </div>
            </div>
          )}

          {/* STEP 2: SCANNING / PROCESSING */}
          {step === 'scanning' && (
            <div className="py-4 space-y-4 text-center animate-fade-in">
              <div className="relative mx-auto max-w-xs aspect-[1.58/1] rounded-2xl overflow-hidden border-2 border-emerald-400/70 dark:border-emerald-500/60 bg-slate-100 dark:bg-slate-800 shadow-lg flex items-center justify-center">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="ตัวอย่างบัตรประชาชน"
                    className="w-full h-full object-cover opacity-80"
                  />
                ) : (
                  <CreditCard className="w-12 h-12 text-slate-400" />
                )}
                <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2 text-white px-4">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-300" />
                  <span className="text-xs font-extrabold tracking-wide drop-shadow">
                    {scanStageText}
                    {scanElapsedSec > 0 ? ` (${scanElapsedSec} วินาที)` : ''}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                กำลังแยกชื่อ-สกุล วันเกิด เลขบัตร 13 หลัก และที่อยู่ตามบัตร...
              </p>
            </div>
          )}

          {/* STEP 3: RECOVERABLE ERROR */}
          {step === 'error' && (
            <div className="space-y-3.5 animate-fade-in">
              {previewUrl && (
                <div className="mx-auto max-w-[260px] aspect-[1.58/1] rounded-2xl overflow-hidden border border-rose-200 dark:border-rose-800/70 bg-slate-100 dark:bg-slate-800 shadow-xs">
                  <img
                    src={previewUrl}
                    alt="ภาพที่อัปโหลด"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 flex items-start gap-2.5 text-xs text-rose-900 dark:text-rose-200">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-extrabold">ไม่สามารถอ่านข้อมูลบัตรได้</div>
                  <p className="text-[11px] leading-relaxed text-rose-800 dark:text-rose-200/90">
                    {errorMessage}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  <span>ถ่ายรูปใหม่</span>
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ImagePlus className="w-4 h-4" />
                  <span>เลือกรูปอื่น</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleOpenManualFallback}
                className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>กรอกข้อมูลบัตรด้วยตนเอง</span>
              </button>
            </div>
          )}

          {/* STEP 4: REVIEW & EDIT */}
          {step === 'review' && (
            <div className="space-y-3 animate-fade-in">
              {/* Compact reference thumbnail + detected red portrait overlay + interactive fine-tune + expiry badge */}
              {(previewUrl || facePhotoUrl) && (
                <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
                  <div className="flex items-center gap-3">
                    {previewUrl && (
                      <button
                        type="button"
                        onClick={() => void handleOpenManualCropInit()}
                        className="relative w-24 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-200/60 dark:bg-slate-900 cursor-pointer group/thumb"
                        title="แตะเพื่อดูหรือปรับกรอบรูปลูกค้า"
                      >
                        <img
                          src={previewUrl}
                          alt="ภาพบัตรสำหรับเทียบตัวเลข"
                          className="w-full h-auto block"
                        />
                        {activeFaceBox && (
                          <div
                            className="absolute border-2 border-rose-500 shadow-[0_0_0_1px_rgba(255,255,255,0.85)] rounded-[3px] pointer-events-none transition-all duration-150"
                            style={{
                              left: `${activeFaceBox.xmin / 10}%`,
                              top: `${activeFaceBox.ymin / 10}%`,
                              width: `${(activeFaceBox.xmax - activeFaceBox.xmin) / 10}%`,
                              height: `${(activeFaceBox.ymax - activeFaceBox.ymin) / 10}%`,
                            }}
                          />
                        )}
                      </button>
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>สแกนข้อมูลเรียบร้อย — โปรดตรวจทานก่อนบันทึก</span>
                      </div>
                      {thaiExpiryDisplay && (
                        <div
                          className={`text-[10px] font-bold ${
                            expiredCard
                              ? 'text-rose-700 dark:text-rose-300'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          วันบัตรหมดอายุ: {thaiExpiryDisplay}
                          {expiredCard ? ' (บัตรหมดอายุแล้ว!)' : ''}
                        </div>
                      )}
                      {previewUrl && !facePhotoUrl && (
                        <button
                          type="button"
                          onClick={() => void handleOpenManualCropInit()}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold cursor-pointer"
                        >
                          <Crop className="w-3 h-3" />
                          <span>เลือกกรอบรูปลูกค้าเอง</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {facePhotoUrl && (
                    <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-slate-900/90 border border-emerald-200/80 dark:border-emerald-800/60">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={facePhotoUrl}
                          alt="รูปใบหน้าจากบัตรประชาชน"
                          className={`w-12 h-12 rounded-xl object-cover object-top border shrink-0 transition-opacity ${
                            includeFacePhoto
                              ? 'border-emerald-400 dark:border-emerald-500 shadow-xs opacity-100'
                              : 'border-slate-300 dark:border-slate-700 opacity-40 grayscale'
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100 truncate">
                            รูปโปรไฟล์จากบัตรประชาชน
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {includeFacePhoto
                              ? isManualCrop
                                ? 'ปรับกรอบแล้ว • จะบันทึกในเคส'
                                : 'จับกรอบอัตโนมัติ • จะบันทึกในเคส'
                              : 'ปิดการแนบรูปโปรไฟล์ในเคสนี้'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {previewUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('selection');
                              if (!showCropAdjuster && !activeFaceBox) {
                                void handleOpenManualCropInit();
                              } else {
                                setShowCropAdjuster((v) => !v);
                              }
                            }}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer transition-colors inline-flex items-center gap-1 ${
                              showCropAdjuster
                                ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-700'
                                : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                            title="ขยับกรอบหรือซูมรูปใบหน้า"
                          >
                            <Crop className="w-3 h-3" />
                            <span>ปรับกรอบ</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('selection');
                            setIncludeFacePhoto((v) => !v);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border cursor-pointer transition-colors ${
                            includeFacePhoto
                              ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700'
                              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {includeFacePhoto ? '✓ ใช้รูปนี้' : '+ เปิดใช้รูป'}
                        </button>
                      </div>
                    </div>
                  )}

                  {showCropAdjuster && previewUrl && activeFaceBox && (
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800/70 space-y-2 animate-fade-in">
                      <div className="flex items-center justify-between gap-2 text-[10.5px]">
                        <span className="font-extrabold text-sky-900 dark:text-sky-200">
                          ลากกรอบสีแดงหรือกดลูกศรเพื่อปรับตำแหน่งรูป
                        </span>
                        {autoFaceBox && (
                          <button
                            type="button"
                            onClick={() => void handleResetAutoCrop()}
                            className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer"
                          >
                            คืนค่าอัตโนมัติ
                          </button>
                        )}
                      </div>

                      <div
                        ref={cropStageRef}
                        onPointerDown={handleCropPointerDown}
                        onPointerMove={handleCropPointerMove}
                        onPointerUp={handleCropPointerUp}
                        onPointerCancel={handleCropPointerUp}
                        className="relative w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 touch-none select-none cursor-crosshair"
                      >
                        <img
                          src={previewUrl}
                          alt="ปรับตำแหน่งกรอบรูปลูกค้า"
                          draggable={false}
                          className="w-full h-auto block pointer-events-none"
                        />
                        <div
                          className="absolute border-2 border-rose-500 bg-rose-500/10 shadow-[0_0_0_9999px_rgba(15,23,42,0.35)] rounded pointer-events-none"
                          style={{
                            left: `${activeFaceBox.xmin / 10}%`,
                            top: `${activeFaceBox.ymin / 10}%`,
                            width: `${(activeFaceBox.xmax - activeFaceBox.xmin) / 10}%`,
                            height: `${(activeFaceBox.ymax - activeFaceBox.ymin) / 10}%`,
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => nudgeActiveBox(-12, 0)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                            aria-label="เลื่อนซ้าย"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => nudgeActiveBox(0, -12)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                            aria-label="เลื่อนขึ้น"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => nudgeActiveBox(0, 12)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                            aria-label="เลื่อนลง"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => nudgeActiveBox(12, 0)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                            aria-label="เลื่อนขวา"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setCropZoom((z) => Math.max(0.8, Number((z - 0.1).toFixed(2))))
                            }
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                            aria-label="ซูมออก"
                          >
                            <ZoomOut className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[10px] font-bold tabular-nums text-slate-600 dark:text-slate-300 w-10 text-center">
                            {Math.round(cropZoom * 100)}%
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setCropZoom((z) => Math.min(1.4, Number((z + 0.1).toFixed(2))))
                            }
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                            aria-label="ซูมเข้า"
                          >
                            <ZoomIn className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowCropAdjuster(false)}
                            className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[10px] font-bold cursor-pointer"
                          >
                            เสร็จสิ้น
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {expiredCard && (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700/70 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>คำเตือน:</strong> บัตรประชาชนใบนี้ระบุวันหมดอายุ ({thaiExpiryDisplay}) ซึ่งเลยกำหนดแล้ว กรุณาตรวจสอบกับลูกค้าก่อนยื่นขอสินเชื่อ
                  </span>
                </div>
              )}

              {/* 1. Full Name */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>ชื่อ-นามสกุล (จะกรอกลงช่องชื่อลูกค้าอัตโนมัติ)</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="เช่น นายสมชาย ใจดี"
                  className="w-full rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* 2. 13-digit National ID + Live Mod-11 validation */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>เลขประจำตัวประชาชน 13 หลัก</span>
                  </label>
                  {idDigits ? (
                    idValidation.isValid ? (
                      <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> ถูกต้องครบ 13 หลัก
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> ควรตรวจทาน
                      </span>
                    )
                  ) : null}
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={17}
                  value={formatThaiIdDisplay(idDigits)}
                  onChange={(e) => setIdDigits(normalizeThaiIdDigits(e.target.value))}
                  placeholder="X-XXXX-XXXXX-XX-X"
                  className={`w-full rounded-xl px-3 py-2 text-sm font-mono font-black tracking-wider tabular-nums outline-none border ${
                    idDigits && !idValidation.isValid
                      ? 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-100'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-emerald-500'
                  }`}
                />
                {idDigits && !idValidation.isValid && idValidation.reason && (
                  <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-1">
                    {idValidation.reason}
                  </p>
                )}
              </div>

              {/* 3. Birth Date & Auto-Calculated Age */}
              <div className="grid grid-cols-12 gap-2.5">
                <div className="col-span-7">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>วันเกิด {thaiBirthDisplay ? `(${thaiBirthDisplay})` : '(ค.ศ.)'}</span>
                  </label>
                  <input
                    type="date"
                    value={birthDateIso}
                    onChange={(e) => handleBirthDateChange(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:outline-none dark:[color-scheme:dark] tabular-nums"
                  />
                </div>
                <div className="col-span-5">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                    อายุคำนวณได้ (ปี)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={ageInput}
                    onChange={(e) => setAgeInput(e.target.value)}
                    placeholder="เช่น 28"
                    className="w-full rounded-xl px-3 py-2 text-xs font-black text-emerald-800 dark:text-emerald-200 bg-emerald-50/70 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-700/70 focus:border-emerald-500 focus:outline-none tabular-nums"
                  />
                </div>
              </div>

              {/* 4. Address on ID Card */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>ที่อยู่ตามบัตรประชาชน (เก็บในเคสเท่านั้น)</span>
                </label>
                <textarea
                  rows={3}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="บ้านเลขที่ หมู่ ซอย ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด"
                  className="w-full rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:outline-none leading-relaxed"
                />
              </div>

              {errorMessage && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-[11px] font-bold text-rose-700 dark:text-rose-200">
                  {errorMessage}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/70 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
          {step === 'review' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setStep('pick');
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>สแกนใหม่</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmApply}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/25 cursor-pointer active:scale-[0.98] transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>ยืนยันนำข้อมูลใส่เคส</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleOpenManualFallback}
                className="text-[11px] font-bold text-slate-500 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-300 cursor-pointer transition-colors"
              >
                กรอกเองโดยไม่สแกน
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer transition-colors"
              >
                ปิด
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
