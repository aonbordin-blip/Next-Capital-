import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  ArrowRight,
  Award,
  BarChart3,
  CircleDot,
  FolderArchive,
  PackageCheck,
  Plus,
  RotateCcw,
  TrendingUp,
} from 'lucide-react';
import { formatBaht } from '../data/proposals';
import { triggerHaptic } from '../utils/haptics';
import { MarqueeText } from './MarqueeText';
import { DimensionalMascotStage } from './DimensionalMascotStage';

export type KpiFocusKey = 'overview' | 'cases' | 'delivered' | 'finance' | 'pa';
type ChartViewMode = 'radial' | 'bar';

export interface KpiPeriodStatsInput {
  totalCases: number;
  deliveredCount: number;
  approvedPendingDeliveryCount: number;
  approvedTotalCount: number;
  pendingCount: number;
  rejectedOrCancelledCount: number;
  totalFinance: number;
  deliveredFinance: number;
  approvedTotalFinance: number;
  avgFinance: number;
  approvalRate: number;
}

export interface KpiCommissionSummaryInput {
  totalCommissionBaht: number;
  tier: number;
  achievementPercent: number;
  totalInsuredContracts: number;
  totalDeliveredContracts: number;
}

export interface KpiMiniBucket {
  label: string;
  casesCount: number;
  approvedCount: number;
  deliveredCount: number;
  financeAmount: number;
  paDeliveredCount: number;
  paInsuredCount: number;
}

interface KpiSummaryChartCardProps {
  periodLabel: string;
  stats: KpiPeriodStatsInput;
  commissionSummary: KpiCommissionSummaryInput;
  miniSeries?: KpiMiniBucket[];
  onOpenSavedCases?: () => void;
  onNavigateToCaseForm?: () => void;
  onNavigateToCheckerCommission?: () => void;
}

interface UnifiedKpiMetric {
  key: Exclude<KpiFocusKey, 'overview'>;
  title: string;
  shortTitle: string;
  primaryValue: string;
  compactOrbValue: string;
  subText: string;
  spotlightDetail: string;
  gaugeLabel: string;
  percent: number;
  percentDisplay: string;
  gradientId: string;
  barGradientId: string;
  accentHex: string;
  panelClass: string;
  activeRingClass: string;
  iconBgClass: string;
  textPrimaryClass: string;
  gaugeFillClass: string;
  tipColorClass: string;
  auraBgClass: string;
  secondaryAuraBgClass: string;
  badgeClass: string;
  icon: React.ReactNode;
}

interface RadialChartRow {
  key: Exclude<KpiFocusKey, 'overview'>;
  name: string;
  value: number;
  rawPercent: number;
  primaryValue: string;
  subText: string;
  gaugeLabel: string;
  gradientId: string;
  accentHex: string;
}

interface BarChartRow {
  key: Exclude<KpiFocusKey, 'overview'>;
  stageLabel: string;
  fullTitle: string;
  value: number;
  rawPercent: number;
  countLabel: string;
  moneyLabel: string;
  subText: string;
  barGradientId: string;
  accentHex: string;
}

function formatCompactBaht(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  if (safe >= 1_000_000) {
    return `฿${(safe / 1_000_000).toFixed(2)}M`;
  }
  if (safe >= 100_000) {
    return `฿${(safe / 1_000).toFixed(0)}K`;
  }
  return formatBaht(safe);
}

function clampPercent(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.max(0, Math.min(100, val));
}

function formatPercentLabel(val: unknown): string {
  const n = Number(val);
  if (!Number.isFinite(n)) return '0%';
  return `${Math.round(n)}%`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: RadialChartRow | BarChartRow }>;
}

const UnifiedChartTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  const isBar = 'stageLabel' in item;

  return (
    <div className="rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-700/85 shadow-xl px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 min-w-[185px] max-w-[235px]">
      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: item.accentHex }}
          />
          <span className="font-extrabold text-slate-900 dark:text-slate-50 truncate">
            {isBar ? item.fullTitle : item.name}
          </span>
        </div>
        <span
          className="font-mono font-black tabular-nums shrink-0"
          style={{ color: item.accentHex }}
        >
          {item.rawPercent.toFixed(1)}%
        </span>
      </div>

      <div className="pt-1.5 space-y-1 text-[11px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-500 dark:text-slate-400">{isBar ? 'จำนวน' : item.gaugeLabel}</span>
          <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {isBar ? item.countLabel : item.primaryValue}
          </span>
        </div>
        {isBar && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500 dark:text-slate-400">มูลค่า</span>
            <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">{item.moneyLabel}</span>
          </div>
        )}
        <div className="text-[10.5px] text-slate-600 dark:text-slate-300 pt-0.5">{item.subText}</div>
      </div>
    </div>
  );
};

const AURA_GLOW_MAP: Record<
  Exclude<KpiFocusKey, 'overview'>,
  { filterId: string; glowColor: string; rimColor: string }
> = {
  cases: {
    filterId: 'kpiAuraSky',
    glowColor: '#0ea5e9',
    rimColor: '#7dd3fc',
  },
  delivered: {
    filterId: 'kpiAuraTeal',
    glowColor: '#10b981',
    rimColor: '#6ee7b7',
  },
  finance: {
    filterId: 'kpiAuraIndigo',
    glowColor: '#6366f1',
    rimColor: '#a5b4fc',
  },
  pa: {
    filterId: 'kpiAuraAmber',
    glowColor: '#f59e0b',
    rimColor: '#fde68a',
  },
};

interface AuraBarShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: BarChartRow;
  effectiveKey: KpiFocusKey;
  onSelect: (key: Exclude<KpiFocusKey, 'overview'>) => void;
}

const Aura3DBarShape: React.FC<AuraBarShapeProps> = ({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  payload,
  effectiveKey,
  onSelect,
}) => {
  if (!payload || width <= 0 || height <= 0) return <g />;

  const rx = Math.min(10, width / 2);
  const aura = AURA_GLOW_MAP[payload.key];
  const isPinned = effectiveKey === payload.key;
  const isDimmed = effectiveKey !== 'overview' && !isPinned;
  const barOpacity = isDimmed ? 0.34 : 1;

  return (
    <g
      onClick={() => onSelect(payload.key)}
      style={{ cursor: 'pointer', outline: 'none' }}
    >
      {/* Selected Aura Light Halo */}
      {isPinned && (
        <>
          <rect
            x={x - 3.5}
            y={y - 3.5}
            width={width + 7}
            height={height + 7}
            rx={rx + 3}
            fill={aura.glowColor}
            fillOpacity={0.14}
            stroke={aura.glowColor}
            strokeWidth={2.4}
            filter={`url(#${aura.filterId})`}
            className="animate-kpi-bar-aura"
          />
          <rect
            x={x - 1}
            y={y - 1}
            width={width + 2}
            height={height + 2}
            rx={rx + 1}
            fill="none"
            stroke={aura.rimColor}
            strokeWidth={1.6}
            strokeOpacity={0.95}
          />
        </>
      )}

      {/* Main 3D Gradient Column */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={rx}
        fill={`url(#${payload.barGradientId})`}
        fillOpacity={barOpacity}
        filter={isPinned ? `url(#${aura.filterId})` : 'url(#kpiBarShadow3D)'}
        style={{ transition: 'fill-opacity 220ms ease' }}
      />

      {/* Specular Crystal Top Sheen */}
      {height > 10 && (
        <rect
          x={x + 2}
          y={y + 1.5}
          width={Math.max(0, width - 4)}
          height={Math.min(11, height * 0.22)}
          rx={Math.max(2, rx - 2)}
          fill="#ffffff"
          fillOpacity={isPinned ? 0.48 : isDimmed ? 0.14 : 0.28}
          pointerEvents="none"
        />
      )}

      {/* Luminous Inner Rim on Selected Bar */}
      {isPinned && (
        <rect
          x={x + 0.6}
          y={y + 0.6}
          width={Math.max(0, width - 1.2)}
          height={Math.max(0, height - 1.2)}
          rx={Math.max(2, rx - 0.5)}
          fill="none"
          stroke="#ffffff"
          strokeWidth={1.25}
          strokeOpacity={0.9}
          pointerEvents="none"
        />
      )}
    </g>
  );
};

interface KpiMiniCardChartProps {
  metricKey: Exclude<KpiFocusKey, 'overview'>;
  buckets: KpiMiniBucket[];
  percent: number;
  tier: number;
  isSelected: boolean;
  animSeed: string;
}

function buildSmoothWavePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

const KpiMiniCardChart: React.FC<KpiMiniCardChartProps> = ({
  metricKey,
  buckets,
  percent,
  tier,
  isSelected,
  animSeed,
}) => {
  const safeBuckets = buckets.length > 0 ? buckets : [];
  const count = safeBuckets.length || 6;

  if (metricKey === 'cases') {
    const maxCases = Math.max(1, ...safeBuckets.map((b) => b.casesCount));
    const peakIndex = safeBuckets.reduce(
      (bestIdx, b, idx, arr) => (b.casesCount > (arr[bestIdx]?.casesCount ?? -1) ? idx : bestIdx),
      0
    );
    const slotWidth = 156 / count;

    return (
      <div
        key={`mini-cases-${animSeed}`}
        className={`relative h-[42px] sm:h-[46px] w-full transition-transform duration-300 ${
          isSelected ? 'scale-[1.02]' : 'group-hover:scale-[1.015]'
        }`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 156 44" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="miniSkyColumnGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="55%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
            <linearGradient id="miniSkyGhostGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.42" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.16" />
            </linearGradient>
            <filter id="miniSkyGlow" x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#0284c7" floodOpacity="0.32" />
            </filter>
          </defs>

          {/* Subtle stage floor */}
          <line
            x1="4"
            y1="38.5"
            x2="152"
            y2="38.5"
            stroke="currentColor"
            className="text-sky-900/15 dark:text-sky-200/15"
            strokeWidth="1"
            strokeLinecap="round"
          />

          {safeBuckets.map((b, idx) => {
            const barW = 13.5;
            const x = idx * slotWidth + (slotWidth - barW) / 2;
            const totalH = b.casesCount > 0 ? Math.max(7, (b.casesCount / maxCases) * 29) : 3.5;
            const approvedH =
              b.approvedCount > 0
                ? Math.max(5, Math.min(totalH, (b.approvedCount / maxCases) * 29))
                : b.casesCount > 0
                ? 3.5
                : 0;
            const totalY = 38 - totalH;
            const approvedY = 38 - approvedH;
            const isPeak = idx === peakIndex && b.casesCount > 0;

            return (
              <g
                key={`${b.label}-${idx}`}
                className="animate-kpi-mini-bar"
                style={{ animationDelay: `${idx * 55}ms` }}
              >
                {/* 3D Soft Ground Shadow */}
                <ellipse
                  cx={x + barW / 2}
                  cy={39.4}
                  rx={barW * 0.45}
                  ry={1.3}
                  fill="#0369a1"
                  fillOpacity={b.casesCount > 0 ? 0.16 : 0.06}
                />

                {/* Outer Crystal Column (Total Cases in bucket) */}
                <rect
                  x={x}
                  y={totalY}
                  width={barW}
                  height={totalH}
                  rx={3.5}
                  fill="url(#miniSkyGhostGrad)"
                  stroke="#38bdf8"
                  strokeOpacity={b.casesCount > 0 ? 0.45 : 0.18}
                  strokeWidth={0.75}
                />

                {/* Inner 3D Luminous Column (Approved Cases) */}
                {approvedH > 0 && (
                  <g filter={isPeak || isSelected ? 'url(#miniSkyGlow)' : undefined}>
                    <rect
                      x={x + 1.4}
                      y={approvedY}
                      width={barW - 2.8}
                      height={approvedH}
                      rx={2.6}
                      fill="url(#miniSkyColumnGrad)"
                    />
                    {/* Glossy Top Specular Cap */}
                    <rect
                      x={x + 2.4}
                      y={approvedY + 1.1}
                      width={Math.max(2, barW - 4.8)}
                      height={Math.min(3.5, Math.max(1.5, approvedH * 0.28))}
                      rx={1.4}
                      fill="#ffffff"
                      fillOpacity={0.62}
                    />
                  </g>
                )}

                {/* Peak beacon dot & number */}
                {isPeak && (
                  <g>
                    <circle
                      cx={x + barW / 2}
                      cy={Math.max(3.5, totalY - 3.2)}
                      r={2.1}
                      fill="#0ea5e9"
                      className="animate-fuel-tip-ping"
                      style={{ transformOrigin: `${x + barW / 2}px ${Math.max(3.5, totalY - 3.2)}px` }}
                    />
                    <circle
                      cx={x + barW / 2}
                      cy={Math.max(3.5, totalY - 3.2)}
                      r={1.6}
                      fill="#ffffff"
                      stroke="#0284c7"
                      strokeWidth={1}
                    />
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  if (metricKey === 'delivered') {
    const maxDelivered = Math.max(1, ...safeBuckets.map((b) => b.deliveredCount));
    const points = safeBuckets.map((b, idx) => {
      const x = count > 1 ? 8 + (idx / (count - 1)) * 140 : 78;
      const y = b.deliveredCount > 0 ? 34 - (b.deliveredCount / maxDelivered) * 24 : 34.5;
      return { x, y, count: b.deliveredCount };
    });

    const linePath = buildSmoothWavePath(points);
    const areaPath =
      points.length > 0
        ? `${linePath} L ${points[points.length - 1].x.toFixed(2)} 38.5 L ${points[0].x.toFixed(2)} 38.5 Z`
        : '';

    let latestActiveIdx = points.length - 1;
    for (let i = points.length - 1; i >= 0; i--) {
      if (points[i].count > 0) {
        latestActiveIdx = i;
        break;
      }
    }

    return (
      <div
        key={`mini-delivered-${animSeed}`}
        className={`relative h-[42px] sm:h-[46px] w-full transition-transform duration-300 ${
          isSelected ? 'scale-[1.02]' : 'group-hover:scale-[1.015]'
        }`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 156 44" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="miniTealAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.48" />
              <stop offset="65%" stopColor="#14b8a6" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#0d9488" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="miniTealStrokeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="50%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
            <filter id="miniTealGlow" x="-20%" y="-25%" width="140%" height="160%">
              <feDropShadow dx="0" dy="2.5" stdDeviation="2.2" floodColor="#059669" floodOpacity="0.38" />
            </filter>
          </defs>

          {/* Subtle Baseline & Vertical Stage Guides */}
          <line
            x1="4"
            y1="38.5"
            x2="152"
            y2="38.5"
            stroke="currentColor"
            className="text-emerald-900/15 dark:text-emerald-200/15"
            strokeWidth="1"
            strokeLinecap="round"
          />
          {points.map((pt, idx) => (
            <line
              key={`guide-${idx}`}
              x1={pt.x}
              y1={pt.y}
              x2={pt.x}
              y2={38.5}
              stroke="currentColor"
              className="text-emerald-700/15 dark:text-emerald-300/15"
              strokeWidth="0.75"
              strokeDasharray="1.8 1.8"
            />
          ))}

          {/* 3D Translucent Wave Fill */}
          {areaPath && (
            <path
              d={areaPath}
              fill="url(#miniTealAreaGrad)"
              className="animate-kpi-mini-area"
            />
          )}

          {/* Glowing Main Curve + Top Glass Specular Ribbon */}
          {linePath && (
            <g filter="url(#miniTealGlow)">
              <path
                d={linePath}
                fill="none"
                stroke="url(#miniTealStrokeGrad)"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-kpi-mini-line"
              />
              <path
                d={linePath}
                fill="none"
                stroke="#ffffff"
                strokeOpacity={0.55}
                strokeWidth={0.85}
                strokeLinecap="round"
                transform="translate(0, -0.7)"
                className="animate-kpi-mini-line"
              />
            </g>
          )}

          {/* Crystal Data Nodes */}
          {points.map((pt, idx) => {
            const isHeroNode = idx === latestActiveIdx && pt.count > 0;
            if (pt.count === 0 && !isHeroNode) {
              return (
                <circle
                  key={`pt-${idx}`}
                  cx={pt.x}
                  cy={pt.y}
                  r={1.4}
                  fill="#10b981"
                  fillOpacity={0.32}
                />
              );
            }
            return (
              <g key={`pt-${idx}`}>
                {isHeroNode && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={4.2}
                    fill="#10b981"
                    fillOpacity={0.32}
                    className="animate-fuel-tip-ping"
                    style={{ transformOrigin: `${pt.x}px ${pt.y}px` }}
                  />
                )}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHeroNode ? 2.7 : 2.1}
                  fill="#ffffff"
                  stroke="#059669"
                  strokeWidth={isHeroNode ? 1.5 : 1.2}
                />
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  if (metricKey === 'finance') {
    const maxFinance = Math.max(1, ...safeBuckets.map((b) => b.financeAmount));
    const nonZeroVals = safeBuckets.filter((b) => b.financeAmount > 0).map((b) => b.financeAmount);
    const avgBucketFinance =
      nonZeroVals.length > 0
        ? nonZeroVals.reduce((sum, v) => sum + v, 0) / nonZeroVals.length
        : 0;
    const avgLineY = avgBucketFinance > 0 ? 37.5 - (avgBucketFinance / maxFinance) * 26 : 36;
    const slotWidth = 156 / count;

    return (
      <div
        key={`mini-finance-${animSeed}`}
        className={`relative h-[42px] sm:h-[46px] w-full transition-transform duration-300 ${
          isSelected ? 'scale-[1.02]' : 'group-hover:scale-[1.015]'
        }`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 156 44" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="miniIndigoFrontGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#818cf8" />
              <stop offset="55%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#4338ca" />
            </linearGradient>
            <linearGradient id="miniIndigoSideGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" />
              <stop offset="100%" stopColor="#312e81" />
            </linearGradient>
            <filter id="miniIndigoGlow" x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="1" dy="2.5" stdDeviation="2" floodColor="#4f46e5" floodOpacity="0.34" />
            </filter>
          </defs>

          {/* Stage Floor */}
          <line
            x1="4"
            y1="38.5"
            x2="152"
            y2="38.5"
            stroke="currentColor"
            className="text-indigo-900/15 dark:text-indigo-200/15"
            strokeWidth="1"
            strokeLinecap="round"
          />

          {/* Isometric 3D Prisms */}
          {safeBuckets.map((b, idx) => {
            const frontW = 10.5;
            const depthX = 3.5;
            const depthY = 2.6;
            const x = idx * slotWidth + (slotWidth - (frontW + depthX)) / 2;
            const barH = b.financeAmount > 0 ? Math.max(6, (b.financeAmount / maxFinance) * 26.5) : 2.5;
            const y = 38 - barH;
            const isPeak = b.financeAmount === maxFinance && b.financeAmount > 0;

            return (
              <g
                key={`${b.label}-${idx}`}
                className="animate-kpi-mini-bar"
                style={{ animationDelay: `${idx * 60}ms` }}
                filter={isPeak || isSelected ? 'url(#miniIndigoGlow)' : undefined}
              >
                {/* Ground Shadow */}
                <ellipse
                  cx={x + (frontW + depthX) / 2}
                  cy={39.4}
                  rx={frontW * 0.58}
                  ry={1.3}
                  fill="#3730a3"
                  fillOpacity={b.financeAmount > 0 ? 0.18 : 0.06}
                />

                {/* 3D Right Side Facet */}
                <polygon
                  points={`${x + frontW},${y} ${x + frontW + depthX},${y - depthY} ${x + frontW + depthX},${38 - depthY} ${x + frontW},38`}
                  fill="url(#miniIndigoSideGrad)"
                  fillOpacity={b.financeAmount > 0 ? 0.92 : 0.25}
                />

                {/* 3D Top Cap Facet */}
                <polygon
                  points={`${x},${y} ${x + depthX},${y - depthY} ${x + frontW + depthX},${y - depthY} ${x + frontW},${y}`}
                  fill={b.financeAmount > 0 ? '#c7d2fe' : '#a5b4fc'}
                  fillOpacity={b.financeAmount > 0 ? 0.95 : 0.35}
                />

                {/* Front Crystal Face */}
                <rect
                  x={x}
                  y={y}
                  width={frontW}
                  height={barH}
                  rx={1.2}
                  fill="url(#miniIndigoFrontGrad)"
                  fillOpacity={b.financeAmount > 0 ? 1 : 0.28}
                />

                {/* Glossy Vertical Edge Highlight */}
                {b.financeAmount > 0 && barH > 6 && (
                  <line
                    x1={x + 1.3}
                    y1={y + 1.2}
                    x2={x + 1.3}
                    y2={37}
                    stroke="#ffffff"
                    strokeOpacity={0.45}
                    strokeWidth={0.9}
                    strokeLinecap="round"
                  />
                )}
              </g>
            );
          })}

          {/* Average Benchmark Reference Line */}
          {avgBucketFinance > 0 && (
            <g className="animate-kpi-mini-area">
              <line
                x1="4"
                y1={avgLineY}
                x2="152"
                y2={avgLineY}
                stroke="#6366f1"
                strokeOpacity={0.6}
                strokeWidth="1"
                strokeDasharray="3 2.5"
              />
              <circle
                cx="150"
                cy={avgLineY}
                r={1.8}
                fill="#ffffff"
                stroke="#4f46e5"
                strokeWidth={1.1}
              />
            </g>
          )}
        </svg>
      </div>
    );
  }

  // metricKey === 'pa': Dual 3D Mini Ring Gauge + PA Penetration Columns
  const ringRadius = 14.5;
  const ringCirc = 2 * Math.PI * ringRadius;
  const clampedPct = clampPercent(percent);
  const ringOffset = ringCirc - (clampedPct / 100) * ringCirc;
  const maxDelivered = Math.max(1, ...safeBuckets.map((b) => Math.max(b.paDeliveredCount, b.paInsuredCount)));
  const paSlotW = 104 / count;

  return (
    <div
      key={`mini-pa-${animSeed}`}
      className={`relative h-[42px] sm:h-[46px] w-full flex items-center gap-1.5 transition-transform duration-300 ${
        isSelected ? 'scale-[1.02]' : 'group-hover:scale-[1.015]'
      }`}
      aria-hidden="true"
    >
      {/* Left 3D Tier Ring Gauge */}
      <div className="relative w-[40px] h-[40px] shrink-0 flex items-center justify-center animate-kpi-mini-float">
        <svg viewBox="0 0 40 40" className="w-full h-full overflow-visible -rotate-90">
          <defs>
            <linearGradient id="miniPaRingGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="55%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#f43f5e" />
            </linearGradient>
            <filter id="miniPaGlow" x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="1.8" floodColor="#d97706" floodOpacity="0.4" />
            </filter>
          </defs>
          <circle
            cx="20"
            cy="20"
            r={ringRadius}
            fill="none"
            stroke="currentColor"
            className="text-amber-900/12 dark:text-amber-200/15"
            strokeWidth="4.2"
          />
          <circle
            cx="20"
            cy="20"
            r={ringRadius}
            fill="none"
            stroke="url(#miniPaRingGrad)"
            strokeWidth="4.2"
            strokeLinecap="round"
            strokeDasharray={ringCirc}
            strokeDashoffset={ringOffset}
            filter="url(#miniPaGlow)"
            style={{ transition: 'stroke-dashoffset 650ms cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[8.5px] font-black tabular-nums text-amber-900 dark:text-amber-200">
          T{tier}
        </span>
      </div>

      {/* Right 6-Period 3D Amber PA Penetration Columns */}
      <div className="flex-1 h-[42px] sm:h-[46px] min-w-0">
        <svg viewBox="0 0 104 44" className="block w-full h-full overflow-visible">
          <defs>
            <linearGradient id="miniPaColGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="55%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#ea580c" />
            </linearGradient>
          </defs>
          <line
            x1="2"
            y1="38.5"
            x2="102"
            y2="38.5"
            stroke="currentColor"
            className="text-amber-900/15 dark:text-amber-200/15"
            strokeWidth="1"
            strokeLinecap="round"
          />
          {safeBuckets.map((b, idx) => {
            const barW = 10.5;
            const x = idx * paSlotW + (paSlotW - barW) / 2;
            const delivVal = Math.max(b.paDeliveredCount, b.paInsuredCount);
            const delivH = delivVal > 0 ? Math.max(7, (delivVal / maxDelivered) * 29) : 3.5;
            const insH =
              b.paInsuredCount > 0
                ? Math.max(5, Math.min(delivH, (b.paInsuredCount / maxDelivered) * 29))
                : 0;
            const delivY = 38 - delivH;
            const insY = 38 - insH;

            return (
              <g
                key={`${b.label}-${idx}`}
                className="animate-kpi-mini-bar"
                style={{ animationDelay: `${idx * 55}ms` }}
              >
                <ellipse
                  cx={x + barW / 2}
                  cy={39.4}
                  rx={barW * 0.44}
                  ry={1.2}
                  fill="#b45309"
                  fillOpacity={delivVal > 0 ? 0.16 : 0.05}
                />
                <rect
                  x={x}
                  y={delivY}
                  width={barW}
                  height={delivH}
                  rx={3}
                  fill="#fbbf24"
                  fillOpacity={delivVal > 0 ? 0.22 : 0.1}
                  stroke="#f59e0b"
                  strokeOpacity={delivVal > 0 ? 0.45 : 0.16}
                  strokeWidth={0.7}
                />
                {insH > 0 && (
                  <>
                    <rect
                      x={x + 1.2}
                      y={insY}
                      width={barW - 2.4}
                      height={insH}
                      rx={2.3}
                      fill="url(#miniPaColGrad)"
                    />
                    <rect
                      x={x + 2.1}
                      y={insY + 1}
                      width={Math.max(2, barW - 4.2)}
                      height={Math.min(3.2, Math.max(1.4, insH * 0.28))}
                      rx={1.2}
                      fill="#ffffff"
                      fillOpacity={0.62}
                    />
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export const KpiSummaryChartCard: React.FC<KpiSummaryChartCardProps> = ({
  periodLabel,
  stats,
  commissionSummary,
  miniSeries,
  onOpenSavedCases,
  onNavigateToCaseForm,
  onNavigateToCheckerCommission,
}) => {
  const [chartMode, setChartMode] = useState<ChartViewMode>('radial');
  const [focusedKey, setFocusedKey] = useState<KpiFocusKey>('overview');
  const [hoveredKey, setHoveredKey] = useState<Exclude<KpiFocusKey, 'overview'> | null>(null);
  const [orbPulseKey, setOrbPulseKey] = useState<number>(0);

  // Animated count-up for total finance in overview spotlight
  const [displayFinance, setDisplayFinance] = useState<number>(Math.round(stats.totalFinance));
  const prevFinanceRef = useRef<number>(Math.round(stats.totalFinance));

  useEffect(() => {
    const startVal = prevFinanceRef.current;
    const endVal = Math.round(stats.totalFinance);
    if (startVal === endVal) {
      setDisplayFinance(endVal);
      return;
    }
    const duration = 420;
    const startTime = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayFinance(Math.round(startVal + (endVal - startVal) * eased));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        prevFinanceRef.current = endVal;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      prevFinanceRef.current = endVal;
    };
  }, [stats.totalFinance]);

  // Derived percentage ratios across the 4 KPIs
  const deliveryOfTotalRate = useMemo(
    () => (stats.totalCases > 0 ? (stats.deliveredCount / stats.totalCases) * 100 : 0),
    [stats.totalCases, stats.deliveredCount]
  );

  const deliveryOfApprovedRate = useMemo(
    () =>
      stats.approvedTotalCount > 0
        ? (stats.deliveredCount / stats.approvedTotalCount) * 100
        : 0,
    [stats.approvedTotalCount, stats.deliveredCount]
  );

  const deliveredFinanceShare = useMemo(
    () => (stats.totalFinance > 0 ? (stats.deliveredFinance / stats.totalFinance) * 100 : 0),
    [stats.totalFinance, stats.deliveredFinance]
  );

  const metrics: UnifiedKpiMetric[] = useMemo(
    () => [
      {
        key: 'cases',
        title: 'เคสเดือนนี้',
        shortTitle: 'เคสทั้งหมด',
        primaryValue: `${stats.totalCases} เคส`,
        compactOrbValue: `${stats.totalCases} เคส`,
        subText: `รอผล ${stats.pendingCount} · อนุมัติ ${stats.approvedTotalCount}`,
        spotlightDetail: `อนุมัติแล้ว ${stats.approvedTotalCount} จาก ${stats.totalCases} เคส · รอผล ${stats.pendingCount}${
          stats.rejectedOrCancelledCount > 0
            ? ` · ไม่ผ่าน/ยกเลิก ${stats.rejectedOrCancelledCount}`
            : ''
        }`,
        gaugeLabel: 'อัตราอนุมัติ',
        percent: clampPercent(stats.approvalRate),
        percentDisplay: `${stats.approvalRate.toFixed(0)}%`,
        gradientId: 'kpiRingGradCases',
        barGradientId: 'kpiBarGradCases',
        accentHex: '#0ea5e9',
        panelClass: 'glass-panel-blue',
        activeRingClass:
          'ring-2 ring-sky-400/80 shadow-md shadow-sky-500/15 bg-white/85 dark:bg-sky-950/75 -translate-y-0.5',
        iconBgClass: 'from-sky-400 to-blue-600 shadow-sky-500/30',
        textPrimaryClass: 'text-sky-950 dark:text-sky-100',
        gaugeFillClass: 'from-sky-400 via-blue-500 to-cyan-400',
        tipColorClass: 'bg-sky-400',
        auraBgClass: 'bg-sky-300/35 dark:bg-sky-500/18',
        secondaryAuraBgClass: 'bg-cyan-200/30 dark:bg-cyan-500/15',
        badgeClass:
          'bg-sky-100/90 text-sky-800 border-sky-200/90 dark:bg-sky-950/85 dark:text-sky-200 dark:border-sky-700/80',
        icon: <FolderArchive className="w-3.5 h-3.5" />,
      },
      {
        key: 'delivered',
        title: 'รับรถแล้ว',
        shortTitle: 'รับรถแล้ว',
        primaryValue: `${stats.deliveredCount} คัน`,
        compactOrbValue: `${stats.deliveredCount} คัน`,
        subText: `รอรับรถ ${stats.approvedPendingDeliveryCount} · อนุมัติ ${stats.approvalRate.toFixed(0)}%`,
        spotlightDetail: `ส่งมอบแล้ว ${stats.deliveredCount} คัน (${deliveryOfApprovedRate.toFixed(
          0
        )}% ของเคสอนุมัติ) · รอส่งมอบ ${stats.approvedPendingDeliveryCount} คัน`,
        gaugeLabel: 'สัดส่วนรับรถ',
        percent: clampPercent(deliveryOfTotalRate),
        percentDisplay: `${deliveryOfTotalRate.toFixed(0)}%`,
        gradientId: 'kpiRingGradDelivered',
        barGradientId: 'kpiBarGradDelivered',
        accentHex: '#10b981',
        panelClass: 'glass-panel-teal',
        activeRingClass:
          'ring-2 ring-emerald-400/80 shadow-md shadow-teal-500/15 bg-white/85 dark:bg-teal-950/75 -translate-y-0.5',
        iconBgClass: 'from-emerald-400 to-teal-600 shadow-teal-500/30',
        textPrimaryClass: 'text-teal-900 dark:text-teal-100',
        gaugeFillClass: 'from-emerald-400 via-teal-500 to-cyan-400',
        tipColorClass: 'bg-emerald-400',
        auraBgClass: 'bg-emerald-300/35 dark:bg-emerald-500/18',
        secondaryAuraBgClass: 'bg-teal-200/30 dark:bg-teal-500/15',
        badgeClass:
          'bg-emerald-100/90 text-emerald-800 border-emerald-200/90 dark:bg-emerald-950/85 dark:text-emerald-200 dark:border-emerald-700/80',
        icon: <PackageCheck className="w-3.5 h-3.5" />,
      },
      {
        key: 'finance',
        title: 'ยอดจัดไฟแนนซ์รวม',
        shortTitle: 'ยอดจัดรวม',
        primaryValue: formatBaht(Math.round(stats.totalFinance)),
        compactOrbValue: formatCompactBaht(stats.totalFinance),
        subText: `เฉลี่ย ${formatBaht(Math.round(stats.avgFinance))}/เคส`,
        spotlightDetail: `ยอดจัดรับรถแล้ว ${formatBaht(
          Math.round(stats.deliveredFinance)
        )} (${deliveredFinanceShare.toFixed(0)}%) · เฉลี่ย ${formatBaht(
          Math.round(stats.avgFinance)
        )}/เคส`,
        gaugeLabel: 'ยอดจัดรับรถแล้ว',
        percent: clampPercent(deliveredFinanceShare),
        percentDisplay: `${deliveredFinanceShare.toFixed(0)}%`,
        gradientId: 'kpiRingGradFinance',
        barGradientId: 'kpiBarGradFinance',
        accentHex: '#6366f1',
        panelClass: 'glass-panel-indigo',
        activeRingClass:
          'ring-2 ring-indigo-400/80 shadow-md shadow-indigo-500/15 bg-white/85 dark:bg-indigo-950/75 -translate-y-0.5',
        iconBgClass: 'from-blue-500 to-indigo-600 shadow-indigo-500/30',
        textPrimaryClass: 'text-indigo-950 dark:text-indigo-100',
        gaugeFillClass: 'from-blue-500 via-indigo-500 to-violet-500',
        tipColorClass: 'bg-indigo-400',
        auraBgClass: 'bg-indigo-300/35 dark:bg-indigo-500/18',
        secondaryAuraBgClass: 'bg-blue-200/30 dark:bg-blue-500/15',
        badgeClass:
          'bg-indigo-100/90 text-indigo-800 border-indigo-200/90 dark:bg-indigo-950/85 dark:text-indigo-200 dark:border-indigo-700/80',
        icon: <TrendingUp className="w-3.5 h-3.5" />,
      },
      {
        key: 'pa',
        title: 'ค่าคอมประกัน PA',
        shortTitle: 'ประกัน PA',
        primaryValue: formatBaht(commissionSummary.totalCommissionBaht),
        compactOrbValue: formatBaht(commissionSummary.totalCommissionBaht),
        subText: `Tier ${commissionSummary.tier} · ${commissionSummary.achievementPercent.toFixed(
          1
        )}% (${commissionSummary.totalInsuredContracts}/${commissionSummary.totalDeliveredContracts})`,
        spotlightDetail: `Tier ${commissionSummary.tier} · ทำประกัน ${
          commissionSummary.totalInsuredContracts
        }/${commissionSummary.totalDeliveredContracts} สัญญา (${commissionSummary.achievementPercent.toFixed(
          1
        )}%)`,
        gaugeLabel: 'อัตราทำประกัน PA',
        percent: clampPercent(commissionSummary.achievementPercent),
        percentDisplay: `${commissionSummary.achievementPercent.toFixed(1)}%`,
        gradientId: 'kpiRingGradPa',
        barGradientId: 'kpiBarGradPa',
        accentHex: '#f59e0b',
        panelClass: 'glass-panel-amber',
        activeRingClass:
          'ring-2 ring-amber-400/85 shadow-md shadow-amber-500/15 bg-white/85 dark:bg-amber-950/75 -translate-y-0.5',
        iconBgClass: 'from-amber-400 to-orange-500 shadow-amber-500/30',
        textPrimaryClass: 'text-amber-900 dark:text-amber-200',
        gaugeFillClass: 'from-amber-400 via-orange-500 to-rose-400',
        tipColorClass: 'bg-amber-400',
        auraBgClass: 'bg-amber-300/35 dark:bg-amber-500/18',
        secondaryAuraBgClass: 'bg-orange-200/30 dark:bg-orange-500/15',
        badgeClass:
          'bg-amber-100/90 text-amber-800 border-amber-200/90 dark:bg-amber-950/85 dark:text-amber-200 dark:border-amber-700/80',
        icon: <Award className="w-3.5 h-3.5" />,
      },
    ],
    [
      stats,
      commissionSummary,
      deliveryOfApprovedRate,
      deliveryOfTotalRate,
      deliveredFinanceShare,
    ]
  );

  const effectiveKey: KpiFocusKey = hoveredKey ?? focusedKey;
  const activeMetric = useMemo(
    () => (effectiveKey === 'overview' ? null : metrics.find((m) => m.key === effectiveKey) ?? null),
    [effectiveKey, metrics]
  );

  // RadialBarChart draws items from inner-to-outer: PA (inner) -> Finance -> Delivered -> Cases (outer)
  const radialData: RadialChartRow[] = useMemo(() => {
    const ordered = [...metrics].reverse();
    return ordered.map((m) => ({
      key: m.key,
      name: m.title,
      // Minimum tiny visual arc of 3% when raw > 0 so thin percentages remain visible
      value: m.percent > 0 ? Math.max(4, m.percent) : 0,
      rawPercent: m.percent,
      primaryValue: m.primaryValue,
      subText: m.subText,
      gaugeLabel: m.gaugeLabel,
      gradientId: m.gradientId,
      accentHex: m.accentHex,
    }));
  }, [metrics]);

  // BarChart shows the 4-stage unified funnel & value progression
  const barData: BarChartRow[] = useMemo(
    () => [
      {
        key: 'cases',
        stageLabel: 'เคสรวม',
        fullTitle: 'เคสทั้งหมดในงวด',
        value: stats.totalCases > 0 ? 100 : 0,
        rawPercent: stats.totalCases > 0 ? 100 : 0,
        countLabel: `${stats.totalCases} เคส`,
        moneyLabel: formatBaht(Math.round(stats.totalFinance)),
        subText: `รอผล ${stats.pendingCount} · อนุมัติ ${stats.approvedTotalCount}`,
        barGradientId: 'kpiBarGradCases',
        accentHex: '#0ea5e9',
      },
      {
        key: 'finance',
        stageLabel: 'อนุมัติ',
        fullTitle: 'อนุมัติ & ยอดจัด',
        value: clampPercent(stats.approvalRate),
        rawPercent: stats.approvalRate,
        countLabel: `${stats.approvedTotalCount} เคส`,
        moneyLabel: formatBaht(Math.round(stats.approvedTotalFinance)),
        subText: `ยอดจัดรวม ${formatCompactBaht(stats.totalFinance)}`,
        barGradientId: 'kpiBarGradFinance',
        accentHex: '#6366f1',
      },
      {
        key: 'delivered',
        stageLabel: 'รับรถแล้ว',
        fullTitle: 'ส่งมอบรับรถแล้ว',
        value: clampPercent(deliveryOfTotalRate),
        rawPercent: deliveryOfTotalRate,
        countLabel: `${stats.deliveredCount} คัน`,
        moneyLabel: formatBaht(Math.round(stats.deliveredFinance)),
        subText: `รอรับรถ ${stats.approvedPendingDeliveryCount} คัน`,
        barGradientId: 'kpiBarGradDelivered',
        accentHex: '#10b981',
      },
      {
        key: 'pa',
        stageLabel: 'PA',
        fullTitle: 'ค่าคอมประกัน PA',
        value: clampPercent(commissionSummary.achievementPercent),
        rawPercent: commissionSummary.achievementPercent,
        countLabel: `${commissionSummary.totalInsuredContracts}/${commissionSummary.totalDeliveredContracts} คัน`,
        moneyLabel: formatBaht(commissionSummary.totalCommissionBaht),
        subText: `Tier ${commissionSummary.tier} (${commissionSummary.achievementPercent.toFixed(1)}%)`,
        barGradientId: 'kpiBarGradPa',
        accentHex: '#f59e0b',
      },
    ],
    [stats, commissionSummary, deliveryOfTotalRate]
  );

  const handleSelectMetric = (key: Exclude<KpiFocusKey, 'overview'>) => {
    triggerHaptic('selection');
    setOrbPulseKey((p) => p + 1);
    setFocusedKey((prev) => (prev === key ? 'overview' : key));
  };

  const handleCycleOrb = () => {
    triggerHaptic('selection');
    setOrbPulseKey((p) => p + 1);
    const sequence: KpiFocusKey[] = ['overview', 'cases', 'delivered', 'finance', 'pa'];
    setFocusedKey((prev) => {
      const idx = sequence.indexOf(prev);
      return sequence[(idx + 1) % sequence.length];
    });
  };

  const fallbackMiniSeries: KpiMiniBucket[] = useMemo(() => {
    if (miniSeries && miniSeries.length > 0) return miniSeries;
    return [
      {
        label: '1-5',
        casesCount: Math.max(0, Math.round(stats.totalCases * 0.15)),
        approvedCount: Math.max(0, Math.round(stats.approvedTotalCount * 0.15)),
        deliveredCount: Math.max(0, Math.round(stats.deliveredCount * 0.12)),
        financeAmount: stats.totalFinance * 0.14,
        paDeliveredCount: Math.max(0, Math.round(commissionSummary.totalDeliveredContracts * 0.14)),
        paInsuredCount: Math.max(0, Math.round(commissionSummary.totalInsuredContracts * 0.14)),
      },
      {
        label: '6-10',
        casesCount: Math.max(0, Math.round(stats.totalCases * 0.2)),
        approvedCount: Math.max(0, Math.round(stats.approvedTotalCount * 0.2)),
        deliveredCount: Math.max(0, Math.round(stats.deliveredCount * 0.18)),
        financeAmount: stats.totalFinance * 0.2,
        paDeliveredCount: Math.max(0, Math.round(commissionSummary.totalDeliveredContracts * 0.18)),
        paInsuredCount: Math.max(0, Math.round(commissionSummary.totalInsuredContracts * 0.18)),
      },
      {
        label: '11-15',
        casesCount: Math.max(0, Math.round(stats.totalCases * 0.18)),
        approvedCount: Math.max(0, Math.round(stats.approvedTotalCount * 0.18)),
        deliveredCount: Math.max(0, Math.round(stats.deliveredCount * 0.2)),
        financeAmount: stats.totalFinance * 0.18,
        paDeliveredCount: Math.max(0, Math.round(commissionSummary.totalDeliveredContracts * 0.2)),
        paInsuredCount: Math.max(0, Math.round(commissionSummary.totalInsuredContracts * 0.2)),
      },
      {
        label: '16-20',
        casesCount: Math.max(0, Math.round(stats.totalCases * 0.22)),
        approvedCount: Math.max(0, Math.round(stats.approvedTotalCount * 0.22)),
        deliveredCount: Math.max(0, Math.round(stats.deliveredCount * 0.22)),
        financeAmount: stats.totalFinance * 0.22,
        paDeliveredCount: Math.max(0, Math.round(commissionSummary.totalDeliveredContracts * 0.22)),
        paInsuredCount: Math.max(0, Math.round(commissionSummary.totalInsuredContracts * 0.22)),
      },
      {
        label: '21-25',
        casesCount: Math.max(0, Math.round(stats.totalCases * 0.15)),
        approvedCount: Math.max(0, Math.round(stats.approvedTotalCount * 0.15)),
        deliveredCount: Math.max(0, Math.round(stats.deliveredCount * 0.16)),
        financeAmount: stats.totalFinance * 0.15,
        paDeliveredCount: Math.max(0, Math.round(commissionSummary.totalDeliveredContracts * 0.16)),
        paInsuredCount: Math.max(0, Math.round(commissionSummary.totalInsuredContracts * 0.16)),
      },
      {
        label: '26+',
        casesCount: Math.max(0, stats.totalCases - Math.round(stats.totalCases * 0.9)),
        approvedCount: Math.max(0, stats.approvedTotalCount - Math.round(stats.approvedTotalCount * 0.9)),
        deliveredCount: Math.max(0, stats.deliveredCount - Math.round(stats.deliveredCount * 0.88)),
        financeAmount: Math.max(0, stats.totalFinance * 0.11),
        paDeliveredCount: Math.max(
          0,
          commissionSummary.totalDeliveredContracts - Math.round(commissionSummary.totalDeliveredContracts * 0.9)
        ),
        paInsuredCount: Math.max(
          0,
          commissionSummary.totalInsuredContracts - Math.round(commissionSummary.totalInsuredContracts * 0.9)
        ),
      },
    ];
  }, [miniSeries, stats, commissionSummary]);

  const auraPrimary = activeMetric ? activeMetric.auraBgClass : 'bg-sky-300/30 dark:bg-sky-500/15';
  const auraSecondary = activeMetric ? activeMetric.secondaryAuraBgClass : 'bg-teal-200/30 dark:bg-teal-500/15';

  return (
    <section
      aria-label="สรุปภาพรวมผลงาน 4 มิติ"
      className="glass-card-primary rounded-2xl p-3.5 sm:p-4 space-y-3 relative overflow-hidden transition-colors duration-300"
    >
      {/* Top Specular Glass Edge */}
      <div
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white dark:via-sky-300/35 to-transparent opacity-95"
        aria-hidden="true"
      />

      {/* Dynamic Morphing Ambient Aura Blobs */}
      <div
        className={`pointer-events-none -right-14 -top-14 absolute w-48 h-48 rounded-full blur-2xl transition-colors duration-500 animate-fuel-aura ${auraPrimary}`}
        aria-hidden="true"
      />
      <div
        className={`pointer-events-none -left-14 -bottom-16 absolute w-44 h-44 rounded-full blur-2xl transition-colors duration-500 ${auraSecondary}`}
        aria-hidden="true"
      />

      {/* Header Row: Title + Chart Mode Switcher */}
      <div className="relative flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 via-indigo-500 to-teal-500 border border-white/65 dark:border-sky-300/30 text-white flex items-center justify-center shrink-0 shadow-sm shadow-sky-500/25">
            <Activity className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <MarqueeText className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-50">
              สรุปภาพรวมผลงาน 4 มิติ
            </MarqueeText>
            <MarqueeText className="text-[10.5px] text-slate-600 dark:text-slate-400">
              {periodLabel} · เคส · รับรถ · ยอดจัด · ค่าคอม PA
            </MarqueeText>
          </div>
        </div>

        {/* Interactive Chart Mode Switcher */}
        <div
          role="group"
          aria-label="เลือกรูปแบบกราฟ"
          className="flex items-center gap-0.5 p-0.5 rounded-xl bg-white/60 dark:bg-slate-800/80 backdrop-blur-md border border-white/90 dark:border-slate-700/80 shadow-2xs shrink-0"
        >
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setChartMode('radial');
            }}
            aria-pressed={chartMode === 'radial'}
            className={`px-2 py-1 rounded-lg text-[10.5px] sm:text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
              chartMode === 'radial'
                ? 'bg-gradient-to-r from-sky-500 to-teal-500 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/70'
            }`}
          >
            <CircleDot className="w-3 h-3 shrink-0" />
            <span>วงแหวน</span>
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setChartMode('bar');
            }}
            aria-pressed={chartMode === 'bar'}
            className={`px-2 py-1 rounded-lg text-[10.5px] sm:text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
              chartMode === 'bar'
                ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/70'
            }`}
          >
            <BarChart3 className="w-3 h-3 shrink-0" />
            <span>แท่ง 3D</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {stats.totalCases === 0 ? (
        <div className="relative rounded-xl bg-gradient-to-br from-white/75 via-sky-50/60 to-teal-50/50 dark:from-slate-800/85 dark:via-slate-900/80 dark:to-sky-950/65 border border-white/90 dark:border-slate-700/80 p-5 text-center space-y-2.5">
          <div className="w-10 h-10 mx-auto rounded-2xl bg-gradient-to-br from-sky-400 to-teal-500 text-white flex items-center justify-center shadow-sm">
            <Activity className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
              ยังไม่มีข้อมูลเคสในงวด {periodLabel}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              เมื่อบันทึกเคสหรืออัปเดตสถานะรับรถ กราฟสรุป 4 มิติจะแสดงผลอัตโนมัติทันที
            </p>
          </div>
          {onNavigateToCaseForm && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('medium');
                onNavigateToCaseForm();
              }}
              className="btn-fluid-primary px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>คำนวณ / บันทึกเคสแรก</span>
            </button>
          )}
        </div>
      ) : (
        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
          {/* Left / Top: 3D Dimensional Chart Stage */}
          <div className="lg:col-span-5 rounded-2xl bg-gradient-to-br from-white/78 via-white/52 to-sky-50/65 dark:from-slate-900/85 dark:via-slate-900/70 dark:to-sky-950/65 border border-white/95 dark:border-slate-700/80 shadow-[inset_0_1px_2px_rgba(255,255,255,0.95),0_8px_24px_-10px_rgba(2,132,199,0.16)] dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.06),0_12px_28px_-10px_rgba(2,6,23,0.65)] p-2.5 sm:p-3 flex flex-col justify-between relative overflow-hidden">
            {/* Subtle Inner Corner Specular Highlight */}
            <div
              className="pointer-events-none absolute -top-8 -left-8 w-28 h-28 rounded-full bg-white/60 dark:bg-sky-400/10 blur-xl"
              aria-hidden="true"
            />

            {/* Top Chart Stage Caption + Reset Filter */}
            <div className="relative flex items-center justify-between gap-2 px-0.5 z-10">
              <span className="text-[10.5px] font-bold text-slate-600 dark:text-slate-300 truncate">
                {chartMode === 'radial'
                  ? activeMetric
                    ? `โฟกัส: ${activeMetric.title}`
                    : 'แตะมาสคอตหรือวงแหวนเพื่อเจาะลึก'
                  : 'เทียบสัดส่วน 4 ขั้นตอน (%)'}
              </span>
              {focusedKey !== 'overview' && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setOrbPulseKey((p) => p + 1);
                    setFocusedKey('overview');
                  }}
                  className="px-2 py-0.5 rounded-lg bg-white/80 dark:bg-slate-800/85 hover:bg-white dark:hover:bg-slate-700 border border-white dark:border-slate-600/80 text-[10px] font-bold text-sky-700 dark:text-sky-300 flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs transition-colors"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>ดูรวม 4 มิติ</span>
                </button>
              )}
            </div>

            <div className="relative w-full my-0.5">
              {/* Interactive Animated 3D Mascot Companion */}
              <DimensionalMascotStage
                activeKey={effectiveKey}
                accentHex={activeMetric?.accentHex ?? '#0ea5e9'}
                pulseKey={orbPulseKey}
                onInteract={handleCycleOrb}
              />

              {chartMode === 'radial' ? (
                <div className="relative h-[224px] sm:h-[244px] ml-[66px] sm:ml-[80px] flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    accessibilityLayer={false}
                    cx="50%"
                    cy="50%"
                    innerRadius="43%"
                    outerRadius="98%"
                    barSize={12}
                    data={radialData}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <defs>
                      <linearGradient id="kpiRingGradCases" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" />
                        <stop offset="55%" stopColor="#0ea5e9" />
                        <stop offset="100%" stopColor="#2563eb" />
                      </linearGradient>
                      <linearGradient id="kpiRingGradDelivered" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#34d399" />
                        <stop offset="55%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#0d9488" />
                      </linearGradient>
                      <linearGradient id="kpiRingGradFinance" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#60a5fa" />
                        <stop offset="55%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#4338ca" />
                      </linearGradient>
                      <linearGradient id="kpiRingGradPa" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#fbbf24" />
                        <stop offset="55%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#ea580c" />
                      </linearGradient>
                      <filter id="kpiRingShadow" x="-15%" y="-15%" width="130%" height="130%">
                        <feDropShadow
                          dx="0"
                          dy="2"
                          stdDeviation="2.5"
                          floodColor="#0284c7"
                          floodOpacity="0.22"
                        />
                      </filter>
                      <filter id="kpiAuraSky" x="-30%" y="-30%" width="160%" height="160%">
                        <feDropShadow
                          dx="0"
                          dy="0"
                          stdDeviation="4.5"
                          floodColor="#0ea5e9"
                          floodOpacity="0.65"
                        />
                      </filter>
                      <filter id="kpiAuraTeal" x="-30%" y="-30%" width="160%" height="160%">
                        <feDropShadow
                          dx="0"
                          dy="0"
                          stdDeviation="4.5"
                          floodColor="#10b981"
                          floodOpacity="0.65"
                        />
                      </filter>
                      <filter id="kpiAuraIndigo" x="-30%" y="-30%" width="160%" height="160%">
                        <feDropShadow
                          dx="0"
                          dy="0"
                          stdDeviation="4.5"
                          floodColor="#6366f1"
                          floodOpacity="0.65"
                        />
                      </filter>
                      <filter id="kpiAuraAmber" x="-30%" y="-30%" width="160%" height="160%">
                        <feDropShadow
                          dx="0"
                          dy="0"
                          stdDeviation="4.5"
                          floodColor="#f59e0b"
                          floodOpacity="0.65"
                        />
                      </filter>
                    </defs>

                    <PolarAngleAxis
                      type="number"
                      domain={[0, 100]}
                      angleAxisId={0}
                      tick={false}
                    />

                    <RadialBar
                      background={{ fill: 'var(--chart-radial-track)' }}
                      dataKey="value"
                      cornerRadius={12}
                      animationDuration={650}
                      onClick={(entry) => {
                        const row = entry as unknown as RadialChartRow;
                        if (row?.key) handleSelectMetric(row.key);
                      }}
                      className="cursor-pointer"
                    >
                      {radialData.map((entry) => {
                        const isFocused = effectiveKey === 'overview' || effectiveKey === entry.key;
                        const isPinned = effectiveKey === entry.key;
                        const aura = AURA_GLOW_MAP[entry.key];
                        return (
                          <Cell
                            key={entry.key}
                            fill={`url(#${entry.gradientId})`}
                            fillOpacity={isFocused ? 1 : 0.28}
                            stroke={isPinned ? aura.rimColor : 'none'}
                            strokeWidth={isPinned ? 1.5 : 0}
                            filter={
                              isPinned ? `url(#${aura.filterId})` : 'url(#kpiRingShadow)'
                            }
                            style={{
                              transition: 'fill-opacity 240ms ease, filter 240ms ease',
                              cursor: 'pointer',
                              outline: 'none',
                            }}
                          />
                        );
                      })}
                    </RadialBar>

                    <Tooltip
                      wrapperStyle={{ pointerEvents: 'none', zIndex: 30 }}
                      content={<UnifiedChartTooltip />}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>

                {/* Floating 3D Center Crystal Medallion Orb (Tap to cycle dimensions) */}
                <button
                  type="button"
                  onClick={handleCycleOrb}
                  title="แตะเพื่อสลับดูรายละเอียดแต่ละมิติ"
                  aria-label="ศูนย์กลางสรุปผลงาน 4 มิติ แตะเพื่อสลับมิติ"
                  className="group absolute w-[88px] h-[88px] sm:w-[96px] sm:h-[96px] rounded-full flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 animate-kpi-float z-10"
                >
                  {/* Rotating Conic Specular Rim */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-[3px] rounded-full opacity-80 animate-kpi-orbit"
                    style={{
                      background: activeMetric
                        ? `conic-gradient(from 0deg, ${activeMetric.accentHex}55, transparent 42%, ${activeMetric.accentHex}88 70%, transparent)`
                        : 'conic-gradient(from 0deg, rgba(14,165,233,0.45), rgba(16,185,129,0.45), rgba(99,102,241,0.45), rgba(245,158,11,0.45), rgba(14,165,233,0.45))',
                    }}
                  />
                  {/* Frosted Crystal Sphere Body */}
                  <span className="relative w-full h-full rounded-full bg-gradient-to-b from-white/95 via-white/88 to-sky-50/92 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950 border-2 border-white dark:border-slate-600/80 shadow-[0_10px_24px_-6px_rgba(2,132,199,0.32),inset_0_2px_6px_rgba(255,255,255,1)] dark:shadow-[0_10px_24px_-6px_rgba(2,6,23,0.75),inset_0_2px_6px_rgba(255,255,255,0.08)] flex flex-col items-center justify-center px-1.5 text-center transition-transform duration-200 group-hover:scale-[1.03] group-active:scale-95">
                    {/* Specular Top Reflection */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1.5 inset-x-4 h-3 rounded-full bg-gradient-to-b from-white dark:from-sky-300/20 to-transparent opacity-90"
                    />
                    <div
                      key={`${effectiveKey}-${orbPulseKey}`}
                      className="relative flex flex-col items-center justify-center animate-number-tick"
                    >
                      <span className="text-[9px] sm:text-[9.5px] font-bold text-slate-500 dark:text-slate-400 leading-tight max-w-[74px] truncate">
                        {activeMetric ? activeMetric.shortTitle : 'รวม 4 มิติ'}
                      </span>
                      <span
                        className={`text-sm sm:text-[15px] font-black tabular-nums leading-tight mt-0.5 max-w-[82px] truncate ${
                          activeMetric ? activeMetric.textPrimaryClass : 'text-sky-950 dark:text-sky-100'
                        }`}
                      >
                        {activeMetric ? activeMetric.compactOrbValue : `${stats.totalCases} เคส`}
                      </span>
                      <span className="text-[9px] font-extrabold tabular-nums text-slate-600 dark:text-slate-300 mt-0.5 max-w-[76px] truncate">
                        {activeMetric
                          ? `${activeMetric.gaugeLabel.replace('อัตรา', '')} ${
                              activeMetric.percentDisplay
                            }`
                          : formatCompactBaht(stats.totalFinance)}
                      </span>
                    </div>
                  </span>
                </button>
              </div>
              ) : (
                /* 3D Gradient Funnel & Value Bar Chart */
                <div className="relative h-[224px] sm:h-[244px] ml-[66px] sm:ml-[80px] pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    accessibilityLayer={false}
                    data={barData}
                    margin={{ top: 20, right: 6, left: 6, bottom: 4 }}
                    barCategoryGap="22%"
                  >
                    <defs>
                      <linearGradient id="kpiBarGradCases" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity={1} />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0.92} />
                      </linearGradient>
                      <linearGradient id="kpiBarGradFinance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#818cf8" stopOpacity={1} />
                        <stop offset="100%" stopColor="#4338ca" stopOpacity={0.92} />
                      </linearGradient>
                      <linearGradient id="kpiBarGradDelivered" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity={1} />
                        <stop offset="100%" stopColor="#0d9488" stopOpacity={0.92} />
                      </linearGradient>
                      <linearGradient id="kpiBarGradPa" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fbbf24" stopOpacity={1} />
                        <stop offset="100%" stopColor="#ea580c" stopOpacity={0.92} />
                      </linearGradient>
                      <filter id="kpiBarShadow3D" x="-15%" y="-10%" width="130%" height="130%">
                        <feDropShadow
                          dx="2"
                          dy="4"
                          stdDeviation="3"
                          floodColor="#0f172a"
                          floodOpacity="0.14"
                        />
                      </filter>
                      <filter id="kpiAuraSky" x="-35%" y="-25%" width="170%" height="150%">
                        <feDropShadow
                          dx="0"
                          dy="0"
                          stdDeviation="5"
                          floodColor="#0ea5e9"
                          floodOpacity="0.7"
                        />
                      </filter>
                      <filter id="kpiAuraTeal" x="-35%" y="-25%" width="170%" height="150%">
                        <feDropShadow
                          dx="0"
                          dy="0"
                          stdDeviation="5"
                          floodColor="#10b981"
                          floodOpacity="0.7"
                        />
                      </filter>
                      <filter id="kpiAuraIndigo" x="-35%" y="-25%" width="170%" height="150%">
                        <feDropShadow
                          dx="0"
                          dy="0"
                          stdDeviation="5"
                          floodColor="#6366f1"
                          floodOpacity="0.7"
                        />
                      </filter>
                      <filter id="kpiAuraAmber" x="-35%" y="-25%" width="170%" height="150%">
                        <feDropShadow
                          dx="0"
                          dy="0"
                          stdDeviation="5"
                          floodColor="#f59e0b"
                          floodOpacity="0.7"
                        />
                      </filter>
                    </defs>

                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="var(--chart-grid)"
                    />
                    <XAxis
                      dataKey="stageLabel"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'var(--chart-tick)', fontSize: 10.5, fontWeight: 700 }}
                      dy={4}
                    />
                    <YAxis hide domain={[0, 118]} />
                    <Tooltip
                      cursor={false}
                      wrapperStyle={{ pointerEvents: 'none', zIndex: 30 }}
                      content={<UnifiedChartTooltip />}
                    />
                    <Bar
                      dataKey="value"
                      animationDuration={600}
                      shape={(shapeProps: unknown) => {
                        const p = shapeProps as AuraBarShapeProps;
                        return (
                          <Aura3DBarShape
                            x={p.x}
                            y={p.y}
                            width={p.width}
                            height={p.height}
                            payload={p.payload}
                            effectiveKey={effectiveKey}
                            onSelect={handleSelectMetric}
                          />
                        );
                      }}
                    >
                      <LabelList
                        dataKey="rawPercent"
                        position="top"
                        formatter={formatPercentLabel}
                        style={{
                          fill: 'var(--chart-label)',
                          fontSize: '10.5px',
                          fontWeight: 800,
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              )}
            </div>

            {/* Compact Ring Color Key Footer */}
            <div className="relative flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-1 border-t border-white/80 dark:border-slate-700/75 text-[10px] text-slate-600 dark:text-slate-300">
              {metrics.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => handleSelectMetric(m.key)}
                  onMouseEnter={() => setHoveredKey(m.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  className={`inline-flex items-center gap-1 transition-opacity cursor-pointer ${
                    effectiveKey === 'overview' || effectiveKey === m.key
                      ? 'opacity-100 font-bold text-slate-800 dark:text-slate-100'
                      : 'opacity-45 hover:opacity-85'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: m.accentHex }}
                  />
                  <span className="whitespace-nowrap">{m.shortTitle}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right / Bottom: Interactive Spotlight Strip + 4 Unified Metric Selector Cards */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-2.5">
            {/* Live Interactive Spotlight Strip */}
            <div
              className={`rounded-xl border p-2.5 sm:p-3 transition-all duration-300 relative overflow-hidden ${
                activeMetric
                  ? `${activeMetric.panelClass}`
                  : 'bg-gradient-to-r from-sky-50/85 via-white/80 to-teal-50/80 dark:from-slate-800/85 dark:via-slate-900/85 dark:to-sky-950/75 border-white/95 dark:border-slate-700/80'
              }`}
            >
              {activeMetric ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className={`w-7 h-7 rounded-xl bg-gradient-to-br ${activeMetric.iconBgClass} text-white border border-white/65 dark:border-white/20 flex items-center justify-center shrink-0 shadow-sm`}
                      >
                        {activeMetric.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <MarqueeText className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
                            {activeMetric.title}
                          </MarqueeText>
                          <span
                            className={`px-1.5 py-0.5 rounded-md border text-[9.5px] font-extrabold tabular-nums whitespace-nowrap shrink-0 ${activeMetric.badgeClass}`}
                          >
                            {activeMetric.gaugeLabel} {activeMetric.percentDisplay}
                          </span>
                        </div>
                        <MarqueeText
                          className={`text-sm sm:text-base font-black tabular-nums ${activeMetric.textPrimaryClass}`}
                        >
                          {activeMetric.primaryValue}
                        </MarqueeText>
                      </div>
                    </div>

                    {activeMetric.key === 'pa' && onNavigateToCheckerCommission ? (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          onNavigateToCheckerCommission();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-800/85 hover:bg-white dark:hover:bg-slate-700 border border-white dark:border-slate-600/80 text-[10.5px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs transition-colors"
                      >
                        <span>ดูตาราง PA</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    ) : onOpenSavedCases ? (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          onOpenSavedCases();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-800/85 hover:bg-white dark:hover:bg-slate-700 border border-white dark:border-slate-600/80 text-[10.5px] font-bold text-sky-800 dark:text-sky-300 flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs transition-colors"
                      >
                        <span>เปิดตารางเคส</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    ) : null}
                  </div>

                  {/* Shimmer Gauge Bar with Glowing Tip */}
                  <div className="relative py-0.5">
                    <div className="h-2 w-full rounded-full bg-white/80 dark:bg-slate-800/85 border border-white dark:border-slate-700/80 shadow-inner overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${activeMetric.gaugeFillClass} ${
                          activeMetric.percent > 0 ? 'animate-fuel-shimmer' : ''
                        } transition-all duration-500 ease-out`}
                        style={{ width: `${activeMetric.percent}%` }}
                      />
                    </div>
                    {activeMetric.percent > 0 && (
                      <div
                        className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-500 ease-out z-10"
                        style={{ left: `${Math.min(98.5, Math.max(2, activeMetric.percent))}%` }}
                      >
                        <span
                          className={`absolute inset-0 w-3 h-3 -m-[2.5px] rounded-full ${activeMetric.tipColorClass} animate-fuel-tip-ping`}
                        />
                        <span className="block w-2 h-2 rounded-full bg-white border-[1.5px] border-slate-800 shadow-sm" />
                      </div>
                    )}
                  </div>

                  <MarqueeText className="text-[10.5px] font-medium text-slate-600 dark:text-slate-300 tabular-nums">
                    {activeMetric.spotlightDetail}
                  </MarqueeText>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2.5">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="text-[10.5px] font-bold text-slate-600 dark:text-slate-300">
                      สรุปมูลค่า & ประสิทธิภาพรวม ({periodLabel})
                    </div>
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                      <span className="text-base sm:text-lg font-black text-sky-950 dark:text-sky-100 tabular-nums">
                        {formatBaht(displayFinance)}
                      </span>
                      <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 tabular-nums whitespace-nowrap">
                        รับรถ {stats.deliveredCount}/{stats.totalCases} ({deliveryOfTotalRate.toFixed(0)}%)
                      </span>
                      <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 tabular-nums whitespace-nowrap">
                        PA {formatBaht(commissionSummary.totalCommissionBaht)}
                      </span>
                    </div>
                  </div>
                  {onOpenSavedCases && (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('selection');
                        onOpenSavedCases();
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-white/85 dark:bg-slate-800/85 hover:bg-white dark:hover:bg-slate-700 border border-white dark:border-slate-600/80 text-[11px] font-bold text-sky-700 dark:text-sky-300 hover:text-sky-900 dark:hover:text-sky-200 flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs transition-colors"
                    >
                      <span>เคสทั้งหมด</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 4 Interactive KPI Selector Cards (2x2 Grid) with 3D Animated Mini Charts */}
            <div className="grid grid-cols-2 gap-2 flex-1">
              {metrics.map((m) => {
                const isSelected = effectiveKey === m.key;
                const isDimmed = effectiveKey !== 'overview' && !isSelected;
                return (
                  <button
                    key={m.key}
                    type="button"
                    aria-pressed={focusedKey === m.key}
                    onClick={() => handleSelectMetric(m.key)}
                    onMouseEnter={() => setHoveredKey(m.key)}
                    onMouseLeave={() => setHoveredKey(null)}
                    className={`group ${m.panelClass} text-left rounded-xl p-2.5 sm:p-3 flex flex-col justify-between gap-1.5 relative overflow-hidden cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 min-w-0 ${
                      isSelected
                        ? m.activeRingClass
                        : isDimmed
                        ? 'opacity-70 hover:opacity-100'
                        : 'hover:-translate-y-0.5 hover:shadow-sm'
                    }`}
                  >
                    {/* Top Hairline */}
                    <div
                      className="pointer-events-none inset-x-3 top-0 absolute h-px bg-gradient-to-r from-transparent via-white dark:via-sky-300/35 to-transparent opacity-95"
                      aria-hidden="true"
                    />

                    <div className="flex items-center justify-between gap-1.5">
                      <MarqueeText className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                        {m.title}
                      </MarqueeText>
                      <span
                        className={`w-6 h-6 rounded-lg bg-gradient-to-br ${m.iconBgClass} text-white border border-white/60 dark:border-white/20 flex items-center justify-center shrink-0 shadow-xs transition-transform duration-200 ${
                          isSelected ? 'scale-110' : 'group-hover:scale-105'
                        }`}
                      >
                        {m.icon}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <MarqueeText
                        className={`text-base sm:text-lg font-black tabular-nums leading-tight ${m.textPrimaryClass}`}
                      >
                        {m.primaryValue}
                      </MarqueeText>
                      <MarqueeText className="text-[10px] sm:text-[10.5px] text-slate-600 dark:text-slate-300 tabular-nums mt-0.5">
                        {m.subText}
                      </MarqueeText>
                    </div>

                    {/* 3D Animated Mini Chart inside each card */}
                    <KpiMiniCardChart
                      metricKey={m.key}
                      buckets={fallbackMiniSeries}
                      percent={m.percent}
                      tier={commissionSummary.tier}
                      isSelected={isSelected}
                      animSeed={`${periodLabel}-${stats.totalCases}-${stats.deliveredCount}-${commissionSummary.totalInsuredContracts}`}
                    />

                    {/* Mini Interactive Gauge Bar inside each unified tile */}
                    <div className="space-y-0.5 pt-0.5">
                      <div className="flex items-center justify-between text-[9.5px] text-slate-500 dark:text-slate-400 tabular-nums">
                        <span className="truncate">{m.gaugeLabel}</span>
                        <span className="font-extrabold text-slate-700 dark:text-slate-200 shrink-0">
                          {m.percentDisplay}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-white/75 dark:bg-slate-800/85 border border-white/95 dark:border-slate-700/80 overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${m.gaugeFillClass} ${
                            m.percent > 0 && (isSelected || effectiveKey === 'overview')
                              ? 'animate-fuel-shimmer'
                              : ''
                          } transition-all duration-500 ease-out`}
                          style={{ width: `${m.percent}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
