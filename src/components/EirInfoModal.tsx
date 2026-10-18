import React from 'react';
import { X, ShieldCheck, AlertTriangle, Scale, Lock, Info, CheckCircle2 } from 'lucide-react';
import { NextCapitalLogo } from './NextCapitalLogo';
import { CalculationResult } from '../types';
import { formatBaht } from '../data/proposals';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  calculation: CalculationResult;
}

const EIR_CEILING_TABLE = [
  { term: 12, maxFlat: '1.068%', eirAnnual: '22.86%', note: 'เพดานสูงสุด 12 งวด' },
  { term: 18, maxFlat: '1.059%', eirAnnual: '22.86%', note: 'เพดานสูงสุด 18 งวด' },
  { term: 24, maxFlat: '1.064%', eirAnnual: '22.86%', note: 'เพดานสูงสุด 24 งวด' },
  { term: 30, maxFlat: '1.077%', eirAnnual: '22.92%', note: 'เพดานสูงสุด 30 งวด' },
  { term: 36, maxFlat: '1.089%', eirAnnual: '22.92%', note: 'เพดานสูงสุด 36 งวด (ตรงตามระบบ Next Capital)' },
  { term: 42, maxFlat: '1.103%', eirAnnual: '22.92%', note: 'เพดานสูงสุด 42 งวด' },
  { term: 48, maxFlat: '1.114%', eirAnnual: '22.86%', note: 'เพดานสูงสุด 48 งวด' },
  { term: 60, maxFlat: '1.144%', eirAnnual: '22.86%', note: 'เพดานสูงสุด 60 งวด' },
];

export const EirInfoModal: React.FC<Props> = ({ isOpen, onClose, calculation }) => {
  if (!isOpen) return null;

  const {
    term,
    baseVehiclePrice,
    downAmount,
    proposalMonthlyRate,
    maxAllowedMonthlyRate,
    effectiveMonthlyRate,
    isCappedByEir,
    eirAnnualPercent,
  } = calculation;

  const proposalPctStr = (proposalMonthlyRate * 100).toFixed(3);
  const maxAllowedPctStr = (maxAllowedMonthlyRate * 100).toFixed(3);
  const effectivePctStr = (effectiveMonthlyRate * 100).toFixed(3);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white/95 backdrop-blur-xl border border-white/80 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <Scale className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">
                  หลักเกณฑ์การใช้ดอกเบี้ยในการคำนวณค่างวด
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-amber-950">
                  EIR 23% Max
                </span>
              </div>
              <p className="text-xs text-blue-200">
                เกณฑ์ควบคุมสัญญาเช่าซื้อรถจักรยานยนต์ สคบ. & Next Capital
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-slate-700">
          {/* Quick Notice Banner */}
          <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200/70 text-xs text-blue-950 space-y-2">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-blue-700 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-blue-900 text-sm block mb-0.5">
                  เพดานอัตราดอกเบี้ยที่แท้จริง (Effective Interest Rate: EIR) ไม่เกิน 23% ต่อปี
                </span>
                <p className="text-slate-600 leading-relaxed text-[11.5px]">
                  ตามประกาศคณะกรรมการว่าด้วยสัญญา (สคบ.) เรื่องควบคุมสัญญาเช่าซื้อรถจักรยานยนต์ และเกณฑ์การพิจารณาสินเชื่อของ บมจ. เน็กซ์ แคปปิตอล อัตราดอกเบี้ยที่แท้จริงต่อปี (EIR) ต้องไม่เกินร้อยละ 23 ต่อปี
                </p>
              </div>
            </div>
          </div>

          {/* Side-by-side Visual Example */}
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-blue-700" />
              เปรียบเทียบสองช่องในระบบสินเชื่อ
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* ช่องตาม Proposal (ซ้าย) */}
              <div
                className={`p-3.5 rounded-2xl border transition-all ${
                  isCappedByEir
                    ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-400/30'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-600">
                    ช่องตาม Proposal (ซ้าย)
                  </span>
                  {isCappedByEir && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> เกินเพดาน EIR
                    </span>
                  )}
                </div>
                <div className="text-xl font-black text-slate-800">
                  {proposalPctStr}% <span className="text-xs font-normal text-slate-500">/ เดือน</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  ขออัตราดอกเบี้ยมาที่ {proposalPctStr}% ตามเงื่อนไขแคมเปญ
                </p>
              </div>

              {/* ช่องอัตราสูงสุด (ขวา) */}
              <div
                className={`p-3.5 rounded-2xl border transition-all ${
                  isCappedByEir
                    ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20'
                    : 'bg-blue-50/70 border-blue-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-emerald-600" />
                    ช่องอัตราสูงสุด (ขวา) • บังคับใช้จริง
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-200 text-emerald-900">
                    ผ่านเกณฑ์อนุมัติ
                  </span>
                </div>
                <div className="text-xl font-black text-emerald-700">
                  {maxAllowedPctStr}% <span className="text-xs font-normal text-emerald-800">/ เดือน</span>
                </div>
                <p className="text-[11px] text-emerald-800 font-semibold mt-1">
                  สูงสุด {maxAllowedPctStr} เป็นอัตราดอกเบี้ยไม่เกิน EIR 23%
                </p>
              </div>
            </div>
          </div>

          {/* Explanation Box */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white shadow-md space-y-2.5">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wide">
              <Scale className="w-4 h-4" />
              ทำไมถึงต้องใช้ {effectivePctStr}% :
            </div>
            <p className="text-[12px] text-slate-200 leading-relaxed">
              เนื่องจากตามเงื่อนไขของเคสนี้ (ราคารถ {formatBaht(baseVehiclePrice)}, เงินดาวน์ {formatBaht(downAmount)} และระยะเวลาผ่อน {term} งวด) หากใช้ดอกเบี้ย {proposalPctStr}% จะทำให้อัตราดอกเบี้ยที่แท้จริงต่อปี (EIR) สูงเกินเพดานกฎหมายกำหนด (ไม่เกิน 23% ต่อปี) ระบบจึงทำการล็อกและบังคับให้ใช้อัตราสูงสุดที่ไม่ผิดกฎหมาย คือ <strong className="text-emerald-300 underline font-bold">{effectivePctStr}%</strong> แทน เพื่อให้ชุดข้อมูลชุดนี้ผ่านเกณฑ์การอนุมัติครับ
            </p>
            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-blue-200">
              <span>สถานะ EIR ของสัญญานี้:</span>
              <span className="font-bold text-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> EIR ปัจจุบัน: {eirAnnualPercent.toFixed(2)}% ต่อปี (ผ่านเกณฑ์ สคบ.)
              </span>
            </div>
          </div>

          {/* Statutory Ceiling Reference Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-800 tracking-tight">
                ตารางเพดานอัตราดอกเบี้ยคงที่ (Flat Rate) สูงสุดที่ไม่เกิน EIR 23% ต่อปี
              </h3>
              <span className="text-[10px] text-slate-400">อ้างอิงตามระยะเวลางวดผ่อน</span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 shadow-xs">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-500 text-[10.5px] font-semibold">
                    <th className="py-2.5 px-3">ระยะเวลาผ่อน</th>
                    <th className="py-2.5 px-3 text-right">อัตรา Flat Rate สูงสุด</th>
                    <th className="py-2.5 px-3 text-right">EIR ที่แท้จริงต่อปี</th>
                    <th className="py-2.5 px-3 text-left">หมายเหตุเกณฑ์พิจารณา</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {EIR_CEILING_TABLE.map((row) => {
                    const isRowCurrent = row.term === term;
                    return (
                      <tr
                        key={row.term}
                        className={`transition-colors ${
                          isRowCurrent
                            ? 'bg-blue-50/80 font-bold text-blue-950'
                            : 'hover:bg-slate-50/60 text-slate-700'
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1.5">
                            {isRowCurrent && (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-700" />
                            )}
                            {row.term} งวด ({(row.term / 12).toFixed(row.term % 12 === 0 ? 0 : 1)} ปี)
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-blue-700 font-bold">
                          {row.maxFlat}
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-700 font-semibold">
                          ≤ {row.eirAnnual}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-500">
                          {row.note} {isRowCurrent && '👈 (งวดที่เลือกอยู่)'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200/80 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <NextCapitalLogo size={24} />
            <span className="text-[11px] text-slate-500 font-medium">
              Next Capital Public Company Limited
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            รับทราบและปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
