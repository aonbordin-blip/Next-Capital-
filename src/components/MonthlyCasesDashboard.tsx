import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import { BarChart3, FolderOpen } from 'lucide-react';
import { SavedCaseRecord } from '../types';
import { getSavedCases } from '../utils/savedCasesStorage';
import { formatBaht } from '../data/proposals';
import { triggerHaptic } from '../utils/haptics';
import { MarqueeText } from './MarqueeText';

interface MonthlyCasesDashboardProps {
  refreshTrigger?: number;
  onOpenSavedCases?: () => void;
  onGoToCalculate?: () => void;
}

type ChartMode = 'total' | 'status';
type MonthScope = 'all_12' | 'active_only';

interface MonthlyBucketDatum {
  key: string; // YYYY-MM
  year: number;
  thaiYear: number;
  monthIndex: number; // 1..12
  shortLabel: string; // ม.ค. or ต.ค. 69
  fullLabel: string; // ตุลาคม 2569
  total: number;
  delivered: number;
  approvedPendingDelivery: number;
  pending: number;
  closedOther: number;
  totalFinance: number;
}

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

function extractBangkokYearMonth(createdAtMs: number): { year: number; month: number } {
  const ts = Number.isFinite(createdAtMs) && createdAtMs > 0 ? createdAtMs : Date.now();
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(new Date(ts));
    const y = Number(parts.find((p) => p.type === 'year')?.value);
    const m = Number(parts.find((p) => p.type === 'month')?.value);
    if (Number.isFinite(y) && y > 1900 && Number.isFinite(m) && m >= 1 && m <= 12) {
      return { year: y, month: m };
    }
  } catch {
    // Fallback to UTC+7 offset calculation
  }
  const bkk = new Date(ts + 7 * 60 * 60 * 1000);
  return {
    year: bkk.getUTCFullYear(),
    month: bkk.getUTCMonth() + 1,
  };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: MonthlyBucketDatum }>;
}

const MonthlyChartTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0]?.payload;
  if (!datum) return null;

  return (
    <div className="rounded-xl bg-white border border-slate-200 shadow-lg px-3 py-2.5 text-xs text-slate-800 min-w-[190px]">
      <div className="font-bold text-slate-900 pb-1.5 border-b border-slate-100 flex items-center justify-between gap-3">
        <span>{datum.fullLabel}</span>
        <span className="font-mono tabular-nums text-sky-700 font-extrabold">
          {datum.total} เคส
        </span>
      </div>
      <div className="pt-1.5 space-y-1 text-[11px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-emerald-700 font-medium">รับรถแล้ว</span>
          <span className="font-mono tabular-nums font-semibold text-slate-900">
            {datum.delivered}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sky-700 font-medium">อนุมัติ (รอรับรถ)</span>
          <span className="font-mono tabular-nums font-semibold text-slate-900">
            {datum.approvedPendingDelivery}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-amber-700 font-medium">รอผล / บันทึกไว้</span>
          <span className="font-mono tabular-nums font-semibold text-slate-900">
            {datum.pending}
          </span>
        </div>
        {datum.closedOther > 0 && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500 font-medium">ไม่อนุมัติ / ยกเลิก</span>
            <span className="font-mono tabular-nums font-semibold text-slate-700">
              {datum.closedOther}
            </span>
          </div>
        )}
        <div className="pt-1 mt-1 border-t border-slate-100 flex items-center justify-between gap-3">
          <span className="text-slate-500">ยอดจัดรวม</span>
          <span className="font-mono tabular-nums font-bold text-slate-900">
            {formatBaht(Math.round(datum.totalFinance))} บ.
          </span>
        </div>
      </div>
    </div>
  );
};

export const MonthlyCasesDashboard: React.FC<MonthlyCasesDashboardProps> = ({
  refreshTrigger,
  onOpenSavedCases,
  onGoToCalculate,
}) => {
  const [savedCases, setSavedCases] = useState<SavedCaseRecord[]>(() => getSavedCases());
  const [chartMode, setChartMode] = useState<ChartMode>('total');
  const [monthScope, setMonthScope] = useState<MonthScope>('all_12');
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

  useEffect(() => {
    setSavedCases(getSavedCases());
  }, [refreshTrigger]);

  useEffect(() => {
    const handleSync = () => {
      setSavedCases(getSavedCases());
    };
    window.addEventListener('ncap-cases-synced', handleSync);
    return () => window.removeEventListener('ncap-cases-synced', handleSync);
  }, []);

  // Aggregate cases by (year, month) in Asia/Bangkok
  const { availableYears, monthlyMap } = useMemo(() => {
    const map = new Map<string, MonthlyBucketDatum>();
    const yearsSet = new Set<number>();

    for (const c of savedCases) {
      const { year, month } = extractBangkokYearMonth(c.createdAt);
      yearsSet.add(year);
      const key = `${year}-${String(month).padStart(2, '0')}`;
      const thaiYear = year + 543;
      const thaiYearShort = String(thaiYear).slice(-2);

      let bucket = map.get(key);
      if (!bucket) {
        bucket = {
          key,
          year,
          thaiYear,
          monthIndex: month,
          shortLabel: `${THAI_MONTH_SHORTS[month - 1]} ${thaiYearShort}`,
          fullLabel: `${THAI_MONTH_NAMES[month - 1]} ${thaiYear}`,
          total: 0,
          delivered: 0,
          approvedPendingDelivery: 0,
          pending: 0,
          closedOther: 0,
          totalFinance: 0,
        };
        map.set(key, bucket);
      }

      bucket.total += 1;
      bucket.totalFinance += Number(c.snapshot?.financeAmount) || 0;

      if (c.approvalStatus === 'approved') {
        if (c.deliveryStatus === 'delivered') {
          bucket.delivered += 1;
        } else {
          bucket.approvedPendingDelivery += 1;
        }
      } else if (c.approvalStatus === 'rejected' || c.approvalStatus === 'cancelled') {
        bucket.closedOther += 1;
      } else {
        bucket.pending += 1;
      }
    }

    const years = Array.from(yearsSet).sort((a, b) => b - a);
    return { availableYears: years, monthlyMap: map };
  }, [savedCases]);

  // Auto-select the most recent year when available
  const activeYear: number | 'all' = useMemo(() => {
    if (availableYears.length === 0) return 'all';
    if (selectedYear === 'all') {
      return availableYears[0];
    }
    if (availableYears.includes(selectedYear)) {
      return selectedYear;
    }
    return availableYears[0];
  }, [availableYears, selectedYear]);

  const isMultiYearAll = selectedYear === 'all' && availableYears.length > 1;
  const effectiveYearFilter: number | 'all' =
    selectedYear === 'all' && availableYears.length <= 1
      ? availableYears[0] ?? 'all'
      : selectedYear === 'all'
      ? availableYears[0]
      : activeYear;

  const chartData = useMemo<MonthlyBucketDatum[]>(() => {
    if (savedCases.length === 0) return [];

    if (isMultiYearAll || effectiveYearFilter === 'all') {
      return Array.from(monthlyMap.values()).sort((a, b) => a.key.localeCompare(b.key));
    }

    const year = effectiveYearFilter;
    const thaiYear = year + 543;
    const result: MonthlyBucketDatum[] = [];

    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}`;
      const existing = monthlyMap.get(key);
      if (existing) {
        result.push({
          ...existing,
          shortLabel: THAI_MONTH_SHORTS[m - 1],
        });
      } else if (monthScope === 'all_12') {
        result.push({
          key,
          year,
          thaiYear,
          monthIndex: m,
          shortLabel: THAI_MONTH_SHORTS[m - 1],
          fullLabel: `${THAI_MONTH_NAMES[m - 1]} ${thaiYear}`,
          total: 0,
          delivered: 0,
          approvedPendingDelivery: 0,
          pending: 0,
          closedOther: 0,
          totalFinance: 0,
        });
      }
    }

    return result;
  }, [savedCases.length, isMultiYearAll, effectiveYearFilter, monthlyMap, monthScope]);

  // Summary KPIs for the currently displayed scope
  const summaryStats = useMemo(() => {
    const activeMonths = chartData.filter((d) => d.total > 0);
    const totalCases = chartData.reduce((sum, d) => sum + d.total, 0);
    const totalDelivered = chartData.reduce((sum, d) => sum + d.delivered, 0);
    const totalApproved = chartData.reduce(
      (sum, d) => sum + d.delivered + d.approvedPendingDelivery,
      0
    );
    const totalFinance = chartData.reduce((sum, d) => sum + d.totalFinance, 0);
    const avgPerActiveMonth =
      activeMonths.length > 0 ? totalCases / activeMonths.length : 0;

    let peakBucket: MonthlyBucketDatum | null = null;
    for (const d of activeMonths) {
      if (!peakBucket || d.total > peakBucket.total) {
        peakBucket = d;
      }
    }

    return {
      totalCases,
      activeMonthCount: activeMonths.length,
      avgPerActiveMonth,
      peakBucket,
      totalApproved,
      totalDelivered,
      totalFinance,
    };
  }, [chartData]);

  const selectedBucket = useMemo(() => {
    if (!selectedMonthKey) return null;
    return chartData.find((d) => d.key === selectedMonthKey) ?? null;
  }, [chartData, selectedMonthKey]);

  const handleBarClick = (_data: unknown, index: number) => {
    const clicked = chartData[index];
    if (!clicked) return;
    triggerHaptic('light');
    setSelectedMonthKey((prev) => (prev === clicked.key ? null : clicked.key));
  };

  return (
    <section
      data-card-id="monthly_dashboard"
      className="glass-card-primary rounded-2xl p-3.5 sm:p-5 space-y-3.5 sm:space-y-4 relative overflow-hidden"
    >
      <div
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-90"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none -right-12 -top-12 absolute w-40 h-40 rounded-full bg-sky-200/30 blur-2xl"
        aria-hidden="true"
      />

      {/* Header Row */}
      <div className="relative flex items-start sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-sky-100/95 to-cyan-50/90 border border-sky-200/80 text-sky-700 flex items-center justify-center shrink-0 shadow-xs">
            <BarChart3 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <MarqueeText className="text-[13.5px] sm:text-base font-black text-slate-900 tracking-tight">
              Dashboard สรุปจำนวนเคสรายเดือน
            </MarqueeText>
            <MarqueeText className="text-[11px] sm:text-xs text-slate-500 mt-0.5 tabular-nums">
              สถิติเคสที่บันทึกไว้แยกตามเดือน
              {typeof effectiveYearFilter === 'number'
                ? ` · ปี พ.ศ. ${effectiveYearFilter + 543}`
                : ''}
              {` · ทั้งหมดในเครื่อง ${savedCases.length} เคส`}
            </MarqueeText>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap justify-end">
          {availableYears.length > 1 && (
            <div className="flex items-center gap-1 p-1 bg-sky-100/55 border border-white/80 rounded-xl">
              {availableYears.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setSelectedYear(y);
                    setSelectedMonthKey(null);
                  }}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                    effectiveYearFilter === y
                      ? 'bg-white text-sky-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {y + 543}
                </button>
              ))}
            </div>
          )}

          {onOpenSavedCases && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onOpenSavedCases();
              }}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/80 hover:bg-sky-50/90 text-sky-800 border border-sky-200/80 shadow-2xs text-[11px] sm:text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-all hover:-translate-y-0.5 active:scale-[0.98]"
            >
              <FolderOpen className="w-3.5 h-3.5 shrink-0 text-sky-600" />
              <span>เปิดคลังเคส</span>
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {savedCases.length === 0 ? (
        <div className="relative rounded-2xl bg-gradient-to-br from-sky-50/75 via-white/80 to-cyan-50/65 border border-white/90 shadow-inner px-4 py-6 text-center space-y-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-100 to-cyan-50 border border-sky-200/75 text-sky-600 flex items-center justify-center mx-auto shadow-xs">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <div className="text-sm font-bold text-slate-800">ยังไม่มีข้อมูลเคสสำหรับแสดงกราฟ</div>
            <p className="text-xs text-slate-500 leading-relaxed">
              เมื่อบันทึกเคสลูกค้าหรือซิงค์ข้อมูลจาก Cloud กราฟสรุปจำนวนเคสรายเดือนและยอดอนุมัติจะแสดงที่นี่โดยอัตโนมัติ
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
            {onGoToCalculate && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  onGoToCalculate();
                }}
                className="btn-fluid-primary px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer"
              >
                คำนวณและบันทึกเคสแรก
              </button>
            )}
            {onOpenSavedCases && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  onOpenSavedCases();
                }}
                className="glass-pill px-4 py-2 rounded-xl text-slate-700 text-xs font-bold whitespace-nowrap cursor-pointer transition-all hover:-translate-y-0.5"
              >
                ดูรายการเคส
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* KPI Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
            <div className="glass-mini-card dashboard-card-lift rounded-xl p-2.5 sm:p-3 space-y-0.5 min-w-0">
              <MarqueeText className="text-[10.5px] sm:text-[11px] font-medium text-slate-500">
                จำนวนเคสช่วงนี้
              </MarqueeText>
              <div className="text-base sm:text-xl font-black text-slate-900 font-mono tabular-nums whitespace-nowrap">
                {summaryStats.totalCases}
                <span className="text-[11px] font-semibold text-slate-500 ml-1 font-sans">เคส</span>
              </div>
            </div>

            <div className="glass-mini-card dashboard-card-lift rounded-xl p-2.5 sm:p-3 space-y-0.5 min-w-0">
              <MarqueeText className="text-[10.5px] sm:text-[11px] font-medium text-slate-500">
                เฉลี่ยต่อเดือนที่มีเคส
              </MarqueeText>
              <div className="text-base sm:text-xl font-black text-slate-900 font-mono tabular-nums whitespace-nowrap">
                {summaryStats.avgPerActiveMonth.toFixed(1)}
                <span className="text-[11px] font-semibold text-slate-500 ml-1 font-sans">
                  / ด. ({summaryStats.activeMonthCount})
                </span>
              </div>
            </div>

            <div className="glass-mini-card dashboard-card-lift rounded-xl p-2.5 sm:p-3 space-y-0.5 min-w-0">
              <MarqueeText className="text-[10.5px] sm:text-[11px] font-medium text-slate-500">
                เดือนที่บันทึกสูงสุด
              </MarqueeText>
              <div className="text-base sm:text-xl font-black text-sky-700 font-mono tabular-nums whitespace-nowrap">
                {summaryStats.peakBucket ? (
                  <>
                    <span className="font-sans text-sm sm:text-base font-extrabold mr-1">
                      {summaryStats.peakBucket.shortLabel}
                    </span>
                    ({summaryStats.peakBucket.total})
                  </>
                ) : (
                  '—'
                )}
              </div>
            </div>

            <div className="glass-mini-card dashboard-card-lift rounded-xl p-2.5 sm:p-3 space-y-0.5 min-w-0">
              <MarqueeText className="text-[10.5px] sm:text-[11px] font-medium text-slate-500">
                อนุมัติ / รับรถแล้ว
              </MarqueeText>
              <div className="text-base sm:text-xl font-black text-emerald-700 font-mono tabular-nums whitespace-nowrap">
                {summaryStats.totalApproved}
                <span className="text-slate-400 mx-1">/</span>
                {summaryStats.totalDelivered}
                <span className="text-[11px] font-semibold text-slate-500 ml-1 font-sans">คัน</span>
              </div>
            </div>
          </div>

          {/* Interactive Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/70">
            <div className="flex items-center gap-1 p-1 bg-sky-100/50 border border-white/80 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setChartMode('total');
                }}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  chartMode === 'total'
                    ? 'bg-white text-sky-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                จำนวนเคสรวม
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setChartMode('status');
                }}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  chartMode === 'status'
                    ? 'bg-white text-sky-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                แยกตามสถานะ
              </button>
            </div>

            <div className="flex items-center gap-1 p-1 bg-sky-100/50 border border-white/80 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setMonthScope('all_12');
                }}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  monthScope === 'all_12'
                    ? 'bg-white text-sky-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ครบ 12 เดือน
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setMonthScope('active_only');
                }}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  monthScope === 'active_only'
                    ? 'bg-white text-sky-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                เฉพาะเดือนที่มีเคส
              </button>
            </div>
          </div>

          {/* Inline Legend for Status Breakdown Mode */}
          {chartMode === 'status' && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                <span>รับรถแล้ว</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-sky-600 inline-block" />
                <span>อนุมัติ (รอรับรถ)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
                <span>รอผล / บันทึกไว้</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-slate-400 inline-block" />
                <span>ไม่อนุมัติ / ยกเลิก</span>
              </span>
            </div>
          )}

          {/* Recharts BarChart Viewport */}
          <div className="w-full min-w-0 h-[235px] sm:h-[255px] pt-1 select-none [&_*]:outline-none [&_*]:focus:outline-none [&_svg]:outline-none [&_g]:outline-none [&_path]:outline-none">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                accessibilityLayer={false}
                data={chartData}
                margin={{ top: 20, right: 8, left: -18, bottom: 6 }}
                barCategoryGap={monthScope === 'active_only' ? '26%' : '18%'}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="shortLabel"
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                  interval={0}
                  tick={(tickProps: {
                    x?: number | string;
                    y?: number | string;
                    payload?: { value?: string };
                  }) => {
                    const x = Number(tickProps.x) || 0;
                    const y = Number(tickProps.y) || 0;
                    const label = String(tickProps.payload?.value || '');
                    const isSelectedTick = selectedBucket?.shortLabel === label;
                    return (
                      <g transform={`translate(${x},${y})`}>
                        <text
                          x={0}
                          y={0}
                          dy={12}
                          textAnchor="middle"
                          fill={isSelectedTick ? '#1d4ed8' : '#64748b'}
                          fontSize={11}
                          fontWeight={isSelectedTick ? 800 : 600}
                        >
                          {label}
                        </text>
                        {isSelectedTick && (
                          <rect
                            x={-9}
                            y={16}
                            width={18}
                            height={2.5}
                            rx={1.25}
                            fill="#1d4ed8"
                          />
                        )}
                      </g>
                    );
                  }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(14, 165, 233, 0.06)' }}
                  content={<MonthlyChartTooltip />}
                />

                {chartMode === 'total' ? (
                  <Bar
                    dataKey="total"
                    name="จำนวนเคส"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={42}
                    onClick={(_data, idx) => {
                      const target = chartData[idx];
                      if (!target || target.total === 0) return;
                      handleBarClick(_data, idx);
                    }}
                    className="cursor-pointer"
                  >
                    {chartData.map((entry) => {
                      const hasSelection = selectedBucket !== null;
                      const isSelected = selectedMonthKey === entry.key;
                      const isPeak =
                        summaryStats.peakBucket?.key === entry.key && entry.total > 0;
                      const fillColor =
                        entry.total === 0
                          ? '#e2e8f0'
                          : isSelected
                          ? '#1d4ed8'
                          : isPeak
                          ? '#0284c7'
                          : '#38bdf8';
                      const fillOpacity =
                        entry.total === 0
                          ? 0.7
                          : hasSelection && !isSelected
                          ? 0.28
                          : 1;
                      return (
                        <Cell
                          key={entry.key}
                          fill={fillColor}
                          fillOpacity={fillOpacity}
                          stroke={isSelected ? '#1e3a8a' : 'none'}
                          strokeWidth={isSelected ? 1.5 : 0}
                        />
                      );
                    })}
                    <LabelList
                      dataKey="total"
                      position="top"
                      formatter={(val: unknown) => (Number(val) > 0 ? String(val) : '')}
                      style={{
                        fill: '#0f172a',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    />
                  </Bar>
                ) : (
                  <>
                    <Bar
                      dataKey="delivered"
                      stackId="cases"
                      name="รับรถแล้ว"
                      fill="#059669"
                      maxBarSize={42}
                      onClick={(_data, idx) => {
                        const target = chartData[idx];
                        if (!target || target.total === 0) return;
                        handleBarClick(_data, idx);
                      }}
                      className="cursor-pointer"
                    >
                      {chartData.map((entry) => (
                        <Cell
                          key={entry.key}
                          fill="#059669"
                          fillOpacity={
                            selectedBucket !== null && selectedMonthKey !== entry.key ? 0.25 : 1
                          }
                        />
                      ))}
                    </Bar>
                    <Bar
                      dataKey="approvedPendingDelivery"
                      stackId="cases"
                      name="อนุมัติ (รอรับรถ)"
                      fill="#0284c7"
                      maxBarSize={42}
                      onClick={(_data, idx) => {
                        const target = chartData[idx];
                        if (!target || target.total === 0) return;
                        handleBarClick(_data, idx);
                      }}
                      className="cursor-pointer"
                    >
                      {chartData.map((entry) => (
                        <Cell
                          key={entry.key}
                          fill="#0284c7"
                          fillOpacity={
                            selectedBucket !== null && selectedMonthKey !== entry.key ? 0.25 : 1
                          }
                        />
                      ))}
                    </Bar>
                    <Bar
                      dataKey="pending"
                      stackId="cases"
                      name="รอผล / บันทึกไว้"
                      fill="#f59e0b"
                      maxBarSize={42}
                      onClick={(_data, idx) => {
                        const target = chartData[idx];
                        if (!target || target.total === 0) return;
                        handleBarClick(_data, idx);
                      }}
                      className="cursor-pointer"
                    >
                      {chartData.map((entry) => (
                        <Cell
                          key={entry.key}
                          fill="#f59e0b"
                          fillOpacity={
                            selectedBucket !== null && selectedMonthKey !== entry.key ? 0.25 : 1
                          }
                        />
                      ))}
                    </Bar>
                    <Bar
                      dataKey="closedOther"
                      stackId="cases"
                      name="ไม่อนุมัติ / ยกเลิก"
                      fill="#94a3b8"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={42}
                      onClick={(_data, idx) => {
                        const target = chartData[idx];
                        if (!target || target.total === 0) return;
                        handleBarClick(_data, idx);
                      }}
                      className="cursor-pointer"
                    >
                      {chartData.map((entry) => (
                        <Cell
                          key={entry.key}
                          fill="#94a3b8"
                          fillOpacity={
                            selectedBucket !== null && selectedMonthKey !== entry.key ? 0.25 : 1
                          }
                        />
                      ))}
                    </Bar>
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Selected Month Detail Line or Quiet Interactive Hint */}
          {selectedBucket ? (
            <div className="glass-panel-blue rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0 flex-1">
                <MarqueeText className="text-slate-700 tabular-nums">
                  <strong className="text-sky-900">{selectedBucket.fullLabel}</strong>
                  {' · '}
                  <strong className="font-mono text-slate-900">{selectedBucket.total} เคส</strong>
                  {` · รับรถ ${selectedBucket.delivered} · อนุมัติรอรับ ${selectedBucket.approvedPendingDelivery} · รอผล ${selectedBucket.pending} · ยอดจัด ${formatBaht(Math.round(selectedBucket.totalFinance))} บ.`}
                </MarqueeText>
              </div>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedMonthKey(null);
                }}
                className="text-xs font-bold text-sky-700 hover:text-sky-900 underline cursor-pointer whitespace-nowrap shrink-0"
              >
                ล้างการเลือก
              </button>
            </div>
          ) : (
            <div className="pt-2 border-t border-white/70 text-[11px] sm:text-xs">
              <MarqueeText className="text-slate-500">
                แตะที่แท่งกราฟเพื่อเน้นดูรายละเอียดรายเดือน · ยอดจัดรวมช่วงนี้{' '}
                <strong className="font-mono tabular-nums text-slate-800">
                  {formatBaht(Math.round(summaryStats.totalFinance))} บ.
                </strong>
              </MarqueeText>
            </div>
          )}
        </>
      )}
    </section>
  );
};
