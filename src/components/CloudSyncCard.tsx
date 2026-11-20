import React, { useState } from 'react';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  LogOut,
  CheckCircle2,
  AlertCircle,
  RotateCw,
} from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import { GoogleSignInButton } from './GoogleSignInButton';
import { triggerHaptic } from '../utils/haptics';

interface CloudSyncCardProps {
  compact?: boolean;
  localCount?: number;
}

function formatThaiClock(ts: number | null): string {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm} น.`;
  } catch {
    return '';
  }
}

export const CloudSyncCard: React.FC<CloudSyncCardProps> = ({
  compact = false,
  localCount,
}) => {
  const {
    user,
    authReady,
    isSigningIn,
    syncStatus,
    lastSyncedAt,
    syncError,
    syncNotice,
    approvalDocSkippedCount,
    cloudCaseCount,
    signInWithGoogle,
    signOut,
    syncNow,
  } = useFirebase();

  const [isRefreshingCache, setIsRefreshingCache] = useState(false);

  const handleSignIn = async () => {
    triggerHaptic('medium');
    await signInWithGoogle();
  };

  const handleSyncNow = async () => {
    triggerHaptic('light');
    await syncNow();
  };

  const handleSignOut = async () => {
    triggerHaptic('light');
    await signOut();
  };

  const handleClearAppCacheReload = async () => {
    triggerHaptic('medium');
    setIsRefreshingCache(true);
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      // Allow re-check of any legacy rescue on next sync after clearing cache
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith('ncap_rtdb_rescued_v1_')) {
          localStorage.removeItem(k);
        }
      }
    } catch {
      // ignore cleanup errors and reload anyway
    }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('_refresh', String(Date.now()));
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  };

  if (!authReady) {
    return (
      <div
        className={`rounded-2xl border border-sky-200/80 dark:border-sky-800/60 bg-white/75 dark:bg-slate-900/75 backdrop-blur-md ${
          compact ? 'px-3 py-2' : 'p-3.5'
        } flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300`}
      >
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600 dark:text-sky-400 shrink-0" />
        <span>กำลังตรวจสอบสถานะบัญชี Cloud...</span>
      </div>
    );
  }

  // Signed-out view
  if (!user) {
    if (compact) {
      return (
        <div className="rounded-2xl bg-gradient-to-r from-sky-50 via-indigo-50/70 to-cyan-50/80 dark:from-sky-950/75 dark:via-indigo-950/65 dark:to-slate-900/90 border border-sky-200/90 dark:border-sky-800/70 px-3 py-2 space-y-1.5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Cloud className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11.5px] font-extrabold text-sky-950 dark:text-sky-100 truncate">
                  ซิงค์เคสขึ้น Cloud อัตโนมัติ
                </div>
                <div className="text-[10px] text-slate-600 dark:text-slate-300 truncate">
                  {typeof localCount === 'number' && localCount > 0
                    ? `มี ${localCount} เคสในเครื่อง พร้อมสำรองข้ามอุปกรณ์ทันทีที่ล็อกอิน`
                    : 'เข้าสู่ระบบด้วย Google เพื่อสำรองและเปิดใช้งานข้อมูลข้ามเครื่อง'}
                </div>
              </div>
            </div>
            <div className="shrink-0 self-end sm:self-auto">
              <GoogleSignInButton
                compact
                onClick={handleSignIn}
                isLoading={isSigningIn}
                label="เข้าสู่ระบบด้วย Google"
              />
            </div>
          </div>
          {syncError && (
            <div className="px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-200 text-[10px] flex items-start gap-1.5">
              <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{syncError}</span>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="rounded-2xl bg-gradient-to-br from-white/95 via-sky-50/85 to-indigo-50/70 dark:from-slate-900/90 dark:via-sky-950/70 dark:to-indigo-950/65 border border-sky-200/90 dark:border-sky-800/70 p-3.5 sm:p-4 shadow-sm space-y-2.5">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Cloud className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100">
                ซิงค์ฐานข้อมูล Cloud อัตโนมัติ
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1">
                <CloudOff className="w-3 h-3" />
                <span>ยังไม่เชื่อมต่อ</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed mt-0.5">
              บันทึกเคสลูกค้า สถานะอนุมัติ/รับรถ แผนที่ และตารางค่างวดขึ้น Cloud ทันทีแบบเรียลไทม์ เพื่อแสดงผลครบทุกเครื่องด้วยบัญชี Google เดียวกัน
            </p>
          </div>
        </div>

        {syncError && (
          <div className="px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-200 text-[11px] flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{syncError}</span>
          </div>
        )}

        <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 pt-0.5">
          <span className="text-[10.5px] font-semibold text-sky-900/80 dark:text-sky-200">
            {typeof localCount === 'number' && localCount > 0
              ? `พบข้อมูลในเครื่อง ${localCount} เคส (ซิงค์อัตโนมัติหลังเข้าสู่ระบบ)`
              : 'ข้อมูลปลอดภัย แยกจัดเก็บส่วนตัวตามบัญชีของคุณ'}
          </span>
          <GoogleSignInButton
            onClick={handleSignIn}
            isLoading={isSigningIn}
            label="เข้าสู่ระบบด้วย Google"
          />
        </div>
      </div>
    );
  }

  // Signed-in view
  const displayName = user.displayName || user.email || 'ผู้ใช้งาน Google';
  const avatarInitial = displayName.slice(0, 1).toUpperCase();
  const isSyncing = syncStatus === 'syncing';
  const isError = syncStatus === 'error';
  const syncedClock = formatThaiClock(lastSyncedAt);
  const errorMessage =
    syncError || 'ไม่สามารถเชื่อมต่อฐานข้อมูล Cloud ได้ชั่วคราว กรุณาลองกด "ซิงค์ตอนนี้"';

  if (compact) {
    return (
      <div className="rounded-2xl bg-gradient-to-r from-emerald-50/90 via-white to-sky-50/80 dark:from-emerald-950/60 dark:via-slate-900/90 dark:to-sky-950/65 border border-emerald-200/90 dark:border-emerald-800/70 px-3 py-2 space-y-1.5 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={displayName}
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-full border border-emerald-300 dark:border-emerald-700 object-cover shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                {avatarInitial}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[11.5px] font-extrabold text-slate-900 dark:text-slate-100 truncate">
                  {displayName}
                </span>
                {isSyncing ? (
                  <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-200 border border-sky-200 dark:border-sky-700/70 inline-flex items-center gap-1 shrink-0">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    <span>กำลังซิงค์</span>
                  </span>
                ) : isError ? (
                  <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-700/70 inline-flex items-center gap-1 shrink-0">
                    <AlertCircle className="w-2.5 h-2.5" />
                    <span>รอซิงค์ใหม่</span>
                  </span>
                ) : (
                  <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-700/70 inline-flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    <span>ซิงค์ Cloud ✓</span>
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {user.email}
                {` • Realtime DB ${cloudCaseCount} เคส`}
                {typeof localCount === 'number' && localCount > cloudCaseCount && !isSyncing
                  ? ` (ในเครื่อง ${localCount})`
                  : ''}
                {syncedClock ? ` • ล่าสุด ${syncedClock}` : ''}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleSyncNow}
              disabled={isSyncing}
              className="px-2 py-1 rounded-xl bg-white hover:bg-sky-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-sky-800 dark:text-sky-200 border border-sky-200 dark:border-sky-700/70 text-[10.5px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-60 active:scale-95 transition-all"
              title="ซิงค์ข้อมูลขึ้น Cloud ทันที"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden xs:inline">ซิงค์</span>
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="p-1.5 rounded-xl bg-white hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/60 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 cursor-pointer active:scale-95 transition-all"
              title="ออกจากระบบ Google"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {syncNotice && !isError && (
          <div className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 text-emerald-900 dark:text-emerald-200 text-[10px] flex items-start gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{syncNotice}</span>
          </div>
        )}

        {!isError && !syncNotice && approvalDocSkippedCount > 0 && (
          <div className="px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/70 text-amber-900 dark:text-amber-200 text-[10px] flex items-start gap-1.5">
            <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
              ซิงค์ข้อมูลเคสทั้งหมดขึ้น Cloud แล้ว ({approvalDocSkippedCount} เคสเก็บชื่อไฟล์แนบไว้ในเครื่องชั่วคราว)
            </span>
          </div>
        )}

        {isError && (
          <div className="px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/70 text-amber-900 dark:text-amber-200 text-[10px] flex items-start gap-1.5">
            <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{errorMessage}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-emerald-50/90 via-white to-sky-50/85 dark:from-emerald-950/60 dark:via-slate-900/90 dark:to-sky-950/65 border border-emerald-200/90 dark:border-emerald-800/70 p-3.5 sm:p-4 shadow-sm space-y-2.5">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={displayName}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-full border-2 border-emerald-300 dark:border-emerald-700 object-cover shrink-0 shadow-2xs"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-extrabold text-sm flex items-center justify-center shrink-0 shadow-2xs">
              {avatarInitial}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">
              {displayName}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.email}</div>
          </div>
        </div>

        {isSyncing ? (
          <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-200 border border-sky-200 dark:border-sky-700/70 inline-flex items-center gap-1 shrink-0">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>กำลังซิงค์...</span>
          </span>
        ) : isError ? (
          <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-700/70 inline-flex items-center gap-1 shrink-0">
            <AlertCircle className="w-3 h-3" />
            <span>รอซิงค์ใหม่</span>
          </span>
        ) : (
          <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-700/70 inline-flex items-center gap-1 shrink-0">
            <CheckCircle2 className="w-3 h-3" />
            <span>ซิงค์ Cloud อัตโนมัติ ✓</span>
          </span>
        )}
      </div>

      {syncNotice && !isError && (
        <div className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 text-emerald-900 dark:text-emerald-200 text-[11px] flex items-start gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere] leading-relaxed">{syncNotice}</span>
        </div>
      )}

      {!isError && !syncNotice && approvalDocSkippedCount > 0 && (
        <div className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/70 text-amber-900 dark:text-amber-200 text-[11px] flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere] leading-relaxed">
            ซิงค์ข้อมูลเคสทั้งหมดขึ้น Cloud แล้ว ({approvalDocSkippedCount} เคสเก็บชื่อไฟล์แนบไว้ในเครื่องชั่วคราวระหว่างรอกฎ Cloud อัปเดต)
          </span>
        </div>
      )}

      {isError && (
        <div className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/70 text-amber-900 dark:text-amber-200 text-[11px] space-y-1.5">
          <div className="flex items-start gap-1.5 min-w-0">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere] leading-relaxed">{errorMessage}</span>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleClearAppCacheReload}
              disabled={isRefreshingCache}
              className="px-2 py-0.5 rounded-lg bg-white hover:bg-amber-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/70 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCw className={`w-2.5 h-2.5 ${isRefreshingCache ? 'animate-spin' : ''}`} />
              <span>ล้างแคชแอปและโหลดใหม่ (ข้อมูลเคสไม่หาย)</span>
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-emerald-100/90 dark:border-emerald-900/60 text-[11px]">
        <div className="text-slate-600 dark:text-slate-300 font-medium">
          ข้อมูลบน Realtime DB: <strong className="text-slate-900 dark:text-slate-100">{cloudCaseCount} เคส</strong>
          {typeof localCount === 'number' && localCount > cloudCaseCount && !isSyncing && (
            <span className="text-amber-700 dark:text-amber-400 font-bold"> • รอซิงค์ขึ้น Cloud {localCount - cloudCaseCount} เคส</span>
          )}
          {syncedClock && <span className="text-slate-400"> • อัปเดต {syncedClock}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleSyncNow}
            disabled={isSyncing}
            className="px-2.5 py-1 rounded-xl bg-white hover:bg-sky-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-sky-800 dark:text-sky-200 border border-sky-200 dark:border-sky-700/70 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-60 shadow-2xs active:scale-95 transition-all"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>ซิงค์ตอนนี้</span>
          </button>
          <button
            type="button"
            onClick={handleClearAppCacheReload}
            disabled={isRefreshingCache}
            className="px-2.5 py-1 rounded-xl bg-white hover:bg-amber-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-700/70 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-60 shadow-2xs active:scale-95 transition-all"
            title="ล้างแคชแอปและโหลดเวอร์ชันล่าสุด (ข้อมูลเคสในเครื่องไม่หาย)"
          >
            <RotateCw className={`w-3 h-3 ${isRefreshingCache ? 'animate-spin' : ''}`} />
            <span>ล้างแคช</span>
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="px-2.5 py-1 rounded-xl bg-white hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/60 text-slate-600 dark:text-slate-300 hover:text-rose-700 dark:hover:text-rose-300 border border-slate-200 dark:border-slate-700 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95 transition-all"
          >
            <LogOut className="w-3 h-3" />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </div>
    </div>
  );
};
