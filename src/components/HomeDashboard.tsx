import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  Ban,
  Building2,
  Calculator,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  FolderArchive,
  PackageCheck,
  Plus,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { SavedCaseRecord } from '../types';
import { calculateFirstPaymentDueDate, getSavedCases } from '../utils/savedCasesStorage';
import { calculateCheckerCommission } from '../utils/checkerCommission';
import { formatBaht } from '../data/proposals';
import { triggerHaptic } from '../utils/haptics';
import { MonthlyCasesDashboard } from './MonthlyCasesDashboard';

interface HomeDashboardProps {
  refreshTrigger?: number;
  officerName: string;
  officerCode: string;
  officerLicense: string;
  dealerName: string;
  activeDraft: {
    customerName: string;
    bikeModelName?: string;
    monthlyInstallment: number;
    term: number;
    isEditing: boolean;
  };
  onOpenSavedCases: () => void;
  onNavigateToCaseForm: () => void;
  onNavigateToOfficerSetup: () => void;
  onNavigateToCalculation: () => void;
  onNavigateToDocuments: () => void;
  onNavigateToCheckerCommission: () => void;
  onNavigateToPeriodClosing: () => void;
  onNavigateToInstallments: () => void;
  onLoadCase: (record: SavedCaseRecord) => void;
}

const THAI_MONTHS_SHORT = [
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

const THAI_MONTHS_FULL = [
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

function getBangkokYearMonth(tsOrDate?: number | string): string {
  if (typeof tsOrDate === 'string' && /^\d{4}-\d{2}/.test(tsOrDate)) {
    return tsOrDate.slice(0, 7);
  }
  const ts =
    typeof tsOrDate === 'number' && Number.isFinite(tsOrDate) && tsOrDate > 0
      ? tsOrDate
      : Date.now();
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(new Date(ts));
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    if (y && m) return `${y}-${m}`;
  } catch {
    // fallback
  }
  const bkk = new Date(ts + 7 * 60 * 60 * 1000);
  return `${bkk.getUTCFullYear()}-${String(bkk.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getCurrentMonthKey(): string {
  return getBangkokYearMonth(Date.now());
}

function shiftMonthKey(ym: string, delta: -1 | 1): string {
  const base = ym === 'all' ? getCurrentMonthKey() : ym;
  const [yStr, mStr] = base.split('-');
  const d = new Date(Number(yStr), Number(mStr) - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(ym: string): string {
  if (ym === 'all') return 'ทุกช่วงเวลา (ทั้งหมด)';
  const [yStr, mStr] = ym.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return ym;
  return `${THAI_MONTHS_FULL[m - 1]} ${y + 543}`;
}

function formatThaiShortDate(input?: number | string): string {
  if (!input) return '-';
  let d: Date;
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, day] = input.split('-').map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = new Date(input);
  }
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()] || ''} ${String(
    d.getFullYear() + 543
  ).slice(-2)}`;
}

function getUnifiedStatus(record: SavedCaseRecord): {
  key: 'delivered' | 'approved' | 'pending' | 'rejected' | 'cancelled';
  label: string;
  className: string;
} {
  if (record.approvalStatus === 'approved') {
    if (record.deliveryStatus === 'delivered') {
      return {
        key: 'delivered',
        label: 'รับรถแล้ว',
        className: 'bg-teal-50 text-teal-800 border-teal-300',
      };
    }
    return {
      key: 'approved',
      label: 'อนุมัติแล้ว',
      className: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    };
  }
  if (record.approvalStatus === 'rejected') {
    return {
      key: 'rejected',
      label: 'ไม่อนุมัติ',
      className: 'bg-rose-50 text-rose-700 border-rose-300',
    };
  }
  if (record.approvalStatus === 'cancelled') {
    return {
      key: 'cancelled',
      label: 'ยกเลิก',
      className: 'bg-slate-100 text-slate-700 border-slate-300',
    };
  }
  return {
    key: 'pending',
    label: 'รออนุมัติ',
    className: 'bg-sky-50 text-sky-800 border-sky-200',
  };
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  refreshTrigger,
  officerName,
  officerCode,
  officerLicense,
  dealerName,
  activeDraft,
  onOpenSavedCases,
  onNavigateToCaseForm,
  onNavigateToOfficerSetup,
  onNavigateToCalculation,
  onNavigateToDocuments,
  onNavigateToCheckerCommission,
  onNavigateToPeriodClosing,
  onNavigateToInstallments,
  onLoadCase,
}) => {
  const [savedCases, setSavedCases] = useState<SavedCaseRecord[]>(() => getSavedCases());
  const currentMonthKey = useMemo(() => getCurrentMonthKey(), []);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);

  useEffect(() => {
    setSavedCases(getSavedCases());
  }, [refreshTrigger]);

  useEffect(() => {
    const onSynced = () => setSavedCases(getSavedCases());
    window.addEventListener('ncap-cases-synced', onSynced);
    return () => window.removeEventListener('ncap-cases-synced', onSynced);
  }, []);

  // Available months sorted descending
  const availableMonths = useMemo(() => {
    const set = new Set<string>([currentMonthKey]);
    for (const c of savedCases) {
      set.add(getBangkokYearMonth(c.createdAt));
      if (c.approvalDate) set.add(getBangkokYearMonth(c.approvalDate));
      if (c.deliveryDate) set.add(getBangkokYearMonth(c.deliveryDate));
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [savedCases, currentMonthKey]);

  // Auto-select latest populated month if current month has 0 cases
  useEffect(() => {
    if (savedCases.length === 0) return;
    const hasCurrent = savedCases.some(
      (c) =>
        getBangkokYearMonth(c.createdAt) === currentMonthKey ||
        (c.approvalDate && getBangkokYearMonth(c.approvalDate) === currentMonthKey) ||
        (c.deliveryDate && getBangkokYearMonth(c.deliveryDate) === currentMonthKey)
    );
    if (!hasCurrent && selectedMonth === currentMonthKey && availableMonths.length > 0) {
      const latestWithData = availableMonths.find((m) => m !== currentMonthKey);
      if (latestWithData) {
        setSelectedMonth(latestWithData);
      }
    }
  }, [savedCases.length]);

  // Cases active in selected month (created, approved, or delivered in month)
  const periodCases = useMemo(() => {
    if (selectedMonth === 'all') {
      return [...savedCases].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
    return savedCases
      .filter((c) => {
        const cYM = getBangkokYearMonth(c.createdAt);
        const aYM = c.approvalDate ? getBangkokYearMonth(c.approvalDate) : '';
        const dYM = c.deliveryDate ? getBangkokYearMonth(c.deliveryDate) : '';
        return cYM === selectedMonth || aYM === selectedMonth || dYM === selectedMonth;
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [savedCases, selectedMonth]);

  // Core KPI & Pipeline aggregation
  const periodStats = useMemo(() => {
    let deliveredCount = 0;
    let approvedPendingDeliveryCount = 0;
    let pendingCount = 0;
    let rejectedOrCancelledCount = 0;
    let totalFinance = 0;
    let totalMonthlyInstallments = 0;

    for (const c of periodCases) {
      totalFinance += Number(c.snapshot?.financeAmount) || 0;
      totalMonthlyInstallments += Number(c.snapshot?.monthlyInstallment) || 0;

      if (c.approvalStatus === 'approved') {
        if (c.deliveryStatus === 'delivered') {
          deliveredCount += 1;
        } else {
          approvedPendingDeliveryCount += 1;
        }
      } else if (c.approvalStatus === 'rejected' || c.approvalStatus === 'cancelled') {
        rejectedOrCancelledCount += 1;
      } else {
        pendingCount += 1;
      }
    }

    const totalCases = periodCases.length;
    const approvedTotalCount = deliveredCount + approvedPendingDeliveryCount;
    const avgFinance = totalCases > 0 ? totalFinance / totalCases : 0;
    const approvalRate = totalCases > 0 ? (approvedTotalCount / totalCases) * 100 : 0;

    return {
      totalCases,
      deliveredCount,
      approvedPendingDeliveryCount,
      approvedTotalCount,
      pendingCount,
      rejectedOrCancelledCount,
      totalFinance,
      totalMonthlyInstallments,
      avgFinance,
      approvalRate,
    };
  }, [periodCases]);

  // Real Checker Insurance Commission calculation
  const commissionSummary = useMemo(
    () =>
      calculateCheckerCommission(
        savedCases,
        selectedMonth === 'all' ? undefined : selectedMonth
      ),
    [savedCases, selectedMonth]
  );

  // Top Dealers in selected period
  const topDealers = useMemo(() => {
    const map = new Map<
      string,
      { name: string; total: number; delivered: number; finance: number }
    >();
    for (const c of periodCases) {
      const name = c.dealerName?.trim() || 'ไม่ระบุร้านตัวแทน';
      const entry = map.get(name) || { name, total: 0, delivered: 0, finance: 0 };
      entry.total += 1;
      if (c.approvalStatus === 'approved' && c.deliveryStatus === 'delivered') {
        entry.delivered += 1;
      }
      entry.finance += Number(c.snapshot?.financeAmount) || 0;
      map.set(name, entry);
    }
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total || b.finance - a.finance)
      .slice(0, 4);
  }, [periodCases]);

  // Upcoming / First Payment Cohort summary (for delivered cases)
  const upcomingInstallmentSummary = useMemo(() => {
    const delivered = savedCases.filter(
      (c) => c.approvalStatus === 'approved' && c.deliveryStatus === 'delivered'
    );
    if (delivered.length === 0) return null;

    const cohorts = new Map<
      string,
      { label: string; sortKey: string; count: number; sumInstallment: number }
    >();
    for (const c of delivered) {
      const due = calculateFirstPaymentDueDate(c.deliveryDate || c.createdAt);
      const sortKey = due.key;
      const existing = cohorts.get(sortKey) || {
        label: `2 ${due.monthShort} ${due.thaiShortYear}`,
        sortKey,
        count: 0,
        sumInstallment: 0,
      };
      existing.count += 1;
      existing.sumInstallment += Number(c.snapshot?.monthlyInstallment) || 0;
      cohorts.set(sortKey, existing);
    }
    const sorted = Array.from(cohorts.values()).sort((a, b) =>
      b.sortKey.localeCompare(a.sortKey)
    );
    return {
      totalDeliveredAllTime: delivered.length,
      latestCohort: sorted[0] || null,
    };
  }, [savedCases]);

  const recentCases = useMemo(() => periodCases.slice(0, 5), [periodCases]);

  const paTierProgress = Math.min(100, Math.max(0, commissionSummary.achievementPercent));

  return (
    <div className="space-y-3 sm:space-y-3.5 animate-tab-fade">
      {/* Top Dashboard Command Bar */}
      <section className="bg-white/95 rounded-2xl border border-slate-200/90 shadow-xs p-3.5 sm:p-4 space-y-2.5 sm:space-y-3">
        <div className="space-y-1">
          {/* Top Row: Title (Left) + Month Switcher (Top-Right Corner) */}
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-[15px] sm:text-lg font-black text-slate-900 tracking-tight leading-snug min-w-0 pt-0.5">
              แดชบอร์ดภาพรวมผลงาน
            </h2>

            {/* Top-Right Month Switcher */}
            <div className="flex items-center gap-1 shrink-0">
              <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-100/90 p-0.5 sm:p-1 rounded-xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setSelectedMonth((prev) => shiftMonthKey(prev, -1));
                  }}
                  className="p-1 sm:p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                  title="เดือนก่อนหน้า"
                  aria-label="เดือนก่อนหน้า"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <div className="relative">
                  <select
                    aria-label="เลือกงวดเดือนของแดชบอร์ด"
                    value={selectedMonth}
                    onChange={(e) => {
                      triggerHaptic('light');
                      setSelectedMonth(e.target.value);
                    }}
                    className="appearance-none bg-white border border-slate-200/90 rounded-lg pl-2 pr-5 sm:pl-2.5 sm:pr-7 py-0.5 sm:py-1 text-[11px] sm:text-xs font-extrabold text-slate-800 max-w-[135px] sm:max-w-none truncate focus:outline-none focus:ring-2 focus:ring-sky-500/25 cursor-pointer"
                  >
                    <option value="all">ทุกช่วงเวลา (ทั้งหมด)</option>
                    {availableMonths.map((ym) => (
                      <option key={ym} value={ym}>
                        {formatMonthLabel(ym)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500 pointer-events-none absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2" />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setSelectedMonth((prev) => shiftMonthKey(prev, 1));
                  }}
                  className="p-1 sm:p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                  title="เดือนถัดไป"
                  aria-label="เดือนถัดไป"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {selectedMonth !== currentMonthKey && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setSelectedMonth(currentMonthKey);
                  }}
                  className="p-1.5 sm:p-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 transition-colors cursor-pointer shrink-0"
                  title="กลับไปยังเดือนปัจจุบัน"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Officer Identity Row */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1 text-slate-700 font-semibold">
              <UserCheck className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span>{officerName.trim() || 'ยังไม่ระบุชื่อเจ้าหน้าที่'}</span>
            </span>
            {officerCode.trim() && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-sky-800 font-bold">
                  รหัส {officerCode.trim()}
                </span>
              </>
            )}
            {officerLicense.trim() && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono">นายหน้า {officerLicense.trim()}</span>
              </>
            )}
            {dealerName.trim() && (
              <>
                <span aria-hidden="true">·</span>
                <span>{dealerName.trim()}</span>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onNavigateToOfficerSetup();
              }}
              className="text-sky-700 hover:text-sky-900 font-bold underline cursor-pointer ml-0.5"
            >
              แก้ไขข้อมูลเจ้าหน้าที่
            </button>
          </div>
        </div>

        {/* Primary Action Strip + Active Draft Resume */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('medium');
              onNavigateToCaseForm();
            }}
            className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-sky-600 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-sky-500/20 active:scale-[0.99] transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>{activeDraft.isEditing ? 'กลับไปแก้ไขเคสที่เปิดอยู่' : 'คำนวณ / บันทึกเคสใหม่'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              onOpenSavedCases();
            }}
            className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <FolderArchive className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span>ตารางเคสทั้งหมด ({savedCases.length})</span>
          </button>

          {/* Compact Current Draft Shortcut */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onNavigateToCalculation();
            }}
            className="w-full sm:w-auto sm:ml-auto px-3 py-2 rounded-xl bg-sky-50/80 hover:bg-sky-100/80 border border-sky-200/80 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer"
            title="เปิดดูผลคำนวณค่างวดที่ตั้งค่าไว้ล่าสุด"
          >
            <div className="flex items-center gap-1.5 min-w-0 text-[11px]">
              <Calculator className="w-3.5 h-3.5 text-sky-700 shrink-0" />
              <span className="text-slate-600 truncate">
                <strong className="text-slate-900">
                  {activeDraft.customerName.trim() || 'เคสปัจจุบัน'}
                </strong>
                {activeDraft.bikeModelName ? ` · ${activeDraft.bikeModelName}` : ''}
              </span>
            </div>
            <span className="text-[11px] font-extrabold text-sky-800 tabular-nums whitespace-nowrap shrink-0">
              {formatBaht(activeDraft.monthlyInstallment)}/ด. ({activeDraft.term} งวด)
            </span>
          </button>
        </div>
      </section>

      {/* 4-Column KPI Summary Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="bg-white/95 rounded-2xl border border-slate-200/90 shadow-xs p-3.5 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>เคสในงวดนี้</span>
            <FolderArchive className="w-3.5 h-3.5 text-sky-600 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums">
            {periodStats.totalCases} <span className="text-xs font-bold text-slate-500">เคส</span>
          </div>
          <div className="text-[10.5px] text-slate-500 tabular-nums truncate">
            รอผล {periodStats.pendingCount} · อนุมัติ {periodStats.approvedTotalCount}
          </div>
        </div>

        <div className="bg-white/95 rounded-2xl border border-slate-200/90 shadow-xs p-3.5 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>รับรถแล้ว</span>
            <PackageCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-teal-700 tabular-nums">
            {periodStats.deliveredCount}{' '}
            <span className="text-xs font-bold text-slate-500">คัน</span>
          </div>
          <div className="text-[10.5px] text-slate-500 tabular-nums truncate">
            รอรับรถ {periodStats.approvedPendingDeliveryCount} · อนุมัติ{' '}
            {periodStats.approvalRate.toFixed(0)}%
          </div>
        </div>

        <div className="bg-white/95 rounded-2xl border border-slate-200/90 shadow-xs p-3.5 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>ยอดจัดไฟแนนซ์รวม</span>
            <TrendingUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900 tabular-nums truncate">
            {formatBaht(Math.round(periodStats.totalFinance))}
          </div>
          <div className="text-[10.5px] text-slate-500 tabular-nums truncate">
            เฉลี่ย {formatBaht(Math.round(periodStats.avgFinance))}/เคส
          </div>
        </div>

        <div className="bg-white/95 rounded-2xl border border-slate-200/90 shadow-xs p-3.5 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>ค่าคอมประกัน PA</span>
            <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          </div>
          <div className="text-lg sm:text-xl font-black text-amber-700 tabular-nums truncate">
            {formatBaht(commissionSummary.totalCommissionBaht)}
          </div>
          <div className="text-[10.5px] text-slate-500 tabular-nums truncate">
            Tier {commissionSummary.tier} · {commissionSummary.achievementPercent.toFixed(1)}% (
            {commissionSummary.totalInsuredContracts}/{commissionSummary.totalDeliveredContracts})
          </div>
        </div>
      </section>

      {/* Monthly Cases Recharts Dashboard */}
      <MonthlyCasesDashboard
        refreshTrigger={refreshTrigger}
        onOpenSavedCases={onOpenSavedCases}
        onGoToCalculate={onNavigateToCaseForm}
      />

      {/* 2-Column Analytics: Checker Commission Summary + Deal Pipeline & Dealers */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Card A: Checker Insurance Commission Summary */}
        <div className="bg-white/95 rounded-2xl border border-slate-200/90 shadow-xs p-3.5 sm:p-4 flex flex-col justify-between space-y-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                    ยอดสรุปค่าคอมประกัน Checker
                  </h3>
                  <p className="text-[10.5px] text-slate-500 truncate">
                    {formatMonthLabel(selectedMonth)} · เฉพาะเคสอนุมัติและรับรถแล้ว
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  onNavigateToCheckerCommission();
                }}
                className="text-[11px] font-bold text-sky-700 hover:text-sky-900 flex items-center gap-0.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>ตารางเต็ม</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {commissionSummary.totalDeliveredContracts === 0 ? (
              <div className="py-6 px-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center space-y-1">
                <p className="text-xs font-bold text-slate-700">
                  ยังไม่มีเคสที่ "อนุมัติและรับรถแล้ว" ในงวดนี้
                </p>
                <p className="text-[11px] text-slate-500">
                  ระบบจะคำนวณยอดค่าคอมประกันและระดับ Tier ให้อัตโนมัติเมื่อมีการอัปเดตสถานะรับรถ
                </p>
              </div>
            ) : (
              <>
                {/* Main Commission & Tier Progress */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <span className="text-[10.5px] font-semibold text-slate-500 block">
                        ค่าคอมมิชชั่นที่คาดว่าจะได้รับ
                      </span>
                      <span className="text-2xl font-black text-slate-900 tabular-nums">
                        {formatBaht(commissionSummary.totalCommissionBaht)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-block text-[11px] font-extrabold px-2 py-0.5 rounded-lg border ${
                          commissionSummary.tier === 3
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : commissionSummary.tier === 2
                            ? 'bg-sky-50 text-sky-800 border-sky-200'
                            : 'bg-amber-50 text-amber-800 border-amber-300'
                        }`}
                      >
                        {commissionSummary.tierRule.label}
                      </span>
                      <div className="text-[11px] font-bold text-slate-700 tabular-nums mt-0.5">
                        Achievement {commissionSummary.achievementPercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  {/* Achievement Progress Bar with Tier thresholds */}
                  <div className="space-y-1">
                    <div className="relative h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          commissionSummary.tier === 3
                            ? 'bg-emerald-600'
                            : commissionSummary.tier === 2
                            ? 'bg-sky-600'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${paTierProgress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[9.5px] text-slate-500 tabular-nums">
                      <span>0% (Tier 1)</span>
                      <span>60.01% (Tier 2)</span>
                      <span>75.01%+ (Tier 3)</span>
                    </div>
                  </div>
                </div>

                {/* PA Breakdown Grid */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                    <div className="text-[10px] font-semibold text-slate-500">PA ปกติ</div>
                    <div className="text-base font-black text-sky-800 tabular-nums mt-0.5">
                      {commissionSummary.paCount}
                    </div>
                    <div className="text-[9.5px] text-slate-500 tabular-nums">
                      {formatBaht(
                        commissionSummary.breakdown.pa[1].total +
                          commissionSummary.breakdown.pa[2].total +
                          commissionSummary.breakdown.pa[3].total
                      )}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                    <div className="text-[10px] font-semibold text-slate-500">PA Plus</div>
                    <div className="text-base font-black text-amber-700 tabular-nums mt-0.5">
                      {commissionSummary.paPlusCount}
                    </div>
                    <div className="text-[9.5px] text-slate-500 tabular-nums">
                      {formatBaht(
                        commissionSummary.breakdown.pa_plus[1].total +
                          commissionSummary.breakdown.pa_plus[2].total +
                          commissionSummary.breakdown.pa_plus[3].total
                      )}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                    <div className="text-[10px] font-semibold text-slate-500">ไม่ทำประกัน</div>
                    <div className="text-base font-black text-slate-700 tabular-nums mt-0.5">
                      {commissionSummary.totalNoInsuranceContracts}
                    </div>
                    <div className="text-[9.5px] text-slate-500 tabular-nums">
                      รวม {commissionSummary.totalDeliveredContracts} สัญญา
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Tier Advice Footer */}
          {commissionSummary.totalDeliveredContracts > 0 && (
            <div className="pt-2 border-t border-slate-100 text-[11px] flex items-center justify-between gap-2">
              {commissionSummary.nextTierNeeded ? (
                <span className="text-amber-800 font-semibold">
                  ขาย PA เพิ่มอีก{' '}
                  <strong className="tabular-nums">
                    {commissionSummary.nextTierNeeded.additionalInsuredNeeded}
                  </strong>{' '}
                  คัน เพื่อขึ้น Tier {commissionSummary.nextTierNeeded.nextTier} (เพิ่ม{' '}
                  <strong className="tabular-nums text-emerald-700">
                    +{formatBaht(commissionSummary.nextTierNeeded.potentialCommissionIncrease)}
                  </strong>
                  )
                </span>
              ) : (
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>บรรลุเป้าหมาย Tier 3 สูงสุดเรียบร้อย</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Card B: Deal Pipeline, Top Dealers & First Installment Overview */}
        <div className="bg-white/95 rounded-2xl border border-slate-200/90 shadow-xs p-3.5 sm:p-4 flex flex-col justify-between space-y-3">
          {/* Pipeline Status Breakdown */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs sm:text-sm font-black text-slate-900">
                สัดส่วนสถานะดีล & ร้านตัวแทน
              </h3>
              <span className="text-[10.5px] text-slate-500 font-semibold tabular-nums">
                {periodStats.totalCases} รายการ
              </span>
            </div>

            <div className="space-y-1.5 text-[11px]">
              {[
                {
                  label: 'รับรถแล้ว',
                  count: periodStats.deliveredCount,
                  barColor: 'bg-teal-600',
                  textColor: 'text-teal-800',
                },
                {
                  label: 'อนุมัติแล้ว (รอรับรถ)',
                  count: periodStats.approvedPendingDeliveryCount,
                  barColor: 'bg-emerald-500',
                  textColor: 'text-emerald-800',
                },
                {
                  label: 'รออนุมัติ',
                  count: periodStats.pendingCount,
                  barColor: 'bg-sky-500',
                  textColor: 'text-sky-800',
                },
                {
                  label: 'ไม่อนุมัติ / ยกเลิก',
                  count: periodStats.rejectedOrCancelledCount,
                  barColor: 'bg-slate-400',
                  textColor: 'text-slate-600',
                },
              ].map((row) => {
                const pct =
                  periodStats.totalCases > 0 ? (row.count / periodStats.totalCases) * 100 : 0;
                return (
                  <div key={row.label} className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className={`font-semibold ${row.textColor}`}>{row.label}</span>
                      <span className="font-bold text-slate-800 tabular-nums">
                        {row.count} เคส ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${row.barColor} transition-all duration-300`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Dealers in Selected Period */}
          <div className="pt-2.5 border-t border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-700 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span>สรุปตามร้านตัวแทน (Top Dealers)</span>
              </span>
            </div>

            {topDealers.length === 0 ? (
              <p className="text-[11px] text-slate-400">ยังไม่มีข้อมูลร้านตัวแทนในงวดนี้</p>
            ) : (
              <div className="divide-y divide-slate-100 text-[11px]">
                {topDealers.map((d) => (
                  <div key={d.name} className="py-1.5 flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800 truncate">{d.name}</span>
                    <div className="flex items-center gap-2 shrink-0 tabular-nums text-slate-600">
                      <span>
                        <strong className="text-slate-900">{d.total}</strong> เคส (รับรถ{' '}
                        {d.delivered})
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="font-bold text-sky-800">
                        {formatBaht(Math.round(d.finance))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming First Payment Cohort Banner */}
          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-2 min-w-0">
              <CalendarClock className="w-4 h-4 text-indigo-600 shrink-0" />
              <div className="min-w-0 truncate">
                {upcomingInstallmentSummary?.latestCohort ? (
                  <span className="text-slate-700">
                    งวดแรก{' '}
                    <strong className="text-indigo-900">
                      {upcomingInstallmentSummary.latestCohort.label}
                    </strong>{' '}
                    ·{' '}
                    <strong className="tabular-nums">
                      {upcomingInstallmentSummary.latestCohort.count}
                    </strong>{' '}
                    ราย (รวม{' '}
                    <strong className="tabular-nums">
                      {formatBaht(upcomingInstallmentSummary.latestCohort.sumInstallment)}
                    </strong>
                    /ด.)
                  </span>
                ) : (
                  <span className="text-slate-500">ติดตามค่างวดชำระทุกวันที่ 2 ของเดือน</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onNavigateToInstallments();
              }}
              className="text-indigo-700 hover:text-indigo-900 font-bold whitespace-nowrap shrink-0 flex items-center gap-0.5 cursor-pointer"
            >
              <span>เช็คค่างวด</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </section>

      {/* Recent Deals Table with Unified Status Column */}
      <section className="bg-white/95 rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="px-3.5 sm:px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-xs sm:text-sm font-black text-slate-900">
              รายการเคสล่าสุด ({formatMonthLabel(selectedMonth)})
            </h3>
            <p className="text-[10.5px] text-slate-500">
              แตะที่รายการเพื่อโหลดข้อมูลค่างวด หรือกดเปิดดูตารางเคสทั้งหมดเพื่ออัปเดตสถานะ
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              onOpenSavedCases();
            }}
            className="text-[11px] font-bold text-sky-700 hover:text-sky-900 flex items-center gap-0.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>ดูทั้งหมด</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentCases.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <p className="text-xs font-bold text-slate-700">ยังไม่มีรายการเคสในงวดที่เลือก</p>
            <p className="text-[11px] text-slate-500">
              กด "คำนวณ / บันทึกเคสใหม่" เพื่อเริ่มต้นสร้างดีลหรือเลือกดู "ทุกช่วงเวลา"
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse min-w-[540px]">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-[10.5px] font-extrabold text-slate-600">
                  <th className="py-2 px-3.5">ชื่อลูกค้า / รุ่นรถ</th>
                  <th className="py-2 px-2.5 whitespace-nowrap">สถานะ</th>
                  <th className="py-2 px-2.5 text-right whitespace-nowrap">ค่างวด / งวด</th>
                  <th className="py-2 px-3.5 text-right whitespace-nowrap">วันที่บันทึก</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px]">
                {recentCases.map((c) => {
                  const status = getUnifiedStatus(c);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => {
                        triggerHaptic('light');
                        onLoadCase(c);
                      }}
                      className="hover:bg-sky-50/60 transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 px-3.5 max-w-[220px]">
                        <div className="font-bold text-slate-900 truncate">
                          {c.customerName?.trim() || c.caseTitle || 'คุณลูกค้า'}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          {c.bikeModelName || c.snapshot?.proposalCode || '-'}
                          {c.dealerName ? ` · ${c.dealerName}` : ''}
                        </div>
                      </td>
                      <td className="py-2.5 px-2.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10.5px] font-bold ${status.className}`}
                        >
                          {status.key === 'delivered' && <PackageCheck className="w-3 h-3 shrink-0" />}
                          {status.key === 'approved' && <CheckCircle2 className="w-3 h-3 shrink-0" />}
                          {status.key === 'rejected' && <XCircle className="w-3 h-3 shrink-0" />}
                          {status.key === 'cancelled' && <Ban className="w-3 h-3 shrink-0" />}
                          {status.key === 'pending' && <Clock className="w-3 h-3 shrink-0" />}
                          <span>{status.label}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-2.5 text-right tabular-nums whitespace-nowrap">
                        <span className="font-extrabold text-sky-700">
                          {formatBaht(c.snapshot?.monthlyInstallment || 0)}
                        </span>
                        <span className="text-[10px] text-slate-500"> · {c.term} งวด</span>
                      </td>
                      <td className="py-2.5 px-3.5 text-right tabular-nums text-[10.5px] text-slate-500 whitespace-nowrap">
                        {formatThaiShortDate(c.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Quick Tools Grid */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            onNavigateToPeriodClosing();
          }}
          className="p-3 rounded-2xl bg-white/95 hover:bg-sky-50/80 border border-slate-200/90 shadow-xs text-left transition-colors cursor-pointer space-y-1"
        >
          <CalendarDays className="w-4 h-4 text-sky-600" />
          <div className="text-xs font-extrabold text-slate-900">ปิดยอด 1-15 / สิ้นเดือน</div>
          <div className="text-[10px] text-slate-500">สรุปยอด Approve & รับรถ</div>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            onNavigateToCheckerCommission();
          }}
          className="p-3 rounded-2xl bg-white/95 hover:bg-amber-50/70 border border-slate-200/90 shadow-xs text-left transition-colors cursor-pointer space-y-1"
        >
          <Award className="w-4 h-4 text-amber-600" />
          <div className="text-xs font-extrabold text-slate-900">คำนวณค่าคอมประกัน</div>
          <div className="text-[10px] text-slate-500">รายงาน Tier 1-3 & ส่งไลน์</div>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            onNavigateToDocuments();
          }}
          className="p-3 rounded-2xl bg-white/95 hover:bg-emerald-50/70 border border-slate-200/90 shadow-xs text-left transition-colors cursor-pointer space-y-1"
        >
          <FileText className="w-4 h-4 text-emerald-600" />
          <div className="text-xs font-extrabold text-slate-900">เอกสาร & ขออนุมัติ DV</div>
          <div className="text-[10px] text-slate-500">ใบเสนอราคา & แผน PA</div>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            onNavigateToInstallments();
          }}
          className="p-3 rounded-2xl bg-white/95 hover:bg-indigo-50/70 border border-slate-200/90 shadow-xs text-left transition-colors cursor-pointer space-y-1"
        >
          <CalendarClock className="w-4 h-4 text-indigo-600" />
          <div className="text-xs font-extrabold text-slate-900">ติดตามกำหนดชำระ</div>
          <div className="text-[10px] text-slate-500">ตารางงวดที่ 1-9 รายเดือน</div>
        </button>
      </section>
    </div>
  );
};
