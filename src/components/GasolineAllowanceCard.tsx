import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Flame,
  Fuel,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import {
  calculateGasolineAllowance,
  GASOLINE_TIER_RULES,
  GasolineTierRule,
} from '../utils/gasolineAllowance';
import { formatBaht } from '../data/proposals';
import { triggerHaptic } from '../utils/haptics';
import { MarqueeText } from './MarqueeText';

interface GasolineAllowanceCardProps {
  actualContractCount: number;
  periodLabel: string;
  onOpenSavedCases?: () => void;
  className?: string;
}

interface TierVisualTheme {
  auraBg: string;
  secondaryAuraBg: string;
  iconGradient: string;
  iconShadow: string;
  panelBg: string;
  amountText: string;
  badgeBg: string;
  gaugeGradient: string;
  tipGlow: string;
}

function getTierVisualTheme(tierIndex: number): TierVisualTheme {
  if (tierIndex >= 6) {
    // 51+ สูงสุด: Royal Emerald + Gold Trophy Glow
    return {
      auraBg: 'bg-emerald-300/35',
      secondaryAuraBg: 'bg-amber-300/30',
      iconGradient: 'from-amber-400 via-orange-500 to-rose-500',
      iconShadow: 'shadow-amber-500/35',
      panelBg:
        'bg-gradient-to-br from-emerald-50/90 via-white/80 to-amber-50/85 border-emerald-200/90',
      amountText: 'text-emerald-800',
      badgeBg: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-white/60 shadow-xs',
      gaugeGradient: 'from-amber-400 via-emerald-500 to-teal-500',
      tipGlow: 'bg-emerald-400',
    };
  }
  if (tierIndex >= 4) {
    // 30-50 (ขั้น 4-5): Vibrant Emerald / Teal
    return {
      auraBg: 'bg-teal-300/30',
      secondaryAuraBg: 'bg-amber-200/25',
      iconGradient: 'from-emerald-400 to-teal-600',
      iconShadow: 'shadow-teal-500/30',
      panelBg:
        'bg-gradient-to-br from-teal-50/85 via-white/80 to-emerald-50/80 border-teal-200/90',
      amountText: 'text-teal-900',
      badgeBg: 'bg-teal-600 text-white border-white/60 shadow-xs',
      gaugeGradient: 'from-amber-400 via-teal-500 to-emerald-500',
      tipGlow: 'bg-teal-400',
    };
  }
  if (tierIndex >= 1) {
    // 15-29 (ขั้น 1-3): Warm Amber / Flame Orange
    return {
      auraBg: 'bg-amber-300/30',
      secondaryAuraBg: 'bg-orange-200/25',
      iconGradient: 'from-amber-400 to-orange-500',
      iconShadow: 'shadow-amber-500/30',
      panelBg:
        'bg-gradient-to-br from-amber-50/90 via-white/80 to-orange-50/80 border-amber-200/90',
      amountText: 'text-amber-950',
      badgeBg: 'bg-amber-500 text-white border-white/60 shadow-xs',
      gaugeGradient: 'from-amber-400 via-orange-500 to-rose-500',
      tipGlow: 'bg-orange-400',
    };
  }
  // 0-14 (ยังไม่ถึงเกณฑ์): Cool Slate / Sky
  return {
    auraBg: 'bg-sky-200/30',
    secondaryAuraBg: 'bg-cyan-200/25',
    iconGradient: 'from-sky-500 to-cyan-600',
    iconShadow: 'shadow-sky-500/25',
    panelBg:
      'bg-gradient-to-br from-sky-50/80 via-white/80 to-slate-50/85 border-sky-200/80',
    amountText: 'text-slate-800',
    badgeBg: 'bg-slate-200/85 text-slate-700 border-white',
    gaugeGradient: 'from-sky-400 to-cyan-500',
    tipGlow: 'bg-sky-400',
  };
}

export const GasolineAllowanceCard: React.FC<GasolineAllowanceCardProps> = ({
  actualContractCount,
  periodLabel,
  onOpenSavedCases,
  className = '',
}) => {
  const [simulatedCount, setSimulatedCount] = useState<number | null>(null);
  const [showFullTable, setShowFullTable] = useState(false);

  const isSimulating = simulatedCount !== null;
  const activeCount = isSimulating ? simulatedCount : actualContractCount;

  const summary = useMemo(() => calculateGasolineAllowance(activeCount), [activeCount]);
  const actualSummary = useMemo(
    () => calculateGasolineAllowance(actualContractCount),
    [actualContractCount]
  );

  const theme = useMemo(
    () => getTierVisualTheme(summary.currentTier.tierIndex),
    [summary.currentTier.tierIndex]
  );

  // Smooth animated Baht count-up / count-down effect
  const [displayBaht, setDisplayBaht] = useState<number>(summary.allowanceBaht);
  const previousBahtRef = useRef<number>(summary.allowanceBaht);

  useEffect(() => {
    const startVal = previousBahtRef.current;
    const endVal = summary.allowanceBaht;
    if (startVal === endVal) {
      setDisplayBaht(endVal);
      return;
    }

    const duration = 380;
    const startTime = performance.now();
    let rafId = 0;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(startVal + (endVal - startVal) * eased);
      setDisplayBaht(current);

      if (t < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        previousBahtRef.current = endVal;
      }
    };

    rafId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafId);
      previousBahtRef.current = endVal;
    };
  }, [summary.allowanceBaht]);

  // Reset simulator when switching month or actual contracts update significantly
  useEffect(() => {
    setSimulatedCount(null);
  }, [periodLabel]);

  const paidTiers = useMemo(
    () => GASOLINE_TIER_RULES.filter((t) => t.allowanceBaht > 0),
    []
  );

  const handleAdjustSimulated = (delta: number) => {
    triggerHaptic('light');
    setSimulatedCount((prev) => {
      const base = prev !== null ? prev : actualContractCount;
      return Math.max(0, Math.min(99, base + delta));
    });
  };

  const handlePreviewTier = (tier: GasolineTierRule) => {
    triggerHaptic('selection');
    if (isSimulating && summary.currentTier.tierIndex === tier.tierIndex) {
      setSimulatedCount(null);
      return;
    }
    setSimulatedCount(tier.minContracts);
  };

  const handleResetSimulator = () => {
    triggerHaptic('light');
    setSimulatedCount(null);
  };

  return (
    <section
      aria-label="สรุปยอดค่าน้ำมัน"
      className={`glass-card-primary rounded-2xl p-3.5 sm:p-4 space-y-3 relative overflow-hidden transition-colors duration-300 ${className}`.trim()}
    >
      {/* Top Specular Glass Edge */}
      <div
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-95"
        aria-hidden="true"
      />

      {/* Ambient Animated Energy Blobs */}
      <div
        className={`pointer-events-none -right-12 -top-12 absolute w-44 h-44 rounded-full blur-2xl transition-colors duration-500 animate-fuel-aura ${theme.auraBg}`}
        aria-hidden="true"
      />
      <div
        className={`pointer-events-none -left-12 -bottom-14 absolute w-36 h-36 rounded-full blur-2xl transition-colors duration-500 ${theme.secondaryAuraBg}`}
        aria-hidden="true"
      />

      {/* Header Row */}
      <div className="relative flex items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className={`w-9 h-9 rounded-xl bg-gradient-to-br ${theme.iconGradient} border border-white/65 text-white flex items-center justify-center shrink-0 shadow-sm ${theme.iconShadow} transition-all duration-300`}
          >
            {summary.isMaxTier ? (
              <Trophy className="w-4 h-4" />
            ) : summary.isUnlocked ? (
              <Flame className="w-4 h-4" />
            ) : (
              <Fuel className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <MarqueeText className="text-xs sm:text-sm font-black text-slate-900">
                สรุปยอดค่าน้ำมัน (Gasoline Allowance)
              </MarqueeText>
              {isSimulating && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-violet-100/90 text-violet-800 border border-violet-300/80 text-[9.5px] font-extrabold whitespace-nowrap shrink-0">
                  <Sparkles className="w-2.5 h-2.5" />
                  จำลองเป้า
                </span>
              )}
            </div>
            <MarqueeText className="text-[10.5px] text-slate-600">
              {periodLabel} · อ้างอิงสัญญาอนุมัติและรับรถแล้ว ({actualContractCount} สัญญา)
            </MarqueeText>
          </div>
        </div>

        {/* Interactive Toggle / Expand Schedule Button */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setShowFullTable((prev) => !prev);
          }}
          className="px-2.5 py-1 rounded-lg bg-white/65 hover:bg-white/90 backdrop-blur-md border border-white/90 text-[11px] font-bold text-slate-700 hover:text-sky-900 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer shadow-2xs transition-all"
        >
          <span>เกณฑ์ 7 ขั้น</span>
          {showFullTable ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Hero Metric & Interactive Simulator Control */}
      <div
        className={`relative rounded-xl border p-3 sm:p-3.5 space-y-3 transition-all duration-300 ${theme.panelBg}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Left: Animated Baht Value + Tier Badge */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10.5px] font-bold text-slate-600 whitespace-nowrap">
                {isSimulating ? 'ค่าน้ำมันที่จำลองได้' : 'ค่าน้ำมันที่ได้รับ'}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-extrabold whitespace-nowrap transition-colors ${theme.badgeBg}`}
              >
                {summary.isMaxTier && <Sparkles className="w-2.5 h-2.5" />}
                <span>
                  {summary.currentTier.tierName} ({summary.currentTier.shortRangeLabel} สัญญา)
                </span>
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-1">
              <span
                key={summary.allowanceBaht}
                className={`text-2xl sm:text-3xl font-black tabular-nums tracking-tight whitespace-nowrap animate-number-tick ${theme.amountText}`}
              >
                {formatBaht(displayBaht)}
              </span>
              {isSimulating && summary.allowanceBaht !== actualSummary.allowanceBaht && (
                <span
                  className={`text-[11px] font-extrabold tabular-nums whitespace-nowrap ${
                    summary.allowanceBaht > actualSummary.allowanceBaht
                      ? 'text-emerald-700'
                      : 'text-rose-600'
                  }`}
                >
                  {summary.allowanceBaht > actualSummary.allowanceBaht ? '+' : '-'}
                  {formatBaht(Math.abs(summary.allowanceBaht - actualSummary.allowanceBaht))} จากยอดจริง
                </span>
              )}
            </div>
          </div>

          {/* Right: Contract Counter & Quick +/- Stepper */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1 bg-white/80 backdrop-blur-md p-1 rounded-xl border border-white/95 shadow-2xs">
              <button
                type="button"
                onClick={() => handleAdjustSimulated(-1)}
                disabled={activeCount <= 0}
                aria-label="ลดจำนวนสัญญาจำลอง"
                title="ลด 1 สัญญา (ลองจำลองเป้า)"
                className="w-7 h-7 rounded-lg bg-slate-100/80 hover:bg-sky-100 disabled:opacity-40 text-slate-700 flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed active:scale-95"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <div className="px-2 text-center min-w-[66px]">
                <div className="text-sm sm:text-base font-black text-slate-900 tabular-nums leading-tight">
                  {activeCount}
                </div>
                <div className="text-[9.5px] font-bold text-slate-500 leading-none">
                  สัญญา
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleAdjustSimulated(1)}
                aria-label="เพิ่มจำนวนสัญญาจำลอง"
                title="เพิ่ม 1 สัญญา (ลองจำลองเป้า)"
                className="w-7 h-7 rounded-lg bg-slate-100/80 hover:bg-sky-100 text-slate-700 flex items-center justify-center transition-colors cursor-pointer active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {isSimulating && (
              <button
                type="button"
                onClick={handleResetSimulator}
                title={`กลับไปยอดจริง (${actualContractCount} สัญญา)`}
                aria-label="กลับไปยอดจริง"
                className="h-9 px-2 rounded-xl bg-white/85 hover:bg-white border border-sky-200 text-sky-700 font-bold text-[10.5px] flex items-center gap-1 shadow-2xs cursor-pointer transition-all active:scale-95 whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3 shrink-0" />
                <span className="hidden sm:inline">ยอดจริง</span>
              </button>
            )}
          </div>
        </div>

        {/* Liquid Shimmer Fuel Gauge with Interactive Milestone Nodes */}
        <div className="space-y-1.5 pt-0.5">
          <div className="relative pt-1 pb-4">
            {/* Gauge Track */}
            <div className="relative h-3 w-full rounded-full bg-white/75 border border-white/95 shadow-inner overflow-hidden">
              {/* Filled Liquid Bar */}
              <div
                className={`h-full rounded-full bg-gradient-to-r ${theme.gaugeGradient} animate-fuel-shimmer transition-all duration-500 ease-out`}
                style={{ width: `${summary.gaugePercent}%` }}
              />
            </div>

            {/* Glowing Needle / Active Fuel Tip Dot */}
            {summary.gaugePercent > 0 && (
              <div
                className="absolute top-[10px] -translate-y-1/2 -translate-x-1/2 pointer-events-none transition-all duration-500 ease-out z-10"
                style={{ left: `${Math.min(98.5, Math.max(1.5, summary.gaugePercent))}%` }}
              >
                <span
                  className={`absolute inset-0 w-3.5 h-3.5 -m-[3px] rounded-full ${theme.tipGlow} animate-fuel-tip-ping`}
                />
                <span className="block w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-800 shadow-sm" />
              </div>
            )}

            {/* Milestone Checkpoints (15, 20, 25, 30, 40, 51+) */}
            {paidTiers.map((tier) => {
              const reached = activeCount >= tier.minContracts;
              const isCurrent = summary.currentTier.tierIndex === tier.tierIndex;
              const isEnd = tier.milestonePositionPercent === 100;
              return (
                <button
                  key={tier.tierIndex}
                  type="button"
                  onClick={() => handlePreviewTier(tier)}
                  title={`ลองดูขั้น ${tier.shortRangeLabel} สัญญา (${formatBaht(tier.allowanceBaht)})`}
                  style={{ left: `${tier.milestonePositionPercent}%` }}
                  className={`absolute top-0 ${
                    isEnd ? '-translate-x-[85%]' : '-translate-x-1/2'
                  } flex flex-col items-center cursor-pointer group focus:outline-none`}
                >
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all duration-200 ${
                      isCurrent
                        ? 'bg-slate-900 border-white text-white scale-110 shadow-sm'
                        : reached
                        ? 'bg-emerald-500 border-white text-white'
                        : 'bg-white/90 border-slate-300 text-slate-400 group-hover:border-sky-400 group-hover:scale-110'
                    }`}
                  >
                    {reached ? (
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    ) : (
                      <span className="w-1 h-1 rounded-full bg-current" />
                    )}
                  </span>
                  <span
                    className={`mt-0.5 text-[9.5px] font-extrabold tabular-nums whitespace-nowrap transition-colors ${
                      isCurrent
                        ? 'text-slate-900'
                        : reached
                        ? 'text-emerald-800'
                        : 'text-slate-500 group-hover:text-sky-700'
                    }`}
                  >
                    {tier.minContracts}
                    {tier.maxContracts === null ? '+' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 6 Paid Tier Interactive Quick-Select Grid (3x2 mobile / 6x1 desktop) */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {paidTiers.map((tier) => {
            const isCurrent = summary.currentTier.tierIndex === tier.tierIndex;
            const reached = activeCount >= tier.minContracts;
            return (
              <button
                key={tier.tierIndex}
                type="button"
                onClick={() => handlePreviewTier(tier)}
                className={`group rounded-xl px-2 py-1.5 text-center border transition-all duration-200 cursor-pointer active:scale-95 relative overflow-hidden ${
                  isCurrent
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/20 -translate-y-0.5'
                    : reached
                    ? 'bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-950 border-emerald-300/80'
                    : 'bg-white/75 hover:bg-white text-slate-700 border-white/95 hover:border-sky-300'
                }`}
              >
                <div
                  className={`text-[9.5px] font-bold tabular-nums whitespace-nowrap ${
                    isCurrent
                      ? 'text-amber-300'
                      : reached
                      ? 'text-emerald-700'
                      : 'text-slate-500'
                  }`}
                >
                  {tier.shortRangeLabel} สัญญา
                </div>
                <div className="text-xs font-black tabular-nums whitespace-nowrap mt-0.5">
                  {formatBaht(tier.allowanceBaht)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Expandable Official 7-Tier Reference Table */}
      {showFullTable && (
        <div className="relative glass-mini-card rounded-xl overflow-hidden animate-tab-fade">
          <div className="px-3 py-2 bg-slate-900 text-white flex items-center justify-between text-[11px] font-extrabold">
            <span>เงื่อนไขการจ่ายค่าน้ำมัน</span>
            <span className="text-amber-300 text-[10px] font-bold">
              แตะแถวเพื่อทดลองคำนวณ
            </span>
          </div>
          <div className="divide-y divide-white/80 text-[11px]">
            <div className="grid grid-cols-2 px-3 py-1.5 bg-slate-100/80 text-[10px] font-extrabold text-slate-600">
              <span>จำนวนสัญญา (Tier of Agreement)</span>
              <span className="text-right">ค่าน้ำมันที่ได้รับ (บาท)</span>
            </div>
            {GASOLINE_TIER_RULES.map((tier) => {
              const isCurrent = summary.currentTier.tierIndex === tier.tierIndex;
              return (
                <button
                  key={tier.tierIndex}
                  type="button"
                  onClick={() => handlePreviewTier(tier)}
                  className={`w-full grid grid-cols-2 items-center px-3 py-2 text-left transition-colors cursor-pointer ${
                    isCurrent
                      ? 'bg-amber-100/85 font-extrabold text-amber-950'
                      : 'hover:bg-sky-50/70 text-slate-700'
                  }`}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    {isCurrent && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    )}
                    <span className="truncate">{tier.rangeLabel}</span>
                    {isCurrent && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500 text-white font-bold shrink-0">
                        ปัจจุบัน
                      </span>
                    )}
                  </span>
                  <span className="text-right tabular-nums font-black">
                    {tier.allowanceBaht.toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Motivational Next-Tier Footer */}
      <div className="relative pt-1.5 border-t border-white/75 flex items-center justify-between gap-2 text-[11px]">
        <div className="min-w-0 flex-1">
          {summary.nextTier ? (
            <MarqueeText className="font-semibold text-slate-700">
              <span className="inline-flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>
                  {isSimulating ? 'เป้าหมายนี้ต้องเพิ่มอีก ' : 'ทำเพิ่มอีก '}
                  <strong className="text-slate-950 tabular-nums">
                    {summary.contractsNeededForNext}
                  </strong>{' '}
                  สัญญา เพื่อรับ{' '}
                  <strong className="text-amber-800 tabular-nums">
                    {formatBaht(summary.nextTier.allowanceBaht)}
                  </strong>{' '}
                  <span className="text-emerald-700 font-extrabold tabular-nums">
                    (+{formatBaht(summary.potentialGainBaht)})
                  </span>
                </span>
              </span>
            </MarqueeText>
          ) : (
            <MarqueeText className="font-bold text-emerald-700">
              <span className="inline-flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>ยินดีด้วย! ถึงขั้นสูงสุด 51+ สัญญา (รับเต็ม ฿8,200) แล้ว</span>
              </span>
            </MarqueeText>
          )}
        </div>

        {onOpenSavedCases && !isSimulating && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onOpenSavedCases();
            }}
            className="text-sky-700 hover:text-sky-900 font-bold flex items-center gap-0.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>ดูเคสรับรถ</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </section>
  );
};
