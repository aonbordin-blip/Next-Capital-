import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Award,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Check,
  Share2,
  Calendar,
  Sparkles,
  TrendingUp,
  FileSpreadsheet,
  Info,
  CheckCircle2,
  Car,
  ExternalLink,
  Target,
  ArrowRight,
} from 'lucide-react';
import { SavedCaseRecord, InsuranceYears } from '../types';
import { getSavedCases, saveCaseRecord } from '../utils/savedCasesStorage';
import {
  calculateCheckerCommission,
  generateLineCommissionReport,
  getCaseEffectiveDate,
} from '../utils/checkerCommission';
import { triggerHaptic } from '../utils/haptics';

interface Props {
  officerName: string;
  officerCode: string;
  officerDisplay: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpenSavedCases?: () => void;
}

const THAI_MONTH_NAMES = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

const THAI_MONTH_SHORTS = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

function formatShortThaiDate(dateStr?: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const d = parseInt(parts[2], 10);
    const m = parseInt(parts[1], 10);
    const y = parseInt(parts[0], 10);
    const thaiYearShort = (y + 543) % 100;
    return `${d} ${THAI_MONTH_SHORTS[m - 1] || ''} ${thaiYearShort}`;
  }
  return dateStr;
}

export const CheckerCommissionCard: React.FC<Props> = ({
  officerName,
  officerCode,
  officerDisplay,
  isExpanded,
  onToggleExpand,
  onOpenSavedCases,
}) => {
  const [savedCases, setSavedCases] = useState<SavedCaseRecord[]>([]);
  const [copied, setCopied] = useState(false);
  const [showCriteriaModal, setShowCriteriaModal] = useState(false);

  // Month-Year Filter state (defaults to current month: YYYY-MM)
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${y}-${m}`;
  });

  // Load saved cases from localStorage
  const reloadCases = () => {
    const cases = getSavedCases();
    setSavedCases(cases);
  };

  useEffect(() => {
    reloadCases();
  }, [isExpanded]);

  // Listen for storage events (if user saved/updated cases in another tab or modal)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'ncap_saved_cases_v1') {
        reloadCases();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Compute available months from saved cases that are delivered & approved
  const availablePeriods = useMemo(() => {
    const periodsSet = new Set<string>();
    const now = new Date();
    const currentYM = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    periodsSet.add(currentYM);

    savedCases.forEach((c) => {
      if (c.approvalStatus === 'approved' && c.deliveryStatus === 'delivered') {
        const dStr = getCaseEffectiveDate(c);
        if (dStr && dStr.length >= 7) {
          periodsSet.add(dStr.slice(0, 7));
        }
      }
    });

    const sorted = Array.from(periodsSet).sort().reverse();
    return sorted;
  }, [savedCases]);

  // Calculate commission based on selected period
  const summary = useMemo(() => {
    return calculateCheckerCommission(savedCases, selectedPeriod);
  }, [savedCases, selectedPeriod]);

  // Human-readable period label
  const periodLabel = useMemo(() => {
    if (selectedPeriod === 'all') return 'ทั้งหมด ทุกช่วงเวลา';
    const [yStr, mStr] = selectedPeriod.split('-');
    const mIdx = parseInt(mStr, 10) - 1;
    const bYear = parseInt(yStr, 10) + 543;
    return `${THAI_MONTH_NAMES[mIdx] || mStr} ${bYear}`;
  }, [selectedPeriod]);

  // Handle Copy to LINE
  const handleCopyReport = () => {
    triggerHaptic('success');
    const text = generateLineCommissionReport(summary, officerDisplay, periodLabel);
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => {
        // fallback
      });
  };

  // Seed sample delivered cases if user wants to test calculation immediately
  const handleSeedDemoCases = () => {
    triggerHaptic('success');
    const today = new Date().toISOString().slice(0, 10);
    const demoCasesData = [
      {
        caseTitle: 'คุณสมชาย ใจดี - GIORNO+',
        customerName: 'คุณสมชาย ใจดี',
        customerPhone: '081-234-5678',
        officerName,
        officerCode,
        proposalKey: 'top_small' as const,
        vehiclePrice: 90700,
        bikeModelName: 'HONDA GIORNO+',
        bikeModelCode: 'ACF125CAT TH',
        downMode: 'percent' as const,
        downValue: 0,
        term: 36,
        includeDeliveryFees: false,
        registrationFee: 0,
        theftInsuranceFee: 0,
        isCustomRateEnabled: false,
        customRateInput: '',
        customRateType: 'monthly' as const,
        enforceEirCap: false,
        insurancePlan: 'plan_b' as const, // PA PLUS
        insuranceYears: 3 as const,
        approvalStatus: 'approved' as const,
        deliveryStatus: 'delivered' as const,
        approvalDate: today,
        deliveryDate: today,
        paymentDueDay: 2,
        snapshot: {
          monthlyInstallment: 3850,
          financeAmount: 94687,
          downAmount: 0,
          downPercent: 0,
          totalInterest: 43913,
          totalWithVat: 138600,
          effectiveMonthlyRate: 0.01089,
          eirAnnualPercent: 22.92,
          proposalCode: 'TOP SMALL',
          proposalName: 'ข้อเสนอพิเศษรถยอดนิยม',
          rateDisplayText: '1.089%/ด.',
        },
      },
      {
        caseTitle: 'คุณกัญญาภัทร มั่นคง - Wave 125i',
        customerName: 'คุณกัญญาภัทร มั่นคง',
        customerPhone: '089-876-5432',
        officerName,
        officerCode,
        proposalKey: 'small_bike' as const,
        vehiclePrice: 58000,
        bikeModelName: 'HONDA WAVE 125i',
        bikeModelCode: 'AFS125MSFP TH',
        downMode: 'percent' as const,
        downValue: 0,
        term: 36,
        includeDeliveryFees: false,
        registrationFee: 0,
        theftInsuranceFee: 0,
        isCustomRateEnabled: false,
        customRateInput: '',
        customRateType: 'monthly' as const,
        enforceEirCap: false,
        insurancePlan: 'plan_a' as const, // PA ปกติ
        insuranceYears: 2 as const,
        approvalStatus: 'approved' as const,
        deliveryStatus: 'delivered' as const,
        approvalDate: today,
        deliveryDate: today,
        paymentDueDay: 2,
        snapshot: {
          monthlyInstallment: 2420,
          financeAmount: 59340,
          downAmount: 0,
          downPercent: 0,
          totalInterest: 27780,
          totalWithVat: 87120,
          effectiveMonthlyRate: 0.01089,
          eirAnnualPercent: 22.92,
          proposalCode: 'SMALL BIKE',
          proposalName: 'รถเล็กทั่วไป',
          rateDisplayText: '1.089%/ด.',
        },
      },
      {
        caseTitle: 'คุณธนภัทร รุ่งเรือง - Fazzio',
        customerName: 'คุณธนภัทร รุ่งเรือง',
        customerPhone: '086-555-1212',
        officerName,
        officerCode,
        proposalKey: 'fazzio' as const,
        vehiclePrice: 54900,
        bikeModelName: 'YAMAHA FAZZIO HYBRID',
        bikeModelCode: 'B3W100',
        downMode: 'percent' as const,
        downValue: 0,
        term: 36,
        includeDeliveryFees: false,
        registrationFee: 0,
        theftInsuranceFee: 0,
        isCustomRateEnabled: false,
        customRateInput: '',
        customRateType: 'monthly' as const,
        enforceEirCap: false,
        insurancePlan: 'plan_b' as const, // PA PLUS
        insuranceYears: 1 as const,
        approvalStatus: 'approved' as const,
        deliveryStatus: 'delivered' as const,
        approvalDate: today,
        deliveryDate: today,
        paymentDueDay: 2,
        snapshot: {
          monthlyInstallment: 2315,
          financeAmount: 56229,
          downAmount: 0,
          downPercent: 0,
          totalInterest: 27111,
          totalWithVat: 83340,
          effectiveMonthlyRate: 0.01089,
          eirAnnualPercent: 22.92,
          proposalCode: 'FAZZIO',
          proposalName: 'แคมเปญ Fazzio',
          rateDisplayText: '1.089%/ด.',
        },
      },
      {
        caseTitle: 'คุณวิรัตน์ ชูชัย - Scoopy',
        customerName: 'คุณวิรัตน์ ชูชัย',
        customerPhone: '084-321-9876',
        officerName,
        officerCode,
        proposalKey: 'small_bike' as const,
        vehiclePrice: 50400,
        bikeModelName: 'HONDA SCOOPY',
        bikeModelCode: 'ACF110CBT TH',
        downMode: 'percent' as const,
        downValue: 0,
        term: 36,
        includeDeliveryFees: false,
        registrationFee: 0,
        theftInsuranceFee: 0,
        isCustomRateEnabled: false,
        customRateInput: '',
        customRateType: 'monthly' as const,
        enforceEirCap: false,
        insurancePlan: 'plan_a' as const, // PA ปกติ
        insuranceYears: 1 as const,
        approvalStatus: 'approved' as const,
        deliveryStatus: 'delivered' as const,
        approvalDate: today,
        deliveryDate: today,
        paymentDueDay: 2,
        snapshot: {
          monthlyInstallment: 2130,
          financeAmount: 51070,
          downAmount: 0,
          downPercent: 0,
          totalInterest: 25610,
          totalWithVat: 76680,
          effectiveMonthlyRate: 0.01089,
          eirAnnualPercent: 22.92,
          proposalCode: 'SMALL BIKE',
          proposalName: 'รถเล็กทั่วไป',
          rateDisplayText: '1.089%/ด.',
        },
      },
      {
        caseTitle: 'คุณประทีป บุญช่วย - Click 160',
        customerName: 'คุณประทีป บุญช่วย',
        customerPhone: '082-111-2233',
        officerName,
        officerCode,
        proposalKey: 'top_small' as const,
        vehiclePrice: 70400,
        bikeModelName: 'HONDA CLICK 160',
        bikeModelCode: 'ACB160CBT TH',
        downMode: 'percent' as const,
        downValue: 0,
        term: 36,
        includeDeliveryFees: false,
        registrationFee: 0,
        theftInsuranceFee: 0,
        isCustomRateEnabled: false,
        customRateInput: '',
        customRateType: 'monthly' as const,
        enforceEirCap: false,
        insurancePlan: 'none' as const, // ไม่ทำประกัน
        insuranceYears: 1 as const,
        approvalStatus: 'approved' as const,
        deliveryStatus: 'delivered' as const,
        approvalDate: today,
        deliveryDate: today,
        paymentDueDay: 2,
        snapshot: {
          monthlyInstallment: 2890,
          financeAmount: 70400,
          downAmount: 0,
          downPercent: 0,
          totalInterest: 33640,
          totalWithVat: 104040,
          effectiveMonthlyRate: 0.01089,
          eirAnnualPercent: 22.92,
          proposalCode: 'TOP SMALL',
          proposalName: 'ข้อเสนอพิเศษรถยอดนิยม',
          rateDisplayText: '1.089%/ด.',
        },
      },
    ];

    demoCasesData.forEach((item) => {
      saveCaseRecord(item);
    });
    reloadCases();
  };

  return (
    <div className="bg-white rounded-3xl border border-emerald-100 shadow-md shadow-emerald-950/5 overflow-hidden transition-all duration-300 hover:border-emerald-200">
      {/* Accordion Header */}
      <button
        type="button"
        onClick={() => {
          triggerHaptic('light');
          onToggleExpand();
        }}
        className="w-full p-3.5 sm:p-5 flex items-center justify-between gap-2.5 sm:gap-3 text-left bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-white hover:bg-emerald-50/90 transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/25">
            <Award className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h3 className="text-xs sm:text-base font-bold text-slate-900 leading-tight">
                สรุปค่าคอมมิชชั่นค่าแนะนำขายประกัน
              </h3>
              <span className="text-[9.5px] sm:text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-100/90 text-emerald-800 border border-emerald-200 shrink-0">
                Checker Commission
              </span>
            </div>
            <p className="text-[10.5px] sm:text-xs text-slate-500 mt-0.5 truncate">
              คำนวณจากเคสที่อนุมัติและรับรถแล้ว ตามเกณฑ์ PA & PA PLUS
            </p>
          </div>
        </div>

        {/* Right side summary preview & toggle icon */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="text-right hidden xs:block">
            <div className="text-xs sm:text-sm font-extrabold text-emerald-700 whitespace-nowrap">
              ฿{summary.totalCommissionBaht.toLocaleString()} บ.
            </div>
            <div className="text-[10px] font-semibold text-slate-500 whitespace-nowrap">
              Tier {summary.tier} ({summary.achievementPercent.toFixed(1)}%)
            </div>
          </div>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/80 border border-slate-200/80 flex items-center justify-center text-slate-600 shrink-0">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-3.5 sm:p-5 border-t border-slate-100 bg-gradient-to-b from-white to-slate-50/40 space-y-4">
          {/* Controls Bar: Period selector, criteria toggle, copy line */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
            {/* Period Selector */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs font-semibold text-slate-700 shrink-0">
                <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="whitespace-nowrap">งวด:</span>
              </div>
              <select
                value={selectedPeriod}
                onChange={(e) => {
                  triggerHaptic('selection');
                  setSelectedPeriod(e.target.value);
                }}
                className="text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs"
              >
                {availablePeriods.map((ym) => {
                  const [yStr, mStr] = ym.split('-');
                  const mIdx = parseInt(mStr, 10) - 1;
                  const bYear = parseInt(yStr, 10) + 543;
                  return (
                    <option key={ym} value={ym}>
                      {THAI_MONTH_NAMES[mIdx]} {bYear}
                    </option>
                  );
                })}
                <option value="all">ทั้งหมด (ทุกเดือนรวมกัน)</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  reloadCases();
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer shrink-0"
                title="รีเฟรชข้อมูลเคสล่าสุด"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setShowCriteriaModal((prev) => !prev);
                }}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-sky-200 bg-sky-50/80 hover:bg-sky-100 text-sky-800 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
              >
                <Info className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span>{showCriteriaModal ? 'ซ่อนเกณฑ์' : 'ดูเกณฑ์คำนวณ'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyReport}
                className="px-3 py-1.5 text-xs font-bold rounded-xl border border-emerald-300 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>คัดลอกแล้ว</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>ส่งสรุป LINE</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Collapsible Criteria Reference Box */}
          {showCriteriaModal && (
            <div className="p-3 sm:p-4 bg-sky-50/60 rounded-2xl border border-sky-200/80 space-y-2.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <ShieldCheck className="w-4 h-4 text-sky-700 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-sky-950 truncate">
                    เกณฑ์การจ่ายค่าแนะนำสำหรับ Checker
                  </span>
                </div>
                <span className="text-[9.5px] bg-white px-2 py-0.5 rounded-full font-semibold text-sky-700 border border-sky-200 shrink-0 whitespace-nowrap">
                  ประกาศทางการ
                </span>
              </div>

              <p className="text-[11px] text-sky-900 leading-relaxed">
                <strong>สูตรคำนวณ Target Achievement %:</strong>
                <br />(จำนวนสัญญาที่ซื้อประกัน PA + PA Plus) ÷ (จำนวนสัญญาทั้งหมดที่ [อนุมัติและรับรถแล้ว]) × 100
              </p>

              {/* Criteria Table mirroring Image 1 */}
              <div className="overflow-x-auto rounded-xl border border-sky-200 bg-white">
                <table className="w-full text-[10.5px] sm:text-[11px] text-center border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-sky-100/70 text-sky-900 font-bold border-b border-sky-200">
                      <th rowSpan={2} className="p-2 border-r border-sky-200">Tier</th>
                      <th rowSpan={2} className="p-2 border-r border-sky-200">Target %</th>
                      <th colSpan={3} className="p-1.5 border-r border-sky-200 bg-emerald-50 text-emerald-900">
                        อัตราจ่าย PA (ปกติ)
                      </th>
                      <th colSpan={3} className="p-1.5 bg-indigo-50 text-indigo-900">
                        อัตราจ่าย PA PLUS
                      </th>
                    </tr>
                    <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-sky-200 text-[10px]">
                      <th className="p-1 border-r border-sky-200">1 ปี</th>
                      <th className="p-1 border-r border-sky-200">2 ปี</th>
                      <th className="p-1 border-r border-sky-200">3 ปี</th>
                      <th className="p-1 border-r border-sky-200">1 ปี</th>
                      <th className="p-1 border-r border-sky-200">2 ปี</th>
                      <th className="p-1">3 ปี</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Tier 1 */}
                    <tr className={`border-b border-slate-100 ${summary.tier === 1 ? 'bg-amber-50/80 font-bold text-amber-950' : 'text-slate-700'}`}>
                      <td className="p-2 border-r border-slate-200 font-bold">1</td>
                      <td className="p-2 border-r border-slate-200 text-left pl-2">≤ 60.00%</td>
                      <td className="p-1.5 border-r border-slate-200">50 ฿</td>
                      <td className="p-1.5 border-r border-slate-200">75 ฿</td>
                      <td className="p-1.5 border-r border-slate-200">100 ฿</td>
                      <td className="p-1.5 border-r border-slate-200">70 ฿</td>
                      <td className="p-1.5 border-r border-slate-200">125 ฿</td>
                      <td className="p-1.5">180 ฿</td>
                    </tr>
                    {/* Tier 2 */}
                    <tr className={`border-b border-slate-100 ${summary.tier === 2 ? 'bg-sky-100/90 font-bold text-sky-950' : 'text-slate-700'}`}>
                      <td className="p-2 border-r border-slate-200 font-bold">2</td>
                      <td className="p-2 border-r border-slate-200 text-left pl-2">60.01% - 75.00%</td>
                      <td className="p-1.5 border-r border-slate-200">70 ฿</td>
                      <td className="p-1.5 border-r border-slate-200">150 ฿</td>
                      <td className="p-1.5 border-r border-slate-200">250 ฿</td>
                      <td className="p-1.5 border-r border-slate-200">120 ฿</td>
                      <td className="p-1.5 border-r border-slate-200">250 ฿</td>
                      <td className="p-1.5">400 ฿</td>
                    </tr>
                    {/* Tier 3 */}
                    <tr className={`${summary.tier === 3 ? 'bg-emerald-100 font-bold text-emerald-950' : 'text-slate-700'}`}>
                      <td className="p-2 border-r border-slate-200 font-bold">3</td>
                      <td className="p-2 border-r border-slate-200 text-left pl-2">≥ 75.01% (สูงสุด)</td>
                      <td className="p-1.5 border-r border-slate-200">90 ฿</td>
                      <td className="p-1.5 border-r border-slate-200">200 ฿</td>
                      <td className="p-1.5 border-r border-slate-200">350 ฿</td>
                      <td className="p-1.5 border-r border-slate-200">170 ฿</td>
                      <td className="p-1.5 border-r border-slate-200">350 ฿</td>
                      <td className="p-1.5 font-bold text-emerald-700">550 ฿</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="text-[10px] text-slate-500 italic">
                *ระบบเน้นแถบสีของ Tier ปัจจุบันที่คุณได้รับโดยอัตโนมัติ
              </div>
            </div>
          )}

          {/* 4 Main KPI Dashboard Cards (ปรับปรุงไม่ให้ข้อความตกบรรทัด) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {/* Card 1: สัญญารับรถทั้งหมด */}
            <div className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-slate-50 to-white border border-slate-200 shadow-2xs">
              <div className="text-[10.5px] sm:text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                <span className="whitespace-nowrap truncate">รับรถแล้วทั้งหมด</span>
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-slate-900">
                  {summary.totalDeliveredContracts}
                </span>
                <span className="text-xs font-semibold text-slate-500">คัน</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 whitespace-nowrap truncate">
                อนุมัติ & รับรถแล้ว
              </div>
            </div>

            {/* Card 2: สัญญาที่ซื้อประกัน */}
            <div className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-blue-50/70 to-white border border-blue-200/80 shadow-2xs">
              <div className="text-[10.5px] sm:text-[11px] font-semibold text-blue-800 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="whitespace-nowrap truncate">ซื้อประกัน (PA+PA+)</span>
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-blue-900">
                  {summary.totalInsuredContracts}
                </span>
                <span className="text-xs font-semibold text-blue-700">คัน</span>
              </div>
              <div className="text-[10px] text-blue-600/90 font-medium mt-0.5 whitespace-nowrap truncate">
                PA: {summary.paCount} | PA+: {summary.paPlusCount}
              </div>
            </div>

            {/* Card 3: Target Achievement % (แก้ไขไม่ให้คำว่า Achievement และ % หลุดตกบรรทัด) */}
            <div className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-teal-50/70 to-white border border-teal-200/80 shadow-2xs">
              <div className="text-[10.5px] sm:text-[11px] font-semibold text-teal-800 flex items-center justify-between gap-1">
                <div className="flex items-center gap-1 min-w-0">
                  <Target className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span className="whitespace-nowrap truncate">Achievement</span>
                </div>
                <span
                  className={`text-[9.5px] px-1.5 py-0.2 rounded-full font-bold whitespace-nowrap shrink-0 ${
                    summary.tier === 3
                      ? 'bg-emerald-100 text-emerald-800'
                      : summary.tier === 2
                      ? 'bg-sky-100 text-sky-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  Tier {summary.tier}
                </span>
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-teal-900">
                  {summary.achievementPercent.toFixed(1)}%
                </span>
              </div>
              <div className="text-[10px] text-teal-700 font-medium mt-0.5 whitespace-nowrap truncate">
                {summary.tierRule.label}
              </div>
            </div>

            {/* Card 4: ยอดรวมค่าคอมมิชชั่น */}
            <div className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-md shadow-emerald-600/20 border border-emerald-400/40">
              <div className="text-[10.5px] sm:text-[11px] font-medium text-emerald-100 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
                <span className="whitespace-nowrap truncate">ค่าแนะนำสุทธิ</span>
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl sm:text-2xl font-black text-white tracking-tight whitespace-nowrap">
                  ฿{summary.totalCommissionBaht.toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-emerald-100 ml-0.5 whitespace-nowrap">บาท</span>
              </div>
              <div className="text-[10px] text-emerald-100/90 mt-0.5 font-medium whitespace-nowrap truncate">
                งวด {periodLabel}
              </div>
            </div>
          </div>

          {/* Tier Progress Bar & Incentive Badge (แก้ไข Title ไม่ให้ซ้อนสองแถวและตัดตกบรรทัด) */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 space-y-2.5">
            <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1 text-xs">
              <div className="font-bold text-slate-800 flex items-center gap-1.5 min-w-0">
                <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="truncate">ระดับผลงานเป้าหมาย (Tier Achievement)</span>
              </div>
              <div className="text-[11px] sm:text-xs font-extrabold text-emerald-700 whitespace-nowrap self-start xs:self-auto bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 shrink-0">
                ปัจจุบัน: Tier {summary.tier} ({summary.achievementPercent.toFixed(2)}%)
              </div>
            </div>

            {/* Progress Track */}
            <div className="relative pt-2 pb-1">
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden relative border border-slate-200">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 via-sky-500 to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(4, summary.achievementPercent))}%` }}
                />
              </div>

              {/* Tier Threshold Markers */}
              <div className="relative w-full flex justify-between text-[10px] text-slate-400 font-semibold mt-1 whitespace-nowrap">
                <span>0%</span>
                <span className="text-center">
                  <span className="font-bold text-amber-700">Tier 1</span> (≤60%)
                </span>
                <span className="text-center">
                  <span className="font-bold text-sky-700">Tier 2</span> (60.01-75%)
                </span>
                <span className="text-right">
                  <span className="font-bold text-emerald-700">Tier 3</span> (≥75.01%)
                </span>
              </div>
            </div>

            {/* Next Tier Upgrade Guidance Banner */}
            {summary.nextTierNeeded ? (
              <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start sm:items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                  <span>
                    อีกเพียง{' '}
                    <strong className="text-amber-950 font-black underline decoration-amber-400">
                      {summary.nextTierNeeded.additionalInsuredNeeded} คัน
                    </strong>{' '}
                    เพื่อเลื่อนขั้นสู่ <strong>Tier {summary.nextTierNeeded.nextTier}</strong> (เป้า{' '}
                    {summary.nextTierNeeded.targetPercent}%)
                  </span>
                </div>
                {summary.nextTierNeeded.potentialCommissionIncrease > 0 && (
                  <span className="text-[10.5px] font-bold bg-amber-200/70 text-amber-950 px-2 py-0.5 rounded-lg border border-amber-300 whitespace-nowrap">
                    ปลดล็อกเงินเพิ่ม +฿{summary.nextTierNeeded.potentialCommissionIncrease.toLocaleString()} บ.
                  </span>
                )}
              </div>
            ) : summary.totalDeliveredContracts > 0 ? (
              <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-bold">
                  ยอดเยี่ยมมาก! คุณบรรลุ Tier 3 สูงสุดแล้ว ได้รับอัตราจ่ายค่าแนะนำสูงสุดทุกแผน (สูงสุด 550 บ./คัน)
                </span>
              </div>
            ) : null}
          </div>

          {/* Breakdown Table: ปรับตารางใหม่ให้พอดี ไม่ตกบรรทัด อ่านง่าย เป็นระเบียบ */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 space-y-3">
            <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1">
              <h4 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5 min-w-0">
                <FileSpreadsheet className="w-4 h-4 text-slate-600 shrink-0" />
                <span className="truncate">สรุปยอดขายแยกตามแผนประกัน</span>
              </h4>
              <span className="text-[10.5px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 self-start xs:self-auto shrink-0 whitespace-nowrap">
                อัตราจ่ายตาม Tier {summary.tier}
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 text-[11px] sm:text-xs">
                    <th className="py-2.5 px-3">แผนความคุ้มครอง</th>
                    <th className="py-2.5 px-2.5 text-center">จำนวนสัญญา</th>
                    <th className="py-2.5 px-2.5 text-right">อัตรา/คัน</th>
                    <th className="py-2.5 px-3 text-right font-black">รวมเงิน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* PA 1, 2, 3 Years */}
                  {([1, 2, 3] as InsuranceYears[]).map((y) => {
                    const row = summary.breakdown.pa[y];
                    return (
                      <tr
                        key={`pa-${y}`}
                        className={row.count > 0 ? 'bg-emerald-50/30 font-medium' : 'text-slate-500'}
                      >
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[9.5px] font-bold shrink-0">
                              PA
                            </span>
                            <span className="font-semibold text-slate-800">
                              แผนปกติ ({y} ปี)
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-2.5 text-center font-bold text-slate-800">
                          {row.count > 0 ? `${row.count} คัน` : '-'}
                        </td>
                        <td className="py-2 px-2.5 text-right text-slate-600">฿{row.unitRate}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">
                          {row.total > 0 ? `฿${row.total.toLocaleString()}` : '0'}
                        </td>
                      </tr>
                    );
                  })}

                  {/* PA PLUS 1, 2, 3 Years */}
                  {([1, 2, 3] as InsuranceYears[]).map((y) => {
                    const row = summary.breakdown.pa_plus[y];
                    return (
                      <tr
                        key={`pa-plus-${y}`}
                        className={row.count > 0 ? 'bg-indigo-50/30 font-medium' : 'text-slate-500'}
                      >
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block px-1.5 py-0.2 rounded-md bg-indigo-100 text-indigo-800 text-[9.5px] font-bold shrink-0">
                              PA+
                            </span>
                            <span className="font-semibold text-slate-800">
                              แผนพลัส ({y} ปี)
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-2.5 text-center font-bold text-slate-800">
                          {row.count > 0 ? `${row.count} คัน` : '-'}
                        </td>
                        <td className="py-2 px-2.5 text-right text-slate-600">฿{row.unitRate}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">
                          {row.total > 0 ? `฿${row.total.toLocaleString()}` : '0'}
                        </td>
                      </tr>
                    );
                  })}

                  {/* No Insurance */}
                  <tr className="text-slate-400 bg-slate-50/40">
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block px-1.5 py-0.2 rounded-md bg-slate-200 text-slate-600 text-[9.5px] font-semibold shrink-0">
                          -
                        </span>
                        <span>ไม่รับประกัน</span>
                      </div>
                    </td>
                    <td className="py-2 px-2.5 text-center">
                      {summary.breakdown.none.count > 0 ? `${summary.breakdown.none.count} คัน` : '-'}
                    </td>
                    <td className="py-2 px-2.5 text-right">0 ฿</td>
                    <td className="py-2 px-3 text-right">0</td>
                  </tr>

                  {/* Grand Total Row */}
                  <tr className="bg-emerald-100/60 font-black text-slate-900 border-t-2 border-emerald-300">
                    <td className="py-2.5 px-3 text-emerald-950 font-bold">
                      รวมค่าแนะนำทั้งสิ้น
                    </td>
                    <td className="py-2.5 px-2.5 text-center text-emerald-950 font-bold">
                      {summary.totalInsuredContracts} / {summary.totalDeliveredContracts} คัน
                    </td>
                    <td className="py-2.5 px-2.5 text-right text-emerald-900 font-semibold">
                      Tier {summary.tier}
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-900 text-xs sm:text-sm font-black">
                      ฿{summary.totalCommissionBaht.toLocaleString()} บ.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* List of Approved & Delivered Cases for Transparency (ปรับการตัดบรรทัดและวันที่ให้ชัดเจน) */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <h4 className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                  รายชื่อสัญญาที่นำมาคำนวณ ({summary.cases.length} เคส)
                </h4>
              </div>
              {onOpenSavedCases && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    onOpenSavedCases();
                  }}
                  className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer"
                >
                  <span>จัดการเคส</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            {summary.cases.length === 0 ? (
              <div className="py-8 px-4 text-center rounded-2xl bg-slate-50/70 border border-dashed border-slate-200 space-y-2">
                <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <Car className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-slate-700">
                  ยังไม่พบเคสที่มีสถานะ "อนุมัติและรับรถแล้ว" ในงวดนี้
                </div>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  ระบบจะดึงเคสที่สถานะอนุมัติ (Approved) และรับรถแล้ว (Delivered)
                  จากเมนูเคสที่บันทึกไว้มาคำนวณค่าแนะนำให้โดยอัตโนมัติ
                </p>
                <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                  {onOpenSavedCases && (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('selection');
                        onOpenSavedCases();
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                    >
                      <span>เปิดดูรายการเคสที่บันทึกไว้</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSeedDemoCases}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>โหลดเคสตัวอย่างสำหรับทดสอบ</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {summary.cases.map(({ record, isInsured, planType, insuranceYears, commissionAmount }) => {
                  const effectiveDate = getCaseEffectiveDate(record);
                  const shortDate = formatShortThaiDate(effectiveDate);
                  return (
                    <div
                      key={record.id}
                      className="p-2.5 sm:p-3 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/60 hover:bg-slate-50/90 transition-colors flex items-center justify-between gap-2.5 text-xs"
                    >
                      {/* Left: Customer name & Bike info & Date without overflowing or cutting off */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 truncate max-w-[130px] xs:max-w-[190px]">
                            {record.customerName || 'คุณลูกค้า'}
                          </span>
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 font-semibold px-1.5 py-0.2 rounded-full border border-emerald-200 shrink-0 whitespace-nowrap">
                            รับรถแล้ว
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="truncate max-w-[120px] xs:max-w-[170px] text-slate-600">
                            {record.bikeModelName || record.bikeModelCode || 'รถจักรยานยนต์'}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-400 shrink-0 whitespace-nowrap text-[10.5px]">
                            {shortDate}
                          </span>
                        </div>
                      </div>

                      {/* Right: Insurance Plan badge and Commission */}
                      <div className="text-right shrink-0">
                        <div className="flex items-center justify-end">
                          {isInsured ? (
                            <span
                              className={`text-[9.5px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                                planType === 'pa_plus'
                                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {planType === 'pa_plus' ? `PA+ (${insuranceYears}ปี)` : `PA (${insuranceYears}ปี)`}
                            </span>
                          ) : (
                            <span className="text-[9.5px] sm:text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 whitespace-nowrap">
                              ไม่ทำประกัน
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs font-black whitespace-nowrap">
                          {isInsured ? (
                            <span className="text-emerald-700">+฿{commissionAmount}</span>
                          ) : (
                            <span className="text-slate-400">฿0</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
