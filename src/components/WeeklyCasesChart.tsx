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
import { CalendarDays } from 'lucide-react';
import { SavedCaseRecord } from '../types';
import { getSavedCases } from '../utils/savedCasesStorage';
import { formatBaht } from '../data/proposals';
import { triggerHaptic } from '../utils/haptics';
import { MarqueeText } from './MarqueeText';

interface WeeklyCasesChartProps {
  refreshTrigger?: number;
  onGoToCalculate?: () => void;
}

interface DailyBucketDatum {
  dateKey: string; // YYYY-MM-DD in Asia/Bangkok
  shortLabel: string; // e.g. "17 พ.ย."
  weekdayShort: string; // e.g. "อ."
  fullLabel: string; // e.g. "วันอังคารที่ 17 พ.ย. 2569"
  isToday: boolean;
  count: number;
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

const THAI_WEEKDAY_SHORTS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const THAI_WEEKDAY_FULL = [
  'วันอาทิตย์',
  'วันจันทร์',
  'วันอังคาร',
  'วันพุธ',
  'วันพฤหัสบดี',
  'วันศุกร์',
  'วันเสาร์',
];

function getBangkokDateParts(tsMs: number): {
  year: number;
  month: number;
  day: number;
  weekdayIndex: number;
  dateKey: string;
} {
  const safeTs = Number.isFinite(tsMs) && tsMs > 0 ? tsMs : Date.now();
  // Shift timestamp to UTC+7 so UTC getters reflect Asia/Bangkok calendar date deterministically
  const bkk = new Date(safeTs + 7 * 60 * 60 * 1000);
  const year = bkk.getUTCFullYear();
  const month = bkk.getUTCMonth() + 1;
  const day = bkk.getUTCDate();
  const weekdayIndex = bkk.getUTCDay();
  const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { year, month, day, weekdayIndex, dateKey };
}

interface WeeklyTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: DailyBucketDatum }>;
}

const WeeklyChartTooltip: React.FC<WeeklyTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0]?.payload;
  if (!datum) return null;

  return (
    <div className="rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-sky-200/80 dark:border-slate-700/85 shadow-lg px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 min-w-[195px]">
      <div className="font-bold text-slate-900 dark:text-slate-50 pb-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
        <span>
          {datum.fullLabel}
          {datum.isToday ? ' (วันนี้)' : ''}
        </span>
        <span className="font-mono tabular-nums text-sky-700 dark:text-sky-300 font-extrabold shrink-0">
          {datum.count} เคส
        </span>
      </div>
      <div className="pt-1.5 space-y-1 text-[11px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-teal-700 dark:text-teal-300 font-medium">รับรถแล้ว</span>
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
          <span className="text-cyan-700 dark:text-cyan-300 font-medium">รอผล / บันทึกไว้</span>
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

export const WeeklyCasesChart: React.FC<WeeklyCasesChartProps> = ({
  refreshTrigger,
  onGoToCalculate,
}) => {
  const [savedCases, setSavedCases] = useState<SavedCaseRecord[]>(() => getSavedCases());
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

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

  const { dailyData, summaryStats, rangeLabel } = useMemo(() => {
    const nowMs = Date.now();
    const todayParts = getBangkokDateParts(nowMs);
    const todayNoonUtcMs = Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day, 5, 0, 0);

    const bucketMap = new Map<string, DailyBucketDatum>();
    const orderedKeys: string[] = [];

    for (let offset = 6; offset >= 0; offset -= 1) {
      const targetTs = todayNoonUtcMs - offset * 24 * 60 * 60 * 1000;
      const parts = getBangkokDateParts(targetTs);
      const thaiYear = parts.year + 543;
      const monthShort = THAI_MONTH_SHORTS[parts.month - 1] || '';
      const weekdayShort = THAI_WEEKDAY_SHORTS[parts.weekdayIndex] || '';
      const weekdayFull = THAI_WEEKDAY_FULL[parts.weekdayIndex] || '';
      const isToday = offset === 0;

      const datum: DailyBucketDatum = {
        dateKey: parts.dateKey,
        shortLabel: `${parts.day} ${monthShort}`,
        weekdayShort,
        fullLabel: `${weekdayFull}ที่ ${parts.day} ${monthShort} ${thaiYear}`,
        isToday,
        count: 0,
        delivered: 0,
        approvedPendingDelivery: 0,
        pending: 0,
        closedOther: 0,
        totalFinance: 0,
      };
      bucketMap.set(parts.dateKey, datum);
      orderedKeys.push(parts.dateKey);
    }

    for (const c of savedCases) {
      const createdTs = Number(c.createdAt);
      if (!Number.isFinite(createdTs) || createdTs <= 0) continue;
      const parts = getBangkokDateParts(createdTs);
      const bucket = bucketMap.get(parts.dateKey);
      if (!bucket) continue;

      bucket.count += 1;
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

    const series = orderedKeys.map((k) => bucketMap.get(k)!);
    const weeklyTotal = series.reduce((sum, d) => sum + d.count, 0);
    const weeklyFinance = series.reduce((sum, d) => sum + d.totalFinance, 0);
    const todayDatum = series[series.length - 1];
    const peakDatum =
      series.reduce<DailyBucketDatum | null>(
        (best, curr) => (!best || curr.count > best.count ? curr : best),
        null
      ) || null;

    const firstShort = series[0]?.shortLabel || '';
    const lastShort = series[series.length - 1]?.shortLabel || '';

    return {
      dailyData: series,
      rangeLabel: firstShort && lastShort ? `${firstShort} – ${lastShort}` : '7 วันล่าสุด',
      summaryStats: {
        weeklyTotal,
        weeklyFinance,
        dailyAvg: weeklyTotal / 7,
        todayCount: todayDatum?.count || 0,
        peakDatum: peakDatum && peakDatum.count > 0 ? peakDatum : null,
      },
    };
  }, [savedCases]);

  const selectedBucket = useMemo(
    () => dailyData.find((d) => d.dateKey === selectedDateKey) || null,
    [dailyData, selectedDateKey]
  );

  return (
    <section className="glass-card-primary rounded-2xl p-3.5 sm:p-5 space-y-3.5 relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white dark:via-cyan-300/35 to-transparent opacity-95"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none -right-12 -top-12 absolute w-40 h-40 rounded-full bg-cyan-300/25 dark:bg-cyan-500/15 blur-2xl"
        aria-hidden="true"
      />

      {/* Header Row */}
      <div className="relative flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-cyan-100/85 to-sky-50/80 dark:from-cyan-500 dark:to-sky-600 border border-white/90 dark:border-cyan-300/30 text-cyan-700 dark:text-white flex items-center justify-center shrink-0 shadow-2xs">
            <CalendarDays className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <MarqueeText className="text-[13.5px] sm:text-base font-black text-slate-900 dark:text-slate-50 tracking-tight">
              สถิติเคสที่สร้างรายวัน (7 วันล่าสุด)
            </MarqueeText>
            <MarqueeText className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 mt-0.5 tabular-nums">
              ช่วงวันที่ {rangeLabel} · เฉลี่ย {summaryStats.dailyAvg.toFixed(1)} เคส/วัน
            </MarqueeText>
          </div>
        </div>
      </div>

      {/* 4-Column Weekly KPI Mini Strip */}
      <div className="relative grid grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-2.5">
        <div className="glass-panel-blue dashboard-card-lift rounded-xl p-2.5 sm:p-3 space-y-0.5 min-w-0">
          <MarqueeText className="text-[10.5px] sm:text-[11px] font-semibold text-sky-900/75 dark:text-sky-200/90">
            เคสรวม 7 วันล่าสุด
          </MarqueeText>
          <div className="text-base sm:text-xl font-black text-sky-950 dark:text-sky-100 font-mono tabular-nums whitespace-nowrap">
            {summaryStats.weeklyTotal}
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 ml-1 font-sans">
              เคส
            </span>
          </div>
        </div>

        <div className="glass-panel-cyan dashboard-card-lift rounded-xl p-2.5 sm:p-3 space-y-0.5 min-w-0">
          <MarqueeText className="text-[10.5px] sm:text-[11px] font-semibold text-cyan-900/75 dark:text-cyan-200/90">
            เคสที่สร้างวันนี้
          </MarqueeText>
          <div className="text-base sm:text-xl font-black text-cyan-950 dark:text-cyan-100 font-mono tabular-nums whitespace-nowrap">
            {summaryStats.todayCount}
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 ml-1 font-sans">
              เคส
            </span>
          </div>
        </div>

        <div className="glass-panel-indigo dashboard-card-lift rounded-xl p-2.5 sm:p-3 space-y-0.5 min-w-0">
          <MarqueeText className="text-[10.5px] sm:text-[11px] font-semibold text-blue-900/75 dark:text-blue-200/90">
            เฉลี่ยต่อวัน (7 วัน)
          </MarqueeText>
          <div className="text-base sm:text-xl font-black text-blue-800 dark:text-blue-200 font-mono tabular-nums whitespace-nowrap">
            {summaryStats.dailyAvg.toFixed(1)}
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 ml-1 font-sans">
              เคส/วัน
            </span>
          </div>
        </div>

        <div className="glass-panel-teal dashboard-card-lift rounded-xl p-2.5 sm:p-3 space-y-0.5 min-w-0">
          <MarqueeText className="text-[10.5px] sm:text-[11px] font-semibold text-teal-900/75 dark:text-teal-200/90">
            วันสร้างสูงสุด
          </MarqueeText>
          <div className="text-base sm:text-xl font-black text-teal-800 dark:text-teal-200 font-mono tabular-nums whitespace-nowrap">
            {summaryStats.peakDatum ? (
              <>
                <span className="font-sans text-sm sm:text-base font-extrabold mr-1">
                  {summaryStats.peakDatum.shortLabel}
                </span>
                ({summaryStats.peakDatum.count})
              </>
            ) : (
              '—'
            )}
          </div>
        </div>
      </div>

      {/* Recharts BarChart Viewport */}
      <div className="relative w-full min-w-0 h-[215px] sm:h-[235px] pt-1 select-none [&_*]:outline-none [&_*]:focus:outline-none [&_svg]:outline-none [&_g]:outline-none [&_path]:outline-none">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            accessibilityLayer={false}
            data={dailyData}
            margin={{ top: 22, right: 10, left: -18, bottom: 8 }}
            barCategoryGap="24%"
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="shortLabel"
              axisLine={{ stroke: 'var(--chart-axis)' }}
              tickLine={false}
              interval={0}
              tick={(tickProps: {
                x?: number | string;
                y?: number | string;
                index?: number;
                payload?: { value?: string };
              }) => {
                const x = Number(tickProps.x) || 0;
                const y = Number(tickProps.y) || 0;
                const datum =
                  typeof tickProps.index === 'number' ? dailyData[tickProps.index] : undefined;
                const label = datum
                  ? `${datum.weekdayShort} ${datum.shortLabel.split(' ')[0]}`
                  : String(tickProps.payload?.value || '');
                const isSelected = datum ? selectedDateKey === datum.dateKey : false;
                const isToday = Boolean(datum?.isToday);

                return (
                  <g transform={`translate(${x},${y})`}>
                    <text
                      x={0}
                      y={0}
                      dy={13}
                      textAnchor="middle"
                      fill={
                        isSelected
                          ? 'var(--chart-tick-active)'
                          : isToday
                          ? 'var(--chart-tick-today)'
                          : 'var(--chart-tick-muted)'
                      }
                      fontSize={11}
                      fontWeight={isSelected || isToday ? 800 : 600}
                    >
                      {label}
                    </text>
                    {isToday && (
                      <text
                        x={0}
                        y={0}
                        dy={25}
                        textAnchor="middle"
                        fill="var(--chart-tick-today)"
                        fontSize={9}
                        fontWeight={700}
                      >
                        วันนี้
                      </text>
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
              cursor={{ fill: 'rgba(6, 182, 212, 0.08)' }}
              content={<WeeklyChartTooltip />}
            />
            <Bar
              dataKey="count"
              name="จำนวนเคสที่สร้าง"
              radius={[7, 7, 0, 0]}
              maxBarSize={44}
              onClick={(_data, idx) => {
                const target = dailyData[idx];
                if (!target) return;
                triggerHaptic('light');
                setSelectedDateKey((prev) => (prev === target.dateKey ? null : target.dateKey));
              }}
              className="cursor-pointer"
            >
              {dailyData.map((entry) => {
                const hasSelection = selectedBucket !== null;
                const isSelected = selectedDateKey === entry.dateKey;
                const isPeak = summaryStats.peakDatum?.dateKey === entry.dateKey && entry.count > 0;
                const fillColor =
                  entry.count === 0
                    ? 'var(--chart-zero-bar)'
                    : isSelected
                    ? '#0369a1'
                    : entry.isToday
                    ? '#06b6d4'
                    : isPeak
                    ? '#0284c7'
                    : '#38bdf8';
                const fillOpacity =
                  entry.count === 0
                    ? 0.55
                    : hasSelection && !isSelected
                    ? 0.32
                    : 1;

                return (
                  <Cell
                    key={entry.dateKey}
                    fill={fillColor}
                    fillOpacity={fillOpacity}
                    stroke={isSelected ? '#38bdf8' : 'none'}
                    strokeWidth={isSelected ? 1.5 : 0}
                  />
                );
              })}
              <LabelList
                dataKey="count"
                position="top"
                formatter={(val: unknown) => (Number(val) > 0 ? String(val) : '')}
                style={{
                  fill: 'var(--chart-label)',
                  fontSize: 11,
                  fontWeight: 800,
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Selected Day Detail or Helpful Footer */}
      {selectedBucket ? (
        <div className="relative glass-panel-cyan rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs">
          <div className="min-w-0 flex-1">
            <MarqueeText className="text-slate-700 dark:text-slate-200 tabular-nums">
              <strong className="text-sky-950 dark:text-sky-100">
                {selectedBucket.fullLabel}
                {selectedBucket.isToday ? ' (วันนี้)' : ''}
              </strong>
              {' · '}
              <strong className="font-mono text-sky-900 dark:text-sky-200">
                {selectedBucket.count} เคส
              </strong>
              {selectedBucket.count > 0
                ? ` · รับรถ ${selectedBucket.delivered} · อนุมัติรอรับ ${selectedBucket.approvedPendingDelivery} · รอผล ${selectedBucket.pending} · ยอดจัด ${formatBaht(Math.round(selectedBucket.totalFinance))} บ.`
                : ' · ยังไม่มีเคสที่สร้างในวันนี้'}
            </MarqueeText>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setSelectedDateKey(null);
            }}
            className="text-xs font-bold text-sky-700 dark:text-sky-300 hover:text-sky-900 dark:hover:text-sky-200 underline cursor-pointer whitespace-nowrap shrink-0"
          >
            ล้างการเลือก
          </button>
        </div>
      ) : summaryStats.weeklyTotal === 0 ? (
        <div className="relative glass-panel-blue rounded-xl px-3 py-2.5 flex items-center justify-between gap-2 text-[11px] sm:text-xs flex-wrap">
          <MarqueeText className="text-slate-600 dark:text-slate-300 flex-1 min-w-0">
            ยังไม่มีเคสที่สร้างในช่วง 7 วันล่าสุด — บันทึกเคสใหม่เพื่อติดตามแนวโน้มรายวัน
          </MarqueeText>
          {onGoToCalculate && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onGoToCalculate();
              }}
              className="btn-fluid-primary px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer"
            >
              คำนวณ / บันทึกเคสใหม่
            </button>
          )}
        </div>
      ) : (
        <div className="relative pt-2 border-t border-white/70 dark:border-slate-700/75 text-[11px] sm:text-xs">
          <MarqueeText className="text-slate-600 dark:text-slate-400">
            แตะที่แท่งกราฟเพื่อดูสรุปรายวัน · ยอดจัดไฟแนนซ์รวม 7 วัน{' '}
            <strong className="font-mono tabular-nums text-sky-950 dark:text-sky-100">
              {formatBaht(Math.round(summaryStats.weeklyFinance))} บ.
            </strong>
          </MarqueeText>
        </div>
      )}
    </section>
  );
};
