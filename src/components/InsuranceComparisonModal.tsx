import React from 'react';
import { X, ShieldCheck, Check, Sparkles, AlertCircle } from 'lucide-react';
import { InsurancePlan, InsuranceYears } from '../types';
import { INSURANCE_PLANS, formatBaht } from '../data/proposals';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedPlan: InsurancePlan;
  selectedYears: InsuranceYears;
  onSelectPlan: (plan: InsurancePlan, years: InsuranceYears) => void;
}

export const InsuranceComparisonModal: React.FC<Props> = ({
  isOpen,
  onClose,
  selectedPlan,
  selectedYears,
  onSelectPlan,
}) => {
  if (!isOpen) return null;

  const planA = INSURANCE_PLANS.plan_a;
  const planB = INSURANCE_PLANS.plan_b;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white/95 backdrop-blur-2xl border border-white/80 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-amber-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-700/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  เปรียบเทียบความคุ้มครอง และเบี้ยประกันภัย สำหรับ Group PA
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                โครงการ PA advised by LOCKTON • คุ้มครองผู้เช่าซื้อรถจักรยานยนต์
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-700">
          {/* Quick Plan Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Plan A Card */}
            <div
              className={`rounded-2xl p-4 border transition-all ${
                selectedPlan === 'plan_a'
                  ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20 shadow-md'
                  : 'border-slate-200 bg-white/70 hover:border-slate-300'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    PA ปกติ
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 mt-1">
                    {planA.name}
                  </h3>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400">เริ่มต้น</div>
                  <div className="text-base font-extrabold text-blue-700">
                    ฿670<span className="text-[10px] font-normal text-slate-500">/ปี</span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] space-y-1.5 text-slate-600 border-t border-slate-100 pt-2 mb-3">
                <div className="flex justify-between">
                  <span>• อุบัติเหตุทั่วไป:</span>
                  <span className="font-semibold text-slate-800">฿80,000</span>
                </div>
                <div className="flex justify-between">
                  <span>• ขับขี่/โดยสารรถจักรยานยนต์:</span>
                  <span className="font-semibold text-slate-800">฿50,000</span>
                </div>
                <div className="flex justify-between">
                  <span>• ถูกฆาตกรรม/ทำร้ายร่างกาย:</span>
                  <span className="font-semibold text-slate-800">฿50,000</span>
                </div>
                <div className="flex justify-between">
                  <span>• ค่ารักษาพยาบาล/ครั้ง:</span>
                  <span className="font-semibold text-slate-800">฿1,000</span>
                </div>
                <div className="flex justify-between">
                  <span>• ชดเชยรายได้คนไข้ใน:</span>
                  <span className="text-slate-400">ไม่มี</span>
                </div>
              </div>

              {/* Select Years */}
              <div className="flex gap-1.5 pt-2 border-t border-slate-200/60">
                {([1, 2, 3] as InsuranceYears[]).map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => onSelectPlan('plan_a', y)}
                    className={`flex-1 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer ${
                      selectedPlan === 'plan_a' && selectedYears === y
                        ? 'bg-blue-700 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
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
                  ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/20 shadow-md'
                  : 'border-slate-200 bg-white/70 hover:border-slate-300'
              }`}
            >
              <div className="absolute top-2 right-2 flex items-center gap-0.5 text-[9px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-white shadow-xs">
                <Sparkles className="w-2.5 h-2.5" /> แนะนำ คุ้มค่า
              </div>

              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                    PA PLUS
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 mt-1">
                    {planB.name}
                  </h3>
                </div>
                <div className="text-right pt-4 sm:pt-0">
                  <div className="text-[10px] text-slate-400">เริ่มต้น</div>
                  <div className="text-base font-extrabold text-amber-700">
                    ฿1,329<span className="text-[10px] font-normal text-slate-500">/ปี</span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] space-y-1.5 text-slate-600 border-t border-slate-100 pt-2 mb-3">
                <div className="flex justify-between">
                  <span>• อุบัติเหตุทั่วไป:</span>
                  <span className="font-bold text-amber-900">฿200,000</span>
                </div>
                <div className="flex justify-between">
                  <span>• ขับขี่/โดยสารรถจักรยานยนต์:</span>
                  <span className="font-bold text-amber-900">฿200,000</span>
                </div>
                <div className="flex justify-between">
                  <span>• ถูกฆาตกรรม/ทำร้ายร่างกาย:</span>
                  <span className="font-bold text-amber-900">฿200,000</span>
                </div>
                <div className="flex justify-between">
                  <span>• ค่ารักษาพยาบาล/ครั้ง:</span>
                  <span className="font-semibold text-slate-800">฿1,000</span>
                </div>
                <div className="flex justify-between font-semibold text-emerald-700">
                  <span>• ชดเชยรายได้คนไข้ใน:</span>
                  <span>500 บาท / วัน (สูงสุด 30 วัน/ปี)</span>
                </div>
              </div>

              {/* Select Years */}
              <div className="flex gap-1.5 pt-2 border-t border-slate-200/60">
                {([1, 2, 3] as InsuranceYears[]).map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => onSelectPlan('plan_b', y)}
                    className={`flex-1 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer ${
                      selectedPlan === 'plan_b' && selectedYears === y
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {y} ปี ({formatBaht(planB.premiums[y])})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Full Official Comparison Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 w-1/2">ความคุ้มครอง</th>
                  <th className="py-2.5 px-4 text-center bg-blue-50/50">แผน A (PA ปกติ)</th>
                  <th className="py-2.5 px-4 text-center bg-amber-50/50">แผน B (PA PLUS)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                <tr>
                  <td colSpan={3} className="py-2 px-4 bg-slate-50 font-semibold text-slate-800 text-[11px]">
                    1. การเสียชีวิต การสูญเสียอวัยวะ สายตา หรือทุพพลภาพถาวรสิ้นเชิง (อบ.1)
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-6 text-slate-600">- อุบัติเหตุทั่วไป</td>
                  <td className="py-2 px-4 text-center font-semibold text-slate-900">80,000 บาท</td>
                  <td className="py-2 px-4 text-center font-bold text-amber-800">200,000 บาท</td>
                </tr>
                <tr>
                  <td className="py-2 px-6 text-slate-600">- การขับขี่หรือโดยสารรถจักรยานยนต์</td>
                  <td className="py-2 px-4 text-center font-semibold text-slate-900">50,000 บาท</td>
                  <td className="py-2 px-4 text-center font-bold text-amber-800">200,000 บาท</td>
                </tr>
                <tr>
                  <td className="py-2 px-6 text-slate-600">- การถูกฆาตกรรม หรือถูกทำร้ายร่างกาย (กรณีเสียชีวิตเท่านั้น)</td>
                  <td className="py-2 px-4 text-center font-semibold text-slate-900">50,000 บาท</td>
                  <td className="py-2 px-4 text-center font-bold text-amber-800">200,000 บาท</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-medium text-slate-800">2. ค่ารักษาพยาบาล ต่ออุบัติเหตุแต่ละครั้ง</td>
                  <td className="py-2.5 px-4 text-center font-semibold text-slate-900">1,000 บาท</td>
                  <td className="py-2.5 px-4 text-center font-semibold text-slate-900">1,000 บาท</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-medium text-slate-800">
                    3. ค่าปลงศพ (กรณีเสียชีวิตจากบาดเจ็บหรือเจ็บป่วยมีระยะเวลารอคอย 180 วัน)
                  </td>
                  <td className="py-2.5 px-4 text-center font-semibold text-slate-900">10,000 บาท</td>
                  <td className="py-2.5 px-4 text-center font-semibold text-slate-900">10,000 บาท</td>
                </tr>
                <tr className="bg-amber-50/30">
                  <td className="py-2.5 px-4 font-bold text-slate-900">
                    *เพิ่ม* ข้อ 4. เงินชดเชยรายได้ระหว่างรักษาตัวใน รพ. (คนไข้ใน สูงสุด 30 วัน/ปี)
                  </td>
                  <td className="py-2.5 px-4 text-center text-slate-400">ไม่มี</td>
                  <td className="py-2.5 px-4 text-center font-bold text-emerald-700">500 บาท / ต่อวัน</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Premium Rate Table */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-800">ตารางเบี้ยประกันภัย / ต่อคน (รวมอากรแสตมป์ 20 บาท/กรมธรรม์)</span>
              <span className="text-[10px] text-slate-500">โครงการ PA advised by LOCKTON</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-500 mb-1">ความคุ้มครอง 1 ปี</div>
                <div className="text-xs font-semibold text-blue-700">แผน A: 670 บาท</div>
                <div className="text-xs font-bold text-amber-700">แผน B: 1,329 บาท</div>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-500 mb-1">ความคุ้มครอง 2 ปี</div>
                <div className="text-xs font-semibold text-blue-700">แผน A: 1,340 บาท</div>
                <div className="text-xs font-bold text-amber-700">แผน B: 2,658 บาท</div>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-500 mb-1">ความคุ้มครอง 3 ปี</div>
                <div className="text-xs font-semibold text-blue-700">แผน A: 2,010 บาท</div>
                <div className="text-xs font-bold text-amber-700">แผน B: 3,987 บาท</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onSelectPlan('none', 1);
              onClose();
            }}
            className="text-xs text-rose-600 hover:underline font-semibold cursor-pointer"
          >
            ไม่รับความคุ้มครอง (0 บาท)
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            ตกลง / ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
