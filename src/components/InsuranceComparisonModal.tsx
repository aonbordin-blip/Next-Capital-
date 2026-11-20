import React from 'react';
import { X, ShieldCheck, Check, Sparkles, AlertCircle } from 'lucide-react';
import { InsurancePlan, InsuranceYears } from '../types';
import { INSURANCE_PLANS, formatBaht } from '../data/proposals';
import { useModalTransition } from '../hooks/useModalTransition';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedPlan: InsurancePlan;
  selectedYears: InsuranceYears;
  onSelectPlan: (plan: InsurancePlan, years: InsuranceYears) => void;
  onOpenDoc?: () => void;
}

export const InsuranceComparisonModal: React.FC<Props> = ({
  isOpen,
  onClose,
  selectedPlan,
  selectedYears,
  onSelectPlan,
  onOpenDoc,
}) => {
  const { shouldRender, isClosing, backdropAnimClass, sheetAnimClass } = useModalTransition(
    isOpen,
    onClose
  );

  if (!shouldRender) return null;

  const planA = INSURANCE_PLANS.plan_a;
  const planB = INSURANCE_PLANS.plan_b;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isClosing) {
          onClose();
        }
      }}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 overflow-y-auto ${backdropAnimClass}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto ${sheetAnimClass}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 dark:border-slate-700/80 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-amber-50/60 dark:from-slate-900 dark:via-blue-950/50 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-700/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  เปรียบเทียบความคุ้มครอง และเบี้ยประกันภัย สำหรับ Group PA
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                โครงการ PA advised by LOCKTON • คุ้มครองผู้เช่าซื้อรถจักรยานยนต์
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900">
          {/* Quick Plan Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Plan A Card */}
            <div
              className={`rounded-2xl p-4 border transition-all ${
                selectedPlan === 'plan_a'
                  ? 'border-blue-600 dark:border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 ring-2 ring-blue-600/20 dark:ring-blue-500/30 shadow-md'
                  : 'border-slate-200 dark:border-slate-700/80 bg-white/70 dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/70 text-blue-800 dark:text-blue-200">
                    PA ปกติ
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
                    {planA.name}
                  </h3>
                </div>
                <div className="text-right tabular-nums">
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">เริ่มต้น</div>
                  <div className="text-base font-extrabold text-blue-700 dark:text-sky-300">
                    ฿670<span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">/ปี</span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] space-y-1.5 text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-700/70 pt-2 mb-3 tabular-nums">
                <div className="flex justify-between">
                  <span>• อุบัติเหตุทั่วไป:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">฿80,000</span>
                </div>
                <div className="flex justify-between">
                  <span>• ขับขี่/โดยสารรถจักรยานยนต์:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">฿50,000</span>
                </div>
                <div className="flex justify-between">
                  <span>• ถูกฆาตกรรม/ทำร้ายร่างกาย:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">฿50,000</span>
                </div>
                <div className="flex justify-between">
                  <span>• ค่ารักษาพยาบาล/ครั้ง:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">฿1,000</span>
                </div>
                <div className="flex justify-between">
                  <span>• ชดเชยรายได้คนไข้ใน:</span>
                  <span className="text-slate-400 dark:text-slate-500">ไม่มี</span>
                </div>
              </div>

              {/* Select Years */}
              <div className="flex gap-1.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/70">
                {([1, 2, 3] as InsuranceYears[]).map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => onSelectPlan('plan_a', y)}
                    className={`flex-1 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer tabular-nums ${
                      selectedPlan === 'plan_a' && selectedYears === y
                        ? 'bg-blue-700 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {y} ปี ({formatBaht(planA.premiums[y])})
                  </button>
                ))}
              </div>
            </div>

            {/* Plan B Card */}
            <div
              className={`rounded-2xl p-4 border transition-all relative overflow-hidden ${
                selectedPlan === 'plan_b'
                  ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/35 ring-2 ring-amber-500/20 dark:ring-amber-500/30 shadow-md'
                  : 'border-slate-200 dark:border-slate-700/80 bg-white/70 dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="absolute top-2 right-2 flex items-center gap-0.5 text-[9px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-white shadow-xs">
                <Sparkles className="w-2.5 h-2.5" /> แนะนำ คุ้มค่า
              </div>

              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/70 text-amber-900 dark:text-amber-200">
                    PA PLUS
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
                    {planB.name}
                  </h3>
                </div>
                <div className="text-right pt-4 sm:pt-0 tabular-nums">
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">เริ่มต้น</div>
                  <div className="text-base font-extrabold text-amber-700 dark:text-amber-300">
                    ฿1,329<span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">/ปี</span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] space-y-1.5 text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-700/70 pt-2 mb-3 tabular-nums">
                <div className="flex justify-between">
                  <span>• อุบัติเหตุทั่วไป:</span>
                  <span className="font-bold text-amber-900 dark:text-amber-200">฿200,000</span>
                </div>
                <div className="flex justify-between">
                  <span>• ขับขี่/โดยสารรถจักรยานยนต์:</span>
                  <span className="font-bold text-amber-900 dark:text-amber-200">฿200,000</span>
                </div>
                <div className="flex justify-between">
                  <span>• ถูกฆาตกรรม/ทำร้ายร่างกาย:</span>
                  <span className="font-bold text-amber-900 dark:text-amber-200">฿200,000</span>
                </div>
                <div className="flex justify-between">
                  <span>• ค่ารักษาพยาบาล/ครั้ง:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">฿1,000</span>
                </div>
                <div className="flex justify-between font-semibold text-emerald-700 dark:text-emerald-300">
                  <span>• ชดเชยรายได้คนไข้ใน:</span>
                  <span>500 บาท / วัน (สูงสุด 30 วัน/ปี)</span>
                </div>
              </div>

              {/* Select Years */}
              <div className="flex gap-1.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/70">
                {([1, 2, 3] as InsuranceYears[]).map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => onSelectPlan('plan_b', y)}
                    className={`flex-1 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer tabular-nums ${
                      selectedPlan === 'plan_b' && selectedYears === y
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {y} ปี ({formatBaht(planB.premiums[y])})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Full Official Comparison Table */}
          <div className="border border-slate-200 dark:border-slate-700/80 rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/90 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-4 w-1/2">ความคุ้มครอง</th>
                  <th className="py-2.5 px-4 text-center bg-blue-50/50 dark:bg-blue-950/40">แผน A (PA ปกติ)</th>
                  <th className="py-2.5 px-4 text-center bg-amber-50/50 dark:bg-amber-950/40">แผน B (PA PLUS)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 tabular-nums">
                <tr>
                  <td colSpan={3} className="py-2 px-4 bg-slate-50 dark:bg-slate-800/70 font-semibold text-slate-800 dark:text-slate-100 text-[11px]">
                    1. การเสียชีวิต การสูญเสียอวัยวะ สายตา หรือทุพพลภาพถาวรสิ้นเชิง (อบ.1)
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-6 text-slate-600 dark:text-slate-300">- อุบัติเหตุทั่วไป</td>
                  <td className="py-2 px-4 text-center font-semibold text-slate-900 dark:text-slate-100">80,000 บาท</td>
                  <td className="py-2 px-4 text-center font-bold text-amber-800 dark:text-amber-300">200,000 บาท</td>
                </tr>
                <tr>
                  <td className="py-2 px-6 text-slate-600 dark:text-slate-300">- การขับขี่หรือโดยสารรถจักรยานยนต์</td>
                  <td className="py-2 px-4 text-center font-semibold text-slate-900 dark:text-slate-100">50,000 บาท</td>
                  <td className="py-2 px-4 text-center font-bold text-amber-800 dark:text-amber-300">200,000 บาท</td>
                </tr>
                <tr>
                  <td className="py-2 px-6 text-slate-600 dark:text-slate-300">- การถูกฆาตกรรม หรือถูกทำร้ายร่างกาย (กรณีเสียชีวิตเท่านั้น)</td>
                  <td className="py-2 px-4 text-center font-semibold text-slate-900 dark:text-slate-100">50,000 บาท</td>
                  <td className="py-2 px-4 text-center font-bold text-amber-800 dark:text-amber-300">200,000 บาท</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-medium text-slate-800 dark:text-slate-200">2. ค่ารักษาพยาบาล ต่ออุบัติเหตุแต่ละครั้ง</td>
                  <td className="py-2.5 px-4 text-center font-semibold text-slate-900 dark:text-slate-100">1,000 บาท</td>
                  <td className="py-2.5 px-4 text-center font-semibold text-slate-900 dark:text-slate-100">1,000 บาท</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                    3. ค่าปลงศพ (กรณีเสียชีวิตจากบาดเจ็บหรือเจ็บป่วยมีระยะเวลารอคอย 180 วัน)
                  </td>
                  <td className="py-2.5 px-4 text-center font-semibold text-slate-900 dark:text-slate-100">10,000 บาท</td>
                  <td className="py-2.5 px-4 text-center font-semibold text-slate-900 dark:text-slate-100">10,000 บาท</td>
                </tr>
                <tr className="bg-amber-50/30 dark:bg-amber-950/25">
                  <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                    *เพิ่ม* ข้อ 4. เงินชดเชยรายได้ระหว่างรักษาตัวใน รพ. (คนไข้ใน สูงสุด 30 วัน/ปี)
                  </td>
                  <td className="py-2.5 px-4 text-center text-slate-400 dark:text-slate-500">ไม่มี</td>
                  <td className="py-2.5 px-4 text-center font-bold text-emerald-700 dark:text-emerald-300">500 บาท / ต่อวัน</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Premium Rate Table */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex justify-between items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-800 dark:text-slate-100">ตารางเบี้ยประกันภัย / ต่อคน (รวมอากรแสตมป์ 20 บาท/กรมธรรม์)</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">โครงการ PA advised by LOCKTON</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center tabular-nums">
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">ความคุ้มครอง 1 ปี</div>
                <div className="text-xs font-semibold text-blue-700 dark:text-sky-300">แผน A: {formatBaht(INSURANCE_PLANS.plan_a.premiums[1])} บาท</div>
                <div className="text-xs font-bold text-amber-700 dark:text-amber-300">แผน B: {formatBaht(INSURANCE_PLANS.plan_b.premiums[1])} บาท</div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">ความคุ้มครอง 2 ปี</div>
                <div className="text-xs font-semibold text-blue-700 dark:text-sky-300">แผน A: {formatBaht(INSURANCE_PLANS.plan_a.premiums[2])} บาท</div>
                <div className="text-xs font-bold text-amber-700 dark:text-amber-300">แผน B: {formatBaht(INSURANCE_PLANS.plan_b.premiums[2])} บาท</div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">ความคุ้มครอง 3 ปี</div>
                <div className="text-xs font-semibold text-blue-700 dark:text-sky-300">แผน A: {formatBaht(INSURANCE_PLANS.plan_a.premiums[3])} บาท</div>
                <div className="text-xs font-bold text-amber-700 dark:text-amber-300">แผน B: {formatBaht(INSURANCE_PLANS.plan_b.premiums[3])} บาท</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/95 border-t border-slate-200/80 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              onSelectPlan('none', 1);
              onClose();
            }}
            className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold cursor-pointer"
          >
            ไม่รับความคุ้มครอง (0 บาท)
          </button>
          <div className="flex items-center gap-2">
            {onOpenDoc && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDoc();
                }}
                className="px-4 py-2 bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 hover:opacity-95 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>ดู/ดาวน์โหลดแผนความคุ้มครอง</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              ตกลง / ปิดหน้าต่าง
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
