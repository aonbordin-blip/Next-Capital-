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
import { BarChart3 } from 'lucide-react';
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

function clampPercent(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.max(0, Math.min(100, val));
}

function buildMiniSmoothPath(points: Array<{ x: number; y: number }>): string {
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

function pickCompactMonthlyWindow(
  buckets: MonthlyBucketDatum[],
  peakKey?: string | null
): MonthlyBucketDatum[] {
  if (buckets.length <= 6) return buckets;

  const activeIndices: number[] = [];
  let peakIdx = -1;
  buckets.forEach((b, idx) => {
    if (b.total > 0) activeIndices.push(idx);
    if (peakKey && b.key === peakKey) peakIdx = idx;
  });

  if (activeIndices.length === 0) {
    return buckets.slice(-6);
  }

  if (activeIndices.length >= 6) {
    const picked = new Set<number>(activeIndices.slice(-6));
    if (peakIdx >= 0 && !picked.has(peakIdx)) {
      const firstActive = activeIndices[activeIndices.length - 6];
      picked.delete(firstActive);
      picked.add(peakIdx);
    }
    return Array.from(picked)
      .sort((a, b) => a - b)
      .map((i) => buckets[i]);
  }

  const picked = new Set<number>(activeIndices);
  const anchor = activeIndices[activeIndices.length - 1];
  for (let offset = 1; picked.size < 6 && offset <= buckets.length; offset++) {
    if (anchor + offset < buckets.length) picked.add(anchor + offset);
    if (picked.size >= 6) break;
    if (anchor - offset >= 0) picked.add(anchor - offset);
  }

  return Array.from(picked)
    .sort((a, b) => a - b)
    .map((i) => buckets[i]);
}

type MonthlyMiniVariant = 'total' | 'average' | 'peak' | 'approval';

interface MonthlyKpiMiniChartProps {
  variant: MonthlyMiniVariant;
  chartData: MonthlyBucketDatum[];
  avgPerActiveMonth: number;
  peakBucket: MonthlyBucketDatum | null;
  totalApproved: number;
  totalDelivered: number;
  isHighlighted?: boolean;
  animSeed: string;
}

const MonthlyKpiMiniChart: React.FC<MonthlyKpiMiniChartProps> = ({
  variant,
  chartData,
  avgPerActiveMonth,
  peakBucket,
  totalApproved,
  totalDelivered,
  isHighlighted = false,
  animSeed,
}) => {
  if (variant === 'total') {
    const series = chartData.length > 12 ? chartData.slice(-12) : chartData;
    const count = Math.max(1, series.length);
    const maxTotal = Math.max(1, ...series.map((d) => d.total));
    const slotWidth = 156 / count;
    const barW = Math.min(14, Math.max(7.2, slotWidth * 0.64));

    return (
      <div
        key={`mdash-total-${animSeed}`}
        className="relative h-[38px] sm:h-[42px] w-full transition-transform duration-300 group-hover:scale-[1.015]"
        aria-hidden="true"
      >
        <svg viewBox="0 0 156 42" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="mDashSkyColGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="55%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
            <linearGradient id="mDashSkyPeakGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="50%" stopColor="#0284c7" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>
            <filter id="mDashSkyGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#0284c7" floodOpacity="0.34" />
            </filter>
          </defs>

          <line
            x1="3"
            y1="37"
            x2="153"
            y2="37"
            stroke="currentColor"
            className="text-sky-900/15 dark:text-sky-200/15"
            strokeWidth="1"
            strokeLinecap="round"
          />

          {series.map((d, idx) => {
            const x = idx * slotWidth + (slotWidth - barW) / 2;
            const hasCases = d.total > 0;
            const h = hasCases ? Math.max(7, (d.total / maxTotal) * 28) : 3.2;
            const y = 36.5 - h;
            const isPeak = hasCases && peakBucket?.key === d.key;

            return (
              <g
                key={`${d.key}-${idx}`}
                className="animate-kpi-mini-bar"
                style={{ animationDelay: `${idx * 32}ms` }}
              >
                <ellipse
                  cx={x + barW / 2}
                  cy={38}
                  rx={barW * 0.45}
                  ry={1.15}
                  fill="#0369a1"
                  fillOpacity={hasCases ? 0.16 : 0.05}
                />

                {hasCases ? (
                  <g filter={isPeak ? 'url(#mDashSkyGlow)' : undefined}>
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={h}
                      rx={Math.min(3.5, barW * 0.36)}
                      fill={isPeak ? 'url(#mDashSkyPeakGrad)' : 'url(#mDashSkyColGrad)'}
                    />
                    <rect
                      x={x + 1.2}
                      y={y + 1.1}
                      width={Math.max(2, barW - 2.4)}
                      height={Math.min(3.4, Math.max(1.4, h * 0.26))}
                      rx={1.2}
                      fill="#ffffff"
                      fillOpacity={0.62}
                    />
                  </g>
                ) : (
                  <rect
                    x={x}
                    y={y}
                    width={barW}
                    height={h}
                    rx={1.6}
                    fill="#7dd3fc"
                    fillOpacity={0.28}
                    stroke="#38bdf8"
                    strokeOpacity={0.22}
                    strokeWidth={0.6}
                  />
                )}

                {isPeak && (
                  <g>
                    <circle
                      cx={x + barW / 2}
                      cy={Math.max(3, y - 3)}
                      r={2.1}
                      fill="#0ea5e9"
                      className="animate-fuel-tip-ping"
                      style={{ transformOrigin: `${x + barW / 2}px ${Math.max(3, y - 3)}px` }}
                    />
                    <circle
                      cx={x + barW / 2}
                      cy={Math.max(3, y - 3)}
                      r={1.5}
                      fill="#ffffff"
                      stroke="#0284c7"
                      strokeWidth={0.95}
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

  if (variant === 'average') {
    const series = chartData.length > 12 ? chartData.slice(-12) : chartData;
    const count = series.length;
    const maxTotal = Math.max(1, avgPerActiveMonth, ...series.map((d) => d.total));
    const points = series.map((d, idx) => {
      const x = count > 1 ? 7 + (idx / (count - 1)) * 142 : 78;
      const y = d.total > 0 ? 33 - (d.total / maxTotal) * 23.5 : 33.5;
      return { x, y, total: d.total };
    });

    const linePath = buildMiniSmoothPath(points);
    const areaPath =
      points.length > 0
        ? `${linePath} L ${points[points.length - 1].x.toFixed(2)} 37 L ${points[0].x.toFixed(2)} 37 Z`
        : '';

    const avgY =
      avgPerActiveMonth > 0 ? Math.max(7, 33 - (avgPerActiveMonth / maxTotal) * 23.5) : 33.5;

    let latestActiveIdx = points.length - 1;
    for (let i = points.length - 1; i >= 0; i--) {
      if (points[i].total > 0) {
        latestActiveIdx = i;
        break;
      }
    }

    return (
      <div
        key={`mdash-avg-${animSeed}`}
        className="relative h-[38px] sm:h-[42px] w-full transition-transform duration-300 group-hover:scale-[1.015]"
        aria-hidden="true"
      >
        <svg viewBox="0 0 156 42" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="mDashAmberAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.46" />
              <stop offset="65%" stopColor="#fbbf24" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#d97706" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="mDashAmberStrokeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#ea580c" />
            </linearGradient>
            <filter id="mDashAmberGlow" x="-20%" y="-25%" width="140%" height="160%">
              <feDropShadow dx="0" dy="2.2" stdDeviation="2" floodColor="#d97706" floodOpacity="0.36" />
            </filter>
          </defs>

          <line
            x1="3"
            y1="37"
            x2="153"
            y2="37"
            stroke="currentColor"
            className="text-amber-900/15 dark:text-amber-200/15"
            strokeWidth="1"
            strokeLinecap="round"
          />

          {/* Dashed Average Benchmark Line */}
          {avgPerActiveMonth > 0 && (
            <g className="animate-kpi-mini-area">
              <line
                x1="4"
                y1={avgY}
                x2="151"
                y2={avgY}
                stroke="#d97706"
                strokeOpacity={0.62}
                strokeWidth="1.05"
                strokeDasharray="3 2.5"
              />
              <circle
                cx="150"
                cy={avgY}
                r={1.7}
                fill="#ffffff"
                stroke="#d97706"
                strokeWidth={1.1}
              />
            </g>
          )}

          {areaPath && (
            <path
              d={areaPath}
              fill="url(#mDashAmberAreaGrad)"
              className="animate-kpi-mini-area"
            />
          )}

          {linePath && (
            <g filter="url(#mDashAmberGlow)">
              <path
                d={linePath}
                fill="none"
                stroke="url(#mDashAmberStrokeGrad)"
                strokeWidth={2.35}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-kpi-mini-line"
              />
              <path
                d={linePath}
                fill="none"
                stroke="#ffffff"
                strokeOpacity={0.55}
                strokeWidth={0.8}
                strokeLinecap="round"
                transform="translate(0, -0.65)"
                className="animate-kpi-mini-line"
              />
            </g>
          )}

          {points.map((pt, idx) => {
            const isHero = idx === latestActiveIdx && pt.total > 0;
            if (pt.total === 0) {
              return (
                <circle
                  key={`avg-pt-${idx}`}
                  cx={pt.x}
                  cy={pt.y}
                  r={1.2}
                  fill="#f59e0b"
                  fillOpacity={0.28}
                />
              );
            }
            return (
              <g key={`avg-pt-${idx}`}>
                {isHero && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={4}
                    fill="#f59e0b"
                    fillOpacity={0.32}
                    className="animate-fuel-tip-ping"
                    style={{ transformOrigin: `${pt.x}px ${pt.y}px` }}
                  />
                )}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHero ? 2.55 : 2}
                  fill="#ffffff"
                  stroke="#d97706"
                  strokeWidth={isHero ? 1.45 : 1.15}
                />
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  if (variant === 'peak') {
    const windowBuckets = pickCompactMonthlyWindow(chartData, peakBucket?.key);
    const count = Math.max(1, windowBuckets.length);
    const maxTotal = Math.max(1, ...windowBuckets.map((d) => d.total));
    const slotWidth = 156 / count;

    return (
      <div
        key={`mdash-peak-${animSeed}`}
        className={`relative h-[38px] sm:h-[42px] w-full transition-transform duration-300 ${
          isHighlighted ? 'scale-[1.02]' : 'group-hover:scale-[1.015]'
        }`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 156 42" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="mDashIndigoPeakFront" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a5b4fc" />
              <stop offset="45%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#4338ca" />
            </linearGradient>
            <linearGradient id="mDashIndigoPeakSide" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" />
              <stop offset="100%" stopColor="#312e81" />
            </linearGradient>
            <linearGradient id="mDashIndigoSoftFront" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.62" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.46" />
            </linearGradient>
            <filter id="mDashIndigoGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="1" dy="2.5" stdDeviation="2.2" floodColor="#4f46e5" floodOpacity="0.38" />
            </filter>
          </defs>

          <line
            x1="3"
            y1="37"
            x2="153"
            y2="37"
            stroke="currentColor"
            className="text-indigo-900/15 dark:text-indigo-200/15"
            strokeWidth="1"
            strokeLinecap="round"
          />

          {windowBuckets.map((d, idx) => {
            const frontW = 10.5;
            const depthX = 3.5;
            const depthY = 2.6;
            const x = idx * slotWidth + (slotWidth - (frontW + depthX)) / 2;
            const hasCases = d.total > 0;
            const barH = hasCases ? Math.max(6, (d.total / maxTotal) * 25.5) : 2.5;
            const y = 36.5 - barH;
            const isPeak = hasCases && peakBucket?.key === d.key;

            return (
              <g
                key={`${d.key}-${idx}`}
                className="animate-kpi-mini-bar"
                style={{ animationDelay: `${idx * 55}ms` }}
                filter={isPeak ? 'url(#mDashIndigoGlow)' : undefined}
              >
                <ellipse
                  cx={x + (frontW + depthX) / 2}
                  cy={38}
                  rx={frontW * 0.58}
                  ry={1.25}
                  fill="#3730a3"
                  fillOpacity={isPeak ? 0.24 : hasCases ? 0.14 : 0.05}
                />

                {/* Right 3D Side Facet */}
                <polygon
                  points={`${x + frontW},${y} ${x + frontW + depthX},${y - depthY} ${x + frontW + depthX},${36.5 - depthY} ${x + frontW},36.5`}
                  fill={isPeak ? 'url(#mDashIndigoPeakSide)' : '#4f46e5'}
                  fillOpacity={isPeak ? 0.96 : hasCases ? 0.42 : 0.16}
                />

                {/* Top 3D Bevel Cap */}
                <polygon
                  points={`${x},${y} ${x + depthX},${y - depthY} ${x + frontW + depthX},${y - depthY} ${x + frontW},${y}`}
                  fill={isPeak ? '#e0e7ff' : '#c7d2fe'}
                  fillOpacity={isPeak ? 0.98 : hasCases ? 0.72 : 0.28}
                />

                {/* Front Crystal Face */}
                <rect
                  x={x}
                  y={y}
                  width={frontW}
                  height={barH}
                  rx={1.2}
                  fill={isPeak ? 'url(#mDashIndigoPeakFront)' : 'url(#mDashIndigoSoftFront)'}
                  fillOpacity={hasCases ? 1 : 0.28}
                />

                {hasCases && barH > 5 && (
                  <line
                    x1={x + 1.3}
                    y1={y + 1.1}
                    x2={x + 1.3}
                    y2={35.5}
                    stroke="#ffffff"
                    strokeOpacity={isPeak ? 0.62 : 0.35}
                    strokeWidth={0.9}
                    strokeLinecap="round"
                  />
                )}

                {/* Peak Crown Beacon */}
                {isPeak && (
                  <g>
                    <circle
                      cx={x + (frontW + depthX) / 2}
                      cy={Math.max(3, y - 5.2)}
                      r={2.2}
                      fill="#6366f1"
                      className="animate-fuel-tip-ping"
                      style={{ transformOrigin: `${x + (frontW + depthX) / 2}px ${Math.max(3, y - 5.2)}px` }}
                    />
                    <circle
                      cx={x + (frontW + depthX) / 2}
                      cy={Math.max(3, y - 5.2)}
                      r={1.6}
                      fill="#ffffff"
                      stroke="#4f46e5"
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

  // variant === 'approval': 3D Delivery Conversion Donut + Approved vs Delivered Pipeline Columns
  const windowBuckets = pickCompactMonthlyWindow(chartData, peakBucket?.key);
  const count = Math.max(1, windowBuckets.length);
  const deliveryRatePct =
    totalApproved > 0 ? clampPercent((totalDelivered / totalApproved) * 100) : 0;
  const ringRadius = 13.5;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringOffset = ringCirc - (deliveryRatePct / 100) * ringCirc;
  const maxApprovedInWindow = Math.max(
    1,
    ...windowBuckets.map((d) => Math.max(d.delivered + d.approvedPendingDelivery, d.delivered))
  );
  const colSlotW = 104 / count;

  return (
    <div
      key={`mdash-approval-${animSeed}`}
      className="relative h-[38px] sm:h-[42px] w-full flex items-center gap-1.5 transition-transform duration-300 group-hover:scale-[1.015]"
      aria-hidden="true"
    >
      {/* Left 3D Emerald-Teal Conversion Gauge */}
      <div className="relative w-[36px] h-[36px] shrink-0 flex items-center justify-center animate-kpi-mini-float">
        <svg viewBox="0 0 36 36" className="w-full h-full overflow-visible -rotate-90">
          <defs>
            <linearGradient id="mDashTealRingGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="55%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
            <filter id="mDashTealGlow" x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="1.8" floodColor="#059669" floodOpacity="0.38" />
            </filter>
          </defs>
          <circle
            cx="18"
            cy="18"
            r={ringRadius}
            fill="none"
            stroke="currentColor"
            className="text-emerald-900/12 dark:text-emerald-200/15"
            strokeWidth="3.8"
          />
          <circle
            cx="18"
            cy="18"
            r={ringRadius}
            fill="none"
            stroke="url(#mDashTealRingGrad)"
            strokeWidth="3.8"
            strokeLinecap="round"
            strokeDasharray={ringCirc}
            strokeDashoffset={ringOffset}
            filter="url(#mDashTealGlow)"
            style={{ transition: 'stroke-dashoffset 650ms cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black tabular-nums text-emerald-800 dark:text-emerald-200">
          {Math.round(deliveryRatePct)}%
        </span>
      </div>

      {/* Right Paired Approved (Outer Shell) vs Delivered (Inner 3D Crystal) Columns */}
      <div className="flex-1 h-[38px] sm:h-[42px] min-w-0">
        <svg viewBox="0 0 104 42" className="block w-full h-full overflow-visible">
          <defs>
            <linearGradient id="mDashTealColGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="55%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#0d9488" />
            </linearGradient>
          </defs>

          <line
            x1="2"
            y1="37"
            x2="102"
            y2="37"
            stroke="currentColor"
            className="text-emerald-900/15 dark:text-emerald-200/15"
            strokeWidth="1"
            strokeLinecap="round"
          />

          {windowBuckets.map((d, idx) => {
            const barW = 10.5;
            const x = idx * colSlotW + (colSlotW - barW) / 2;
            const approvedVal = Math.max(d.delivered + d.approvedPendingDelivery, d.delivered);
            const approvedH =
              approvedVal > 0 ? Math.max(7, (approvedVal / maxApprovedInWindow) * 28) : 3.2;
            const deliveredH =
              d.delivered > 0
                ? Math.max(5, Math.min(approvedH, (d.delivered / maxApprovedInWindow) * 28))
                : 0;
            const approvedY = 36.5 - approvedH;
            const deliveredY = 36.5 - deliveredH;

            return (
              <g
                key={`${d.key}-${idx}`}
                className="animate-kpi-mini-bar"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <ellipse
                  cx={x + barW / 2}
                  cy={38}
                  rx={barW * 0.44}
                  ry={1.15}
                  fill="#047857"
                  fillOpacity={approvedVal > 0 ? 0.16 : 0.05}
                />

                <rect
                  x={x}
                  y={approvedY}
                  width={barW}
                  height={approvedH}
                  rx={3}
                  fill="#34d399"
                  fillOpacity={approvedVal > 0 ? 0.22 : 0.1}
                  stroke="#10b981"
                  strokeOpacity={approvedVal > 0 ? 0.45 : 0.18}
                  strokeWidth={0.7}
                />

                {deliveredH > 0 && (
                  <>
                    <rect
                      x={x + 1.2}
                      y={deliveredY}
                      width={barW - 2.4}
                      height={deliveredH}
                      rx={2.3}
                      fill="url(#mDashTealColGrad)"
                    />
                    <rect
                      x={x + 2.1}
                      y={deliveredY + 1}
                      width={Math.max(2, barW - 4.2)}
                      height={Math.min(3.2, Math.max(1.4, deliveredH * 0.26))}
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

interface CustomTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: MonthlyBucketDatum }>;
}

const MonthlyChartTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0]?.payload;
  if (!datum) return null;

  return (
    <div className="rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700/85 shadow-lg px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 min-w-[190px]">
      <div className="font-bold text-slate-900 dark:text-slate-50 pb-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
        <span>{datum.fullLabel}</span>
        <span className="font-mono tabular-nums text-sky-700 dark:text-sky-300 font-extrabold">
          {datum.total} เคส
        </span>
      </div>
      <div className="pt-1.5 space-y-1 text-[11px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-emerald-700 dark:text-emerald-300 font-medium">รับรถแล้ว</span>
          <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
            {datum.delivered}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sky-700 dark:text-sky-300 font-medium">อนุมัติ (รอรับรถ)</span>
          <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
            {datum.approvedPendingDelivery}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-amber-700 dark:text-amber-300 font-medium">รอผล / บันทึกไว้</span>
          <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
            {datum.pending}
          </span>
        </div>
        {datum.closedOther > 0 && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500 dark:text-slate-400 font-medium">ไม่อนุมัติ / ยกเลิก</span>
            <span className="font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300">
              {datum.closedOther}
            </span>
          </div>
        )}
        <div className="pt-1 mt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <span className="text-slate-500 dark:text-slate-400">ยอดจัดรวม</span>
          <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
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
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white dark:via-sky-300/35 to-transparent opacity-90"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none -right-12 -top-12 absolute w-40 h-40 rounded-full bg-sky-200/30 dark:bg-sky-500/15 blur-2xl"
        aria-hidden="true"
      />

      {/* Header Row */}
      <div className="relative flex items-start sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 border border-white/65 dark:border-sky-300/30 text-white flex items-center justify-center shrink-0 shadow-sm shadow-sky-500/25">
            <BarChart3 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <MarqueeText className="text-[13.5px] sm:text-base font-black text-slate-900 dark:text-slate-50 tracking-tight">
              Dashboard สรุปจำนวนเคสรายเดือน
            </MarqueeText>
            <MarqueeText className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              สถิติเคสที่บันทึกไว้แยกตามเดือน
              {typeof effectiveYearFilter === 'number'
                ? ` · ปี พ.ศ. ${effectiveYearFilter + 543}`
                : ''}
              {` · ทั้งหมดในเครื่อง ${savedCases.length} เคส`}
            </MarqueeText>
          </div>
        </div>

        {availableYears.length > 1 && (
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap justify-end">
            <div className="flex items-center gap-1 p-1 bg-sky-100/55 dark:bg-slate-800/80 border border-white/80 dark:border-slate-700/80 rounded-xl">
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
                      ? 'bg-white dark:bg-sky-500 text-sky-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {y + 543}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Empty State */}
      {savedCases.length === 0 ? (
        <div className="relative rounded-2xl glass-panel-blue px-4 py-6 text-center space-y-3">
          <div className="w-11 h-11 rounded-2xl bg-white/65 dark:bg-slate-800/85 backdrop-blur-sm border border-white/90 dark:border-slate-700 text-sky-600 dark:text-sky-300 flex items-center justify-center mx-auto shadow-xs">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <div className="text-sm font-bold text-sky-950 dark:text-sky-100">
              ยังไม่มีข้อมูลเคสสำหรับแสดงกราฟ
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
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
                className="glass-pill px-4 py-2 rounded-xl text-slate-700 dark:text-slate-200 text-xs font-bold whitespace-nowrap cursor-pointer transition-all hover:-translate-y-0.5"
              >
                ดูรายการเคส
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* KPI Summary Strip */}
          {(() => {
            const animSeed = `${effectiveYearFilter}-${monthScope}-${summaryStats.totalCases}-${summaryStats.totalDelivered}`;
            const isPeakSelected =
              Boolean(summaryStats.peakBucket) && selectedMonthKey === summaryStats.peakBucket?.key;
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                <div className="group glass-panel-blue dashboard-card-lift rounded-xl p-2.5 sm:p-3 flex flex-col justify-between gap-1.5 min-w-0">
                  <div className="space-y-0.5 min-w-0">
                    <MarqueeText className="text-[10.5px] sm:text-[11px] font-semibold text-sky-900/80 dark:text-sky-200/90">
                      จำนวนเคสช่วงนี้
                    </MarqueeText>
                    <div className="text-base sm:text-xl font-black text-sky-950 dark:text-sky-100 font-mono tabular-nums whitespace-nowrap">
                      {summaryStats.totalCases}
                      <span className="text-[11px] font-semibold text-sky-800/70 dark:text-sky-300/80 ml-1 font-sans">
                        เคส
                      </span>
                    </div>
                  </div>
                  <MonthlyKpiMiniChart
                    variant="total"
                    chartData={chartData}
                    avgPerActiveMonth={summaryStats.avgPerActiveMonth}
                    peakBucket={summaryStats.peakBucket}
                    totalApproved={summaryStats.totalApproved}
                    totalDelivered={summaryStats.totalDelivered}
                    animSeed={animSeed}
                  />
                </div>

                <div className="group glass-panel-amber dashboard-card-lift rounded-xl p-2.5 sm:p-3 flex flex-col justify-between gap-1.5 min-w-0">
                  <div className="space-y-0.5 min-w-0">
                    <MarqueeText className="text-[10.5px] sm:text-[11px] font-semibold text-amber-900/80 dark:text-amber-200/90">
                      เฉลี่ยต่อเดือนที่มีเคส
                    </MarqueeText>
                    <div className="text-base sm:text-xl font-black text-amber-900 dark:text-amber-200 font-mono tabular-nums whitespace-nowrap">
                      {summaryStats.avgPerActiveMonth.toFixed(1)}
                      <span className="text-[11px] font-semibold text-amber-800/70 dark:text-amber-300/80 ml-1 font-sans">
                        / ด. ({summaryStats.activeMonthCount})
                      </span>
                    </div>
                  </div>
                  <MonthlyKpiMiniChart
                    variant="average"
                    chartData={chartData}
                    avgPerActiveMonth={summaryStats.avgPerActiveMonth}
                    peakBucket={summaryStats.peakBucket}
                    totalApproved={summaryStats.totalApproved}
                    totalDelivered={summaryStats.totalDelivered}
                    animSeed={animSeed}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const peak = summaryStats.peakBucket;
                    if (!peak) return;
                    triggerHaptic('light');
                    setSelectedMonthKey((prev) => (prev === peak.key ? null : peak.key));
                  }}
                  disabled={!summaryStats.peakBucket}
                  className={`group text-left glass-panel-indigo dashboard-card-lift rounded-xl p-2.5 sm:p-3 flex flex-col justify-between gap-1.5 min-w-0 transition-all ${
                    summaryStats.peakBucket ? 'cursor-pointer' : 'cursor-default'
                  } ${
                    isPeakSelected
                      ? 'ring-2 ring-indigo-400/80 shadow-md shadow-indigo-500/15'
                      : ''
                  }`}
                >
                  <div className="space-y-0.5 min-w-0 w-full">
                    <MarqueeText className="text-[10.5px] sm:text-[11px] font-semibold text-indigo-900/80 dark:text-indigo-200/90">
                      เดือนที่บันทึกสูงสุด
                    </MarqueeText>
                    <div className="text-base sm:text-xl font-black text-indigo-800 dark:text-indigo-200 font-mono tabular-nums whitespace-nowrap">
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
                  <MonthlyKpiMiniChart
                    variant="peak"
                    chartData={chartData}
                    avgPerActiveMonth={summaryStats.avgPerActiveMonth}
                    peakBucket={summaryStats.peakBucket}
                    totalApproved={summaryStats.totalApproved}
                    totalDelivered={summaryStats.totalDelivered}
                    isHighlighted={isPeakSelected}
                    animSeed={animSeed}
                  />
                </button>

                <div className="group glass-panel-teal dashboard-card-lift rounded-xl p-2.5 sm:p-3 flex flex-col justify-between gap-1.5 min-w-0">
                  <div className="space-y-0.5 min-w-0">
                    <MarqueeText className="text-[10.5px] sm:text-[11px] font-semibold text-teal-900/80 dark:text-teal-200/90">
                      อนุมัติ / รับรถแล้ว
                    </MarqueeText>
                    <div className="text-base sm:text-xl font-black text-emerald-700 dark:text-emerald-300 font-mono tabular-nums whitespace-nowrap">
                      {summaryStats.totalApproved}
                      <span className="text-slate-400 dark:text-slate-500 mx-1">/</span>
                      {summaryStats.totalDelivered}
                      <span className="text-[11px] font-semibold text-teal-800/70 dark:text-teal-300/80 ml-1 font-sans">
                        คัน
                      </span>
                    </div>
                  </div>
                  <MonthlyKpiMiniChart
                    variant="approval"
                    chartData={chartData}
                    avgPerActiveMonth={summaryStats.avgPerActiveMonth}
                    peakBucket={summaryStats.peakBucket}
                    totalApproved={summaryStats.totalApproved}
                    totalDelivered={summaryStats.totalDelivered}
                    animSeed={animSeed}
                  />
                </div>
              </div>
            );
          })()}

          {/* Interactive Filter Toolbar (Single-Row Balanced Controls) */}
          <div className="flex items-center justify-between gap-1.5 sm:gap-2 pt-2.5 border-t border-sky-200/45 dark:border-slate-700/75 overflow-x-auto">
            <div className="inline-flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 bg-sky-100/55 dark:bg-slate-800/80 backdrop-blur-sm border border-white/85 dark:border-slate-700/80 rounded-xl shrink-0 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setChartMode('total');
                }}
                className={`px-2 sm:px-2.5 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold rounded-[9px] transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  chartMode === 'total'
                    ? 'bg-white dark:bg-sky-500 text-sky-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                เคสรวม
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setChartMode('status');
                }}
                className={`px-2 sm:px-2.5 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold rounded-[9px] transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  chartMode === 'status'
                    ? 'bg-white dark:bg-sky-500 text-sky-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                แยกสถานะ
              </button>
            </div>

            <div className="inline-flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 bg-sky-100/55 dark:bg-slate-800/80 backdrop-blur-sm border border-white/85 dark:border-slate-700/80 rounded-xl shrink-0 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setMonthScope('all_12');
                }}
                className={`px-2 sm:px-2.5 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold rounded-[9px] transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  monthScope === 'all_12'
                    ? 'bg-white dark:bg-sky-500 text-sky-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                12 เดือน
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setMonthScope('active_only');
                }}
                className={`px-2 sm:px-2.5 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold rounded-[9px] transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  monthScope === 'active_only'
                    ? 'bg-white dark:bg-sky-500 text-sky-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                ที่มีเคส
              </button>
            </div>
          </div>

          {/* Inline Legend for Status Breakdown Mode */}
          {chartMode === 'status' && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
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
                <defs>
                  <linearGradient id="ncapBarNormal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#38bdf8" />
                  </linearGradient>
                  <linearGradient id="ncapBarPeak" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0284c7" />
                    <stop offset="55%" stopColor="#0ea5e9" />
                    <stop offset="100%" stopColor="#2dd4bf" />
                  </linearGradient>
                  <linearGradient id="ncapBarSelected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1d4ed8" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                <XAxis
                  dataKey="shortLabel"
                  axisLine={{ stroke: 'var(--chart-axis)' }}
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
                          fill={isSelectedTick ? 'var(--chart-tick-active)' : 'var(--chart-tick-muted)'}
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
                            fill="var(--chart-tick-active)"
                          />
                        )}
                      </g>
                    );
                  }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'var(--chart-tick-muted)' }}
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
                          ? 'var(--chart-zero-bar)'
                          : isSelected
                          ? 'url(#ncapBarSelected)'
                          : isPeak
                          ? 'url(#ncapBarPeak)'
                          : 'url(#ncapBarNormal)';
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
                          stroke={isSelected ? '#38bdf8' : 'none'}
                          strokeWidth={isSelected ? 1.5 : 0}
                        />
                      );
                    })}
                    <LabelList
                      dataKey="total"
                      position="top"
                      formatter={(val: unknown) => (Number(val) > 0 ? String(val) : '')}
                      style={{
                        fill: 'var(--chart-label)',
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
                <MarqueeText className="text-slate-700 dark:text-slate-200 tabular-nums">
                  <strong className="text-sky-900 dark:text-sky-200">
                    {selectedBucket.fullLabel}
                  </strong>
                  {' · '}
                  <strong className="font-mono text-slate-900 dark:text-white">
                    {selectedBucket.total} เคส
                  </strong>
                  {` · รับรถ ${selectedBucket.delivered} · อนุมัติรอรับ ${selectedBucket.approvedPendingDelivery} · รอผล ${selectedBucket.pending} · ยอดจัด ${formatBaht(Math.round(selectedBucket.totalFinance))} บ.`}
                </MarqueeText>
              </div>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedMonthKey(null);
                }}
                className="text-xs font-bold text-sky-700 dark:text-sky-300 hover:text-sky-900 dark:hover:text-sky-200 underline cursor-pointer whitespace-nowrap shrink-0"
              >
                ล้างการเลือก
              </button>
            </div>
          ) : (
            <div className="pt-2 border-t border-white/70 dark:border-slate-700/75 text-[11px] sm:text-xs">
              <MarqueeText className="text-slate-500 dark:text-slate-400">
                แตะที่แท่งกราฟเพื่อเน้นดูรายละเอียดรายเดือน · ยอดจัดรวมช่วงนี้{' '}
                <strong className="font-mono tabular-nums text-slate-800 dark:text-slate-100">
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
