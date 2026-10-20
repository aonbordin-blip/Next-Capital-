import React from 'react';
import { Layers, CheckCircle2, ShieldCheck, HelpCircle } from 'lucide-react';
import { TermComparisonItem } from '../types';
import { formatBaht } from '../data/proposals';
import { triggerHaptic } from '../utils/haptics';

interface Props {
  comparisons: TermComparisonItem[];
  selectedTerm: number;
  onSelectTerm: (term: number) => void;
  onOpenEirInfo?: () => void;
}

export const TermComparisonTable: React.FC<Props> = ({
  comparisons,
  selectedTerm,
  onSelectTerm,
  onOpenEirInfo,
}) => {
  if (comparisons.length <= 1) {
    return null;
  }

  const hasAnyInsurance = comparisons.some(
    (item) => item.hasInsurance && item.insuranceMonthlyDiff > 0
  );
  const activePlanName = comparisons[0]?.insurancePlanName || 'PA';

  return (
    <div className="glass-card-primary rounded-[24px] p-3 sm:p-4 lg:p-5 shadow-sm relative overflow-hidden">
      {/* Subtle top specular sheen */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent opacity-80 pointer-events-none" />

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center shadow-xs flex-shrink-0">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight">
                ตารางเปรียบเทียบระยะเวลางวดผ่อน
              </h3>
              {hasAnyInsurance ? (
                <span className="text-[9.5px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1 shadow-2xs">
                  <ShieldCheck className="w-3 h-3 text-amber-600" />
                  ประกัน {activePlanName}
                </span>
              ) : (
                <span className="text-[9.5px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                  ไม่รวมประกัน
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 font-medium">
              คลิกที่แถวเพื่อเลือกงวดผ่อนที่ต้องการคำนวณ
            </p>
          </div>
        </div>

        {onOpenEirInfo && (
          <button
            type="button"
            onClick={onOpenEirInfo}
            className="text-[10px] text-cyan-800 hover:text-cyan-900 font-bold px-2.5 py-1 rounded-full bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 transition-colors cursor-pointer shadow-2xs self-end sm:self-auto flex items-center gap-1"
          >
            <span>⚖️ เกณฑ์ EIR 23%</span>
            <HelpCircle className="w-3 h-3 text-cyan-600" />
          </button>
        )}
      </div>

      {/* Table section: 4 explicit columns as requested */}
      {/* งวดผ่อน | ค่างวดไม่รวม PA | ค่างวด/เดือน | ยอดรวมทั้งสิ้น */}
      <div className="overflow-x-auto -mx-1 scrollbar-thin">
        <table className="w-full text-left text-xs min-w-[340px]">
          <thead>
            <tr className="border-b border-slate-200/80 text-slate-500 text-[10px] sm:text-xs font-bold bg-slate-50/50">
              {/* Column 1: งวดผ่อน */}
              <th className="py-2.5 pl-2.5 pr-1.5 text-left font-bold text-slate-700 whitespace-nowrap">
                งวดผ่อน
              </th>

              {/* Column 2: ค่างวดไม่รวม PA */}
              <th className="py-2.5 px-2 text-right font-bold text-slate-700 whitespace-nowrap">
                ค่างวดไม่รวม PA
              </th>

              {/* Column 3: ค่างวด/เดือน */}
              <th className="py-2.5 px-2 text-right font-bold text-cyan-900 whitespace-nowrap">
                <div>ค่างวด/เดือน</div>
                {hasAnyInsurance && (
                  <div className="text-[8.5px] text-amber-700 font-semibold normal-case">
                    (รวม {activePlanName})
                  </div>
                )}
              </th>

              {/* Column 4: ยอดรวมทั้งสิ้น */}
              <th className="py-2.5 pl-1.5 pr-2.5 text-right font-bold text-slate-700 whitespace-nowrap">
                ยอดรวมทั้งสิ้น
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
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
                      ? 'bg-gradient-to-r from-cyan-50/95 via-sky-50/85 to-blue-50/75 text-sky-950 font-semibold shadow-2xs backdrop-blur-sm'
                      : 'hover:bg-white/70 text-slate-700'
                  }`}
                >
                  {/* Column 1: งวดผ่อน */}
                  <td className="py-2.5 pl-2.5 pr-1.5 align-middle">
                    <div className="flex items-center gap-1.5">
                      {isSelected ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600 flex-shrink-0" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-slate-300 flex-shrink-0" />
                      )}
                      <span className="font-bold text-slate-800 text-xs sm:text-sm whitespace-nowrap">
                        {item.term} งวด
                      </span>
                    </div>
                    {item.isCappedByEir && (
                      <div className="mt-0.5 pl-5">
                        <span className="text-[8.5px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold inline-flex items-center gap-0.5">
                          🔒 EIR
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Column 2: ค่างวดไม่รวม PA */}
                  <td className="py-2.5 px-2 text-right align-middle">
                    <div className="font-bold text-slate-700 text-xs sm:text-sm whitespace-nowrap">
                      {formatBaht(item.monthlyInstallmentWithoutInsurance)}
                    </div>
                    <div className="text-[9px] text-slate-400 font-normal">
                      ฿/เดือน
                    </div>
                  </td>

                  {/* Column 3: ค่างวด/เดือน */}
                  <td className="py-2.5 px-2 text-right align-middle">
                    <div className="font-bold text-cyan-800 text-xs sm:text-sm whitespace-nowrap">
                      {formatBaht(item.monthlyInstallment)}
                    </div>
                    {hasInsuranceInRow ? (
                      <div className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-800 bg-amber-50/95 px-1 py-0.2 rounded border border-amber-200/90 shadow-2xs whitespace-nowrap mt-0.5">
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
                    <div className="font-bold text-slate-800 text-xs sm:text-sm whitespace-nowrap">
                      {formatBaht(item.totalWithVat)}
                    </div>
                    {hasInsuranceInRow ? (
                      <div className="text-[9px] text-amber-700 font-medium whitespace-nowrap">
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
  );
};
