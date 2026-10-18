/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  User,
  Phone,
  Award,
  Scale,
  Lock,
  AlertTriangle,
  Share2,
  Plus,
  Minus,
  Banknote,
} from 'lucide-react';
import { AnimatedNumber } from './components/AnimatedNumber';
import { triggerHaptic } from './utils/haptics';
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
import { EirInfoModal } from './components/EirInfoModal';
import { InstallAppBanner } from './components/InstallAppBanner';
import { BikeModelCodeInput } from './components/BikeModelCodeInput';
import { MotorcycleModel, MOTORCYCLE_MODELS, findModelByCode } from './data/motorcycleModels';

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

  // Selected preset metadata & Model Code (รหัสรุ่นรถ)
  const [selectedBike, setSelectedBike] = useState<BikePreset | null>(null);
  const [bikeModelCode, setBikeModelCode] = useState<string>('');

  // Officer / Representative Information (ชื่อ โค้ด และเลขที่ใบอนุญาตนายหน้าประกันวินาศภัย)
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
  const [officerLicense, setOfficerLicense] = useState<string>(() => {
    try {
      return localStorage.getItem('ncap_officer_license') ?? '';
    } catch {
      return '';
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

  const handleOfficerLicenseChange = (val: string) => {
    setOfficerLicense(val);
    try {
      localStorage.setItem('ncap_officer_license', val);
    } catch {
      // ignore
    }
  };

  const officerDisplay =
    officerName && officerCode
      ? `${officerName} (${officerCode})`
      : officerName || (officerCode ? `โค้ด ${officerCode}` : 'ผู้เสนอราคา / เจ้าหน้าที่');

  // Customer Information (ชื่อและเบอร์โทรศัพท์ลูกค้า)
  const [customerName, setCustomerName] = useState<string>(() => {
    try {
      return localStorage.getItem('ncap_customer_name') ?? 'คุณลูกค้า';
    } catch {
      return 'คุณลูกค้า';
    }
  });
  const [customerPhone, setCustomerPhone] = useState<string>(() => {
    try {
      return localStorage.getItem('ncap_customer_phone') ?? '';
    } catch {
      return '';
    }
  });

  const handleCustomerNameChange = (val: string) => {
    setCustomerName(val);
    try {
      localStorage.setItem('ncap_customer_name', val);
    } catch {
      // ignore
    }
  };

  const handleCustomerPhoneChange = (val: string) => {
    setCustomerPhone(val);
    try {
      localStorage.setItem('ncap_customer_phone', val);
    } catch {
      // ignore
    }
  };

  const customerDisplay = customerName
    ? customerPhone
      ? `${customerName} (${customerPhone})`
      : customerName
    : customerPhone ? `โทร. ${customerPhone}` : 'คุณลูกค้า';

  // Modals
  const [showProposalSelector, setShowProposalSelector] = useState<boolean>(false);
  const [showProposalInfo, setShowProposalInfo] = useState<boolean>(false);
  const [showBikePresets, setShowBikePresets] = useState<boolean>(false);
  const [showQuotation, setShowQuotation] = useState<boolean>(false);
  const [showSchedule, setShowSchedule] = useState<boolean>(false);
  const [showInsuranceDoc, setShowInsuranceDoc] = useState<boolean>(false);
  const [showEirInfo, setShowEirInfo] = useState<boolean>(false);

  // Layout view mode (Mobile simulator frame vs Fullscreen Dashboard)
  const [viewMode, setViewMode] = useState<'mobile' | 'dashboard'>('mobile');
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false);

  // When proposal changes, adjust valid terms and default down mode
  const handleProposalChange = (newKey: ProposalKey) => {
    triggerHaptic('medium');
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
    triggerHaptic('light');
    setSelectedBike(bike);
    setVehiclePrice(bike.price);
    handleProposalChange(bike.proposalKey);

    // Auto-match bike model code if available in MOTORCYCLE_MODELS
    const cleanBikeName = bike.name.toLowerCase().replace(/[\s\-_/]+/g, '');
    const matched = MOTORCYCLE_MODELS.find((m) => {
      const cleanMName = m.name.toLowerCase().replace(/[\s\-_/]+/g, '');
      return cleanBikeName.includes(cleanMName) || cleanMName.includes(cleanBikeName);
    });
    if (matched) {
      setBikeModelCode(matched.code.toUpperCase());
    }

    if (bike.proposalKey === 'honda_yamaha') {
      setDownMode('percent');
      setDownValue(bike.defaultDownPercent || 15);
    } else {
      const defaultDown = Math.round(bike.price * ((bike.defaultDownPercent || 15) / 100));
      setDownMode('amount');
      setDownValue(defaultDown);
    }
  };

  // Helper to map brand string safely to BikePreset brand union
  const toPresetBrand = (b?: string): 'Honda' | 'Yamaha' | 'Vespa' | 'Lambretta' | 'Other' => {
    if (b?.toUpperCase() === 'YAMAHA') return 'Yamaha';
    if (b?.toUpperCase() === 'VESPA') return 'Vespa';
    if (b?.toUpperCase() === 'LAMBRETTA') return 'Lambretta';
    return 'Honda';
  };

  // When selecting a model from the model code autocomplete
  const handleSelectMotorcycleModel = (model: MotorcycleModel) => {
    const upperCode = model.code.toUpperCase();
    setBikeModelCode(upperCode);
    setSelectedBike({
      id: model.id,
      name: model.name,
      brand: toPresetBrand(model.brand),
      price: vehiclePrice,
      proposalKey: proposalKey,
      defaultDownPercent: downMode === 'percent' ? downValue : 15,
    });
  };

  // When typing model code manually
  const handleBikeModelCodeChange = (code: string) => {
    const upperCode = code.toUpperCase();
    setBikeModelCode(upperCode);
    const matched = findModelByCode(upperCode) || MOTORCYCLE_MODELS.find(
      (m) => m.code.toUpperCase() === upperCode.trim().toUpperCase()
    );
    if (matched) {
      setSelectedBike({
        id: matched.id,
        name: matched.name,
        brand: toPresetBrand(matched.brand),
        price: vehiclePrice,
        proposalKey: proposalKey,
        defaultDownPercent: downMode === 'percent' ? downValue : 15,
      });
    }
  };

  // Quick down payment pill clicks with haptic feedback
  const handleQuickDownPercent = (pct: number) => {
    triggerHaptic('selection');
    setDownMode('percent');
    setDownValue(pct);
  };

  const handleQuickDownAmount = (amt: number) => {
    triggerHaptic('selection');
    setDownMode('amount');
    setDownValue(amt);
  };

  // Quick vehicle price adjustment helper (+/- step)
  const handleAdjustPrice = (delta: number) => {
    triggerHaptic('selection');
    setVehiclePrice((prev) => Math.max(0, (prev || 0) + delta));
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

  // Subtle hero card pulse/flash effect when calculations change
  const [isHeroPulsing, setIsHeroPulsing] = useState<boolean>(false);
  useEffect(() => {
    setIsHeroPulsing(true);
    const timer = setTimeout(() => setIsHeroPulsing(false), 450);
    return () => clearTimeout(timer);
  }, [
    currentCalculation.monthlyInstallment,
    currentCalculation.financeAmount,
    insurancePlan,
    term,
  ]);

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
👤 ลูกค้า: ${customerDisplay}
${selectedBike || bikeModelCode ? `🏍️ รุ่นรถ: ${selectedBike ? selectedBike.name : ''}${bikeModelCode ? ` (รหัสรุ่น: ${bikeModelCode})` : ''}\n` : ''}ข้อเสนอ: ${currentCalculation.proposalName} (${currentCalculation.proposalCode})
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
${currentCalculation.isCappedByEir ? `⚖️ ควบคุมดอกเบี้ย: ${currentCalculation.eirMaxMessage} (ตามเกณฑ์ สคบ. EIR ไม่เกิน 23% ต่อปี)\n` : ''}💵 ดอกเบี้ยต่อเดือน: ${formatBaht(currentCalculation.monthlyInterest, true)} /เดือน
💵 ดอกเบี้ยรวมทั้งสัญญา: ${formatBaht(currentCalculation.totalInterest, true)}
⭐ ค่างวดต่อเดือน: ${formatBaht(currentCalculation.monthlyInstallment)} /เดือน (รวม VAT 7%)
รวมทั้งสัญญา: ${formatBaht(currentCalculation.totalWithVat, true)}
* ยอดจริงอาจมีการเปลี่ยนแปลงตามผลการอนุมัติสินเชื่อ Next Capital`;

    try {
      await navigator.clipboard.writeText(summary);
      triggerHaptic('success');
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2400);
    } catch {
      // ignore
    }
  };

  const currentProposal = PROPOSALS[proposalKey];
  const activeInsurancePlan = insurancePlan !== 'none' ? INSURANCE_PLANS[insurancePlan] : null;

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-100 via-indigo-50/40 to-amber-50/50 text-slate-800 flex flex-col justify-start sm:justify-center items-center p-0 sm:p-2 md:p-4 select-none">
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
            ? 'max-w-full sm:max-w-[620px] md:max-w-[680px] h-screen sm:h-[920px] sm:max-h-[96vh] sm:rounded-[28px]'
            : 'w-full max-w-[98%] xl:max-w-[96%] 2xl:max-w-[1560px] h-auto min-h-[750px] sm:rounded-[28px] my-1 sm:my-3'
        } glass-container-frame flex flex-col relative overflow-hidden`}
      >
        {/* Top Specular Highlight Line */}
        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent opacity-90 pointer-events-none" />

        {/* Company Header - Next Capital */}
        <div className="flex justify-between items-center px-3.5 sm:px-5 py-2 sm:py-2.5 border-b border-white/60 bg-gradient-to-r from-white/70 via-blue-50/50 to-amber-50/40 backdrop-blur-xl">
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
        <header className="px-3.5 sm:px-5 py-2.5 sm:py-3 border-b border-white/50 bg-white/40 backdrop-blur-md flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-lg font-bold gradient-header-text tracking-tight">
                MotoLease Calc
              </h1>
              <span className="text-[10px] font-bold bg-amber-100/90 text-amber-800 border border-amber-200/70 px-1.5 py-0.2 rounded-full">
                2569
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
        {(selectedBike || bikeModelCode) && (
          <div className="px-3.5 sm:px-5 py-2 bg-gradient-to-r from-blue-50/80 via-white/60 to-amber-50/60 border-b border-white/60 flex items-center justify-between text-xs backdrop-blur-md">
            <div className="flex items-center gap-1.5 truncate">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              <span className="text-slate-500 font-medium">รุ่นที่เลือก:</span>
              <span className="font-bold text-blue-950 truncate">
                {selectedBike?.name || 'รถจักรยานยนต์'}
              </span>
              {bikeModelCode && (
                <span className="font-mono text-[10px] font-bold text-blue-700 bg-white/90 px-1.5 py-0.5 rounded border border-blue-200 ml-1">
                  {bikeModelCode}
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setSelectedBike(null);
                setBikeModelCode('');
              }}
              className="text-[11px] text-slate-400 hover:text-rose-600 ml-2 font-medium cursor-pointer"
            >
              ล้าง
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <main
          className={`flex-1 overflow-y-auto px-3 sm:px-6 md:px-8 lg:px-9 py-3.5 sm:py-5 space-y-4 ${
            viewMode === 'dashboard' ? 'grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-7 space-y-0' : ''
          }`}
        >
          {/* Left Column / Input Controls */}
          <div
            className={`space-y-4 ${
              viewMode === 'dashboard' ? 'lg:col-span-6 xl:col-span-5' : ''
            }`}
          >
            {/* Input Form Card - Frosted Glass with Interactive Hover Micro-lift */}
            <div className="glass-card-primary rounded-2xl p-3.5 sm:p-5 lg:p-6 space-y-4 relative overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
              {/* Officer Name & Code & Broker License Card (ช่องใส่ชื่อ โค้ด และเลขที่ใบอนุญาตนายหน้าประกันวินาศภัย) */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white/80 border border-blue-200/80 shadow-2xs space-y-2.5 transition-all hover:border-blue-300">
                <div className="flex items-center justify-between">
                  <label className="text-[11.5px] text-slate-800 font-bold flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-blue-700 flex-shrink-0" />
                    <span>ข้อมูลเจ้าหน้าที่ / ผู้เสนอราคา</span>
                  </label>
                  <span className="text-[9.5px] font-bold text-blue-700 bg-white/95 px-2.5 py-0.5 rounded-full border border-blue-200 shadow-2xs">
                    ลงชื่อในใบเสนอราคา & เอกสาร
                  </span>
                </div>
                <div className="grid grid-cols-12 gap-2.5">
                  <div className="col-span-7 sm:col-span-8">
                    <label className="block text-[10px] text-slate-500 font-medium mb-1">
                      ชื่อเจ้าหน้าที่
                    </label>
                    <input
                      type="text"
                      value={officerName}
                      onChange={(e) => handleOfficerNameChange(e.target.value)}
                      placeholder="ใส่ชื่อเจ้าหน้าที่"
                      className="w-full glass-input-field rounded-xl px-3 py-2 text-xs sm:text-[13px] text-slate-900 font-bold outline-none"
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
                      className="w-full glass-input-field rounded-xl px-3 py-2 text-xs sm:text-[13px] text-blue-900 font-bold font-mono outline-none"
                    />
                  </div>
                  <div className="col-span-12">
                    <label className="block text-[10px] text-slate-600 font-medium mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1 font-semibold text-blue-950">
                        <Award className="w-3.5 h-3.5 text-amber-600" />
                        เลขที่ใบอนุญาตนายหน้าประกันวินาศภัย
                      </span>
                      <span className="text-[9.5px] text-slate-400 font-normal">
                        (สำหรับตารางความคุ้มครอง Group PA)
                      </span>
                    </label>
                    <input
                      type="text"
                      value={officerLicense}
                      onChange={(e) => handleOfficerLicenseChange(e.target.value)}
                      placeholder="ใส่เลขที่ใบอนุญาตนายหน้าประกันวินาศภัย (เช่น 620400xxxx)"
                      className="w-full glass-input-field rounded-xl px-3 py-2 text-xs sm:text-[13px] text-blue-950 font-semibold font-mono outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Customer Information Card (กล่องใส่ข้อมูลลูกค้า: ชื่อและเบอร์โทร) */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-white/80 border border-emerald-200/80 shadow-2xs space-y-2.5 transition-all hover:border-emerald-300">
                <div className="flex items-center justify-between">
                  <label className="text-[11.5px] text-slate-800 font-bold flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
                    <span>ข้อมูลลูกค้า</span>
                  </label>
                  <span className="text-[9.5px] font-bold text-emerald-800 bg-white/95 px-2.5 py-0.5 rounded-full border border-emerald-200 shadow-2xs">
                    แสดงในใบเสนอราคา & LINE
                  </span>
                </div>
                <div className="grid grid-cols-12 gap-2.5">
                  <div className="col-span-7 sm:col-span-7">
                    <label className="block text-[10px] text-slate-500 font-medium mb-1">
                      ชื่อลูกค้า
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => handleCustomerNameChange(e.target.value)}
                      placeholder="ใส่ชื่อลูกค้า (เช่น คุณสมชาย)"
                      className="w-full glass-input-field rounded-xl px-3 py-2 text-xs sm:text-[13px] text-slate-900 font-bold outline-none"
                    />
                  </div>
                  <div className="col-span-5 sm:col-span-5">
                    <label className="block text-[10px] text-slate-500 font-medium mb-1 flex items-center gap-1">
                      <Phone className="w-2.5 h-2.5 text-slate-400" /> เบอร์โทรศัพท์
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => handleCustomerPhoneChange(e.target.value)}
                      placeholder="08X-XXX-XXXX"
                      className="w-full glass-input-field rounded-xl px-3 py-2 text-xs sm:text-[13px] text-slate-900 font-bold font-mono outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Vehicle & Proposal Information Card (กล่องข้อมูลรถและเงื่อนไขข้อเสนอ จัดเป็นกล่องเหมือนกับกล่องข้อมูลเจ้าหน้าที่) */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white/80 border border-blue-200/80 shadow-2xs space-y-3 transition-all hover:border-blue-300">
                <div className="flex items-center justify-between">
                  <label className="text-[11.5px] text-slate-800 font-bold flex items-center gap-1.5">
                    <Bike className="w-3.5 h-3.5 text-blue-700 flex-shrink-0" />
                    <span>ข้อมูลรถและเงื่อนไขข้อเสนอ</span>
                  </label>
                  <span className="text-[9.5px] font-bold text-blue-700 bg-white/95 px-2.5 py-0.5 rounded-full border border-blue-200 shadow-2xs">
                    รุ่นรถ • Proposal • ราคา
                  </span>
                </div>

                {/* Proposal Select */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] text-slate-600 font-semibold flex items-center gap-1">
                      เลือกประเภทข้อเสนอ (Proposal) *
                    </label>
                    <button
                      type="button"
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

                {/* Bike Model Code Input (รหัสรุ่นรถ - ค้นหาและเลือกรหัสรุ่นจากตาราง) */}
                <BikeModelCodeInput
                  value={bikeModelCode}
                  onChange={handleBikeModelCodeChange}
                  onSelectModel={handleSelectMotorcycleModel}
                  selectedModelName={selectedBike?.name}
                />

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
                  {/* Interactive quick price adjustment steppers */}
                  <div className="flex items-center gap-1 mt-1.5 overflow-x-auto pb-0.5 text-[10px]">
                    <span className="text-slate-400 font-medium mr-0.5 shrink-0">ปรับราคาเร็ว:</span>
                    {[
                      { label: '-5,000', delta: -5000 },
                      { label: '-1,000', delta: -1000 },
                      { label: '+1,000', delta: 1000 },
                      { label: '+5,000', delta: 5000 },
                    ].map((step) => (
                      <button
                        key={step.label}
                        type="button"
                        onClick={() => handleAdjustPrice(step.delta)}
                        className="px-2 py-0.5 rounded-lg font-bold text-slate-600 hover:text-blue-700 bg-white/80 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 transition-all active:scale-95 cursor-pointer shadow-2xs shrink-0"
                      >
                        {step.label}
                      </button>
                    ))}
                  </div>
                </div>
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

              {/* Financing Terms Card (กล่องเงื่อนไขการเงิน เงินดาวน์และระยะเวลาผ่อน จัดเป็นกล่องเหมือนกับกล่องข้อมูลเจ้าหน้าที่) */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white/80 border border-blue-200/80 shadow-2xs space-y-3 transition-all hover:border-blue-300">
                <div className="flex items-center justify-between">
                  <label className="text-[11.5px] text-slate-800 font-bold flex items-center gap-1.5">
                    <Banknote className="w-3.5 h-3.5 text-blue-700 flex-shrink-0" />
                    <span>เงื่อนไขเงินดาวน์และระยะเวลาผ่อน</span>
                  </label>
                  <span className="text-[9.5px] font-bold text-blue-700 bg-white/95 px-2.5 py-0.5 rounded-full border border-blue-200 shadow-2xs">
                    เงินดาวน์ • งวดผ่อน • ดอกเบี้ย
                  </span>
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

                  {/* Interactive Down Payment Range Slider */}
                  <div className="pt-2 pb-0.5 px-0.5">
                    <input
                      type="range"
                      min="0"
                      max={downMode === 'amount' ? Math.max(vehiclePrice, 10000) : 50}
                      step={downMode === 'amount' ? 1000 : 1}
                      value={downValue}
                      onChange={(e) => {
                        triggerHaptic('selection');
                        setDownValue(Number(e.target.value));
                      }}
                      className="w-full accent-blue-600 hover:accent-blue-700 cursor-pointer h-1.5 bg-slate-200/90 rounded-lg transition-all"
                    />
                  </div>

                  {/* Visual Ratio Bar (เงินดาวน์ vs ยอดจัด) */}
                  <div className="pt-2 space-y-1">
                    <div className="h-2 w-full bg-slate-200/90 rounded-full overflow-hidden flex p-0.5 border border-slate-300/60 shadow-inner">
                      <div
                        style={{
                          width: `${Math.min(Math.max(currentCalculation.downPercent, 0), 100)}%`,
                        }}
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-300 shadow-2xs"
                      />
                      <div
                        style={{
                          width: `${Math.min(Math.max(100 - currentCalculation.downPercent, 0), 100)}%`,
                        }}
                        className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-300"
                      />
                    </div>
                    <div className="flex justify-between items-center text-[9.5px] font-semibold text-slate-500 px-0.5">
                      <span className="flex items-center gap-1 text-emerald-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        ดาวน์ {currentCalculation.downPercent.toFixed(1)}% (฿{formatBaht(currentCalculation.downAmount)})
                      </span>
                      <span className="flex items-center gap-1 text-blue-900">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block" />
                        จัด {(100 - currentCalculation.downPercent).toFixed(1)}% (฿{formatBaht(currentCalculation.vehicleFinanceAmount)})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Term Selection */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] text-slate-600 font-semibold">
                      ระยะเวลาผ่อน (งวด) *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowEirInfo(true)}
                      className="text-[10px] text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Scale className="w-3 h-3 text-amber-500" />
                      เกณฑ์ดอกเบี้ย EIR 23%
                    </button>
                  </div>
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

                {/* Interest Rate Comparison: ช่องตาม Proposal (ซ้าย) vs ช่องอัตราสูงสุด (ขวา) */}
                <div className="space-y-1.5 pt-0.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] text-slate-700 font-bold">
                      หลักเกณฑ์อัตราดอกเบี้ยที่ใช้
                    </label>
                    <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                      {currentCalculation.isCappedByEir ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> ล็อกตามเกณฑ์ EIR 23%
                        </span>
                      ) : (
                        <span className="text-blue-700 font-medium">
                          ✓ ไม่เกินเพดาน สคบ.
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* ช่องตาม Proposal (ซ้าย) */}
                    <div
                      className={`rounded-xl p-2.5 border transition-all ${
                        currentCalculation.isCappedByEir
                          ? 'bg-amber-50/70 border-amber-300/80 shadow-xs'
                          : 'bg-slate-50/80 border-slate-200/80'
                      }`}
                    >
                      <div className="text-[10.5px] font-semibold text-slate-700 mb-1 leading-snug">
                        อัตราดอกเบี้ย (%) <span className="text-rose-500">*</span>{' '}
                        <span className="text-amber-600 font-bold">ตาม Proposal</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-base font-black text-slate-800">
                          {(currentCalculation.proposalMonthlyRate * 100).toFixed(3)}
                          <span className="text-[11px] font-normal text-slate-500 ml-1">% / เดือน</span>
                        </div>
                        {currentCalculation.isCappedByEir && (
                          <span className="text-amber-800 text-[9.5px] bg-amber-200/80 px-1.5 py-0.5 rounded font-bold">
                            เกินเพดาน
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        ขออัตรา {(currentCalculation.proposalMonthlyRate * 100).toFixed(3)}% ตาม Proposal
                      </div>
                    </div>

                    {/* ช่องอัตราสูงสุด (ขวา) */}
                    <div
                      className={`rounded-xl p-2.5 border transition-all ${
                        currentCalculation.isCappedByEir
                          ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs'
                          : 'bg-blue-50/80 border-blue-300'
                      }`}
                    >
                      <div className="text-[10.5px] font-semibold text-slate-700 mb-1 leading-snug">
                        อัตราดอกเบี้ย (%) <span className="text-rose-500">*</span>{' '}
                        <span className="text-amber-600 font-bold">{currentCalculation.eirMaxMessage}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-base font-black text-emerald-700 flex items-center gap-1">
                          <Lock className="w-3.5 h-3.5 text-emerald-600 inline" />
                          {(currentCalculation.effectiveMonthlyRate * 100).toFixed(3)}
                          <span className="text-[11px] font-normal text-emerald-800 ml-1">% / เดือน</span>
                        </div>
                        <span className="text-[9.5px] bg-emerald-200 text-emerald-900 font-bold px-1.5 py-0.5 rounded">
                          บังคับใช้จริง
                        </span>
                      </div>
                      <div className="text-[10px] text-emerald-800 font-medium mt-0.5">
                        อัตราสูงสุดที่ไม่เกินเพดาน EIR 23%
                      </div>
                    </div>
                  </div>

                  {/* Clean indicator when capped by EIR */}
                  {currentCalculation.isCappedByEir && (
                    <div className="p-2.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 text-[11px] text-amber-950 flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-1.5 font-bold text-amber-900">
                        <Lock className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span>ล็อกอัตราสูงสุดตามเกณฑ์ สคบ. (EIR ไม่เกิน 23% ต่อปี)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowEirInfo(true)}
                        className="text-[10.5px] text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer shrink-0 ml-2"
                      >
                        ดูเกณฑ์ →
                      </button>
                    </div>
                  )}
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
            {/* Result Hero Card - Frosted Glassmorphism Masterpiece with Shimmer Effect */}
            <div
              className={`glass-card-hero rounded-2xl p-4 sm:p-6 lg:p-7 text-center relative overflow-hidden transition-all duration-300 shadow-md hover:shadow-lg ${
                isHeroPulsing ? 'animate-card-flash ring-2 ring-blue-500/40 shadow-xl' : ''
              }`}
            >
              {/* Luxury Specular Shimmer Light Sweep */}
              <div className="shimmer-light" />

              {/* Proposal Code Badge & Insurance Badge */}
              <div className="flex flex-wrap items-center justify-center gap-2 mb-1.5 relative z-10">
                <span className="inline-block bg-white/90 text-blue-800 border border-blue-200/80 px-3 py-0.5 rounded-full text-[10.5px] font-bold tracking-wide shadow-2xs">
                  {currentCalculation.proposalCode}
                </span>
                {currentCalculation.insurancePremium > 0 && (
                  <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200/90 px-3 py-0.5 rounded-full text-[10.5px] font-bold tracking-wide shadow-2xs">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    {currentCalculation.insurancePlanName}
                  </span>
                )}
              </div>

              <p className="text-[11px] sm:text-xs text-slate-500 font-semibold tracking-wide relative z-10">
                ค่างวดต่อเดือน (รวมภาษีมูลค่าเพิ่ม 7%)
              </p>

              {/* Monthly Installment Highlight with Gradient Accent & Smooth Animated Counter */}
              <div className="text-3.5xl sm:text-5xl font-extrabold text-[#1C449C] my-1.5 tracking-tight drop-shadow-xs flex items-center justify-center relative z-10">
                <AnimatedNumber
                  value={currentCalculation.monthlyInstallment}
                  formatFn={(val) => formatBaht(val)}
                  className="font-extrabold tracking-tight"
                />
                <span className="text-xs sm:text-sm font-normal text-slate-500 ml-1.5">/เดือน</span>
              </div>

              {/* Installment Rounding Badge (ลงท้าย 0 หรือ 5) */}
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-50/90 border border-blue-200/80 text-[10.5px] text-blue-900 font-semibold mb-1 shadow-2xs">
                <span>ปัดเศษลงท้าย 0 หรือ 5 (ระบบ Next Capital)</span>
                {currentCalculation.rawMonthlyInstallment !== currentCalculation.monthlyInstallment && (
                  <span className="text-slate-400 font-normal">
                    (เดิม {currentCalculation.rawMonthlyInstallment.toFixed(2)} บ.)
                  </span>
                )}
              </div>

              <p className="text-[10.5px] text-slate-500 font-medium max-w-sm mx-auto truncate">
                {currentCalculation.remarkText}
              </p>

              {/* Summary Grid - Translucent Glass Chips */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 mt-4 pt-4 border-t border-slate-200/60 text-left text-[11px] sm:text-xs">
                <div className="bg-white/80 backdrop-blur-md p-3 sm:p-3.5 rounded-xl border border-white/90 shadow-2xs hover:shadow-xs transition-shadow">
                  <div className="text-[10px] text-slate-400 font-medium">ยอดจัดไฟแนนซ์รวม:</div>
                  <span className="font-bold text-slate-900 text-xs sm:text-sm">
                    {formatBaht(currentCalculation.financeAmount, true)}
                  </span>
                  {currentCalculation.insuranceTotalWithVat > 0 ? (
                    <div className="text-[9.5px] text-blue-700 font-semibold truncate mt-0.5">
                      (รถ {formatBaht(currentCalculation.vehicleFinanceAmount)} + PA+VAT {formatBaht(currentCalculation.insuranceTotalWithVat, true)})
                    </div>
                  ) : (
                    <div className="text-[9.5px] text-slate-500 mt-0.5">
                      (ยอดจัดตัวรถ)
                    </div>
                  )}
                </div>
                <div className="bg-white/80 backdrop-blur-md p-3 sm:p-3.5 rounded-xl border border-white/90 shadow-2xs hover:shadow-xs transition-shadow">
                  <div className="text-[10px] text-slate-400 font-medium">ดอกเบี้ยรายเดือน:</div>
                  <span className="font-bold text-slate-900 text-xs sm:text-sm">
                    {formatBaht(currentCalculation.monthlyInterest, true)} /งวด
                  </span>
                  <div className="text-[9.5px] text-slate-500 mt-0.5">
                    รวมทั้งสัญญา: {formatBaht(currentCalculation.totalInterest, true)}
                  </div>
                </div>
                <div className="bg-white/80 backdrop-blur-md p-3 sm:p-3.5 rounded-xl border border-white/90 shadow-2xs hover:shadow-xs transition-shadow">
                  <div className="text-[10px] text-slate-400 font-medium">ยอดรวมทั้งสัญญา:</div>
                  <span className="font-bold text-slate-900 text-xs sm:text-sm">
                    {formatBaht(currentCalculation.totalWithVat, true)}
                  </span>
                  <div className="text-[9.5px] text-slate-500 mt-0.5">
                    (ยอดจัด + ดอกเบี้ยรวม)
                  </div>
                </div>
                <div className="bg-white/80 backdrop-blur-md p-3 sm:p-3.5 rounded-xl border border-white/90 shadow-2xs hover:shadow-xs transition-shadow">
                  <div className="text-[10px] text-slate-400 font-medium">ภาษีมูลค่าเพิ่มในสัญญา (7%):</div>
                  <span className="font-bold text-slate-900 text-xs sm:text-sm">
                    {formatBaht(currentCalculation.vatAmount, true)}
                  </span>
                  <div className="text-[9.5px] text-slate-500 mt-0.5">
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleQuickCopy}
                    className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer bg-emerald-50/80 hover:bg-emerald-100/80 px-2.5 py-1 rounded-lg border border-emerald-200/90 transition-all shadow-2xs"
                    title="คัดลอกข้อความสรุปสำหรับส่งลูกค้าทาง LINE"
                  >
                    {copyFeedback ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> คัดลอกสำเร็จ!
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5 text-emerald-600" /> ส่ง LINE
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowQuotation(true)}
                    className="flex items-center gap-1 text-slate-700 hover:text-blue-900 font-medium cursor-pointer hover:bg-white/80 px-2 py-1 rounded-lg transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-700" /> ใบเสนอราคาทางการ
                  </button>
                </div>
              </div>
            </div>

            {/* Term Comparisons Table */}
            <TermComparisonTable
              comparisons={comparisons}
              selectedTerm={term}
              onSelectTerm={(newTerm) => setTerm(newTerm)}
              onOpenEirInfo={() => setShowEirInfo(true)}
            />
          </div>
        </main>

        {/* Bottom Bar Info */}
        <footer className="px-3.5 sm:px-5 py-2 sm:py-2.5 bg-white/50 border-t border-white/60 backdrop-blur-md text-[10px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-slate-600">Next Capital Public Company Limited (NCAP)</span>
          <span className="text-[10px] text-slate-400">ระบบคำนวณค่างวดและออกใบเสนอราคาเช่าซื้อ</span>
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
        selectedBikeName={
          selectedBike?.name ||
          (bikeModelCode
            ? MOTORCYCLE_MODELS.find(
                (m) => m.code.toUpperCase() === bikeModelCode.trim().toUpperCase()
              )?.name
            : undefined)
        }
        modelCode={bikeModelCode}
        officerInfo={officerDisplay}
        initialCustomerName={customerName}
        initialCustomerPhone={customerPhone}
        onUpdateCustomer={(name, phone) => {
          handleCustomerNameChange(name);
          handleCustomerPhoneChange(phone);
        }}
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
        selectedBikeName={
          selectedBike
            ? bikeModelCode
              ? `${selectedBike.name} (${bikeModelCode})`
              : selectedBike.name
            : bikeModelCode
            ? `รหัส ${bikeModelCode}`
            : undefined
        }
        officerInfo={officerDisplay}
        officerLicense={officerLicense}
        customerInfo={customerDisplay}
        customerName={customerName}
        customerPhone={customerPhone}
        onUpdateCustomer={(name, phone) => {
          handleCustomerNameChange(name);
          handleCustomerPhoneChange(phone);
        }}
        onUpdatePlan={(plan, years) => {
          setInsurancePlan(plan);
          setInsuranceYears(years);
        }}
      />

      <EirInfoModal
        isOpen={showEirInfo}
        onClose={() => setShowEirInfo(false)}
        calculation={currentCalculation}
      />
    </div>
  );
}
