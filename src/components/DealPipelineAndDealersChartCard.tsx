import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  LayoutList,
  PieChart as PieChartIcon,
  RotateCcw,
  TrendingUp,
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

interface DealerTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: DealerSummaryItem }>;
}

const DealerChartTooltip: React.FC<DealerTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-700/85 shadow-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 min-w-[190px] max-w-[240px]">
      <div className="font-extrabold text-slate-900 dark:text-slate-50 pb-1 border-b border-slate-100 dark:border-slate-800 truncate">
        {d.name}
      </div>
      <div className="pt-1.5 space-y-1 text-[11px] tabular-nums">
        <div className="flex items-center justify-between gap-2">
          <span className="text-teal-700 dark:text-teal-300 font-semibold">รับรถแล้ว</span>
          <span className="font-bold text-slate-900 dark:text-slate-100">{d.delivered} เคส</span>
        </div>
        {d.approvedPending > 0 && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-emerald-700 dark:text-emerald-300 font-semibold">อนุมัติ (รอรับรถ)</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">{d.approvedPending} เคส</span>
          </div>
        )}
        {d.other > 0 && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500 dark:text-slate-400 font-semibold">รอผล / อื่นๆ</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">{d.other} เคส</span>
          </div>
        )}
        <div className="pt-1 mt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <span className="text-slate-500 dark:text-slate-400">รวม / ยอดจัด</span>
          <span className="font-extrabold text-sky-800 dark:text-sky-300">
            {d.total} เคส · {formatBaht(Math.round(d.finance))}
          </span>
        </div>
      </div>
    </div>
  );
};

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

function formatShortDealerLabel(name: string): string {
  if (name.length <= 16) return name;
  return `${name.slice(0, 15)}…`;
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
  const [selectedDealerName, setSelectedDealerName] = useState<string | null>(null);
  const [showAllDealers, setShowAllDealers] = useState<boolean>(false);

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

  // Dealers visibility & selection
  const selectedDealer = useMemo(() => {
    if (!dealers.length) return null;
    if (selectedDealerName) {
      return dealers.find((d) => d.name === selectedDealerName) ?? dealers[0];
    }
    return null;
  }, [dealers, selectedDealerName]);

  const needsDealerCollapse = dealers.length > 6;
  const visibleDealers =
    needsDealerCollapse && !showAllDealers ? dealers.slice(0, 5) : dealers;
  const hiddenDealers =
    needsDealerCollapse && !showAllDealers ? dealers.slice(5) : [];

  const hiddenDealersSummary = useMemo(
    () =>
      hiddenDealers.reduce(
        (acc, d) => ({
          total: acc.total + d.total,
          delivered: acc.delivered + d.delivered,
          approvedPending: acc.approvedPending + d.approvedPending,
          other: acc.other + d.other,
          finance: acc.finance + d.finance,
          deliveredFinance: acc.deliveredFinance + d.deliveredFinance,
        }),
        { total: 0, delivered: 0, approvedPending: 0, other: 0, finance: 0, deliveredFinance: 0 }
      ),
    [hiddenDealers]
  );

  const dealerChartHeight = Math.max(146, Math.min(440, dealers.length * 36 + 24));

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
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                {/* 3D Donut Chart Stage */}
                <div className="sm:col-span-5 relative h-[156px] w-full flex items-center justify-center chart-gpu-layer">
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
                <div className="sm:col-span-7 space-y-1.5 text-[11px]">
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

        {/* SECTION 2: Interactive Dealers Chart & Full Reconciliation */}
        <div className="relative pt-2 border-t border-white/75 dark:border-slate-700/75 space-y-2">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 min-w-0 flex-1">
              <Building2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
              <span className="truncate">สรุปตามร้านตัวแทน (Dealers)</span>
            </div>

            {/* Chart vs List Toggle */}
            <div className="flex items-center gap-1.5 shrink-0">
              {dealers.length > 0 && (
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
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                      dealerViewMode === 'chart'
                        ? 'bg-gradient-to-r from-sky-500 to-teal-500 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <BarChart3 className="w-2.5 h-2.5" />
                    <span>กราฟ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setDealerViewMode('list');
                    }}
                    aria-pressed={dealerViewMode === 'list'}
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                      dealerViewMode === 'list'
                        ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <LayoutList className="w-2.5 h-2.5" />
                    <span>รายการ</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {dealers.length === 0 ? (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 py-1">ยังไม่มีข้อมูลร้านตัวแทนในงวดนี้</p>
          ) : (
            <AnimatePresence mode="wait">
              {dealerViewMode === 'chart' ? (
                <motion.div
                  key="dealer-chart"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  className="glass-inner-surface rounded-2xl p-2.5 space-y-2"
                >
                  {/* Legend Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-600 dark:text-slate-300 px-0.5">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex items-center gap-1 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-teal-500" />
                        <span>รับรถ</span>
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-emerald-300" />
                        <span>รอรับรถ</span>
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                        <span>รอผล/อื่นๆ</span>
                      </span>
                    </div>
                    <span className="font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                      {dealers.length} ร้านครบถ้วน
                    </span>
                  </div>

                  {/* Horizontal Stacked 3D Bar Chart */}
                  <div style={{ height: `${dealerChartHeight}px` }} className="w-full chart-gpu-layer">
                    <ResponsiveContainer width="100%" height="100%" debounce={120}>
                      <BarChart
                        accessibilityLayer={false}
                        data={dealers}
                        layout="vertical"
                        margin={{ top: 2, right: 34, left: 2, bottom: 2 }}
                        barSize={15}
                      >
                        <defs>
                          <linearGradient id="dealerGradDelivered" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#14b8a6" />
                            <stop offset="100%" stopColor="#10b981" />
                          </linearGradient>
                          <linearGradient id="dealerGradPendingDel" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#6ee7b7" />
                            <stop offset="100%" stopColor="#34d399" />
                          </linearGradient>
                          <linearGradient id="dealerGradOther" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#94a3b8" />
                            <stop offset="100%" stopColor="#64748b" />
                          </linearGradient>
                          <filter id="dealerAuraSelected" x="-15%" y="-35%" width="130%" height="170%">
                            <feDropShadow
                              dx="0"
                              dy="0"
                              stdDeviation="3.5"
                              floodColor="#0ea5e9"
                              floodOpacity="0.6"
                            />
                          </filter>
                        </defs>

                        <CartesianGrid
                          strokeDasharray="3 3"
                          horizontal={false}
                          stroke="var(--chart-grid)"
                        />
                        <XAxis type="number" hide domain={[0, 'dataMax + 2']} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={106}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={formatShortDealerLabel}
                          tick={{ fill: 'var(--chart-tick)', fontSize: 10.5, fontWeight: 700 }}
                        />
                        <Tooltip
                          cursor={false}
                          wrapperStyle={{ pointerEvents: 'none', zIndex: 30 }}
                          content={<DealerChartTooltip />}
                        />
                        <Bar
                          dataKey="delivered"
                          stackId="cases"
                          fill="url(#dealerGradDelivered)"
                          radius={[4, 0, 0, 4]}
                          animationDuration={550}
                          onClick={(entry) => {
                            const raw = entry as unknown as {
                              name?: string;
                              payload?: DealerSummaryItem;
                            };
                            const dealerName = raw?.payload?.name ?? raw?.name;
                            if (dealerName) {
                              triggerHaptic('selection');
                              setSelectedDealerName((prev) =>
                                prev === dealerName ? null : dealerName
                              );
                            }
                          }}
                          className="cursor-pointer"
                        >
                          {dealers.map((d) => {
                            const isSel = selectedDealer?.name === d.name;
                            return (
                              <Cell
                                key={d.name}
                                fillOpacity={!selectedDealer || isSel ? 1 : 0.42}
                                filter={isSel ? 'url(#dealerAuraSelected)' : undefined}
                                style={{ transition: 'fill-opacity 200ms ease', outline: 'none' }}
                              />
                            );
                          })}
                        </Bar>
                        <Bar
                          dataKey="approvedPending"
                          stackId="cases"
                          fill="url(#dealerGradPendingDel)"
                          animationDuration={550}
                          onClick={(entry) => {
                            const raw = entry as unknown as {
                              name?: string;
                              payload?: DealerSummaryItem;
                            };
                            const dealerName = raw?.payload?.name ?? raw?.name;
                            if (dealerName) {
                              triggerHaptic('selection');
                              setSelectedDealerName((prev) =>
                                prev === dealerName ? null : dealerName
                              );
                            }
                          }}
                          className="cursor-pointer"
                        >
                          {dealers.map((d) => {
                            const isSel = selectedDealer?.name === d.name;
                            return (
                              <Cell
                                key={d.name}
                                fillOpacity={!selectedDealer || isSel ? 1 : 0.42}
                                style={{ transition: 'fill-opacity 200ms ease', outline: 'none' }}
                              />
                            );
                          })}
                        </Bar>
                        <Bar
                          dataKey="other"
                          stackId="cases"
                          fill="url(#dealerGradOther)"
                          radius={[0, 6, 6, 0]}
                          animationDuration={550}
                          onClick={(entry) => {
                            const raw = entry as unknown as {
                              name?: string;
                              payload?: DealerSummaryItem;
                            };
                            const dealerName = raw?.payload?.name ?? raw?.name;
                            if (dealerName) {
                              triggerHaptic('selection');
                              setSelectedDealerName((prev) =>
                                prev === dealerName ? null : dealerName
                              );
                            }
                          }}
                          className="cursor-pointer"
                        >
                          <LabelList
                            dataKey="total"
                            position="right"
                            formatter={(val: unknown) => `${Number(val) || 0}`}
                            style={{
                              fill: 'var(--chart-label)',
                              fontSize: '10.5px',
                              fontWeight: 800,
                            }}
                          />
                          {dealers.map((d) => {
                            const isSel = selectedDealer?.name === d.name;
                            return (
                              <Cell
                                key={d.name}
                                fillOpacity={!selectedDealer || isSel ? 1 : 0.42}
                                style={{ transition: 'fill-opacity 200ms ease', outline: 'none' }}
                              />
                            );
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Interactive Dealer Quick-Select Chips + Detail Spotlight */}
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {dealers.map((d) => {
                      const isSel = selectedDealer?.name === d.name;
                      return (
                        <button
                          key={d.name}
                          type="button"
                          onClick={() => {
                            triggerHaptic('selection');
                            setSelectedDealerName((prev) =>
                              prev === d.name ? null : d.name
                            );
                          }}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer tabular-nums ${
                            isSel
                              ? 'bg-gradient-to-r from-sky-500 to-teal-500 text-white border-white shadow-xs'
                              : 'bg-white/70 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-white/95 dark:border-slate-700/80'
                          }`}
                        >
                          {d.name} ({d.total})
                        </button>
                      );
                    })}
                  </div>

                  <AnimatePresence mode="wait">
                    {selectedDealer && (
                      <motion.div
                        key={selectedDealer.name}
                        initial={{ opacity: 0, y: -4, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.98 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className="rounded-xl bg-gradient-to-r from-sky-50/90 via-white/90 to-teal-50/90 dark:from-sky-950/85 dark:via-slate-900/90 dark:to-teal-950/85 border border-sky-200/80 dark:border-sky-700/75 px-2.5 py-2 space-y-1 text-[10.5px] shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold text-slate-900 dark:text-slate-50 truncate">
                            {selectedDealer.name}
                          </span>
                          <span className="font-black text-indigo-800 dark:text-indigo-300 tabular-nums whitespace-nowrap">
                            {formatBaht(Math.round(selectedDealer.finance))}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-slate-600 dark:text-slate-300 tabular-nums">
                          <span>
                            รวม <strong className="text-slate-900 dark:text-white">{selectedDealer.total}</strong> เคส
                          </span>
                          <span className="text-teal-700 dark:text-teal-300 font-bold">
                            รับรถ {selectedDealer.delivered}
                          </span>
                          {selectedDealer.approvedPending > 0 && (
                            <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                              รอรับ {selectedDealer.approvedPending}
                            </span>
                          )}
                          {selectedDealer.other > 0 && (
                            <span className="text-slate-500 dark:text-slate-400">
                              รอผล/อื่นๆ {selectedDealer.other}
                            </span>
                          )}
                          <span className="text-slate-500 dark:text-slate-400 ml-auto">
                            รับรถแล้ว {formatShortBaht(selectedDealer.deliveredFinance)}
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ) : (
                <motion.div
                  key="dealer-list"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="divide-y divide-white/80 dark:divide-slate-800/80 text-[11px]"
                >
                  {visibleDealers.map((d) => (
                    <div
                      key={d.name}
                      className="py-1.5 px-1.5 -mx-1.5 rounded-lg hover:bg-sky-50/55 dark:hover:bg-slate-800/60 transition-colors flex items-center justify-between gap-2"
                    >
                      <MarqueeText className="font-semibold text-slate-800 dark:text-slate-100 flex-1 min-w-0">
                        {d.name}
                      </MarqueeText>
                      <div className="flex items-center gap-1.5 shrink-0 tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <span>
                          <strong className="text-slate-900 dark:text-white">{d.total}</strong> เคส (รับรถ{' '}
                          {d.delivered})
                        </span>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <span className="font-bold text-sky-800 dark:text-sky-300">
                          {formatBaht(Math.round(d.finance))}
                        </span>
                      </div>
                    </div>
                  ))}

                  {hiddenDealers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setShowAllDealers(true);
                      }}
                      className="w-full py-1.5 px-1.5 -mx-1.5 rounded-lg hover:bg-sky-50/65 dark:hover:bg-slate-800/65 transition-colors flex items-center justify-between gap-2 text-left cursor-pointer"
                    >
                      <span className="font-semibold text-sky-700 dark:text-sky-300 flex items-center gap-1 min-w-0 truncate">
                        <span>ร้านอื่นๆ ({hiddenDealers.length} ร้าน)</span>
                        <ChevronDown className="w-3 h-3 shrink-0" />
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0 tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <span>
                          <strong className="text-slate-900 dark:text-white">{hiddenDealersSummary.total}</strong>{' '}
                          เคส (รับรถ {hiddenDealersSummary.delivered})
                        </span>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <span className="font-bold text-sky-800 dark:text-sky-300">
                          {formatBaht(Math.round(hiddenDealersSummary.finance))}
                        </span>
                      </div>
                    </button>
                  )}

                  {needsDealerCollapse && showAllDealers && (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setShowAllDealers(false);
                      }}
                      className="w-full py-1 text-center text-[10.5px] font-bold text-sky-700 dark:text-sky-300 hover:text-sky-900 dark:hover:text-sky-200 inline-flex items-center justify-center gap-0.5 cursor-pointer"
                    >
                      <span>ย่อรายการร้าน</span>
                      <ChevronUp className="w-3 h-3" />
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Total Reconciliation Footer */}
          {dealers.length > 0 && (
            <div className="pt-1 border-t border-white/85 dark:border-slate-700/75 flex items-center justify-between gap-2 text-[10.5px] tabular-nums text-slate-600 dark:text-slate-300">
              <span className="font-bold text-slate-700 dark:text-slate-200">รวมทุกร้าน ({dealers.length} ร้าน)</span>
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
