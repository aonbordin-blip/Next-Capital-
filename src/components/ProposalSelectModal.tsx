import React from 'react';
import { X, Layers, CheckCircle2 } from 'lucide-react';
import { PROPOSALS } from '../data/proposals';
import { ProposalKey } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedKey: ProposalKey;
  onSelectProposal: (key: ProposalKey) => void;
}

const PROPOSAL_KEYS: ProposalKey[] = [
  'small_bike',
  'top_small',
  'aec',
  'fazzio',
  'vespa',
  'honda_yamaha',
  'second_hand',
];

export const ProposalSelectModal: React.FC<Props> = ({
  isOpen,
  onClose,
  selectedKey,
  onSelectProposal,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-800">
                เลือกประเภทข้อเสนอ (Proposal)
              </h2>
              <p className="text-[10px] text-slate-500">
                แตะเพื่อเลือกประเภทเงื่อนไขคำนวณค่างวด
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 active:scale-95 rounded-full transition-all cursor-pointer"
            title="ปิด (Close)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Proposal List - Compact Single-Row Items */}
        <div className="p-3 space-y-1.5 max-h-[75vh] overflow-y-auto">
          {PROPOSAL_KEYS.map((key) => {
            const prop = PROPOSALS[key];
            const isSelected = selectedKey === key;

            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  onSelectProposal(key);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all cursor-pointer text-left border ${
                  isSelected
                    ? 'bg-blue-50/90 border-blue-300 text-blue-950 font-bold shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-700 hover:border-slate-300'
                }`}
              >
                {/* Left: Radio Indicator + Name (Single Row, Small Font) */}
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <div
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected
                        ? 'border-blue-700 bg-blue-700 text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isSelected && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <span className="text-xs font-semibold truncate whitespace-nowrap">
                    {prop.name}
                  </span>
                </div>

                {/* Right: Code Badge (Single Row) */}
                <span
                  className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap flex-shrink-0 ${
                    isSelected
                      ? 'bg-blue-700 text-white border-blue-700 shadow-2xs'
                      : 'bg-slate-100 text-blue-700 border-slate-200/80'
                  }`}
                >
                  {prop.code}
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-center text-[10px] text-slate-400">
          แสดงแบบแถวเดียวขนาดกะทัดรัด • เลือกได้ 7 ประเภทข้อเสนอ
        </div>
      </div>
    </div>
  );
};
