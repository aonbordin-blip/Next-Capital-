import React from 'react';
import { X, Layers, CheckCircle2 } from 'lucide-react';
import { PROPOSALS } from '../data/proposals';
import { ProposalKey } from '../types';
import { useModalTransition } from '../hooks/useModalTransition';
import { MarqueeText } from './MarqueeText';

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
  const { shouldRender, isClosing, backdropAnimClass, sheetAnimClass } = useModalTransition(
    isOpen,
    onClose
  );

  if (!shouldRender) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 ${backdropAnimClass}`}
      onClick={() => {
        if (!isClosing) onClose();
      }}
    >
      <div
        className={`bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700/80 overflow-hidden my-auto ${sheetAnimClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/70">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 rounded-lg">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                เลือกประเภทข้อเสนอ (Proposal)
              </h2>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                แตะเพื่อเลือกประเภทเงื่อนไขคำนวณค่างวด
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-slate-700 active:scale-95 rounded-full transition-all cursor-pointer"
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
                    ? 'bg-blue-50/90 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-950 dark:text-blue-100 font-bold shadow-xs'
                    : 'bg-white dark:bg-slate-800/70 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                {/* Left: Radio Indicator + Name */}
                <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                  <div
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected
                        ? 'border-blue-700 dark:border-blue-500 bg-blue-700 dark:bg-blue-500 text-white'
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                    }`}
                  >
                    {isSelected && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <MarqueeText className="text-xs font-semibold flex-1">
                    {prop.name}
                  </MarqueeText>
                </div>

                {/* Right: Code Badge */}
                <span
                  className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap flex-shrink-0 ${
                    isSelected
                      ? 'bg-blue-700 dark:bg-blue-600 text-white border-blue-700 dark:border-blue-500 shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-900 text-blue-700 dark:text-blue-300 border-slate-200/80 dark:border-slate-700'
                  }`}
                >
                  {prop.code}
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 text-center text-[10px] text-slate-400 dark:text-slate-500">
          แสดงแบบแถวเดียวขนาดกะทัดรัด • เลือกได้ 7 ประเภทข้อเสนอ
        </div>
      </div>
    </div>
  );
};
