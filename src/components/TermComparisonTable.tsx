import React, { useState } from 'react';
import { Layers, CheckCircle2, ShieldCheck, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { TermComparisonItem } from '../types';
import { formatBaht } from '../data/proposals';
import { triggerHaptic } from '../utils/haptics';

interface Props {
  comparisons: TermComparisonItem[];
  selectedTerm: number;
  onSelectTerm: (term: number) => void;
  onOpenEirInfo?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const TermComparisonTable: React.FC<Props> = ({
  comparisons,
  selectedTerm,
  onSelectTerm,
  onOpenEirInfo,
  isExpanded: controlledExpanded,
  onToggleExpand,
}) => {
  const [internalExpanded, setInternalExpanded] = useState<boolean>(false);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  const handleToggle = () => {
    triggerHaptic('light');
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setInternalExpanded(!internalExpanded);
    }
  };

  if (comparisons.length <= 1) {
    return null;
  }

  const hasAnyInsurance = comparisons.some(
    (item) => item.hasInsurance && item.insuranceMonthlyDiff > 0
  );
  const activePlanName = comparisons[0]?.insurancePlanName || 'PA';

  return (
    <div
      data-card-id="comparison"
      className="glass-card-primary rounded-[24px] p-3.5 sm:p-4 lg:p-5 shadow-sm relative overflow-hidden transition-all duration-200"
    >
      {/* Subtle top specular sheen */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 dark:via-sky-400/20 to-transparent opacity-80 pointer-events-none" />

      {/* Header section: Clean two-row hierarchy for mobile readability */}
      <div
        data-card-toggle="true"
        onClick={handleToggle}
        className={`cursor-pointer select-none transition-all ${isExpanded ? 'mb-3' : 'mb-0'}`}
      >
        {/* Row 1: Icon + Full Title & Subtitle + Collapse Toggle */}
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-cyan-100/90 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 flex items-center justify-center shadow-2xs shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[13px] sm:text-sm font-extrabold text-slate-800 dark:text-slate-100 tracking-tight leading-tight truncate">
                ตารางเปรียบเทียบระยะเวลางวดผ่อน
              </h3>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 leading-tight truncate">
                {comparisons.length} ตัวเลือกระยะเวลา • {isExpanded ? 'แตะแถวเพื่อเลือกงวดผ่อน' : 'แตะเพื่อเปิดตารางเปรียบเทียบ'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggle();
            }}
            className="w-8 h-8 rounded-xl bg-white/85 hover:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white transition-colors cursor-pointer border border-slate-200/80 dark:border-slate-700 shadow-2xs flex items-center justify-center shrink-0"
            title={isExpanded ? 'ย่อตารางเปรียบเทียบ' : 'ขยายตารางเปรียบเทียบ'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Row 2: Insurance Plan Status + EIR 23% Info Trigger */}
        <div className="flex items-center justify-between gap-2 pt-2.5 mt-2.5 border-t border-slate-200/60 dark:border-slate-700/60">
          <div className="min-w-0 flex-1 flex items-center">
            {hasAnyInsurance ? (
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-amber-800 dark:text-amber-200 bg-amber-50/95 dark:bg-amber-950/70 px-2.5 py-1 rounded-lg border border-amber-200/90 dark:border-amber-700/70 shadow-2xs max-w-full">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="truncate">ประกัน {activePlanName}</span>
              </span>
            ) : (
              <span className="inline-flex items-center text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-300 bg-slate-100/90 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700">
                ไม่รวมประกัน
              </span>
            )}
          </div>

          {onOpenEirInfo && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenEirInfo();
              }}
              className="text-[10.5px] sm:text-[11px] text-cyan-800 hover:text-cyan-950 dark:text-cyan-200 dark:hover:text-white font-bold px-2.5 py-1 rounded-lg bg-cyan-50/95 hover:bg-cyan-100 dark:bg-cyan-950/70 dark:hover:bg-cyan-900/70 border border-cyan-200/90 dark:border-cyan-700/70 transition-colors cursor-pointer shadow-2xs whitespace-nowrap flex items-center gap-1 shrink-0"
              title="ดูรายละเอียดเกณฑ์ EIR 23%"
            >
              <span>⚖️ เกณฑ์ EIR 23%</span>
              <HelpCircle className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="animate-fade-in">
          {/* Table section: 4 explicit columns as requested */}
          {/* งวดผ่อน | ค่างวดไม่รวม PA | ค่างวด/เดือน | ยอดรวมทั้งสิ้น */}
      <div className="overflow-x-auto -mx-1 scrollbar-thin">
        <table className="w-full text-left text-xs min-w-[340px]">
          <thead>
            <tr className="border-b border-slate-200/80 dark:border-slate-700/80 text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs font-bold bg-slate-50/50 dark:bg-slate-800/60">
              {/* Column 1: งวดผ่อน */}
              <th className="py-2.5 pl-2.5 pr-1.5 text-left font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                งวดผ่อน
              </th>

              {/* Column 2: ค่างวดไม่รวม PA */}
              <th className="py-2.5 px-2 text-right font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                ค่างวดไม่รวม PA
              </th>

              {/* Column 3: ค่างวด/เดือน */}
              <th className="py-2.5 px-2 text-right font-bold text-cyan-900 dark:text-cyan-300 whitespace-nowrap">
                ค่างวด/เดือน
              </th>

              {/* Column 4: ยอดรวมทั้งสิ้น */}
              <th className="py-2.5 pl-1.5 pr-2.5 text-right font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                ยอดรวมทั้งสิ้น
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80 dark:divide-slate-800/80">
            {comparisons.map((item) => {
              const isSelected = item.term === selectedTerm;
              const hasInsuranceInRow = item.hasInsurance && item.insuranceMonthlyDiff > 0;

              return (
                <tr
                  key={item.term}
                  onClick={() => {
                    triggerHaptic('light');
                    onSelectTerm(item.term);
                  }}
                  className={`cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? 'bg-gradient-to-r from-cyan-50/95 via-sky-50/85 to-blue-50/75 dark:from-cyan-950/80 dark:via-sky-950/75 dark:to-blue-950/70 text-sky-950 dark:text-sky-100 font-semibold shadow-2xs backdrop-blur-sm'
                      : 'hover:bg-white/70 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {/* Column 1: งวดผ่อน */}
                  <td className="py-2.5 pl-2.5 pr-1.5 align-middle">
                    <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                      {isSelected ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 flex-shrink-0" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 flex-shrink-0" />
                      )}
                      <span className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm whitespace-nowrap">
                        {item.term} งวด
                      </span>
                      {item.isCappedByEir && (
                        <span className="text-[8.5px] px-1 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold inline-flex items-center gap-0.5 shrink-0 whitespace-nowrap">
                          🔒 EIR
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Column 2: ค่างวดไม่รวม PA */}
                  <td className="py-2.5 px-2 text-right align-middle">
                    <div className="font-bold text-slate-700 dark:text-slate-200 text-xs sm:text-sm whitespace-nowrap">
                      {formatBaht(item.monthlyInstallmentWithoutInsurance)}
                    </div>
                    <div className="text-[9px] text-slate-400 font-normal">
                      ฿/เดือน
                    </div>
                  </td>

                  {/* Column 3: ค่างวด/เดือน */}
                  <td className="py-2.5 px-2 text-right align-middle">
                    <div className="font-bold text-cyan-800 dark:text-cyan-300 text-xs sm:text-sm whitespace-nowrap">
                      {formatBaht(item.monthlyInstallment)}
                    </div>
                    {hasInsuranceInRow ? (
                      <div className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-800 dark:text-amber-200 bg-amber-50/95 dark:bg-amber-950/70 px-1 py-0.2 rounded border border-amber-200/90 dark:border-amber-700/70 shadow-2xs whitespace-nowrap mt-0.5">
                        <span>+{formatBaht(item.insuranceMonthlyDiff)}</span>
                      </div>
                    ) : (
                      <div className="text-[9px] text-slate-400 font-normal">
                        ฿/เดือน
                      </div>
                    )}
                  </td>

                  {/* Column 4: ยอดรวมทั้งสิ้น */}
                  <td className="py-2.5 pl-1.5 pr-2.5 text-right align-middle">
                    <div className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm whitespace-nowrap">
                      {formatBaht(item.totalWithVat)}
                    </div>
                    {hasInsuranceInRow ? (
                      <div className="text-[9px] text-amber-700 dark:text-amber-300 font-medium whitespace-nowrap">
                        (+{formatBaht(item.insuranceTotalDiff)} PA)
                      </div>
                    ) : (
                      <div className="text-[9px] text-slate-400 font-normal">
                        รวม VAT
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  )}
    </div>
  );
};
