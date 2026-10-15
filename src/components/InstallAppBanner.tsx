import React, { useState } from 'react';
import { Download, X, Smartphone, Check, Share, ArrowUpRight, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { NextCapitalLogo } from './NextCapitalLogo';

export const InstallAppBanner: React.FC = () => {
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

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
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white p-1 flex items-center justify-center shadow-xs flex-shrink-0">
            <NextCapitalLogo size={22} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs truncate">ติดตั้งแอป Next Capital</span>
              <span className="text-[9px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                PWA
              </span>
            </div>
            <p className="text-[10px] text-blue-100 truncate">
              เปิดใช้งานได้ทันทีจากหน้าจอโฮม ไม่ต้องผ่านสโตร์
            </p>
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
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 space-y-4 shadow-2xl border border-slate-200 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-blue-700" />
                <h3 className="font-bold text-sm text-slate-900">
                  วิธีติดตั้งแอปบนมือถือ
                </h3>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-800">
                  สำหรับ iPhone / iPad (Safari):
                </p>
                <div className="flex items-start gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold flex-shrink-0">
                    1
                  </div>
                  <span>กดปุ่ม <strong>แชร์ (Share)</strong> <Share className="w-3.5 h-3.5 inline text-blue-600" /> ที่แถบด้านล่างของ Safari</span>
                </div>
                <div className="flex items-start gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold flex-shrink-0">
                    2
                  </div>
                  <span>เลื่อนลงแล้วเลือก <strong>"เพิ่มไปยังหน้าจอโฮม" (Add to Home Screen)</strong> <PlusSquare className="w-3.5 h-3.5 inline text-blue-600" /></span>
                </div>
                <div className="flex items-start gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold flex-shrink-0">
                    3
                  </div>
                  <span>กด <strong>"เพิ่ม" (Add)</strong> ที่มุมขวาบน จะมีไอคอน Next Capital ปรากฏบนหน้าจอมือถือทันที</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-800">
                  สำหรับ Android (Chrome):
                </p>
                <div className="flex items-start gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold flex-shrink-0">
                    1
                  </div>
                  <span>กดปุ่มเมนู <strong>จุดสามจุด (⋮)</strong> ที่มุมขวาบนของ Chrome</span>
                </div>
                <div className="flex items-start gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold flex-shrink-0">
                    2
                  </div>
                  <span>เลือก <strong>"ติดตั้งแอป" (Install app)</strong> หรือ <strong>"เพิ่มลงในหน้าจอหลัก"</strong></span>
                </div>
                <div className="flex items-start gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold flex-shrink-0">
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
        </div>
      )}
    </>
  );
};
