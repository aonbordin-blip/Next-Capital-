import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  ArrowRight,
  Award,
  Ban,
  Banknote,
  BarChart3,
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
  Fuel,
  LayoutList,
  Maximize2,
  Minimize2,
  PackageCheck,
  Plus,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
  X,
} from 'lucide-react';
import { SavedCaseRecord } from '../types';
import { formatBaht } from '../data/proposals';
import { triggerHaptic } from '../utils/haptics';
import { calculateGasolineAllowance } from '../utils/gasolineAllowance';
import { CheckerCommissionSummary } from '../utils/checkerCommission';
import type { KpiMiniBucket } from './KpiSummaryChartCard';
import { GasolineAllowanceCard } from './GasolineAllowanceCard';
import { useModalTransition } from '../hooks/useModalTransition';

interface PeriodStatsShape {
  totalCases: number;
  deliveredCount: number;
  approvedPendingDeliveryCount: number;
  approvedTotalCount: number;
  pendingCount: number;
  rejectedOrCancelledCount: number;
  totalFinance: number;
  deliveredFinance: number;
  approvedPendingFinance: number;
  pendingFinance: number;
  rejectedFinance: number;
  approvedTotalFinance: number;
  totalMonthlyInstallments: number;
  avgFinance: number;
  approvalRate: number;
}

interface DealerSummaryItem {
  name: string;
  total: number;
  delivered: number;
  approvedPending: number;
  other: number;
  finance: number;
  deliveredFinance: number;
}

interface UpcomingInstallmentCohort {
  label: string;
  shortDate: string;
  sortKey: string;
  count: number;
  sumInstallment: number;
}

interface UpcomingInstallmentSummaryShape {
  isPeriodScoped: boolean;
  totalDeliveredCount: number;
  totalMonthlyInstallment: number;
  cohorts: UpcomingInstallmentCohort[];
  latestCohort: UpcomingInstallmentCohort | null;
}

export interface TabletSaasDashboardProps {
  isTablet?: boolean;
  savedCases: SavedCaseRecord[];
  periodCases: SavedCaseRecord[];
  recentCases: SavedCaseRecord[];
  selectedMonth: string;
  currentMonthKey: string;
  availableMonths: string[];
  formatMonthLabel: (ym: string) => string;
  onSelectMonth: (ym: string) => void;
  onShiftMonth: (delta: -1 | 1) => void;
  stats: PeriodStatsShape;
  commissionSummary: CheckerCommissionSummary;
  miniSeries?: KpiMiniBucket[];
  dealerSummaryList: DealerSummaryItem[];
  upcomingInstallmentSummary: UpcomingInstallmentSummaryShape | null;
  activeDraft: {
    customerName: string;
    bikeModelName?: string;
    monthlyInstallment: number;
    term: number;
    isEditing: boolean;
  };
  onOpenSavedCases: () => void;
  onNavigateToCaseForm: () => void;
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

function getBangkokDateStr(tsOrDate?: number | string): string {
  if (typeof tsOrDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(tsOrDate)) {
    return tsOrDate.slice(0, 10);
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
      day: '2-digit',
    }).formatToParts(new Date(ts));
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // fallback
  }
  const bkk = new Date(ts + 7 * 60 * 60 * 1000);
  return `${bkk.getUTCFullYear()}-${String(bkk.getUTCMonth() + 1).padStart(2, '0')}-${String(
    bkk.getUTCDate()
  ).padStart(2, '0')}`;
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

function getStatusBadge(record: SavedCaseRecord) {
  if (record.approvalStatus === 'approved') {
    if (record.deliveryStatus === 'delivered') {
      return {
        key: 'delivered' as const,
        label: 'รับรถแล้ว',
        className:
          'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800',
      };
    }
    return {
      key: 'approved' as const,
      label: 'อนุมัติแล้ว',
      className:
        'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/70 dark:text-sky-300 dark:border-sky-800',
    };
  }
  if (record.approvalStatus === 'rejected') {
    return {
      key: 'rejected' as const,
      label: 'ไม่อนุมัติ',
      className:
        'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800',
    };
  }
  if (record.approvalStatus === 'cancelled') {
    return {
      key: 'cancelled' as const,
      label: 'ยกเลิก',
      className:
        'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    };
  }
  return {
    key: 'pending' as const,
    label: 'รออนุมัติ',
    className:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800',
  };
}

interface CircularRingProps {
  percent: number;
  gradientId: string;
  startColor: string;
  endColor: string;
  glowColor: string;
  subLabel?: string;
  size?: number;
}

const CircularRing: React.FC<CircularRingProps> = ({
  percent,
  gradientId,
  startColor,
  endColor,
  glowColor,
  subLabel,
  size = 54,
}) => {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  const strokeWidth = 5.2;
  const radius = (size - strokeWidth * 2) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamped / 100) * circumference;

  // Endpoint glowing specular dot angle (SVG starts at 3 o'clock, rotated -90deg -> 12 o'clock)
  const angleRad = ((clamped / 100) * 360 - 90) * (Math.PI / 180);
  const tipX = center + radius * Math.cos(angleRad);
  const tipY = center + radius * Math.sin(angleRad);

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0 transition-transform duration-300 ease-out group-hover:scale-105"
      style={{ width: size, height: size }}
    >
      {/* Subtle 3D ambient aura behind ring */}
      <span
        className="pointer-events-none absolute inset-1 rounded-full blur-md opacity-25 group-hover:opacity-45 transition-opacity duration-300"
        style={{ backgroundColor: glowColor }}
        aria-hidden="true"
      />
      <svg width={size} height={size} className="relative overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={startColor} />
            <stop offset="100%" stopColor={endColor} />
          </linearGradient>
          <filter id={`${gradientId}-glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor={glowColor} floodOpacity="0.38" />
          </filter>
        </defs>

        {/* Recessed Track Groove */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(148, 163, 184, 0.18)"
          strokeWidth={strokeWidth}
        />

        {/* Progress Gradient Arc */}
        {clamped > 0 && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
            filter={`url(#${gradientId}-glow)`}
            className="transition-all duration-500 ease-out"
          />
        )}

        {/* Specular Tip Beacon */}
        {clamped >= 3 && (
          <circle
            cx={tipX}
            cy={tipY}
            r={2.2}
            fill="#ffffff"
            stroke={endColor}
            strokeWidth={1.3}
          />
        )}
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[11px] font-black text-slate-800 dark:text-slate-100 tabular-nums">
          {Math.round(clamped)}%
        </span>
        {subLabel && (
          <span className="text-[8px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            {subLabel}
          </span>
        )}
      </div>
    </div>
  );
};

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

const DEFAULT_MINI_BUCKETS: KpiMiniBucket[] = ['1-5', '6-10', '11-15', '16-20', '21-25', '26+'].map(
  (label) => ({
    label,
    casesCount: 0,
    approvedCount: 0,
    deliveredCount: 0,
    financeAmount: 0,
    paDeliveredCount: 0,
    paInsuredCount: 0,
  })
);

interface StatBarDatum {
  label: string;
  fullLabel: string;
  total: number;
  delivered: number;
  finance: number;
}

const StatBarTooltip: React.FC<{
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: StatBarDatum }>;
}> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;
  const deliveryPct = item.total > 0 ? Math.round((item.delivered / item.total) * 100) : 0;

  return (
    <div className="rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-indigo-200/80 dark:border-slate-700 shadow-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-100 min-w-[185px]">
      <div className="flex items-center justify-between gap-3 pb-1.5 border-b border-slate-100 dark:border-slate-800">
        <span className="font-extrabold text-slate-900 dark:text-white">{item.fullLabel}</span>
        <span className="text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
          ส่งมอบ {deliveryPct}%
        </span>
      </div>
      <div className="pt-1.5 space-y-1 text-[11px] tabular-nums">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-300 font-semibold">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            เคสทั้งหมด
          </span>
          <span className="font-extrabold">{item.total} เคส</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-300 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            รับรถแล้ว
          </span>
          <span className="font-extrabold">{item.delivered} คัน</span>
        </div>
        <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
          <span className="text-slate-500 dark:text-slate-400">ยอดจัดรวม</span>
          <span className="font-extrabold text-slate-900 dark:text-white">
            {formatCompactBaht(item.finance)}
          </span>
        </div>
      </div>
    </div>
  );
};

interface Performance3DBarShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  payload?: StatBarDatum;
  series: 'total' | 'delivered';
  peakIdx: number;
  activeIdx: number | null;
  onHover: (idx: number | null) => void;
  onSelect: (idx: number) => void;
}

const Performance3DBarShape: React.FC<Performance3DBarShapeProps> = ({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  index = 0,
  payload,
  series,
  peakIdx,
  activeIdx,
  onHover,
  onSelect,
}) => {
  if (width <= 0) return <g />;

  const isTotal = series === 'total';
  const gradId = isTotal ? 'tsdPerfTotalGrad' : 'tsdPerfDelivGrad';
  const glowFilter = isTotal ? 'url(#tsdPerfTotalGlow)' : 'url(#tsdPerfDelivGlow)';
  const accentColor = isTotal ? '#5b5be6' : '#10b981';
  const rimColor = isTotal ? '#93c5fd' : '#6ee7b7';
  const isSelected = activeIdx === index;
  const isDimmed = activeIdx !== null && !isSelected;
  const isPeak = isTotal && index === peakIdx && (payload?.total ?? 0) > 0;

  if (height <= 0) {
    return (
      <g
        onMouseEnter={() => onHover(index)}
        onMouseLeave={() => onHover(null)}
        onClick={() => onSelect(index)}
        className="cursor-pointer"
      >
        <rect
          x={x}
          y={y - 3}
          width={width}
          height={3}
          rx={1.5}
          fill={accentColor}
          fillOpacity={isSelected ? 0.55 : 0.16}
        />
      </g>
    );
  }

  const rx = Math.min(6, width / 2);

  return (
    <g
      onMouseEnter={() => onHover(index)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(index)}
      style={{
        cursor: 'pointer',
        opacity: isDimmed ? 0.42 : 1,
        transition: 'opacity 180ms ease',
      }}
    >
      {/* 3D Soft Ground Shadow */}
      <ellipse
        cx={x + width / 2}
        cy={y + height + 1.5}
        rx={width * 0.52}
        ry={1.8}
        fill={accentColor}
        fillOpacity={isSelected ? 0.3 : 0.14}
      />

      {/* Active Column Outer Luminous Aura */}
      {isSelected && (
        <rect
          x={x - 2.5}
          y={y - 2.5}
          width={width + 5}
          height={height + 5}
          rx={rx + 2}
          fill={accentColor}
          fillOpacity={0.14}
          stroke={rimColor}
          strokeWidth={1.5}
          filter={glowFilter}
          className="animate-kpi-bar-aura"
        />
      )}

      {/* Main 3D Gradient Column */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={rx}
        fill={`url(#${gradId})`}
        filter={isSelected || isPeak ? glowFilter : 'url(#tsdPerfBarShadow)'}
      />

      {/* 3D Cylindrical Right Shaded Bevel */}
      {width >= 6 && height > 6 && (
        <rect
          x={x + width * 0.66}
          y={y + 1}
          width={width * 0.28}
          height={Math.max(0, height - 2)}
          rx={Math.max(1.5, rx * 0.45)}
          fill="#0f172a"
          fillOpacity={0.14}
          pointerEvents="none"
        />
      )}

      {/* Specular Crystal Top Reflection Cap */}
      {height > 8 && (
        <rect
          x={x + 1.5}
          y={y + 1.5}
          width={Math.max(2, width - 3)}
          height={Math.min(7, height * 0.24)}
          rx={Math.max(1.5, rx - 1.5)}
          fill="#ffffff"
          fillOpacity={isSelected ? 0.62 : 0.42}
          pointerEvents="none"
        />
      )}

      {/* Left-Edge Crisp Rim Highlight */}
      {height > 10 && (
        <line
          x1={x + 1.6}
          y1={y + 3}
          x2={x + 1.6}
          y2={y + height - 2.5}
          stroke="#ffffff"
          strokeOpacity={0.35}
          strokeWidth={0.9}
          strokeLinecap="round"
          pointerEvents="none"
        />
      )}

      {/* Pulsing Peak Beacon & Count Label */}
      {isPeak && payload && (
        <g className="pointer-events-none">
          <circle
            cx={x + width / 2}
            cy={Math.max(6, y - 6)}
            r={3.2}
            fill="#6366f1"
            className="animate-fuel-tip-ping"
            style={{ transformOrigin: `${x + width / 2}px ${Math.max(6, y - 6)}px` }}
          />
          <circle
            cx={x + width / 2}
            cy={Math.max(6, y - 6)}
            r={2.2}
            fill="#ffffff"
            stroke="#4f46e5"
            strokeWidth={1.3}
          />
        </g>
      )}
    </g>
  );
};

export const TabletSaasDashboard: React.FC<TabletSaasDashboardProps> = ({
  isTablet = false,
  savedCases,
  recentCases,
  selectedMonth,
  currentMonthKey,
  availableMonths,
  formatMonthLabel,
  onSelectMonth,
  onShiftMonth,
  stats,
  commissionSummary,
  miniSeries,
  dealerSummaryList,
  upcomingInstallmentSummary,
  activeDraft,
  onOpenSavedCases,
  onNavigateToCaseForm,
  onNavigateToDocuments,
  onNavigateToCheckerCommission,
  onNavigateToPeriodClosing,
  onNavigateToInstallments,
  onLoadCase,
}) => {
  const [statGraphTab, setStatGraphTab] = useState<'monthly' | 'weekly'>('monthly');
  const [statVisualMode, setStatVisualMode] = useState<'bars' | 'wave'>('bars');
  const [hoveredPerfIdx, setHoveredPerfIdx] = useState<number | null>(null);
  const [pinnedPerfIdx, setPinnedPerfIdx] = useState<number | null>(null);
  const [rightBottomTab, setRightBottomTab] = useState<'recent' | 'timeline' | 'tools'>('recent');
  const [dealerViewMode, setDealerViewMode] = useState<'chart' | 'list'>('chart');
  const [selectedDealerName, setSelectedDealerName] = useState<string | null>(null);
  const [hoveredDealerName, setHoveredDealerName] = useState<string | null>(null);
  const [showGasolineModal, setShowGasolineModal] = useState<boolean>(false);
  const {
    shouldRender: shouldRenderGasolineModal,
    isClosing: isClosingGasolineModal,
    backdropAnimClass: gasolineBackdropAnimClass,
    sheetAnimClass: gasolineSheetAnimClass,
  } = useModalTransition(showGasolineModal, () => setShowGasolineModal(false));

  useEffect(() => {
    if (!showGasolineModal) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [showGasolineModal]);

  const [hoveredKpiSlot, setHoveredKpiSlot] = useState<{
    card: 'cases' | 'delivered' | 'finance' | 'pa';
    idx: number;
  } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    const doc = document as Document & { webkitFullscreenElement?: Element | null };
    return Boolean(document.fullscreenElement || doc.webkitFullscreenElement);
  });

  useEffect(() => {
    const syncFullscreen = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      setIsFullscreen(Boolean(document.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen);
    };
  }, []);

  const handleToggleFullscreen = () => {
    triggerHaptic('selection');
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    const rootEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    const activeEl = document.fullscreenElement || doc.webkitFullscreenElement;
    if (activeEl) {
      if (typeof document.exitFullscreen === 'function') {
        void document.exitFullscreen().catch(() => {});
      } else if (typeof doc.webkitExitFullscreen === 'function') {
        void Promise.resolve(doc.webkitExitFullscreen()).catch(() => {});
      }
      return;
    }
    if (typeof document.documentElement.requestFullscreen === 'function') {
      void document.documentElement.requestFullscreen().catch(() => {});
    } else if (typeof rootEl.webkitRequestFullscreen === 'function') {
      void Promise.resolve(rootEl.webkitRequestFullscreen()).catch(() => {});
    }
  };

  const chartBuckets = useMemo(
    () => (miniSeries && miniSeries.length > 0 ? miniSeries : DEFAULT_MINI_BUCKETS),
    [miniSeries]
  );

  const gasolineSummary = useMemo(
    () => calculateGasolineAllowance(commissionSummary.totalDeliveredContracts),
    [commissionSummary.totalDeliveredContracts]
  );

  const deliveryRate = stats.totalCases > 0 ? (stats.deliveredCount / stats.totalCases) * 100 : 0;
  const approvedFinanceRatio =
    stats.totalFinance > 0 ? (stats.approvedTotalFinance / stats.totalFinance) * 100 : 0;

  // Donut breakdown matching "Job Details" right card in reference image
  const dealBreakdownRows = useMemo(() => {
    const total = Math.max(1, stats.totalCases);
    const items = [
      {
        key: 'delivered',
        label: 'รับรถแล้ว',
        count: stats.deliveredCount,
        amount: stats.deliveredFinance,
        pct: (stats.deliveredCount / total) * 100,
        color: '#06b6d4',
      },
      {
        key: 'approvedPending',
        label: 'อนุมัติรอรับรถ',
        count: stats.approvedPendingDeliveryCount,
        amount: stats.approvedPendingFinance,
        pct: (stats.approvedPendingDeliveryCount / total) * 100,
        color: '#f59e0b',
      },
      {
        key: 'pending',
        label: 'รออนุมัติ',
        count: stats.pendingCount,
        amount: stats.pendingFinance,
        pct: (stats.pendingCount / total) * 100,
        color: '#3b82f6',
      },
      {
        key: 'closedOther',
        label: 'ไม่อนุมัติ/ยกเลิก',
        count: stats.rejectedOrCancelledCount,
        amount: stats.rejectedFinance,
        pct: (stats.rejectedOrCancelledCount / total) * 100,
        color: '#ec4899',
      },
      {
        key: 'paInsured',
        label: 'ทำประกัน PA',
        count: commissionSummary.totalInsuredContracts,
        amount: commissionSummary.totalCommissionBaht,
        pct: commissionSummary.achievementPercent,
        color: '#6366f1',
      },
    ];
    return items;
  }, [stats, commissionSummary]);

  const pieSlices = useMemo(() => {
    const active = dealBreakdownRows
      .slice(0, 4)
      .filter((item) => item.count > 0);
    if (active.length === 0) {
      return [{ key: 'empty', label: 'ยังไม่มีเคส', count: 1, color: '#e2e8f0' }];
    }
    return active;
  }, [dealBreakdownRows]);

  // Bottom-Left Graph Data (Monthly 8 months OR Last 7 Days)
  const monthlyBarData: StatBarDatum[] = useMemo(() => {
    const [curY, curM] = currentMonthKey.split('-').map(Number);
    const buckets: { key: string; label: string; fullLabel: string }[] = [];
    for (let i = 7; i >= 0; i -= 1) {
      const d = new Date(curY, curM - 1 - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const thaiYr = String(d.getFullYear() + 543).slice(-2);
      buckets.push({
        key,
        label: THAI_MONTHS_SHORT[d.getMonth()] || key,
        fullLabel: `${THAI_MONTHS_SHORT[d.getMonth()]} ${thaiYr}`,
      });
    }

    const map = new Map<string, StatBarDatum>();
    for (const b of buckets) {
      map.set(b.key, { label: b.label, fullLabel: b.fullLabel, total: 0, delivered: 0, finance: 0 });
    }

    for (const c of savedCases) {
      const ym = getBangkokYearMonth(c.deliveryDate || c.approvalDate || c.createdAt);
      const entry = map.get(ym);
      if (!entry) continue;
      entry.total += 1;
      if (c.approvalStatus === 'approved' && c.deliveryStatus === 'delivered') {
        entry.delivered += 1;
      }
      entry.finance += Number(c.snapshot?.financeAmount) || 0;
    }

    return buckets.map((b) => map.get(b.key)!);
  }, [savedCases, currentMonthKey]);

  const weeklyBarData: StatBarDatum[] = useMemo(() => {
    const todayStr = getBangkokDateStr(Date.now());
    const [y, m, day] = todayStr.split('-').map(Number);
    const baseUtc = Date.UTC(y, m - 1, day, 5, 0, 0);
    const keys: { key: string; label: string; fullLabel: string }[] = [];

    for (let offset = 6; offset >= 0; offset -= 1) {
      const dateStr = getBangkokDateStr(baseUtc - offset * 86400_000);
      const [dy, dm, dd] = dateStr.split('-').map(Number);
      keys.push({
        key: dateStr,
        label: `${dd}/${dm}`,
        fullLabel: `${dd} ${THAI_MONTHS_SHORT[dm - 1]} ${String(dy + 543).slice(-2)}`,
      });
    }

    const map = new Map<string, StatBarDatum>();
    for (const k of keys) {
      map.set(k.key, { label: k.label, fullLabel: k.fullLabel, total: 0, delivered: 0, finance: 0 });
    }

    for (const c of savedCases) {
      const ds = getBangkokDateStr(c.createdAt);
      const entry = map.get(ds);
      if (!entry) continue;
      entry.total += 1;
      if (c.approvalStatus === 'approved' && c.deliveryStatus === 'delivered') {
        entry.delivered += 1;
      }
      entry.finance += Number(c.snapshot?.financeAmount) || 0;
    }

    return keys.map((k) => map.get(k.key)!);
  }, [savedCases]);

  const activeBarData = statGraphTab === 'monthly' ? monthlyBarData : weeklyBarData;

  const perfSummary = useMemo(() => {
    let sumTotal = 0;
    let sumDelivered = 0;
    let peakIdx = 0;
    activeBarData.forEach((d, idx) => {
      sumTotal += d.total;
      sumDelivered += d.delivered;
      if (d.total > (activeBarData[peakIdx]?.total ?? -1)) {
        peakIdx = idx;
      }
    });
    const avgTotal = activeBarData.length > 0 ? sumTotal / activeBarData.length : 0;
    return {
      sumTotal,
      sumDelivered,
      peakIdx,
      peakItem: activeBarData[peakIdx] || null,
      avgTotal,
    };
  }, [activeBarData]);

  const effectivePerfIdx = hoveredPerfIdx ?? pinnedPerfIdx;
  const spotlightPerfItem =
    effectivePerfIdx !== null ? activeBarData[effectivePerfIdx] ?? null : null;

  const maxDealerCases = useMemo(
    () => Math.max(1, ...dealerSummaryList.map((d) => d.total)),
    [dealerSummaryList]
  );

  const focusedDealerName = hoveredDealerName ?? selectedDealerName;
  const focusedDealer = useMemo(() => {
    if (dealerSummaryList.length === 0) return null;
    if (focusedDealerName) {
      return dealerSummaryList.find((d) => d.name === focusedDealerName) ?? dealerSummaryList[0];
    }
    return dealerSummaryList[0];
  }, [dealerSummaryList, focusedDealerName]);

  const timelineItems = useMemo(() => {
    if (upcomingInstallmentSummary && upcomingInstallmentSummary.cohorts.length > 0) {
      return upcomingInstallmentSummary.cohorts.slice(0, 5).map((coh, idx) => ({
        id: coh.sortKey,
        badge: coh.shortDate,
        stepNum: `0${idx + 1}`,
        title: `${coh.count} สัญญา`,
        subtitle: formatBaht(coh.sumInstallment),
      }));
    }
    return [
      { id: 's1', badge: 'ขั้น 1', stepNum: '01', title: 'คำนวณค่างวด', subtitle: 'เลือกรถ & ดาวน์' },
      { id: 's2', badge: 'ขั้น 2', stepNum: '02', title: 'บันทึกเคส', subtitle: 'รออนุมัติ / DV' },
      { id: 's3', badge: 'ขั้น 3', stepNum: '03', title: 'รับรถส่งมอบ', subtitle: 'นับ PA & น้ำมัน' },
      { id: 's4', badge: 'ขั้น 4', stepNum: '04', title: 'งวดแรกวันที่ 2', subtitle: 'ติดตามงวด 1-9' },
    ];
  }, [upcomingInstallmentSummary]);

  return (
    <div className="space-y-3.5 animate-tab-fade">
      {/* Compact Period & Summary Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
            แดชบอร์ดภาพรวมผลงาน
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            สรุปทุกฟังก์ชันสำคัญในหน้าเดียว · งวด {formatMonthLabel(selectedMonth)}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {isTablet && (
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-all shadow-2xs active:scale-95 ${
                isFullscreen
                  ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                  : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-600'
              }`}
              title={isFullscreen ? 'ออกจากโหมดเต็มจอ' : 'ขยายเต็มหน้าจอแท็บเล็ต'}
              aria-label={isFullscreen ? 'ออกจากโหมดเต็มจอ' : 'ขยายเต็มหน้าจอแท็บเล็ต'}
              aria-pressed={isFullscreen}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 shrink-0" />
                  <span>ออกเต็มจอ</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-indigo-600 dark:text-sky-400 shrink-0" />
                  <span>เต็มจอ</span>
                </>
              )}
            </button>
          )}
          <div className="flex items-center gap-0.5 bg-white dark:bg-slate-900 px-1 py-0.5 rounded-xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xs">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onShiftMonth(-1);
              }}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
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
                  onSelectMonth(e.target.value);
                }}
                className="appearance-none bg-transparent pl-2 pr-6 py-1 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
              >
                <option value="all" className="dark:bg-slate-900">
                  ทุกช่วงเวลา (ทั้งหมด)
                </option>
                {availableMonths.map((ym) => (
                  <option key={ym} value={ym} className="dark:bg-slate-900">
                    {formatMonthLabel(ym)}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2" />
            </div>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onShiftMonth(1);
              }}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
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
                onSelectMonth(currentMonthKey);
              }}
              className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 text-indigo-600 dark:text-sky-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer shadow-2xs transition-colors"
              title="กลับไปยังเดือนปัจจุบัน"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* =====================================================================
          ROW 1: 4 Dimensional KPI Cards with Interactive 3D Mini Charts & Rings
         ===================================================================== */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 items-stretch">
        {/* KPI 1: เคสทั้งหมด — 3D Layered Crystal Capsules */}
        {(() => {
          const maxCases = Math.max(1, ...chartBuckets.map((b) => b.casesCount));
          const peakIdx = chartBuckets.reduce(
            (best, b, idx, arr) => (b.casesCount > (arr[best]?.casesCount ?? -1) ? idx : best),
            0
          );
          const activeIdx =
            hoveredKpiSlot?.card === 'cases' ? hoveredKpiSlot.idx : null;
          const activeBucket = activeIdx !== null ? chartBuckets[activeIdx] : null;
          const peakBucket = chartBuckets[peakIdx];
          const slotW = 180 / chartBuckets.length;

          return (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                onOpenSavedCases();
              }}
              onMouseLeave={() =>
                setHoveredKpiSlot((prev) => (prev?.card === 'cases' ? null : prev))
              }
              className="group relative overflow-hidden text-left h-full rounded-2xl bg-gradient-to-br from-white via-white to-indigo-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/40 border border-slate-200/85 dark:border-slate-800 hover:border-indigo-300/90 dark:hover:border-indigo-600/80 shadow-[0_6px_20px_-8px_rgba(79,70,229,0.14),inset_0_1px_0_rgba(255,255,255,0.95)] dark:shadow-[0_8px_22px_-8px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)] hover:shadow-[0_12px_28px_-8px_rgba(79,70,229,0.22)] hover:-translate-y-0.5 active:scale-[0.99] p-3.5 flex flex-col justify-between gap-2.5 transition-all duration-200 cursor-pointer min-w-0"
            >
              {/* Top Specular Highlight & Corner Ambient Glow */}
              <span
                className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white dark:via-indigo-300/35 to-transparent"
                aria-hidden="true"
              />
              <span
                className="pointer-events-none -right-6 -top-6 absolute w-24 h-24 rounded-full bg-indigo-400/14 dark:bg-indigo-500/15 blur-xl group-hover:bg-indigo-400/24 transition-colors duration-300"
                aria-hidden="true"
              />

              {/* Top Row: Icon + Primary Stat + Glowing Ring */}
              <div className="relative flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1.5">
                  <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-sm shadow-indigo-500/25 ring-1 ring-white/50 dark:ring-white/15 group-hover:scale-105 transition-transform duration-200">
                    <FolderArchive className="w-4 h-4" />
                  </span>
                  <div>
                    <div className="text-xl font-black text-slate-900 dark:text-white tabular-nums leading-tight">
                      {stats.totalCases}
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      เคสทั้งหมด · อนุมัติ {stats.approvedTotalCount}
                    </div>
                  </div>
                </div>
                <CircularRing
                  percent={stats.approvalRate}
                  gradientId="tsd-ring-cases"
                  startColor="#38bdf8"
                  endColor="#5b5be6"
                  glowColor="#5b5be6"
                  subLabel="อนุมัติ"
                />
              </div>

              {/* Bottom Interactive 3D Crystal Capsules Chart */}
              <div className="relative pt-2 border-t border-slate-100/90 dark:border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between gap-1 text-[10px] tabular-nums">
                  <span className="font-semibold text-slate-400 dark:text-slate-500 truncate">
                    {activeBucket ? `ช่วง ${activeBucket.label}` : 'สถิติ 6 ช่วง'}
                  </span>
                  <span className="font-bold text-indigo-600 dark:text-sky-300 truncate">
                    {activeBucket
                      ? `${activeBucket.casesCount} เคส · อนุมัติ ${activeBucket.approvedCount}`
                      : peakBucket && peakBucket.casesCount > 0
                        ? `สูงสุด ${peakBucket.casesCount} เคส`
                        : 'รอข้อมูลเคส'}
                  </span>
                </div>

                <div className="h-[52px] w-full">
                  <svg viewBox="0 0 180 54" className="w-full h-full overflow-visible">
                    <defs>
                      <linearGradient id="tsdCasesFillGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" />
                        <stop offset="52%" stopColor="#5b5be6" />
                        <stop offset="100%" stopColor="#4338ca" />
                      </linearGradient>
                      <linearGradient id="tsdCasesShellGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.34" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0.1" />
                      </linearGradient>
                      <filter id="tsdCasesGlow" x="-25%" y="-25%" width="150%" height="150%">
                        <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#4f46e5" floodOpacity="0.34" />
                      </filter>
                    </defs>

                    <line
                      x1="4"
                      y1="40.5"
                      x2="176"
                      y2="40.5"
                      stroke="currentColor"
                      className="text-indigo-900/10 dark:text-indigo-200/15"
                      strokeWidth="1"
                      strokeLinecap="round"
                    />

                    {chartBuckets.map((b, idx) => {
                      const barW = 14.5;
                      const x = idx * slotW + (slotW - barW) / 2;
                      const totalH = b.casesCount > 0 ? Math.max(8, (b.casesCount / maxCases) * 30) : 4;
                      const approvedH =
                        b.approvedCount > 0
                          ? Math.max(5.5, Math.min(totalH, (b.approvedCount / maxCases) * 30))
                          : b.casesCount > 0
                            ? 3.5
                            : 0;
                      const totalY = 40 - totalH;
                      const approvedY = 40 - approvedH;
                      const isPeak = idx === peakIdx && b.casesCount > 0;
                      const isHovered = activeIdx === idx;
                      const isDimmed = activeIdx !== null && !isHovered;

                      return (
                        <g
                          key={`cases-${b.label}-${idx}`}
                          onMouseEnter={() => setHoveredKpiSlot({ card: 'cases', idx })}
                          onTouchStart={() => setHoveredKpiSlot({ card: 'cases', idx })}
                          className="animate-kpi-mini-bar cursor-pointer"
                          style={{
                            animationDelay: `${idx * 45}ms`,
                            opacity: isDimmed ? 0.45 : 1,
                            transition: 'opacity 160ms ease',
                          }}
                        >
                          <rect x={idx * slotW} y={0} width={slotW} height={54} fill="transparent" />
                          <ellipse
                            cx={x + barW / 2}
                            cy={41.6}
                            rx={barW * 0.45}
                            ry={1.3}
                            fill="#4338ca"
                            fillOpacity={b.casesCount > 0 ? (isHovered ? 0.28 : 0.14) : 0.05}
                          />
                          <rect
                            x={x}
                            y={totalY}
                            width={barW}
                            height={totalH}
                            rx={4}
                            fill="url(#tsdCasesShellGrad)"
                            stroke="#6366f1"
                            strokeOpacity={isHovered ? 0.85 : b.casesCount > 0 ? 0.42 : 0.16}
                            strokeWidth={isHovered ? 1.1 : 0.75}
                          />
                          {approvedH > 0 && (
                            <g filter={isPeak || isHovered ? 'url(#tsdCasesGlow)' : undefined}>
                              <rect
                                x={x + 1.5}
                                y={approvedY}
                                width={barW - 3}
                                height={approvedH}
                                rx={3}
                                fill="url(#tsdCasesFillGrad)"
                              />
                              <rect
                                x={x + 2.6}
                                y={approvedY + 1.1}
                                width={Math.max(2, barW - 5.2)}
                                height={Math.min(3.5, Math.max(1.5, approvedH * 0.28))}
                                rx={1.4}
                                fill="#ffffff"
                                fillOpacity={0.65}
                              />
                            </g>
                          )}
                          {(isPeak || isHovered) && b.casesCount > 0 && (
                            <g>
                              <circle
                                cx={x + barW / 2}
                                cy={Math.max(3.5, totalY - 3.4)}
                                r={2.2}
                                fill="#5b5be6"
                                className="animate-fuel-tip-ping"
                                style={{
                                  transformOrigin: `${x + barW / 2}px ${Math.max(3.5, totalY - 3.4)}px`,
                                }}
                              />
                              <circle
                                cx={x + barW / 2}
                                cy={Math.max(3.5, totalY - 3.4)}
                                r={1.7}
                                fill="#ffffff"
                                stroke="#4f46e5"
                                strokeWidth={1.1}
                              />
                            </g>
                          )}
                          <text
                            x={x + barW / 2}
                            y={51}
                            textAnchor="middle"
                            fontSize="7.5"
                            fontWeight={isHovered ? 800 : 600}
                            fill="currentColor"
                            className={
                              isHovered
                                ? 'text-indigo-600 dark:text-sky-300'
                                : 'text-slate-400 dark:text-slate-500'
                            }
                          >
                            {b.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            </button>
          );
        })()}

        {/* KPI 2: รับรถแล้ว — 3D Luminous Area Wave Sparkline */}
        {(() => {
          const maxDelivered = Math.max(1, ...chartBuckets.map((b) => b.deliveredCount));
          const count = chartBuckets.length;
          const slotW = 180 / count;
          const points = chartBuckets.map((b, idx) => {
            const x = count > 1 ? 14 + (idx / (count - 1)) * 152 : 90;
            const y = b.deliveredCount > 0 ? 35 - (b.deliveredCount / maxDelivered) * 25 : 37;
            return { x, y, count: b.deliveredCount, label: b.label };
          });
          const linePath = buildSmoothWavePath(points);
          const areaPath =
            points.length > 0
              ? `${linePath} L ${points[points.length - 1].x.toFixed(2)} 40 L ${points[0].x.toFixed(2)} 40 Z`
              : '';
          let latestActiveIdx = points.length - 1;
          for (let i = points.length - 1; i >= 0; i--) {
            if (points[i].count > 0) {
              latestActiveIdx = i;
              break;
            }
          }
          const activeIdx =
            hoveredKpiSlot?.card === 'delivered' ? hoveredKpiSlot.idx : null;
          const activeBucket = activeIdx !== null ? chartBuckets[activeIdx] : null;

          return (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                onNavigateToPeriodClosing();
              }}
              onMouseLeave={() =>
                setHoveredKpiSlot((prev) => (prev?.card === 'delivered' ? null : prev))
              }
              className="group relative overflow-hidden text-left h-full rounded-2xl bg-gradient-to-br from-white via-white to-emerald-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/35 border border-slate-200/85 dark:border-slate-800 hover:border-emerald-300/90 dark:hover:border-emerald-600/80 shadow-[0_6px_20px_-8px_rgba(16,185,129,0.14),inset_0_1px_0_rgba(255,255,255,0.95)] dark:shadow-[0_8px_22px_-8px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)] hover:shadow-[0_12px_28px_-8px_rgba(16,185,129,0.22)] hover:-translate-y-0.5 active:scale-[0.99] p-3.5 flex flex-col justify-between gap-2.5 transition-all duration-200 cursor-pointer min-w-0"
            >
              <span
                className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white dark:via-emerald-300/35 to-transparent"
                aria-hidden="true"
              />
              <span
                className="pointer-events-none -right-6 -top-6 absolute w-24 h-24 rounded-full bg-emerald-400/14 dark:bg-emerald-500/15 blur-xl group-hover:bg-emerald-400/24 transition-colors duration-300"
                aria-hidden="true"
              />

              <div className="relative flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1.5">
                  <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white flex items-center justify-center shadow-sm shadow-emerald-500/25 ring-1 ring-white/50 dark:ring-white/15 group-hover:scale-105 transition-transform duration-200">
                    <PackageCheck className="w-4 h-4" />
                  </span>
                  <div>
                    <div className="text-xl font-black text-slate-900 dark:text-white tabular-nums leading-tight">
                      {stats.deliveredCount}
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      รับรถแล้ว · {formatCompactBaht(stats.deliveredFinance)}
                    </div>
                  </div>
                </div>
                <CircularRing
                  percent={deliveryRate}
                  gradientId="tsd-ring-delivered"
                  startColor="#34d399"
                  endColor="#0d9488"
                  glowColor="#10b981"
                  subLabel="ส่งมอบ"
                />
              </div>

              {/* Bottom Interactive 3D Smooth Area Sparkline */}
              <div className="relative pt-2 border-t border-slate-100/90 dark:border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between gap-1 text-[10px] tabular-nums">
                  <span className="font-semibold text-slate-400 dark:text-slate-500 truncate">
                    {activeBucket ? `ช่วง ${activeBucket.label}` : 'แนวโน้มส่งมอบ'}
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-300 truncate">
                    {activeBucket
                      ? `รับรถ ${activeBucket.deliveredCount} คัน`
                      : `รอรับรถ ${stats.approvedPendingDeliveryCount} คัน`}
                  </span>
                </div>

                <div className="h-[52px] w-full">
                  <svg viewBox="0 0 180 54" className="w-full h-full overflow-visible">
                    <defs>
                      <linearGradient id="tsdDeliveredAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.46" />
                        <stop offset="65%" stopColor="#14b8a6" stopOpacity="0.16" />
                        <stop offset="100%" stopColor="#0d9488" stopOpacity="0.02" />
                      </linearGradient>
                      <linearGradient id="tsdDeliveredStrokeGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#34d399" />
                        <stop offset="50%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#06b6d4" />
                      </linearGradient>
                      <filter id="tsdDeliveredGlow" x="-20%" y="-25%" width="140%" height="160%">
                        <feDropShadow dx="0" dy="2.5" stdDeviation="2.2" floodColor="#059669" floodOpacity="0.36" />
                      </filter>
                    </defs>

                    <line
                      x1="4"
                      y1="40.5"
                      x2="176"
                      y2="40.5"
                      stroke="currentColor"
                      className="text-emerald-900/10 dark:text-emerald-200/15"
                      strokeWidth="1"
                      strokeLinecap="round"
                    />

                    {points.map((pt, idx) => (
                      <line
                        key={`deliv-guide-${idx}`}
                        x1={pt.x}
                        y1={pt.y}
                        x2={pt.x}
                        y2={40}
                        stroke="currentColor"
                        className={
                          activeIdx === idx
                            ? 'text-emerald-500/45 dark:text-emerald-300/45'
                            : 'text-emerald-700/15 dark:text-emerald-300/15'
                        }
                        strokeWidth={activeIdx === idx ? 1.1 : 0.75}
                        strokeDasharray="1.8 1.8"
                      />
                    ))}

                    {areaPath && (
                      <path
                        d={areaPath}
                        fill="url(#tsdDeliveredAreaGrad)"
                        className="animate-kpi-mini-area"
                      />
                    )}

                    {linePath && (
                      <g filter="url(#tsdDeliveredGlow)">
                        <path
                          d={linePath}
                          fill="none"
                          stroke="url(#tsdDeliveredStrokeGrad)"
                          strokeWidth={2.4}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="animate-kpi-mini-line"
                        />
                        <path
                          d={linePath}
                          fill="none"
                          stroke="#ffffff"
                          strokeOpacity={0.58}
                          strokeWidth={0.85}
                          strokeLinecap="round"
                          transform="translate(0, -0.7)"
                          className="animate-kpi-mini-line"
                        />
                      </g>
                    )}

                    {points.map((pt, idx) => {
                      const isHovered = activeIdx === idx;
                      const isHeroNode =
                        isHovered || (activeIdx === null && idx === latestActiveIdx && pt.count > 0);
                      return (
                        <g
                          key={`deliv-pt-${idx}`}
                          onMouseEnter={() => setHoveredKpiSlot({ card: 'delivered', idx })}
                          onTouchStart={() => setHoveredKpiSlot({ card: 'delivered', idx })}
                          className="cursor-pointer"
                        >
                          <rect x={idx * slotW} y={0} width={slotW} height={54} fill="transparent" />
                          {isHeroNode && (
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={4.5}
                              fill="#10b981"
                              fillOpacity={0.32}
                              className="animate-fuel-tip-ping"
                              style={{ transformOrigin: `${pt.x}px ${pt.y}px` }}
                            />
                          )}
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={isHeroNode ? 3 : pt.count > 0 ? 2.2 : 1.5}
                            fill={pt.count > 0 || isHovered ? '#ffffff' : '#10b981'}
                            fillOpacity={pt.count > 0 || isHovered ? 1 : 0.35}
                            stroke={pt.count > 0 || isHovered ? '#059669' : 'none'}
                            strokeWidth={isHeroNode ? 1.6 : 1.2}
                          />
                          <text
                            x={pt.x}
                            y={51}
                            textAnchor="middle"
                            fontSize="7.5"
                            fontWeight={isHovered ? 800 : 600}
                            fill="currentColor"
                            className={
                              isHovered
                                ? 'text-emerald-600 dark:text-emerald-300'
                                : 'text-slate-400 dark:text-slate-500'
                            }
                          >
                            {pt.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            </button>
          );
        })()}

        {/* KPI 3: ยอดจัดไฟแนนซ์รวม — 3D Isometric Finance Prisms */}
        {(() => {
          const maxFinance = Math.max(1, ...chartBuckets.map((b) => b.financeAmount));
          const nonZero = chartBuckets.filter((b) => b.financeAmount > 0).map((b) => b.financeAmount);
          const avgBucketFinance =
            nonZero.length > 0 ? nonZero.reduce((sum, v) => sum + v, 0) / nonZero.length : 0;
          const avgLineY = avgBucketFinance > 0 ? 39.5 - (avgBucketFinance / maxFinance) * 28 : 37;
          const slotW = 180 / chartBuckets.length;
          const activeIdx =
            hoveredKpiSlot?.card === 'finance' ? hoveredKpiSlot.idx : null;
          const activeBucket = activeIdx !== null ? chartBuckets[activeIdx] : null;

          return (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                onNavigateToCaseForm();
              }}
              onMouseLeave={() =>
                setHoveredKpiSlot((prev) => (prev?.card === 'finance' ? null : prev))
              }
              className="group relative overflow-hidden text-left h-full rounded-2xl bg-gradient-to-br from-white via-white to-amber-50/75 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/35 border border-slate-200/85 dark:border-slate-800 hover:border-amber-300/90 dark:hover:border-amber-600/80 shadow-[0_6px_20px_-8px_rgba(245,158,11,0.14),inset_0_1px_0_rgba(255,255,255,0.95)] dark:shadow-[0_8px_22px_-8px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)] hover:shadow-[0_12px_28px_-8px_rgba(245,158,11,0.22)] hover:-translate-y-0.5 active:scale-[0.99] p-3.5 flex flex-col justify-between gap-2.5 transition-all duration-200 cursor-pointer min-w-0"
            >
              <span
                className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white dark:via-amber-300/35 to-transparent"
                aria-hidden="true"
              />
              <span
                className="pointer-events-none -right-6 -top-6 absolute w-24 h-24 rounded-full bg-amber-400/16 dark:bg-amber-500/15 blur-xl group-hover:bg-amber-400/26 transition-colors duration-300"
                aria-hidden="true"
              />

              <div className="relative flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1.5">
                  <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-sm shadow-amber-500/25 ring-1 ring-white/50 dark:ring-white/15 group-hover:scale-105 transition-transform duration-200">
                    <Banknote className="w-4 h-4" />
                  </span>
                  <div>
                    <div className="text-lg xl:text-xl font-black text-slate-900 dark:text-white tabular-nums leading-tight truncate">
                      {formatCompactBaht(stats.totalFinance)}
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      ยอดจัดรวม · เฉลี่ย {formatCompactBaht(stats.avgFinance)}
                    </div>
                  </div>
                </div>
                <CircularRing
                  percent={approvedFinanceRatio}
                  gradientId="tsd-ring-finance"
                  startColor="#fbbf24"
                  endColor="#ea580c"
                  glowColor="#f59e0b"
                  subLabel="อนุมัติ"
                />
              </div>

              {/* Bottom Interactive 3D Isometric Finance Prisms */}
              <div className="relative pt-2 border-t border-slate-100/90 dark:border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between gap-1 text-[10px] tabular-nums">
                  <span className="font-semibold text-slate-400 dark:text-slate-500 truncate">
                    {activeBucket ? `ช่วง ${activeBucket.label}` : 'ยอดจัด 6 ช่วง'}
                  </span>
                  <span className="font-bold text-amber-600 dark:text-amber-300 truncate">
                    {activeBucket
                      ? formatCompactBaht(activeBucket.financeAmount)
                      : `รับรถแล้ว ${formatCompactBaht(stats.deliveredFinance)}`}
                  </span>
                </div>

                <div className="h-[52px] w-full">
                  <svg viewBox="0 0 180 54" className="w-full h-full overflow-visible">
                    <defs>
                      <linearGradient id="tsdFinanceFrontGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fbbf24" />
                        <stop offset="55%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#d97706" />
                      </linearGradient>
                      <linearGradient id="tsdFinanceSideGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#d97706" />
                        <stop offset="100%" stopColor="#92400e" />
                      </linearGradient>
                      <filter id="tsdFinanceGlow" x="-25%" y="-25%" width="150%" height="150%">
                        <feDropShadow dx="1" dy="2.5" stdDeviation="2" floodColor="#d97706" floodOpacity="0.34" />
                      </filter>
                    </defs>

                    <line
                      x1="4"
                      y1="40.5"
                      x2="176"
                      y2="40.5"
                      stroke="currentColor"
                      className="text-amber-900/10 dark:text-amber-200/15"
                      strokeWidth="1"
                      strokeLinecap="round"
                    />

                    {chartBuckets.map((b, idx) => {
                      const frontW = 11.5;
                      const depthX = 3.8;
                      const depthY = 2.8;
                      const x = idx * slotW + (slotW - (frontW + depthX)) / 2;
                      const barH =
                        b.financeAmount > 0 ? Math.max(6.5, (b.financeAmount / maxFinance) * 28.5) : 3;
                      const y = 40 - barH;
                      const isPeak = b.financeAmount === maxFinance && b.financeAmount > 0;
                      const isHovered = activeIdx === idx;
                      const isDimmed = activeIdx !== null && !isHovered;

                      return (
                        <g
                          key={`fin-${b.label}-${idx}`}
                          onMouseEnter={() => setHoveredKpiSlot({ card: 'finance', idx })}
                          onTouchStart={() => setHoveredKpiSlot({ card: 'finance', idx })}
                          className="animate-kpi-mini-bar cursor-pointer"
                          style={{
                            animationDelay: `${idx * 50}ms`,
                            opacity: isDimmed ? 0.42 : 1,
                            transition: 'opacity 160ms ease',
                          }}
                          filter={isPeak || isHovered ? 'url(#tsdFinanceGlow)' : undefined}
                        >
                          <rect x={idx * slotW} y={0} width={slotW} height={54} fill="transparent" />
                          <ellipse
                            cx={x + (frontW + depthX) / 2}
                            cy={41.6}
                            rx={frontW * 0.6}
                            ry={1.3}
                            fill="#92400e"
                            fillOpacity={b.financeAmount > 0 ? (isHovered ? 0.28 : 0.16) : 0.05}
                          />
                          {/* 3D Right Facet */}
                          <polygon
                            points={`${x + frontW},${y} ${x + frontW + depthX},${y - depthY} ${x + frontW + depthX},${40 - depthY} ${x + frontW},40`}
                            fill="url(#tsdFinanceSideGrad)"
                            fillOpacity={b.financeAmount > 0 ? 0.92 : 0.22}
                          />
                          {/* 3D Top Diamond Facet */}
                          <polygon
                            points={`${x},${y} ${x + depthX},${y - depthY} ${x + frontW + depthX},${y - depthY} ${x + frontW},${y}`}
                            fill={b.financeAmount > 0 ? '#fef08a' : '#fde68a'}
                            fillOpacity={b.financeAmount > 0 ? 0.96 : 0.35}
                          />
                          {/* Front Crystal Face */}
                          <rect
                            x={x}
                            y={y}
                            width={frontW}
                            height={barH}
                            rx={1.3}
                            fill="url(#tsdFinanceFrontGrad)"
                            fillOpacity={b.financeAmount > 0 ? 1 : 0.28}
                          />
                          {b.financeAmount > 0 && barH > 6 && (
                            <line
                              x1={x + 1.4}
                              y1={y + 1.2}
                              x2={x + 1.4}
                              y2={39}
                              stroke="#ffffff"
                              strokeOpacity={0.5}
                              strokeWidth={0.95}
                              strokeLinecap="round"
                            />
                          )}
                          <text
                            x={x + (frontW + depthX) / 2}
                            y={51}
                            textAnchor="middle"
                            fontSize="7.5"
                            fontWeight={isHovered ? 800 : 600}
                            fill="currentColor"
                            className={
                              isHovered
                                ? 'text-amber-600 dark:text-amber-300'
                                : 'text-slate-400 dark:text-slate-500'
                            }
                          >
                            {b.label}
                          </text>
                        </g>
                      );
                    })}

                    {/* Average Benchmark Reference Line */}
                    {avgBucketFinance > 0 && (
                      <g className="pointer-events-none animate-kpi-mini-area">
                        <line
                          x1="4"
                          y1={avgLineY}
                          x2="174"
                          y2={avgLineY}
                          stroke="#ea580c"
                          strokeOpacity={0.55}
                          strokeWidth="1"
                          strokeDasharray="3 2.5"
                        />
                        <circle
                          cx="173"
                          cy={avgLineY}
                          r={1.8}
                          fill="#ffffff"
                          stroke="#ea580c"
                          strokeWidth={1.1}
                        />
                      </g>
                    )}
                  </svg>
                </div>
              </div>
            </button>
          );
        })()}

        {/* KPI 4: PA Insurance Mix + Penetration Columns */}
        {(() => {
          const totalMix = Math.max(
            1,
            commissionSummary.paCount +
              commissionSummary.paPlusCount +
              commissionSummary.totalNoInsuranceContracts
          );
          const paShareW = (commissionSummary.paCount / totalMix) * 100;
          const paPlusShareW = (commissionSummary.paPlusCount / totalMix) * 100;
          const noPaShareW = (commissionSummary.totalNoInsuranceContracts / totalMix) * 100;
          const maxPaDelivered = Math.max(
            1,
            ...chartBuckets.map((b) => Math.max(b.paDeliveredCount, b.paInsuredCount))
          );
          const slotW = 180 / chartBuckets.length;
          const activeIdx =
            hoveredKpiSlot?.card === 'pa' ? hoveredKpiSlot.idx : null;
          const activeBucket = activeIdx !== null ? chartBuckets[activeIdx] : null;

          return (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                onNavigateToCheckerCommission();
              }}
              onMouseLeave={() =>
                setHoveredKpiSlot((prev) => (prev?.card === 'pa' ? null : prev))
              }
              className="group relative overflow-hidden text-left h-full rounded-2xl bg-gradient-to-br from-white via-white to-violet-50/75 dark:from-slate-900 dark:via-slate-900 dark:to-violet-950/40 border border-slate-200/85 dark:border-slate-800 hover:border-violet-300/90 dark:hover:border-violet-600/80 shadow-[0_6px_20px_-8px_rgba(99,102,241,0.14),inset_0_1px_0_rgba(255,255,255,0.95)] dark:shadow-[0_8px_22px_-8px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)] hover:shadow-[0_12px_28px_-8px_rgba(99,102,241,0.22)] hover:-translate-y-0.5 active:scale-[0.99] p-3.5 flex flex-col justify-between gap-2.5 transition-all duration-200 cursor-pointer min-w-0"
            >
              <span
                className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white dark:via-violet-300/35 to-transparent"
                aria-hidden="true"
              />
              <span
                className="pointer-events-none -right-6 -top-6 absolute w-24 h-24 rounded-full bg-violet-400/14 dark:bg-violet-500/15 blur-xl group-hover:bg-violet-400/24 transition-colors duration-300"
                aria-hidden="true"
              />

              {/* Top Row: 3-Line PA Breakdown + Glowing Tier Ring */}
              <div className="relative flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1.5 text-[11px] font-semibold">
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                    <span className="truncate">PA ปกติ</span>
                    <span className="font-mono font-extrabold text-slate-900 dark:text-white tabular-nums ml-auto">
                      {commissionSummary.paCount}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                    <span className="truncate">PA Plus</span>
                    <span className="font-mono font-extrabold text-slate-900 dark:text-white tabular-nums ml-auto">
                      {commissionSummary.paPlusCount}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span className="truncate">ไม่ทำ PA</span>
                    <span className="font-mono font-extrabold text-slate-900 dark:text-white tabular-nums ml-auto">
                      {commissionSummary.totalNoInsuranceContracts}
                    </span>
                  </div>
                </div>
                <CircularRing
                  percent={commissionSummary.achievementPercent}
                  gradientId="tsd-ring-pa"
                  startColor="#818cf8"
                  endColor="#7c3aed"
                  glowColor="#6366f1"
                  subLabel={`Tier ${commissionSummary.tier}`}
                />
              </div>

              {/* Bottom Interactive PA Mix Ribbon + 6-Period Penetration Chart */}
              <div className="relative pt-2 border-t border-slate-100/90 dark:border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between gap-1 text-[10px] tabular-nums">
                  <span className="font-semibold text-slate-400 dark:text-slate-500 truncate">
                    {activeBucket ? `ช่วง ${activeBucket.label}` : 'สัดส่วน PA 6 ช่วง'}
                  </span>
                  <span className="font-bold text-violet-600 dark:text-violet-300 truncate">
                    {activeBucket
                      ? `ทำ PA ${activeBucket.paInsuredCount}/${activeBucket.paDeliveredCount}`
                      : `คอม ${formatBaht(commissionSummary.totalCommissionBaht)}`}
                  </span>
                </div>

                {/* Proportional 3D Stacked Mix Ribbon */}
                <div
                  className="relative h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex shadow-inner"
                  aria-hidden="true"
                >
                  {commissionSummary.totalDeliveredContracts > 0 ? (
                    <>
                      {paShareW > 0 && (
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                          style={{ width: `${paShareW}%` }}
                        />
                      )}
                      {paPlusShareW > 0 && (
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-500"
                          style={{ width: `${paPlusShareW}%` }}
                        />
                      )}
                      {noPaShareW > 0 && (
                        <div
                          className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-500"
                          style={{ width: `${noPaShareW}%` }}
                        />
                      )}
                    </>
                  ) : (
                    <div className="h-full w-full bg-slate-200/70 dark:bg-slate-700/60" />
                  )}
                  <span className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-white/45" />
                </div>

                {/* 6-Period PA Penetration Columns */}
                <div className="h-[40px] w-full">
                  <svg viewBox="0 0 180 42" className="w-full h-full overflow-visible">
                    <defs>
                      <linearGradient id="tsdPaFillGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a78bfa" />
                        <stop offset="55%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#4f46e5" />
                      </linearGradient>
                    </defs>

                    <line
                      x1="4"
                      y1="29.5"
                      x2="176"
                      y2="29.5"
                      stroke="currentColor"
                      className="text-violet-900/10 dark:text-violet-200/15"
                      strokeWidth="1"
                      strokeLinecap="round"
                    />

                    {chartBuckets.map((b, idx) => {
                      const barW = 13;
                      const x = idx * slotW + (slotW - barW) / 2;
                      const delivVal = Math.max(b.paDeliveredCount, b.paInsuredCount);
                      const delivH =
                        delivVal > 0 ? Math.max(6, (delivVal / maxPaDelivered) * 23) : 3;
                      const insH =
                        b.paInsuredCount > 0
                          ? Math.max(4.5, Math.min(delivH, (b.paInsuredCount / maxPaDelivered) * 23))
                          : 0;
                      const delivY = 29 - delivH;
                      const insY = 29 - insH;
                      const isHovered = activeIdx === idx;
                      const isDimmed = activeIdx !== null && !isHovered;

                      return (
                        <g
                          key={`pa-${b.label}-${idx}`}
                          onMouseEnter={() => setHoveredKpiSlot({ card: 'pa', idx })}
                          onTouchStart={() => setHoveredKpiSlot({ card: 'pa', idx })}
                          className="animate-kpi-mini-bar cursor-pointer"
                          style={{
                            animationDelay: `${idx * 45}ms`,
                            opacity: isDimmed ? 0.45 : 1,
                            transition: 'opacity 160ms ease',
                          }}
                        >
                          <rect x={idx * slotW} y={0} width={slotW} height={42} fill="transparent" />
                          <rect
                            x={x}
                            y={delivY}
                            width={barW}
                            height={delivH}
                            rx={3}
                            fill="#818cf8"
                            fillOpacity={delivVal > 0 ? 0.2 : 0.08}
                            stroke="#6366f1"
                            strokeOpacity={isHovered ? 0.85 : delivVal > 0 ? 0.42 : 0.16}
                            strokeWidth={isHovered ? 1 : 0.7}
                          />
                          {insH > 0 && (
                            <>
                              <rect
                                x={x + 1.3}
                                y={insY}
                                width={barW - 2.6}
                                height={insH}
                                rx={2.2}
                                fill="url(#tsdPaFillGrad)"
                              />
                              <rect
                                x={x + 2.3}
                                y={insY + 0.9}
                                width={Math.max(2, barW - 4.6)}
                                height={Math.min(2.6, Math.max(1.2, insH * 0.28))}
                                rx={1.1}
                                fill="#ffffff"
                                fillOpacity={0.62}
                              />
                            </>
                          )}
                          <text
                            x={x + barW / 2}
                            y={39.5}
                            textAnchor="middle"
                            fontSize="7.5"
                            fontWeight={isHovered ? 800 : 600}
                            fill="currentColor"
                            className={
                              isHovered
                                ? 'text-violet-600 dark:text-violet-300'
                                : 'text-slate-400 dark:text-slate-500'
                            }
                          >
                            {b.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            </button>
          );
        })()}
      </section>

      {/* =====================================================================
          ROW 2: Left 2x2 Gradient Wave Cards + Right Deal Breakdown & Donut
         ===================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
        {/* Left 6 cols: 2x2 Gradient Wave Metric & Action Cards */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/85 dark:border-slate-800 shadow-[0_2px_14px_-4px_rgba(15,23,42,0.06)] p-3.5 flex flex-col justify-between">
          <div className="grid grid-cols-2 gap-3 h-full">
            {/* Gradient Card 1: Cyan -> Royal Blue */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                onNavigateToPeriodClosing();
              }}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-indigo-600 text-white p-4 text-center flex flex-col items-center justify-center min-h-[118px] shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer"
            >
              <svg
                viewBox="0 0 240 60"
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-x-0 bottom-0 w-full h-11 opacity-35"
                aria-hidden="true"
              >
                <path
                  d="M0,34 C45,10 85,48 135,24 C175,6 210,36 240,22 L240,60 L0,60 Z"
                  fill="rgba(255,255,255,0.45)"
                />
                <path
                  d="M0,42 C55,22 105,54 160,30 C195,15 220,40 240,34"
                  fill="none"
                  stroke="rgba(255,255,255,0.8)"
                  strokeWidth="1.8"
                />
              </svg>
              <div className="relative z-10 space-y-1">
                <div className="text-xl xl:text-2xl font-black tabular-nums tracking-tight drop-shadow-xs">
                  {formatCompactBaht(stats.approvedTotalFinance)}
                </div>
                <div className="text-[11px] font-bold text-white/90">
                  ยอดจัดอนุมัติ · {stats.approvedTotalCount} เคส
                </div>
                <div className="text-[10px] font-medium text-white/80">แตะเพื่อเปิดสรุปปิดยอด</div>
              </div>
            </button>

            {/* Gradient Card 2: Orchid -> Violet Indigo (Opens Gasoline Allowance Popup) */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setShowGasolineModal(true);
              }}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-fuchsia-400 via-violet-500 to-indigo-600 text-white p-4 text-center flex flex-col items-center justify-center min-h-[118px] shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer"
              title="แตะเพื่อเปิดกล่องสรุปยอดค่าน้ำมันและจำลองเป้าหมาย"
            >
              <svg
                viewBox="0 0 240 60"
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-x-0 bottom-0 w-full h-11 opacity-35"
                aria-hidden="true"
              >
                <path
                  d="M0,28 C50,48 95,12 148,36 C188,52 215,18 240,26 L240,60 L0,60 Z"
                  fill="rgba(255,255,255,0.42)"
                />
                <path
                  d="M0,38 C60,52 102,16 154,36 C194,50 220,24 240,30"
                  fill="none"
                  stroke="rgba(255,255,255,0.8)"
                  strokeWidth="1.8"
                />
              </svg>
              <div className="relative z-10 space-y-1">
                <div className="text-xl xl:text-2xl font-black tabular-nums tracking-tight drop-shadow-xs flex items-center justify-center gap-1.5">
                  <Fuel className="w-4 h-4 shrink-0" />
                  <span>{formatBaht(gasolineSummary.currentTier.allowanceBaht)}</span>
                </div>
                <div className="text-[11px] font-bold text-white/90">
                  ค่าน้ำมัน Checker · {commissionSummary.totalDeliveredContracts} สัญญา
                </div>
                <div className="text-[10px] font-medium text-white/80">
                  {gasolineSummary.currentTier.tierName} ({gasolineSummary.currentTier.shortRangeLabel} สัญญา) · แตะดูสรุป
                </div>
              </div>
            </button>

            {/* Gradient Card 3: Coral Pink -> Crimson */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                onNavigateToDocuments();
              }}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-400 via-pink-500 to-rose-600 text-white p-4 text-center flex flex-col items-center justify-center min-h-[118px] shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer"
            >
              <svg
                viewBox="0 0 240 60"
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-x-0 bottom-0 w-full h-11 opacity-35"
                aria-hidden="true"
              >
                <path
                  d="M0,36 C55,14 95,48 145,28 C185,12 215,38 240,20 L240,60 L0,60 Z"
                  fill="rgba(255,255,255,0.42)"
                />
                <path
                  d="M0,44 C52,20 98,52 148,32 C188,16 216,42 240,26"
                  fill="none"
                  stroke="rgba(255,255,255,0.8)"
                  strokeWidth="1.8"
                />
              </svg>
              <div className="relative z-10 space-y-1">
                <div className="text-xl xl:text-2xl font-black tabular-nums tracking-tight drop-shadow-xs">
                  {stats.pendingCount + stats.approvedPendingDeliveryCount} เคส
                </div>
                <div className="text-[11px] font-bold text-white/90">
                  รออนุมัติ {stats.pendingCount} · รอรับรถ {stats.approvedPendingDeliveryCount}
                </div>
                <div className="text-[10px] font-medium text-white/80">
                  แตะเพื่อจัดการเอกสาร & DV
                </div>
              </div>
            </button>

            {/* Gradient Card 4: Peach -> Warm Amber */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                onNavigateToCheckerCommission();
              }}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500 text-white p-4 text-center flex flex-col items-center justify-center min-h-[118px] shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer"
            >
              <svg
                viewBox="0 0 240 60"
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-x-0 bottom-0 w-full h-11 opacity-35"
                aria-hidden="true"
              >
                <path
                  d="M0,32 C48,50 96,18 150,38 C192,50 218,22 240,28 L240,60 L0,60 Z"
                  fill="rgba(255,255,255,0.42)"
                />
                <path
                  d="M0,40 C54,52 104,20 156,40 C196,52 220,28 240,34"
                  fill="none"
                  stroke="rgba(255,255,255,0.8)"
                  strokeWidth="1.8"
                />
              </svg>
              <div className="relative z-10 space-y-1">
                <div className="text-xl xl:text-2xl font-black tabular-nums tracking-tight drop-shadow-xs">
                  {formatBaht(commissionSummary.totalCommissionBaht)}
                </div>
                <div className="text-[11px] font-bold text-white/90">
                  ค่าคอม PA · {commissionSummary.tierRule.label}
                </div>
                <div className="text-[10px] font-medium text-white/80">
                  Achievement {commissionSummary.achievementPercent.toFixed(1)}%
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Right 6 cols: Deal Details Breakdown Table + Bold Donut Chart */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/85 dark:border-slate-800 shadow-[0_2px_14px_-4px_rgba(15,23,42,0.06)] p-4 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                รายละเอียดสถานะดีล & ยอดจัด
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                สรุป 4 ขั้นตอนและสัดส่วนประกัน PA
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                onOpenSavedCases();
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-bold text-indigo-600 dark:text-sky-300 flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0"
            >
              <span>ตารางเคส</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-12 items-center gap-2 flex-1">
            {/* Compact Table */}
            <div className="col-span-7 overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px] tabular-nums">
                <thead>
                  <tr className="text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                    <th className="py-1.5 font-semibold">สถานะ</th>
                    <th className="py-1.5 text-right font-semibold">เคส</th>
                    <th className="py-1.5 text-right font-semibold">ยอด</th>
                    <th className="py-1.5 text-right font-semibold">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80 dark:divide-slate-800/80">
                  {dealBreakdownRows.map((row) => (
                    <tr
                      key={row.key}
                      onClick={() => {
                        triggerHaptic('light');
                        if (row.key === 'paInsured') {
                          onNavigateToCheckerCommission();
                        } else {
                          onOpenSavedCases();
                        }
                      }}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                    >
                      <td className="py-2 pr-1.5 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: row.color }}
                          />
                          <span>{row.label}</span>
                        </span>
                      </td>
                      <td className="py-2 px-1 text-right font-bold text-slate-900 dark:text-white">
                        {row.count}
                      </td>
                      <td className="py-2 px-1 text-right font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {formatCompactBaht(row.amount)}
                      </td>
                      <td className="py-2 pl-1 text-right font-semibold text-slate-600 dark:text-slate-300">
                        {row.pct.toFixed(0)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bold Multi-Segment Donut Chart */}
            <div className="col-span-5 relative h-[168px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieSlices}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={68}
                    paddingAngle={pieSlices.length > 1 ? 3 : 0}
                    stroke="none"
                    startAngle={90}
                    endAngle={-270}
                  >
                    {pieSlices.map((slice) => (
                      <Cell key={slice.key} fill={slice.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: unknown) => [`${val} เคส`, 'จำนวน']}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      fontSize: '11px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-base font-black text-slate-900 dark:text-white tabular-nums leading-tight">
                  {stats.totalCases}
                </span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {stats.approvalRate.toFixed(0)}% อนุมัติ
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          ROW 3: Bottom 2-Column Graphs (Statistic Bar Graph + Cases/Timeline)
         ===================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
        {/* Bottom Left 6 cols: Dimensional Animated Performance Statistics Chart */}
        <div className="lg:col-span-6 relative overflow-hidden rounded-2xl bg-gradient-to-br from-white via-white to-indigo-50/55 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/35 border border-slate-200/85 dark:border-slate-800 shadow-[0_8px_24px_-8px_rgba(79,70,229,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] dark:shadow-[0_10px_28px_-8px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)] p-4 flex flex-col justify-between gap-2.5">
          {/* Top Hairline Highlight & Corner Ambient Glow */}
          <span
            className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white dark:via-indigo-300/35 to-transparent"
            aria-hidden="true"
          />
          <span
            className="pointer-events-none -right-10 -top-10 absolute w-36 h-36 rounded-full bg-indigo-400/12 dark:bg-indigo-500/12 blur-2xl"
            aria-hidden="true"
          />

          <div className="relative flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 text-white flex items-center justify-center shadow-sm shadow-indigo-500/25 ring-1 ring-white/50 dark:ring-white/15 shrink-0">
                <BarChart3 className="w-3.5 h-3.5" />
              </span>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                กราฟสถิติผลงาน
              </h3>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Visual Mode Switcher: 3D Pillars vs Smooth Wave */}
              <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setStatVisualMode('bars');
                  }}
                  className={`px-2 py-1 rounded-lg text-[10.5px] font-bold inline-flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                    statVisualMode === 'bars'
                      ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-2xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <BarChart3 className="w-3 h-3" />
                  <span>แท่ง 3D</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setStatVisualMode('wave');
                  }}
                  className={`px-2 py-1 rounded-lg text-[10.5px] font-bold inline-flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                    statVisualMode === 'wave'
                      ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-2xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Activity className="w-3 h-3" />
                  <span>คลื่น 3D</span>
                </button>
              </div>
            </div>
          </div>

          {/* Timeframe Tabs + Legend Row */}
          <div className="relative flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-5 text-xs">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setStatGraphTab('monthly');
                  setPinnedPerfIdx(null);
                  setHoveredPerfIdx(null);
                }}
                className={`pb-2 font-bold border-b-2 transition-colors cursor-pointer ${
                  statGraphTab === 'monthly'
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                สถิติรายเดือน
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setStatGraphTab('weekly');
                  setPinnedPerfIdx(null);
                  setHoveredPerfIdx(null);
                }}
                className={`pb-2 font-bold border-b-2 transition-colors cursor-pointer ${
                  statGraphTab === 'weekly'
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                7 วันล่าสุด
              </button>
            </div>

            <div className="flex items-center gap-3 pb-2 text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-sky-400 to-indigo-600 shadow-2xs" />
                เคสทั้งหมด
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 shadow-2xs" />
                รับรถแล้ว
              </span>
            </div>
          </div>

          {/* Interactive Spotlight Readout Bar */}
          {savedCases.length > 0 && (
            <div className="relative flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-[11px] tabular-nums">
              {spotlightPerfItem ? (
                <>
                  <div className="flex items-center gap-2 min-w-0 truncate">
                    <span className="font-extrabold text-indigo-600 dark:text-sky-300 shrink-0">
                      {spotlightPerfItem.fullLabel}
                    </span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      เคส {spotlightPerfItem.total}
                    </span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      รับรถ {spotlightPerfItem.delivered} (
                      {spotlightPerfItem.total > 0
                        ? Math.round((spotlightPerfItem.delivered / spotlightPerfItem.total) * 100)
                        : 0}
                      %)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-extrabold text-slate-900 dark:text-white">
                      {formatCompactBaht(spotlightPerfItem.finance)}
                    </span>
                    {pinnedPerfIdx !== null && (
                      <button
                        type="button"
                        onClick={() => setPinnedPerfIdx(null)}
                        className="text-[10px] font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline cursor-pointer"
                      >
                        รีเซ็ต
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 min-w-0 truncate text-slate-600 dark:text-slate-300">
                    <span className="font-semibold">
                      รวม {perfSummary.sumTotal} เคส · รับรถ {perfSummary.sumDelivered} คัน
                    </span>
                  </div>
                  <span className="font-bold text-indigo-600 dark:text-sky-300 shrink-0">
                    {perfSummary.peakItem && perfSummary.peakItem.total > 0
                      ? `สูงสุด ${perfSummary.peakItem.fullLabel} (${perfSummary.peakItem.total})`
                      : 'แตะแท่งกราฟเพื่อเจาะลึก'}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Animated 3D Chart Viewport */}
          <div key={`${statGraphTab}-${statVisualMode}`} className="h-[190px] w-full pt-1 animate-tab-fade">
            {savedCases.length === 0 ? (
              <div className="h-full rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center p-4 space-y-2">
                <TrendingUp className="w-6 h-6 text-indigo-500" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  ยังไม่มีข้อมูลเคสสำหรับแสดงกราฟ
                </p>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('medium');
                    onNavigateToCaseForm();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>คำนวณ / บันทึกเคสแรก</span>
                </button>
              </div>
            ) : statVisualMode === 'bars' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={activeBarData}
                  barGap={4}
                  margin={{ top: 14, right: 8, left: -24, bottom: 2 }}
                  onMouseLeave={() => setHoveredPerfIdx(null)}
                >
                  <defs>
                    <linearGradient id="tsdPerfTotalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="48%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#4338ca" />
                    </linearGradient>
                    <linearGradient id="tsdPerfDelivGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" />
                      <stop offset="52%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#047857" />
                    </linearGradient>
                    <filter id="tsdPerfBarShadow" x="-20%" y="-15%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="2.5" stdDeviation="2" floodColor="#1e293b" floodOpacity="0.18" />
                    </filter>
                    <filter id="tsdPerfTotalGlow" x="-35%" y="-25%" width="170%" height="160%">
                      <feDropShadow dx="0" dy="3" stdDeviation="3.5" floodColor="#4f46e5" floodOpacity="0.45" />
                    </filter>
                    <filter id="tsdPerfDelivGlow" x="-35%" y="-25%" width="170%" height="160%">
                      <feDropShadow dx="0" dy="3" stdDeviation="3.5" floodColor="#059669" floodOpacity="0.42" />
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.22)" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10.5, fill: '#64748b', fontWeight: 700 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                  />
                  {perfSummary.avgTotal > 0 && (
                    <ReferenceLine
                      y={perfSummary.avgTotal}
                      stroke="#6366f1"
                      strokeDasharray="4 4"
                      strokeOpacity={0.38}
                    />
                  )}
                  <Tooltip
                    content={<StatBarTooltip />}
                    cursor={{ fill: 'rgba(99,102,241,0.06)', radius: 8 }}
                  />
                  <Bar
                    dataKey="total"
                    barSize={13}
                    name="เคสทั้งหมด"
                    isAnimationActive
                    animationDuration={680}
                    animationEasing="ease-out"
                    shape={(props: unknown) => {
                      const p = props as Performance3DBarShapeProps;
                      return (
                        <Performance3DBarShape
                          {...p}
                          series="total"
                          peakIdx={perfSummary.peakIdx}
                          activeIdx={effectivePerfIdx}
                          onHover={setHoveredPerfIdx}
                          onSelect={(idx) => {
                            triggerHaptic('light');
                            setPinnedPerfIdx((prev) => (prev === idx ? null : idx));
                          }}
                        />
                      );
                    }}
                  />
                  <Bar
                    dataKey="delivered"
                    barSize={13}
                    name="รับรถแล้ว"
                    isAnimationActive
                    animationDuration={760}
                    animationEasing="ease-out"
                    shape={(props: unknown) => {
                      const p = props as Performance3DBarShapeProps;
                      return (
                        <Performance3DBarShape
                          {...p}
                          series="delivered"
                          peakIdx={perfSummary.peakIdx}
                          activeIdx={effectivePerfIdx}
                          onHover={setHoveredPerfIdx}
                          onSelect={(idx) => {
                            triggerHaptic('light');
                            setPinnedPerfIdx((prev) => (prev === idx ? null : idx));
                          }}
                        />
                      );
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={activeBarData}
                  margin={{ top: 14, right: 10, left: -24, bottom: 2 }}
                >
                  <defs>
                    <linearGradient id="tsdPerfWaveFillTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity="0.42" />
                      <stop offset="65%" stopColor="#38bdf8" stopOpacity="0.14" />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
                    </linearGradient>
                    <linearGradient id="tsdPerfWaveFillDeliv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.38" />
                      <stop offset="65%" stopColor="#2dd4bf" stopOpacity="0.12" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                    </linearGradient>
                    <linearGradient id="tsdPerfWaveStrokeTotal" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="50%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                    <linearGradient id="tsdPerfWaveStrokeDeliv" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#34d399" />
                      <stop offset="50%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.22)" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10.5, fill: '#64748b', fontWeight: 700 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                  />
                  {perfSummary.avgTotal > 0 && (
                    <ReferenceLine
                      y={perfSummary.avgTotal}
                      stroke="#6366f1"
                      strokeDasharray="4 4"
                      strokeOpacity={0.45}
                    />
                  )}
                  <Tooltip content={<StatBarTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="url(#tsdPerfWaveStrokeTotal)"
                    strokeWidth={2.8}
                    fill="url(#tsdPerfWaveFillTotal)"
                    dot={{ r: 3, fill: '#ffffff', stroke: '#5b5be6', strokeWidth: 1.6 }}
                    activeDot={{ r: 5.5, fill: '#ffffff', stroke: '#4f46e5', strokeWidth: 2.5 }}
                    isAnimationActive
                    animationDuration={680}
                    animationEasing="ease-out"
                  />
                  <Area
                    type="monotone"
                    dataKey="delivered"
                    stroke="url(#tsdPerfWaveStrokeDeliv)"
                    strokeWidth={2.6}
                    fill="url(#tsdPerfWaveFillDeliv)"
                    dot={{ r: 2.8, fill: '#ffffff', stroke: '#10b981', strokeWidth: 1.6 }}
                    activeDot={{ r: 5.5, fill: '#ffffff', stroke: '#059669', strokeWidth: 2.5 }}
                    isAnimationActive
                    animationDuration={760}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Bottom Right 6 cols: Recent Cases / Timeline & Dealers / Quick Tools */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/85 dark:border-slate-800 shadow-[0_2px_14px_-4px_rgba(15,23,42,0.06)] p-4 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              ข้อมูลเคส · กำหนดชำระ & ทางลัด
            </h3>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                onOpenSavedCases();
              }}
              className="text-[11px] font-bold text-indigo-600 dark:text-sky-400 hover:underline cursor-pointer whitespace-nowrap"
            >
              ดูทั้งหมด ({savedCases.length}) →
            </button>
          </div>

          <div className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 text-xs overflow-x-auto">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setRightBottomTab('recent');
              }}
              className={`pb-2 font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                rightBottomTab === 'recent'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              เคสล่าสุด ({recentCases.length})
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setRightBottomTab('timeline');
              }}
              className={`pb-2 font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                rightBottomTab === 'timeline'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              ไทม์ไลน์งวดชำระ & ดีลเลอร์
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setRightBottomTab('tools');
              }}
              className={`pb-2 font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                rightBottomTab === 'tools'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              ทางลัดฟังก์ชัน
            </button>
          </div>

          <div className="min-h-[195px] flex flex-col justify-between">
            {rightBottomTab === 'recent' && (
              recentCases.length === 0 ? (
                <div className="h-[195px] rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center p-4 space-y-2">
                  <FileText className="w-6 h-6 text-slate-400" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    ยังไม่มีรายการเคสในงวดนี้
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('medium');
                      onNavigateToCaseForm();
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{activeDraft.isEditing ? 'กลับไปแก้ไขเคส' : 'สร้างเคสแรก'}</span>
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recentCases.slice(0, 4).map((c) => {
                    const badge = getStatusBadge(c);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          onLoadCase(c);
                        }}
                        className="w-full py-2 px-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-lg flex items-center justify-between gap-2 text-left cursor-pointer transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {c.customerName?.trim() || c.caseTitle || 'คุณลูกค้า'}
                          </div>
                          <div className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">
                            {c.bikeModelName || c.snapshot?.proposalCode || '-'}
                            {c.dealerName ? ` · ${c.dealerName}` : ''}
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-bold whitespace-nowrap shrink-0 ${badge.className}`}
                        >
                          {badge.key === 'delivered' && <PackageCheck className="w-3 h-3" />}
                          {badge.key === 'approved' && <CheckCircle2 className="w-3 h-3" />}
                          {badge.key === 'rejected' && <Ban className="w-3 h-3" />}
                          {badge.key === 'pending' && <Clock className="w-3 h-3" />}
                          <span>{badge.label}</span>
                        </span>
                        <div className="text-right tabular-nums shrink-0">
                          <div className="text-xs font-extrabold text-indigo-600 dark:text-sky-400">
                            {formatBaht(c.snapshot?.monthlyInstallment || 0)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {c.term} งวด · {formatThaiShortDate(c.createdAt)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            )}

            {rightBottomTab === 'timeline' && (
              <div className="flex flex-col justify-between gap-3 pt-2">
                {/* Horizontal Alternating Milestone Timeline (matches bottom-right reference graphic) */}
                <div className="relative py-5 px-2">
                  <div
                    className="absolute inset-x-4 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-indigo-200 dark:border-slate-700"
                    aria-hidden="true"
                  />
                  <div className="relative grid grid-cols-4 gap-2">
                    {timelineItems.slice(0, 4).map((item, idx) => {
                      const isOdd = idx % 2 === 1;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            triggerHaptic('light');
                            onNavigateToInstallments();
                          }}
                          className="group flex flex-col items-center text-center cursor-pointer"
                        >
                          <div className={`min-h-[38px] flex flex-col justify-end pb-1.5 ${isOdd ? 'opacity-100' : ''}`}>
                            {!isOdd ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold whitespace-nowrap shadow-xs">
                                {item.badge}
                              </span>
                            ) : (
                              <div>
                                <div className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">
                                  {item.title}
                                </div>
                                <div className="text-[9.5px] text-slate-500 dark:text-slate-400 tabular-nums">
                                  {item.subtitle}
                                </div>
                              </div>
                            )}
                          </div>

                          <span className="relative z-10 w-3.5 h-3.5 rounded-full bg-white dark:bg-slate-900 border-2 border-indigo-500 flex items-center justify-center group-hover:scale-125 transition-transform">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                          </span>

                          <div className="min-h-[38px] flex flex-col justify-start pt-1.5">
                            {isOdd ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold whitespace-nowrap shadow-xs">
                                {item.badge}
                              </span>
                            ) : (
                              <div>
                                <div className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">
                                  {item.title}
                                </div>
                                <div className="text-[9.5px] text-slate-500 dark:text-slate-400 tabular-nums">
                                  {item.subtitle}
                                </div>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Top Dealer Snapshot Row */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400 truncate">
                    ร้านตัวแทนสูงสุด:{' '}
                    <strong className="text-slate-800 dark:text-slate-100">
                      {dealerSummaryList[0]?.name || 'ยังไม่มีข้อมูล'}
                    </strong>
                    {dealerSummaryList[0] ? ` (${dealerSummaryList[0].total} เคส)` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      onNavigateToInstallments();
                    }}
                    className="font-bold text-indigo-600 dark:text-sky-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    ติดตามงวดชำระ →
                  </button>
                </div>
              </div>
            )}

            {rightBottomTab === 'tools' && (
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    onNavigateToPeriodClosing();
                  }}
                  className="p-3 rounded-xl bg-sky-50/80 hover:bg-sky-100/80 dark:bg-sky-950/40 dark:hover:bg-sky-900/50 border border-sky-200/70 dark:border-sky-800/60 text-left space-y-1 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-1.5 text-sky-700 dark:text-sky-300 font-extrabold text-xs">
                    <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                    <span>ปิดยอด 1-15 / สิ้นเดือน</span>
                  </div>
                  <p className="text-[10.5px] text-slate-600 dark:text-slate-300">
                    สรุปยอดอนุมัติ & รับรถประจำงวด
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    onNavigateToCheckerCommission();
                  }}
                  className="p-3 rounded-xl bg-amber-50/80 hover:bg-amber-100/80 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 border border-amber-200/70 dark:border-amber-800/60 text-left space-y-1 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-extrabold text-xs">
                    <Award className="w-3.5 h-3.5 shrink-0" />
                    <span>คำนวณค่าคอม PA</span>
                  </div>
                  <p className="text-[10.5px] text-slate-600 dark:text-slate-300">
                    รายงาน Tier 1-3 & ส่ง LINE
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    onNavigateToDocuments();
                  }}
                  className="p-3 rounded-xl bg-emerald-50/80 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 border border-emerald-200/70 dark:border-emerald-800/60 text-left space-y-1 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-extrabold text-xs">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>เอกสาร & ขออนุมัติ DV</span>
                  </div>
                  <p className="text-[10.5px] text-slate-600 dark:text-slate-300">
                    ใบเสนอราคา & แผน PA
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    onNavigateToInstallments();
                  }}
                  className="p-3 rounded-xl bg-indigo-50/80 hover:bg-indigo-100/80 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 border border-indigo-200/70 dark:border-indigo-800/60 text-left space-y-1 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 font-extrabold text-xs">
                    <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                    <span>ติดตามกำหนดชำระ</span>
                  </div>
                  <p className="text-[10.5px] text-slate-600 dark:text-slate-300">
                    ตารางงวดที่ 1-9 รายเดือน
                  </p>
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* =====================================================================
          ROW 4: กราฟสรุปตามร้านตัวแทน & สาขา (Dealers & Branches Chart)
         ===================================================================== */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white via-white to-sky-50/55 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/35 border border-slate-200/85 dark:border-slate-800 shadow-[0_8px_24px_-8px_rgba(14,165,233,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] dark:shadow-[0_10px_28px_-8px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)] p-4 space-y-3">
        <span
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white dark:via-sky-300/35 to-transparent"
          aria-hidden="true"
        />

        {/* Header Row */}
        <div className="relative flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-teal-500 text-white flex items-center justify-center shadow-sm shadow-sky-500/25 ring-1 ring-white/50 dark:ring-white/15 shrink-0">
              <Building2 className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                กราฟสรุปตามร้านตัวแทน (Dealers)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                งวด {formatMonthLabel(selectedMonth)} · จำนวนเคสและยอดจัดแยกตามร้าน/สาขา
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {dealerSummaryList.length > 0 && (
              <div
                role="group"
                aria-label="มุมมองกราฟร้านตัวแทน"
                className="flex items-center gap-0.5 p-0.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80"
              >
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setDealerViewMode('chart');
                  }}
                  aria-pressed={dealerViewMode === 'chart'}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold inline-flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                    dealerViewMode === 'chart'
                      ? 'bg-white dark:bg-sky-600 text-sky-700 dark:text-white shadow-2xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <BarChart3 className="w-3 h-3" />
                  <span>แท่งกราฟ</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setDealerViewMode('list');
                  }}
                  aria-pressed={dealerViewMode === 'list'}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold inline-flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                    dealerViewMode === 'list'
                      ? 'bg-white dark:bg-sky-600 text-sky-700 dark:text-white shadow-2xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <LayoutList className="w-3 h-3" />
                  <span>รายการ</span>
                </button>
              </div>
            )}

            <span className="px-2.5 py-1 rounded-xl bg-sky-50/90 dark:bg-sky-950/70 border border-sky-200/80 dark:border-sky-700/70 text-[11px] font-extrabold text-sky-800 dark:text-sky-200 tabular-nums whitespace-nowrap">
              {dealerSummaryList.length} ร้าน · {stats.totalCases} เคส
            </span>
          </div>
        </div>

        {dealerSummaryList.length === 0 ? (
          <div className="rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 py-8 px-4 text-center space-y-2">
            <Building2 className="w-6 h-6 text-sky-500 mx-auto" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
              ยังไม่มีข้อมูลร้านตัวแทนในงวด {formatMonthLabel(selectedMonth)}
            </p>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('medium');
                onNavigateToCaseForm();
              }}
              className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>คำนวณ / บันทึกเคสใหม่</span>
            </button>
          </div>
        ) : dealerViewMode === 'chart' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
            {/* Left 8 cols: Shared-Scale 3D Stacked Bar Chart */}
            <div className="lg:col-span-8 rounded-2xl bg-slate-50/75 dark:bg-slate-800/45 border border-slate-200/70 dark:border-slate-800 p-3 space-y-2.5 min-w-0">
              {/* Legend & Reset */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-slate-600 dark:text-slate-300">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500" />
                    <span>รับรถแล้ว</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-emerald-400 to-green-300" />
                    <span>อนุมัติรอรับรถ</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                    <span>รอผล/อื่นๆ</span>
                  </span>
                </div>
                {selectedDealerName && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setSelectedDealerName(null);
                      setHoveredDealerName(null);
                    }}
                    className="text-sky-700 dark:text-sky-300 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>แสดงทุกร้าน</span>
                  </button>
                )}
              </div>

              {/* Horizontal Stacked Bars with Dashed Gridlines */}
              <div className="relative space-y-1.5">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-2 top-0 bottom-5 z-0"
                >
                  {[0, 20, 40, 60, 80].map((posPct) => (
                    <div
                      key={posPct}
                      className="absolute top-0 bottom-0 border-l border-dashed border-slate-300/70 dark:border-slate-700/70"
                      style={{ left: `${posPct}%` }}
                    />
                  ))}
                </div>

                <div className="relative z-10 space-y-1.5">
                  {dealerSummaryList.map((d) => {
                    const isPinned = selectedDealerName === d.name;
                    const isActive = focusedDealerName === d.name;
                    const isDimmed = Boolean(focusedDealerName && !isActive);
                    const barTrackPct = Math.min(80, (d.total / maxDealerCases) * 80);
                    const delShare = d.total > 0 ? (d.delivered / d.total) * 100 : 0;
                    const pendShare = d.total > 0 ? (d.approvedPending / d.total) * 100 : 0;
                    const otherShare = d.total > 0 ? (d.other / d.total) * 100 : 0;

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
                        className={`w-full text-left rounded-xl px-2.5 py-1.5 border transition-all duration-150 cursor-pointer space-y-1 ${
                          isActive
                            ? 'bg-white dark:bg-slate-800/95 border-sky-300 dark:border-sky-600 shadow-xs'
                            : isDimmed
                              ? 'border-transparent opacity-55 hover:opacity-95'
                              : 'border-transparent hover:bg-white/80 dark:hover:bg-slate-800/65'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11.5px] font-bold text-slate-800 dark:text-slate-100 truncate min-w-0">
                            {d.name}
                          </span>
                          <span className="text-[10.5px] font-semibold text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap shrink-0">
                            รับรถ{' '}
                            <strong className="text-teal-700 dark:text-teal-300">
                              {d.delivered}
                            </strong>
                            /{d.total} ·{' '}
                            <strong className="text-sky-700 dark:text-sky-300">
                              {formatCompactBaht(d.finance)}
                            </strong>
                          </span>
                        </div>

                        <div className="flex items-center w-full h-4">
                          <div
                            style={{
                              width: `${barTrackPct}%`,
                              minWidth: d.total > 0 ? '16px' : '0px',
                            }}
                            className={`relative h-3.5 rounded-full overflow-hidden flex transition-all duration-500 ease-out shadow-2xs ${
                              isActive
                                ? 'ring-2 ring-sky-400/80 shadow-[0_0_10px_rgba(14,165,233,0.35)]'
                                : 'border border-white/80 dark:border-slate-700/70'
                            }`}
                          >
                            {d.delivered > 0 && (
                              <div
                                style={{ width: `${delShare}%` }}
                                className="h-full bg-gradient-to-r from-teal-500 to-emerald-500"
                              />
                            )}
                            {d.approvedPending > 0 && (
                              <div
                                style={{ width: `${pendShare}%` }}
                                className="h-full bg-gradient-to-r from-emerald-400 to-green-300"
                              />
                            )}
                            {d.other > 0 && (
                              <div
                                style={{ width: `${otherShare}%` }}
                                className="h-full bg-gradient-to-r from-slate-400 to-slate-500"
                              />
                            )}
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-x-0 top-0 h-[45%] bg-gradient-to-b from-white/40 to-transparent"
                            />
                          </div>

                          <span className="ml-2 text-[11px] font-black tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0">
                            {d.total} เคส
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* X-Axis Scale Ticks */}
                <div className="relative mx-2 h-4 text-[9.5px] font-bold text-slate-400 dark:text-slate-500 tabular-nums select-none pt-0.5">
                  <span className="absolute left-0">0</span>
                  {maxDealerCases >= 4 && (
                    <span className="absolute -translate-x-1/2" style={{ left: '40%' }}>
                      {Math.round(maxDealerCases / 2)}
                    </span>
                  )}
                  <span className="absolute -translate-x-1/2" style={{ left: '80%' }}>
                    {maxDealerCases} เคส
                  </span>
                </div>
              </div>
            </div>

            {/* Right 4 cols: Focused Dealer Insight + Total Reconciliation */}
            <div className="lg:col-span-4 space-y-2.5 min-w-0">
              {focusedDealer && (
                <div className="rounded-2xl bg-gradient-to-br from-sky-50/90 via-white to-teal-50/85 dark:from-sky-950/60 dark:via-slate-900 dark:to-teal-950/50 border border-sky-200/80 dark:border-sky-800/70 p-3.5 space-y-2.5 shadow-2xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300 block">
                        {focusedDealerName ? 'ร้านที่เลือกดู' : 'อันดับ 1 สูงสุด'}
                      </span>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white truncate mt-0.5">
                        {focusedDealer.name}
                      </h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white text-[11px] font-black tabular-nums shrink-0">
                      {focusedDealer.total} เคส
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-center text-[10.5px] tabular-nums">
                    <div className="rounded-xl bg-white/90 dark:bg-slate-800/85 border border-slate-200/70 dark:border-slate-700/70 p-2">
                      <div className="text-slate-500 dark:text-slate-400 font-medium">รับรถแล้ว</div>
                      <div className="text-sm font-black text-teal-700 dark:text-teal-300 mt-0.5">
                        {focusedDealer.delivered}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/90 dark:bg-slate-800/85 border border-slate-200/70 dark:border-slate-700/70 p-2">
                      <div className="text-slate-500 dark:text-slate-400 font-medium">รอรับรถ</div>
                      <div className="text-sm font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                        {focusedDealer.approvedPending}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/90 dark:bg-slate-800/85 border border-slate-200/70 dark:border-slate-700/70 p-2">
                      <div className="text-slate-500 dark:text-slate-400 font-medium">อื่นๆ</div>
                      <div className="text-sm font-black text-slate-700 dark:text-slate-200 mt-0.5">
                        {focusedDealer.other}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-sky-200/60 dark:border-slate-700/70 space-y-1 text-[11px] tabular-nums">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 dark:text-slate-400">ยอดจัดรวมร้านนี้</span>
                      <span className="font-black text-indigo-700 dark:text-sky-300">
                        {formatBaht(Math.round(focusedDealer.finance))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 dark:text-slate-400">ยอดจัดรับรถแล้ว</span>
                      <span className="font-bold text-teal-700 dark:text-teal-300">
                        {formatBaht(Math.round(focusedDealer.deliveredFinance))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 dark:text-slate-400">สัดส่วนจากเคสทั้งหมด</span>
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        {stats.totalCases > 0
                          ? `${((focusedDealer.total / stats.totalCases) * 100).toFixed(1)}%`
                          : '0%'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Total Reconciliation Box */}
              <div className="rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70 p-3 space-y-1.5 text-[11px] tabular-nums">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    รวมทุกร้าน ({dealerSummaryList.length} ร้าน)
                  </span>
                  <span className="font-black text-slate-900 dark:text-white">
                    {stats.totalCases} เคส (รับรถ {stats.deliveredCount})
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">ยอดจัดรวมทั้งหมด</span>
                  <span className="font-black text-indigo-700 dark:text-sky-300">
                    {formatBaht(Math.round(stats.totalFinance))}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    onOpenSavedCases();
                  }}
                  className="w-full mt-1 py-1.5 px-3 rounded-xl bg-white dark:bg-slate-900 hover:bg-sky-50 dark:hover:bg-slate-800 border border-slate-200/90 dark:border-slate-700 text-[11px] font-bold text-sky-700 dark:text-sky-300 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <span>ดูเคสแยกตามร้านในตาราง</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* List View Mode */
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <table className="w-full text-left border-collapse text-xs tabular-nums">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-700">
                  <th className="py-2.5 px-3 font-bold">#</th>
                  <th className="py-2.5 px-3 font-bold">ร้านตัวแทน / สาขา</th>
                  <th className="py-2.5 px-3 text-right font-bold">ทั้งหมด</th>
                  <th className="py-2.5 px-3 text-right font-bold">รับรถแล้ว</th>
                  <th className="py-2.5 px-3 text-right font-bold">รอรับรถ</th>
                  <th className="py-2.5 px-3 text-right font-bold">อื่นๆ</th>
                  <th className="py-2.5 px-3 text-right font-bold">ยอดจัดรวม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dealerSummaryList.map((d, idx) => (
                  <tr
                    key={d.name}
                    className="hover:bg-sky-50/50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <td className="py-2 px-3 font-bold text-slate-400">{idx + 1}</td>
                    <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-100">
                      {d.name}
                    </td>
                    <td className="py-2 px-3 text-right font-black text-slate-900 dark:text-white">
                      {d.total} เคส
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-teal-700 dark:text-teal-300">
                      {d.delivered}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-emerald-700 dark:text-emerald-300">
                      {d.approvedPending}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-500 dark:text-slate-400">
                      {d.other}
                    </td>
                    <td className="py-2 px-3 text-right font-extrabold text-indigo-700 dark:text-sky-300 whitespace-nowrap">
                      {formatBaht(Math.round(d.finance))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* =====================================================================
          POPUP MODAL: สรุปยอดค่าน้ำมัน (GasolineAllowanceCard Portal Modal)
         ===================================================================== */}
      {shouldRenderGasolineModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="สรุปยอดค่าน้ำมัน Checker"
            data-modal-portal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isClosingGasolineModal) {
                setShowGasolineModal(false);
              }
            }}
            className={`fixed inset-0 z-[999] flex items-center justify-center p-2 sm:p-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-slate-950/75 backdrop-blur-xs overflow-y-auto overscroll-contain ${gasolineBackdropAnimClass}`}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`bg-white/95 dark:bg-slate-900/95 rounded-[26px] w-full max-w-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] min-h-0 my-auto flex flex-col overflow-hidden shadow-2xl border border-white/80 dark:border-slate-700/80 ${gasolineSheetAnimClass}`}
            >
              {/* Modal Top Bar */}
              <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-200/80 dark:border-slate-800 bg-gradient-to-r from-amber-50/90 via-white to-sky-50/80 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-fuchsia-500 via-violet-500 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <Fuel className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                      สรุปยอดค่าน้ำมัน Checker & จำลองเป้าหมาย
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      {formatMonthLabel(selectedMonth)} · อ้างอิง {commissionSummary.totalDeliveredContracts} สัญญา
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowGasolineModal(false);
                  }}
                  aria-label="ปิดหน้าต่างสรุปค่าน้ำมัน"
                  className="w-8 h-8 rounded-full bg-slate-200/70 dark:bg-slate-800 hover:bg-slate-300/80 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable GasolineAllowanceCard Body */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2.5 sm:p-3.5">
                <GasolineAllowanceCard
                  actualContractCount={commissionSummary.totalDeliveredContracts}
                  periodLabel={formatMonthLabel(selectedMonth)}
                  onOpenSavedCases={() => {
                    setShowGasolineModal(false);
                    onOpenSavedCases();
                  }}
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
