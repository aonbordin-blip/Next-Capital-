import React from 'react';
import { X, HelpCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { PROPOSALS } from '../data/proposals';
import { ProposalKey } from '../types';
import { NextCapitalLogo } from './NextCapitalLogo';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedKey: ProposalKey;
  onSelectProposal: (key: ProposalKey) => void;
}

export const ProposalInfoModal: React.FC<Props> = ({
  isOpen,
  onClose,
  selectedKey,
  onSelectProposal,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white/95 backdrop-blur-xl border border-white/80 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white shadow-2xs border border-slate-200/80 flex items-center justify-center shrink-0">
              <NextCapitalLogo size={28} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                เงื่อนไขข้อเสนอ Next Capital (Proposals)
              </h2>
              <p className="text-xs text-slate-500">
                เกณฑ์การคำนวณและอัตราดอกเบี้ยเช่าซื้อตามประกาศ บมจ. เน็กซ์ แคปปิตอล
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

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {Object.values(PROPOSALS).map((p) => {
            const isSelected = p.key === selectedKey;
            return (
              <div
                key={p.key}
                onClick={() => {
                  onSelectProposal(p.key);
                  onClose();
                }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 text-sm">{p.name}</span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-100/80 text-indigo-700">
                        {p.code}
                      </span>
                      {isSelected && (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                          <CheckCircle2 className="w-3.5 h-3.5" /> เลือกอยู่
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{p.category}</p>
                  </div>
                </div>

                <div className="mt-3 text-xs text-slate-600 bg-slate-50/80 p-3 rounded-xl border border-slate-100 space-y-2">
                  <div className="flex items-center gap-1.5 font-medium text-slate-700">
                    <span>ระยะเวลาผ่อนที่รองรับ:</span>
                    <span className="text-indigo-600 font-semibold">
                      {p.validTerms.join(', ')} งวด
                    </span>
                  </div>

                  {p.key === 'small_bike' && (
                    <div className="text-[11px] grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-slate-600 pt-1">
                      <div>• 12 งวด: 1.06%/เดือน</div>
                      <div>• 18 งวด: 1.07%/เดือน</div>
                      <div>• 24 งวด: 1.07%/เดือน</div>
                      <div>• 30 งวด: 1.08%/เดือน</div>
                      <div>• 36 งวด: 1.09%/เดือน</div>
                      <div>• 42 งวด: 1.10%/เดือน</div>
                    </div>
                  )}

                  {p.key === 'fazzio' && (
                    <div className="text-[11px] text-slate-600 pt-1">
                      • อัตราดอกเบี้ย 1.10% ต่อเดือน เฉพาะ 48 งวด (Normal เท่านั้น)
                    </div>
                  )}

                  {p.key === 'top_small' && (
                    <div className="text-[11px] grid grid-cols-2 gap-1.5 text-slate-600 pt-1">
                      <div>• 12 - 36 งวด: 1.06%/เดือน</div>
                      <div>• 42 งวด: 1.10%/เดือน</div>
                      <div>• 48 งวด: 1.11%/เดือน</div>
                    </div>
                  )}

                  {p.key === 'vespa' && (
                    <div className="text-[11px] space-y-1 text-slate-600 pt-1">
                      <div className="font-medium text-slate-700">คิดดอกเบี้ยตามยอดดาวน์:</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        <div>• ดาวน์ ≥ 35,000 บ.: 6.75%/ปี</div>
                        <div>• ดาวน์ ≥ 25,000 บ.: 7.00%/ปี</div>
                        <div>• ดาวน์ ≥ 20,000 บ.: 7.25%/ปี</div>
                        <div>• ดาวน์ ≥ 15,000 บ.: 7.50%/ปี</div>
                        <div>• ดาวน์ &lt; 15,000 บ.: 9.00%/ปี</div>
                      </div>
                    </div>
                  )}

                  {p.key === 'honda_yamaha' && (
                    <div className="text-[11px] space-y-1 text-slate-600 pt-1">
                      <div className="font-medium text-slate-700">คิดดอกเบี้ยตาม % เงินดาวน์:</div>
                      <div className="space-y-0.5">
                        <div>• ดาวน์ ≥ 20%: ผ่อน ≤48 งวด = 5.00%/ปี, ผ่อน 60 งวด = 5.50%/ปี</div>
                        <div>• ดาวน์ ≥ 15%: ผ่อน ≤48 งวด = 5.50%/ปี, ผ่อน 60 งวด = 6.00%/ปี</div>
                        <div>• ดาวน์ &lt; 15%: 7.00%/ปี</div>
                      </div>
                    </div>
                  )}

                  {p.key === 'second_hand' && (
                    <div className="text-[11px] space-y-1 text-slate-600 pt-1">
                      <div>• 24, 30 งวด: 1.06%/เดือน | 36 งวด: 1.08%/เดือน | 42 งวด: 1.09%/เดือน</div>
                      <div className="text-rose-600 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> ดอกเบี้ยขั้นต่ำตลอดสัญญา 7,000 บาท
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="p-4 bg-slate-50 border-t border-slate-200/80 text-xs text-slate-500 flex justify-between items-center">
          <span>สูตรคำนวณ: ค่างวด = (ยอดจัด + ดอกเบี้ย + VAT 7%) ÷ จำนวนงวด</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-xs shadow-sm transition-all"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
