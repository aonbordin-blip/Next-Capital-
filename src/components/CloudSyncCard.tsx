import React, { useRef, useState } from 'react';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  LogOut,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  UploadCloud,
  FolderOpen,
} from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import { GoogleSignInButton } from './GoogleSignInButton';
import { triggerHaptic } from '../utils/haptics';

interface CloudSyncCardProps {
  compact?: boolean;
  localCount?: number;
  onOpenSavedCases?: () => void;
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
  onOpenSavedCases,
}) => {
  const {
    user,
    authReady,
    isSigningIn,
    syncStatus,
    lastSyncedAt,
    syncError,
    cloudCaseCount,
    signInWithGoogle,
    signOut,
    syncNow,
    uploadBackupJsonToCloud,
  } = useFirebase();

  const [isRefreshingCache, setIsRefreshingCache] = useState(false);
  const [isUploadingBackup, setIsUploadingBackup] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [backupUploadFeedback, setBackupUploadFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSignIn = async () => {
    triggerHaptic('medium');
    await signInWithGoogle();
  };

  const handleSyncNow = async () => {
    triggerHaptic('light');
    setBackupUploadFeedback(null);
    await syncNow();
  };

  const handleSignOut = async () => {
    triggerHaptic('light');
    setBackupUploadFeedback(null);
    await signOut();
  };

  const handleBackupFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    triggerHaptic('medium');
    setIsUploadingBackup(true);
    setUploadProgress(null);
    setBackupUploadFeedback(null);

    try {
      const content = await file.text();
      if (!content || !content.trim()) {
        setBackupUploadFeedback({
          type: 'error',
          message: 'ไฟล์ที่เลือกไม่มีข้อมูล กรุณาเลือกไฟล์สำรอง .json ที่ถูกต้อง',
        });
        return;
      }

      const result = await uploadBackupJsonToCloud(content, (done, total) => {
        setUploadProgress({ done, total });
      });

      if (!result.success && result.uploadedCount === 0) {
        triggerHaptic('warning');
        setBackupUploadFeedback({
          type: 'error',
          message: result.error || 'อัปโหลดไฟล์สำรองไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
        });
      } else if (result.failedCount > 0) {
        triggerHaptic('warning');
        setBackupUploadFeedback({
          type: 'warning',
          message: `อัปโหลดสำเร็จ ${result.uploadedCount}/${result.totalParsed} เคส (ติดปัญหา ${result.failedCount} เคส: ${result.error || 'ตรวจสอบสิทธิ์การเชื่อมต่อ'}) • แสดงในแอปแล้ว ${result.appTotalCount} เคส`,
        });
      } else {
        triggerHaptic('success');
        setBackupUploadFeedback({
          type: 'success',
          message: `อัปโหลดไฟล์สำรองขึ้น Cloud สำเร็จครบทั้ง ${result.uploadedCount} เคส และนำข้อมูลมาแสดงในแอปแล้ว (ทั้งหมด ${result.appTotalCount} เคส)`,
        });
      }
    } catch {
      triggerHaptic('warning');
      setBackupUploadFeedback({
        type: 'error',
        message: 'ไม่สามารถอ่านไฟล์สำรองได้ กรุณาตรวจสอบว่าเป็นไฟล์ .json ที่ส่งออกจากแอป',
      });
    } finally {
      setIsUploadingBackup(false);
      setUploadProgress(null);
    }
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
    } catch {
      // ignore cleanup errors and reload anyway
    }
    window.location.reload();
  };

  if (!authReady) {
    return (
      <div
        className={`rounded-2xl border border-sky-200/80 bg-white/75 backdrop-blur-md ${
          compact ? 'px-3 py-2' : 'p-3.5'
        } flex items-center gap-2 text-xs text-slate-500`}
      >
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600 shrink-0" />
        <span>กำลังตรวจสอบสถานะบัญชี Cloud...</span>
      </div>
    );
  }

  // Signed-out view
  if (!user) {
    if (compact) {
      return (
        <div className="rounded-2xl bg-gradient-to-r from-sky-50 via-indigo-50/70 to-cyan-50/80 border border-sky-200/90 px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Cloud className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11.5px] font-extrabold text-sky-950 truncate">
                ซิงค์เคสขึ้น Cloud อัตโนมัติ
              </div>
              <div className="text-[10px] text-slate-600 truncate">
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
      );
    }

    return (
      <div className="rounded-2xl bg-gradient-to-br from-white/95 via-sky-50/85 to-indigo-50/70 border border-sky-200/90 p-3.5 sm:p-4 shadow-sm space-y-2.5">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Cloud className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
                ซิงค์ฐานข้อมูล Cloud อัตโนมัติ
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 inline-flex items-center gap-1">
                <CloudOff className="w-3 h-3" />
                <span>ยังไม่เชื่อมต่อ</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">
              บันทึกเคสลูกค้า สถานะอนุมัติ/รับรถ แผนที่ และตารางค่างวดขึ้น Cloud ทันทีแบบเรียลไทม์ พร้อมอัปโหลดไฟล์สำรอง (.json) ขึ้น Cloud เพื่อแสดงผลครบทุกเครื่องด้วยบัญชี Google เดียวกัน
            </p>
          </div>
        </div>

        {syncError && (
          <div className="px-2.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
            <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{syncError}</span>
          </div>
        )}

        <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 pt-0.5">
          <span className="text-[10.5px] font-semibold text-sky-900/80">
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
  const isSyncing = syncStatus === 'syncing' || isUploadingBackup;
  const isError = syncStatus === 'error' && !isUploadingBackup;
  const syncedClock = formatThaiClock(lastSyncedAt);
  const errorMessage =
    syncError || 'ไม่สามารถเชื่อมต่อฐานข้อมูล Cloud ได้ชั่วคราว กรุณาลองกด "ซิงค์ตอนนี้"';

  if (compact) {
    return (
      <div className="rounded-2xl bg-gradient-to-r from-emerald-50/90 via-white to-sky-50/80 border border-emerald-200/90 px-3 py-2 space-y-1.5 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={displayName}
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-full border border-emerald-300 object-cover shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                {avatarInitial}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[11.5px] font-extrabold text-slate-900 truncate">
                  {displayName}
                </span>
                {isSyncing ? (
                  <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200 inline-flex items-center gap-1 shrink-0">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    <span>
                      {uploadProgress
                        ? `${uploadProgress.done}/${uploadProgress.total}`
                        : 'กำลังซิงค์'}
                    </span>
                  </span>
                ) : isError ? (
                  <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 inline-flex items-center gap-1 shrink-0">
                    <AlertCircle className="w-2.5 h-2.5" />
                    <span>รอซิงค์ใหม่</span>
                  </span>
                ) : (
                  <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    <span>ซิงค์ Cloud ✓</span>
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                {user.email}
                {` • บน Cloud ${cloudCaseCount} เคส`}
                {typeof localCount === 'number' && localCount > cloudCaseCount && !isSyncing
                  ? ` (ในเครื่อง ${localCount})`
                  : ''}
                {syncedClock ? ` • ล่าสุด ${syncedClock}` : ''}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <label
              className={`px-2 py-1 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-[10.5px] font-bold inline-flex items-center gap-1 cursor-pointer active:scale-95 transition-all ${
                isSyncing ? 'opacity-60 pointer-events-none' : ''
              }`}
              title="อัปโหลดไฟล์สำรอง (.json) ขึ้น Cloud โดยตรง"
            >
              <UploadCloud className="w-3 h-3 text-teal-700" />
              <span className="hidden sm:inline">อัป .json</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleBackupFileSelected}
                disabled={isSyncing}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={handleSyncNow}
              disabled={isSyncing}
              className="px-2 py-1 rounded-xl bg-white hover:bg-sky-50 text-sky-800 border border-sky-200 text-[10.5px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-60 active:scale-95 transition-all"
              title="ซิงค์ข้อมูลขึ้น Cloud ทันที"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden xs:inline">ซิงค์</span>
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="p-1.5 rounded-xl bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 cursor-pointer active:scale-95 transition-all"
              title="ออกจากระบบ Google"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {backupUploadFeedback && (
          <div
            className={`px-2 py-1 rounded-lg text-[10px] flex items-start gap-1.5 border ${
              backupUploadFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : backupUploadFeedback.type === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {backupUploadFeedback.type === 'success' ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
            )}
            <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{backupUploadFeedback.message}</span>
          </div>
        )}

        {isError && (
          <div className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[10px] flex items-start gap-1.5">
            <AlertCircle className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
            <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{errorMessage}</span>
          </div>
        )}
      </div>
    );
  }

  const progressPercent =
    uploadProgress && uploadProgress.total > 0
      ? Math.min(100, Math.round((uploadProgress.done / uploadProgress.total) * 100))
      : 0;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-emerald-50/90 via-white to-sky-50/85 border border-emerald-200/90 p-3.5 sm:p-4 shadow-sm space-y-2.5">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={displayName}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-full border-2 border-emerald-300 object-cover shrink-0 shadow-2xs"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-extrabold text-sm flex items-center justify-center shrink-0 shadow-2xs">
              {avatarInitial}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
              {displayName}
            </div>
            <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
          </div>
        </div>

        {isSyncing ? (
          <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 border border-sky-200 inline-flex items-center gap-1 shrink-0">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>
              {uploadProgress
                ? `กำลังอัปโหลด ${uploadProgress.done}/${uploadProgress.total}`
                : 'กำลังซิงค์...'}
            </span>
          </span>
        ) : isError ? (
          <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 inline-flex items-center gap-1 shrink-0">
            <AlertCircle className="w-3 h-3" />
            <span>รอซิงค์ใหม่</span>
          </span>
        ) : (
          <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1 shrink-0">
            <CheckCircle2 className="w-3 h-3" />
            <span>ซิงค์ Cloud อัตโนมัติ ✓</span>
          </span>
        )}
      </div>

      {/* Upload JSON Backup Progress Bar */}
      {isUploadingBackup && (
        <div className="px-3 py-2 rounded-xl bg-sky-50 border border-sky-200 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-sky-900">
            <span className="inline-flex items-center gap-1.5">
              <UploadCloud className="w-3.5 h-3.5 text-sky-600 animate-pulse" />
              <span>กำลังอัปโหลดไฟล์สำรอง (.json) ขึ้น Cloud...</span>
            </span>
            {uploadProgress && (
              <span>
                {uploadProgress.done} / {uploadProgress.total} เคส ({progressPercent}%)
              </span>
            )}
          </div>
          <div className="w-full h-1.5 rounded-full bg-sky-200/80 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-teal-500 transition-all duration-200"
              style={{ width: `${Math.max(8, progressPercent)}%` }}
            />
          </div>
        </div>
      )}

      {/* Upload JSON Backup Feedback Banner */}
      {backupUploadFeedback && (
        <div
          className={`px-3 py-2.5 rounded-xl text-[11px] flex flex-col gap-2 border ${
            backupUploadFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : backupUploadFeedback.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : 'bg-rose-50 border-rose-200 text-rose-950'
          }`}
        >
          <div className="flex items-start gap-1.5 min-w-0">
            {backupUploadFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  backupUploadFeedback.type === 'warning' ? 'text-amber-600' : 'text-rose-600'
                }`}
              />
            )}
            <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere] font-medium leading-relaxed">
              {backupUploadFeedback.message}
            </span>
          </div>
          {onOpenSavedCases && backupUploadFeedback.type !== 'error' && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  onOpenSavedCases();
                }}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10.5px] font-extrabold inline-flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs active:scale-95 transition-all"
              >
                <FolderOpen className="w-3 h-3" />
                <span>ดูเคสในแอป</span>
              </button>
            </div>
          )}
        </div>
      )}

      {isError && (
        <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] space-y-1.5">
          <div className="flex items-start gap-1.5 min-w-0">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere] leading-relaxed">{errorMessage}</span>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleClearAppCacheReload}
              disabled={isRefreshingCache}
              className="px-2 py-0.5 rounded-lg bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCw className={`w-2.5 h-2.5 ${isRefreshingCache ? 'animate-spin' : ''}`} />
              <span>ล้างแคชแอปและโหลดใหม่ (ข้อมูลเคสไม่หาย)</span>
            </button>
          </div>
        </div>
      )}

      {/* Direct Backup JSON -> Cloud Action Box */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-teal-50/90 via-sky-50/70 to-indigo-50/60 border border-teal-200/80">
        <div className="min-w-0">
          <div className="text-[11.5px] font-extrabold text-teal-950">
            นำเข้าไฟล์สำรอง (.json) ขึ้น Cloud โดยตรง
          </div>
          <div className="text-[10.5px] text-slate-600 leading-snug">
            เลือกไฟล์ .json ที่สำรองไว้ในเครื่องเพื่ออัปโหลดขึ้น Cloud ทั้งหมดและแสดงในแอปทันที
          </div>
        </div>
        <label
          className={`px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-sky-600 hover:opacity-95 text-white font-extrabold text-[11px] inline-flex items-center justify-center gap-1.5 shadow-xs shadow-teal-600/20 cursor-pointer shrink-0 active:scale-95 transition-all ${
            isSyncing ? 'opacity-60 pointer-events-none' : ''
          }`}
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>อัปโหลดไฟล์สำรอง (.json) ขึ้น Cloud</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleBackupFileSelected}
            disabled={isSyncing}
            className="hidden"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-emerald-100/90 text-[11px]">
        <div className="text-slate-600 font-medium">
          ข้อมูลบน Cloud: <strong className="text-slate-900">{cloudCaseCount} เคส</strong>
          {typeof localCount === 'number' && localCount > cloudCaseCount && !isSyncing && (
            <span className="text-amber-700 font-bold"> • รอซิงค์ขึ้น Cloud {localCount - cloudCaseCount} เคส</span>
          )}
          {syncedClock && <span className="text-slate-400"> • อัปเดต {syncedClock}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleSyncNow}
            disabled={isSyncing}
            className="px-2.5 py-1 rounded-xl bg-white hover:bg-sky-50 text-sky-800 border border-sky-200 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-60 shadow-2xs active:scale-95 transition-all"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>ซิงค์ตอนนี้</span>
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="px-2.5 py-1 rounded-xl bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95 transition-all"
          >
            <LogOut className="w-3 h-3" />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </div>
    </div>
  );
};
