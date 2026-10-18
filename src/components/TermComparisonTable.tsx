import React from 'react';
import { Layers, CheckCircle2, ChevronRight } from 'lucide-react';
import { TermComparisonItem } from '../types';
import { formatBaht } from '../data/proposals';

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

  return (
    <div className="glass-card-primary rounded-2xl p-4 sm:p-5 lg:p-6 shadow-sm relative overflow-hidden">
      {/* Subtle top specular sheen */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent opacity-80 pointer-events-none" />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-100/80 text-blue-700 flex items-center justify-center">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 tracking-tight">
              ตารางเปรียบเทียบระยะเวลางวดผ่อน
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onOpenEirInfo && (
            <button
              type="button"
              onClick={onOpenEirInfo}
              className="text-[10px] text-blue-700 hover:text-blue-900 font-bold px-2 py-0.5 rounded-full bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
            >
              ⚖️ เกณฑ์ EIR 23%
            </button>
          )}
          <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
            คลิกแถวเพื่อเลือก
          </span>
        </div>
      </div>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200/60 text-slate-400 text-[10px] uppercase font-semibold">
              <th className="pb-2.5 pl-2.5">งวดผ่อน</th>
              <th className="pb-2.5 text-right">ค่างวด/เดือน (รวม VAT)</th>
              <th className="pb-2.5 text-right hidden sm:table-cell">ดอกเบี้ยรวม</th>
              <th className="pb-2.5 text-right pr-2.5">ยอดรวมทั้งสิ้น</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {comparisons.map((item) => {
              const isSelected = item.term === selectedTerm;
              return (
                <tr
                  key={item.term}
                  onClick={() => onSelectTerm(item.term)}
                  className={`cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? 'bg-gradient-to-r from-blue-50/90 via-indigo-50/80 to-blue-50/60 text-blue-950 font-semibold shadow-xs'
                      : 'hover:bg-white/70 text-slate-700'
                  }`}
                >
                  <td className="pt-3 pb-3.5 pl-2.5 align-middle leading-normal">
                    <div className="flex items-center gap-1.5">
                      {isSelected ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-700 flex-shrink-0" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-slate-300/80 flex-shrink-0" />
                      )}
                      <span>{item.term} งวด</span>
                      {item.isCappedByEir && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold flex items-center gap-0.5">
                          🔒 EIR 23%
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="pt-3 pb-3.5 text-right font-bold text-blue-700 align-middle leading-normal">
                    {formatBaht(item.monthlyInstallment)}
                  </td>
                  <td className="pt-3 pb-3.5 text-right text-slate-500 font-normal hidden sm:table-cell align-middle leading-normal">
                    {formatBaht(item.totalInterest)}
                  </td>
                  <td className="pt-3 pb-3.5 text-right pr-2.5 text-slate-700 font-medium align-middle leading-normal">
                    {formatBaht(item.totalWithVat)}
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
