import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, X, Smartphone, Check, Share, ArrowUpRight, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { NextCapitalLogo } from './NextCapitalLogo';
import { useModalTransition } from '../hooks/useModalTransition';
import { MarqueeText } from './MarqueeText';

export const InstallAppBanner: React.FC = () => {
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const {
    shouldRender: shouldRenderGuide,
    isClosing: isClosingGuide,
    backdropAnimClass: guideBackdropAnimClass,
    sheetAnimClass: guideSheetAnimClass,
  } = useModalTransition(showGuideModal, () => setShowGuideModal(false));

  // If already running as installed standalone PWA, hide banner
  if (isInstalled || isDismissed) {
    return null;
  }

  // Detect iOS Safari
  const isIOS =
    typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as any).MSStream;

  const handleInstallClick = async () => {
    if (isInstallable) {
      const installed = await promptInstall();
      if (!installed) {
        setShowGuideModal(true);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      {/* Sleek Floating Glassmorphic Install Bar */}
      <div className="no-print mx-4 mb-2 p-2.5 rounded-2xl bg-gradient-to-r from-blue-700/90 via-indigo-700/90 to-blue-800/90 text-white backdrop-blur-xl border border-white/30 shadow-lg shadow-blue-900/20 flex items-center justify-between gap-3 animate-fade-in z-20">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-xs flex-shrink-0 overflow-hidden">
              <NextCapitalLogo size={22} className="flex items-center justify-center" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <MarqueeText fitContent className="font-bold text-xs">
                  ติดตั้งแอป Next Capital
                </MarqueeText>
                <span className="text-[9px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider shrink-0">
                  PWA
                </span>
              </div>
              <MarqueeText className="text-[10px] text-blue-100">
                เปิดใช้งานได้ทันทีจากหน้าจอโฮม ไม่ต้องผ่านสโตร์
              </MarqueeText>
            </div>
          </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={handleInstallClick}
            className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-900 font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <Download className="w-3.5 h-3.5 text-blue-700" />
            <span>ติดตั้ง</span>
          </button>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-1 text-blue-200 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="ซ่อน"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Guide Modal for Manual Install (Android / iOS) */}
      {shouldRenderGuide &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            data-modal-portal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isClosingGuide) {
                setShowGuideModal(false);
              }
            }}
            className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-slate-950/65 overflow-y-auto overscroll-contain ${guideBackdropAnimClass}`}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain my-auto p-5 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-100 ${guideSheetAnimClass}`}
            >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-blue-700 dark:text-sky-400" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  วิธีติดตั้งแอปบนมือถือ
                </h3>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  สำหรับ iPhone / iPad (Safari):
                </p>
                <div className="flex items-start gap-2.5 bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/70">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-sky-950/80 text-blue-700 dark:text-sky-300 flex items-center justify-center font-bold flex-shrink-0">
                    1
                  </div>
                  <span>กดปุ่ม <strong>แชร์ (Share)</strong> <Share className="w-3.5 h-3.5 inline text-blue-600 dark:text-sky-400" /> ที่แถบด้านล่างของ Safari</span>
                </div>
                <div className="flex items-start gap-2.5 bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/70">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-sky-950/80 text-blue-700 dark:text-sky-300 flex items-center justify-center font-bold flex-shrink-0">
                    2
                  </div>
                  <span>เลื่อนลงแล้วเลือก <strong>"เพิ่มไปยังหน้าจอโฮม" (Add to Home Screen)</strong> <PlusSquare className="w-3.5 h-3.5 inline text-blue-600 dark:text-sky-400" /></span>
                </div>
                <div className="flex items-start gap-2.5 bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/70">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-sky-950/80 text-blue-700 dark:text-sky-300 flex items-center justify-center font-bold flex-shrink-0">
                    3
                  </div>
                  <span>กด <strong>"เพิ่ม" (Add)</strong> ที่มุมขวาบน จะมีไอคอน Next Capital ปรากฏบนหน้าจอมือถือทันที</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  สำหรับ Android (Chrome):
                </p>
                <div className="flex items-start gap-2.5 bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/70">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-sky-950/80 text-blue-700 dark:text-sky-300 flex items-center justify-center font-bold flex-shrink-0">
                    1
                  </div>
                  <span>กดปุ่มเมนู <strong>จุดสามจุด (⋮)</strong> ที่มุมขวาบนของ Chrome</span>
                </div>
                <div className="flex items-start gap-2.5 bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/70">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-sky-950/80 text-blue-700 dark:text-sky-300 flex items-center justify-center font-bold flex-shrink-0">
                    2
                  </div>
                  <span>เลือก <strong>"ติดตั้งแอป" (Install app)</strong> หรือ <strong>"เพิ่มลงในหน้าจอหลัก"</strong></span>
                </div>
                <div className="flex items-start gap-2.5 bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/70">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-sky-950/80 text-blue-700 dark:text-sky-300 flex items-center justify-center font-bold flex-shrink-0">
                    3
                  </div>
                  <span>กด <strong>"ติดตั้ง" (Install)</strong> แอปจะติดตั้งลงบนเครื่องเหมือนแอปทั่วไป</span>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              เข้าใจแล้ว
            </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
