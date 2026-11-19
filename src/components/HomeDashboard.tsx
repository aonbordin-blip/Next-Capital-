import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  Ban,
  Building2,
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
import { GasolineAllowanceCard } from './GasolineAllowanceCard';
import { MarqueeText } from './MarqueeText';

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
    <div className="space-y-3 sm:space-y-4 animate-tab-fade">
      {/* Top Dashboard Command Bar */}
      <section className="glass-card-hero rounded-2xl p-3.5 sm:p-4.5 space-y-2.5 sm:space-y-3 relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-95"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none -right-12 -top-12 absolute w-44 h-44 rounded-full bg-cyan-200/35 blur-2xl"
          aria-hidden="true"
        />

        <div className="relative space-y-1.5">
          {/* Top Row: Title (Left) + Month Switcher (Top-Right Corner) */}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <MarqueeText className="text-[14px] sm:text-lg font-black text-slate-900 tracking-tight">
                แดชบอร์ดภาพรวมผลงาน
              </MarqueeText>
            </div>

            {/* Top-Right Month Switcher */}
            <div className="flex items-center gap-1 shrink-0">
              <div className="flex items-center gap-0.5 sm:gap-1 bg-white/55 backdrop-blur-md p-0.5 sm:p-1 rounded-xl border border-white/85 shadow-2xs">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setSelectedMonth((prev) => shiftMonthKey(prev, -1));
                  }}
                  className="p-1 sm:p-1.5 rounded-lg hover:bg-white/60 text-slate-600 hover:text-sky-800 transition-colors cursor-pointer"
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
                    className="appearance-none bg-white/65 border border-white/90 rounded-lg pl-2 pr-5 sm:pl-2.5 sm:pr-7 py-0.5 sm:py-1 text-[11px] sm:text-xs font-extrabold text-slate-800 max-w-[122px] sm:max-w-none truncate focus:outline-none focus:ring-2 focus:ring-sky-500/25 cursor-pointer"
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
                  className="p-1 sm:p-1.5 rounded-lg hover:bg-white/60 text-slate-600 hover:text-sky-800 transition-colors cursor-pointer"
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
                  className="p-1.5 sm:p-2 rounded-xl bg-white/55 hover:bg-white/80 backdrop-blur-md text-sky-700 border border-white/85 shadow-2xs transition-colors cursor-pointer shrink-0"
                  title="กลับไปยังเดือนปัจจุบัน"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Officer Identity Row (1 tidy line; long metadata glides RTL) */}
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <UserCheck className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <MarqueeText className="min-w-0 flex-1">
                <span className="text-slate-800 font-semibold">
                  {officerName.trim() || 'ยังไม่ระบุชื่อเจ้าหน้าที่'}
                </span>
                {officerCode.trim() && (
                  <span className="font-mono text-sky-800 font-bold">
                    {` · รหัส ${officerCode.trim()}`}
                  </span>
                )}
                {officerLicense.trim() && (
                  <span className="font-mono">{` · นายหน้า ${officerLicense.trim()}`}</span>
                )}
                {dealerName.trim() && <span>{` · ${dealerName.trim()}`}</span>}
              </MarqueeText>
            </div>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onNavigateToOfficerSetup();
              }}
              className="text-sky-700 hover:text-sky-900 font-bold underline cursor-pointer whitespace-nowrap shrink-0"
            >
              แก้ไขข้อมูลเจ้าหน้าที่
            </button>
          </div>
        </div>

        {/* Primary Action Strip + Active Draft Resume */}
        <div className="relative space-y-2 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:gap-2 pt-0.5">
          <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:shrink-0">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('medium');
                onNavigateToCaseForm();
              }}
              className="btn-fluid-primary px-3 sm:px-4 py-2 rounded-xl font-bold text-[11.5px] sm:text-xs flex items-center justify-center gap-1.5 cursor-pointer min-w-0"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <MarqueeText fitContent>
                {activeDraft.isEditing ? 'กลับไปแก้ไขเคสที่เปิดอยู่' : 'คำนวณ / บันทึกเคสใหม่'}
              </MarqueeText>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                onOpenSavedCases();
              }}
              className="px-3 sm:px-3.5 py-2 rounded-xl bg-white/85 hover:bg-white text-slate-800 font-bold text-[11.5px] sm:text-xs flex items-center justify-center gap-1.5 border border-white/95 shadow-xs transition-all hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer min-w-0"
            >
              <FolderArchive className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <MarqueeText fitContent>ตารางเคสทั้งหมด ({savedCases.length})</MarqueeText>
            </button>
          </div>
        </div>
      </section>

      {/* 4-Column KPI Summary Strip (Vibrant Crystal Glass Quartet + Brand Gold Accent) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="glass-panel-blue dashboard-card-lift rounded-2xl p-3 sm:p-3.5 space-y-1.5 relative overflow-hidden">
          <div
            className="pointer-events-none inset-x-4 top-0 absolute h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-95"
            aria-hidden="true"
          />
          <div className="flex items-center justify-between gap-2">
            <MarqueeText className="text-[11px] font-bold text-sky-900/80">
              เคสเดือนนี้
            </MarqueeText>
            <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white border border-white/60 flex items-center justify-center shrink-0 shadow-sm shadow-sky-500/30">
              <FolderArchive className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-sky-950 tabular-nums whitespace-nowrap">
            {periodStats.totalCases}{' '}
            <span className="text-xs font-bold text-sky-800/70">เคส</span>
          </div>
          <MarqueeText className="text-[10.5px] text-slate-600 tabular-nums">
            รอผล {periodStats.pendingCount} · อนุมัติ {periodStats.approvedTotalCount}
          </MarqueeText>
        </div>

        <div className="glass-panel-teal dashboard-card-lift rounded-2xl p-3 sm:p-3.5 space-y-1.5 relative overflow-hidden">
          <div
            className="pointer-events-none inset-x-4 top-0 absolute h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-95"
            aria-hidden="true"
          />
          <div className="flex items-center justify-between gap-2">
            <MarqueeText className="text-[11px] font-bold text-teal-900/80">
              รับรถแล้ว
            </MarqueeText>
            <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white border border-white/60 flex items-center justify-center shrink-0 shadow-sm shadow-teal-500/30">
              <PackageCheck className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-teal-900 tabular-nums whitespace-nowrap">
            {periodStats.deliveredCount}{' '}
            <span className="text-xs font-bold text-teal-800/70">คัน</span>
          </div>
          <MarqueeText className="text-[10.5px] text-slate-600 tabular-nums">
            รอรับรถ {periodStats.approvedPendingDeliveryCount} · อนุมัติ{' '}
            {periodStats.approvalRate.toFixed(0)}%
          </MarqueeText>
        </div>

        <div className="glass-panel-indigo dashboard-card-lift rounded-2xl p-3 sm:p-3.5 space-y-1.5 relative overflow-hidden">
          <div
            className="pointer-events-none inset-x-4 top-0 absolute h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-95"
            aria-hidden="true"
          />
          <div className="flex items-center justify-between gap-2">
            <MarqueeText className="text-[11px] font-bold text-indigo-900/80">
              ยอดจัดไฟแนนซ์รวม
            </MarqueeText>
            <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white border border-white/60 flex items-center justify-center shrink-0 shadow-sm shadow-indigo-500/30">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
          </div>
          <MarqueeText className="text-lg sm:text-xl font-black text-indigo-950 tabular-nums">
            {formatBaht(Math.round(periodStats.totalFinance))}
          </MarqueeText>
          <MarqueeText className="text-[10.5px] text-slate-600 tabular-nums">
            เฉลี่ย {formatBaht(Math.round(periodStats.avgFinance))}/เคส
          </MarqueeText>
        </div>

        <div className="glass-panel-amber dashboard-card-lift rounded-2xl p-3 sm:p-3.5 space-y-1.5 relative overflow-hidden">
          <div
            className="pointer-events-none inset-x-4 top-0 absolute h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-95"
            aria-hidden="true"
          />
          <div className="flex items-center justify-between gap-2">
            <MarqueeText className="text-[11px] font-bold text-amber-900/85">
              ค่าคอมประกัน PA
            </MarqueeText>
            <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white border border-white/60 flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/30">
              <Award className="w-3.5 h-3.5" />
            </span>
          </div>
          <MarqueeText className="text-lg sm:text-xl font-black text-amber-900 tabular-nums">
            {formatBaht(commissionSummary.totalCommissionBaht)}
          </MarqueeText>
          <MarqueeText className="text-[10.5px] text-slate-600 tabular-nums">
            Tier {commissionSummary.tier} · {commissionSummary.achievementPercent.toFixed(1)}% (
            {commissionSummary.totalInsuredContracts}/{commissionSummary.totalDeliveredContracts})
          </MarqueeText>
        </div>
      </section>

      {/* Monthly Cases Recharts Dashboard */}
      <MonthlyCasesDashboard
        refreshTrigger={refreshTrigger}
        onOpenSavedCases={onOpenSavedCases}
        onGoToCalculate={onNavigateToCaseForm}
      />

      {/* 2-Column Analytics: Checker Commission Summary + Deal Pipeline & Dealers + Gasoline Allowance */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Card A: Checker Insurance Commission Summary */}
        <div className="order-1 glass-card-primary rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between space-y-3 relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-90"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none -right-10 -top-10 absolute w-36 h-36 rounded-full bg-amber-300/25 blur-2xl"
            aria-hidden="true"
          />

          <div className="relative space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 border border-white/60 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/25">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <MarqueeText className="text-xs sm:text-sm font-black text-slate-900">
                    ยอดสรุปค่าคอมประกัน Checker
                  </MarqueeText>
                  <MarqueeText className="text-[10.5px] text-slate-500">
                    {formatMonthLabel(selectedMonth)} · เฉพาะเคสอนุมัติและรับรถแล้ว
                  </MarqueeText>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  onNavigateToCheckerCommission();
                }}
                className="px-2.5 py-1 rounded-lg bg-white/55 hover:bg-white/80 backdrop-blur-md border border-white/85 text-[11px] font-bold text-sky-700 hover:text-sky-900 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer shadow-2xs transition-colors"
              >
                <span>ตารางเต็ม</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {commissionSummary.totalDeliveredContracts === 0 ? (
              <div className="py-6 px-3 rounded-xl glass-panel-amber text-center space-y-1">
                <p className="text-xs font-bold text-amber-950">
                  ยังไม่มีเคสที่ "อนุมัติและรับรถแล้ว" ในงวดนี้
                </p>
                <p className="text-[11px] text-slate-600">
                  ระบบจะคำนวณยอดค่าคอมประกันและระดับ Tier ให้อัตโนมัติเมื่อมีการอัปเดตสถานะรับรถ
                </p>
              </div>
            ) : (
              <>
                {/* Main Commission & Tier Progress */}
                <div className="glass-panel-amber rounded-xl p-3 space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10.5px] font-semibold text-amber-950/75 block whitespace-nowrap">
                        ค่าคอมมิชชั่นที่คาดว่าจะได้รับ
                      </span>
                      <span className="text-2xl font-black text-amber-950 tabular-nums whitespace-nowrap">
                        {formatBaht(commissionSummary.totalCommissionBaht)}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`inline-block text-[11px] font-extrabold px-2 py-0.5 rounded-lg border whitespace-nowrap ${
                          commissionSummary.tier === 3
                            ? 'bg-emerald-50/85 text-emerald-800 border-emerald-300/80'
                            : commissionSummary.tier === 2
                            ? 'bg-sky-50/85 text-sky-800 border-sky-200/80'
                            : 'bg-white/75 text-amber-800 border-amber-300/80'
                        }`}
                      >
                        {commissionSummary.tierRule.label}
                      </span>
                      <div className="text-[11px] font-bold text-slate-700 tabular-nums mt-0.5 whitespace-nowrap">
                        Achievement {commissionSummary.achievementPercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  {/* Achievement Progress Bar with Tier thresholds */}
                  <div className="space-y-1 pt-0.5">
                    <div className="relative py-1">
                      <div className="relative h-2.5 w-full rounded-full bg-white/75 border border-white/95 shadow-inner overflow-hidden">
                        <div
                          className={`h-full rounded-full animate-fuel-shimmer transition-all duration-500 ease-out ${
                            commissionSummary.tier === 3
                              ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400'
                              : commissionSummary.tier === 2
                              ? 'bg-gradient-to-r from-sky-500 via-cyan-500 to-sky-400'
                              : 'bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500'
                          }`}
                          style={{ width: `${paTierProgress}%` }}
                        />
                      </div>
                      {/* Threshold divider ticks at 60% & 75% */}
                      <span
                        className="pointer-events-none absolute top-1 h-2.5 w-0.5 bg-slate-400/55 rounded-full"
                        style={{ left: '60%' }}
                        aria-hidden="true"
                      />
                      <span
                        className="pointer-events-none absolute top-1 h-2.5 w-0.5 bg-slate-400/55 rounded-full"
                        style={{ left: '75%' }}
                        aria-hidden="true"
                      />
                      {/* Glowing Active Tip Dot */}
                      {paTierProgress > 0 && (
                        <div
                          className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-500 ease-out z-10"
                          style={{ left: `${Math.min(98.5, Math.max(1.5, paTierProgress))}%` }}
                        >
                          <span
                            className={`absolute inset-0 w-3.5 h-3.5 -m-[3px] rounded-full animate-fuel-tip-ping ${
                              commissionSummary.tier === 3
                                ? 'bg-emerald-400'
                                : commissionSummary.tier === 2
                                ? 'bg-sky-400'
                                : 'bg-orange-400'
                            }`}
                          />
                          <span className="block w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-800 shadow-sm" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[9.5px] text-slate-600 tabular-nums whitespace-nowrap">
                      <span>0% (Tier 1)</span>
                      <span>60.01% (Tier 2)</span>
                      <span>75.01%+ (Tier 3)</span>
                    </div>
                  </div>
                </div>

                {/* PA Breakdown Grid */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="glass-panel-blue dashboard-card-lift p-2.5 rounded-xl min-w-0">
                    <MarqueeText className="text-[10px] font-semibold text-sky-900/80">
                      PA ปกติ
                    </MarqueeText>
                    <div className="text-base font-black text-sky-800 tabular-nums mt-0.5 whitespace-nowrap">
                      {commissionSummary.paCount}
                    </div>
                    <div className="text-[9.5px] text-slate-600 tabular-nums whitespace-nowrap">
                      {formatBaht(
                        commissionSummary.breakdown.pa[1].total +
                          commissionSummary.breakdown.pa[2].total +
                          commissionSummary.breakdown.pa[3].total
                      )}
                    </div>
                  </div>
                  <div className="glass-panel-amber dashboard-card-lift p-2.5 rounded-xl min-w-0">
                    <MarqueeText className="text-[10px] font-semibold text-amber-900/80">
                      PA Plus
                    </MarqueeText>
                    <div className="text-base font-black text-amber-800 tabular-nums mt-0.5 whitespace-nowrap">
                      {commissionSummary.paPlusCount}
                    </div>
                    <div className="text-[9.5px] text-slate-600 tabular-nums whitespace-nowrap">
                      {formatBaht(
                        commissionSummary.breakdown.pa_plus[1].total +
                          commissionSummary.breakdown.pa_plus[2].total +
                          commissionSummary.breakdown.pa_plus[3].total
                      )}
                    </div>
                  </div>
                  <div className="glass-mini-card dashboard-card-lift p-2.5 rounded-xl min-w-0">
                    <MarqueeText className="text-[10px] font-semibold text-slate-600">
                      ไม่ทำประกัน
                    </MarqueeText>
                    <div className="text-base font-black text-slate-700 tabular-nums mt-0.5 whitespace-nowrap">
                      {commissionSummary.totalNoInsuranceContracts}
                    </div>
                    <MarqueeText className="text-[9.5px] text-slate-500 tabular-nums">
                      รวม {commissionSummary.totalDeliveredContracts} สัญญา
                    </MarqueeText>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Tier Advice Footer */}
          {commissionSummary.totalDeliveredContracts > 0 && (
            <div className="relative pt-2 border-t border-white/75 text-[11px] min-w-0">
              {commissionSummary.nextTierNeeded ? (
                <MarqueeText className="text-amber-800 font-semibold">
                  ขาย PA เพิ่มอีก{' '}
                  <strong className="tabular-nums">
                    {commissionSummary.nextTierNeeded.additionalInsuredNeeded}
                  </strong>{' '}
                  คัน เพื่อขึ้น Tier {commissionSummary.nextTierNeeded.nextTier} (เพิ่ม{' '}
                  <strong className="tabular-nums text-emerald-700">
                    +{formatBaht(commissionSummary.nextTierNeeded.potentialCommissionIncrease)}
                  </strong>
                  )
                </MarqueeText>
              ) : (
                <MarqueeText className="text-emerald-700 font-semibold">
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>บรรลุเป้าหมาย Tier 3 สูงสุดเรียบร้อย</span>
                  </span>
                </MarqueeText>
              )}
            </div>
          )}
        </div>

        {/* Card A-2: Gasoline Allowance (ค่าน้ำมัน) right after Checker Commission */}
        <GasolineAllowanceCard
          className="order-2 lg:order-3 lg:col-span-2"
          actualContractCount={commissionSummary.totalDeliveredContracts}
          periodLabel={formatMonthLabel(selectedMonth)}
          onOpenSavedCases={onOpenSavedCases}
        />

        {/* Card B: Deal Pipeline, Top Dealers & First Installment Overview */}
        <div className="order-3 lg:order-2 glass-card-primary rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between space-y-3 relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-90"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none -right-10 -top-10 absolute w-36 h-36 rounded-full bg-teal-300/25 blur-2xl"
            aria-hidden="true"
          />

          {/* Pipeline Status Breakdown */}
          <div className="relative space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 border border-white/60 text-white flex items-center justify-center shrink-0 shadow-sm shadow-teal-500/25">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <MarqueeText className="text-xs sm:text-sm font-black text-slate-900">
                  สัดส่วนสถานะดีล & ร้านตัวแทน
                </MarqueeText>
              </div>
              <span className="text-[10.5px] text-teal-900 font-bold tabular-nums whitespace-nowrap shrink-0 px-2 py-0.5 rounded-lg bg-teal-50/75 backdrop-blur-sm border border-white/85">
                {periodStats.totalCases} รายการ
              </span>
            </div>

            <div className="glass-mini-card rounded-xl p-2.5 sm:p-3 space-y-2 text-[11px]">
              {[
                {
                  label: 'รับรถแล้ว',
                  count: periodStats.deliveredCount,
                  barColor: 'bg-gradient-to-r from-teal-500 to-emerald-500',
                  tipGlow: 'bg-emerald-400',
                  textColor: 'text-teal-800',
                },
                {
                  label: 'อนุมัติแล้ว (รอรับรถ)',
                  count: periodStats.approvedPendingDeliveryCount,
                  barColor: 'bg-gradient-to-r from-emerald-500 to-green-400',
                  tipGlow: 'bg-emerald-400',
                  textColor: 'text-emerald-800',
                },
                {
                  label: 'รออนุมัติ',
                  count: periodStats.pendingCount,
                  barColor: 'bg-gradient-to-r from-sky-500 to-cyan-400',
                  tipGlow: 'bg-sky-400',
                  textColor: 'text-sky-800',
                },
                {
                  label: 'ไม่อนุมัติ / ยกเลิก',
                  count: periodStats.rejectedOrCancelledCount,
                  barColor: 'bg-gradient-to-r from-slate-400 to-slate-500',
                  tipGlow: 'bg-slate-400',
                  textColor: 'text-slate-600',
                },
              ].map((row) => {
                const pct =
                  periodStats.totalCases > 0 ? (row.count / periodStats.totalCases) * 100 : 0;
                return (
                  <div key={row.label} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <MarqueeText className={`font-semibold ${row.textColor}`}>
                        {row.label}
                      </MarqueeText>
                      <span className="font-bold text-slate-800 tabular-nums whitespace-nowrap shrink-0">
                        {row.count} เคส ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="relative py-0.5">
                      <div className="h-2 w-full bg-white/75 border border-white/95 shadow-inner rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${row.barColor} ${
                            pct > 0 ? 'animate-fuel-shimmer' : ''
                          } transition-all duration-500 ease-out`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {pct > 0 && (
                        <div
                          className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-500 ease-out z-10"
                          style={{ left: `${Math.min(98.5, Math.max(1.5, pct))}%` }}
                        >
                          <span
                            className={`absolute inset-0 w-3 h-3 -m-[2.5px] rounded-full ${row.tipGlow} animate-fuel-tip-ping`}
                          />
                          <span className="block w-2 h-2 rounded-full bg-white border-[1.5px] border-slate-800 shadow-sm" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Dealers in Selected Period */}
          <div className="relative pt-2 border-t border-white/75 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 min-w-0">
              <Building2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <MarqueeText>สรุปตามร้านตัวแทน (Top Dealers)</MarqueeText>
            </div>

            {topDealers.length === 0 ? (
              <p className="text-[11px] text-slate-500 py-1">ยังไม่มีข้อมูลร้านตัวแทนในงวดนี้</p>
            ) : (
              <div className="divide-y divide-white/80 text-[11px]">
                {topDealers.map((d) => (
                  <div
                    key={d.name}
                    className="py-1.5 px-1.5 -mx-1.5 rounded-lg hover:bg-sky-50/55 transition-colors flex items-center justify-between gap-2"
                  >
                    <MarqueeText className="font-semibold text-slate-800 flex-1 min-w-0">
                      {d.name}
                    </MarqueeText>
                    <div className="flex items-center gap-1.5 shrink-0 tabular-nums text-slate-600 whitespace-nowrap">
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
          <div className="relative glass-panel-indigo rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <CalendarClock className="w-4 h-4 text-blue-600 shrink-0" />
              <div className="min-w-0 flex-1">
                {upcomingInstallmentSummary?.latestCohort ? (
                  <MarqueeText className="text-slate-700">
                    งวดแรก{' '}
                    <strong className="text-sky-950">
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
                  </MarqueeText>
                ) : (
                  <MarqueeText className="text-slate-600">
                    ติดตามค่างวดชำระทุกวันที่ 2 ของเดือน
                  </MarqueeText>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onNavigateToInstallments();
              }}
              className="text-blue-700 hover:text-sky-900 font-bold whitespace-nowrap shrink-0 flex items-center gap-0.5 cursor-pointer"
            >
              <span>เช็คค่างวด</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </section>

      {/* Recent Deals Table with Unified Status Column */}
      <section className="glass-card-primary rounded-2xl overflow-hidden relative">
        <div
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-90"
          aria-hidden="true"
        />
        <div className="px-3.5 sm:px-4 py-3 border-b border-white/75 flex items-center justify-between gap-2.5 bg-gradient-to-r from-sky-100/35 via-transparent to-cyan-100/35">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 border border-white/60 text-white flex items-center justify-center shrink-0 shadow-sm shadow-sky-500/25">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <MarqueeText className="text-xs sm:text-sm font-black text-slate-900">
                รายการเคสล่าสุด ({formatMonthLabel(selectedMonth)})
              </MarqueeText>
              <MarqueeText className="text-[10.5px] text-slate-500">
                แตะที่รายการเพื่อโหลดข้อมูลค่างวด หรือกดเปิดดูตารางเคสทั้งหมดเพื่ออัปเดตสถานะ
              </MarqueeText>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              onOpenSavedCases();
            }}
            className="px-2.5 py-1 rounded-lg bg-white/75 hover:bg-sky-50 border border-white/90 text-[11px] font-bold text-sky-700 hover:text-sky-900 flex items-center gap-0.5 whitespace-nowrap shrink-0 cursor-pointer shadow-2xs transition-colors"
          >
            <span>ดูทั้งหมด</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentCases.length === 0 ? (
          <div className="p-6 text-center space-y-1.5 bg-gradient-to-b from-white/30 to-sky-50/35">
            <p className="text-xs font-bold text-slate-700">ยังไม่มีรายการเคสในงวดที่เลือก</p>
            <p className="text-[11px] text-slate-500">
              กด "คำนวณ / บันทึกเคสใหม่" เพื่อเริ่มต้นสร้างดีลหรือเลือกดู "ทุกช่วงเวลา"
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse min-w-[540px]">
              <thead>
                <tr className="bg-sky-50/60 border-b border-white/80 text-[10.5px] font-extrabold text-slate-600">
                  <th className="py-2 px-3.5 whitespace-nowrap">ชื่อลูกค้า / รุ่นรถ</th>
                  <th className="py-2 px-2.5 whitespace-nowrap">สถานะ</th>
                  <th className="py-2 px-2.5 text-right whitespace-nowrap">ค่างวด / งวด</th>
                  <th className="py-2 px-3.5 text-right whitespace-nowrap">วันที่บันทึก</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/75 text-[11px]">
                {recentCases.map((c) => {
                  const status = getUnifiedStatus(c);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => {
                        triggerHaptic('light');
                        onLoadCase(c);
                      }}
                      className="hover:bg-sky-50/65 transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 px-3.5 max-w-[230px]">
                        <MarqueeText className="font-bold text-slate-900">
                          {c.customerName?.trim() || c.caseTitle || 'คุณลูกค้า'}
                        </MarqueeText>
                        <MarqueeText className="text-[10px] text-slate-500 mt-0.5">
                          {c.bikeModelName || c.snapshot?.proposalCode || '-'}
                          {c.dealerName ? ` · ${c.dealerName}` : ''}
                        </MarqueeText>
                      </td>
                      <td className="py-2.5 px-2.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10.5px] font-bold whitespace-nowrap ${status.className}`}
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

      {/* Quick Tools Grid (Vibrant Jewel-Icon Crystal Glass Cards) */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            onNavigateToPeriodClosing();
          }}
          className="group glass-panel-blue dashboard-card-lift p-3 sm:p-3.5 rounded-2xl text-left cursor-pointer space-y-1.5 relative overflow-hidden min-w-0"
        >
          <div
            className="pointer-events-none inset-x-4 top-0 absolute h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-95"
            aria-hidden="true"
          />
          <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white border border-white/60 flex items-center justify-center shadow-sm shadow-sky-500/25 transition-transform duration-200 group-hover:scale-105 group-hover:-translate-y-0.5">
            <CalendarDays className="w-3.5 h-3.5" />
          </span>
          <MarqueeText className="text-xs font-extrabold text-sky-950">
            ปิดยอด 1-15 / สิ้นเดือน
          </MarqueeText>
          <MarqueeText className="text-[10px] text-slate-600">
            สรุปยอด Approve & รับรถ
          </MarqueeText>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            onNavigateToCheckerCommission();
          }}
          className="group glass-panel-amber dashboard-card-lift p-3 sm:p-3.5 rounded-2xl text-left cursor-pointer space-y-1.5 relative overflow-hidden min-w-0"
        >
          <div
            className="pointer-events-none inset-x-4 top-0 absolute h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-95"
            aria-hidden="true"
          />
          <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white border border-white/60 flex items-center justify-center shadow-sm shadow-amber-500/25 transition-transform duration-200 group-hover:scale-105 group-hover:-translate-y-0.5">
            <Award className="w-3.5 h-3.5" />
          </span>
          <MarqueeText className="text-xs font-extrabold text-amber-950">
            คำนวณค่าคอมประกัน
          </MarqueeText>
          <MarqueeText className="text-[10px] text-slate-600">
            รายงาน Tier 1-3 & ส่งไลน์
          </MarqueeText>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            onNavigateToDocuments();
          }}
          className="group glass-panel-teal dashboard-card-lift p-3 sm:p-3.5 rounded-2xl text-left cursor-pointer space-y-1.5 relative overflow-hidden min-w-0"
        >
          <div
            className="pointer-events-none inset-x-4 top-0 absolute h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-95"
            aria-hidden="true"
          />
          <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white border border-white/60 flex items-center justify-center shadow-sm shadow-teal-500/25 transition-transform duration-200 group-hover:scale-105 group-hover:-translate-y-0.5">
            <FileText className="w-3.5 h-3.5" />
          </span>
          <MarqueeText className="text-xs font-extrabold text-teal-950">
            เอกสาร & ขออนุมัติ DV
          </MarqueeText>
          <MarqueeText className="text-[10px] text-slate-600">
            ใบเสนอราคา & แผน PA
          </MarqueeText>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            onNavigateToInstallments();
          }}
          className="group glass-panel-indigo dashboard-card-lift p-3 sm:p-3.5 rounded-2xl text-left cursor-pointer space-y-1.5 relative overflow-hidden min-w-0"
        >
          <div
            className="pointer-events-none inset-x-4 top-0 absolute h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-95"
            aria-hidden="true"
          />
          <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white border border-white/60 flex items-center justify-center shadow-sm shadow-indigo-500/25 transition-transform duration-200 group-hover:scale-105 group-hover:-translate-y-0.5">
            <CalendarClock className="w-3.5 h-3.5" />
          </span>
          <MarqueeText className="text-xs font-extrabold text-indigo-950">
            ติดตามกำหนดชำระ
          </MarqueeText>
          <MarqueeText className="text-[10px] text-slate-600">
            ตารางงวดที่ 1-9 รายเดือน
          </MarqueeText>
        </button>
      </section>
    </div>
  );
};
