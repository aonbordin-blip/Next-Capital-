import React from 'react';
import { X, Table, HelpCircle } from 'lucide-react';
import { CalculationResult } from '../types';
import { formatBaht } from '../data/proposals';

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
  if (!isOpen) return null;

  const term = result.term;
  const principalPerMonth = term > 0 ? result.financeAmount / term : 0;
  const interestPerMonth = term > 0 ? result.totalInterest / term : 0;
  const beforeVatPerMonth = principalPerMonth + interestPerMonth;
  const vatPerMonth = beforeVatPerMonth * 0.07;
  const monthlyInstallment = beforeVatPerMonth + vatPerMonth;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <Table className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                ตารางผ่อนชำระรายงวด (Schedule)
              </h2>
              <p className="text-xs text-slate-500">
                จำแนกสัดส่วนเงินต้น, ดอกเบี้ย Flat Rate และภาษีมูลค่าเพิ่ม 7% ทุกงวด
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info banner */}
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 text-xs text-amber-800 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>
            สัญญาเช่าซื้อรถจักรยานยนต์ใช้อัตราคงที่ (Flat Rate) จึงมีสัดส่วนเงินต้นและดอกเบี้ยเท่ากันในทุกๆ งวด
          </span>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full text-xs text-left">
            <thead className="sticky top-0 bg-white border-b border-slate-200 text-slate-500 text-[10px] uppercase font-semibold">
              <tr>
                <th className="py-2 px-2">งวดที่</th>
                <th className="py-2 text-right">เงินต้น</th>
                <th className="py-2 text-right">ดอกเบี้ย</th>
                <th className="py-2 text-right">VAT 7%</th>
                <th className="py-2 text-right font-bold text-indigo-700">ค่างวดรวม</th>
                <th className="py-2 text-right pr-2">เงินต้นคงเหลือ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.month} className="hover:bg-slate-50">
                  <td className="py-2 px-2 font-medium text-slate-700">
                    งวดที่ {row.month}
                  </td>
                  <td className="py-2 text-right text-slate-600">
                    {formatBaht(row.principal)}
                  </td>
                  <td className="py-2 text-right text-slate-500">
                    {formatBaht(row.interest)}
                  </td>
                  <td className="py-2 text-right text-slate-500">
                    {formatBaht(row.vat)}
                  </td>
                  <td className="py-2 text-right font-semibold text-indigo-600">
                    {formatBaht(row.total)}
                  </td>
                  <td className="py-2 text-right pr-2 text-slate-400">
                    {formatBaht(row.remaining)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
          <div className="text-slate-500">
            รวม {term} งวด: <span className="font-bold text-slate-800">{formatBaht(result.totalWithVat)}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium rounded-xl text-xs transition-colors"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
