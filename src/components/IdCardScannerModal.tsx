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
} from 'lucide-react';
import { useModalTransition } from '../hooks/useModalTransition';
import { triggerHaptic } from '../utils/haptics';
import {
  ThaiIdScanData,
  calculateAgeFromIsoDate,
  compressImageForIdScan,
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

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { shouldRender, isClosing, backdropAnimClass, sheetAnimClass } =
    useModalTransition(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      setStep('pick');
      setPreviewUrl(null);
      setErrorMessage('');
      setFullName('');
      setIdDigits('');
      setBirthDateIso('');
      setAgeInput('');
      setAddress('');
      setExpiryDateIso('');
      setIsLifetimeCard(false);
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

  const handleFileSelected = async (file?: File) => {
    if (!file) return;
    triggerHaptic('light');
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStep('scanning');
    setErrorMessage('');
    setScanStageText('กำลังย่อขนาดและปรับคุณภาพภาพ...');

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

      setFullName(d.fullNameTh || '');
      setIdDigits(cleanedDigits);
      setBirthDateIso(d.dateOfBirthIso || '');
      setAgeInput(computedAge !== null ? String(computedAge) : '');
      setAddress(d.addressTh || '');
      setExpiryDateIso(d.expiryDateIso || '');
      setIsLifetimeCard(Boolean(d.isLifetime));

      triggerHaptic('success');
      setStep('review');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      triggerHaptic('warning');
      setErrorMessage(
        err instanceof Error && err.message
          ? err.message
          : 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง'
      );
      setStep('error');
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
      className={`fixed inset-0 z-[72] flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/75 backdrop-blur-sm ${backdropAnimClass}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg max-h-[92vh] bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl border border-emerald-200/80 dark:border-slate-700/80 flex flex-col overflow-hidden relative ${sheetAnimClass}`}
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
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 overscroll-contain">
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
                  <strong>ความปลอดภัยข้อมูลส่วนบุคคล:</strong> รูปภาพบัตรใช้ประมวลผลสกัดข้อความชั่วคราวเท่านั้น ไม่บันทึกรูปบัตรลงคลาวด์ และไม่แสดงเลขบัตร/ที่อยู่ในใบเสนอราคาหรือข้อความ LINE
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
              {/* Compact reference thumbnail + expiry badge */}
              {previewUrl && (
                <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80">
                  <img
                    src={previewUrl}
                    alt="ภาพบัตรสำหรับเทียบตัวเลข"
                    className="w-24 h-16 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shrink-0"
                  />
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
                  </div>
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
