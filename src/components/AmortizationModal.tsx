import React, { useState } from 'react';
import { X, Table, HelpCircle, FileSpreadsheet, Check } from 'lucide-react';
import { CalculationResult } from '../types';
import { formatBaht, formatTermYearMonth } from '../data/proposals';
import { useModalTransition } from '../hooks/useModalTransition';
import { triggerHaptic } from '../utils/haptics';
import { exportAmortizationToExcel } from '../utils/excelExport';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  result: CalculationResult;
}

export const AmortizationModal: React.FC<Props> = ({
  isOpen,
  onClose,
  result,
}) => {
  const [exportedExcel, setExportedExcel] = useState(false);
  const { shouldRender, isClosing, backdropAnimClass, sheetAnimClass } = useModalTransition(
    isOpen,
    onClose
  );

  if (!shouldRender) return null;

  const handleExportExcel = () => {
    triggerHaptic('success');
    exportAmortizationToExcel(result);
    setExportedExcel(true);
    setTimeout(() => setExportedExcel(false), 2000);
  };

  const term = result.term;
  const principalPerMonth = term > 0 ? result.financeAmount / term : 0;
  const interestPerMonth = term > 0 ? result.totalInterest / term : 0;
  const monthlyInstallment = result.monthlyInstallment;
  const vatPerMonth = (monthlyInstallment * 7) / 107;
  const beforeVatPerMonth = monthlyInstallment - vatPerMonth;

  // Generate rows
  const rows = [];
  let remainingPrincipal = result.financeAmount;

  for (let i = 1; i <= term; i++) {
    remainingPrincipal = Math.max(0, remainingPrincipal - principalPerMonth);
    rows.push({
      month: i,
      principal: principalPerMonth,
      interest: interestPerMonth,
      beforeVat: beforeVatPerMonth,
      vat: vatPerMonth,
      total: monthlyInstallment,
      remaining: remainingPrincipal,
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isClosing) {
          onClose();
        }
      }}
      className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-slate-950/65 overflow-y-auto overscroll-contain ${backdropAnimClass}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] min-h-0 my-auto flex flex-col shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700/80 ${sheetAnimClass}`}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/95">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 rounded-xl border border-indigo-200/70 dark:border-indigo-700/50">
              <Table className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                ตารางผ่อนชำระรายงวด (Schedule)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                จำแนกสัดส่วนเงินต้น, ดอกเบี้ย Flat Rate และภาษีมูลค่าเพิ่ม 7% ทุกงวด
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info banner */}
        <div className="shrink-0 px-4 sm:px-6 py-2.5 sm:py-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-100 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span>
            สัญญาเช่าซื้อรถจักรยานยนต์ใช้อัตราคงที่ (Flat Rate) จึงมีสัดส่วนเงินต้นและดอกเบี้ยเท่ากันในทุกๆ งวด
          </span>
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-4 bg-white dark:bg-slate-900">
          <table className="w-full text-xs text-left">
            <thead className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-semibold">
              <tr>
                <th className="py-2 px-2">งวดที่</th>
                <th className="py-2 text-right">เงินต้น</th>
                <th className="py-2 text-right">ดอกเบี้ย</th>
                <th className="py-2 text-right">VAT 7%</th>
                <th className="py-2 text-right font-bold text-indigo-700 dark:text-indigo-300">ค่างวดรวม</th>
                <th className="py-2 text-right pr-2">เงินต้นคงเหลือ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
              {rows.map((row) => (
                <tr key={row.month} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                  <td className="pt-2.5 pb-3 px-2 font-medium text-slate-700 dark:text-slate-200 align-middle leading-normal">
                    งวดที่ {row.month}
                  </td>
                  <td className="pt-2.5 pb-3 text-right text-slate-600 dark:text-slate-300 align-middle leading-normal">
                    {formatBaht(row.principal)}
                  </td>
                  <td className="pt-2.5 pb-3 text-right text-slate-500 dark:text-slate-400 align-middle leading-normal">
                    {formatBaht(row.interest)}
                  </td>
                  <td className="pt-2.5 pb-3 text-right text-slate-500 dark:text-slate-400 align-middle leading-normal">
                    {formatBaht(row.vat)}
                  </td>
                  <td className="pt-2.5 pb-3 text-right font-semibold text-indigo-600 dark:text-indigo-300 align-middle leading-normal">
                    {formatBaht(row.total)}
                  </td>
                  <td className="pt-2.5 pb-3 text-right pr-2 text-slate-400 dark:text-slate-500 align-middle leading-normal">
                    {formatBaht(row.remaining)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="shrink-0 p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-700/80 flex justify-between items-center gap-2 text-xs">
          <div className="text-slate-500 dark:text-slate-400">
            รวม {term} งวด ({formatTermYearMonth(term)}):{' '}
            <span className="font-bold text-slate-800 dark:text-slate-100 tabular-nums">{formatBaht(result.totalWithVat)}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportExcel}
              className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 border transition-all cursor-pointer active:scale-95 ${
                exportedExcel
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/70 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/60'
              }`}
              title="ส่งออกตารางผ่อนรายงวดเป็นไฟล์ Excel (.xlsx)"
            >
              {exportedExcel ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              )}
              <span>{exportedExcel ? 'ส่งออกแล้ว' : 'ส่งออก Excel'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-medium rounded-xl text-xs transition-colors cursor-pointer"
            >
              ปิด
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
