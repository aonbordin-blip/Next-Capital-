import React from 'react';
import {
  X,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Sparkles,
  FileCheck2,
} from 'lucide-react';
import { CardModalOverlay } from './CardModalOverlay';
import {
  ELIGIBILITY_TIERS,
  ELIGIBILITY_TIER_ORDER,
  ACE_FULL_NOTE,
  ACE_RULE_ITEMS,
  CustomerEligibilityResult,
  EligibilityTierKey,
} from '../data/eligibilityCriteria';
import { triggerHaptic } from '../utils/haptics';

interface EligibilityCriteriaModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTierKey: EligibilityTierKey;
  evaluation?: CustomerEligibilityResult;
  bikeLabel?: string;
  isAceCustomer?: boolean;
  onJumpToDv?: () => void;
}

export const EligibilityCriteriaModal: React.FC<EligibilityCriteriaModalProps> = ({
  isOpen,
  onClose,
  activeTierKey,
  evaluation,
  bikeLabel,
  isAceCustomer,
  onJumpToDv,
}) => {
  const activeTier = ELIGIBILITY_TIERS[activeTierKey];

  const rows: Array<{
    label: string;
    getValue: (key: EligibilityTierKey) => string;
  }> = [
    {
      label: 'ช่องทางการขาย',
      getValue: (k) => ELIGIBILITY_TIERS[k].salesChannel,
    },
    {
      label: 'อายุงานตามเกณฑ์',
      getValue: (k) => ELIGIBILITY_TIERS[k].workMonthsLabel,
    },
    {
      label: 'รายได้',
      getValue: (k) => ELIGIBILITY_TIERS[k].incomeLabel,
    },
    {
      label: 'อายุ',
      getValue: (k) => ELIGIBILITY_TIERS[k].ageLabel,
    },
    {
      label: 'ระยะเวลาพักอาศัย',
      getValue: (k) => ELIGIBILITY_TIERS[k].residenceLabel,
    },
  ];

  return (
    <CardModalOverlay
      isOpen={isOpen}
      onClose={onClose}
      maxWidthClass="max-w-3xl"
      accentBarClass="bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600"
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/80">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-sm flex items-center justify-center shrink-0">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100 truncate">
              เกณฑ์คุณสมบัติลูกค้า & ช่องทางการขาย
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
              ตารางเงื่อนไขการรับพิจารณาตามกลุ่มรถ และเกณฑ์พิเศษกรณีลูกค้า ACE
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            onClose();
          }}
          className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded-full transition-colors cursor-pointer shrink-0"
          aria-label="ปิดหน้าต่าง"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 bg-slate-50/50 dark:bg-slate-900/50">
        {/* Active Bike / Proposal Banner */}
        <div className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-sky-50 via-blue-50 to-indigo-50 dark:from-sky-950/60 dark:via-blue-950/50 dark:to-indigo-950/60 border border-sky-200/90 dark:border-sky-800/70 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
            <div className="text-xs text-slate-700 dark:text-slate-200">
              <span className="font-semibold">เกณฑ์ที่ใช้อยู่ปัจจุบัน: </span>
              <span className="font-extrabold text-sky-900 dark:text-sky-200">{activeTier.title}</span>
              {bikeLabel && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-1">({bikeLabel})</span>
              )}
            </div>
          </div>
          <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-sky-600 text-white shadow-2xs shrink-0">
            ช่องทาง: {activeTier.salesChannel}
          </span>
        </div>

        {/* Exact Criteria Table */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[540px]">
              <thead>
                <tr className="bg-slate-200/80 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700">
                  <th className="py-3 px-3.5 text-xs font-extrabold text-slate-700 dark:text-slate-200 border-r border-slate-300 dark:border-slate-700 w-[26%]">
                    เงื่อนไข / เกณฑ์
                  </th>
                  {ELIGIBILITY_TIER_ORDER.map((tierKey) => {
                    const spec = ELIGIBILITY_TIERS[tierKey];
                    const isActive = tierKey === activeTierKey;
                    return (
                      <th
                        key={tierKey}
                        className={`py-3 px-3 text-center text-xs font-extrabold border-r last:border-r-0 border-slate-300 dark:border-slate-700 w-[24.6%] transition-colors ${
                          isActive
                            ? 'bg-sky-600 text-white'
                            : 'text-slate-800 dark:text-slate-200 bg-slate-200/70 dark:bg-slate-800/80'
                        }`}
                      >
                        <div className="leading-snug">{spec.title}</div>
                        {isActive && (
                          <span className="inline-block mt-1 text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
                            ใช้งานอยู่
                          </span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr
                    key={row.label}
                    className={`border-b last:border-b-0 border-slate-200 dark:border-slate-800 ${
                      rowIdx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/70 dark:bg-slate-800/40'
                    }`}
                  >
                    <td className="py-2.5 px-3.5 text-xs font-bold text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800">
                      {row.label}
                    </td>
                    {ELIGIBILITY_TIER_ORDER.map((tierKey) => {
                      const isActive = tierKey === activeTierKey;
                      return (
                        <td
                          key={tierKey}
                          className={`py-2.5 px-3 text-center text-xs sm:text-[13px] border-r last:border-r-0 border-slate-200 dark:border-slate-800 ${
                            isActive
                              ? 'bg-sky-50/80 dark:bg-sky-950/40 font-extrabold text-sky-950 dark:text-sky-200'
                              : 'font-semibold text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {row.getValue(tierKey)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Exact ACE Special Footnote Box */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50/70 to-rose-50/60 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-rose-950/30 border border-amber-300/90 dark:border-amber-800/70 space-y-2.5 shadow-2xs">
          <div className="flex items-start gap-2">
            <ShieldAlert className="w-4.5 h-4.5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs sm:text-[13px] font-extrabold text-amber-950 dark:text-amber-200">
                เงื่อนไขเพิ่มเติมสำหรับลูกค้ากลุ่ม ACE
              </h3>
              <p className="text-xs font-bold text-rose-800 dark:text-rose-300 mt-0.5 leading-relaxed">
                {ACE_FULL_NOTE}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-0.5">
            {ACE_RULE_ITEMS.map((rule) => (
              <div
                key={rule}
                className="px-2.5 py-1.5 rounded-xl bg-white/90 dark:bg-slate-900/80 border border-amber-200 dark:border-amber-800/60 text-[10.5px] font-bold text-slate-800 dark:text-slate-200 text-center flex items-center justify-center shadow-2xs"
              >
                {rule}
              </div>
            ))}
          </div>
        </div>

        {/* Live Customer Evaluation Summary */}
        {evaluation && evaluation.hasAnyInput && (
          <div
            className={`p-3.5 rounded-2xl border space-y-2 ${
              evaluation.failedTopics.length > 0 || evaluation.aceWarnings.length > 0
                ? 'bg-rose-50/80 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800/70'
                : 'bg-emerald-50/80 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/70'
            }`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                {evaluation.failedTopics.length > 0 || evaluation.aceWarnings.length > 0 ? (
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                )}
                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                  ผลเทียบข้อมูลลูกค้าปัจจุบันกับเกณฑ์ {activeTier.shortTitle}
                </span>
              </div>

              {isAceCustomer && (
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500 text-white">
                  ลูกค้ากลุ่ม ACE
                </span>
              )}
            </div>

            {evaluation.failedTopics.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-rose-700 dark:text-rose-300">
                  ไม่ผ่านเกณฑ์มาตรฐาน ({evaluation.failedTopics.length} รายการ) — ระบบลิงก์เข้าหัวข้อขออนุมัติ DV อัตโนมัติ:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {evaluation.failedTopics.map((f) => (
                    <span
                      key={f.code}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800/70 text-[11px] font-bold text-rose-800 dark:text-rose-200 shadow-2xs"
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                      <span>{f.dvTopic}</span>
                      <span className="text-slate-500 dark:text-slate-400 font-medium">({f.detail})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {evaluation.aceWarnings.length > 0 && (
              <div className="space-y-1">
                {evaluation.aceWarnings.map((w) => (
                  <p key={w} className="text-[11px] font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>{w}</span>
                  </p>
                ))}
              </div>
            )}

            {evaluation.checkedCount > 0 &&
              evaluation.failedTopics.length === 0 &&
              evaluation.aceWarnings.length === 0 && (
                <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                  ผ่านเกณฑ์มาตรฐานครบทั้ง {evaluation.checkedCount} รายการที่กรอกไว้ ✓
                </p>
              )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 sm:px-6 py-3 bg-slate-50 dark:bg-slate-800/70 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
        {onJumpToDv ? (
          <button
            type="button"
            onClick={() => {
              triggerHaptic('medium');
              onClose();
              onJumpToDv();
            }}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>ไปหน้าขออนุมัติ DV</span>
          </button>
        ) : (
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            ตรวจสอบเกณฑ์ก่อนส่งเคสเข้าระบบอนุมัติ
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            onClose();
          }}
          className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
        >
          รับทราบ / ปิดหน้าต่าง
        </button>
      </div>
    </CardModalOverlay>
  );
};
