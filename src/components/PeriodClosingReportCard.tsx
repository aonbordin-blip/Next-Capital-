import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  Calendar,
  RotateCcw,
  Check,
  Copy,
  Share2,
  Plus,
  Trash2,
  Pencil,
  Users,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
  X,
  ArrowUpRight,
} from 'lucide-react';
import { SavedCaseRecord } from '../types';
import { getSavedCases } from '../utils/savedCasesStorage';
import { triggerHaptic } from '../utils/haptics';
import { CardModalOverlay } from './CardModalOverlay';
import { MarqueeText } from './MarqueeText';

type HalfPeriodType = 'first_half' | 'second_half' | 'full_month';

interface Props {
  officerName: string;
  officerCode: string;
  officerDisplay: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpenSavedCases?: () => void;
  refreshTrigger?: number;
}

const THAI_MONTH_NAMES = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

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

function toInputDateStr(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getLastDayOfMonth(year: number, monthIndexZeroBased: number): number {
  return new Date(year, monthIndexZeroBased + 1, 0).getDate();
}

function getCleanCustomerName(record: SavedCaseRecord): string {
  const raw =
    record.customerName?.trim() ||
    record.caseTitle?.split(' - ')[0]?.trim() ||
    'ไม่ระบุชื่อลูกค้า';
  return raw.replace(/\s+/g, ' ').trim();
}

function formatPeriodShortLabel(ym: string, cycle: HalfPeriodType): string {
  const [yStr, mStr] = ym.split('-');
  const year = parseInt(yStr, 10);
  const monthIdx = parseInt(mStr, 10) - 1;
  const lastDay = getLastDayOfMonth(year, monthIdx);
  const monthShort = THAI_MONTH_SHORTS[monthIdx] || mStr;
  const thaiYear2Digit = String((year + 543) % 100).padStart(2, '0');

  if (cycle === 'first_half') {
    return `1-15 ${monthShort}${thaiYear2Digit}`;
  }
  if (cycle === 'second_half') {
    return `16-${lastDay} ${monthShort}${thaiYear2Digit}`;
  }
  return `1-${lastDay} ${monthShort}${thaiYear2Digit}`;
}

export const PeriodClosingReportCard: React.FC<Props> = ({
  officerName,
  officerCode,
  officerDisplay,
  isExpanded,
  onToggleExpand,
  onOpenSavedCases,
  refreshTrigger,
}) => {
  const [savedCases, setSavedCases] = useState<SavedCaseRecord[]>([]);
  const [copied, setCopied] = useState(false);

  // Selected month YYYY-MM
  const [selectedYM, setSelectedYM] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Cycle: 1-15 vs 16-สิ้นเดือน vs ทั้งเดือน (auto-select based on current day of month)
  const [periodCycle, setPeriodCycle] = useState<HalfPeriodType>(() => {
    const todayDate = new Date().getDate();
    return todayDate <= 15 ? 'first_half' : 'second_half';
  });

  // Toggle whether to include approved cases carried over from previous periods
  const [includeCarryOver, setIncludeCarryOver] = useState<boolean>(true);

  // Optional manual edit / override mode
  const [isManualMode, setIsManualMode] = useState<boolean>(false);
  const [manualApproveCount, setManualApproveCount] = useState<string>('0');
  const [manualDeliveredCount, setManualDeliveredCount] = useState<string>('0');
  const [manualPendingNames, setManualPendingNames] = useState<string[]>([]);
  const [newCustomerInput, setNewCustomerInput] = useState<string>('');
  const [showDeliveredList, setShowDeliveredList] = useState<boolean>(false);

  // Default officer tag e.g. "6683/บดินทร์"
  const defaultOfficerTag = useMemo(() => {
    const firstName = (officerName || '').trim().split(/\s+/)[0] || '';
    const cleanCode = (officerCode || '').trim();
    if (cleanCode && firstName) return `${cleanCode}/${firstName}`;
    if (firstName) return firstName;
    if (cleanCode) return cleanCode;
    return officerDisplay || 'เจ้าหน้าที่';
  }, [officerName, officerCode, officerDisplay]);

  const [officerTagOverride, setOfficerTagOverride] = useState<string>('');
  const activeOfficerTag = officerTagOverride.trim() || defaultOfficerTag;

  const reloadCases = () => {
    setSavedCases(getSavedCases());
  };

  useEffect(() => {
    reloadCases();
  }, [isExpanded, refreshTrigger]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'ncap_saved_cases_v1') {
        reloadCases();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Available months from saved cases + current month
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    const now = new Date();
    set.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

    savedCases.forEach((c) => {
      const appDate = c.approvalDate || toInputDateStr(c.createdAt);
      if (appDate && appDate.length >= 7) set.add(appDate.slice(0, 7));
      if (c.deliveryDate && c.deliveryDate.length >= 7) set.add(c.deliveryDate.slice(0, 7));
    });

    return Array.from(set).sort().reverse();
  }, [savedCases]);

  // Period start & end dates (YYYY-MM-DD)
  const { startDateStr, endDateStr, periodShortLabel } = useMemo(() => {
    const [yStr, mStr] = selectedYM.split('-');
    const year = parseInt(yStr, 10);
    const monthIdx = parseInt(mStr, 10) - 1;
    const lastDay = getLastDayOfMonth(year, monthIdx);

    const startDay = periodCycle === 'second_half' ? '16' : '01';
    const endDay =
      periodCycle === 'first_half' ? '15' : String(lastDay).padStart(2, '0');

    return {
      startDateStr: `${selectedYM}-${startDay}`,
      endDateStr: `${selectedYM}-${endDay}`,
      periodShortLabel: formatPeriodShortLabel(selectedYM, periodCycle),
    };
  }, [selectedYM, periodCycle]);

  // Auto-calculate Approve, Delivered, and Pending Delivery (ยกยอด) from SavedCases
  const autoStats = useMemo(() => {
    const deliveredCases: SavedCaseRecord[] = [];
    const pendingCases: SavedCaseRecord[] = [];

    savedCases.forEach((c) => {
      if (c.approvalStatus !== 'approved') return;

      const appDate = c.approvalDate || toInputDateStr(c.createdAt);
      const isDelivered = c.deliveryStatus === 'delivered';
      const delDate = isDelivered ? c.deliveryDate || appDate : null;

      // Must be approved on or before endDateStr
      if (appDate > endDateStr) return;

      if (includeCarryOver) {
        // Include if still pending OR delivered on/after startDateStr (was active during this period)
        if (isDelivered && delDate && delDate < startDateStr) {
          return;
        }
      } else {
        // Only approved strictly within [startDateStr, endDateStr]
        if (appDate < startDateStr || appDate > endDateStr) {
          return;
        }
      }

      if (isDelivered && delDate && delDate <= endDateStr) {
        deliveredCases.push(c);
      } else {
        pendingCases.push(c);
      }
    });

    // Sort pending cases chronologically (oldest approved first)
    pendingCases.sort((a, b) => {
      const da = a.approvalDate || toInputDateStr(a.createdAt);
      const db = b.approvalDate || toInputDateStr(b.createdAt);
      return da.localeCompare(db);
    });

    deliveredCases.sort((a, b) => {
      const da = a.deliveryDate || toInputDateStr(a.createdAt);
      const db = b.deliveryDate || toInputDateStr(b.createdAt);
      return da.localeCompare(db);
    });

    const approveCount = deliveredCases.length + pendingCases.length;

    return {
      approveCount,
      deliveredCount: deliveredCases.length,
      pendingCount: pendingCases.length,
      deliveredCases,
      pendingCases,
      pendingNames: pendingCases.map(getCleanCustomerName),
    };
  }, [savedCases, startDateStr, endDateStr, includeCarryOver]);

  // Sync manual state whenever autoStats or period changes and manual mode isn't locked
  const enterManualMode = () => {
    triggerHaptic('light');
    setManualApproveCount(String(autoStats.approveCount));
    setManualDeliveredCount(String(autoStats.deliveredCount));
    setManualPendingNames([...autoStats.pendingNames]);
    setIsManualMode(true);
  };

  const resetToAutoMode = () => {
    triggerHaptic('medium');
    reloadCases();
    setIsManualMode(false);
    setNewCustomerInput('');
  };

  // Effective values used in preview and LINE export
  const effectiveApproveCount = isManualMode
    ? Math.max(0, parseInt(manualApproveCount, 10) || 0)
    : autoStats.approveCount;

  const effectiveDeliveredCount = isManualMode
    ? Math.max(0, parseInt(manualDeliveredCount, 10) || 0)
    : autoStats.deliveredCount;

  const effectivePendingNames = isManualMode ? manualPendingNames : autoStats.pendingNames;
  const effectivePendingCount = isManualMode
    ? manualPendingNames.length
    : autoStats.pendingCount;

  // Build structured & readable LINE report string
  const reportText = useMemo(() => {
    const lines = [
      `📊 สรุปปิดยอด ${periodShortLabel}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👨‍💼 เจ้าหน้าที่ : ${activeOfficerTag}`,
      `──────────────`,
      `✅ Approve : ${effectiveApproveCount} เคส`,
      `🏍️ รับรถแล้ว : ${effectiveDeliveredCount} คัน`,
      `⏳ ยกยอด : ${effectivePendingCount} คัน`,
    ];

    if (effectivePendingNames.length > 0) {
      lines.push(
        `──────────────`,
        `📋 รายชื่อยกยอด (${effectivePendingNames.length} ราย) :`
      );
      effectivePendingNames.forEach((name, idx) => {
        lines.push(`  ${idx + 1}. ${name}`);
      });
    } else if (effectivePendingCount === 0) {
      lines.push(`──────────────`, `🎉 รับรถครบแล้ว ไม่มีเคสยกยอด`);
    }

    lines.push(`━━━━━━━━━━━━━━━━━━━━`);

    return lines.join('\n');
  }, [
    periodShortLabel,
    activeOfficerTag,
    effectiveApproveCount,
    effectiveDeliveredCount,
    effectivePendingCount,
    effectivePendingNames,
  ]);

  const handleCopyReport = async () => {
    triggerHaptic('success');
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = reportText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    }
  };

  const handleShareReport = async () => {
    triggerHaptic('medium');
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `ปิดยอด ${periodShortLabel} (${activeOfficerTag})`,
          text: reportText,
        });
        triggerHaptic('success');
        return;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }
    await handleCopyReport();
  };

  const handleAddManualCustomer = () => {
    const clean = newCustomerInput.trim();
    if (!clean) return;
    triggerHaptic('light');
    setManualPendingNames((prev) => [...prev, clean]);
    setNewCustomerInput('');
  };

  const handleUpdateManualCustomer = (idx: number, val: string) => {
    setManualPendingNames((prev) => prev.map((item, i) => (i === idx ? val : item)));
  };

  const handleRemoveManualCustomer = (idx: number) => {
    triggerHaptic('light');
    setManualPendingNames((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <>
      <div
        className={`bg-white rounded-[24px] border shadow-md shadow-indigo-950/5 overflow-hidden transition-all duration-300 h-full flex flex-col ${
          isExpanded
            ? 'border-indigo-400 ring-2 ring-indigo-400/40'
            : 'border-indigo-100 hover:border-indigo-200'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            onToggleExpand();
          }}
          className="w-full text-left bg-gradient-to-r from-indigo-50/80 via-sky-50/40 to-white hover:bg-indigo-50/90 transition-colors cursor-pointer select-none p-3 sm:p-4 flex-1 flex flex-col justify-between gap-2.5"
        >
          <div className="w-full flex items-center justify-between gap-1.5 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-600 text-white flex items-center justify-center shrink-0 shadow-xs shadow-indigo-500/25">
                <ClipboardCheck className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-white" />
              </div>
              <h3 className="text-[11.5px] sm:text-sm font-extrabold text-slate-900 leading-tight min-w-0 flex-1">
                <MarqueeText>สรุปยอดปิด</MarqueeText>
              </h3>
            </div>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/90 border border-slate-200/80 flex items-center justify-center text-slate-500 shrink-0 shadow-2xs">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="space-y-1 min-w-0 w-full">
            <span className="inline-block max-w-full text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-indigo-100/90 text-indigo-800 border border-indigo-200">
              <MarqueeText fitContent>
                Approve {effectiveApproveCount} • ยกยอด {effectivePendingCount}
              </MarqueeText>
            </span>
            <MarqueeText className="text-[10px] text-slate-500 font-medium">
              ยอดอนุมัติ รับรถ และรายชื่อรอรับ
            </MarqueeText>
          </div>
        </button>
      </div>

      {/* Popup Modal for Period Closing Report */}
      <CardModalOverlay
        isOpen={isExpanded}
        onClose={() => {
          triggerHaptic('light');
          onToggleExpand();
        }}
        accentBarClass="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500"
      >
        {/* Sticky Modal Header matching QuotationModal */}
        <div className="shrink-0 px-4 sm:px-5 py-3 sm:py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="p-2 sm:p-2.5 bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-600 text-white rounded-2xl shadow-md shadow-indigo-500/20 flex-shrink-0">
              <ClipboardCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <h2 className="text-sm sm:text-base font-bold text-slate-800 leading-tight min-w-0">
                  <MarqueeText fitContent>สรุปปิดยอด 15 / สิ้นเดือน</MarqueeText>
                </h2>
                <span className="text-[9.5px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100/90 text-indigo-800 border border-indigo-200 shrink-0 hidden sm:inline-block">
                  Approve • รับรถ • ยกยอด
                </span>
              </div>
              <MarqueeText className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                รายงานปิดยอด 1-15 และ 16-สิ้นเดือน พร้อมรายชื่อลูกค้าที่รอรับรถ
              </MarqueeText>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="text-right hidden xs:block">
              <div className="text-xs sm:text-sm font-extrabold text-indigo-700 whitespace-nowrap">
                Approve {effectiveApproveCount} • รับ {effectiveDeliveredCount}
              </div>
              <div className="text-[10px] font-semibold text-amber-700 whitespace-nowrap">
                ยกยอด {effectivePendingCount} คัน
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onToggleExpand();
              }}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 rounded-full transition-colors cursor-pointer flex-shrink-0 -mr-1"
              title="ปิดหน้าต่าง"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Body */}
        <div className="overflow-y-auto flex-1 overscroll-contain p-3 sm:p-5 bg-slate-50/60 space-y-4">
          {/* Top Controls: Month, Period Cycle (1-15 / 16-สิ้นเดือน / ทั้งเดือน), Refresh */}
          <div className="flex flex-col gap-2.5 pb-3 border-b border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 text-xs font-semibold text-slate-700 shrink-0">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>เดือน:</span>
                </div>
                <select
                  value={selectedYM}
                  onChange={(e) => {
                    triggerHaptic('selection');
                    setSelectedYM(e.target.value);
                  }}
                  className="text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                >
                  {availableMonths.map((ym) => {
                    const [yStr, mStr] = ym.split('-');
                    const mIdx = parseInt(mStr, 10) - 1;
                    const bYear = parseInt(yStr, 10) + 543;
                    return (
                      <option key={ym} value={ym}>
                        {THAI_MONTH_NAMES[mIdx]} {bYear}
                      </option>
                    );
                  })}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    reloadCases();
                  }}
                  className="p-1.5 text-slate-500 hover:text-indigo-700 bg-white hover:bg-indigo-50 border border-slate-200 rounded-xl transition-colors cursor-pointer shrink-0"
                  title="รีเฟรชข้อมูลเคสล่าสุด"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Cycle Pills */}
              <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    setPeriodCycle('first_half');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    periodCycle === 'first_half'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  1–15
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    setPeriodCycle('second_half');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    periodCycle === 'second_half'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  16–สิ้นเดือน
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    setPeriodCycle('full_month');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    periodCycle === 'full_month'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ทั้งเดือน
                </button>
              </div>
            </div>

            {/* Secondary Controls: Carry-over switch + Edit Toggle + Saved Cases shortcut */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <label className="inline-flex items-center gap-1.5 text-slate-700 font-semibold cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeCarryOver}
                  onChange={(e) => {
                    triggerHaptic('light');
                    setIncludeCarryOver(e.target.checked);
                  }}
                  className="w-3.5 h-3.5 rounded accent-indigo-600 cursor-pointer"
                />
                <span>รวมเคสค้างรับรถยกยอดจากงวดก่อน</span>
              </label>

              <div className="flex items-center gap-1.5 flex-wrap">
                {!isManualMode ? (
                  <button
                    type="button"
                    onClick={enterManualMode}
                    className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>ปรับตัวเลข / รายชื่อเอง</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={resetToAutoMode}
                    className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>ซิงก์จากเคสที่บันทึก</span>
                  </button>
                )}

                {onOpenSavedCases && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      onOpenSavedCases();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>จัดการเคส ({savedCases.length})</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 3 Summary KPI Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="p-2.5 sm:p-3 rounded-2xl bg-indigo-50/80 border border-indigo-200/80 text-center">
              <div className="text-[10px] sm:text-[11px] font-bold text-indigo-700">
                Approve
              </div>
              <div className="text-xl sm:text-2xl font-black text-indigo-950 mt-0.5">
                {effectiveApproveCount}
              </div>
              <div className="text-[10px] text-indigo-600 font-medium">คัน</div>
            </div>

            <div className="p-2.5 sm:p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 text-center">
              <div className="text-[10px] sm:text-[11px] font-bold text-emerald-700 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span>รับรถแล้ว</span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-900 mt-0.5">
                {effectiveDeliveredCount}
              </div>
              <div className="text-[10px] text-emerald-600 font-medium">คัน</div>
            </div>

            <div className="p-2.5 sm:p-3 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-center">
              <div className="text-[10px] sm:text-[11px] font-bold text-amber-800 flex items-center justify-center gap-1">
                <Clock className="w-3 h-3 shrink-0" />
                <span>ยกยอด (รอรับ)</span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-900 mt-0.5">
                {effectivePendingCount}
              </div>
              <div className="text-[10px] text-amber-700 font-medium">คัน</div>
            </div>
          </div>

          {/* Manual Adjustment Editor (shown when user toggles manual mode) */}
          {isManualMode && (
            <div className="p-3 sm:p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-amber-900 flex items-center gap-1.5">
                  <Pencil className="w-3.5 h-3.5 text-amber-700" />
                  แก้ไขตัวเลขและรายชื่อลูกค้ายกยอดเอง
                </span>
                <span className="text-[10px] text-amber-700 font-semibold">
                  โหมดปรับแก้ด่วน
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                    รหัส/ชื่อพนักงาน (หัวรายงาน)
                  </label>
                  <input
                    type="text"
                    value={officerTagOverride}
                    onChange={(e) => setOfficerTagOverride(e.target.value)}
                    placeholder={defaultOfficerTag}
                    className="w-full bg-white border border-amber-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                    จำนวน Approve (คัน)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={manualApproveCount}
                    onChange={(e) => setManualApproveCount(e.target.value)}
                    className="w-full bg-white border border-amber-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-indigo-900 outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                    จำนวนรับรถแล้ว (คัน)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={manualDeliveredCount}
                    onChange={(e) => setManualDeliveredCount(e.target.value)}
                    className="w-full bg-white border border-amber-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-emerald-900 outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              {/* Editable Pending Names List */}
              <div className="space-y-1.5">
                <label className="block text-[10.5px] font-bold text-slate-700">
                  รายชื่อลูกค้ายกยอด / รอรับรถ ({manualPendingNames.length} คน):
                </label>

                {manualPendingNames.map((name, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-amber-800 w-5 text-right shrink-0">
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => handleUpdateManualCustomer(idx, e.target.value)}
                      placeholder="ชื่อ-นามสกุล ลูกค้า"
                      className="flex-1 bg-white border border-amber-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveManualCustomer(idx)}
                      className="p-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-500 border border-rose-200 transition-colors cursor-pointer shrink-0"
                      title="ลบรายชื่อนี้"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                <div className="flex items-center gap-1.5 pt-1">
                  <input
                    type="text"
                    value={newCustomerInput}
                    onChange={(e) => setNewCustomerInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddManualCustomer();
                      }
                    }}
                    placeholder="เพิ่มชื่อ-สกุล ลูกค้าที่รอรับรถ..."
                    className="flex-1 bg-white border border-amber-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddManualCustomer}
                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>เพิ่มชื่อ</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Auto Pending Delivery List Detail (when in auto mode) */}
          {!isManualMode && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-amber-600" />
                  รายชื่อลูกค้าที่รอรับรถ / ยกยอด ({autoStats.pendingCount} คน)
                </span>
                {autoStats.deliveredCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setShowDeliveredList((prev) => !prev);
                    }}
                    className="text-[10.5px] font-bold text-emerald-700 hover:underline cursor-pointer"
                  >
                    {showDeliveredList
                      ? 'ซ่อนรายชื่อรับรถแล้ว'
                      : `ดูรายชื่อรับรถแล้ว (${autoStats.deliveredCount})`}
                  </button>
                )}
              </div>

              {autoStats.pendingCases.length > 0 ? (
                <div className="rounded-2xl bg-amber-50/50 border border-amber-200/70 divide-y divide-amber-100">
                  {autoStats.pendingCases.map((c, idx) => (
                    <div
                      key={c.id}
                      className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10.5px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <MarqueeText className="font-bold text-slate-900">
                            {getCleanCustomerName(c)}
                          </MarqueeText>
                          {(c.bikeModelName || c.dealerName) && (
                            <MarqueeText className="text-[10px] text-slate-500">
                              {[c.bikeModelName, c.dealerName].filter(Boolean).join(' • ')}
                            </MarqueeText>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white text-amber-800 border border-amber-200 shrink-0">
                        รอรับรถ
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-center text-[11px] text-slate-500">
                  ยังไม่มีเคสสถานะ &ldquo;อนุมัติ / รอรับรถ&rdquo; ในงวด {periodShortLabel}{' '}
                  (สามารถกด &ldquo;ปรับตัวเลข / รายชื่อเอง&rdquo; หรือบันทึกเคสเพิ่มเติมได้)
                </div>
              )}

              {/* Optional Delivered List Preview */}
              {showDeliveredList && autoStats.deliveredCases.length > 0 && (
                <div className="rounded-2xl bg-emerald-50/50 border border-emerald-200/70 divide-y divide-emerald-100">
                  <div className="px-3 py-1.5 text-[10.5px] font-bold text-emerald-800 bg-emerald-100/50 rounded-t-2xl">
                    เคสที่รับรถแล้วในงวดนี้ ({autoStats.deliveredCases.length} คัน)
                  </div>
                  {autoStats.deliveredCases.map((c, idx) => (
                    <div
                      key={c.id}
                      className="px-3 py-1.5 flex items-center justify-between gap-2 text-[11.5px]"
                    >
                      <MarqueeText className="font-semibold text-slate-800 flex-1">
                        {idx + 1}. {getCleanCustomerName(c)}
                      </MarqueeText>
                      <span className="text-[10px] font-semibold text-emerald-700 shrink-0">
                        รับรถแล้ว {c.deliveryDate ? c.deliveryDate.slice(8, 10) + '/' + c.deliveryDate.slice(5, 7) : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Live LINE Preview Box */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50/80 via-teal-50/40 to-sky-50/60 border border-emerald-200/80 shadow-2xs">
            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-emerald-200/70 text-[11px]">
              <span className="font-bold text-slate-800 flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-[#06c755] animate-pulse shrink-0" />
                <span>ตัวอย่างข้อความส่งสรุปปิดยอด (LINE) :</span>
              </span>
              <span className="text-[10px] text-emerald-800 font-semibold bg-white/90 border border-emerald-200/80 px-2.5 py-0.5 rounded-full shadow-2xs whitespace-nowrap shrink-0 tabular-nums">
                งวด {periodShortLabel}
              </span>
            </div>
            <pre className="font-sans text-[11.5px] leading-[1.6] whitespace-pre-wrap text-slate-800 select-all bg-white/95 p-3.5 rounded-xl border border-emerald-200/70 shadow-2xs">
              {reportText}
            </pre>
          </div>

          {/* Bottom Action Buttons: Copy & Share */}
          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={handleCopyReport}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 hover:opacity-95 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all active:scale-98 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-white shrink-0" />
                  <span>คัดลอกรายงานปิดยอดแล้ว!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-white shrink-0" />
                  <span>คัดลอกส่ง LINE</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleShareReport}
              className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all active:scale-98 cursor-pointer shrink-0"
              title="เปิดหน้าต่างแชร์ของอุปกรณ์เพื่อส่งเข้า LINE หรือแอปอื่น"
            >
              <Share2 className="w-4 h-4 shrink-0" />
              <span>แชร์</span>
            </button>
          </div>
        </div>
      </CardModalOverlay>
    </>
  );
};
