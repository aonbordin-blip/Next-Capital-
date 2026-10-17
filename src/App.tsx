/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Bike,
  HelpCircle,
  FileText,
  Table,
  Check,
  Sparkles,
  Smartphone,
  Monitor,
  ChevronDown,
  Info,
  ShieldAlert,
  ShieldCheck,
  Receipt,
  Download,
  Printer,
  UserCheck,
} from 'lucide-react';
import {
  PROPOSALS,
  INSURANCE_PLANS,
  calculateLease,
  getTermComparisons,
  formatBaht,
  cleanPlanNameForLine,
} from './data/proposals';
import { ProposalKey, DownMode, BikePreset, InsurancePlan, InsuranceYears } from './types';
import { ProposalInfoModal } from './components/ProposalInfoModal';
import { ProposalSelectModal } from './components/ProposalSelectModal';
import { BikePresetsModal } from './components/BikePresetsModal';
import { QuotationModal } from './components/QuotationModal';
import { AmortizationModal } from './components/AmortizationModal';
import { TermComparisonTable } from './components/TermComparisonTable';
import { NextCapitalLogo } from './components/NextCapitalLogo';
import { InsuranceComparisonModal } from './components/InsuranceComparisonModal';
import { InsuranceDocModal } from './components/InsuranceDocModal';
import { InstallAppBanner } from './components/InstallAppBanner';

export default function App() {
  // Form states
  const [proposalKey, setProposalKey] = useState<ProposalKey>('small_bike');
  const [vehiclePrice, setVehiclePrice] = useState<number>(65000);
  const [downMode, setDownMode] = useState<DownMode>('amount');
  const [downValue, setDownValue] = useState<number>(10000);
  const [term, setTerm] = useState<number>(36);

  // Group PA Insurance Protection states
  const [insurancePlan, setInsurancePlan] = useState<InsurancePlan>('none');
  const [insuranceYears, setInsuranceYears] = useState<InsuranceYears>(1);
  const [showInsuranceModal, setShowInsuranceModal] = useState<boolean>(false);

  // Additional options (dealer on-delivery fees)
  const [includeDeliveryFees, setIncludeDeliveryFees] = useState<boolean>(false);
  const [registrationFee, setRegistrationFee] = useState<number>(1500); // พรบ.+ทะเบียน
  const [theftInsuranceFee, setTheftInsuranceFee] = useState<number>(2500); // ประกันรถหาย

  // Selected preset metadata
  const [selectedBike, setSelectedBike] = useState<BikePreset | null>(null);

  // Officer / Representative Information (ชื่อและโค้ดเจ้าหน้าที่)
  const [officerName, setOfficerName] = useState<string>(() => {
    try {
      return localStorage.getItem('ncap_officer_name') ?? 'บดินทร์';
    } catch {
      return 'บดินทร์';
    }
  });
  const [officerCode, setOfficerCode] = useState<string>(() => {
    try {
      return localStorage.getItem('ncap_officer_code') ?? '6683';
    } catch {
      return '6683';
    }
  });

  const handleOfficerNameChange = (val: string) => {
    setOfficerName(val);
    try {
      localStorage.setItem('ncap_officer_name', val);
    } catch {
      // ignore
    }
  };

  const handleOfficerCodeChange = (val: string) => {
    setOfficerCode(val);
    try {
      localStorage.setItem('ncap_officer_code', val);
    } catch {
      // ignore
    }
  };

  const officerDisplay =
    officerName && officerCode
      ? `${officerName} (${officerCode})`
      : officerName || (officerCode ? `โค้ด ${officerCode}` : 'ผู้เสนอราคา / เจ้าหน้าที่');

  // Modals
  const [showProposalSelector, setShowProposalSelector] = useState<boolean>(false);
  const [showProposalInfo, setShowProposalInfo] = useState<boolean>(false);
  const [showBikePresets, setShowBikePresets] = useState<boolean>(false);
  const [showQuotation, setShowQuotation] = useState<boolean>(false);
  const [showSchedule, setShowSchedule] = useState<boolean>(false);
  const [showInsuranceDoc, setShowInsuranceDoc] = useState<boolean>(false);

  // Layout view mode (Mobile simulator frame vs Fullscreen Dashboard)
  const [viewMode, setViewMode] = useState<'mobile' | 'dashboard'>('mobile');
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false);

  // When proposal changes, adjust valid terms and default down mode
  const handleProposalChange = (newKey: ProposalKey) => {
    setProposalKey(newKey);
    const newProposal = PROPOSALS[newKey];

    // Set default term if current term is invalid
    if (!newProposal.validTerms.includes(term)) {
      setTerm(newProposal.validTerms[0]);
    }

    // Set appropriate down mode and value matching user logic
    if (newKey === 'honda_yamaha') {
      setDownMode('percent');
      setDownValue(15);
    } else {
      setDownMode('amount');
      setDownValue(newProposal.defaultDownValue);
    }
  };

  // When selecting a preset motorcycle
  const handleSelectBike = (bike: BikePreset) => {
    setSelectedBike(bike);
    setVehiclePrice(bike.price);
    handleProposalChange(bike.proposalKey);

    if (bike.proposalKey === 'honda_yamaha') {
      setDownMode('percent');
      setDownValue(bike.defaultDownPercent || 15);
    } else {
      const defaultDown = Math.round(bike.price * ((bike.defaultDownPercent || 15) / 100));
      setDownMode('amount');
      setDownValue(defaultDown);
    }
  };

  // Quick down payment pill clicks
  const handleQuickDownPercent = (pct: number) => {
    setDownMode('percent');
    setDownValue(pct);
  };

  const handleQuickDownAmount = (amt: number) => {
    setDownMode('amount');
    setDownValue(amt);
  };

  // Perform hire purchase calculation (including insurance premium in vehicle price)
  const currentCalculation = calculateLease(
    proposalKey,
    vehiclePrice,
    downValue,
    downMode,
    term,
    includeDeliveryFees ? registrationFee : 0,
    includeDeliveryFees ? theftInsuranceFee : 0,
    insurancePlan,
    insuranceYears
  );

  // Term comparisons
  const comparisons = getTermComparisons(
    proposalKey,
    vehiclePrice,
    downValue,
    downMode,
    term,
    insurancePlan,
    insuranceYears
  );

  // Copy quick summary to clipboard
  const handleQuickCopy = async () => {
    const summary = `🛵 Next Capital MotoLease เสนอราคาค่างวด
บริษัท: บมจ. เน็กซ์ แคปปิตอล (NCAP)
👨‍💼 ผู้เสนอราคา: ${officerDisplay}
ข้อเสนอ: ${currentCalculation.proposalName} (${currentCalculation.proposalCode})
ราคารถตัวเปล่า: ${formatBaht(currentCalculation.baseVehiclePrice)}
เงินดาวน์: ${formatBaht(currentCalculation.downAmount)} (${currentCalculation.downPercent.toFixed(1)}%)
ยอดจัดเฉพาะตัวรถ: ${formatBaht(currentCalculation.vehicleFinanceAmount)}
${
  currentCalculation.insuranceTotalWithVat > 0
    ? `🛡️ ประกันภัย: ${cleanPlanNameForLine(currentCalculation.insurancePlanName)}
   • ค่าเบี้ยประกัน: ${formatBaht(currentCalculation.insuranceBasePremium)}
   • ภาษี VAT 7%: ${formatBaht(currentCalculation.insuranceVat, true)}
   • เบี้ยรวมภาษี 7%: ${formatBaht(currentCalculation.insuranceTotalWithVat, true)}\n`
    : ''
}💳 ยอดจัดไฟแนนซ์รวม: ${formatBaht(currentCalculation.financeAmount, true)}
⏱️ ผ่อน: ${currentCalculation.term} งวด | ดอกเบี้ย: ${currentCalculation.rateDisplayText}
💵 ดอกเบี้ยต่อเดือน: ${formatBaht(currentCalculation.monthlyInterest, true)} /เดือน
💵 ดอกเบี้ยรวมทั้งสัญญา: ${formatBaht(currentCalculation.totalInterest, true)}
⭐ ค่างวดต่อเดือน: ${formatBaht(currentCalculation.monthlyInstallment)} /เดือน (รวม VAT 7%)
รวมทั้งสัญญา: ${formatBaht(currentCalculation.totalWithVat, true)}`;

    try {
      await navigator.clipboard.writeText(summary);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      // ignore
    }
  };

  const currentProposal = PROPOSALS[proposalKey];
  const activeInsurancePlan = insurancePlan !== 'none' ? INSURANCE_PLANS[insurancePlan] : null;

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-100 via-indigo-50/40 to-amber-50/50 text-slate-800 flex flex-col justify-center items-center p-0 sm:p-4 select-none">
      {/* Dynamic Ambient Background Glowing Blobs for Glassmorphism Depth */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Next Capital Royal Blue Orb */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-blue-500/20 blur-[100px] animate-blob-1" />
        {/* Golden Amber Accent Orb */}
        <div className="absolute top-1/3 -right-20 w-80 h-80 rounded-full bg-amber-400/25 blur-[90px] animate-blob-2" />
        {/* Indigo Ambient Orb */}
        <div className="absolute -bottom-28 left-1/4 w-96 h-96 rounded-full bg-indigo-500/20 blur-[110px] animate-blob-3" />
        {/* Subtle geometric dot grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `radial-gradient(#1c449c 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      {/* Top Floating View Mode Switcher on Desktop */}
      <div className="no-print hidden sm:flex items-center gap-2 mb-3 bg-white/60 backdrop-blur-xl px-3 py-1.5 rounded-full border border-white/80 shadow-[0_4px_20px_-4px_rgba(28,68,156,0.1)] text-xs z-10">
        <span className="text-slate-500 font-medium">มุมมอง:</span>
        <button
          onClick={() => setViewMode('mobile')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-medium transition-all ${
            viewMode === 'mobile'
              ? 'bg-gradient-to-r from-blue-700 to-indigo-600 text-white shadow-sm shadow-blue-700/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" /> จำลองมือถือ
        </button>
        <button
          onClick={() => setViewMode('dashboard')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-medium transition-all ${
            viewMode === 'dashboard'
              ? 'bg-gradient-to-r from-blue-700 to-indigo-600 text-white shadow-sm shadow-blue-700/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Monitor className="w-3.5 h-3.5" /> แดชบอร์ดเต็มจอ
        </button>
      </div>

      {/* Main Container - Frosted Glass Frame */}
      <div
        className={`w-full transition-all duration-300 z-10 ${
          viewMode === 'mobile'
            ? 'max-w-[440px] h-screen sm:h-[900px] sm:max-h-[940px] sm:rounded-[36px]'
            : 'max-w-5xl h-auto min-h-[750px] sm:rounded-[32px] my-4'
        } glass-container-frame flex flex-col relative overflow-hidden`}
      >
        {/* Top Specular Highlight Line */}
        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent opacity-90 pointer-events-none" />

        {/* Company Header - Next Capital */}
        <div className="flex justify-between items-center px-5 py-2.5 border-b border-white/60 bg-gradient-to-r from-white/70 via-blue-50/50 to-amber-50/40 backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <NextCapitalLogo size={28} />
            <div className="flex flex-col">
              <span className="font-extrabold text-xs tracking-tight text-slate-900 uppercase">
                Next Capital
              </span>
              <span className="text-[10px] text-slate-500 font-medium -mt-0.5">
                บมจ. เน็กซ์ แคปปิตอล
              </span>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100/80 text-blue-900 border border-blue-200/70 font-mono tracking-wider shadow-xs">
            NCAP
          </span>
        </div>

        {/* App Header */}
        <header className="px-5 py-3 border-b border-white/50 bg-white/40 backdrop-blur-md flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-lg font-bold gradient-header-text tracking-tight">
                MotoLease Calc
              </h1>
              <span className="text-[10px] font-bold bg-amber-100/90 text-amber-800 border border-amber-200/70 px-1.5 py-0.2 rounded-full">
                2569
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-gradient-to-r from-blue-50 to-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-full shadow-2xs">
                ✨ by Bordin 6683
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              ระบบคำนวณค่างวดตามใบเสนอราคา (Proposal)
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowBikePresets(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 text-white rounded-xl text-xs font-semibold shadow-sm shadow-blue-800/20 hover:opacity-95 active:scale-95 transition-all cursor-pointer"
              title="เลือกรุ่นรถยอดนิยม"
            >
              <Bike className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">เลือกรุ่นรถ</span>
            </button>
            <button
              onClick={() => setShowProposalInfo(true)}
              className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-white/70 rounded-xl transition-colors cursor-pointer"
              title="ดูรายละเอียดเกณฑ์ Proposal"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* In-App PWA Install Banner */}
        <div className="pt-2">
          <InstallAppBanner />
        </div>

        {/* Selected Bike Banner if active */}
        {selectedBike && (
          <div className="px-5 py-2 bg-gradient-to-r from-blue-50/80 via-white/60 to-amber-50/60 border-b border-white/60 flex items-center justify-between text-xs backdrop-blur-md">
            <div className="flex items-center gap-1.5 truncate">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              <span className="text-slate-500 font-medium">รุ่นที่เลือก:</span>
              <span className="font-bold text-blue-950 truncate">
                {selectedBike.name}
              </span>
            </div>
            <button
              onClick={() => setSelectedBike(null)}
              className="text-[11px] text-slate-400 hover:text-rose-600 ml-2 font-medium cursor-pointer"
            >
              ล้าง
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <main
          className={`flex-1 overflow-y-auto px-5 py-4 space-y-3.5 ${
            viewMode === 'dashboard' ? 'grid grid-cols-1 lg:grid-cols-12 gap-5 space-y-0' : ''
          }`}
        >
          {/* Left Column / Input Controls */}
          <div
            className={`space-y-3.5 ${
              viewMode === 'dashboard' ? 'lg:col-span-6 xl:col-span-5' : ''
            }`}
          >
            {/* Input Form Card - Frosted Glass */}
            <div className="glass-card-primary rounded-2xl p-4 space-y-3 relative overflow-hidden">
              {/* Officer Name & Code Card (ช่องใส่ชื่อและโค้ดของเจ้าหน้าที่) */}
              <div className="p-3 rounded-xl bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white/80 border border-blue-200/80 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-slate-800 font-bold flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-blue-700 flex-shrink-0" />
                    <span>ข้อมูลเจ้าหน้าที่ / ผู้เสนอราคา</span>
                  </label>
                  <span className="text-[9.5px] font-bold text-blue-700 bg-white/90 px-2 py-0.5 rounded-full border border-blue-200 shadow-2xs">
                    ลงชื่อในใบเสนอราคา
                  </span>
                </div>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-7 sm:col-span-8">
                    <label className="block text-[10px] text-slate-500 font-medium mb-1">
                      ชื่อเจ้าหน้าที่
                    </label>
                    <input
                      type="text"
                      value={officerName}
                      onChange={(e) => handleOfficerNameChange(e.target.value)}
                      placeholder="ใส่ชื่อเจ้าหน้าที่"
                      className="w-full glass-input-field rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-bold outline-none"
                    />
                  </div>
                  <div className="col-span-5 sm:col-span-4">
                    <label className="block text-[10px] text-slate-500 font-medium mb-1">
                      โค้ด / รหัส
                    </label>
                    <input
                      type="text"
                      value={officerCode}
                      onChange={(e) => handleOfficerCodeChange(e.target.value)}
                      placeholder="ใส่โค้ด"
                      className="w-full glass-input-field rounded-xl px-2.5 py-1.5 text-xs text-blue-900 font-bold font-mono outline-none"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                  <span className="text-slate-400">แสดงในใบเสนอราคา:</span>
                  <span className="font-semibold text-blue-950 truncate">
                    ( {officerDisplay} )
                  </span>
                </div>
              </div>

              {/* Proposal Select */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] text-slate-600 font-semibold flex items-center gap-1">
                    เลือกประเภทข้อเสนอ (Proposal) *
                  </label>
                  <button
                    onClick={() => setShowProposalInfo(true)}
                    className="text-[10px] text-blue-700 hover:underline flex items-center gap-0.5 font-medium cursor-pointer"
                  >
                    <Info className="w-3 h-3" /> ดูเงื่อนไข
                  </button>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    id="proposal-select-trigger"
                    onClick={() => setShowProposalSelector(true)}
                    className="w-full glass-input-field rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold outline-none flex items-center justify-between cursor-pointer hover:border-blue-400 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="truncate text-xs font-bold text-slate-900">
                        {currentProposal.name}
                      </span>
                      <span className="font-mono text-[10px] text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60 whitespace-nowrap flex-shrink-0">
                        ({currentProposal.code})
                      </span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  </button>

                  {/* Hidden accessibility select synced with state */}
                  <select
                    id="proposal-select"
                    value={proposalKey}
                    onChange={(e) => handleProposalChange(e.target.value as ProposalKey)}
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <option value="small_bike">Small Bike (0082/2568)</option>
                    <option value="top_small">Top Small (0082/2568)</option>
                    <option value="aec">AEC (0093/2568)</option>
                    <option value="fazzio">FAZZIO (0376/2569)</option>
                    <option value="vespa">VESPA/LAMBRETTA (0351/2569)</option>
                    <option value="honda_yamaha">Honda/Yamaha (0098/2569)</option>
                    <option value="second_hand">รถมือสอง 2ND (0080/2568)</option>
                  </select>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                  <span>{currentProposal.category}</span>
                  <span className="font-mono text-blue-700 font-bold">
                    {currentProposal.code}
                  </span>
                </div>
              </div>

              {/* Price and Base Price Display */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] text-slate-600 font-semibold">
                    ราคารถตัวเปล่า (บาท) *
                  </label>
                  {currentCalculation.insuranceTotalWithVat > 0 && (
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      + ประกันรวม VAT: {formatBaht(currentCalculation.insuranceTotalWithVat, true)}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={vehiclePrice || ''}
                  onChange={(e) => setVehiclePrice(Number(e.target.value))}
                  className="w-full glass-input-field rounded-xl px-3 py-2 text-xs text-slate-900 font-bold outline-none"
                  placeholder="เช่น 65000"
                />
              </div>

              {/* PA Insurance Protection Selection (แผน A vs แผน B) */}
              <div className="p-3 rounded-xl bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-amber-50/50 border border-blue-200/60 space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-700" />
                    <span className="text-xs font-bold text-slate-800">
                      ความคุ้มครองประกันภัย (Group PA)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowInsuranceModal(true)}
                      className="text-[10px] font-bold text-blue-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Info className="w-3 h-3" /> เปรียบเทียบ
                    </button>
                  </div>
                </div>

                {/* Plan Selector Buttons */}
                <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setInsurancePlan('none')}
                    className={`py-1.5 px-2 rounded-lg font-semibold transition-all cursor-pointer ${
                      insurancePlan === 'none'
                        ? 'bg-slate-700 text-white shadow-xs'
                        : 'glass-pill text-slate-600 hover:bg-white'
                    }`}
                  >
                    ไม่รับประกัน
                  </button>
                  <button
                    type="button"
                    onClick={() => setInsurancePlan('plan_a')}
                    className={`py-1.5 px-2 rounded-lg font-bold transition-all cursor-pointer ${
                      insurancePlan === 'plan_a'
                        ? 'bg-blue-700 text-white shadow-xs ring-2 ring-blue-700/20'
                        : 'glass-pill text-blue-900 hover:bg-white'
                    }`}
                  >
                    แผน A (PA)
                  </button>
                  <button
                    type="button"
                    onClick={() => setInsurancePlan('plan_b')}
                    className={`py-1.5 px-2 rounded-lg font-bold transition-all cursor-pointer relative ${
                      insurancePlan === 'plan_b'
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-xs ring-2 ring-amber-500/20'
                        : 'glass-pill text-amber-900 hover:bg-white'
                    }`}
                  >
                    แผน B (PA+)
                  </button>
                </div>

                {/* If Plan A or Plan B Selected: Years Selection & Price Breakdown */}
                {insurancePlan !== 'none' && activeInsurancePlan && (
                  <div className="pt-1.5 border-t border-slate-200/60 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-600 font-medium">เลือกระยะเวลาคุ้มครอง:</span>
                      <span className="text-[10px] text-blue-800 font-semibold">
                        โครงการ PA advised by LOCKTON
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                      {([1, 2, 3] as InsuranceYears[]).map((y) => (
                        <button
                          key={y}
                          type="button"
                          onClick={() => setInsuranceYears(y)}
                          className={`py-1.5 px-2 rounded-lg font-bold transition-all cursor-pointer ${
                            insuranceYears === y
                              ? 'bg-blue-900 text-white shadow-xs'
                              : 'bg-white/80 border border-slate-200 text-slate-700 hover:bg-white'
                          }`}
                        >
                          <div>{y} ปี</div>
                          <div className="text-[10px] font-normal opacity-90">
                            +{formatBaht(activeInsurancePlan.premiums[y])}
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="p-2.5 rounded-xl bg-white/80 border border-blue-200 text-[11px] text-blue-950 space-y-1">
                      <div className="flex justify-between items-center font-bold">
                        <span>{currentCalculation.insurancePlanName}:</span>
                        <span className="text-blue-700 font-extrabold">
                          +{formatBaht(currentCalculation.insuranceTotalWithVat, true)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                        <span>เบี้ยสุทธิ {formatBaht(currentCalculation.insuranceBasePremium)} + VAT 7% ({formatBaht(currentCalculation.insuranceVat, true)})</span>
                        <span className="text-blue-800 font-medium">รวมในยอดจัดไฟแนนซ์</span>
                      </div>
                    </div>

                  </div>
                )}
              </div>

              {/* Down Payment Section */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] text-slate-600 font-semibold">
                    เงินดาวน์ {downMode === 'percent' ? '(%)' : '(บาท)'} *
                  </label>
                  {/* Toggle Mode */}
                  <button
                    type="button"
                    onClick={() => {
                      const effectivePrice = currentCalculation.baseVehiclePrice;
                      if (downMode === 'amount') {
                        const pct =
                          effectivePrice > 0 ? (downValue / effectivePrice) * 100 : 15;
                        setDownMode('percent');
                        setDownValue(Math.round(pct));
                      } else {
                        const amt = (effectivePrice * downValue) / 100;
                        setDownMode('amount');
                        setDownValue(Math.round(amt));
                      }
                    }}
                    className="text-[10px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50/80 px-1.5 py-0.5 rounded border border-blue-200/50 transition-colors cursor-pointer"
                    title="สลับโหมดใส่เป็นบาท หรือ %"
                  >
                    สลับเป็น {downMode === 'amount' ? '%' : 'บาท'}
                  </button>
                </div>
                <input
                  type="number"
                  min="0"
                  max={downMode === 'percent' ? 100 : currentCalculation.baseVehiclePrice}
                  step={downMode === 'percent' ? 1 : 1000}
                  value={downValue || ''}
                  onChange={(e) => setDownValue(Number(e.target.value))}
                  className="w-full glass-input-field rounded-xl px-3 py-2 text-xs text-slate-900 font-bold outline-none"
                />
              </div>

              {/* Quick Down Payment Chips */}
              <div className="pt-0.5">
                <div className="text-[10px] text-slate-400 mb-1 flex justify-between font-medium">
                  <span>เลือกเงินดาวน์ด่วน:</span>
                  <span className="font-semibold text-slate-700">
                    คิดเป็น {currentCalculation.downPercent.toFixed(1)}% (
                    {formatBaht(currentCalculation.downAmount)})
                  </span>
                </div>
                {downMode === 'amount' ? (
                  <div className="flex gap-1 overflow-x-auto pb-1 text-[10px]">
                    {[0, 5000, 10000, 15000, 20000, 25000, 35000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleQuickDownAmount(amt)}
                        className={`px-2 py-1 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer ${
                          downValue === amt
                            ? 'bg-gradient-to-r from-blue-700 to-indigo-600 text-white shadow-xs'
                            : 'glass-pill text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {amt === 0 ? 'ฟรีดาวน์' : `฿${amt.toLocaleString()}`}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-1 overflow-x-auto pb-1 text-[10px]">
                    {[0, 10, 15, 20, 25, 30, 40].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handleQuickDownPercent(pct)}
                        className={`px-2 py-1 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer ${
                          downValue === pct
                            ? 'bg-gradient-to-r from-blue-700 to-indigo-600 text-white shadow-xs'
                            : 'glass-pill text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Term and Rate Display */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-600 font-semibold mb-1">
                    ระยะเวลาผ่อน (งวด) *
                  </label>
                  <div className="relative">
                    <select
                      id="term-select"
                      value={term}
                      onChange={(e) => setTerm(Number(e.target.value))}
                      className="w-full appearance-none glass-input-field rounded-xl px-3 py-2 text-xs text-slate-900 font-bold outline-none pr-7 cursor-pointer"
                    >
                      {currentProposal.validTerms.map((t) => (
                        <option key={t} value={t}>
                          {t} งวด ({(t / 12).toFixed(t % 12 === 0 ? 0 : 1)} ปี)
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-600 font-semibold mb-1">
                    อัตราดอกเบี้ยที่ใช้
                  </label>
                  <input
                    type="text"
                    value={currentCalculation.rateDisplayText}
                    readOnly
                    className="w-full bg-blue-50/70 border border-blue-200/70 rounded-xl px-2.5 py-2 text-[11px] text-blue-900 font-bold outline-none cursor-default truncate shadow-inner-sm"
                  />
                </div>
              </div>

              {/* Delivery Day Extra Costs Accordion */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setIncludeDeliveryFees(!includeDeliveryFees)}
                  className="w-full flex items-center justify-between py-1.5 px-2.5 glass-pill rounded-xl text-[11px] font-medium text-slate-600 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-blue-700" />
                    ค่าใช้จ่ายวันออกรถ (พ.ร.บ. / ทะเบียน / ประกันรถหาย)
                  </span>
                  <span className="text-[10px] text-blue-700 font-bold">
                    {includeDeliveryFees ? 'ซ่อน' : '+ เพิ่ม'}
                  </span>
                </button>

                {includeDeliveryFees && (
                  <div className="mt-2 p-2.5 bg-white/60 backdrop-blur-md rounded-xl border border-white/80 text-xs space-y-2 shadow-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 font-medium">
                          ค่าจดทะเบียน + พ.ร.บ.
                        </label>
                        <input
                          type="number"
                          value={registrationFee}
                          onChange={(e) => setRegistrationFee(Number(e.target.value))}
                          className="w-full glass-input-field px-2 py-1 rounded-lg text-xs font-semibold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-medium">
                          ประกันรถหาย (1-2 ปี)
                        </label>
                        <input
                          type="number"
                          value={theftInsuranceFee}
                          onChange={(e) => setTheftInsuranceFee(Number(e.target.value))}
                          className="w-full glass-input-field px-2 py-1 rounded-lg text-xs font-semibold"
                        />
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 flex justify-between pt-1 border-t border-slate-200/50">
                      <span>รวมค่าใช้จ่ายส่วนเพิ่ม:</span>
                      <span className="font-bold text-slate-800">
                        {formatBaht(registrationFee + theftInsuranceFee)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons: 2 beautiful, modern primary action buttons */}
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 1. Coverage Plan Button */}
                <button
                  type="button"
                  onClick={() => setShowInsuranceDoc(true)}
                  className="group relative overflow-hidden bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 hover:from-blue-600 hover:via-indigo-500 hover:to-blue-700 active:scale-[0.98] text-white py-2.5 px-3.5 rounded-xl font-bold shadow-md shadow-blue-800/20 transition-all flex items-center justify-between cursor-pointer border border-blue-500/30"
                  title="ดาวน์โหลดแผนความคุ้มครองประกันภัย (Group PA)"
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <ShieldCheck className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div>
                      <div className="text-xs font-bold leading-tight flex items-center gap-1.5">
                        แผนความคุ้มครอง
                        <span className="text-[10px] bg-white/20 text-blue-100 px-1.5 py-0.2 rounded font-semibold">
                          รูปภาพ
                        </span>
                      </div>
                      <div className="text-[10.5px] text-blue-100/80 font-normal leading-tight mt-0.5">
                        {cleanPlanNameForLine(currentCalculation.insurancePlanName)} ({insuranceYears} ปี)
                      </div>
                    </div>
                  </div>
                  <Download className="w-3.5 h-3.5 text-blue-200 group-hover:translate-y-0.5 transition-transform shrink-0" />
                </button>

                {/* 2. Quotation Button */}
                <button
                  type="button"
                  onClick={() => setShowQuotation(true)}
                  className="group relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 hover:from-slate-800 hover:via-slate-700 hover:to-indigo-900 active:scale-[0.98] text-white py-2.5 px-3.5 rounded-xl font-bold shadow-md shadow-slate-900/20 transition-all flex items-center justify-between cursor-pointer border border-slate-700/50"
                  title="ดูและดาวน์โหลดใบเสนอราคาเช่าซื้อ (Quotation)"
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <FileText className="w-4.5 h-4.5 text-amber-300" />
                    </div>
                    <div>
                      <div className="text-xs font-bold leading-tight flex items-center gap-1.5">
                        ใบเสนอราคา
                        <span className="text-[10px] bg-amber-400/25 text-amber-200 px-1.5 py-0.2 rounded font-semibold">
                          รูปภาพ
                        </span>
                      </div>
                      <div className="text-[10.5px] text-slate-300 font-normal leading-tight mt-0.5">
                        งวดละ {formatBaht(currentCalculation.monthlyInstallment)} บ.
                      </div>
                    </div>
                  </div>
                  <Printer className="w-3.5 h-3.5 text-slate-400 group-hover:scale-110 transition-transform shrink-0" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column / Results & Analysis */}
          <div
            className={`space-y-3.5 ${
              viewMode === 'dashboard' ? 'lg:col-span-6 xl:col-span-7' : ''
            }`}
          >
            {/* Result Hero Card - Frosted Glassmorphism Masterpiece */}
            <div className="glass-card-hero rounded-2xl p-4 text-center relative overflow-hidden">
              {/* Proposal Code Badge & Insurance Badge */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 mb-1">
                <span className="inline-block bg-white/80 text-blue-800 border border-blue-200/70 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide shadow-xs">
                  {currentCalculation.proposalCode}
                </span>
                {currentCalculation.insurancePremium > 0 && (
                  <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200/80 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide shadow-xs">
                    <ShieldCheck className="w-3 h-3 text-amber-600" />
                    {currentCalculation.insurancePlanName}
                  </span>
                )}
                {currentCalculation.minInterestApplied && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-rose-700 bg-rose-50/90 border border-rose-200 px-2 py-0.5 rounded-full font-semibold">
                    <ShieldAlert className="w-3 h-3" /> ดอกเบี้ยขั้นต่ำ
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-500 font-semibold tracking-wide">
                ค่างวดต่อเดือน (รวมภาษีมูลค่าเพิ่ม 7%)
              </p>

              {/* Monthly Installment Highlight with Gradient Accent */}
              <div className="text-3xl sm:text-4xl font-extrabold text-[#1C449C] my-1 tracking-tight drop-shadow-xs">
                {formatBaht(currentCalculation.monthlyInstallment)}
                <span className="text-xs font-normal text-slate-500 ml-1">/เดือน</span>
              </div>

              <p className="text-[10px] text-slate-500 font-medium max-w-xs mx-auto truncate">
                {currentCalculation.remarkText}
              </p>

              {/* Summary Grid - Translucent Glass Chips */}
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-200/60 text-left text-[11px]">
                <div className="bg-white/70 backdrop-blur-md p-2 rounded-xl border border-white/80 shadow-xs">
                  <div className="text-[10px] text-slate-400 font-medium">ยอดจัดไฟแนนซ์รวม:</div>
                  <span className="font-bold text-slate-900 text-xs">
                    {formatBaht(currentCalculation.financeAmount, true)}
                  </span>
                  {currentCalculation.insuranceTotalWithVat > 0 ? (
                    <div className="text-[9px] text-blue-700 font-semibold truncate">
                      (รถ {formatBaht(currentCalculation.vehicleFinanceAmount)} + PA+VAT {formatBaht(currentCalculation.insuranceTotalWithVat, true)})
                    </div>
                  ) : (
                    <div className="text-[9px] text-slate-500">
                      (ยอดจัดตัวรถ)
                    </div>
                  )}
                </div>
                <div className="bg-white/70 backdrop-blur-md p-2 rounded-xl border border-white/80 shadow-xs">
                  <div className="text-[10px] text-slate-400 font-medium">ดอกเบี้ยรายเดือน:</div>
                  <span className="font-bold text-slate-900 text-xs">
                    {formatBaht(currentCalculation.monthlyInterest, true)} /งวด
                  </span>
                  <div className="text-[9px] text-slate-500">
                    รวมทั้งสัญญา: {formatBaht(currentCalculation.totalInterest, true)}
                  </div>
                </div>
                <div className="bg-white/70 backdrop-blur-md p-2 rounded-xl border border-white/80 shadow-xs">
                  <div className="text-[10px] text-slate-400 font-medium">ยอดรวมทั้งสัญญา:</div>
                  <span className="font-bold text-slate-900 text-xs">
                    {formatBaht(currentCalculation.totalWithVat, true)}
                  </span>
                  <div className="text-[9px] text-slate-500">
                    (ยอดจัด + ดอกเบี้ยรวม)
                  </div>
                </div>
                <div className="bg-white/70 backdrop-blur-md p-2 rounded-xl border border-white/80 shadow-xs">
                  <div className="text-[10px] text-slate-400 font-medium">ภาษีมูลค่าเพิ่มในสัญญา (7%):</div>
                  <span className="font-bold text-slate-900 text-xs">
                    {formatBaht(currentCalculation.vatAmount, true)}
                  </span>
                  <div className="text-[9px] text-slate-500">
                    ยอดก่อน VAT: {formatBaht(currentCalculation.totalBeforeVat, true)}
                  </div>
                </div>
              </div>

              {/* Drive Away Summary if extra fees enabled */}
              {includeDeliveryFees && (
                <div className="mt-2.5 p-2.5 bg-gradient-to-r from-amber-50/90 via-orange-50/80 to-amber-100/70 border border-amber-200/80 rounded-xl text-left flex justify-between items-center text-xs backdrop-blur-md shadow-xs">
                  <div>
                    <span className="font-bold text-amber-950 text-[11px] block">
                      เงินพร้อมออกรถ (วันรับรถ):
                    </span>
                    <span className="text-[10px] text-amber-800">
                      ดาวน์ {formatBaht(currentCalculation.downAmount)} + ทะเบียน พรบ. ประกัน
                    </span>
                  </div>
                  <span className="text-sm font-extrabold text-amber-900">
                    {formatBaht(currentCalculation.totalDriveAwayCost)}
                  </span>
                </div>
              )}

              {/* Footer Actions on Result Card */}
              <div className="mt-3 pt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                <button
                  type="button"
                  onClick={() => setShowSchedule(true)}
                  className="flex items-center gap-1 text-blue-700 hover:text-blue-900 font-semibold cursor-pointer"
                >
                  <Table className="w-3.5 h-3.5" /> ตารางแจกแจงรายงวด
                </button>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowQuotation(true)}
                    className="flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" /> ใบเสนอราคาทางการ
                  </button>
                </div>
              </div>
            </div>

            {/* Term Comparisons Table */}
            <TermComparisonTable
              comparisons={comparisons}
              selectedTerm={term}
              onSelectTerm={(newTerm) => setTerm(newTerm)}
            />
          </div>
        </main>

        {/* Bottom Bar Info with Creator Credit */}
        <footer className="px-4 py-2.5 bg-white/50 border-t border-white/60 backdrop-blur-md text-[10px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-slate-600">Next Capital Public Company Limited (NCAP)</span>
          <div className="flex items-center gap-1.5 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-200/70 px-2.5 py-0.5 rounded-full shadow-2xs">
            <span className="text-[10px] text-slate-500">พัฒนาโดย</span>
            <span className="text-[10px] font-bold bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-transparent">
              by Bordin 6683
            </span>
          </div>
        </footer>
      </div>

      {/* Modals */}
      <ProposalSelectModal
        isOpen={showProposalSelector}
        onClose={() => setShowProposalSelector(false)}
        selectedKey={proposalKey}
        onSelectProposal={(key) => handleProposalChange(key)}
      />

      <ProposalInfoModal
        isOpen={showProposalInfo}
        onClose={() => setShowProposalInfo(false)}
        selectedKey={proposalKey}
        onSelectProposal={(key) => handleProposalChange(key)}
      />

      <BikePresetsModal
        isOpen={showBikePresets}
        onClose={() => setShowBikePresets(false)}
        onSelectBike={handleSelectBike}
        currentProposalKey={proposalKey}
      />

      <QuotationModal
        isOpen={showQuotation}
        onClose={() => setShowQuotation(false)}
        result={currentCalculation}
        selectedBikeName={selectedBike?.name}
        officerInfo={officerDisplay}
      />

      <AmortizationModal
        isOpen={showSchedule}
        onClose={() => setShowSchedule(false)}
        result={currentCalculation}
      />

      <InsuranceComparisonModal
        isOpen={showInsuranceModal}
        onClose={() => setShowInsuranceModal(false)}
        selectedPlan={insurancePlan}
        selectedYears={insuranceYears}
        onSelectPlan={(plan, years) => {
          setInsurancePlan(plan);
          setInsuranceYears(years);
        }}
        onOpenDoc={() => setShowInsuranceDoc(true)}
      />

      <InsuranceDocModal
        isOpen={showInsuranceDoc}
        onClose={() => setShowInsuranceDoc(false)}
        result={currentCalculation}
        selectedPlan={insurancePlan === 'none' ? 'plan_b' : insurancePlan}
        selectedYears={insuranceYears}
        selectedBikeName={selectedBike?.name}
        officerInfo={officerDisplay}
        onUpdatePlan={(plan, years) => {
          setInsurancePlan(plan);
          setInsuranceYears(years);
        }}
      />
    </div>
  );
}
