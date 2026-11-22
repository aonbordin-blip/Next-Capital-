import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  Barcode,
  Camera,
  CheckCircle2,
  Flashlight,
  ImagePlus,
  Keyboard,
  Loader2,
  RotateCcw,
  ScanLine,
  Sparkles,
  X,
} from 'lucide-react';
import { useModalTransition } from '../hooks/useModalTransition';
import { triggerHaptic } from '../utils/haptics';
import {
  VehicleBarcodeScanResult,
  VehicleBarcodeTarget,
  captureVideoFrameAsJpeg,
  classifySingleBarcodeSerial,
  compressImageForBarcodeScan,
  normalizeVehicleSerial,
} from '../utils/vehicleNumberUtils';

interface DetectedBarcodeItem {
  rawValue?: string;
  format?: string;
}

interface NativeBarcodeDetector {
  detect: (source: ImageBitmapSource) => Promise<DetectedBarcodeItem[]>;
}

interface NativeBarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): NativeBarcodeDetector;
  getSupportedFormats?: () => Promise<string[]>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialTarget?: VehicleBarcodeTarget;
  initialEngineNumber?: string;
  initialChassisNumber?: string;
  onApply: (data: { engineNumber?: string; chassisNumber?: string }) => void;
  customerName?: string;
}

type ScannerStep = 'pick' | 'live' | 'scanning' | 'review' | 'error';

const PREFERRED_BARCODE_FORMATS = [
  'code_128',
  'code_39',
  'code_93',
  'qr_code',
  'data_matrix',
  'ean_13',
  'ean_8',
  'itf',
  'codabar',
  'aztec',
  'pdf417',
];

function getBarcodeDetectorCtor(): NativeBarcodeDetectorConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as { BarcodeDetector?: NativeBarcodeDetectorConstructor };
  return typeof win.BarcodeDetector === 'function' ? win.BarcodeDetector : null;
}

function playScanSuccessBeep(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1560, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.13);
    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 250);
  } catch {
    // Ignore audio context errors on restricted devices
  }
}

export const VehicleBarcodeScannerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  initialTarget = 'both',
  initialEngineNumber = '',
  initialChassisNumber = '',
  onApply,
  customerName,
}) => {
  const [target, setTarget] = useState<VehicleBarcodeTarget>(initialTarget);
  const [step, setStep] = useState<ScannerStep>('pick');
  const [scanStageText, setScanStageText] = useState<string>('กำลังเตรียมภาพ...');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [confidenceNote, setConfidenceNote] = useState<string>('');

  const [engineNumber, setEngineNumber] = useState<string>('');
  const [chassisNumber, setChassisNumber] = useState<string>('');

  const [hasNativeDetector, setHasNativeDetector] = useState<boolean>(false);
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [torchEnabled, setTorchEnabled] = useState<boolean>(false);
  const [liveHint, setLiveHint] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const detectorRef = useRef<NativeBarcodeDetector | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const engineRef = useRef<string>('');
  const chassisRef = useRef<string>('');
  const targetRef = useRef<VehicleBarcodeTarget>(initialTarget);

  useEffect(() => {
    engineRef.current = engineNumber;
  }, [engineNumber]);

  useEffect(() => {
    chassisRef.current = chassisNumber;
  }, [chassisNumber]);

  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  const stopLiveCamera = useCallback(() => {
    if (scanIntervalRef.current !== null) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchSupported(false);
    setTorchEnabled(false);
  }, []);

  const handleClose = useCallback(() => {
    stopLiveCamera();
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    onClose();
  }, [onClose, stopLiveCamera]);

  const { shouldRender, isClosing, backdropAnimClass, sheetAnimClass } =
    useModalTransition(isOpen, handleClose);

  useEffect(() => {
    if (isOpen) {
      setTarget(initialTarget);
      targetRef.current = initialTarget;
      const initEng = normalizeVehicleSerial(initialEngineNumber);
      const initChs = normalizeVehicleSerial(initialChassisNumber);
      setEngineNumber(initEng);
      setChassisNumber(initChs);
      engineRef.current = initEng;
      chassisRef.current = initChs;
      setStep('pick');
      setPreviewUrl(null);
      setErrorMessage('');
      setConfidenceNote('');
      setLiveHint('');
      setHasNativeDetector(Boolean(getBarcodeDetectorCtor()));
    } else {
      stopLiveCamera();
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    }
  }, [isOpen, initialTarget, initialEngineNumber, initialChassisNumber, stopLiveCamera]);

  useEffect(() => {
    return () => {
      stopLiveCamera();
      abortControllerRef.current?.abort();
    };
  }, [stopLiveCamera]);

  const createDetectorInstance = useCallback(async (): Promise<NativeBarcodeDetector | null> => {
    const Ctor = getBarcodeDetectorCtor();
    if (!Ctor) return null;
    try {
      if (typeof Ctor.getSupportedFormats === 'function') {
        const supported = await Ctor.getSupportedFormats();
        const filtered = PREFERRED_BARCODE_FORMATS.filter((f) => supported.includes(f));
        if (filtered.length > 0) {
          return new Ctor({ formats: filtered });
        }
      }
      return new Ctor();
    } catch {
      try {
        return new Ctor();
      } catch {
        return null;
      }
    }
  }, []);

  const applyDetectedBarcodesFromList = useCallback(
    (items: DetectedBarcodeItem[], currentTarget: VehicleBarcodeTarget): boolean => {
      const cleanedValues = Array.from(
        new Set(
          items
            .map((item) => normalizeVehicleSerial(item.rawValue))
            .filter((val) => val.length >= 4)
        )
      );
      if (cleanedValues.length === 0) return false;

      let nextEngine = engineRef.current;
      let nextChassis = chassisRef.current;

      if (currentTarget === 'engine') {
        nextEngine = cleanedValues[0];
      } else if (currentTarget === 'chassis') {
        nextChassis = cleanedValues[0];
      } else if (cleanedValues.length >= 2) {
        // Assign the 17-char VIN-like value to chassis and the remaining serial to engine
        const vinCandidate =
          cleanedValues.find(
            (v) => v.length === 17 && /^(MLH|MTH|L|M|J|K|R|V|Z|1|2|3|4|5|6|9)/.test(v)
          ) || cleanedValues.find((v) => v.length >= 16);
        if (vinCandidate) {
          nextChassis = vinCandidate;
          const other = cleanedValues.find((v) => v !== vinCandidate);
          if (other) nextEngine = other;
        } else {
          nextEngine = cleanedValues[0];
          nextChassis = cleanedValues[1];
        }
      } else {
        const classified = classifySingleBarcodeSerial(cleanedValues[0], currentTarget);
        if (classified.engineNumber) nextEngine = classified.engineNumber;
        if (classified.chassisNumber) nextChassis = classified.chassisNumber;
      }

      setEngineNumber(nextEngine);
      setChassisNumber(nextChassis);
      setConfidenceNote(
        cleanedValues.length >= 2
          ? 'สแกนบาร์โค้ดพบ 2 รายการอัตโนมัติ (สามารถสลับช่องหรือแก้ไขได้)'
          : 'สแกนบาร์โค้ดสำเร็จอัตโนมัติ (ตรวจสอบความถูกต้องก่อนบันทึก)'
      );
      return true;
    },
    []
  );

  const sendImageToServerScan = useCallback(
    async (payload: {
      base64: string;
      mimeType: string;
      previewDataUrl: string;
      scanTarget: VehicleBarcodeTarget;
    }) => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      let didTimeout = false;
      const timeoutId = window.setTimeout(() => {
        didTimeout = true;
        controller.abort();
      }, 28000);

      setPreviewUrl(payload.previewDataUrl);
      setStep('scanning');
      setErrorMessage('');
      setScanStageText('กำลังอ่านบาร์โค้ดและตัวเลขบนภาพ...');

      try {
        const response = await fetch('/api/scan-vehicle-barcode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: payload.base64,
            mimeType: payload.mimeType,
            scanTarget: payload.scanTarget,
          }),
          signal: controller.signal,
        });

        const json = (await response.json().catch(() => null)) as
          | { ok?: boolean; error?: string; data?: VehicleBarcodeScanResult }
          | null;

        if (controller.signal.aborted) return;

        if (!response.ok || !json?.ok || !json.data) {
          triggerHaptic('warning');
          setErrorMessage(
            json?.error ||
              'ไม่สามารถอ่านบาร์โค้ดหรือเลขเครื่อง/เลขถังจากภาพได้ กรุณาถ่ายให้ชัดและใกล้ขึ้น'
          );
          setStep('error');
          return;
        }

        const d = json.data;
        const scannedEngine = normalizeVehicleSerial(d.engineNumber);
        const scannedChassis = normalizeVehicleSerial(d.chassisNumber);

        if (payload.scanTarget === 'engine') {
          if (scannedEngine) {
            setEngineNumber(scannedEngine);
          } else if (scannedChassis) {
            setEngineNumber(scannedChassis);
          }
          if (scannedChassis && !chassisRef.current) {
            setChassisNumber(scannedChassis);
          }
        } else if (payload.scanTarget === 'chassis') {
          if (scannedChassis) {
            setChassisNumber(scannedChassis);
          } else if (scannedEngine) {
            setChassisNumber(scannedEngine);
          }
          if (scannedEngine && !engineRef.current) {
            setEngineNumber(scannedEngine);
          }
        } else {
          if (scannedEngine) setEngineNumber(scannedEngine);
          if (scannedChassis) setChassisNumber(scannedChassis);
        }

        setConfidenceNote(d.confidenceNote || 'อ่านข้อมูลจากภาพสำเร็จ');
        playScanSuccessBeep();
        triggerHaptic('success');
        setStep('review');
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          if (!didTimeout) return;
          triggerHaptic('warning');
          setErrorMessage(
            'การอ่านภาพใช้เวลานานเกินกำหนด กรุณาลองถ่ายใหม่ในที่สว่างหรือเช็กอินเทอร์เน็ต'
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
    },
    []
  );

  const startLiveCamera = useCallback(
    async (overrideTarget?: VehicleBarcodeTarget) => {
      const activeTarget = overrideTarget || targetRef.current;
      if (overrideTarget) {
        setTarget(overrideTarget);
        targetRef.current = overrideTarget;
      }

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        triggerHaptic('warning');
        setErrorMessage(
          'เบราว์เซอร์นี้ไม่รองรับการเปิดกล้องสดโดยตรง กรุณาใช้ปุ่ม "ถ่ายภาพ / เลือกรูปจากเครื่อง" แทน'
        );
        setStep('error');
        return;
      }

      triggerHaptic('light');
      stopLiveCamera();
      setErrorMessage('');
      setLiveHint('กำลังเปิดกล้องหลัง...');
      setStep('live');

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        streamRef.current = stream;

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && typeof videoTrack.getCapabilities === 'function') {
          const caps = videoTrack.getCapabilities() as MediaTrackCapabilities & {
            torch?: boolean;
          };
          setTorchSupported(Boolean(caps?.torch));
        }

        const videoEl = videoRef.current;
        if (videoEl) {
          videoEl.srcObject = stream;
          await videoEl.play().catch(() => {});
        }

        const detector = await createDetectorInstance();
        detectorRef.current = detector;
        setHasNativeDetector(Boolean(detector));

        if (detector) {
          setLiveHint(
            activeTarget === 'both'
              ? 'ส่องกล้องไปที่บาร์โค้ดหรือสติ๊กเกอร์ ระบบจะจับให้อัตโนมัติ'
              : activeTarget === 'engine'
              ? 'เล็งเส้นสแกนไปที่บาร์โค้ด "เลขเครื่อง"'
              : 'เล็งเส้นสแกนไปที่บาร์โค้ด "เลขถัง / VIN"'
          );

          let busy = false;
          scanIntervalRef.current = window.setInterval(async () => {
            if (busy || !videoRef.current || !detectorRef.current) return;
            const v = videoRef.current;
            if (v.readyState < 2 || !v.videoWidth || !v.videoHeight) return;

            busy = true;
            try {
              const found = await detectorRef.current.detect(v);
              if (found && found.length > 0) {
                const snap = captureVideoFrameAsJpeg(v);
                const applied = applyDetectedBarcodesFromList(found, targetRef.current);
                if (applied) {
                  setPreviewUrl(snap.previewDataUrl);
                  playScanSuccessBeep();
                  triggerHaptic('success');
                  stopLiveCamera();
                  setStep('review');
                }
              }
            } catch {
              // Ignore per-frame detection hiccups
            } finally {
              busy = false;
            }
          }, 180);
        } else {
          setLiveHint(
            'อุปกรณ์นี้ใช้โหมดจับภาพ AI — เล็งให้ชัดแล้วกดปุ่ม "จับภาพอ่านบาร์โค้ด" ด้านล่าง'
          );
        }
      } catch (err) {
        stopLiveCamera();
        triggerHaptic('warning');
        const msg =
          err instanceof Error && err.name === 'NotAllowedError'
            ? 'ยังไม่ได้รับอนุญาตให้เข้าถึงกล้อง กรุณากดอนุญาตกล้อง หรือเลือก "ถ่ายภาพด้วยแอพกล้อง"'
            : 'ไม่สามารถเปิดกล้องสดได้ กรุณาใช้ปุ่ม "ถ่ายภาพด้วยแอพกล้อง / เลือกรูปจากคลัง" ด้านล่าง';
        setErrorMessage(msg);
        setStep('error');
      }
    },
    [applyDetectedBarcodesFromList, createDetectorInstance, stopLiveCamera]
  );

  const handleToggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()?.[0];
    if (!track || typeof track.applyConstraints !== 'function') return;
    const nextState = !torchEnabled;
    try {
      await track.applyConstraints({
        advanced: [{ torch: nextState } as MediaTrackConstraintSet],
      });
      setTorchEnabled(nextState);
      triggerHaptic('selection');
    } catch {
      // Torch toggle not supported at runtime
    }
  };

  const handleCaptureLiveFrameForAi = async () => {
    const v = videoRef.current;
    if (!v || v.readyState < 2) {
      triggerHaptic('warning');
      return;
    }
    triggerHaptic('medium');
    const snap = captureVideoFrameAsJpeg(v);
    stopLiveCamera();
    await sendImageToServerScan({
      ...snap,
      scanTarget: targetRef.current,
    });
  };

  const handleFileSelected = async (file?: File) => {
    if (!file) return;
    triggerHaptic('light');
    stopLiveCamera();
    setStep('scanning');
    setScanStageText('กำลังเตรียมและปรับความคมชัดภาพ...');
    setErrorMessage('');

    try {
      const compressed = await compressImageForBarcodeScan(file);

      // Try fast local BarcodeDetector on uploaded photo if targeting a single field (or multiple barcodes found)
      const detector = await createDetectorInstance();
      if (detector && typeof createImageBitmap === 'function') {
        try {
          const bmp = await createImageBitmap(file);
          const found = await detector.detect(bmp);
          bmp.close();
          const validCount = Array.from(
            new Set(found.map((f) => normalizeVehicleSerial(f.rawValue)).filter((s) => s.length >= 4))
          ).length;

          if (
            (targetRef.current !== 'both' && validCount >= 1) ||
            (targetRef.current === 'both' && validCount >= 2)
          ) {
            applyDetectedBarcodesFromList(found, targetRef.current);
            setPreviewUrl(compressed.previewDataUrl);
            playScanSuccessBeep();
            triggerHaptic('success');
            setStep('review');
            return;
          }
        } catch {
          // Fallback to AI scan
        }
      }

      await sendImageToServerScan({
        ...compressed,
        scanTarget: targetRef.current,
      });
    } catch (err) {
      triggerHaptic('warning');
      setErrorMessage(
        err instanceof Error && err.message
          ? err.message
          : 'ไม่สามารถอ่านไฟล์ภาพได้ กรุณาลองใหม่อีกครั้ง'
      );
      setStep('error');
    }
  };

  const handleSwapValues = () => {
    triggerHaptic('selection');
    const prevEngine = engineNumber;
    const prevChassis = chassisNumber;
    setEngineNumber(prevChassis);
    setChassisNumber(prevEngine);
  };

  const handleConfirmApply = () => {
    const cleanEngine = normalizeVehicleSerial(engineNumber);
    const cleanChassis = normalizeVehicleSerial(chassisNumber);
    if (!cleanEngine && !cleanChassis) {
      triggerHaptic('warning');
      setErrorMessage('กรุณาสแกนหรือพิมพ์เลขเครื่อง / เลขถัง อย่างน้อย 1 รายการ');
      return;
    }
    triggerHaptic('success');
    onApply({
      engineNumber: cleanEngine,
      chassisNumber: cleanChassis,
    });
    handleClose();
  };

  if (!shouldRender) return null;

  const targetTitle =
    target === 'engine'
      ? 'สแกน / กรอกเลขเครื่อง (Engine No.)'
      : target === 'chassis'
      ? 'สแกน / กรอกเลขถัง (Chassis No.)'
      : 'สแกนบาร์โค้ด / กรอกเลขเครื่อง & เลขถัง';

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/65 backdrop-blur-md ${backdropAnimClass}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className={`w-full max-w-lg rounded-3xl overflow-hidden bg-white dark:bg-slate-900 border border-white/80 dark:border-slate-700/80 shadow-2xl flex flex-col max-h-[92dvh] ${sheetAnimClass}`}
      >
        {/* Top Accent Strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-cyan-500 via-sky-500 to-teal-500 shrink-0" />

        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/95 flex items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-cyan-500 to-sky-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Barcode className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 truncate">
                {targetTitle}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {customerName
                  ? `เคสลูกค้า: ${customerName}`
                  : 'รองรับสแกนบาร์โค้ดกล้องสด ถ่ายภาพสติ๊กเกอร์ และพิมพ์แก้ไขเอง'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="ปิด"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target Switcher Bar */}
        <div className="px-4 py-2.5 bg-slate-50/70 dark:bg-slate-950/60 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-200/75 dark:bg-slate-800 text-[11px] font-bold">
            {(
              [
                { key: 'both' as const, label: 'สแกนทั้งคู่' },
                { key: 'engine' as const, label: 'เน้นเลขเครื่อง' },
                { key: 'chassis' as const, label: 'เน้นเลขถัง' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setTarget(opt.key);
                  targetRef.current = opt.key;
                }}
                className={`py-1.5 rounded-lg transition-all cursor-pointer truncate px-1 ${
                  target === opt.key
                    ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-300 shadow-xs font-extrabold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hidden file inputs */}
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
          {step === 'pick' && (
            <div className="space-y-3">
              {/* Option 1: Live Camera Scanner */}
              <button
                type="button"
                onClick={() => void startLiveCamera()}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-sky-600 via-cyan-600 to-teal-600 hover:opacity-95 text-white shadow-md shadow-sky-500/20 flex items-center gap-3.5 text-left active:scale-[0.98] transition-all cursor-pointer"
              >
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
                  <ScanLine className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-black text-sm sm:text-base flex items-center gap-1.5">
                    <span>เปิดกล้องสแกนบาร์โค้ดสด</span>
                    {hasNativeDetector && (
                      <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-full bg-white/25 text-white">
                        จับอัตโนมัติ
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-sky-50/90 mt-0.5">
                    ส่องไปที่สติ๊กเกอร์บาร์โค้ดข้างกล่องรถ เล่มทะเบียน หรือป้ายตัวถังรถ
                  </p>
                </div>
              </button>

              {/* Option 2 & 3: Photo Capture & Gallery */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="p-3.5 rounded-2xl bg-slate-50 hover:bg-sky-50 dark:bg-slate-800/80 dark:hover:bg-sky-950/50 border border-slate-200 dark:border-slate-700 flex flex-col items-center gap-2 text-center cursor-pointer active:scale-95 transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/70 text-sky-700 dark:text-sky-300 flex items-center justify-center">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                      ถ่ายภาพด้วยแอพกล้อง
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      ชัดสูง เหมาะกับเลขตอกเครื่อง
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="p-3.5 rounded-2xl bg-slate-50 hover:bg-indigo-50 dark:bg-slate-800/80 dark:hover:bg-indigo-950/50 border border-slate-200 dark:border-slate-700 flex flex-col items-center gap-2 text-center cursor-pointer active:scale-95 transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 flex items-center justify-center">
                    <ImagePlus className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                      เลือกรูปจากอัลบั้ม
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      อ่านทั้งบาร์โค้ดและตัวอักษร
                    </div>
                  </div>
                </button>
              </div>

              {/* Option 4: Direct Manual Entry */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setStep('review');
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Keyboard className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span>พิมพ์ / แก้ไขเลขเครื่องและเลขถังเอง</span>
              </button>

              {(engineNumber || chassisNumber) && (
                <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/35 border border-emerald-200/80 dark:border-emerald-800/60 text-xs space-y-1">
                  <div className="text-[10.5px] font-bold text-emerald-800 dark:text-emerald-300">
                    ค่าปัจจุบันในเคส:
                  </div>
                  <div className="font-mono text-[11px] text-slate-700 dark:text-slate-200 space-y-0.5">
                    <div>เลขเครื่อง: {engineNumber || '-'}</div>
                    <div>เลขถัง: {chassisNumber || '-'}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'live' && (
            <div className="space-y-3">
              {/* Camera Viewport */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-700 aspect-[4/3] shadow-inner">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className="w-full h-full object-cover"
                />

                {/* Scan Guide Frame Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                  <div className="w-full max-w-[300px] h-[135px] border-2 border-cyan-400/90 rounded-2xl shadow-[0_0_0_9999px_rgba(2,6,23,0.42)] relative overflow-hidden">
                    <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-rose-500 to-transparent shadow-[0_0_10px_rgba(244,63,94,0.9)] animate-pulse" />
                  </div>
                </div>

                {/* Torch button if supported */}
                {torchSupported && (
                  <button
                    type="button"
                    onClick={handleToggleTorch}
                    className={`absolute top-3 right-3 px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 backdrop-blur-md border cursor-pointer transition-all ${
                      torchEnabled
                        ? 'bg-amber-400 text-slate-950 border-amber-300'
                        : 'bg-slate-900/75 text-white border-white/25 hover:bg-slate-900/90'
                    }`}
                  >
                    <Flashlight className="w-3.5 h-3.5" />
                    <span>{torchEnabled ? 'ปิดไฟฉาย' : 'ไฟฉาย'}</span>
                  </button>
                )}
              </div>

              <div className="text-center text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                {liveHint}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    stopLiveCamera();
                    setStep('pick');
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer"
                >
                  ย้อนกลับ
                </button>
                <button
                  type="button"
                  onClick={handleCaptureLiveFrameForAi}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:opacity-95 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer active:scale-98"
                >
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>จับภาพอ่านบาร์โค้ด / ตัวอักษร (AI)</span>
                </button>
              </div>
            </div>
          )}

          {step === 'scanning' && (
            <div className="py-6 text-center space-y-3">
              {previewUrl && (
                <div className="max-h-44 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 mx-auto">
                  <img
                    src={previewUrl}
                    alt="ภาพที่กำลังสแกน"
                    className="w-full max-h-44 object-contain"
                  />
                </div>
              )}
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-7 h-7 text-sky-600 dark:text-sky-400 animate-spin" />
                <div className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                  {scanStageText}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  กำลังถอดรหัสบาร์โค้ดและตัวอักษรเลขเครื่อง / เลขถัง...
                </p>
              </div>
            </div>
          )}

          {step === 'error' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 flex items-start gap-2.5 text-rose-800 dark:text-rose-200 text-xs">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-extrabold">ไม่สามารถอ่านข้อมูลได้อัตโนมัติ</div>
                  <p className="leading-relaxed">{errorMessage}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>ถ่ายภาพใหม่</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep('review')}
                  className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Keyboard className="w-4 h-4" />
                  <span>พิมพ์กรอกเอง</span>
                </button>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-3.5">
              {previewUrl && (
                <div className="max-h-36 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-950/5 dark:bg-slate-950">
                  <img
                    src={previewUrl}
                    alt="ภาพบาร์โค้ดที่สแกน"
                    className="w-full max-h-36 object-contain"
                  />
                </div>
              )}

              {confidenceNote && (
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/45 border border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-200 text-[11px] font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{confidenceNote}</span>
                </div>
              )}

              {errorMessage && (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 text-amber-800 dark:text-amber-200 text-[11px] font-bold">
                  {errorMessage}
                </div>
              )}

              {/* Engine Number Field */}
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
                    เลขเครื่องยนต์ (Engine No.)
                  </label>
                  <button
                    type="button"
                    onClick={() => void startLiveCamera('engine')}
                    className="text-[10.5px] font-bold text-sky-700 dark:text-sky-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ScanLine className="w-3 h-3" />
                    <span>สแกนช่องนี้</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={engineNumber}
                    onChange={(e) => setEngineNumber(normalizeVehicleSerial(e.target.value))}
                    placeholder="เช่น JA14E-0123456"
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 focus:border-sky-500 pl-3 pr-8 py-2.5 font-mono font-black text-sm uppercase tracking-wide text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 outline-none"
                  />
                  {engineNumber && (
                    <button
                      type="button"
                      onClick={() => setEngineNumber('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer p-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Swap Button */}
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleSwapValues}
                  className="px-3 py-1 rounded-full bg-slate-100 hover:bg-sky-50 dark:bg-slate-800 dark:hover:bg-sky-950/60 border border-slate-200 dark:border-slate-700 text-[10.5px] font-bold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <ArrowUpDown className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                  <span>สลับเลขเครื่อง ⇅ เลขถัง</span>
                </button>
              </div>

              {/* Chassis Number Field */}
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
                    เลขตัวถัง / เลขถัง (Chassis No. / VIN)
                  </label>
                  <button
                    type="button"
                    onClick={() => void startLiveCamera('chassis')}
                    className="text-[10.5px] font-bold text-teal-700 dark:text-teal-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ScanLine className="w-3 h-3" />
                    <span>สแกนช่องนี้</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={chassisNumber}
                    onChange={(e) => setChassisNumber(normalizeVehicleSerial(e.target.value))}
                    placeholder="เช่น MLHJA1400P5012345"
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 focus:border-teal-500 pl-3 pr-8 py-2.5 font-mono font-black text-sm uppercase tracking-wide text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 outline-none"
                  />
                  {chassisNumber && (
                    <button
                      type="button"
                      onClick={() => setChassisNumber('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer p-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('pick')}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>สแกนใหม่</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmApply}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white font-extrabold text-xs shadow-sm cursor-pointer active:scale-98 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>บันทึกเลขเครื่อง / เลขถังเข้าเคส</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
