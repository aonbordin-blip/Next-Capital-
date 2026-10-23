/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
  ChevronUp,
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
  Pencil,
  RotateCcw,
  Sliders,
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
  formatTermYearMonth,
} from './data/proposals';
import { ProposalKey, DownMode, BikePreset, InsurancePlan, InsuranceYears, CustomRateConfig } from './types';
import { ProposalInfoModal } from './components/ProposalInfoModal';
import { ProposalSelectModal } from './components/ProposalSelectModal';
import { BikePresetsModal } from './components/BikePresetsModal';
import { QuotationModal } from './components/QuotationModal';
import { AmortizationModal } from './components/AmortizationModal';
import { TermComparisonTable } from './components/TermComparisonTable';
import { DvApprovalCard } from './components/DvApprovalCard';
import { DailyFinanceReportCard } from './components/DailyFinanceReportCard';
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

  // Custom Interest Rate State (ฟังก์ชันแก้ไขอัตราดอกเบี้ยให้ตรงกับระบบบริษัท)
  const [isCustomRateEnabled, setIsCustomRateEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ncap_custom_rate_enabled') === 'true';
    } catch {
      return false;
    }
  });

  const [customRateInput, setCustomRateInput] = useState<string>(() => {
    try {
      return localStorage.getItem('ncap_custom_rate_input') ?? '';
    } catch {
      return '';
    }
  });

  const [customRateType, setCustomRateType] = useState<'monthly' | 'annual'>(() => {
    try {
      return (localStorage.getItem('ncap_custom_rate_type') as 'monthly' | 'annual') || 'monthly';
    } catch {
      return 'monthly';
    }
  });

  const [enforceEirCap, setEnforceEirCap] = useState<boolean>(false);

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

  // Collapsible cards state: cards can be expanded or collapsed by clicking their header/toggle
  const [expandedCard, setExpandedCard] = useState<'financing' | 'comparison' | 'dv' | 'daily_report' | null>('financing');

  // Auto-collapse when clicking or interacting with another data box (ถ้ายังกดในกล่องเดิมไม่ยุบปิด)
  useEffect(() => {
    if (!expandedCard) return;

    const handleInteraction = (target: HTMLElement | null) => {
      if (!target) return;

      // 1. Ignore clicks inside open modal overlays, dialogs, or portals
      if (
        target.closest('[role="dialog"]') ||
        target.closest('.modal-container') ||
        target.closest('.fixed.inset-0') ||
        target.closest('[data-modal-portal]')
      ) {
        return;
      }

      // 2. Find which data box container was interacted with
      const clickedCard = target.closest<HTMLElement>('[data-card-id]');
      if (!clickedCard) {
        // Neutral background, margin, dock, or footer: do not auto-collapse
        return;
      }

      const clickedId = clickedCard.getAttribute('data-card-id');

      // 3. If clicking inside the SAME expanded data box: KEEP OPEN! Never collapse!
      if (clickedId === expandedCard) {
        return;
      }

      // 4. If clicking on a toggle header/button, let its own onClick handle toggling
      const isToggleHeader = Boolean(target.closest('[data-card-toggle]'));
      if (isToggleHeader) {
        return;
      }

      // 5. If clicking on another collapsible card, switch to that card
      if (
        clickedId === 'financing' ||
        clickedId === 'comparison' ||
        clickedId === 'dv' ||
        clickedId === 'daily_report'
      ) {
        setExpandedCard(clickedId as 'financing' | 'comparison' | 'dv' | 'daily_report');
      } else {
        // Clicked inside another distinct data box (pricing, insurance, customer, officer, result, etc.)
        // Automatically collapse the open collapsible card!
        setExpandedCard(null);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      handleInteraction(e.target as HTMLElement | null);
    };

    const onFocusIn = (e: FocusEvent) => {
      handleInteraction(e.target as HTMLElement | null);
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('focusin', onFocusIn, true);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('focusin', onFocusIn, true);
    };
  }, [expandedCard]);


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

    // Auto-match bike model code if available in preset or MOTORCYCLE_MODELS
    if (bike.code) {
      setBikeModelCode(bike.code.toUpperCase());
    } else {
      const cleanBikeName = bike.name.toLowerCase().replace(/[\s\-_/()]+/g, '');
      const matched = MOTORCYCLE_MODELS.find((m) => {
        const cleanMName = m.name.toLowerCase().replace(/[\s\-_/()]+/g, '');
        return cleanBikeName.includes(cleanMName) || cleanMName.includes(cleanBikeName);
      });
      if (matched) {
        setBikeModelCode(matched.code.toUpperCase());
      }
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
    const updatedPrice = model.price || vehiclePrice;
    if (model.price) {
      setVehiclePrice(model.price);
      if (downMode === 'amount') {
        const currentDownRatio = vehiclePrice > 0 ? downValue / vehiclePrice : 0.15;
        setDownValue(Math.round(model.price * (currentDownRatio || 0.15)));
      }
    }
    setSelectedBike({
      id: model.id,
      code: upperCode,
      name: model.name,
      brand: toPresetBrand(model.brand),
      price: updatedPrice,
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
      const updatedPrice = matched.price || vehiclePrice;
      if (matched.price) {
        setVehiclePrice(matched.price);
        if (downMode === 'amount') {
          const currentDownRatio = vehiclePrice > 0 ? downValue / vehiclePrice : 0.15;
          setDownValue(Math.round(matched.price * (currentDownRatio || 0.15)));
        }
      }
      setSelectedBike({
        id: matched.id,
        code: matched.code.toUpperCase(),
        name: matched.name,
        brand: toPresetBrand(matched.brand),
        price: updatedPrice,
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

  // Custom rate handlers and config (ฟังก์ชันแก้ไขอัตราดอกเบี้ยตามระบบบริษัท)
  const handleToggleCustomRate = () => {
    triggerHaptic('selection');
    const nextState = !isCustomRateEnabled;
    setIsCustomRateEnabled(nextState);
    try {
      localStorage.setItem('ncap_custom_rate_enabled', String(nextState));
    } catch {}
    if (nextState && !customRateInput) {
      const defaultRate = (currentCalculation.proposalMonthlyRate * 100).toFixed(3);
      setCustomRateInput(defaultRate);
      try {
        localStorage.setItem('ncap_custom_rate_input', defaultRate);
      } catch {}
    }
  };

  const handleCustomRateChange = (val: string) => {
    setCustomRateInput(val);
    try {
      localStorage.setItem('ncap_custom_rate_input', val);
    } catch {}
  };

  const handleCustomRateTypeChange = (type: 'monthly' | 'annual') => {
    triggerHaptic('light');
    setCustomRateType(type);
    try {
      localStorage.setItem('ncap_custom_rate_type', type);
    } catch {}
    const num = parseFloat(customRateInput);
    if (!isNaN(num) && num > 0) {
      if (type === 'annual' && num < 3) {
        const annualEquivalent = (num * 12).toFixed(2);
        setCustomRateInput(annualEquivalent);
        try {
          localStorage.setItem('ncap_custom_rate_input', annualEquivalent);
        } catch {}
      } else if (type === 'monthly' && num >= 3) {
        const monthlyEquivalent = (num / 12).toFixed(3);
        setCustomRateInput(monthlyEquivalent);
        try {
          localStorage.setItem('ncap_custom_rate_input', monthlyEquivalent);
        } catch {}
      }
    }
  };

  const handleQuickSelectRate = (rate: number) => {
    triggerHaptic('selection');
    const str = rate.toString();
    setCustomRateInput(str);
    try {
      localStorage.setItem('ncap_custom_rate_input', str);
    } catch {}
  };

  const handleAdjustRate = (delta: number) => {
    triggerHaptic('light');
    const current = parseFloat(customRateInput) || (currentCalculation.proposalMonthlyRate * 100) || 1.09;
    const next = Math.max(0.01, Number((current + delta).toFixed(3)));
    const str = next.toString();
    setCustomRateInput(str);
    try {
      localStorage.setItem('ncap_custom_rate_input', str);
    } catch {}
  };

  const handleResetToProposalRate = () => {
    triggerHaptic('medium');
    setIsCustomRateEnabled(false);
    try {
      localStorage.setItem('ncap_custom_rate_enabled', 'false');
    } catch {}
  };

  const parsedCustomRate = parseFloat(customRateInput);
  const customRateConfig: CustomRateConfig | null = React.useMemo(() => {
    if (!isCustomRateEnabled || isNaN(parsedCustomRate) || parsedCustomRate <= 0) {
      return null;
    }
    return {
      rate: parsedCustomRate,
      type: customRateType,
      enforceEirCap,
    };
  }, [isCustomRateEnabled, parsedCustomRate, customRateType, enforceEirCap]);

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
    insuranceYears,
    customRateConfig
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
    currentCalculation.effectiveMonthlyRate,
    isCustomRateEnabled,
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
    insuranceYears,
    customRateConfig
  );

  // Copy quick summary to clipboard
  const handleQuickCopy = async () => {
    const currentComp = comparisons.find((c) => c.term === currentCalculation.term);
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
⏱️ ผ่อน: ${currentCalculation.term} งวด (${formatTermYearMonth(currentCalculation.term)}) | ดอกเบี้ย: ${currentCalculation.rateDisplayText}
${currentCalculation.isCappedByEir ? `⚖️ ควบคุมดอกเบี้ย: ${currentCalculation.eirMaxMessage} (ตามเกณฑ์ สคบ. EIR ไม่เกิน 23% ต่อปี)\n` : ''}💵 ดอกเบี้ยต่อเดือน: ${formatBaht(currentCalculation.monthlyInterest, true)} /เดือน
💵 ดอกเบี้ยรวมทั้งสัญญา: ${formatBaht(currentCalculation.totalInterest, true)}
⭐ ค่างวดต่อเดือน: ${formatBaht(currentCalculation.monthlyInstallment)} /เดือน (รวม VAT 7%)
${
  currentComp && currentComp.hasInsurance && currentComp.insuranceMonthlyDiff > 0
    ? `   • ค่างวดไม่รวมประกัน: ${formatBaht(currentComp.monthlyInstallmentWithoutInsurance)} /เดือน
   • ประกันบวกเพิ่ม: +${formatBaht(currentComp.insuranceMonthlyDiff)} /เดือน\n`
    : ''
}รวมทั้งสัญญา: ${formatBaht(currentCalculation.totalWithVat, true)}
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

  const scrollToDvApproval = () => {
    triggerHaptic('light');
    setExpandedCard('dv');
    const el = document.getElementById('dv-approval-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-4', 'ring-emerald-400/50');
      setTimeout(() => {
        el.classList.remove('ring-4', 'ring-emerald-400/50');
      }, 2000);
    }
  };

  const currentProposal = PROPOSALS[proposalKey];
  const activeInsurancePlan = insurancePlan !== 'none' ? INSURANCE_PLANS[insurancePlan] : null;

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#cae8fe] text-slate-800 flex flex-col justify-start sm:justify-center items-center p-0 sm:p-2 md:p-4 select-none">
      {/* Dynamic Ambient Background Glowing Blobs for Soft Neo-Glassmorphism Depth */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Soft Cyan Ambient Glow */}
        <div className="absolute -top-24 -left-20 w-96 h-96 rounded-full bg-cyan-400/35 blur-[100px] animate-blob-1" />
        {/* Pastel Teal Accent Glow */}
        <div className="absolute top-1/3 -right-20 w-80 h-80 rounded-full bg-teal-300/40 blur-[90px] animate-blob-2" />
        {/* Sky Blue Ambient Glow */}
        <div className="absolute -bottom-28 left-1/4 w-96 h-96 rounded-full bg-sky-400/35 blur-[110px] animate-blob-3" />
        {/* Violet / Indigo Refraction Accent Glow */}
        <div className="absolute top-2/3 -left-10 w-72 h-72 rounded-full bg-indigo-300/25 blur-[95px] animate-blob-2" />
        {/* Subtle geometric dot grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(#0284c7 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      {/* Top Floating View Mode Switcher on Desktop */}
      <div className="no-print hidden sm:flex items-center gap-2 mb-3 bg-white/70 backdrop-blur-xl px-3.5 py-1.5 rounded-full border border-white/90 shadow-sm shadow-sky-900/10 text-xs z-10">
        <span className="text-slate-500 font-medium">มุมมอง:</span>
        <button
          onClick={() => setViewMode('mobile')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-medium transition-all ${
            viewMode === 'mobile'
              ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" /> จำลองมือถือ
        </button>
        <button
          onClick={() => setViewMode('dashboard')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-medium transition-all ${
            viewMode === 'dashboard'
              ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Monitor className="w-3.5 h-3.5" /> แดชบอร์ดเต็มจอ
        </button>
      </div>

      {/* Main Container - Soft Neo-Morphic Glass Frame matching Reference UI */}
      <div
        className={`w-full transition-all duration-300 z-10 ${
          viewMode === 'mobile'
            ? 'max-w-full sm:max-w-[560px] md:max-w-[580px] h-screen sm:h-[920px] sm:max-h-[96vh] sm:rounded-[36px]'
            : 'max-w-6xl xl:max-w-7xl h-auto min-h-[750px] sm:rounded-[36px] my-1 sm:my-3'
        } glass-container-frame flex flex-col relative overflow-hidden`}
      >
        {/* Top Specular Highlight Line */}
        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent opacity-90 pointer-events-none z-20" />

        {/* Organic Fluid Wave Header (Matching Reference Mobile App Style) */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0284c7] via-[#0ea5e9] to-[#06b6d4] text-white pt-3 pb-6 px-4 sm:px-5 rounded-b-[28px] sm:rounded-b-[32px] shadow-md shadow-sky-950/10">
          {/* Overlapping Organic Water Wave Animation Layers */}
          <div className="absolute inset-x-0 bottom-0 h-20 pointer-events-none overflow-hidden select-none">
            {/* Back Wave (Slow Deep Swell - Soft Translucent Cyan Tone) */}
            <div className="animate-wave-bob-1 absolute inset-x-0 -bottom-2 w-full h-full pointer-events-none">
              <svg
                className="animate-wave-slow w-[200%] min-w-[200%] max-w-none h-full text-white/25"
                viewBox="0 0 1200 120"
                preserveAspectRatio="none"
                fill="currentColor"
              >
                <path d="M 0,45 C 100,20 200,20 300,45 C 400,70 500,70 600,45 C 700,20 800,20 900,45 C 1000,70 1100,70 1200,45 L 1200,120 L 0,120 Z" />
              </svg>
            </div>

            {/* Front Wave (Surface Ripple - Crisp Bright Wave Tone) */}
            <div className="animate-wave-bob-2 absolute inset-x-0 -bottom-1 w-full h-full pointer-events-none">
              <svg
                className="animate-wave-fast w-[200%] min-w-[200%] max-w-none h-full text-white/45"
                viewBox="0 0 1200 120"
                preserveAspectRatio="none"
                fill="currentColor"
              >
                <path d="M 0,55 C 50,35 100,35 150,55 C 200,75 250,75 300,55 C 350,35 400,35 450,55 C 500,75 550,75 600,55 C 650,35 700,35 750,55 C 800,75 850,75 900,55 C 950,35 1000,35 1050,55 C 1100,75 1150,75 1200,55 L 1200,120 L 0,120 Z" />
              </svg>
            </div>
          </div>

          {/* Top Brand Bar */}
          <div className="relative z-10 flex items-center justify-between gap-2 pb-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white shadow-xs border border-white/80 flex items-center justify-center shrink-0">
                <NextCapitalLogo size={24} />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-xs tracking-tight text-white uppercase drop-shadow-xs">
                  Next Capital
                </span>
                <span className="text-[9.5px] text-white/80 font-medium -mt-0.5">
                  บมจ. เน็กซ์ แคปปิตอล
                </span>
              </div>
            </div>

            <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/30 shadow-xs whitespace-nowrap">
              พัฒนาระบบโดย Bordin 6683
            </span>
          </div>

          {/* Header Title Row */}
          <div className="relative z-10 flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight drop-shadow-xs">
                MotoLease Calc
              </h1>
              <span className="text-[10px] font-bold bg-white/25 backdrop-blur-md text-white border border-white/30 px-2 py-0.5 rounded-full">
                2569
              </span>
            </div>
            <span className="text-[11px] text-white/90 font-medium">
              ระบบคำนวณค่างวดรถจักรยานยนต์
            </span>
          </div>

          {/* Pill Search / Model Code Bar matching Reference UI */}
          <div data-card-id="model-bar" className="relative z-10 mt-2.5">
            <button
              type="button"
              onClick={() => setShowBikePresets(true)}
              className="w-full bg-white/25 hover:bg-white/35 text-white backdrop-blur-md rounded-full py-2 px-3.5 shadow-sm shadow-sky-950/20 border border-white/40 hover:border-white/60 flex items-center justify-between text-xs transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2 truncate">
                <div className="w-5 h-5 rounded-full bg-white/25 text-white flex items-center justify-center shrink-0 border border-white/30 shadow-2xs">
                  <Bike className="w-3.5 h-3.5" />
                </div>
                <span className="text-white/95 font-medium truncate drop-shadow-2xs">
                  {selectedBike ? `รุ่น: ${selectedBike.name}` : bikeModelCode ? `รหัสรุ่น: ${bikeModelCode}` : 'ค้นหาหรือเลือกรุ่นรถจักรยานยนต์...'}
                </span>
              </div>
              <span className="text-[10px] font-bold text-sky-900 bg-white/90 hover:bg-white px-2.5 py-0.5 rounded-full shrink-0 shadow-2xs transition-all group-hover:scale-105">
                เลือกรุ่นรถ
              </span>
            </button>
          </div>
        </div>

        {/* In-App PWA Install Banner */}
        <div className="pt-2 px-2 sm:px-4">
          <InstallAppBanner />
        </div>

        {/* Selected Bike Banner if active */}
        {(selectedBike || bikeModelCode) && (
          <div className="mx-2 sm:mx-4 mt-1.5 px-3.5 py-2 bg-gradient-to-r from-sky-50 via-white to-cyan-50 rounded-2xl border border-sky-100 flex items-center justify-between text-xs shadow-2xs">
            <div className="flex items-center gap-1.5 truncate">
              <Sparkles className="w-3.5 h-3.5 text-cyan-600 flex-shrink-0" />
              <span className="text-slate-500 font-medium">รุ่นที่เลือก:</span>
              <span className="font-bold text-sky-950 truncate">
                {selectedBike?.name || 'รถจักรยานยนต์'}
              </span>
              {bikeModelCode && (
                <span className="font-mono text-[10px] font-bold text-sky-800 bg-white px-2 py-0.5 rounded-full border border-sky-200 ml-1">
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
          className={`flex-1 overflow-y-auto px-2 sm:px-4 md:px-5 py-3 sm:py-4 space-y-3 sm:space-y-3.5 ${
            viewMode === 'dashboard' ? 'grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 space-y-0' : ''
          }`}
        >
          {/* Left Column / Input Controls */}
          <div
            className={`space-y-3 sm:space-y-3.5 ${
              viewMode === 'dashboard' ? 'lg:col-span-6 xl:col-span-5' : ''
            }`}
          >
            {/* Input Form Card - Frosted Glass */}
            <div className="glass-card-primary rounded-2xl p-2.5 sm:p-4 space-y-3 relative overflow-hidden">
              {/* Officer Name & Code & Broker License Card (ช่องใส่ชื่อ โค้ด และเลขที่ใบอนุญาตนายหน้าประกันวินาศภัย) */}
              <div
                data-card-id="officer"
                className="p-3 sm:p-3.5 rounded-2xl glass-panel-blue space-y-2.5 relative overflow-hidden elevated-data-box elevated-box-blue"
              >
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent opacity-90 pointer-events-none" />
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-slate-800 font-bold flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-blue-700 flex-shrink-0" />
                    <span>ข้อมูลเจ้าหน้าที่ / ผู้เสนอราคา</span>
                  </label>
                  <span className="text-[9.5px] font-bold text-blue-700 bg-white/80 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-blue-200/80 shadow-2xs">
                    ลงชื่อในใบเสนอราคา & เอกสาร
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
                  <div className="col-span-12">
                    <label className="block text-[10px] text-slate-600 font-medium mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1 font-semibold text-blue-950">
                        <Award className="w-3 h-3 text-amber-600" />
                        เลขที่ใบอนุญาตนายหน้าประกันวินาศภัย
                      </span>
                      <span className="text-[9px] text-slate-400 font-normal">
                        (สำหรับตารางความคุ้มครอง Group PA)
                      </span>
                    </label>
                    <input
                      type="text"
                      value={officerLicense}
                      onChange={(e) => handleOfficerLicenseChange(e.target.value)}
                      placeholder="ใส่เลขที่ใบอนุญาตนายหน้าประกันวินาศภัย (เช่น 620400xxxx)"
                      className="w-full glass-input-field rounded-xl px-2.5 py-1.5 text-xs text-blue-950 font-semibold font-mono outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Customer Information Card (กล่องใส่ข้อมูลลูกค้า: ชื่อและเบอร์โทร) */}
              <div
                data-card-id="customer"
                className="p-3 sm:p-3.5 rounded-2xl glass-panel-emerald space-y-2.5 relative overflow-hidden elevated-data-box elevated-box-emerald"
              >
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent opacity-90 pointer-events-none" />
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-slate-800 font-bold flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
                    <span>ข้อมูลลูกค้า</span>
                  </label>
                  <span className="text-[9.5px] font-bold text-emerald-800 bg-white/80 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-emerald-200/80 shadow-2xs">
                    แสดงในใบเสนอราคา & LINE
                  </span>
                </div>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-7 sm:col-span-7">
                    <label className="block text-[10px] text-slate-500 font-medium mb-1">
                      ชื่อลูกค้า
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => handleCustomerNameChange(e.target.value)}
                      placeholder="ใส่ชื่อลูกค้า (เช่น คุณสมชาย)"
                      className="w-full glass-input-field rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-bold outline-none"
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
                      className="w-full glass-input-field rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-bold font-mono outline-none"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                  <span className="text-slate-400">แสดงในเอกสาร:</span>
                  <span className="font-semibold text-emerald-950 truncate">
                    {customerDisplay}
                  </span>
                </div>
              </div>

              {/* Vehicle & Proposal Information Card (กล่องข้อมูลรถเหมือนกับกล่องข้อมูลเจ้าหน้าที่) */}
              <div
                data-card-id="pricing"
                className="p-3 sm:p-3.5 rounded-2xl glass-panel-blue space-y-2.5 relative overflow-hidden elevated-data-box elevated-box-blue"
              >
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent opacity-90 pointer-events-none" />
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-slate-800 font-bold flex items-center gap-1.5">
                    <Bike className="w-3.5 h-3.5 text-blue-700 flex-shrink-0" />
                    <span>ข้อมูลรถและเงื่อนไขข้อเสนอ</span>
                  </label>
                  <span className="text-[9.5px] font-bold text-blue-700 bg-white/80 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-blue-200/80 shadow-2xs">
                    รุ่นรถ & ราคารถตัวเปล่า
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
                </div>
              </div>

              {/* PA Insurance Protection Selection (แผน A vs แผน B) */}
              <div
                data-card-id="insurance"
                className="p-3 sm:p-3.5 rounded-2xl glass-panel-amber space-y-2 relative overflow-hidden elevated-data-box elevated-box-amber"
              >
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent opacity-90 pointer-events-none" />
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
                        : 'glass-pill text-slate-600 hover:bg-white/80'
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
                        : 'glass-pill text-blue-900 hover:bg-white/80'
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
                        : 'glass-pill text-amber-900 hover:bg-white/80'
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
                              : 'glass-pill text-slate-700 hover:bg-white/80'
                          }`}
                        >
                          <div>{y} ปี</div>
                          <div className="text-[10px] font-normal opacity-90">
                            +{formatBaht(activeInsurancePlan.premiums[y])}
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="p-2.5 rounded-xl glass-mini-card text-[11px] text-blue-950 space-y-1">
                      <div className="flex justify-between items-center font-bold">
                        <span>{currentCalculation.insurancePlanName}:</span>
                        <span className="text-blue-700 font-extrabold">
                          +{formatBaht(currentCalculation.insuranceTotalWithVat, true)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200/50">
                        <span>เบี้ยสุทธิ {formatBaht(currentCalculation.insuranceBasePremium)} + VAT 7% ({formatBaht(currentCalculation.insuranceVat, true)})</span>
                        <span className="text-blue-800 font-medium">รวมในยอดจัดไฟแนนซ์</span>
                      </div>
                    </div>

                  </div>
                )}
              </div>

              {/* Financing Terms Card (กล่องข้อมูลเงินดาวน์และยอดจัดไฟแนนซ์ - ยุบเก็บได้และปิดอัตโนมัติเมื่อกดกล่องอื่น) */}
              <div
                data-card-id="financing"
                className="p-3 sm:p-3.5 rounded-2xl glass-panel-blue relative overflow-hidden elevated-data-box elevated-box-blue transition-all duration-200"
              >
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent opacity-90 pointer-events-none" />

                {/* Collapsible Header: นำป้าย 'ยอดจัด & ระยะเวลาผ่อน' ออกตามที่ระบุในรูป */}
                <div
                  data-card-toggle="true"
                  onClick={() => {
                    triggerHaptic('light');
                    setExpandedCard((prev) => (prev === 'financing' ? null : 'financing'));
                  }}
                  className={`flex items-center justify-between gap-2 cursor-pointer select-none transition-all ${
                    expandedCard === 'financing' ? 'pb-2.5 border-b border-blue-200/60' : 'pb-0'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-2xs shrink-0">
                      <Banknote className="w-4 h-4 text-blue-700" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="text-[11px] sm:text-xs text-slate-800 font-bold flex items-center gap-1.5 cursor-pointer">
                          <span>ข้อมูลเงินดาวน์และยอดจัดไฟแนนซ์</span>
                        </label>
                        {expandedCard !== 'financing' && (
                          <span className="text-[9.5px] font-semibold text-blue-700 bg-white/90 px-2 py-0.5 rounded-full border border-blue-200 shadow-2xs">
                            คลิกเพื่อขยาย
                          </span>
                        )}
                      </div>
                      {expandedCard !== 'financing' && (
                        <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-600 mt-0.5 font-medium">
                          <span className="text-emerald-700 font-bold">
                            ดาวน์ {formatBaht(currentCalculation.downAmount)} ({currentCalculation.downPercent.toFixed(1)}%)
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-blue-800 font-bold">
                            ผ่อน {term} งวด
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-700 font-bold">
                            จัด {formatBaht(currentCalculation.financeAmount, true)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerHaptic('light');
                      setExpandedCard((prev) => (prev === 'financing' ? null : 'financing'));
                    }}
                    className="p-1.5 rounded-xl bg-white/90 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer border border-slate-200/80 shadow-2xs shrink-0"
                    title={expandedCard === 'financing' ? 'ย่อกล่อง' : 'ขยายกล่อง'}
                  >
                    {expandedCard === 'financing' ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {expandedCard === 'financing' && (
                  <div className="space-y-2.5 pt-2.5 animate-fade-in">

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
                      className="text-[10px] font-bold text-blue-700 hover:text-blue-900 bg-white/80 backdrop-blur-md px-2 py-0.5 rounded-lg border border-blue-200/60 transition-colors cursor-pointer shadow-2xs"
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
                    value={downValue === 0 ? '' : downValue}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : Number(e.target.value);
                      setDownValue(isNaN(val) ? 0 : val);
                    }}
                    placeholder="0"
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

                {/* ราคายอดจัด (คำนวณและแสดงผลชัดเจนทันทีหลังใส่เงินดาวน์) */}
                <div className="p-2.5 rounded-xl glass-mini-card space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-bold text-slate-700 flex items-center gap-1.5">
                      <Banknote className="w-3.5 h-3.5 text-blue-700" />
                      <span>ราคายอดจัด (หลังหักเงินดาวน์):</span>
                    </span>
                    <span className="text-sm font-black text-blue-900 font-mono">
                      {formatBaht(currentCalculation.vehicleFinanceAmount)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/50 text-[10px]">
                    <div>
                      <span className="text-slate-400 block">ยอดจัดเฉพาะตัวรถ:</span>
                      <span className="font-bold text-slate-800">
                        {formatBaht(currentCalculation.vehicleFinanceAmount)}
                      </span>
                      <span className="text-[9px] text-slate-400 block truncate">
                        (ราคารถ - เงินดาวน์ {formatBaht(currentCalculation.downAmount)})
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block">ยอดจัดไฟแนนซ์รวม:</span>
                      <span className="font-extrabold text-blue-700">
                        {formatBaht(currentCalculation.financeAmount, true)}
                      </span>
                      <span className="text-[9px] text-blue-600 block">
                        {currentCalculation.insuranceTotalWithVat > 0 ? '(รวม PA+VAT)' : '(ยอดจัดสุทธิ)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Visual Ratio Bar (เงินดาวน์ vs ยอดจัด) */}
                <div className="pt-0.5 space-y-1">
                  <div className="h-2 w-full bg-slate-200/80 rounded-full overflow-hidden flex p-0.5 border border-slate-300/50 shadow-inner">
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
                      ดาวน์ {currentCalculation.downPercent.toFixed(1)}% ({formatBaht(currentCalculation.downAmount)})
                    </span>
                    <span className="flex items-center gap-1 text-blue-900">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block" />
                      จัด {(100 - currentCalculation.downPercent).toFixed(1)}% ({formatBaht(currentCalculation.vehicleFinanceAmount)})
                    </span>
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
                          {t} งวด ({formatTermYearMonth(t)})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Interest Rate Comparison & Custom Rate Editor: ฟังก์ชั่นแก้ไขดอกเบี้ยตามระบบบริษัท */}
                <div className="space-y-2 pt-0.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <label className="block text-[11px] text-slate-700 font-bold">
                        หลักเกณฑ์อัตราดอกเบี้ยที่ใช้
                      </label>
                      {isCustomRateEnabled && (
                        <span className="text-[9.5px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded-full border border-amber-300 flex items-center gap-0.5 shadow-2xs">
                          <Pencil className="w-2.5 h-2.5 text-amber-700" /> ระบุเอง
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isCustomRateEnabled ? (
                        <button
                          type="button"
                          onClick={handleResetToProposalRate}
                          className="text-[10px] text-amber-800 hover:text-amber-950 font-bold px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                          title="รีเซ็ตกลับเป็นอัตราตามเงื่อนไข Proposal เดิม"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          <span>รีเซ็ตตาม Proposal</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleToggleCustomRate}
                          className="text-[10px] text-blue-700 hover:text-blue-900 font-bold px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                          title="คลิกเพื่อแก้ไขอัตราดอกเบี้ยให้ตรงกับระบบบริษัท"
                        >
                          <Pencil className="w-2.5 h-2.5" />
                          <span>แก้ไขดอกเบี้ย (ระบบบริษัท)</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Panel แก้ไขอัตราดอกเบี้ยเมื่อเปิดใช้งาน (Custom Interest Rate Editor) */}
                  {isCustomRateEnabled && (
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-50/95 via-orange-50/90 to-amber-100/60 border-2 border-amber-400/90 shadow-sm space-y-2.5 animate-fade-in elevated-data-box elevated-box-amber">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-xs shadow-xs shrink-0">
                            %
                          </div>
                          <div>
                            <div className="text-[11.5px] font-bold text-amber-950 flex items-center gap-1">
                              แก้ไขดอกเบี้ยให้ตรงระบบบริษัท
                            </div>
                            <div className="text-[9.5px] text-amber-800 leading-tight">
                              ปรับเรทดอกเบี้ยสำหรับเคสพิเศษหรือระบบบริษัทที่ตัวเลขไม่ตรง
                            </div>
                          </div>
                        </div>

                        {/* Switch Type: % ต่อเดือน vs % ต่อปี */}
                        <div className="flex items-center p-0.5 bg-amber-200/70 rounded-xl border border-amber-300/80 text-[10px] shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCustomRateTypeChange('monthly')}
                            className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                              customRateType === 'monthly'
                                ? 'bg-white text-amber-950 shadow-xs'
                                : 'text-amber-800 hover:text-amber-950'
                            }`}
                          >
                            % ต่อเดือน
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCustomRateTypeChange('annual')}
                            className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                              customRateType === 'annual'
                                ? 'bg-white text-amber-950 shadow-xs'
                                : 'text-amber-800 hover:text-amber-950'
                            }`}
                          >
                            % ต่อปี
                          </button>
                        </div>
                      </div>

                      {/* Number Input - ปรับปรุงโครงสร้างให้กว้าง ไม่ซ้อนทับกัน */}
                      <div className="space-y-1.5">
                        <div className="flex items-center bg-white rounded-xl border-2 border-amber-400 focus-within:border-amber-600 focus-within:ring-2 focus-within:ring-amber-300 shadow-inner px-3 py-1.5 transition-all">
                          <label className="text-xs font-bold text-amber-900 mr-2 shrink-0 select-none">
                            อัตราดอกเบี้ย:
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            max="100"
                            value={customRateInput}
                            onChange={(e) => handleCustomRateChange(e.target.value)}
                            placeholder={customRateType === 'monthly' ? '1.10' : '6.50'}
                            className="flex-1 text-center text-lg font-black text-slate-900 outline-none bg-transparent min-w-0"
                          />
                          <span className="text-xs font-bold text-amber-900 bg-amber-100/90 px-2.5 py-1 rounded-lg border border-amber-300/80 shrink-0 ml-2 select-none whitespace-nowrap">
                            {customRateType === 'monthly' ? '% ต่อเดือน' : '% ต่อปี'}
                          </span>
                        </div>

                        {/* ปุ่มปรับละเอียด +/- 0.01 และ +/- 0.05 */}
                        <div className="flex items-center justify-between gap-1.5 pt-0.5">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleAdjustRate(-0.05)}
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 active:scale-95 border border-amber-300 text-amber-900 font-bold text-xs transition-all cursor-pointer shadow-2xs"
                              title="ลดลง 0.05%"
                            >
                              -0.05%
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdjustRate(-0.01)}
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 active:scale-95 border border-amber-300 text-amber-900 font-bold text-xs transition-all cursor-pointer shadow-2xs"
                              title="ลดลง 0.01%"
                            >
                              -0.01%
                            </button>
                          </div>

                          <span className="text-[10px] text-amber-800 font-medium select-none">
                            ปุ่มปรับละเอียด
                          </span>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleAdjustRate(0.01)}
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 active:scale-95 border border-amber-300 text-amber-900 font-bold text-xs transition-all cursor-pointer shadow-2xs"
                              title="เพิ่มขึ้น 0.01%"
                            >
                              +0.01%
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdjustRate(0.05)}
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 active:scale-95 border border-amber-300 text-amber-900 font-bold text-xs transition-all cursor-pointer shadow-2xs"
                              title="เพิ่มขึ้น 0.05%"
                            >
                              +0.05%
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Quick Preset Chips */}
                      <div className="space-y-1">
                        <div className="text-[10px] text-amber-900 font-semibold flex items-center justify-between">
                          <span>แตะเพื่อเลือกเรทดอกเบี้ยยอดนิยม:</span>
                          <span className="text-[9.5px] text-amber-800">
                            {customRateType === 'monthly' ? 'Flat Rate รายเดือน' : 'อัตราต่อปี'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(customRateType === 'monthly'
                            ? [0.99, 1.05, 1.06, 1.07, 1.08, 1.09, 1.1, 1.15, 1.19, 1.2, 1.25, 1.29, 1.35, 1.49, 1.59]
                            : [4.5, 5.0, 5.5, 6.0, 6.5, 6.75, 7.0, 7.5, 8.0, 9.0]
                          ).map((presetRate) => {
                            const isSelected = parseFloat(customRateInput) === presetRate;
                            return (
                              <button
                                key={presetRate}
                                type="button"
                                onClick={() => handleQuickSelectRate(presetRate)}
                                className={`text-[10px] px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-amber-600 text-white shadow-2xs scale-105'
                                    : 'bg-white hover:bg-amber-100/90 text-amber-900 border border-amber-200'
                                }`}
                              >
                                {presetRate.toFixed(2)}%
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Compliance & EIR Information */}
                      <div className="pt-1.5 border-t border-amber-200/80 flex flex-wrap items-center justify-between gap-1 text-[10px]">
                        <span className="text-amber-950 font-medium">
                          EIR สัญญานี้: <strong className="text-amber-950 font-black">{currentCalculation.eirAnnualPercent.toFixed(2)}% ต่อปี</strong>{' '}
                          {currentCalculation.eirAnnualPercent <= 23 ? (
                            <span className="text-emerald-700 font-bold">(✓ ไม่เกิน 23%)</span>
                          ) : (
                            <span className="text-amber-800 font-bold">(คำนวณตามเรทที่ระบุ)</span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 cursor-pointer text-amber-950 font-medium">
                            <input
                              type="checkbox"
                              checked={enforceEirCap}
                              onChange={(e) => setEnforceEirCap(e.target.checked)}
                              className="rounded border-amber-400 text-amber-600 focus:ring-amber-500 w-3 h-3 cursor-pointer"
                            />
                            <span>คุมเพดาน EIR 23%</span>
                          </label>
                          <button
                            type="button"
                            onClick={handleResetToProposalRate}
                            className="text-amber-800 underline hover:text-amber-950 font-bold cursor-pointer"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* ช่องตาม Proposal (ซ้าย) */}
                    <div
                      className={`rounded-xl p-2.5 transition-all ${
                        isCustomRateEnabled
                          ? 'glass-mini-card opacity-85'
                          : currentCalculation.isCappedByEir
                          ? 'glass-panel-amber'
                          : 'glass-mini-card'
                      }`}
                    >
                      <div className="text-[10.5px] font-semibold text-slate-700 mb-1 leading-snug">
                        อัตราดอกเบี้ย (%) <span className="text-rose-500">*</span>{' '}
                        <span className="text-amber-600 font-bold">ตาม Proposal ดั้งเดิม</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-base font-black text-slate-800">
                          {(currentCalculation.proposalMonthlyRate * 100).toFixed(3)}
                          <span className="text-[11px] font-normal text-slate-500 ml-1">% / เดือน</span>
                        </div>
                        {isCustomRateEnabled ? (
                          <span className="text-slate-600 text-[9.5px] bg-slate-200/80 px-1.5 py-0.5 rounded font-bold">
                            เรทเดิม
                          </span>
                        ) : currentCalculation.isCappedByEir ? (
                          <span className="text-amber-800 text-[9.5px] bg-amber-200/80 px-1.5 py-0.5 rounded font-bold">
                            เกินเพดาน
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {isCustomRateEnabled
                          ? 'ระบบคำนวณตามเรทที่คุณระบุเองด้านขวาแทน'
                          : `ขออัตรา ${(currentCalculation.proposalMonthlyRate * 100).toFixed(3)}% ตามเงื่อนไข Proposal`}
                      </div>
                    </div>

                    {/* ช่องที่ใช้คำนวณจริง (ขวา) */}
                    <div
                      className={`rounded-xl p-2.5 transition-all ${
                        isCustomRateEnabled
                          ? 'glass-panel-amber ring-2 ring-amber-500/50'
                          : currentCalculation.isCappedByEir
                          ? 'glass-panel-emerald ring-2 ring-emerald-500/25'
                          : 'glass-panel-blue'
                      }`}
                    >
                      <div className="text-[10.5px] font-semibold text-slate-700 mb-1 leading-snug flex items-center justify-between">
                        <span>
                          อัตราดอกเบี้ย (%) <span className="text-rose-500">*</span>{' '}
                          <span className={isCustomRateEnabled ? 'text-amber-800 font-bold' : 'text-amber-600 font-bold'}>
                            {isCustomRateEnabled ? 'กำหนดเอง (ระบบบริษัท)' : currentCalculation.eirMaxMessage}
                          </span>
                        </span>
                        {!isCustomRateEnabled && (
                          <button
                            type="button"
                            onClick={handleToggleCustomRate}
                            className="text-[9.5px] text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer"
                          >
                            แก้ไขเรท
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div
                          className={`text-base font-black flex items-center gap-1 ${
                            isCustomRateEnabled ? 'text-amber-950' : 'text-emerald-700'
                          }`}
                        >
                          {isCustomRateEnabled ? (
                            <Pencil className="w-3.5 h-3.5 text-amber-600 inline" />
                          ) : (
                            <Lock className="w-3.5 h-3.5 text-emerald-600 inline" />
                          )}
                          {(currentCalculation.effectiveMonthlyRate * 100).toFixed(3)}
                          <span
                            className={`text-[11px] font-normal ml-1 ${
                              isCustomRateEnabled ? 'text-amber-800' : 'text-emerald-800'
                            }`}
                          >
                            % / เดือน
                          </span>
                        </div>
                        <span
                          className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${
                            isCustomRateEnabled
                              ? 'bg-amber-200 text-amber-950'
                              : 'bg-emerald-200 text-emerald-900'
                          }`}
                        >
                          {isCustomRateEnabled ? 'ใช้คำนวณจริง' : 'บังคับใช้จริง'}
                        </span>
                      </div>
                      <div
                        className={`text-[10px] font-medium mt-0.5 ${
                          isCustomRateEnabled ? 'text-amber-900 font-semibold' : 'text-emerald-800'
                        }`}
                      >
                        {isCustomRateEnabled
                          ? 'ตรงตามระบบบริษัทที่กำหนด ค่างวดคำนวณตามเรทนี้'
                          : 'อัตราสูงสุดที่ไม่เกินเพดาน EIR 23%'}
                      </div>
                    </div>
                  </div>

                  {/* Explanation Callout when Capped (only if not customized or if enforceEirCap is on) */}
                  {currentCalculation.isCappedByEir && (
                    <div className="p-2.5 rounded-xl glass-panel-amber text-[11px] text-amber-950 space-y-1 shadow-xs animate-fade-in">
                      <div className="flex items-start gap-1.5 font-bold text-amber-900">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <span>ทำไมถึงต้องใช้ {(currentCalculation.effectiveMonthlyRate * 100).toFixed(3)}% :</span>
                      </div>
                      <p className="text-[10.5px] text-amber-900/90 leading-relaxed pl-5">
                        เนื่องจากตามเงื่อนไขของเคสนี้ (ราคารถ {formatBaht(currentCalculation.baseVehiclePrice)}, เงินดาวน์ {formatBaht(currentCalculation.downAmount)} และระยะเวลาผ่อน {term} งวด) หากใช้ดอกเบี้ย {(currentCalculation.proposalMonthlyRate * 100).toFixed(3)}% จะทำให้อัตราดอกเบี้ยที่แท้จริงต่อปี (EIR) สูงเกินเพดานกฎหมายกำหนด (ไม่เกิน 23% ต่อปี) ระบบจึงทำการล็อกและบังคับให้ใช้อัตราสูงสุดที่ไม่ผิดกฎหมาย คือ <strong className="text-emerald-800 underline font-bold">{(currentCalculation.effectiveMonthlyRate * 100).toFixed(3)}%</strong> แทน เพื่อให้ชุดข้อมูลชุดนี้ผ่านเกณฑ์การอนุมัติครับ
                      </p>
                      <div className="pl-5 pt-0.5 flex items-center justify-between">
                        <span className="text-[10px] text-amber-800 font-medium">
                          EIR สัญญานี้: {currentCalculation.eirAnnualPercent.toFixed(2)}% ต่อปี (ผ่านเกณฑ์)
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowEirInfo(true)}
                          className="text-[10px] text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer"
                        >
                          อ่านเกณฑ์ควบคุมทั้งหมด →
                        </button>
                      </div>
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
                    <div className="mt-2 p-2.5 glass-mini-card text-xs space-y-2 elevated-data-box">
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
            )}
          </div>

              {/* Action Buttons: 2 beautiful, modern primary action buttons */}
              <div data-card-id="actions" className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 1. Coverage Plan Button */}
                <button
                  type="button"
                  onClick={() => setShowInsuranceDoc(true)}
                  className="group relative overflow-hidden btn-fluid-primary py-3 px-4 rounded-2xl font-bold transition-all flex items-center justify-between cursor-pointer border border-white/30"
                  title="ดาวน์โหลดแผนความคุ้มครองประกันภัย (Group PA)"
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <ShieldCheck className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div>
                      <div className="text-xs font-bold leading-tight flex items-center gap-1.5 text-white">
                        แผนความคุ้มครอง
                        <span className="text-[10px] bg-white/25 text-white px-2 py-0.2 rounded-full font-semibold">
                          รูปภาพ
                        </span>
                      </div>
                      <div className="text-[10.5px] text-white/90 font-normal leading-tight mt-0.5">
                        {cleanPlanNameForLine(currentCalculation.insurancePlanName)} ({insuranceYears} ปี)
                      </div>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-white group-hover:translate-y-0.5 transition-transform shrink-0" />
                </button>

                {/* 2. Quotation Button */}
                <button
                  type="button"
                  onClick={() => setShowQuotation(true)}
                  className="group relative overflow-hidden bg-gradient-to-r from-slate-900 via-sky-950 to-blue-950 hover:opacity-95 active:scale-[0.98] text-white py-3 px-4 rounded-2xl font-bold shadow-lg shadow-slate-900/20 transition-all flex items-center justify-between cursor-pointer border border-white/10"
                  title="ดูและดาวน์โหลดใบเสนอราคาเช่าซื้อ (Quotation)"
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <FileText className="w-4.5 h-4.5 text-cyan-300" />
                    </div>
                    <div>
                      <div className="text-xs font-bold leading-tight flex items-center gap-1.5 text-white">
                        ใบเสนอราคา
                        <span className="text-[10px] bg-cyan-400/25 text-cyan-200 px-2 py-0.2 rounded-full font-semibold">
                          รูปภาพ
                        </span>
                      </div>
                      <div className="text-[10.5px] text-slate-300 font-normal leading-tight mt-0.5">
                        งวดละ {formatBaht(currentCalculation.monthlyInstallment)} บ.
                      </div>
                    </div>
                  </div>
                  <Printer className="w-4 h-4 text-slate-300 group-hover:scale-110 transition-transform shrink-0" />
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
            {/* Result Hero Card - Frosted Glassmorphism Masterpiece matching Reference UI */}
            <div data-card-id="result" className="glass-card-hero rounded-[28px] p-4 text-center relative overflow-hidden">
              {/* Subtle top specular sheen */}
              <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent opacity-95 pointer-events-none" />

              {/* Proposal Code Badge & Insurance Badge */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 mb-1.5">
                <span className="inline-block bg-white/85 backdrop-blur-md text-sky-800 border border-sky-200/80 px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wide shadow-2xs">
                  {currentCalculation.proposalCode}
                </span>
                {currentCalculation.insurancePremium > 0 && (
                  <span className="inline-flex items-center gap-1 bg-amber-50/85 backdrop-blur-md text-amber-800 border border-amber-200 px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wide shadow-2xs">
                    <ShieldCheck className="w-3 h-3 text-amber-600" />
                    {currentCalculation.insurancePlanName}
                  </span>
                )}
                {isCustomRateEnabled && (
                  <span className="inline-flex items-center gap-1 bg-amber-100/90 backdrop-blur-md text-amber-950 border border-amber-300 px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wide shadow-2xs">
                    <Pencil className="w-2.5 h-2.5 text-amber-700" />
                    ดอกเบี้ยกำหนดเอง: {currentCalculation.rateDisplayText}
                  </span>
                )}
                {currentCalculation.minInterestApplied && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-rose-700 bg-rose-50/85 backdrop-blur-md border border-rose-200 px-2.5 py-0.5 rounded-full font-semibold">
                    <ShieldAlert className="w-3 h-3" /> ดอกเบี้ยขั้นต่ำ
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-500 font-medium tracking-wide">
                ค่างวดต่อเดือน (รวมภาษีมูลค่าเพิ่ม 7%)
              </p>

              {/* Monthly Installment Highlight with Cyan-Blue Accent */}
              <div className="text-3xl sm:text-4xl font-black text-[#0284c7] my-1.5 tracking-tight drop-shadow-xs">
                {formatBaht(currentCalculation.monthlyInstallment)}
                <span className="text-xs font-normal text-slate-500 ml-1.5">/เดือน</span>
              </div>

              {/* Installment Rounding Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/70 backdrop-blur-md border border-cyan-200/80 text-[10px] text-cyan-900 font-semibold mb-1 shadow-2xs">
                <span>ปัดเศษลงท้าย 0 หรือ 5 (ระบบ Next Capital)</span>
                {currentCalculation.rawMonthlyInstallment !== currentCalculation.monthlyInstallment && (
                  <span className="text-slate-400 font-normal">
                    (เดิม {currentCalculation.rawMonthlyInstallment.toFixed(2)} บ.)
                  </span>
                )}
              </div>

              <p className="text-[10px] text-slate-500 font-medium max-w-xs mx-auto truncate">
                {currentCalculation.remarkText}
              </p>

              {/* Summary Grid - Translucent Glass Mini Cards */}
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-sky-100/80 text-left text-[11px]">
                <div className="glass-mini-card p-2.5 rounded-2xl">
                  <div className="text-[10px] text-slate-400 font-medium">ยอดจัดไฟแนนซ์รวม:</div>
                  <span className="font-bold text-slate-900 text-xs">
                    {formatBaht(currentCalculation.financeAmount, true)}
                  </span>
                  {currentCalculation.insuranceTotalWithVat > 0 ? (
                    <div className="text-[9px] text-sky-700 font-semibold truncate">
                      (รถ {formatBaht(currentCalculation.vehicleFinanceAmount)} + PA+VAT {formatBaht(currentCalculation.insuranceTotalWithVat, true)})
                    </div>
                  ) : (
                    <div className="text-[9px] text-slate-500">
                      (ยอดจัดตัวรถ)
                    </div>
                  )}
                </div>
                <div className="glass-mini-card p-2.5 rounded-2xl">
                  <div className="text-[10px] text-slate-400 font-medium">ดอกเบี้ยรายเดือน:</div>
                  <span className="font-bold text-slate-900 text-xs">
                    {formatBaht(currentCalculation.monthlyInterest, true)} /งวด
                  </span>
                  <div className="text-[9px] text-slate-500">
                    รวมทั้งสัญญา: {formatBaht(currentCalculation.totalInterest, true)}
                  </div>
                </div>
                <div className="glass-mini-card p-2.5 rounded-2xl">
                  <div className="text-[10px] text-slate-400 font-medium">ยอดรวมทั้งสัญญา:</div>
                  <span className="font-bold text-slate-900 text-xs">
                    {formatBaht(currentCalculation.totalWithVat, true)}
                  </span>
                  <div className="text-[9px] text-slate-500">
                    (ยอดจัด + ดอกเบี้ยรวม)
                  </div>
                </div>
                <div className="glass-mini-card p-2.5 rounded-2xl">
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
                <div className="mt-2.5 p-2.5 glass-panel-amber rounded-2xl text-left flex justify-between items-center text-xs shadow-2xs">
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


            </div>

            {/* Term Comparisons Table */}
            <div data-card-id="comparison">
              <TermComparisonTable
                comparisons={comparisons}
                selectedTerm={term}
                onSelectTerm={(newTerm) => setTerm(newTerm)}
                onOpenEirInfo={() => setShowEirInfo(true)}
                isExpanded={expandedCard === 'comparison'}
                onToggleExpand={() => {
                  setExpandedCard((prev) => (prev === 'comparison' ? null : 'comparison'));
                }}
              />
            </div>

            {/* DV Case Approval Box (กล่องขออนุมัติเคส DV พร้อมส่ง Line) */}
            <div data-card-id="dv">
              <DvApprovalCard
                customerName={customerName}
                bikeModelName={
                  selectedBike?.name ||
                  (bikeModelCode
                    ? MOTORCYCLE_MODELS.find(
                        (m) => m.code.toUpperCase() === bikeModelCode.trim().toUpperCase()
                      )?.name || ''
                    : '')
                }
                bikeModelCode={bikeModelCode}
                downPaymentDisplay={
                  currentCalculation.downAmount === 0
                    ? '0 บาท (ฟรีดาวน์ 0%)'
                    : `${formatBaht(currentCalculation.downAmount)} (${currentCalculation.downPercent.toFixed(1)}%)`
                }
                financeAmount={currentCalculation.financeAmount}
                monthlyInstallment={currentCalculation.monthlyInstallment}
                term={term}
                officerName={officerName}
                officerCode={officerCode}
                officerDisplay={officerDisplay}
                onUpdateCustomerName={handleCustomerNameChange}
                isExpanded={expandedCard === 'dv'}
                onToggleExpand={() => {
                  setExpandedCard((prev) => (prev === 'dv' ? null : 'dv'));
                }}
              />
            </div>

            {/* Daily Dealer Finance Report Box (กล่องรายงานประจำวันยอดเคสไฟแนนซ์ราย Dealer พร้อมส่ง Line) */}
            <div data-card-id="daily_report">
              <DailyFinanceReportCard
                officerName={officerName}
                officerCode={officerCode}
                officerDisplay={officerDisplay}
                isExpanded={expandedCard === 'daily_report'}
                onToggleExpand={() => {
                  setExpandedCard((prev) => (prev === 'daily_report' ? null : 'daily_report'));
                }}
              />
            </div>
          </div>
        </main>

        {/* Bottom Bar Info matching Reference Dock */}
        <footer className="px-4 sm:px-6 py-2.5 sm:py-3 bg-white/90 border-t border-sky-100 backdrop-blur-xl text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2 shadow-inner">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            <span className="font-semibold text-slate-700 text-[11px]">
              ระบบคำนวณค่างวดเช่าซื้อรถจักรยานยนต์
            </span>
          </div>
          <span className="text-[10px] text-sky-800 font-semibold px-2.5 py-0.5 rounded-full bg-sky-50 border border-sky-200">
            พัฒนาระบบโดย Bordin 6683
          </span>
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
