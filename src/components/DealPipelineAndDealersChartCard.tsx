import React, { useMemo, useState } from 'react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarClock,
  LayoutList,
  Maximize2,
  Minimize2,
  PieChart as PieChartIcon,
  RotateCcw,
  Search,
  TrendingUp,
  X,
} from 'lucide-react';
import { formatBaht } from '../data/proposals';
import { triggerHaptic } from '../utils/haptics';
import { MarqueeText } from './MarqueeText';

export type DealStatusKey = 'all' | 'delivered' | 'approved_pending' | 'pending' | 'rejected';
type DealerViewMode = 'chart' | 'list';

export interface DealerSummaryItem {
  name: string;
  total: number;
  delivered: number;
  approvedPending: number;
  other: number;
  finance: number;
  deliveredFinance: number;
}

export interface InstallmentCohortSummary {
  isPeriodScoped: boolean;
  totalDeliveredCount: number;
  totalMonthlyInstallment: number;
  cohorts: Array<{
    label: string;
    shortDate: string;
    sortKey: string;
    count: number;
    sumInstallment: number;
  }>;
}

export interface DealPipelineStatsInput {
  totalCases: number;
  deliveredCount: number;
  approvedPendingDeliveryCount: number;
  pendingCount: number;
  rejectedOrCancelledCount: number;
  totalFinance: number;
  deliveredFinance: number;
  approvedPendingFinance: number;
  pendingFinance: number;
  rejectedFinance: number;
  approvalRate: number;
}

interface DealPipelineAndDealersChartCardProps {
  className?: string;
  periodLabel: string;
  stats: DealPipelineStatsInput;
  dealers: DealerSummaryItem[];
  installmentSummary: InstallmentCohortSummary | null;
  onNavigateToInstallments: () => void;
}

interface StatusItemDescriptor {
  key: Exclude<DealStatusKey, 'all'>;
  label: string;
  shortLabel: string;
  count: number;
  finance: number;
  percent: number;
  gradientId: string;
  auraFilterId: string;
  accentHex: string;
  rimHex: string;
  barColor: string;
  tipGlow: string;
  textColor: string;
  activeBgClass: string;
}

interface DonutTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: StatusItemDescriptor }>;
}

const StatusDonutTooltip: React.FC<DonutTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-700/85 shadow-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 min-w-[170px]">
      <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
        <span className="flex items-center gap-1.5 font-extrabold text-slate-900 dark:text-slate-50">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: item.accentHex }}
          />
          <span>{item.shortLabel}</span>
        </span>
        <span className="font-black tabular-nums" style={{ color: item.accentHex }}>
          {item.percent.toFixed(0)}%
        </span>
      </div>
      <div className="pt-1.5 space-y-0.5 text-[11px] tabular-nums">
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-500 dark:text-slate-400">จำนวน</span>
          <span className="font-bold text-slate-900 dark:text-slate-100">{item.count} เคส</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-500 dark:text-slate-400">ยอดจัดรวม</span>
          <span className="font-bold text-sky-800 dark:text-sky-300">{formatBaht(Math.round(item.finance))}</span>
        </div>
      </div>
    </div>
  );
};

function formatShortBaht(val: number): string {
  const n = Math.round(val);
  if (n >= 1_000_000) return `฿${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 100_000) return `฿${(n / 1_000).toFixed(0)}K`;
  return formatBaht(n);
}

export const DealPipelineAndDealersChartCard: React.FC<
  DealPipelineAndDealersChartCardProps
> = React.memo(({
  className = '',
  periodLabel,
  stats,
  dealers,
  installmentSummary,
  onNavigateToInstallments,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<DealStatusKey>('all');
  const [hoveredStatus, setHoveredStatus] = useState<Exclude<DealStatusKey, 'all'> | null>(null);
  const [orbTick, setOrbTick] = useState<number>(0);

  const [dealerViewMode, setDealerViewMode] = useState<DealerViewMode>('chart');
  const [dealerMetricMode, setDealerMetricMode] = useState<'cases' | 'finance'>('cases');
  const [dealerSearchQuery, setDealerSearchQuery] = useState<string>('');
  const [dealerListExpanded, setDealerListExpanded] = useState<boolean>(false);
  const [selectedDealerName, setSelectedDealerName] = useState<string | null>(null);
  const [hoveredDealerName, setHoveredDealerName] = useState<string | null>(null);

  const statusItems: StatusItemDescriptor[] = useMemo(() => {
    const total = stats.totalCases;
    return [
      {
        key: 'delivered',
        label: 'รับรถแล้ว',
        shortLabel: 'รับรถแล้ว',
        count: stats.deliveredCount,
        finance: stats.deliveredFinance,
        percent: total > 0 ? (stats.deliveredCount / total) * 100 : 0,
        gradientId: 'dealGradDelivered',
        auraFilterId: 'dealAuraTeal',
        accentHex: '#0d9488',
        rimHex: '#6ee7b7',
        barColor: 'bg-gradient-to-r from-teal-500 to-emerald-500',
        tipGlow: 'bg-emerald-400',
        textColor: 'text-teal-800 dark:text-teal-300',
        activeBgClass: 'bg-emerald-50/90 border-emerald-200 dark:bg-emerald-950/75 dark:border-emerald-700/75 shadow-xs',
      },
      {
        key: 'approved_pending',
        label: 'อนุมัติแล้ว (รอรับรถ)',
        shortLabel: 'รอรับรถ',
        count: stats.approvedPendingDeliveryCount,
        finance: stats.approvedPendingFinance,
        percent: total > 0 ? (stats.approvedPendingDeliveryCount / total) * 100 : 0,
        gradientId: 'dealGradApprovedPending',
        auraFilterId: 'dealAuraGreen',
        accentHex: '#10b981',
        rimHex: '#a7f3d0',
        barColor: 'bg-gradient-to-r from-emerald-500 to-green-400',
        tipGlow: 'bg-emerald-400',
        textColor: 'text-emerald-800 dark:text-emerald-300',
        activeBgClass: 'bg-teal-50/90 border-teal-200 dark:bg-teal-950/75 dark:border-teal-700/75 shadow-xs',
      },
      {
        key: 'pending',
        label: 'รออนุมัติ',
        shortLabel: 'รออนุมัติ',
        count: stats.pendingCount,
        finance: stats.pendingFinance,
        percent: total > 0 ? (stats.pendingCount / total) * 100 : 0,
        gradientId: 'dealGradPending',
        auraFilterId: 'dealAuraSky',
        accentHex: '#0ea5e9',
        rimHex: '#7dd3fc',
        barColor: 'bg-gradient-to-r from-sky-500 to-cyan-400',
        tipGlow: 'bg-sky-400',
        textColor: 'text-sky-800 dark:text-sky-300',
        activeBgClass: 'bg-sky-50/90 border-sky-200 dark:bg-sky-950/75 dark:border-sky-700/75 shadow-xs',
      },
      {
        key: 'rejected',
        label: 'ไม่อนุมัติ / ยกเลิก',
        shortLabel: 'ไม่ผ่าน/ยกเลิก',
        count: stats.rejectedOrCancelledCount,
        finance: stats.rejectedFinance,
        percent: total > 0 ? (stats.rejectedOrCancelledCount / total) * 100 : 0,
        gradientId: 'dealGradRejected',
        auraFilterId: 'dealAuraSlate',
        accentHex: '#64748b',
        rimHex: '#cbd5e1',
        barColor: 'bg-gradient-to-r from-slate-400 to-slate-500',
        tipGlow: 'bg-slate-400',
        textColor: 'text-slate-600 dark:text-slate-300',
        activeBgClass: 'bg-slate-100/90 border-slate-200 dark:bg-slate-800/85 dark:border-slate-600/80 shadow-xs',
      },
    ];
  }, [stats]);

  const nonZeroSlices = useMemo(
    () => statusItems.filter((item) => item.count > 0),
    [statusItems]
  );

  const effectiveStatus: DealStatusKey = hoveredStatus ?? selectedStatus;
  const activeStatusObj = useMemo(
    () =>
      effectiveStatus === 'all'
        ? null
        : statusItems.find((s) => s.key === effectiveStatus) ?? null,
    [effectiveStatus, statusItems]
  );

  const handleSelectStatus = (key: Exclude<DealStatusKey, 'all'>) => {
    triggerHaptic('selection');
    setOrbTick((t) => t + 1);
    setSelectedStatus((prev) => (prev === key ? 'all' : key));
  };

  const handleCycleStatusOrb = () => {
    triggerHaptic('selection');
    setOrbTick((t) => t + 1);
    const activeKeys: DealStatusKey[] = [
      'all',
      ...nonZeroSlices.map((s) => s.key as DealStatusKey),
    ];
    setSelectedStatus((prev) => {
      const idx = activeKeys.indexOf(prev);
      return activeKeys[(idx + 1) % activeKeys.length] ?? 'all';
    });
  };

  // Dealers sorting, ranking, search filtering & focus selection
  const sortedDealers = useMemo(() => {
    return [...dealers].sort((a, b) => {
      if (dealerMetricMode === 'finance') {
        return b.finance - a.finance || b.total - a.total;
      }
      return b.total - a.total || b.finance - a.finance;
    });
  }, [dealers, dealerMetricMode]);

  const dealerRankMap = useMemo(() => {
    const map = new Map<string, number>();
    sortedDealers.forEach((d, idx) => map.set(d.name, idx + 1));
    return map;
  }, [sortedDealers]);

  const filteredDealers = useMemo(() => {
    const q = dealerSearchQuery.trim().toLowerCase();
    if (!q) return sortedDealers;
    return sortedDealers.filter((d) => d.name.toLowerCase().includes(q));
  }, [sortedDealers, dealerSearchQuery]);

  const focusedDealerName = hoveredDealerName ?? selectedDealerName;
  const focusedDealer = useMemo(() => {
    if (!sortedDealers.length) return null;
    if (focusedDealerName) {
      return sortedDealers.find((d) => d.name === focusedDealerName) ?? sortedDealers[0];
    }
    return sortedDealers[0];
  }, [sortedDealers, focusedDealerName]);

  const focusedDealerRank = focusedDealer ? dealerRankMap.get(focusedDealer.name) ?? 1 : 1;

  const maxDealerCases = useMemo(
    () => Math.max(1, ...sortedDealers.map((d) => d.total)),
    [sortedDealers]
  );

  const maxDealerFinance = useMemo(
    () => Math.max(1, ...sortedDealers.map((d) => d.finance)),
    [sortedDealers]
  );

  return (
    <MotionConfig reducedMotion="user">
      <div
        style={{ contain: 'layout style' }}
        className={`glass-card-primary rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between space-y-3 relative overflow-hidden ${className}`.trim()}
      >
        {/* Top Specular Hairline */}
        <div
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white dark:via-teal-300/35 to-transparent opacity-95"
          aria-hidden="true"
        />

        {/* Lightweight Radial Gradient Aura Orbs with GPU Breathing Pulse */}
        <div
          className="pointer-events-none -right-12 -top-12 absolute w-44 h-44 rounded-full animate-fuel-aura"
          style={{
            background:
              activeStatusObj?.key === 'pending'
                ? 'radial-gradient(circle, rgba(56,189,248,0.32) 0%, rgba(56,189,248,0.09) 45%, transparent 72%)'
                : activeStatusObj?.key === 'rejected'
                ? 'radial-gradient(circle, rgba(148,163,184,0.30) 0%, rgba(148,163,184,0.08) 45%, transparent 72%)'
                : 'radial-gradient(circle, rgba(45,212,191,0.30) 0%, rgba(45,212,191,0.08) 45%, transparent 72%)',
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none -left-12 -bottom-14 absolute w-40 h-40 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(165,180,252,0.22) 0%, rgba(165,180,252,0.06) 45%, transparent 72%)',
          }}
          aria-hidden="true"
        />

        {/* SECTION 1: Deal Pipeline 3D Donut + Interactive Gauges */}
        <div className="relative space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 border border-white/60 dark:border-teal-300/30 text-white flex items-center justify-center shrink-0 shadow-sm shadow-teal-500/25">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-50 truncate">
                  สัดส่วนสถานะดีล & ร้านตัวแทน
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  {periodLabel} · แตะกราฟเพื่อดูรายละเอียด
                </div>
              </div>
            </div>
            <span className="text-[10.5px] text-teal-900 dark:text-teal-200 font-bold tabular-nums whitespace-nowrap shrink-0 px-2 py-0.5 rounded-lg bg-teal-50/90 dark:bg-teal-950/80 border border-white/95 dark:border-teal-700/75 shadow-2xs">
              {stats.totalCases} รายการ
            </span>
          </div>

          {stats.totalCases === 0 ? (
            <div className="glass-inner-surface rounded-xl p-5 text-center space-y-1">
              <PieChartIcon className="w-6 h-6 text-teal-500 dark:text-teal-300 mx-auto opacity-80" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                ยังไม่มีข้อมูลสถานะดีลในงวด {periodLabel}
              </p>
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                บันทึกเคสใหม่เพื่อดูกราฟสัดส่วนสถานะและร้านตัวแทนแบบเรียลไทม์
              </p>
            </div>
          ) : (
            <div className="glass-inner-surface rounded-2xl p-2.5 sm:p-3 space-y-2.5">
              {/* Top Sub-bar + Reset when filtered */}
              <div className="flex items-center justify-between gap-2 text-[10.5px]">
                <span className="font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 min-w-0 truncate">
                  <PieChartIcon className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span className="truncate">
                    {activeStatusObj
                      ? `โฟกัส: ${activeStatusObj.label}`
                      : 'กราฟสัดส่วนสถานะเคส'}
                  </span>
                </span>
                {selectedStatus !== 'all' && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setOrbTick((t) => t + 1);
                      setSelectedStatus('all');
                    }}
                    className="px-2 py-0.5 rounded-lg bg-white/90 dark:bg-slate-800/85 hover:bg-white dark:hover:bg-slate-700 border border-white dark:border-slate-600/80 text-[10px] font-bold text-teal-700 dark:text-teal-300 inline-flex items-center gap-1 cursor-pointer shadow-2xs shrink-0"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>ทั้งหมด</span>
                  </button>
                )}
              </div>

              {/* Donut + 4 Gauge Rows Responsive Split */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-2.5 items-center">
                {/* 3D Donut Chart Stage */}
                <div className="xl:col-span-5 relative h-[156px] w-full flex items-center justify-center chart-gpu-layer">
                  <ResponsiveContainer width="100%" height="100%" debounce={120}>
                    <PieChart accessibilityLayer={false}>
                      <defs>
                        <linearGradient id="dealGradDelivered" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#34d399" />
                          <stop offset="100%" stopColor="#0d9488" />
                        </linearGradient>
                        <linearGradient id="dealGradApprovedPending" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#4ade80" />
                          <stop offset="100%" stopColor="#059669" />
                        </linearGradient>
                        <linearGradient id="dealGradPending" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#38bdf8" />
                          <stop offset="100%" stopColor="#0284c7" />
                        </linearGradient>
                        <linearGradient id="dealGradRejected" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#94a3b8" />
                          <stop offset="100%" stopColor="#475569" />
                        </linearGradient>
                        <filter id="dealAuraTeal" x="-30%" y="-30%" width="160%" height="160%">
                          <feDropShadow
                            dx="0"
                            dy="0"
                            stdDeviation="4.5"
                            floodColor="#10b981"
                            floodOpacity="0.68"
                          />
                        </filter>
                        <filter id="dealAuraGreen" x="-30%" y="-30%" width="160%" height="160%">
                          <feDropShadow
                            dx="0"
                            dy="0"
                            stdDeviation="4.5"
                            floodColor="#22c55e"
                            floodOpacity="0.65"
                          />
                        </filter>
                        <filter id="dealAuraSky" x="-30%" y="-30%" width="160%" height="160%">
                          <feDropShadow
                            dx="0"
                            dy="0"
                            stdDeviation="4.5"
                            floodColor="#0ea5e9"
                            floodOpacity="0.68"
                          />
                        </filter>
                        <filter id="dealAuraSlate" x="-30%" y="-30%" width="160%" height="160%">
                          <feDropShadow
                            dx="0"
                            dy="0"
                            stdDeviation="4.5"
                            floodColor="#64748b"
                            floodOpacity="0.6"
                          />
                        </filter>
                      </defs>

                      <Pie
                        data={nonZeroSlices}
                        dataKey="count"
                        nameKey="shortLabel"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={67}
                        paddingAngle={nonZeroSlices.length > 1 ? 4 : 0}
                        cornerRadius={7}
                        startAngle={90}
                        endAngle={-270}
                        animationDuration={650}
                        onClick={(entry) => {
                          const raw = entry as unknown as {
                            key?: Exclude<DealStatusKey, 'all'>;
                            payload?: StatusItemDescriptor;
                          };
                          const statusKey = raw?.payload?.key ?? raw?.key;
                          if (statusKey) handleSelectStatus(statusKey);
                        }}
                        className="cursor-pointer"
                      >
                        {nonZeroSlices.map((slice) => {
                          const isFocused =
                            effectiveStatus === 'all' || effectiveStatus === slice.key;
                          const isPinned = effectiveStatus === slice.key;
                          return (
                            <Cell
                              key={slice.key}
                              fill={`url(#${slice.gradientId})`}
                              fillOpacity={isFocused ? 1 : 0.28}
                              stroke={isPinned ? slice.rimHex : 'rgba(255,255,255,0.9)'}
                              strokeWidth={isPinned ? 2.2 : 1.3}
                              filter={isPinned ? `url(#${slice.auraFilterId})` : undefined}
                              style={{
                                transition: 'fill-opacity 200ms ease',
                                cursor: 'pointer',
                                outline: 'none',
                              }}
                            />
                          );
                        })}
                      </Pie>

                      <Tooltip
                        wrapperStyle={{ pointerEvents: 'none', zIndex: 30 }}
                        content={<StatusDonutTooltip />}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Center Crystal Medallion Orb */}
                  <button
                    type="button"
                    onClick={handleCycleStatusOrb}
                    title="แตะเพื่อสลับดูแต่ละสถานะ"
                    aria-label="ศูนย์กลางกราฟสถานะดีล แตะเพื่อสลับสถานะ"
                    className="group absolute w-[76px] h-[76px] rounded-full flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 animate-kpi-float z-10"
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -inset-[2.5px] rounded-full opacity-80 animate-kpi-orbit"
                      style={{
                        background: activeStatusObj
                          ? `conic-gradient(from 0deg, ${activeStatusObj.accentHex}55, transparent 42%, ${activeStatusObj.accentHex}99 75%, transparent)`
                          : 'conic-gradient(from 0deg, rgba(16,185,129,0.5), rgba(14,165,233,0.45), rgba(100,116,139,0.35), rgba(16,185,129,0.5))',
                      }}
                    />
                    <span className="relative w-full h-full rounded-full bg-gradient-to-b from-white/98 via-white/94 to-teal-50/92 dark:from-slate-800 dark:via-slate-900 dark:to-teal-950/90 border-2 border-white dark:border-slate-600/80 shadow-[0_8px_20px_-6px_rgba(13,148,136,0.28),inset_0_2px_5px_rgba(255,255,255,1)] dark:shadow-[0_10px_24px_-6px_rgba(2,6,23,0.75),inset_0_2px_5px_rgba(255,255,255,0.08)] flex flex-col items-center justify-center px-1 text-center transition-transform duration-200 group-hover:scale-[1.04] group-active:scale-95">
                      <div
                        key={`${effectiveStatus}-${orbTick}`}
                        className="flex flex-col items-center justify-center animate-number-tick"
                      >
                        <span className="text-[8.5px] font-bold text-slate-500 dark:text-slate-400 leading-tight max-w-[64px] truncate">
                          {activeStatusObj ? activeStatusObj.shortLabel : 'รวมทั้งหมด'}
                        </span>
                        <span
                          className={`text-sm font-black tabular-nums leading-tight mt-0.5 ${
                            activeStatusObj ? activeStatusObj.textColor : 'text-teal-900 dark:text-teal-200'
                          }`}
                        >
                          {activeStatusObj ? `${activeStatusObj.count} เคส` : `${stats.totalCases} เคส`}
                        </span>
                        <span className="text-[8.5px] font-extrabold tabular-nums text-slate-600 dark:text-slate-300 mt-0.5">
                          {activeStatusObj
                            ? `${activeStatusObj.percent.toFixed(0)}%`
                            : `อนุมัติ ${stats.approvalRate.toFixed(0)}%`}
                        </span>
                      </div>
                    </span>
                  </button>
                </div>

                {/* Interactive Status Gauge Bars */}
                <div className="xl:col-span-7 space-y-1.5 text-[11px]">
                  {statusItems.map((row) => {
                    const isPinned = effectiveStatus === row.key;
                    const isDimmed = effectiveStatus !== 'all' && !isPinned;
                    return (
                      <button
                        key={row.key}
                        type="button"
                        onClick={() => handleSelectStatus(row.key)}
                        onMouseEnter={() => setHoveredStatus(row.key)}
                        onMouseLeave={() => setHoveredStatus(null)}
                        aria-pressed={selectedStatus === row.key}
                        className={`w-full text-left rounded-xl px-2 py-1.5 border transition-colors duration-150 cursor-pointer space-y-1 ${
                          isPinned
                            ? row.activeBgClass
                            : isDimmed
                            ? 'border-transparent opacity-55 hover:opacity-95'
                            : 'border-transparent hover:bg-white/65 dark:hover:bg-slate-800/65'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`font-bold flex items-center gap-1.5 min-w-0 ${row.textColor}`}>
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: row.accentHex }}
                            />
                            <span className="truncate">{row.label}</span>
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-100 tabular-nums whitespace-nowrap shrink-0">
                            {row.count} เคส ({row.percent.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="relative py-0.5">
                          <div className="h-1.5 w-full bg-white/85 dark:bg-slate-800/90 border border-white dark:border-slate-700/80 shadow-inner rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${row.barColor} ${
                                row.percent > 0 ? 'animate-fuel-shimmer' : ''
                              } transition-[width] duration-500 ease-out`}
                              style={{ width: `${row.percent}%` }}
                            />
                          </div>
                          {row.percent > 0 && (
                            <div
                              className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-[left] duration-500 ease-out z-10"
                              style={{ left: `${Math.min(98.5, Math.max(1.5, row.percent))}%` }}
                            >
                              <span
                                className={`absolute inset-0 w-2.5 h-2.5 -m-[2px] rounded-full ${row.tipGlow} animate-fuel-tip-ping`}
                              />
                              <span className="block w-1.5 h-1.5 rounded-full bg-white border-[1.5px] border-slate-800 shadow-xs" />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Animated Focused Status Finance Detail Strip */}
              <AnimatePresence mode="wait">
                {activeStatusObj && (
                  <motion.div
                    key={activeStatusObj.key}
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="rounded-xl bg-white/75 dark:bg-slate-800/85 border border-white dark:border-slate-700/80 px-2.5 py-1.5 flex items-center justify-between gap-2 text-[10.5px] tabular-nums shadow-2xs"
                  >
                    <span className={`font-bold ${activeStatusObj.textColor}`}>
                      {activeStatusObj.label}: {activeStatusObj.count} เคส (
                      {activeStatusObj.percent.toFixed(1)}%)
                    </span>
                    <span className="font-extrabold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      ยอดจัด {formatBaht(Math.round(activeStatusObj.finance))}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* SECTION 2: Futuristic Bounded Dealers Chart & Telemetry Pod */}
        <div className="relative pt-2.5 border-t border-white/75 dark:border-slate-700/75 space-y-2.5">
          {/* Header + Metric & View Switchers */}
          <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-800 dark:text-slate-100 min-w-0">
              <Building2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
              <span className="truncate">สรุปตามร้านตัวแทน ({dealers.length} ร้าน)</span>
            </div>

            {dealers.length > 0 && (
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                {/* Metric Scale Switcher: Cases vs Finance */}
                <div
                  role="group"
                  aria-label="เรียงและเทียบสัดส่วนร้านตาม"
                  className="flex items-center gap-0.5 p-0.5 rounded-lg bg-white/80 dark:bg-slate-800/85 border border-white dark:border-slate-700/80 shadow-2xs"
                >
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setDealerMetricMode('cases');
                    }}
                    aria-pressed={dealerMetricMode === 'cases'}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                      dealerMetricMode === 'cases'
                        ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    เคส
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setDealerMetricMode('finance');
                    }}
                    aria-pressed={dealerMetricMode === 'finance'}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                      dealerMetricMode === 'finance'
                        ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    ยอดจัด
                  </button>
                </div>

                {/* Chart vs List Toggle */}
                <div
                  role="group"
                  aria-label="มุมมองข้อมูลร้านตัวแทน"
                  className="flex items-center gap-0.5 p-0.5 rounded-lg bg-white/80 dark:bg-slate-800/85 border border-white dark:border-slate-700/80 shadow-2xs"
                >
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setDealerViewMode('chart');
                    }}
                    aria-pressed={dealerViewMode === 'chart'}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
                      dealerViewMode === 'chart'
                        ? 'bg-gradient-to-r from-sky-500 to-teal-500 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <BarChart3 className="w-2.5 h-2.5" />
                    <span>กราฟ 3D</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setDealerViewMode('list');
                    }}
                    aria-pressed={dealerViewMode === 'list'}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
                      dealerViewMode === 'list'
                        ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <LayoutList className="w-2.5 h-2.5" />
                    <span>รายการ</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {dealers.length === 0 ? (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 py-1">
              ยังไม่มีข้อมูลร้านตัวแทนในงวดนี้
            </p>
          ) : (
            <AnimatePresence mode="wait">
              {dealerViewMode === 'chart' ? (
                <motion.div
                  key="dealer-chart"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-2.5"
                >
                  <div className="glass-inner-surface rounded-2xl p-2.5 space-y-2.5">
                    {/* Panoramic Market Share Spectrum Strip */}
                    {(() => {
                      const totalSpectrum =
                        dealerMetricMode === 'finance'
                          ? Math.max(1, sortedDealers.reduce((sum, d) => sum + d.finance, 0))
                          : Math.max(1, sortedDealers.reduce((sum, d) => sum + d.total, 0));
                      const spectrumGradients = [
                        'from-teal-500 via-emerald-400 to-cyan-400',
                        'from-sky-500 to-indigo-500',
                        'from-indigo-500 to-violet-500',
                        'from-cyan-500 to-sky-400',
                        'from-amber-400 to-orange-500',
                        'from-emerald-500 to-lime-400',
                        'from-fuchsia-500 to-pink-500',
                        'from-slate-400 to-slate-500',
                      ];

                      return (
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
                            <span className="font-bold text-slate-600 dark:text-slate-300 truncate max-w-full">
                              สัดส่วนรวม
                              {focusedDealer && (
                                <span className="ml-1 font-extrabold text-sky-700 dark:text-sky-300 tabular-nums">
                                  · {focusedDealer.name}{' '}
                                  {(
                                    ((dealerMetricMode === 'finance'
                                      ? focusedDealer.finance
                                      : focusedDealer.total) /
                                      totalSpectrum) *
                                    100
                                  ).toFixed(1)}
                                  %
                                </span>
                              )}
                            </span>
                            <div className="flex items-center gap-2 text-[9.5px] text-slate-500 dark:text-slate-400 shrink-0">
                              <span className="inline-flex items-center gap-1 font-semibold">
                                <span className="w-2 h-2 rounded-full bg-gradient-to-r from-teal-500 to-emerald-400" />
                                <span>รับรถ</span>
                              </span>
                              <span className="inline-flex items-center gap-1 font-semibold">
                                <span className="w-2 h-2 rounded-full bg-gradient-to-r from-emerald-400 to-lime-300" />
                                <span>รอรับ</span>
                              </span>
                              <span className="inline-flex items-center gap-1 font-semibold">
                                <span className="w-2 h-2 rounded-full bg-slate-400" />
                                <span>อื่นๆ</span>
                              </span>
                            </div>
                          </div>

                          <div
                            className="relative h-3 w-full rounded-full bg-slate-200/80 dark:bg-slate-900/85 p-0.5 shadow-[inset_0_1px_2px_rgba(15,23,42,0.16)] flex items-center gap-0.5 overflow-hidden"
                            role="group"
                            aria-label="แถบสัดส่วนรวมตามร้านตัวแทน"
                          >
                            {sortedDealers.map((d, idx) => {
                              const val = dealerMetricMode === 'finance' ? d.finance : d.total;
                              const sharePct = (val / totalSpectrum) * 100;
                              if (sharePct <= 0) return null;
                              const isActive = focusedDealer?.name === d.name && Boolean(focusedDealerName);
                              const isDimmed = Boolean(focusedDealerName && !isActive);
                              const grad = spectrumGradients[idx % spectrumGradients.length];
                              return (
                                <button
                                  key={`mob-spec-${d.name}`}
                                  type="button"
                                  title={`${d.name} · ${sharePct.toFixed(1)}%`}
                                  onClick={() => {
                                    triggerHaptic('selection');
                                    setSelectedDealerName((prev) => (prev === d.name ? null : d.name));
                                  }}
                                  style={{ width: `${Math.max(sharePct, 1.8)}%` }}
                                  className={`relative h-full rounded-full bg-gradient-to-r ${grad} transition-all duration-200 cursor-pointer overflow-hidden ${
                                    isActive
                                      ? 'brightness-110 ring-1 ring-white dark:ring-sky-300 shadow-[0_0_8px_rgba(14,165,233,0.45)]'
                                      : isDimmed
                                        ? 'opacity-35'
                                        : 'opacity-90 hover:opacity-100'
                                  }`}
                                >
                                  <span
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-x-0 top-0 h-[45%] bg-gradient-to-b from-white/45 to-transparent"
                                  />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Search & Expand Controls when many dealers */}
                    {(sortedDealers.length > 5 || selectedDealerName || dealerSearchQuery) && (
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        {sortedDealers.length > 5 ? (
                          <div className="relative flex-1 min-w-[140px]">
                            <Search className="w-3 h-3 text-slate-400 pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={dealerSearchQuery}
                              onChange={(e) => setDealerSearchQuery(e.target.value)}
                              placeholder={`ค้นหาร้าน (${sortedDealers.length})...`}
                              aria-label="ค้นหาร้านตัวแทน"
                              className="w-full pl-7 pr-6 py-1 rounded-xl bg-white/90 dark:bg-slate-900/75 border border-slate-200/80 dark:border-slate-700/80 text-[11px] font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
                            />
                            {dealerSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setDealerSearchQuery('')}
                                aria-label="ล้างคำค้นหาร้าน"
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div />
                        )}

                        <div className="flex items-center gap-1.5 shrink-0">
                          {selectedDealerName && (
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic('light');
                                setSelectedDealerName(null);
                                setHoveredDealerName(null);
                              }}
                              className="px-2 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/70 border border-sky-200/80 dark:border-sky-700/70 text-[10px] text-sky-700 dark:text-sky-300 font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              <span>ล้างที่เลือก</span>
                            </button>
                          )}

                          {filteredDealers.length > 5 && (
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic('light');
                                setDealerListExpanded((prev) => !prev);
                              }}
                              className="px-2 py-1 rounded-lg bg-white/90 dark:bg-slate-900/75 border border-slate-200/80 dark:border-slate-700/80 text-[10px] text-slate-600 dark:text-slate-300 font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                            >
                              {dealerListExpanded ? (
                                <>
                                  <Minimize2 className="w-2.5 h-2.5" />
                                  <span>ย่อกรอบ</span>
                                </>
                              ) : (
                                <>
                                  <Maximize2 className="w-2.5 h-2.5" />
                                  <span>กางครบ {filteredDealers.length}</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Bounded-Height 3D Luminous Bar Viewport */}
                    <div className="relative chart-gpu-layer">
                      {/* Aligned Vertical Dashed Gridlines (left-2 .. right-[76px]) */}
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute top-0 bottom-0 left-2 right-[76px] z-0"
                      >
                        {[0, 25, 50, 75, 100].map((posPct) => (
                          <div
                            key={posPct}
                            className="absolute top-0 bottom-0 border-l border-dashed border-slate-300/65 dark:border-slate-700/65"
                            style={{ left: `${posPct}%` }}
                          />
                        ))}
                      </div>

                      <div
                        className={`relative z-10 space-y-1.5 ${
                          dealerListExpanded
                            ? ''
                            : 'max-h-[252px] overflow-y-auto overscroll-contain tsd-slim-scroll pr-0.5'
                        }`}
                      >
                        {filteredDealers.length === 0 ? (
                          <div className="py-8 text-center text-[11px] text-slate-500 dark:text-slate-400">
                            ไม่พบร้านที่ตรงกับ &ldquo;{dealerSearchQuery}&rdquo;
                          </div>
                        ) : (
                          filteredDealers.map((d, idx) => {
                            const rank = dealerRankMap.get(d.name) ?? idx + 1;
                            const isPinned = selectedDealerName === d.name;
                            const isActive = focusedDealerName === d.name;
                            const isDimmed = Boolean(focusedDealerName && !isActive);

                            const primaryRatio =
                              dealerMetricMode === 'finance'
                                ? d.finance / maxDealerFinance
                                : d.total / maxDealerCases;
                            const barTrackPct = Math.min(
                              100,
                              Math.max(d.total > 0 ? 5 : 0, primaryRatio * 100)
                            );

                            const delShare =
                              dealerMetricMode === 'finance'
                                ? d.finance > 0
                                  ? (d.deliveredFinance / d.finance) * 100
                                  : 0
                                : d.total > 0
                                  ? (d.delivered / d.total) * 100
                                  : 0;
                            const nonDelShare = Math.max(0, 100 - delShare);
                            const pendPartRatio =
                              d.total - d.delivered > 0
                                ? d.approvedPending / (d.total - d.delivered)
                                : 0;
                            const pendShare =
                              dealerMetricMode === 'finance'
                                ? nonDelShare * pendPartRatio
                                : d.total > 0
                                  ? (d.approvedPending / d.total) * 100
                                  : 0;
                            const otherShare = Math.max(0, 100 - delShare - pendShare);

                            const rankBadgeClass =
                              rank === 1
                                ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-2xs shadow-amber-500/30'
                                : rank === 2
                                  ? 'bg-gradient-to-br from-sky-400 to-indigo-500 text-white shadow-2xs shadow-sky-500/25'
                                  : rank === 3
                                    ? 'bg-gradient-to-br from-teal-400 to-emerald-500 text-white shadow-2xs shadow-teal-500/25'
                                    : 'bg-slate-200/90 dark:bg-slate-700/85 text-slate-600 dark:text-slate-300';

                            return (
                              <button
                                key={d.name}
                                type="button"
                                onClick={() => {
                                  triggerHaptic('selection');
                                  setSelectedDealerName((prev) => (prev === d.name ? null : d.name));
                                }}
                                onMouseEnter={() => setHoveredDealerName(d.name)}
                                onMouseLeave={() => setHoveredDealerName(null)}
                                aria-pressed={isPinned}
                                className={`group w-full min-h-[44px] text-left rounded-xl px-2 py-1.5 border transition-all duration-150 cursor-pointer space-y-1 ${
                                  isActive
                                    ? 'bg-white/95 dark:bg-slate-800/95 border-sky-300/95 dark:border-sky-500/80 shadow-xs'
                                    : isDimmed
                                      ? 'border-transparent opacity-50 hover:opacity-95'
                                      : 'border-transparent hover:bg-white/75 dark:hover:bg-slate-800/60'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <span
                                      className={`w-4 h-4 rounded-md text-[9.5px] font-black tabular-nums flex items-center justify-center shrink-0 ${rankBadgeClass}`}
                                    >
                                      {rank}
                                    </span>
                                    <MarqueeText className="text-[11px] font-bold text-slate-800 dark:text-slate-100 flex-1 min-w-0">
                                      {d.name}
                                    </MarqueeText>
                                  </div>
                                  <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap shrink-0">
                                    รับรถ{' '}
                                    <strong className="text-teal-700 dark:text-teal-300">
                                      {d.delivered}
                                    </strong>
                                    /{d.total} ·{' '}
                                    <strong className="text-sky-800 dark:text-sky-300">
                                      {dealerMetricMode === 'finance'
                                        ? `${d.total} เคส`
                                        : formatShortBaht(d.finance)}
                                    </strong>
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 w-full">
                                  <div className="flex-1 h-3 rounded-full bg-slate-200/75 dark:bg-slate-900/80 shadow-[inset_0_1px_2px_rgba(15,23,42,0.14)] overflow-hidden p-[1px]">
                                    <div
                                      style={{
                                        width: `${barTrackPct}%`,
                                        animationDelay: `${Math.min(idx, 10) * 35}ms`,
                                      }}
                                      className={`animate-dealer-bar-grow relative h-full rounded-full overflow-hidden flex transition-[box-shadow,filter] duration-200 ${
                                        isActive
                                          ? 'shadow-[0_0_10px_rgba(14,165,233,0.45)] brightness-105'
                                          : ''
                                      }`}
                                    >
                                      {delShare > 0 && (
                                        <div
                                          style={{ width: `${delShare}%` }}
                                          className="h-full bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-400"
                                        />
                                      )}
                                      {pendShare > 0 && (
                                        <div
                                          style={{ width: `${pendShare}%` }}
                                          className="h-full bg-gradient-to-r from-emerald-400 to-lime-300"
                                        />
                                      )}
                                      {otherShare > 0 && (
                                        <div
                                          style={{ width: `${otherShare}%` }}
                                          className="h-full bg-gradient-to-r from-slate-400 to-slate-500"
                                        />
                                      )}
                                      <span
                                        aria-hidden="true"
                                        className="pointer-events-none absolute inset-x-0 top-0 h-[48%] bg-gradient-to-b from-white/45 to-transparent"
                                      />
                                      <span
                                        aria-hidden="true"
                                        className={`dealer-bar-sheen pointer-events-none absolute inset-y-0 left-0 w-9 bg-gradient-to-r from-transparent via-white/55 to-transparent -translate-x-full ${
                                          isActive ? 'dealer-bar-sheen-active' : ''
                                        }`}
                                      />
                                    </div>
                                  </div>

                                  <span className="w-[60px] text-right text-[10.5px] font-black tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0">
                                    {dealerMetricMode === 'finance'
                                      ? formatShortBaht(d.finance)
                                      : `${d.total} เคส`}
                                  </span>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Pinned X-Axis Scale Footer aligned to Bar Tracks */}
                    <div className="pt-1 border-t border-white/80 dark:border-slate-700/70 space-y-1">
                      <div className="relative ml-2 mr-[76px] h-3.5 text-[9.5px] font-bold text-slate-400 dark:text-slate-500 tabular-nums select-none">
                        <span className="absolute left-0">0</span>
                        <span className="absolute -translate-x-1/2" style={{ left: '50%' }}>
                          {dealerMetricMode === 'finance'
                            ? formatShortBaht(maxDealerFinance / 2)
                            : Math.round(maxDealerCases / 2)}
                        </span>
                        <span className="absolute right-0">
                          {dealerMetricMode === 'finance'
                            ? formatShortBaht(maxDealerFinance)
                            : `${maxDealerCases} เคส`}
                        </span>
                      </div>

                      {!dealerListExpanded && filteredDealers.length > 5 && (
                        <div className="flex items-center justify-between text-[9.5px] text-slate-500 dark:text-slate-400 px-0.5">
                          <span>เลื่อนในกรอบเพื่อดูครบ {filteredDealers.length} ร้าน</span>
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('light');
                              setDealerListExpanded(true);
                            }}
                            className="font-bold text-sky-700 dark:text-sky-300 hover:underline cursor-pointer"
                          >
                            ขยายดูทั้งหมด →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mobile Compact 3D Radial Spotlight Telemetry Pod */}
                  {focusedDealer &&
                    (() => {
                      const total = Math.max(1, focusedDealer.total);
                      const delPct = (focusedDealer.delivered / total) * 100;
                      const pendPct = (focusedDealer.approvedPending / total) * 100;
                      const otherPct = Math.max(0, 100 - delPct - pendPct);
                      const ringR = 32;
                      const ringC = 2 * Math.PI * ringR;
                      const delLen = (delPct / 100) * ringC;
                      const pendLen = (pendPct / 100) * ringC;
                      const otherLen = (otherPct / 100) * ringC;
                      const avgFinancePerCase = Math.round(focusedDealer.finance / total);
                      const caseSharePct =
                        stats.totalCases > 0 ? (focusedDealer.total / stats.totalCases) * 100 : 0;
                      const financeSharePct =
                        stats.totalFinance > 0
                          ? (focusedDealer.finance / stats.totalFinance) * 100
                          : 0;

                      return (
                        <div className="rounded-2xl bg-gradient-to-br from-sky-50/95 via-white/95 to-teal-50/90 dark:from-sky-950/70 dark:via-slate-900/95 dark:to-teal-950/60 border border-sky-200/85 dark:border-sky-700/75 p-3 space-y-2.5 shadow-xs">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-[9.5px] font-bold text-sky-700 dark:text-sky-300 block">
                                อันดับ #{focusedDealerRank} ·{' '}
                                {focusedDealerName ? 'ร้านที่เลือกดู' : 'ผลงานสูงสุด'}
                              </span>
                              <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                                {focusedDealer.name}
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-lg bg-gradient-to-r from-sky-600 to-teal-600 text-white text-[10.5px] font-black tabular-nums shrink-0 shadow-2xs">
                              {focusedDealer.total} เคส
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            {/* SVG Radial Ring */}
                            <div className="relative w-[76px] h-[76px] shrink-0 flex items-center justify-center">
                              <svg
                                viewBox="0 0 88 88"
                                className="w-full h-full -rotate-90 overflow-visible"
                              >
                                <defs>
                                  <linearGradient
                                    id="mobDealerRingDel"
                                    x1="0%"
                                    y1="0%"
                                    x2="100%"
                                    y2="100%"
                                  >
                                    <stop offset="0%" stopColor="#14b8a6" />
                                    <stop offset="100%" stopColor="#22d3ee" />
                                  </linearGradient>
                                  <linearGradient
                                    id="mobDealerRingPend"
                                    x1="0%"
                                    y1="0%"
                                    x2="100%"
                                    y2="100%"
                                  >
                                    <stop offset="0%" stopColor="#34d399" />
                                    <stop offset="100%" stopColor="#a3e635" />
                                  </linearGradient>
                                </defs>
                                <circle
                                  cx={44}
                                  cy={44}
                                  r={ringR}
                                  fill="none"
                                  stroke="currentColor"
                                  className="text-slate-200/80 dark:text-slate-800"
                                  strokeWidth={8}
                                />
                                {otherLen > 0 && (
                                  <circle
                                    cx={44}
                                    cy={44}
                                    r={ringR}
                                    fill="none"
                                    stroke="#94a3b8"
                                    strokeWidth={8}
                                    strokeLinecap="round"
                                    strokeDasharray={`${otherLen} ${ringC}`}
                                    strokeDashoffset={-(delLen + pendLen)}
                                    style={{
                                      transition:
                                        'stroke-dasharray 450ms cubic-bezier(0.16, 1, 0.3, 1), stroke-dashoffset 450ms cubic-bezier(0.16, 1, 0.3, 1)',
                                    }}
                                  />
                                )}
                                {pendLen > 0 && (
                                  <circle
                                    cx={44}
                                    cy={44}
                                    r={ringR}
                                    fill="none"
                                    stroke="url(#mobDealerRingPend)"
                                    strokeWidth={8}
                                    strokeLinecap="round"
                                    strokeDasharray={`${pendLen} ${ringC}`}
                                    strokeDashoffset={-delLen}
                                    style={{
                                      transition:
                                        'stroke-dasharray 450ms cubic-bezier(0.16, 1, 0.3, 1), stroke-dashoffset 450ms cubic-bezier(0.16, 1, 0.3, 1)',
                                    }}
                                  />
                                )}
                                {delLen > 0 && (
                                  <circle
                                    cx={44}
                                    cy={44}
                                    r={ringR}
                                    fill="none"
                                    stroke="url(#mobDealerRingDel)"
                                    strokeWidth={8.5}
                                    strokeLinecap="round"
                                    strokeDasharray={`${delLen} ${ringC}`}
                                    strokeDashoffset={0}
                                    style={{
                                      transition:
                                        'stroke-dasharray 450ms cubic-bezier(0.16, 1, 0.3, 1)',
                                    }}
                                  />
                                )}
                              </svg>
                              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                                <span className="text-[13.5px] font-black text-slate-900 dark:text-white tabular-nums leading-none">
                                  {delPct.toFixed(0)}%
                                </span>
                                <span className="text-[8.5px] font-bold text-teal-700 dark:text-teal-300 mt-0.5">
                                  รับรถ
                                </span>
                              </div>
                            </div>

                            {/* Compact Status & Finance Grid */}
                            <div className="flex-1 min-w-0 space-y-1 text-[10.5px] tabular-nums">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-500 dark:text-slate-400">
                                  รับรถ · รอรับ · อื่นๆ
                                </span>
                                <span className="font-black">
                                  <span className="text-teal-700 dark:text-teal-300">
                                    {focusedDealer.delivered}
                                  </span>
                                  <span className="text-slate-400 mx-0.5">/</span>
                                  <span className="text-emerald-700 dark:text-emerald-300">
                                    {focusedDealer.approvedPending}
                                  </span>
                                  <span className="text-slate-400 mx-0.5">/</span>
                                  <span className="text-slate-600 dark:text-slate-300">
                                    {focusedDealer.other}
                                  </span>
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-500 dark:text-slate-400">ยอดจัดรวม</span>
                                <span className="font-black text-indigo-800 dark:text-sky-300">
                                  {formatBaht(Math.round(focusedDealer.finance))}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-500 dark:text-slate-400">
                                  รับรถแล้ว · เฉลี่ย/เคส
                                </span>
                                <span className="font-bold text-teal-700 dark:text-teal-300">
                                  {formatShortBaht(focusedDealer.deliveredFinance)} ·{' '}
                                  {formatShortBaht(avgFinancePerCase)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-500 dark:text-slate-400">
                                  สัดส่วนเคส · ยอดจัด
                                </span>
                                <span className="font-bold text-slate-800 dark:text-slate-100">
                                  {caseSharePct.toFixed(1)}% · {financeSharePct.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                </motion.div>
              ) : (
                <motion.div
                  key="dealer-list"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="max-h-[300px] overflow-y-auto overscroll-contain tsd-slim-scroll rounded-2xl border border-white/80 dark:border-slate-700/75 divide-y divide-white/80 dark:divide-slate-800/80 bg-white/45 dark:bg-slate-900/45 text-[11px]"
                >
                  {sortedDealers.map((d, idx) => {
                    const delRate = d.total > 0 ? (d.delivered / d.total) * 100 : 0;
                    return (
                      <button
                        key={d.name}
                        type="button"
                        onClick={() => {
                          triggerHaptic('selection');
                          setSelectedDealerName(d.name);
                          setDealerViewMode('chart');
                        }}
                        className="w-full min-h-[44px] py-2 px-2.5 hover:bg-sky-50/75 dark:hover:bg-slate-800/60 transition-colors flex items-center justify-between gap-2 text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="w-4 h-4 rounded-md bg-slate-200/85 dark:bg-slate-700 text-[9.5px] font-black text-slate-600 dark:text-slate-200 flex items-center justify-center shrink-0 tabular-nums">
                            {idx + 1}
                          </span>
                          <MarqueeText className="font-semibold text-slate-800 dark:text-slate-100 flex-1 min-w-0">
                            {d.name}
                          </MarqueeText>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          <span>
                            <strong className="text-slate-900 dark:text-white">{d.total}</strong>{' '}
                            เคส ({delRate.toFixed(0)}%)
                          </span>
                          <span className="text-slate-300 dark:text-slate-600">·</span>
                          <span className="font-bold text-sky-800 dark:text-sky-300">
                            {formatShortBaht(d.finance)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Total Reconciliation Footer */}
          {dealers.length > 0 && (
            <div className="pt-1 border-t border-white/85 dark:border-slate-700/75 flex items-center justify-between gap-2 text-[10.5px] tabular-nums text-slate-600 dark:text-slate-300">
              <span className="font-bold text-slate-700 dark:text-slate-200">
                รวมทุกร้าน ({dealers.length} ร้าน)
              </span>
              <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap font-bold">
                <span className="text-slate-800 dark:text-slate-100">
                  {stats.totalCases} เคส (รับรถ {stats.deliveredCount})
                </span>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <span className="text-indigo-800 dark:text-indigo-300">
                  {formatBaht(Math.round(stats.totalFinance))}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 3: Upcoming First Payment Cohort Banner */}
        <div className="relative glass-inner-indigo rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-[11px]">
          <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
            <CalendarClock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5 sm:mt-0" />
            <div className="min-w-0 flex-1 leading-snug">
              {installmentSummary ? (
                <>
                  <div className="text-slate-800 dark:text-slate-100 font-semibold tabular-nums flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <span>งวดแรก:</span>
                    {installmentSummary.cohorts.map((cohort, idx) => (
                      <span key={cohort.sortKey} className="inline-flex items-center gap-1">
                        {idx > 0 && <span className="text-slate-400 dark:text-slate-500">·</span>}
                        <strong className="text-sky-950 dark:text-sky-100">{cohort.label}</strong>
                        <span className="text-slate-600 dark:text-slate-300">({cohort.count})</span>
                      </span>
                    ))}
                  </div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-300 tabular-nums mt-0.5">
                    {installmentSummary.isPeriodScoped
                      ? `รับรถงวดนี้ ${installmentSummary.totalDeliveredCount} ราย`
                      : `ทั้งหมด ${installmentSummary.totalDeliveredCount} ราย`}{' '}
                    · รวมค่างวด{' '}
                    <strong className="text-indigo-900 dark:text-indigo-200">
                      {formatBaht(Math.round(installmentSummary.totalMonthlyInstallment))}
                    </strong>
                    /ด.
                  </div>
                </>
              ) : (
                <span className="text-slate-600 dark:text-slate-300">ติดตามค่างวดชำระทุกวันที่ 2 ของเดือน</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onNavigateToInstallments();
            }}
            className="text-blue-700 dark:text-blue-300 hover:text-sky-900 dark:hover:text-sky-200 font-bold whitespace-nowrap shrink-0 flex items-center gap-0.5 cursor-pointer"
          >
            <span>เช็คค่างวด</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </MotionConfig>
  );
});
