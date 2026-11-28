/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Info,
  Layers,
  Moon,
  Search,
  Sun,
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
  Home,
  Calculator,
  ArrowRight,
  ArrowLeft,
  FolderArchive,
  BookmarkPlus,
  Save,
  X,
  FileCheck,
  Eye,
  Copy,
  Image as ImageIcon,
  Building2,
  CalendarDays,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Cloud,
  RefreshCw,
  ScanLine,
  CreditCard,
  MapPin,
  Maximize2,
  Minimize2,
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
import { ProposalKey, DownMode, BikePreset, InsurancePlan, InsuranceYears, CustomRateConfig, SavedCaseRecord } from './types';
import { ProposalInfoModal } from './components/ProposalInfoModal';
import { ProposalSelectModal } from './components/ProposalSelectModal';
import { BikePresetsModal } from './components/BikePresetsModal';
import { QuotationModal } from './components/QuotationModal';
import { ProvisionalApprovalModal } from './components/ProvisionalApprovalModal';
import { InstallmentShareCardModal } from './components/InstallmentShareCardModal';
import { IdCardScannerModal, AppliedThaiIdData } from './components/IdCardScannerModal';
import { CustomerAvatar } from './components/CustomerAvatar';
import {
  formatThaiDateFromIso,
  formatThaiIdDisplay,
  normalizeThaiIdDigits,
  sanitizeCustomerPhotoDataUrl,
  validateThaiNationalId,
} from './utils/thaiIdUtils';
import { AmortizationModal } from './components/AmortizationModal';
import { TermComparisonTable } from './components/TermComparisonTable';
import { DvApprovalCard } from './components/DvApprovalCard';
import { DailyFinanceReportCard, COMMON_DEALER_SUGGESTIONS } from './components/DailyFinanceReportCard';
import { CheckerCommissionCard } from './components/CheckerCommissionCard';
import { PeriodClosingReportCard } from './components/PeriodClosingReportCard';
import { NextCapitalLogo } from './components/NextCapitalLogo';
import { InsuranceComparisonModal } from './components/InsuranceComparisonModal';
import { InsuranceDocModal } from './components/InsuranceDocModal';
import { EirInfoModal } from './components/EirInfoModal';
import { SavedCasesModal } from './components/SavedCasesModal';
import {
  getSavedCases,
  saveCaseRecord,
  formatThaiShortDateWithTime,
  formatThaiFullDocumentDate,
} from './utils/savedCasesStorage';
import { InstallAppBanner } from './components/InstallAppBanner';
import { BikeModelCodeInput } from './components/BikeModelCodeInput';
import { MotorcycleModel, MOTORCYCLE_MODELS, findModelByCode } from './data/motorcycleModels';
import { MarqueeText } from './components/MarqueeText';
import { InstallmentTrackingPage } from './components/InstallmentTrackingPage';
import { EligibilityCriteriaModal } from './components/EligibilityCriteriaModal';
import {
  resolveEligibilityTierKey,
  evaluateCustomerEligibility,
  ACE_FULL_NOTE,
} from './data/eligibilityCriteria';
import { useFirebase } from './contexts/FirebaseContext';
import { CloudSyncCard } from './components/CloudSyncCard';
import { HomeDashboard } from './components/HomeDashboard';
import { YearsMonthsInput } from './components/YearsMonthsInput';
import { BoxThemeToggle } from './components/BoxThemeToggle';
import { useBoxTheme } from './utils/boxTheme';

export default function App() {
  const [boxTheme, setBoxTheme] = useBoxTheme();
  const { user: firebaseUser, syncStatus, syncProfileSettings } = useFirebase();
  const [showCloudSyncModal, setShowCloudSyncModal] = useState<boolean>(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
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
    syncProfileSettings({ officerName: val, officerCode, officerLicense, dealerName });
  };

  const handleOfficerCodeChange = (val: string) => {
    setOfficerCode(val);
    try {
      localStorage.setItem('ncap_officer_code', val);
    } catch {
      // ignore
    }
    syncProfileSettings({ officerName, officerCode: val, officerLicense, dealerName });
  };

  const handleOfficerLicenseChange = (val: string) => {
    setOfficerLicense(val);
    try {
      localStorage.setItem('ncap_officer_license', val);
    } catch {
      // ignore
    }
    syncProfileSettings({ officerName, officerCode, officerLicense: val, dealerName });
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

  // Customer Thai National ID Card Info (เก็บในข้อมูลเคส & ซิงค์ Cloud เท่านั้น ไม่แสดงในใบเสนอราคา/LINE)
  const [customerIdCard, setCustomerIdCard] = useState<string>(() => {
    try {
      return normalizeThaiIdDigits(localStorage.getItem('ncap_customer_id_card') ?? '');
    } catch {
      return '';
    }
  });
  const [customerAddress, setCustomerAddress] = useState<string>(() => {
    try {
      return localStorage.getItem('ncap_customer_address') ?? '';
    } catch {
      return '';
    }
  });
  const [customerBirthDate, setCustomerBirthDate] = useState<string>(() => {
    try {
      return localStorage.getItem('ncap_customer_birth_date') ?? '';
    } catch {
      return '';
    }
  });
  const [customerPhotoUrl, setCustomerPhotoUrl] = useState<string>(() => {
    try {
      return sanitizeCustomerPhotoDataUrl(localStorage.getItem('ncap_customer_photo_url')) ?? '';
    } catch {
      return '';
    }
  });
  const [showIdCardDetails, setShowIdCardDetails] = useState<boolean>(false);

  const handleCustomerIdCardChange = (val: string) => {
    const digits = normalizeThaiIdDigits(val);
    setCustomerIdCard(digits);
    try {
      localStorage.setItem('ncap_customer_id_card', digits);
    } catch {}
  };
  const handleCustomerAddressChange = (val: string) => {
    const trimmed = val.slice(0, 500);
    setCustomerAddress(trimmed);
    try {
      localStorage.setItem('ncap_customer_address', trimmed);
    } catch {}
  };
  const handleCustomerBirthDateChange = (val: string) => {
    const clean = val.trim().slice(0, 20);
    setCustomerBirthDate(clean);
    try {
      localStorage.setItem('ncap_customer_birth_date', clean);
    } catch {}
  };
  const handleCustomerPhotoUrlChange = (val?: string) => {
    const clean = sanitizeCustomerPhotoDataUrl(val) ?? '';
    setCustomerPhotoUrl(clean);
    try {
      if (clean) {
        localStorage.setItem('ncap_customer_photo_url', clean);
      } else {
        localStorage.removeItem('ncap_customer_photo_url');
      }
    } catch {}
  };

  // Customer Eligibility Information (อายุ, อายุงาน, รายได้, ระยะเวลาพักอาศัย, อาชีพ, ลูกค้า ACE)
  const [customerAge, setCustomerAge] = useState<string>(() => {
    try {
      return localStorage.getItem('ncap_customer_age') ?? '';
    } catch {
      return '';
    }
  });
  const [customerWorkMonths, setCustomerWorkMonths] = useState<string>(() => {
    try {
      return localStorage.getItem('ncap_customer_work_months') ?? '';
    } catch {
      return '';
    }
  });
  const [customerIncome, setCustomerIncome] = useState<string>(() => {
    try {
      return localStorage.getItem('ncap_customer_income') ?? '';
    } catch {
      return '';
    }
  });
  const [customerResidenceMonths, setCustomerResidenceMonths] = useState<string>(() => {
    try {
      return localStorage.getItem('ncap_customer_residence_months') ?? '';
    } catch {
      return '';
    }
  });
  const [customerOccupation, setCustomerOccupation] = useState<string>(() => {
    try {
      return localStorage.getItem('ncap_customer_occupation') ?? '';
    } catch {
      return '';
    }
  });
  const [isAceCustomer, setIsAceCustomer] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ncap_customer_is_ace') === 'true';
    } catch {
      return false;
    }
  });

  const handleCustomerAgeChange = (val: string) => {
    setCustomerAge(val);
    try {
      localStorage.setItem('ncap_customer_age', val);
    } catch {}
  };
  const handleCustomerWorkMonthsChange = (val: string) => {
    setCustomerWorkMonths(val);
    try {
      localStorage.setItem('ncap_customer_work_months', val);
    } catch {}
  };
  const handleCustomerIncomeChange = (val: string) => {
    setCustomerIncome(val);
    try {
      localStorage.setItem('ncap_customer_income', val);
    } catch {}
  };
  const handleCustomerResidenceMonthsChange = (val: string) => {
    setCustomerResidenceMonths(val);
    try {
      localStorage.setItem('ncap_customer_residence_months', val);
    } catch {}
  };
  const handleCustomerOccupationChange = (val: string) => {
    setCustomerOccupation(val);
    try {
      localStorage.setItem('ncap_customer_occupation', val);
    } catch {}
  };
  const handleIsAceCustomerChange = (nextVal: boolean) => {
    setIsAceCustomer(nextVal);
    try {
      localStorage.setItem('ncap_customer_is_ace', String(nextVal));
    } catch {}
  };

  const customerDisplay = customerName
    ? customerPhone
      ? `${customerName} (${customerPhone})`
      : customerName
    : customerPhone ? `โทร. ${customerPhone}` : 'คุณลูกค้า';

  // Dealer Information (ชื่อร้านตัวแทนจำหน่าย ลิงก์ไปยังใบเสนอราคา ใบอนุมัติ DV และส่วนอื่นๆ)
  const [dealerName, setDealerName] = useState<string>(() => {
    try {
      return localStorage.getItem('ncap_dealer_name') ?? localStorage.getItem('ncap_dv_dealer') ?? '';
    } catch {
      return '';
    }
  });

  const handleDealerNameChange = (val: string) => {
    setDealerName(val);
    try {
      localStorage.setItem('ncap_dealer_name', val);
      localStorage.setItem('ncap_dv_dealer', val);
    } catch {
      // ignore
    }
    syncProfileSettings({ officerName, officerCode, officerLicense, dealerName: val });
  };

  // Modals
  const [showProposalSelector, setShowProposalSelector] = useState<boolean>(false);
  const [showProposalInfo, setShowProposalInfo] = useState<boolean>(false);
  const [showEligibilityCriteriaModal, setShowEligibilityCriteriaModal] = useState<boolean>(false);
  const [showBikePresets, setShowBikePresets] = useState<boolean>(false);
  const [showQuotation, setShowQuotation] = useState<boolean>(false);
  const [showProvisionalApproval, setShowProvisionalApproval] = useState<boolean>(false);
  const [showShareCardModal, setShowShareCardModal] = useState<boolean>(false);
  const [showSchedule, setShowSchedule] = useState<boolean>(false);
  const [showInsuranceDoc, setShowInsuranceDoc] = useState<boolean>(false);
  const [showEirInfo, setShowEirInfo] = useState<boolean>(false);
  const [showSavedCases, setShowSavedCases] = useState<boolean>(false);
  const [showIdCardScanner, setShowIdCardScanner] = useState<boolean>(false);
  const [savedCasesPreferAll, setSavedCasesPreferAll] = useState<boolean>(false);
  const [savedCasesCount, setSavedCasesCount] = useState<number>(() => {
    return getSavedCases().length;
  });
  const [casesRevision, setCasesRevision] = useState<number>(0);
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);
  const [editingCaseTitle, setEditingCaseTitle] = useState<string | null>(null);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  const activeCaseRecord = useMemo<SavedCaseRecord | null>(() => {
    if (!activeCaseId) return null;
    return getSavedCases().find((c) => c.id === activeCaseId) ?? null;
  }, [activeCaseId, casesRevision]);

  const triggerToast = (msg: string) => {
    setToastNotice(msg);
    setTimeout(() => setToastNotice(null), 3500);
  };

  // Keep UI counters and officer/dealer settings updated when Cloud Sync pulls data
  useEffect(() => {
    const handleCasesSynced = () => {
      setSavedCasesCount(getSavedCases().length);
      setCasesRevision((v) => v + 1);
    };
    const handleProfileSynced = (event: Event) => {
      const detail = (event as CustomEvent<{
        officerName?: string;
        officerCode?: string;
        officerLicense?: string;
        dealerName?: string;
      }>).detail;
      if (!detail) return;
      if (detail.officerName && !officerName) setOfficerName(detail.officerName);
      if (detail.officerCode && !officerCode) setOfficerCode(detail.officerCode);
      if (detail.officerLicense && !officerLicense) setOfficerLicense(detail.officerLicense);
      if (detail.dealerName && !dealerName) setDealerName(detail.dealerName);
    };

    window.addEventListener('ncap-cases-synced', handleCasesSynced);
    window.addEventListener('ncap-profile-synced', handleProfileSynced);
    return () => {
      window.removeEventListener('ncap-cases-synced', handleCasesSynced);
      window.removeEventListener('ncap-profile-synced', handleProfileSynced);
    };
  }, [officerName, officerCode, officerLicense, dealerName]);

  // 5-Page Navigation Tab State (โฮมเพจ, เงินดาวน์, ค่างวด, เอกสาร/เคส, เช็คค่างวด)
  type ActivePageTab = 'home' | 'financing' | 'calculation' | 'documents' | 'installments';
  const [activeTab, setActiveTab] = useState<ActivePageTab>('home');
  const [navAnimState, setNavAnimState] = useState<{ key: number; tab: ActivePageTab | null }>({
    key: 0,
    tab: null,
  });
  const mainRef = useRef<HTMLElement>(null);

  const NAV_TABS = [
    {
      id: 'home' as const,
      label: 'โฮมเพจ',
      icon: Home,
    },
    {
      id: 'financing' as const,
      label: 'คำนวณเคส',
      icon: Banknote,
    },
    {
      id: 'calculation' as const,
      label: 'ค่างวด',
      icon: Calculator,
    },
    {
      id: 'documents' as const,
      label: 'เอกสาร/เคส',
      icon: FileText,
    },
    {
      id: 'installments' as const,
      label: 'กำหนดชำระ',
      icon: CalendarDays,
    },
  ];

  const [isOfficerExpanded, setIsOfficerExpanded] = useState<boolean>(
    () => !localStorage.getItem('ncap_officer_name')?.trim()
  );

  const handleTabChange = (newTab: ActivePageTab) => {
    triggerHaptic('selection');
    setNavAnimState((prev) => ({ key: prev.key + 1, tab: newTab }));
    setActiveTab(newTab);
    if (newTab === 'financing') {
      setExpandedCard('financing');
    } else if (newTab === 'calculation') {
      setExpandedCard('comparison');
    } else if (newTab === 'home' || newTab === 'documents' || newTab === 'installments') {
      setExpandedCard(null);
    }
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Collapsible cards state: cards can be expanded or collapsed by clicking their header/toggle
  const [expandedCard, setExpandedCard] = useState<'financing' | 'comparison' | 'dv' | 'daily_report' | 'checker_commission' | 'period_closing' | null>('financing');

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
      } else if (
        !(
          (expandedCard === 'financing' || expandedCard === 'comparison') &&
          target.closest('[data-saas-two-col="true"]')
        )
      ) {
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


  // Layout view mode (Mobile simulator frame vs Fullscreen Dashboard on desktop only)
  const [viewMode, setViewMode] = useState<'mobile' | 'dashboard'>('mobile');
  const [isHandheldViewport, setIsHandheldViewport] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const isCoarsePointer =
      typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    return window.innerWidth < 1280 || (isCoarsePointer && window.innerWidth <= 1440);
  });
  const [isTabletViewport, setIsTabletViewport] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= 768 && window.innerHeight >= 500;
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 1024;
  });

  useEffect(() => {
    const updateViewportMode = () => {
      const isCoarsePointer =
        typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
      setIsHandheldViewport(
        window.innerWidth < 1280 || (isCoarsePointer && window.innerWidth <= 1440)
      );
      setIsTabletViewport(window.innerWidth >= 768 && window.innerHeight >= 500);
    };
    updateViewportMode();
    window.addEventListener('resize', updateViewportMode);
    window.addEventListener('orientationchange', updateViewportMode);
    return () => {
      window.removeEventListener('resize', updateViewportMode);
      window.removeEventListener('orientationchange', updateViewportMode);
    };
  }, []);

  const isTabletWorkspace = isHandheldViewport && isTabletViewport;
  const isSaasWorkspace =
    isTabletWorkspace || (!isHandheldViewport && viewMode === 'dashboard');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    const doc = document as Document & { webkitFullscreenElement?: Element | null };
    return Boolean(document.fullscreenElement || doc.webkitFullscreenElement);
  });

  useEffect(() => {
    const syncFullscreen = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      setIsFullscreen(Boolean(document.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen);
    };
  }, []);

  const handleToggleFullscreen = () => {
    triggerHaptic('selection');
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    const rootEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    const activeEl = document.fullscreenElement || doc.webkitFullscreenElement;
    if (activeEl) {
      if (typeof document.exitFullscreen === 'function') {
        void document.exitFullscreen().catch(() => {});
      } else if (typeof doc.webkitExitFullscreen === 'function') {
        void Promise.resolve(doc.webkitExitFullscreen()).catch(() => {});
      }
      return;
    }
    if (typeof document.documentElement.requestFullscreen === 'function') {
      void document.documentElement.requestFullscreen().catch(() => {});
    } else if (typeof rootEl.webkitRequestFullscreen === 'function') {
      void Promise.resolve(rootEl.webkitRequestFullscreen()).catch(() => {});
    }
  };

  const [copyFeedback, setCopyFeedback] = useState<boolean>(false);
  const [shareTextStyle, setShareTextStyle] = useState<'card' | 'compare' | 'compact'>(() => {
    try {
      const saved = localStorage.getItem('ncap_share_style');
      if (saved === 'card' || saved === 'compare' || saved === 'compact') return saved;
    } catch {
      // ignore
    }
    return 'card';
  });
  const [showSharePreview, setShowSharePreview] = useState<boolean>(false);

  const handleShareStyleChange = (style: 'card' | 'compare' | 'compact') => {
    triggerHaptic('light');
    setShareTextStyle(style);
    try {
      localStorage.setItem('ncap_share_style', style);
    } catch {
      // ignore
    }
  };

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

    if (newKey === 'aec') {
      handleIsAceCustomerChange(true);
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

  const resolvedBikeModelName =
    selectedBike?.name ||
    (bikeModelCode
      ? MOTORCYCLE_MODELS.find(
          (m) => m.code.toUpperCase() === bikeModelCode.trim().toUpperCase()
        )?.name || ''
      : '');

  const activeEligibilityTierKey = resolveEligibilityTierKey(
    proposalKey,
    resolvedBikeModelName,
    bikeModelCode
  );

  const customerEligibilityEval = evaluateCustomerEligibility(
    activeEligibilityTierKey,
    {
      age: customerAge,
      workMonths: customerWorkMonths,
      income: customerIncome,
      residenceMonths: customerResidenceMonths,
      occupation: customerOccupation,
      isAce: isAceCustomer,
    },
    {
      downPercent: currentCalculation.downPercent,
      hasPaInsurance: insurancePlan !== 'none',
      proposalKey,
    }
  );

  const handleOpenDvWithLinkedData = () => {
    triggerHaptic('medium');
    setActiveTab('documents');
    setExpandedCard('dv');
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Build formatted installment summary text for LINE / Native Share
  const buildInstallmentSummaryText = (styleOverride?: 'card' | 'compare' | 'compact') => {
    const activeStyle = styleOverride || shareTextStyle;
    const currentComp = comparisons.find((c) => c.term === currentCalculation.term);
    const cleanRate = currentCalculation.rateDisplayText
      .replace(/\s*\[\s*กำหนดเอง\s*\]/gi, '')
      .replace(/\s*\(\s*กำหนดเอง\s*\)/gi, '')
      .trim();

    const bikeLabel = selectedBike
      ? `${selectedBike.name}${bikeModelCode ? ` (${bikeModelCode})` : ''}`
      : bikeModelCode
      ? `รหัสรุ่น ${bikeModelCode}`
      : 'รถจักรยานยนต์';

    const insuranceLabel =
      currentCalculation.insuranceTotalWithVat > 0
        ? cleanPlanNameForLine(currentCalculation.insurancePlanName)
        : 'ไม่รับความคุ้มครอง PA';

    const downText = `${formatBaht(currentCalculation.downAmount)} บ. (${currentCalculation.downPercent.toFixed(1)}%)`;

    const hasInsurance = currentCalculation.insuranceTotalWithVat > 0;

    if (activeStyle === 'compact') {
      const compactInsurance = cleanPlanNameForLine(currentCalculation.insurancePlanName)
        .replace(/คุ้มครอง\s*/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      const buildCompactLines = (opts: {
        shortHeader?: boolean;
        omitModelCode?: boolean;
        shortOfficer?: boolean;
        maxCustomerLen?: number;
        maxDealerLen?: number;
        maxModelLen?: number;
        omitDealer?: boolean;
      }) => {
        const truncateStr = (val: string, maxLen?: number) => {
          if (!maxLen || val.length <= maxLen) return val;
          return `${val.slice(0, Math.max(1, maxLen - 1)).trimEnd()}…`;
        };

        const rawBikeName = selectedBike
          ? opts.omitModelCode || !bikeModelCode
            ? selectedBike.name
            : `${selectedBike.name} (${bikeModelCode})`
          : bikeLabel;
        const compactBike = truncateStr(rawBikeName, opts.maxModelLen);

        const compactCustomer =
          customerName || customerPhone
            ? truncateStr(customerDisplay, opts.maxCustomerLen)
            : '';

        const compactDealer =
          !opts.omitDealer && dealerName.trim()
            ? truncateStr(dealerName.trim(), opts.maxDealerLen)
            : '';

        const shortOfficerText = opts.shortOfficer
          ? `${officerName.trim().split(/\s+/)[0] || officerName.trim()}${
              officerCode.trim() ? ` (${officerCode.trim()})` : ''
            }`
          : officerDisplay;

        const lines: string[] = [
          opts.shortHeader ? `🛵 สรุปค่างวด` : `🛵 สรุปค่างวด Next Capital`,
        ];
        if (compactCustomer) {
          lines.push(`👤 ${compactCustomer}`);
        }
        if (compactDealer) {
          lines.push(`🏪 ${compactDealer}`);
        }
        lines.push(
          `🏍️ ${compactBike}`,
          `ราคา ${formatBaht(currentCalculation.baseVehiclePrice)} | ดาวน์ ${formatBaht(
            currentCalculation.downAmount
          )}`
        );
        if (hasInsurance) {
          lines.push(
            `จัด ${formatBaht(
              currentCalculation.vehicleFinanceAmount
            )} | รวมประกัน(${compactInsurance}) ${formatBaht(
              currentCalculation.financeAmount,
              true
            )}`
          );
        } else {
          lines.push(
            `ยอดจัด ${formatBaht(currentCalculation.vehicleFinanceAmount)} (ไม่รวมประกัน)`
          );
        }
        lines.push(
          `🔥 ผ่อน ${formatBaht(currentCalculation.monthlyInstallment)}/ด. × ${
            currentCalculation.term
          } งวด (รวม VAT)`
        );
        if (includeDeliveryFees && currentCalculation.totalDriveAwayCost) {
          lines.push(`รับรถรวม ${formatBaht(currentCalculation.totalDriveAwayCost)}`);
        }
        lines.push(`ติดต่อ: ${shortOfficerText}`);
        return lines.join('\n');
      };

      const candidates = [
        buildCompactLines({}),
        buildCompactLines({ omitModelCode: true, shortOfficer: true }),
        buildCompactLines({
          omitModelCode: true,
          shortOfficer: true,
          maxModelLen: 28,
          maxDealerLen: 22,
          maxCustomerLen: 30,
        }),
        buildCompactLines({
          shortHeader: true,
          omitModelCode: true,
          shortOfficer: true,
          maxModelLen: 22,
          maxDealerLen: 16,
          maxCustomerLen: 24,
        }),
        buildCompactLines({
          shortHeader: true,
          omitModelCode: true,
          shortOfficer: true,
          omitDealer: true,
          maxModelLen: 22,
          maxCustomerLen: 24,
        }),
      ];

      const fitted = candidates.find((text) => text.length <= 300);
      if (fitted) return fitted;

      const fallback = candidates[candidates.length - 1];
      return fallback.length <= 300 ? fallback : `${fallback.slice(0, 299)}…`;
    }

    if (activeStyle === 'compare') {
      const termLines = comparisons.map((c) => {
        const isCurrent = c.term === currentCalculation.term;
        const termText = `${c.term} งวด (${formatTermYearMonth(c.term)})`;
        if (isCurrent) {
          return `👉 ${termText} ➔ ${formatBaht(c.monthlyInstallment)} บ./ด. ★`;
        }
        return `• ${termText} ➔ ${formatBaht(c.monthlyInstallment)} บ./ด.`;
      });

      const lines: string[] = [
        `📊 ตารางเทียบค่างวดรถจักรยานยนต์`,
        `🏢 บมจ. เน็กซ์ แคปปิตอล (Next Capital)`,
        `━━━━━━━━━━━━━━━━━━━━`,
      ];
      if (customerName || customerPhone) {
        lines.push(`👤 ลูกค้า : ${customerDisplay}`);
      }
      if (dealerName.trim()) {
        lines.push(`🏪 ร้านผู้จำหน่าย : ${dealerName.trim()}`);
      }
      lines.push(
        `🏍️ รุ่นรถ : ${bikeLabel}`,
        `📋 แผน : ${currentCalculation.proposalName} (${currentCalculation.proposalCode})`,
        `▸ ราคารถ : ${formatBaht(currentCalculation.baseVehiclePrice)} บ.`,
        `▸ เงินดาวน์ : ${downText}`,
      );
      if (hasInsurance) {
        lines.push(
          `▸ ยอดจัดเฉพาะตัวรถ (ไม่รวมประกัน) : ${formatBaht(currentCalculation.vehicleFinanceAmount)} บ.`,
          `▸ ยอดจัดรวมประกัน : ${formatBaht(currentCalculation.financeAmount, true)} บ.`
        );
      } else {
        lines.push(
          `▸ ยอดจัด (ไม่รวมประกัน) : ${formatBaht(currentCalculation.vehicleFinanceAmount)} บ.`
        );
      }
      lines.push(
        `▸ ประกัน : ${insuranceLabel}`,
        ``,
        `📌 เลือกงวดผ่อนสบายๆ (รวม VAT 7%)`,
        ...termLines,
      );
      if (includeDeliveryFees && currentCalculation.totalDriveAwayCost) {
        lines.push(``, `🏁 เงินพร้อมออกรถ : ${formatBaht(currentCalculation.totalDriveAwayCost)} บาท`);
      }
      lines.push(
        ``,
        `━━━━━━━━━━━━━━━━━━━━`,
        `👨‍💼 ดูแลโดย : ${officerDisplay}`,
        `*เงื่อนไขเบื้องต้น อาจปรับตามผลอนุมัติจริง`
      );
      return lines.join('\n');
    }

    // Default 'card': การ์ดไฮไลต์สวยอ่านง่าย
    const lines: string[] = [
      `✨ ใบเสนอค่างวดรถจักรยานยนต์ ✨`,
      `🏢 บมจ. เน็กซ์ แคปปิตอล (Next Capital)`,
      `━━━━━━━━━━━━━━━━━━━━`,
    ];
    if (customerName || customerPhone) {
      lines.push(`👤 ลูกค้า : ${customerDisplay}`);
    }
    if (dealerName.trim()) {
      lines.push(`🏪 ร้านผู้จำหน่าย : ${dealerName.trim()}`);
    }
    lines.push(
      `🏍️ รุ่นรถ : ${bikeLabel}`,
      `📋 ข้อเสนอ : ${currentCalculation.proposalName}`,
      ``,
      `┏━━━━━━━━━━━━━━━━━━┓`,
      `  🔥 ผ่อนเพียง : ${formatBaht(currentCalculation.monthlyInstallment)} บ./เดือน`,
      `  ⏱️ ระยะเวลา : ${currentCalculation.term} งวด (${formatTermYearMonth(currentCalculation.term)})`,
      `  ✅ ราคานี้รวม VAT 7% แล้ว`,
      `┗━━━━━━━━━━━━━━━━━━┛`,
      ``,
      `📌 รายละเอียดเงื่อนไขสินเชื่อ`,
      `▸ ราคารถเงินสด : ${formatBaht(currentCalculation.baseVehiclePrice)} บาท`,
      `▸ เงินดาวน์ : ${downText}`,
    );
    if (hasInsurance) {
      lines.push(
        `▸ ยอดจัดเฉพาะตัวรถ (ไม่รวมประกัน) : ${formatBaht(currentCalculation.vehicleFinanceAmount)} บาท`,
        `▸ ยอดจัดสินเชื่อรวมประกัน : ${formatBaht(currentCalculation.financeAmount, true)} บาท`
      );
    } else {
      lines.push(
        `▸ ยอดจัดสินเชื่อ (ไม่รวมประกัน) : ${formatBaht(currentCalculation.vehicleFinanceAmount)} บาท`
      );
    }
    lines.push(
      `▸ ประกันคุ้มครอง : ${insuranceLabel}`,
      `▸ อัตราดอกเบี้ย : ${cleanRate}`,
    );
    if (currentComp && currentComp.hasInsurance && currentComp.insuranceMonthlyDiff > 0) {
      lines.push(`▸ ค่างวดไม่รวมประกัน : ${formatBaht(currentComp.monthlyInstallmentWithoutInsurance)} บ./ด.`);
    }
    if (includeDeliveryFees && currentCalculation.totalDriveAwayCost) {
      lines.push(`▸ เงินพร้อมออกรถ : ${formatBaht(currentCalculation.totalDriveAwayCost)} บาท`);
    }
    if (currentCalculation.isCappedByEir) {
      lines.push(`⚖️ คุมเพดานดอกเบี้ยตามเกณฑ์ สคบ. (≤ 23%/ปี)`);
    }
    lines.push(
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👨‍💼 ผู้ดูแลเคส : ${officerDisplay}`,
      `*เงื่อนไขเบื้องต้น อาจเปลี่ยนแปลงตามผลอนุมัติ`
    );

    return lines.join('\n');
  };

  // Copy quick summary to clipboard
  const handleQuickCopy = async () => {
    const summary = buildInstallmentSummaryText();
    try {
      await navigator.clipboard.writeText(summary);
      triggerHaptic('success');
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2400);
    } catch {
      // ignore
    }
  };

  // Native Share Sheet (ส่งข้อมูลสรุปค่างวดผ่าน LINE หรือแอปอื่นๆ บนอุปกรณ์)
  const handleNativeShare = async () => {
    triggerHaptic('medium');
    const summary = buildInstallmentSummaryText();
    const modelTitle = selectedBike?.name || (bikeModelCode ? `รหัส ${bikeModelCode}` : 'รถจักรยานยนต์');
    const shareTitle = `สรุปค่างวด ${modelTitle} • ${formatBaht(currentCalculation.monthlyInstallment)}/ด. (${currentCalculation.term} งวด)`;

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: shareTitle,
          text: summary,
        });
        triggerHaptic('success');
        triggerToast('แชร์ข้อมูลสรุปค่างวดเรียบร้อยแล้ว');
        return;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        // Fallback to clipboard below if share failed (e.g., restricted context)
      }
    }

    // Fallback: copy to clipboard when Native Share Sheet is unavailable
    try {
      await navigator.clipboard.writeText(summary);
      triggerHaptic('success');
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2400);
      triggerToast('คัดลอกข้อความสรุปค่างวดแล้ว (พร้อมส่งใน LINE)');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = summary;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      triggerHaptic('success');
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2400);
      triggerToast('คัดลอกข้อความสรุปค่างวดแล้ว (พร้อมส่งใน LINE)');
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

  // Edit an existing saved case
  const handleEditCase = (record: SavedCaseRecord) => {
    triggerHaptic('medium');
    const customerTitle = record.customerName?.trim() || record.caseTitle.split(' - ')[0]?.trim() || 'คุณลูกค้า';
    setEditingCaseId(record.id);
    setEditingCaseTitle(customerTitle);
    setActiveCaseId(record.id);

    setProposalKey(record.proposalKey);
    setVehiclePrice(record.vehiclePrice);
    setDownMode(record.downMode);
    setDownValue(record.downValue);
    setTerm(record.term);
    handleCustomerNameChange(record.customerName || 'คุณลูกค้า');
    handleCustomerPhoneChange(record.customerPhone ?? '');
    handleCustomerAgeChange(record.customerAge ?? '');
    handleCustomerIdCardChange(record.customerIdCard ?? '');
    handleCustomerAddressChange(record.customerAddress ?? '');
    handleCustomerBirthDateChange(record.customerBirthDate ?? '');
    handleCustomerPhotoUrlChange(record.customerPhotoUrl ?? '');
    setShowIdCardDetails(Boolean(record.customerIdCard || record.customerAddress || record.customerPhotoUrl));
    handleCustomerWorkMonthsChange(record.customerWorkMonths ?? '');
    handleCustomerIncomeChange(record.customerIncome ?? '');
    handleCustomerResidenceMonthsChange(record.customerResidenceMonths ?? '');
    handleCustomerOccupationChange(record.customerOccupation ?? '');
    handleIsAceCustomerChange(Boolean(record.isAceCustomer));
    handleDealerNameChange(record.dealerName ?? '');
    if (record.officerName) setOfficerName(record.officerName);
    if (record.officerCode) setOfficerCode(record.officerCode);
    if (record.officerLicense) setOfficerLicense(record.officerLicense);

    setInsurancePlan(record.insurancePlan);
    setInsuranceYears(record.insuranceYears);

    setIncludeDeliveryFees(record.includeDeliveryFees);
    setRegistrationFee(record.registrationFee || 1500);
    setTheftInsuranceFee(record.theftInsuranceFee || 2500);

    setIsCustomRateEnabled(record.isCustomRateEnabled);
    setCustomRateInput(record.customRateInput || '');
    setCustomRateType(record.customRateType || 'monthly');
    setEnforceEirCap(record.enforceEirCap ?? true);

    if (record.bikeModelCode) {
      setBikeModelCode(record.bikeModelCode);
      const matched = findModelByCode(record.bikeModelCode);
      if (matched) {
        setSelectedBike({
          id: matched.code,
          name: record.bikeModelName || matched.name,
          brand: (matched.brand as any) || (record.bikeBrand as any) || 'Other',
          price: matched.price || record.vehiclePrice,
          proposalKey: record.proposalKey,
          defaultDownPercent: 15,
          code: matched.code,
        });
      } else if (record.bikeModelName) {
        setSelectedBike({
          id: record.bikeModelCode,
          name: record.bikeModelName,
          brand: (record.bikeBrand as any) || 'Other',
          price: record.vehiclePrice,
          proposalKey: record.proposalKey,
          defaultDownPercent: 15,
          code: record.bikeModelCode,
        });
      } else {
        setSelectedBike(null);
      }
    } else if (record.bikeModelName) {
      setBikeModelCode('');
      setSelectedBike({
        id: record.id,
        name: record.bikeModelName,
        brand: (record.bikeBrand as any) || 'Other',
        price: record.vehiclePrice,
        proposalKey: record.proposalKey,
        defaultDownPercent: 15,
      });
    } else {
      setSelectedBike(null);
      setBikeModelCode('');
    }

    setActiveTab('financing');
    setExpandedCard('financing');
    triggerToast(`✏️ เข้าสู่โหมดแก้ไขเคส: "${customerTitle}"`);
  };

  const handleCancelEditing = () => {
    triggerHaptic('light');
    setEditingCaseId(null);
    setEditingCaseTitle(null);
    triggerToast('ออกจากโหมดแก้ไขเคสแล้ว');
  };

  // Save current case data to device (LocalStorage) or update existing when in editing mode
  const handleSaveCurrentCase = (saveAsNew: boolean = false) => {
    triggerHaptic('success');
    const defaultTitle = customerName?.trim() || 'คุณลูกค้า';

    const isUpdating = !saveAsNew && Boolean(editingCaseId);
    const targetTitle = isUpdating && editingCaseTitle ? editingCaseTitle : defaultTitle;

    const savedRecord = saveCaseRecord({
      ...(isUpdating && editingCaseId ? { id: editingCaseId } : {}),
      caseTitle: targetTitle,
      officerName,
      officerCode,
      officerLicense,
      customerName,
      customerPhone,
      customerNote: '',
      customerAge: customerAge.trim() || undefined,
      customerIdCard: normalizeThaiIdDigits(customerIdCard) || undefined,
      customerAddress: customerAddress.trim() || undefined,
      customerBirthDate: customerBirthDate.trim() || undefined,
      customerPhotoUrl: sanitizeCustomerPhotoDataUrl(customerPhotoUrl),
      customerWorkMonths: customerWorkMonths.trim() || undefined,
      customerIncome: customerIncome.trim() || undefined,
      customerResidenceMonths: customerResidenceMonths.trim() || undefined,
      customerOccupation: customerOccupation.trim() || undefined,
      isAceCustomer: isAceCustomer || undefined,
      dealerName: dealerName.trim() || undefined,
      proposalKey,
      vehiclePrice,
      bikeBrand:
        selectedBike?.brand ||
        (bikeModelCode ? findModelByCode(bikeModelCode)?.brand : undefined) ||
        undefined,
      bikeModelName: selectedBike?.name || (bikeModelCode ? `รุ่นรหัส ${bikeModelCode}` : undefined),
      bikeModelCode: bikeModelCode || selectedBike?.code,
      downMode,
      downValue,
      term,
      includeDeliveryFees,
      registrationFee,
      theftInsuranceFee,
      isCustomRateEnabled,
      customRateInput,
      customRateType,
      enforceEirCap,
      insurancePlan,
      insuranceYears,
      snapshot: {
        monthlyInstallment: currentCalculation.monthlyInstallment,
        rawMonthlyInstallment: currentCalculation.rawMonthlyInstallment,
        financeAmount: currentCalculation.financeAmount,
        downAmount: currentCalculation.downAmount,
        downPercent: currentCalculation.downPercent,
        totalInterest: currentCalculation.totalInterest,
        totalWithVat: currentCalculation.totalWithVat,
        effectiveMonthlyRate: currentCalculation.effectiveMonthlyRate,
        eirAnnualPercent: currentCalculation.eirAnnualPercent,
        proposalCode: currentCalculation.proposalCode,
        proposalName: currentCalculation.proposalName,
        rateDisplayText: currentCalculation.rateDisplayText,
        totalDriveAwayCost: currentCalculation.totalDriveAwayCost,
      },
    });

    setSavedCasesCount(getSavedCases().length);
    setCasesRevision((v) => v + 1);
    setActiveCaseId(savedRecord.id);

    if (isUpdating) {
      setEditingCaseTitle(savedRecord.caseTitle);
      triggerToast(`✓ บันทึกการแก้ไขเคส "${savedRecord.caseTitle}" เรียบร้อยแล้ว!`);
    } else {
      triggerToast(`✓ บันทึกเคสใหม่ "${savedRecord.caseTitle}" ลงในอุปกรณ์เรียบร้อยแล้ว!`);
      if (editingCaseId) {
        setEditingCaseId(null);
        setEditingCaseTitle(null);
      }
    }
  };

  // Load a saved case from device (คงวันที่ทำสัญญา & วัน/เวลารับรถไว้ใช้ออกเอกสาร)
  const handleLoadCase = (record: SavedCaseRecord) => {
    triggerHaptic('success');
    setActiveCaseId(record.id);
    if (editingCaseId && editingCaseId !== record.id) {
      setEditingCaseId(null);
      setEditingCaseTitle(null);
    }

    setProposalKey(record.proposalKey);
    setVehiclePrice(record.vehiclePrice);
    setDownMode(record.downMode);
    setDownValue(record.downValue);
    setTerm(record.term);
    handleCustomerNameChange(record.customerName || 'คุณลูกค้า');
    handleCustomerPhoneChange(record.customerPhone ?? '');
    handleCustomerAgeChange(record.customerAge ?? '');
    handleCustomerIdCardChange(record.customerIdCard ?? '');
    handleCustomerAddressChange(record.customerAddress ?? '');
    handleCustomerBirthDateChange(record.customerBirthDate ?? '');
    handleCustomerPhotoUrlChange(record.customerPhotoUrl ?? '');
    setShowIdCardDetails(Boolean(record.customerIdCard || record.customerAddress || record.customerPhotoUrl));
    handleCustomerWorkMonthsChange(record.customerWorkMonths ?? '');
    handleCustomerIncomeChange(record.customerIncome ?? '');
    handleCustomerResidenceMonthsChange(record.customerResidenceMonths ?? '');
    handleCustomerOccupationChange(record.customerOccupation ?? '');
    handleIsAceCustomerChange(Boolean(record.isAceCustomer));
    handleDealerNameChange(record.dealerName ?? '');
    if (record.officerName) setOfficerName(record.officerName);
    if (record.officerCode) setOfficerCode(record.officerCode);
    if (record.officerLicense) setOfficerLicense(record.officerLicense);

    setInsurancePlan(record.insurancePlan);
    setInsuranceYears(record.insuranceYears);

    setIncludeDeliveryFees(record.includeDeliveryFees);
    setRegistrationFee(record.registrationFee || 1500);
    setTheftInsuranceFee(record.theftInsuranceFee || 2500);

    setIsCustomRateEnabled(record.isCustomRateEnabled);
    setCustomRateInput(record.customRateInput || '');
    setCustomRateType(record.customRateType || 'monthly');
    setEnforceEirCap(record.enforceEirCap ?? true);

    if (record.bikeModelCode) {
      setBikeModelCode(record.bikeModelCode);
      const matched = findModelByCode(record.bikeModelCode);
      if (matched) {
        setSelectedBike({
          id: matched.code,
          name: record.bikeModelName || matched.name,
          brand: (matched.brand as any) || (record.bikeBrand as any) || 'Other',
          price: matched.price || record.vehiclePrice,
          proposalKey: record.proposalKey,
          defaultDownPercent: 15,
          code: matched.code,
        });
      } else if (record.bikeModelName) {
        setSelectedBike({
          id: record.bikeModelCode,
          name: record.bikeModelName,
          brand: (record.bikeBrand as any) || 'Other',
          price: record.vehiclePrice,
          proposalKey: record.proposalKey,
          defaultDownPercent: 15,
          code: record.bikeModelCode,
        });
      } else {
        setSelectedBike(null);
      }
    } else if (record.bikeModelName) {
      setBikeModelCode('');
      setSelectedBike({
        id: record.id,
        name: record.bikeModelName,
        brand: (record.bikeBrand as any) || 'Other',
        price: record.vehiclePrice,
        proposalKey: record.proposalKey,
        defaultDownPercent: 15,
      });
    } else {
      setSelectedBike(null);
      setBikeModelCode('');
    }

    setActiveTab('calculation');
    triggerToast(`✓ โหลดข้อมูลเคส "${record.caseTitle}" (วันที่บันทึก/สัญญา) มาใช้งานเรียบร้อยแล้ว`);
  };

  const currentProposal = PROPOSALS[proposalKey];
  const activeInsurancePlan = insurancePlan !== 'none' ? INSURANCE_PLANS[insurancePlan] : null;

  return (
    <>
    <div
      className={`fixed inset-0 w-full h-full overflow-hidden outer-canvas-bg text-slate-800 dark:text-slate-100 flex flex-col justify-center items-center ${
        isHandheldViewport ? 'p-0' : 'p-0 xl:p-3'
      } select-none`}
    >

      {/* Top Floating View Mode & Theme Switcher on Desktop Only */}
      {!isHandheldViewport && (
        <div className="no-print hidden xl:flex items-center gap-2 mb-2 bg-white/75 dark:bg-slate-900/80 backdrop-blur-xl px-3.5 py-1.5 rounded-full border border-white/90 dark:border-slate-700/80 shadow-sm shadow-sky-900/10 dark:shadow-slate-950/50 text-xs z-10 shrink-0">
          <span className="text-slate-500 dark:text-slate-400 font-medium">มุมมอง:</span>
          <button
            onClick={() => setViewMode('mobile')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              viewMode === 'mobile'
                ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/70'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" /> จำลองมือถือ
          </button>
          <button
            onClick={() => setViewMode('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              viewMode === 'dashboard'
                ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/70'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" /> แดชบอร์ดเต็มจอ
          </button>
          <div className="h-4 w-px bg-slate-300/70 dark:bg-slate-700/80 mx-0.5 shrink-0" aria-hidden="true" />
          <BoxThemeToggle compact />
        </div>
      )}

      {/* Main Container - Edge-to-Edge Fullscreen on Mobile & Tablet, Soft Glass Frame on Desktop */}
      <div
        className={`w-full min-h-0 transition-[max-width,border-radius] duration-300 z-10 ${
          isHandheldViewport
            ? 'flex-1 h-full max-w-none rounded-none !border-0 !shadow-none'
            : viewMode === 'mobile'
              ? 'flex-initial max-w-[580px] h-[min(920px,calc(100%-3rem))] max-h-[96%] rounded-[36px]'
              : 'flex-initial max-w-[1440px] h-[min(940px,calc(100%-3rem))] max-h-[96%] rounded-[32px]'
        } glass-container-frame flex ${isSaasWorkspace ? 'flex-row' : 'flex-col'} relative overflow-hidden`}
      >
        {/* Top Specular Highlight Line */}
        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent opacity-90 pointer-events-none z-30" />

        {/* Collapsible SaaS Left Sidebar (Tablet Edge-to-Edge & Desktop Fullscreen Dashboard) */}
        {isSaasWorkspace && (
          <aside
            aria-label="เมนูหลักแถบข้าง"
            className={`relative z-20 shrink-0 saas-sidebar-surface backdrop-blur-xl flex flex-col justify-between select-none ${
              isSidebarCollapsed ? 'w-[76px]' : 'w-[236px] lg:w-[252px]'
            }`}
          >
            {/* Ambient Moving Aurora & Crystal Edge Layer (hidden cleanly in Light mode) */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden sidebar-aurora-layer" aria-hidden="true">
              <div className="absolute -top-12 -left-10 w-44 h-44 rounded-full bg-gradient-to-br from-sky-300/35 via-indigo-300/20 to-transparent dark:from-sky-500/18 dark:via-indigo-500/12 blur-2xl animate-sidebar-aurora" />
              <div className="absolute -bottom-14 -right-10 w-40 h-40 rounded-full bg-gradient-to-tl from-cyan-300/30 via-sky-200/15 to-transparent dark:from-cyan-500/15 dark:via-blue-600/10 blur-2xl" />
              <div className="absolute inset-y-4 right-0 w-[1px] bg-gradient-to-b from-white/80 via-sky-200/40 to-transparent dark:from-sky-400/25 dark:via-slate-700/20" />
            </div>

            {/* 3D Glossy Circular Collapse Toggle on Sidebar Edge */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setIsSidebarCollapsed((prev) => !prev);
              }}
              className="group absolute -right-3.5 top-6 w-7 h-7 rounded-full saas-control-pill flex items-center justify-center text-slate-600 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-300 hover:scale-110 active:scale-95 transition-all cursor-pointer z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              title={isSidebarCollapsed ? 'ขยายเมนูด้านข้าง' : 'ย่อเมนูด้านข้าง'}
              aria-label={isSidebarCollapsed ? 'ขยายเมนูด้านข้าง' : 'ย่อเมนูด้านข้าง'}
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              ) : (
                <ChevronLeft className="w-3.5 h-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
              )}
            </button>

            <div className="relative z-10 flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-4">
              {/* Brand Block with 3D Floating Jewel Tile */}
              <div
                className={`flex items-center ${
                  isSidebarCollapsed ? 'justify-center' : 'gap-2.5 px-1'
                }`}
              >
                <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 p-[2px] shadow-md shadow-sky-500/25 flex items-center justify-center shrink-0 overflow-hidden transition-transform duration-200 hover:-translate-y-0.5 hover:scale-105">
                  <div className="w-full h-full rounded-[14px] bg-white dark:bg-slate-950 flex items-center justify-center relative overflow-hidden">
                    <NextCapitalLogo size={20} className="relative z-10 flex items-center justify-center" />
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-sky-200/45 to-transparent animate-crystal-sheen"
                    />
                  </div>
                </div>
                {!isSidebarCollapsed && (
                  <div className="min-w-0">
                    <div className="text-xs font-black tracking-tight text-slate-900 dark:text-white uppercase truncate">
                      NEXT CAPITAL
                    </div>
                    <div className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                      MotoLease Calc 2569
                    </div>
                  </div>
                )}
              </div>

              {/* Officer / User Profile 3D Crystal Card */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setIsOfficerExpanded(true);
                  setActiveTab('financing');
                  setExpandedCard(null);
                  setTimeout(() => {
                    document
                      .querySelector('[data-card-id="officer"]')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 120);
                }}
                className={`group relative overflow-hidden w-full rounded-2xl sidebar-profile-card active:scale-[0.985] cursor-pointer flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  isSidebarCollapsed ? 'justify-center p-1.5' : 'gap-2.5 p-2.5 text-left'
                }`}
                title="แก้ไขข้อมูลเจ้าหน้าที่ / ตัวแทน"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-3 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-sky-300/25"
                />
                <div className="relative w-9 h-9 shrink-0 rounded-full p-[2px] transition-transform duration-200 group-hover:scale-105">
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-gradient-to-tr from-sky-400 via-indigo-500 to-cyan-300 opacity-85 animate-sidebar-avatar-ring"
                  />
                  <div className="relative w-full h-full rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 text-white font-extrabold text-xs flex items-center justify-center overflow-hidden ring-2 ring-white dark:ring-slate-900">
                    {firebaseUser?.photoURL && failedAvatarUrl !== firebaseUser.photoURL ? (
                      <img
                        src={firebaseUser.photoURL}
                        alt={officerName || 'Officer'}
                        referrerPolicy="no-referrer"
                        onError={() => setFailedAvatarUrl(firebaseUser.photoURL || null)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{(officerName || 'จ').slice(0, 2)}</span>
                    )}
                  </div>
                </div>
                {!isSidebarCollapsed && (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                        {officerName || 'เจ้าหน้าที่'}
                      </div>
                      <div className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400 truncate tabular-nums">
                        {officerCode ? `รหัส ${officerCode}` : 'แตะตั้งค่าเจ้าหน้าที่'}
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-sky-600 dark:group-hover:text-sky-400" />
                  </>
                )}
              </button>

              {/* Primary Navigation with Sliding 3D Capsule Indicator */}
              <nav aria-label="แถบนำทางหลัก" className="relative flex flex-col gap-1.5">
                {/* Sliding 3D Gradient Active Capsule */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-[44px] rounded-2xl sidebar-nav-active-pill overflow-hidden"
                  style={{
                    transform: `translate3d(0, ${Math.max(0, NAV_TABS.findIndex((t) => t.id === activeTab)) * 50}px, 0)`,
                  }}
                >
                  <div className="absolute inset-x-2.5 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/85 to-transparent" />
                  <div className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-sidebar-sheen" />
                </div>

                {NAV_TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const isJustTapped = navAnimState.tab === tab.id && navAnimState.key > 0;
                  const Icon = tab.icon;
                  const displayLabel = tab.id === 'home' ? 'แดชบอร์ด' : tab.label;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleTabChange(tab.id)}
                      title={displayLabel}
                      aria-current={isActive ? 'page' : undefined}
                      className={`group relative z-10 h-[44px] w-full flex items-center rounded-2xl font-bold text-xs transition-colors duration-200 cursor-pointer whitespace-nowrap active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                        isSidebarCollapsed
                          ? 'justify-center px-1'
                          : 'justify-between gap-2.5 px-2.5 text-left'
                      } ${
                        isActive
                          ? 'text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-white/65 dark:hover:bg-slate-800/65 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2.5 min-w-0">
                        <span
                          key={isJustTapped ? `${tab.id}-${navAnimState.key}` : tab.id}
                          className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                            isActive
                              ? 'bg-white/22 border border-white/35 shadow-inner text-white'
                              : 'sidebar-icon-socket text-slate-600 dark:text-slate-300 group-hover:text-sky-600 dark:group-hover:text-sky-400 group-hover:scale-110 group-hover:-rotate-3'
                          } ${isJustTapped ? 'animate-tab-icon' : ''}`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                        </span>
                        {!isSidebarCollapsed && (
                          <span className="truncate transition-transform duration-200 group-hover:translate-x-0.5">
                            {displayLabel}
                          </span>
                        )}
                      </span>
                      {!isSidebarCollapsed && isActive && (
                        <ChevronRight className="w-3.5 h-3.5 text-white/80 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Quick Workspace Shortcuts */}
              <div className="pt-2.5 border-t border-slate-200/75 dark:border-slate-800/85 space-y-1">
                {!isSidebarCollapsed && (
                  <div className="px-2 pb-1 text-[10.5px] font-bold tracking-wide text-slate-400 dark:text-slate-500">
                    จัดการข้อมูลด่วน
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    setShowSavedCases(true);
                  }}
                  title={`ตารางเคสทั้งหมด (${savedCasesCount})`}
                  className={`group sidebar-shortcut-btn h-[40px] w-full flex items-center rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer whitespace-nowrap active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    isSidebarCollapsed
                      ? 'justify-center px-1'
                      : 'justify-between gap-2 px-2.5 text-left'
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-indigo-50/90 dark:bg-indigo-950/70 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3">
                      <FolderArchive className="w-3.5 h-3.5 text-indigo-600 dark:text-sky-400 shrink-0" />
                    </span>
                    {!isSidebarCollapsed && <span className="truncate">ตารางเคสทั้งหมด</span>}
                  </span>
                  {!isSidebarCollapsed && (
                    <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-100 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-extrabold tabular-nums">
                      {savedCasesCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowBikePresets(true);
                  }}
                  title="เลือกรุ่นรถจักรยานยนต์"
                  className={`group sidebar-shortcut-btn h-[40px] w-full flex items-center rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer whitespace-nowrap active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    isSidebarCollapsed
                      ? 'justify-center px-1'
                      : 'justify-between gap-2 px-2.5 text-left'
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-sky-50/90 dark:bg-sky-950/70 border border-sky-200/60 dark:border-sky-800/60 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3">
                      <Bike className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                    </span>
                    {!isSidebarCollapsed && <span className="truncate">เลือกรุ่นรถ</span>}
                  </span>
                  {!isSidebarCollapsed && (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowCloudSyncModal(true);
                  }}
                  title="ซิงค์ข้อมูล Cloud"
                  className={`group sidebar-shortcut-btn h-[40px] w-full flex items-center rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer whitespace-nowrap active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    isSidebarCollapsed
                      ? 'justify-center px-1'
                      : 'justify-between gap-2 px-2.5 text-left'
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-emerald-50/90 dark:bg-emerald-950/70 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3">
                      {firebaseUser && syncStatus === 'syncing' ? (
                        <RefreshCw className="w-3.5 h-3.5 text-sky-500 animate-spin shrink-0" />
                      ) : (
                        <Cloud className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      )}
                    </span>
                    {!isSidebarCollapsed && <span className="truncate">ซิงค์ Cloud</span>}
                  </span>
                  {!isSidebarCollapsed && firebaseUser && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                      <span>พร้อม</span>
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Bottom Color Scheme Glass Dock */}
            <div className="relative z-10 p-3 border-t border-slate-200/75 dark:border-slate-800/85 space-y-2">
              {isSidebarCollapsed ? (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    const next =
                      boxTheme === 'light'
                        ? 'dimensional'
                        : boxTheme === 'dimensional'
                          ? 'dark'
                          : 'light';
                    setBoxTheme(next);
                  }}
                  title={`เปลี่ยนโหมดสี (ปัจจุบัน: ${
                    boxTheme === 'light' ? 'สว่าง' : boxTheme === 'dark' ? 'โหมดมืด' : 'มีมิติ'
                  })`}
                  className="group w-full h-[42px] rounded-2xl sidebar-theme-dock flex items-center justify-center text-slate-700 dark:text-slate-200 hover:scale-105 active:scale-95 cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  {boxTheme === 'light' ? (
                    <Sun className="w-4 h-4 text-amber-500 transition-transform duration-300 group-hover:rotate-45" />
                  ) : boxTheme === 'dark' ? (
                    <Moon className="w-4 h-4 text-sky-400 transition-transform duration-300 group-hover:-rotate-12" />
                  ) : (
                    <Layers className="w-4 h-4 text-indigo-500 dark:text-sky-400 transition-transform duration-300 group-hover:scale-110" />
                  )}
                </button>
              ) : (
                <>
                  <div className="rounded-2xl sidebar-theme-dock p-2 space-y-1.5">
                    <div className="text-[10.5px] font-bold text-slate-600 dark:text-slate-300 px-1">
                      โหมดสีแสดงผล
                    </div>
                    <BoxThemeToggle compact className="w-full justify-center" />
                  </div>
                  <div className="text-[9.5px] text-center text-slate-400 dark:text-slate-500">
                    พัฒนาระบบโดย Aonbordin
                  </div>
                </>
              )}
            </div>
          </aside>
        )}

        {/* Primary Workspace Column (SaaS Top Bar + Main Content + Mobile Capsule) */}
        <div
          className={`flex-1 min-w-0 flex flex-col min-h-0 relative ${
            isSaasWorkspace ? 'saas-workspace-canvas' : ''
          }`}
        >
        {/* Top Header: Compact SaaS Top Bar on Tablet/Dashboard OR Fluid Wave Header on Mobile */}
        {isSaasWorkspace ? (
          <header className="shrink-0 z-10 saas-topbar-surface backdrop-blur-md px-4 lg:px-6 py-2.5 flex items-center justify-between gap-3">
            {/* Search / Bike Model Selector + Action & Cloud Buttons Grouped Together */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div data-card-id="model-bar" className="flex items-center gap-2 min-w-0 flex-1 max-w-md lg:max-w-lg">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowBikePresets(true);
                  }}
                  className="flex-1 min-w-0 bg-slate-100/90 hover:bg-slate-100 dark:bg-slate-800/90 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate font-semibold text-slate-700 dark:text-slate-200">
                      {selectedBike
                        ? `รุ่น: ${selectedBike.name}`
                        : bikeModelCode
                          ? `รหัสรุ่น: ${bikeModelCode}`
                          : 'ค้นหาหรือเลือกรุ่นรถจักรยานยนต์...'}
                    </span>
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-700 text-indigo-600 dark:text-sky-300 text-[10.5px] font-bold shadow-2xs shrink-0">
                    เลือกรุ่นรถ
                  </span>
                </button>
                {(selectedBike || bikeModelCode) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBike(null);
                      setBikeModelCode('');
                    }}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-500 hover:text-rose-600 cursor-pointer transition-colors shrink-0"
                    title="ล้างรุ่นรถที่เลือก"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Action & Cloud Cluster Adjacent to Search Bar */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab === 'financing') {
                      handleSaveCurrentCase(false);
                    } else {
                      handleTabChange('financing');
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 hover:opacity-95 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm shadow-indigo-500/20 cursor-pointer whitespace-nowrap shrink-0 transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>{activeTab === 'financing' ? 'บันทึกเคสนี้' : 'คำนวณเคสใหม่'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowCloudSyncModal(true);
                  }}
                  className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                  title={
                    firebaseUser
                      ? `ซิงค์ Cloud: ${firebaseUser.email}`
                      : 'เข้าสู่ระบบ Google เพื่อซิงค์เคสขึ้น Cloud อัตโนมัติ'
                  }
                >
                  {firebaseUser ? (
                    syncStatus === 'syncing' ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-500 shrink-0" />
                        <span>กำลังซิงค์</span>
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <span>Cloud ✓</span>
                      </>
                    )
                  ) : (
                    <>
                      <Cloud className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      <span>Cloud Sync</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right Slot: Tablet Fullscreen Toggle Button */}
            {isTabletWorkspace && (
              <button
                type="button"
                onClick={handleToggleFullscreen}
                className={`px-3 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-all shadow-2xs active:scale-95 ${
                  isFullscreen
                    ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                    : 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600'
                }`}
                title={isFullscreen ? 'ออกจากโหมดเต็มจอ' : 'ขยายเต็มหน้าจอแท็บเล็ต'}
                aria-label={isFullscreen ? 'ออกจากโหมดเต็มจอ' : 'ขยายเต็มหน้าจอแท็บเล็ต'}
                aria-pressed={isFullscreen}
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5 shrink-0" />
                    <span>ออกเต็มจอ</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5 text-indigo-600 dark:text-sky-400 shrink-0" />
                    <span>เต็มจอ</span>
                  </>
                )}
              </button>
            )}
          </header>
        ) : (
        /* Top Locked Section: Organic Fluid Wave Header (ล็อคค้างไว้ที่ด้านบน ไม่เลื่อนตาม พอดีกับทุกขนาดหน้าจอ) */
        <header
          className={`shrink-0 z-20 sticky top-0 w-full overflow-hidden bg-gradient-to-br from-[#0284c7] via-[#0ea5e9] to-[#06b6d4] dark:from-[#081022] dark:via-[#0f172a] dark:to-[#0c233a] dark:border-b dark:border-sky-400/20 text-white transition-colors duration-300 ${
            isHandheldViewport
              ? 'pt-2.5 pb-5 px-3.5 rounded-b-[24px]'
              : 'pt-3 pb-5 px-5 rounded-b-[32px]'
          } shadow-md shadow-sky-950/15 dark:shadow-black/50`}
        >
          {/* Overlapping Organic Water Wave Animation Layers */}
          <div className="absolute inset-x-0 bottom-0 h-16 sm:h-20 pointer-events-none overflow-hidden select-none">
            {/* Back Wave (Slow Deep Swell - Soft Translucent Cyan Tone) */}
            <div className="animate-wave-bob-1 absolute inset-x-0 -bottom-2 w-full h-full pointer-events-none">
              <svg
                className="animate-wave-slow w-[200%] min-w-[200%] max-w-none h-full text-white/25 dark:text-sky-400/12"
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
                className="animate-wave-fast w-[200%] min-w-[200%] max-w-none h-full text-white/45 dark:text-cyan-400/18"
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
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white dark:bg-slate-100 shadow-xs border border-white/90 dark:border-slate-700/60 flex items-center justify-center shrink-0 overflow-hidden">
                <NextCapitalLogo size={22} className="flex items-center justify-center" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-[11px] sm:text-xs tracking-tight text-white dark:text-slate-50 uppercase drop-shadow-xs">
                  Next Capital
                </span>
                <span className="text-[9px] sm:text-[9.5px] text-white/85 dark:text-slate-300 font-medium -mt-0.5">
                  บมจ. เน็กซ์ แคปปิตอล
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="flex items-center gap-1.5">
                {firebaseUser && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setShowCloudSyncModal(true);
                    }}
                    className="w-[22px] h-[22px] sm:w-[26px] sm:h-[26px] rounded-full border border-white/65 dark:border-slate-600/80 bg-emerald-600/85 backdrop-blur-md shadow-xs overflow-hidden flex items-center justify-center shrink-0 cursor-pointer transition-all hover:scale-105 active:scale-95"
                    title={firebaseUser.displayName || firebaseUser.email || 'บัญชีผู้ใช้'}
                    aria-label="โปรไฟล์ผู้ใช้และสถานะ Cloud"
                  >
                    {firebaseUser.photoURL && failedAvatarUrl !== firebaseUser.photoURL ? (
                      <img
                        src={firebaseUser.photoURL}
                        alt={firebaseUser.displayName || firebaseUser.email || 'User'}
                        referrerPolicy="no-referrer"
                        onError={() => setFailedAvatarUrl(firebaseUser.photoURL || null)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] sm:text-[11px] font-extrabold text-white leading-none">
                        {(firebaseUser.displayName || firebaseUser.email || 'U')
                          .slice(0, 1)
                          .toUpperCase()}
                      </span>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowCloudSyncModal(true);
                  }}
                  className="text-[9.5px] sm:text-[10.5px] font-bold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-white/25 hover:bg-white/35 dark:bg-slate-800/75 dark:hover:bg-slate-700/85 backdrop-blur-md text-white dark:text-slate-100 border border-white/35 dark:border-slate-600/70 shadow-xs whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                  title={
                    firebaseUser
                      ? `ซิงค์ Cloud: ${firebaseUser.email}`
                      : 'เข้าสู่ระบบ Google เพื่อซิงค์เคสขึ้น Cloud อัตโนมัติ'
                  }
                >
                  {firebaseUser ? (
                    syncStatus === 'syncing' ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin text-sky-100 shrink-0" />
                        <span>กำลังซิงค์</span>
                      </>
                    ) : syncStatus === 'error' ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-amber-300 shrink-0" />
                        <span>ซิงค์ใหม่</span>
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-300 shrink-0" />
                        <span>Cloud ✓</span>
                      </>
                    )
                  ) : (
                    <>
                      <Cloud className="w-3 h-3 text-white shrink-0" />
                      <span>Cloud Sync</span>
                    </>
                  )}
                </button>
              </div>
              <span className="text-[9px] sm:text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/20 dark:bg-slate-800/65 backdrop-blur-md text-white dark:text-slate-300 border border-white/30 dark:border-slate-700/70 shadow-xs whitespace-nowrap select-none leading-tight">
                พัฒนาระบบโดย Aonbordin
              </span>
            </div>
          </div>

          {/* Header Title Row */}
          <div className="relative z-10 flex items-center justify-between pt-0.5">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-base sm:text-lg md:text-xl font-black text-white dark:text-slate-50 tracking-tight drop-shadow-xs">
                MotoLease Calc
              </h1>
              <span className="text-[9.5px] sm:text-[10px] font-bold bg-white/25 dark:bg-sky-500/20 backdrop-blur-md text-white dark:text-sky-200 border border-white/30 dark:border-sky-400/30 px-2 py-0.5 rounded-full">
                2569
              </span>
            </div>
            <span className="text-[10px] sm:text-[11px] text-white/90 dark:text-slate-300 font-medium">
              ระบบคำนวณค่างวดรถจักรยานยนต์
            </span>
          </div>

          {/* Pill Search / Model Code Bar matching Reference UI */}
          <div data-card-id="model-bar" className="relative z-10 mt-2 sm:mt-2.5">
            <button
              type="button"
              onClick={() => setShowBikePresets(true)}
              className="w-full bg-white/25 hover:bg-white/35 dark:bg-slate-900/75 dark:hover:bg-slate-800/85 text-white backdrop-blur-md rounded-full py-1.5 sm:py-2 px-3 sm:px-3.5 shadow-sm shadow-sky-950/20 dark:shadow-black/45 border border-white/40 hover:border-white/60 dark:border-sky-400/25 dark:hover:border-sky-400/45 flex items-center justify-between text-xs transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                <div className="w-5 h-5 rounded-full bg-white/25 dark:bg-sky-500/20 text-white dark:text-sky-300 flex items-center justify-center shrink-0 border border-white/30 dark:border-sky-400/30 shadow-2xs">
                  <Bike className="w-3.5 h-3.5" />
                </div>
                <MarqueeText className="text-white/95 dark:text-slate-200 font-medium drop-shadow-2xs text-[11px] sm:text-xs">
                  {selectedBike ? `รุ่น: ${selectedBike.name}` : bikeModelCode ? `รหัสรุ่น: ${bikeModelCode}` : 'ค้นหาหรือเลือกรุ่นรถจักรยานยนต์...'}
                </MarqueeText>
              </div>
              <span className="text-[10px] font-bold text-sky-900 bg-white/95 hover:bg-white dark:bg-sky-500/25 dark:hover:bg-sky-500/35 dark:text-sky-200 dark:border dark:border-sky-400/35 px-2.5 py-0.5 rounded-full shrink-0 shadow-2xs transition-all group-hover:scale-105">
                เลือกรุ่นรถ
              </span>
            </button>
          </div>
        </header>
        )}

        {/* Main Content Area with 4 Connected Step Pages (ส่วนเนื้อหาที่เลื่อนได้อย่างอิสระ ไม่ดึงส่วนหัวหรือส่วนล่าง) */}
        <main
          ref={mainRef}
          className={`relative z-10 flex-1 min-h-0 overflow-y-auto overflow-x-hidden ${
            isSaasWorkspace
              ? 'px-3 sm:px-4 lg:px-6 py-3 sm:py-4 pb-[max(3rem,calc(env(safe-area-inset-bottom)+2.25rem))] space-y-3.5'
              : isHandheldViewport
                ? 'px-2.5 sm:px-3.5 py-2.5 pb-28 space-y-2.5'
                : 'px-4 md:px-5 py-3.5 pb-28 space-y-3.5'
          } overscroll-contain`}
        >
          {/* In-App PWA Install Banner */}
          <InstallAppBanner />

          {/* Selected Bike Banner if active */}
          {(selectedBike || bikeModelCode) && (
            <div className="mx-0 sm:mx-1 mt-1 px-3 sm:px-3.5 py-2 glass-panel-cyan rounded-2xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <Sparkles className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 flex-shrink-0" />
                <span className="text-slate-500 dark:text-slate-400 font-medium shrink-0">รุ่นที่เลือก:</span>
                <MarqueeText fitContent className="font-bold text-sky-950 dark:text-sky-100">
                  {selectedBike?.name || 'รถจักรยานยนต์'}
                </MarqueeText>
                {bikeModelCode && (
                  <span className="font-mono text-[10px] font-bold text-sky-800 dark:text-sky-200 bg-white dark:bg-slate-800/90 px-2 py-0.5 rounded-full border border-sky-200 dark:border-sky-700/80 ml-1 shrink-0">
                    {bikeModelCode}
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedBike(null);
                  setBikeModelCode('');
                }}
                className="text-[11px] text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 ml-2 font-medium cursor-pointer shrink-0"
              >
                ล้าง
              </button>
            </div>
          )}

          {/* Active Loaded Case Contract & Delivery Date Chip (เมื่อดึงเคสที่บันทึกไว้มาใช้งาน) */}
          {activeCaseRecord && !editingCaseId && (
            <div className="mx-0 sm:mx-1 mt-1 px-3 sm:px-3.5 py-2 glass-panel-teal rounded-2xl flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="w-6 h-6 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <FolderArchive className="w-3.5 h-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950/70 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-700/70 shrink-0">
                      ข้อมูลเคสที่ดึงมาใช้
                    </span>
                    <MarqueeText fitContent className="font-bold text-slate-800 dark:text-slate-100 text-[11.5px]">
                      {activeCaseRecord.customerName || activeCaseRecord.caseTitle}
                    </MarqueeText>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-slate-600 dark:text-slate-300 mt-0.5">
                    <span>
                      วันทำสัญญา/บันทึก:{' '}
                      <strong className="text-slate-800 dark:text-slate-100">
                        {formatThaiShortDateWithTime(
                          activeCaseRecord.approvalDate || activeCaseRecord.createdAt,
                          activeCaseRecord.createdAt
                        )}
                      </strong>
                    </span>
                    {(activeCaseRecord.deliveryStatus === 'delivered' || activeCaseRecord.deliveryDate) && (
                      <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                        • รับรถ:{' '}
                        <strong>
                          {activeCaseRecord.deliveryConfirmedAt || activeCaseRecord.deliveryDate
                            ? formatThaiShortDateWithTime(
                                activeCaseRecord.deliveryDate || activeCaseRecord.deliveryConfirmedAt,
                                activeCaseRecord.deliveryConfirmedAt || activeCaseRecord.updatedAt || activeCaseRecord.createdAt
                              )
                            : formatThaiFullDocumentDate(activeCaseRecord.deliveryDate)}
                        </strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setActiveCaseId(null);
                  triggerToast('ล้างการอ้างอิงวันที่เคสที่บันทึกแล้ว (กลับไปใช้วันที่ปัจจุบัน)');
                }}
                className="text-[10.5px] text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 font-semibold px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer shrink-0"
                title="ล้างการอ้างอิงวันที่จากเคสที่บันทึก"
              >
                ล้างเคส
              </button>
            </div>
          )}

          {/* Editing Mode Sticky Alert Banner if active */}
          {editingCaseId && (
            <div className="mx-0 sm:mx-1 mt-1.5 p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 text-white shadow-md shadow-amber-500/25 border border-amber-300/80 animate-fade-in space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/30 shadow-2xs">
                    <Pencil className="w-4 h-4 text-white" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-wider bg-white/25 px-2 py-0.5 rounded-full border border-white/30 text-white shrink-0">
                        โหมดแก้ไขเคส
                      </span>
                      <MarqueeText fitContent className="text-xs font-black drop-shadow-2xs text-white">
                        {editingCaseTitle}
                      </MarqueeText>
                    </div>
                    <MarqueeText className="text-[10.5px] text-amber-50/90 mt-0.5">
                      {activeCaseRecord
                        ? `วันทำสัญญา/บันทึก: ${formatThaiShortDateWithTime(
                            activeCaseRecord.approvalDate || activeCaseRecord.createdAt,
                            activeCaseRecord.createdAt
                          )}${
                            activeCaseRecord.deliveryStatus === 'delivered' || activeCaseRecord.deliveryDate
                              ? ` • วันรับรถ: ${formatThaiShortDateWithTime(
                                  activeCaseRecord.deliveryDate || activeCaseRecord.deliveryConfirmedAt,
                                  activeCaseRecord.deliveryConfirmedAt || activeCaseRecord.updatedAt || activeCaseRecord.createdAt
                                )}`
                              : ''
                          }`
                        : 'กำลังแก้ไขข้อมูลเคสนี้ คุณสามารถปรับเปลี่ยนราคา เงินดาวน์ หรือข้อเสนอ แล้วกดบันทึกการแก้ไข'}
                    </MarqueeText>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCancelEditing}
                  className="p-1 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer shrink-0"
                  title="ยกเลิกโหมดแก้ไข"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Action Buttons for Edit Mode */}
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => handleSaveCurrentCase(false)}
                  className="flex-1 py-2 px-3 rounded-xl bg-white text-amber-900 hover:bg-amber-50 font-black text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                  title="บันทึกทับข้อมูลในเคสเดิม"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                  <span>บันทึกการแก้ไขเคสนี้</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveCurrentCase(true)}
                  className="py-2 px-3 rounded-xl bg-amber-800/50 hover:bg-amber-800/70 text-white font-bold text-xs flex items-center justify-center gap-1 border border-white/30 active:scale-95 transition-all cursor-pointer shrink-0"
                  title="บันทึกเป็นเคสใหม่โดยไม่เขียนทับเคสเดิม"
                >
                  <BookmarkPlus className="w-3.5 h-3.5 text-amber-200" />
                  <span>บันทึกเป็นเคสใหม่</span>
                </button>

                <button
                  type="button"
                  onClick={handleCancelEditing}
                  className="py-2 px-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold text-xs transition-colors cursor-pointer shrink-0"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          )}

          <div
            className={`${
              isSaasWorkspace
                ? activeTab === 'home' ||
                  activeTab === 'financing' ||
                  activeTab === 'calculation' ||
                  activeTab === 'installments'
                  ? 'w-full max-w-[1400px]'
                  : 'w-full max-w-5xl'
                : isHandheldViewport
                  ? 'w-full max-w-none'
                  : 'max-w-2xl'
            } mx-auto space-y-3 pb-8`}
          >
            {/* ========================================================
                หน้าโฮมเพจ: แดชบอร์ดภาพรวมผลงาน & สรุปยอดรายเดือน
                ======================================================== */}
            {activeTab === 'home' && (
              <HomeDashboard
                variant={isSaasWorkspace ? 'tablet_saas' : 'mobile'}
                isTablet={isTabletWorkspace}
                refreshTrigger={casesRevision}
                officerName={officerName}
                officerCode={officerCode}
                officerLicense={officerLicense}
                dealerName={dealerName}
                activeDraft={{
                  customerName,
                  bikeModelName: selectedBike?.name || (bikeModelCode ? `รหัส ${bikeModelCode}` : undefined),
                  monthlyInstallment: currentCalculation.monthlyInstallment,
                  term,
                  isEditing: Boolean(editingCaseId),
                }}
                onOpenSavedCases={() => {
                  triggerHaptic('selection');
                  setShowSavedCases(true);
                }}
                onNavigateToCaseForm={() => handleTabChange('financing')}
                onNavigateToOfficerSetup={() => {
                  setIsOfficerExpanded(true);
                  setActiveTab('financing');
                  setExpandedCard(null);
                  setTimeout(() => {
                    document
                      .querySelector('[data-card-id="officer"]')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 120);
                }}
                onNavigateToDocuments={() => handleTabChange('documents')}
                onNavigateToCheckerCommission={() => {
                  triggerHaptic('selection');
                  setActiveTab('documents');
                  setExpandedCard('checker_commission');
                  mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onNavigateToPeriodClosing={() => {
                  triggerHaptic('selection');
                  setActiveTab('documents');
                  setExpandedCard('period_closing');
                  mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onNavigateToInstallments={() => handleTabChange('installments')}
                onLoadCase={handleLoadCase}
              />
            )}

        {/* ========================================================
            หน้าที่ 2: คำนวณเคส (ข้อมูลลูกค้า, ดีลเลอร์, รถ, ประกัน PA, เงินดาวน์ & เจ้าหน้าที่)
            ======================================================== */}
        {activeTab === 'financing' && (
          <div className="space-y-3 sm:space-y-3.5 animate-tab-fade">
            {/* Step Header Badge */}
            <div className="flex items-center justify-between px-1 text-xs">
              <span className="font-extrabold text-sky-950 dark:text-sky-100 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[11px] font-bold shadow-2xs">
                  1
                </span>
                ข้อมูลเคส รถ ประกัน PA & เงินดาวน์
              </span>
              <span className="text-[10px] text-sky-800 dark:text-sky-200 bg-sky-50 dark:bg-sky-950/70 px-2.5 py-0.5 rounded-full font-bold border border-sky-200 dark:border-sky-700/70">
                ขั้นตอน 1 / 3
              </span>
            </div>

                {/* Quick Save & Saved Cases Action Bar */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveCurrentCase(false)}
                    className={`flex-1 py-2 px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 border shadow-2xs transition-all cursor-pointer active:scale-98 ${
                      editingCaseId
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-amber-400 shadow-amber-500/20 hover:from-amber-600 hover:to-orange-600'
                        : 'bg-white/90 hover:bg-white dark:bg-slate-800/85 dark:hover:bg-slate-800 text-sky-900 dark:text-sky-100 border-sky-200/90 dark:border-sky-700/70'
                    }`}
                    title={editingCaseId ? 'บันทึกการแก้ไขเคสที่กำลังเปิดอยู่นี้' : 'บันทึกข้อมูลเคสปัจจุบันเก็บไว้ในอุปกรณ์'}
                  >
                    {editingCaseId ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                        <span>บันทึกการแก้ไขเคส</span>
                      </>
                    ) : (
                      <>
                        <BookmarkPlus className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                        <span>{firebaseUser ? 'บันทึกเคส & ซิงค์ Cloud' : 'บันทึกเคสนี้ลงเครื่อง'}</span>
                      </>
                    )}
                  </button>
                  {editingCaseId && (
                    <button
                      type="button"
                      onClick={() => handleSaveCurrentCase(true)}
                      className="py-2 px-3 rounded-2xl bg-white/90 hover:bg-white dark:bg-slate-800/85 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1 border border-slate-200/90 dark:border-slate-700 shadow-2xs transition-all cursor-pointer active:scale-98"
                      title="บันทึกข้อมูลนี้เป็นเคสใหม่โดยไม่เขียนทับเคสเดิม"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      <span>บันทึกเป็นเคสใหม่</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      setShowSavedCases(true);
                    }}
                    className="py-2 px-3.5 rounded-2xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/70 dark:hover:bg-sky-900/70 text-sky-900 dark:text-sky-100 font-bold text-xs flex items-center gap-1.5 border border-sky-200/90 dark:border-sky-700/70 shadow-2xs transition-all cursor-pointer active:scale-98 shrink-0"
                    title="เปิดดูรายการเคสที่บันทึกไว้ในอุปกรณ์"
                  >
                    <FolderArchive className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400" />
                    <span>เคสที่บันทึก ({savedCasesCount})</span>
                  </button>
                </div>

                {/* Input Form Card - Frosted Glass (2 columns on tablet/desktop SaaS workspace) */}
                <div
                  data-saas-two-col={isSaasWorkspace ? 'true' : undefined}
                  className="glass-card-primary rounded-2xl p-2.5 sm:p-4 relative overflow-hidden"
                >
                  <div
                    className={
                      isSaasWorkspace
                        ? 'grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4 items-start'
                        : 'flex flex-col gap-3'
                    }
                  >
                    {/* Left Column Stack (ข้อมูลลูกค้า, ดีลเลอร์, เจ้าหน้าที่) */}
                    <div className={isSaasWorkspace ? 'space-y-3 min-w-0' : 'contents'}>
              {/* Customer Information Card (กล่องใส่ข้อมูลลูกค้า: ชื่อและเบอร์โทร) */}
              <div
                data-card-id="customer"
                className="order-1 p-3 sm:p-3.5 rounded-2xl glass-panel-emerald space-y-2.5 relative overflow-hidden elevated-data-box elevated-box-emerald"
              >
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 dark:via-emerald-400/20 to-transparent opacity-90 pointer-events-none" />
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    {customerPhotoUrl && (
                      <CustomerAvatar
                        photoUrl={customerPhotoUrl}
                        customerName={customerName}
                        size="sm"
                        imgRingClassName="border-emerald-400/90 dark:border-emerald-500/80 ring-2 ring-emerald-500/20"
                      />
                    )}
                    <label className="text-[11px] text-slate-800 dark:text-slate-100 font-bold flex items-center gap-1.5">
                      {!customerPhotoUrl && (
                        <User className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 flex-shrink-0" />
                      )}
                      <span>ข้อมูลลูกค้า</span>
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('medium');
                      setShowIdCardScanner(true);
                    }}
                    className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-[10.5px] flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer shrink-0"
                    title="เปิดกล้องถ่ายรูป หรือเลือกรูปบัตรประชาชนจากคลังภาพ"
                  >
                    <ScanLine className="w-3.5 h-3.5" />
                    <span>สแกนบัตรประชาชน</span>
                  </button>
                </div>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-7 sm:col-span-7 min-w-0">
                    <label className="block text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-1">
                      ชื่อลูกค้า
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => handleCustomerNameChange(e.target.value)}
                      placeholder="ใส่ชื่อลูกค้า (เช่น คุณสมชาย)"
                      className="w-full glass-input-field rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-bold outline-none"
                    />
                  </div>
                  <div className="col-span-5 sm:col-span-5 min-w-0">
                    <label className="block text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-1 flex items-center gap-1">
                      <Phone className="w-2.5 h-2.5 text-slate-400" /> เบอร์โทรศัพท์
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => handleCustomerPhoneChange(e.target.value)}
                      placeholder="08X-XXX-XXXX"
                      className="w-full glass-input-field rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-bold font-mono outline-none"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400 pt-0.5">
                  <span className="text-slate-400 shrink-0">แสดงในเอกสาร:</span>
                  <MarqueeText fitContent className="font-semibold text-emerald-950 dark:text-emerald-200 text-right">
                    {customerDisplay}
                  </MarqueeText>
                </div>

                {/* Extra Customer Eligibility Inputs (เชื่อมเกณฑ์คุณสมบัติ & ลิงก์ไปขอ DV) */}
                <div className="pt-2.5 border-t border-emerald-200/70 dark:border-emerald-800/60 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[10.5px] font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1">
                      <ClipboardCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                      <span>คุณสมบัติลูกค้า (เช็คเกณฑ์ & ลิงก์ไปขอ DV)</span>
                    </span>
                    {customerEligibilityEval.failedTopics.length > 0 ? (
                      <button
                        type="button"
                        onClick={handleOpenDvWithLinkedData}
                        className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 hover:bg-rose-200/80 dark:bg-rose-950/70 dark:hover:bg-rose-900/70 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700/70 flex items-center gap-1 cursor-pointer transition-colors"
                        title="คลิกเพื่อเปิดหน้าขออนุมัติ DV พร้อมดึงหัวข้อที่ไม่ผ่านอัตโนมัติ"
                      >
                        <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                        <span>ขอ DV: {customerEligibilityEval.failedTopics.map((f) => f.code).join(', ')}</span>
                      </button>
                    ) : customerEligibilityEval.checkedCount > 0 && customerEligibilityEval.aceWarnings.length === 0 ? (
                      <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700/70 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span>ผ่านเกณฑ์ {customerEligibilityEval.tier.salesChannel} ✓</span>
                      </span>
                    ) : (
                      <span className="text-[9.5px] font-semibold text-slate-500 dark:text-slate-300 bg-white/70 dark:bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-200/80 dark:border-slate-700">
                        เกณฑ์: {customerEligibilityEval.tier.salesChannel}
                      </span>
                    )}
                  </div>

                  {/* 4 Criteria Inputs: อายุ, รายได้, อายุงาน (ปี/เดือน), พักอาศัย (ปี/เดือน) */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-600 dark:text-slate-300 font-medium mb-1">
                          อายุ (ปี){' '}
                          <span className="text-[9px] text-slate-400">
                            ({customerEligibilityEval.tier.ageLabel})
                          </span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="99"
                          value={customerAge}
                          onChange={(e) => handleCustomerAgeChange(e.target.value)}
                          placeholder={`เช่น ${customerEligibilityEval.tier.minAge}`}
                          className={`w-full glass-input-field rounded-xl px-2.5 py-1.5 text-xs font-bold outline-none ${
                            customerEligibilityEval.fieldStatus.age === 'fail'
                              ? 'border-rose-400 dark:border-rose-500/80 bg-rose-50/60 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200'
                              : customerEligibilityEval.fieldStatus.age === 'pass'
                              ? 'border-emerald-400 dark:border-emerald-500/80 text-emerald-950 dark:text-emerald-200'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-600 dark:text-slate-300 font-medium mb-1">
                          รายได้/เดือน{' '}
                          <span className="text-[9px] text-slate-400">
                            (≥{customerEligibilityEval.tier.incomeLabel})
                          </span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="500"
                          value={customerIncome}
                          onChange={(e) => handleCustomerIncomeChange(e.target.value)}
                          placeholder={`≥ ${customerEligibilityEval.tier.incomeLabel}`}
                          className={`w-full glass-input-field rounded-xl px-2.5 py-1.5 text-xs font-bold outline-none ${
                            customerEligibilityEval.fieldStatus.income === 'fail'
                              ? 'border-rose-400 dark:border-rose-500/80 bg-rose-50/60 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200'
                              : customerEligibilityEval.fieldStatus.income === 'pass'
                              ? 'border-emerald-400 dark:border-emerald-500/80 text-emerald-950 dark:text-emerald-200'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                      <YearsMonthsInput
                        label="อายุงาน"
                        criteriaHint={`≥${customerEligibilityEval.tier.workMonthsLabel}`}
                        value={customerWorkMonths}
                        onChange={handleCustomerWorkMonthsChange}
                        status={customerEligibilityEval.fieldStatus.workMonths}
                      />

                      <YearsMonthsInput
                        label="พักอาศัย"
                        criteriaHint={`≥${customerEligibilityEval.tier.residenceLabel}`}
                        value={customerResidenceMonths}
                        onChange={handleCustomerResidenceMonthsChange}
                        status={customerEligibilityEval.fieldStatus.residenceMonths}
                      />
                    </div>
                  </div>

                  {/* Occupation + ACE Toggle Row */}
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-7 sm:col-span-8 min-w-0">
                      <label className="block text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-1">
                        อาชีพ (ซิงก์ไปหน้า DV)
                      </label>
                      <input
                        type="text"
                        value={customerOccupation}
                        onChange={(e) => handleCustomerOccupationChange(e.target.value)}
                        placeholder="เช่น พนักงานประจำ, ค้าขาย, ไรเดอร์"
                        className="w-full glass-input-field rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-semibold outline-none"
                      />
                    </div>
                    <div className="col-span-5 sm:col-span-4 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('selection');
                          handleIsAceCustomerChange(!isAceCustomer);
                        }}
                        className={`w-full py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
                          isAceCustomer
                            ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                            : 'bg-white/85 dark:bg-slate-800/85 hover:bg-amber-50 dark:hover:bg-amber-950/50 text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-slate-700'
                        }`}
                      >
                        <ShieldAlert
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isAceCustomer ? 'text-white' : 'text-amber-600 dark:text-amber-400'
                          }`}
                        />
                        <span>ลูกค้า ACE</span>
                      </button>
                    </div>
                  </div>

                  {/* ACE Warning Strip */}
                  {(isAceCustomer || proposalKey === 'aec') && (
                    <div className="p-2 rounded-xl bg-amber-50/90 dark:bg-amber-950/55 border border-amber-300/90 dark:border-amber-700/70 text-[10px] text-amber-950 dark:text-amber-200 space-y-1">
                      <div className="font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>{ACE_FULL_NOTE}</span>
                      </div>
                      {customerEligibilityEval.aceWarnings.map((warn) => (
                        <div key={warn} className="text-rose-700 dark:text-rose-300 font-extrabold pl-4">
                          • {warn}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Failed Criteria -> Quick Link to DV */}
                  {customerEligibilityEval.failedTopics.length > 0 && (
                    <div className="p-2 rounded-xl bg-rose-50/90 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 flex items-center justify-between gap-2 flex-wrap">
                      <div className="text-[10px] font-bold text-rose-800 dark:text-rose-200 space-y-0.5">
                        <div>
                          ไม่ผ่านเกณฑ์ {customerEligibilityEval.tier.shortTitle}:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {customerEligibilityEval.failedTopics.map((f) => (
                            <span
                              key={f.code}
                              className="px-1.5 py-0.5 rounded bg-white dark:bg-rose-900/60 border border-rose-200 dark:border-rose-700/70 text-rose-800 dark:text-rose-100 font-bold"
                            >
                              {f.dvTopic}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenDvWithLinkedData}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer shrink-0"
                      >
                        <span>ส่งขออนุมัติ DV</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Thai National ID Card Info Block (เก็บในข้อมูลเคสเท่านั้น ไม่แสดงในใบเสนอราคา & LINE) */}
                <div className="pt-2.5 border-t border-emerald-200/70 dark:border-emerald-800/60 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[10.5px] font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                      <span>ข้อมูลบัตรประชาชน (เก็บในเคสเท่านั้น)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setShowIdCardDetails((prev) => !prev);
                      }}
                      className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>
                        {showIdCardDetails || customerIdCard || customerAddress || customerPhotoUrl
                          ? showIdCardDetails
                            ? 'ซ่อนรายละเอียด'
                            : 'ดู/แก้ไขข้อมูลบัตร'
                          : '+ กรอกหรือดูข้อมูลบัตร'}
                      </span>
                      {showIdCardDetails ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  </div>

                  {!showIdCardDetails && (customerIdCard || customerAddress || customerPhotoUrl) && (
                    <div
                      onClick={() => setShowIdCardDetails(true)}
                      className="p-2 rounded-xl bg-white/75 dark:bg-slate-900/70 border border-emerald-200/80 dark:border-emerald-800/60 text-[11px] flex items-center gap-2.5 cursor-pointer hover:border-emerald-400 transition-colors"
                    >
                      {customerPhotoUrl && (
                        <CustomerAvatar
                          photoUrl={customerPhotoUrl}
                          customerName={customerName}
                          size="md"
                        />
                      )}
                      <div className="min-w-0 flex-1 space-y-0.5">
                        {customerIdCard && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500 dark:text-slate-400">เลขบัตร 13 หลัก:</span>
                            <span className="font-mono font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                              {formatThaiIdDisplay(customerIdCard)}
                            </span>
                          </div>
                        )}
                        {customerAddress && (
                          <div className="text-[10.5px] text-slate-600 dark:text-slate-300 truncate">
                            ที่อยู่: {customerAddress}
                          </div>
                        )}
                        {!customerIdCard && !customerAddress && customerPhotoUrl && (
                          <div className="text-[10.5px] font-semibold text-emerald-800 dark:text-emerald-200">
                            แนบรูปโปรไฟล์จากบัตรประชาชนแล้ว (จะแสดงในเคสที่บันทึก)
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {showIdCardDetails && (
                    <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/75 border border-emerald-200/80 dark:border-emerald-800/60 space-y-2 animate-fade-in">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <label className="text-[10px] text-slate-600 dark:text-slate-300 font-semibold">
                            เลขประจำตัวประชาชน 13 หลัก
                          </label>
                          <div className="flex items-center gap-2">
                            {customerIdCard && (
                              <span
                                className={`text-[9.5px] font-bold ${
                                  validateThaiNationalId(customerIdCard).isValid
                                    ? 'text-emerald-700 dark:text-emerald-300'
                                    : 'text-amber-700 dark:text-amber-300'
                                }`}
                              >
                                {validateThaiNationalId(customerIdCard).isValid
                                  ? '✓ ครบ 13 หลัก'
                                  : 'ควรตรวจทาน'}
                              </span>
                            )}
                            {customerIdCard && (
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard?.writeText(customerIdCard);
                                  triggerHaptic('light');
                                  triggerToast('คัดลอกเลขบัตรประชาชนแล้ว');
                                }}
                                className="text-[9.5px] font-bold text-sky-700 dark:text-sky-300 hover:underline flex items-center gap-0.5 cursor-pointer"
                              >
                                <Copy className="w-2.5 h-2.5" /> คัดลอก
                              </button>
                            )}
                          </div>
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={17}
                          value={formatThaiIdDisplay(customerIdCard)}
                          onChange={(e) => handleCustomerIdCardChange(e.target.value)}
                          placeholder="X-XXXX-XXXXX-XX-X"
                          className="w-full glass-input-field rounded-xl px-2.5 py-1.5 text-xs font-mono font-extrabold text-slate-900 dark:text-slate-100 tracking-wider tabular-nums outline-none"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <label className="text-[10px] text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>
                              ที่อยู่ตามบัตรประชาชน
                              {customerBirthDate
                                ? ` • เกิด ${formatThaiDateFromIso(customerBirthDate)}`
                                : ''}
                            </span>
                          </label>
                          {customerAddress && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard?.writeText(customerAddress);
                                triggerHaptic('light');
                                triggerToast('คัดลอกที่อยู่ตามบัตรแล้ว');
                              }}
                              className="text-[9.5px] font-bold text-sky-700 dark:text-sky-300 hover:underline flex items-center gap-0.5 cursor-pointer"
                            >
                              <Copy className="w-2.5 h-2.5" /> คัดลอก
                            </button>
                          )}
                        </div>
                        <textarea
                          rows={2}
                          value={customerAddress}
                          onChange={(e) => handleCustomerAddressChange(e.target.value)}
                          placeholder="บ้านเลขที่ หมู่ ถนน ตำบล อำเภอ จังหวัด (สแกนบัตรหรือกรอกเอง)"
                          className="w-full glass-input-field rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-900 dark:text-slate-100 outline-none leading-relaxed"
                        />
                      </div>

                      {customerPhotoUrl && (
                        <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/60">
                          <div className="flex items-center gap-2 min-w-0">
                            <CustomerAvatar
                              photoUrl={customerPhotoUrl}
                              customerName={customerName}
                              size="sm"
                            />
                            <span className="text-[10.5px] font-bold text-emerald-900 dark:text-emerald-200 truncate">
                              รูปโปรไฟล์จากบัตร (พร้อมบันทึกเข้าเคส)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('light');
                              handleCustomerPhotoUrlChange('');
                            }}
                            className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer shrink-0"
                          >
                            ลบรูป
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2 pt-0.5 text-[10px]">
                        <span className="text-slate-500 dark:text-slate-400">
                          ซิงค์ขึ้น Cloud กับเคส (ไม่แสดงในใบเสนอราคา/LINE)
                        </span>
                        {(customerIdCard || customerAddress || customerBirthDate || customerPhotoUrl) && (
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('light');
                              handleCustomerIdCardChange('');
                              handleCustomerAddressChange('');
                              handleCustomerBirthDateChange('');
                              handleCustomerPhotoUrlChange('');
                            }}
                            className="text-rose-600 dark:text-rose-400 font-bold hover:underline cursor-pointer shrink-0"
                          >
                            ล้างข้อมูลบัตร
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Dealer Information Card (กล่องใส่ชื่อร้านตัวแทนจำหน่าย ลิงก์ไปยังเอกสารและทุกส่วน) */}
              <div
                data-card-id="dealer"
                className="order-2 p-3 sm:p-3.5 rounded-2xl glass-panel-cyan space-y-2 relative overflow-hidden elevated-data-box elevated-box-blue"
              >
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 dark:via-sky-400/20 to-transparent opacity-90 pointer-events-none" />
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] text-slate-800 dark:text-slate-100 font-bold flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400 flex-shrink-0" />
                    <span>ร้านตัวแทนจำหน่าย (Dealer)</span>
                  </label>
                  <span className="text-[9.5px] font-bold text-sky-700 dark:text-sky-200 bg-white/80 dark:bg-sky-950/60 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-sky-200/80 dark:border-sky-700/60 shadow-2xs shrink-0">
                    ลิงก์ใบเสนอราคา / อนุมัติ / DV
                  </span>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={dealerName}
                    onChange={(e) => handleDealerNameChange(e.target.value)}
                    placeholder="ใส่ชื่อ Dealer (เช่น ป.ยานยนต์(สนญ.), แสงชัยพาณิชย์...)"
                    className="w-full glass-input-field rounded-xl pl-3 pr-8 py-2 text-xs text-slate-900 dark:text-slate-100 font-bold outline-none"
                  />
                  {dealerName && (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        handleDealerNameChange('');
                      }}
                      className="absolute right-2 w-5 h-5 rounded-full bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                      title="ล้างชื่อ Dealer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium shrink-0">เลือกด่วน:</span>
                  {COMMON_DEALER_SUGGESTIONS.slice(0, 5).map((preset) => {
                    const isSelected = dealerName.trim() === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          handleDealerNameChange(isSelected ? '' : preset);
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold whitespace-nowrap border transition-all cursor-pointer shrink-0 ${
                          isSelected
                            ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                            : 'bg-white/80 hover:bg-sky-50 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 border-sky-200/80 dark:border-sky-800/60'
                        }`}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>
              </div>

            {/* Collapsible Officer Info Card (ข้อมูลเจ้าหน้าที่ / ผู้เสนอราคา) */}
            <div
              data-card-id="officer"
              className="order-6 p-3 sm:p-3.5 rounded-2xl glass-panel-blue space-y-2.5 relative overflow-hidden elevated-data-box elevated-box-blue"
            >
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 dark:via-sky-400/20 to-transparent opacity-90 pointer-events-none" />
              <div
                data-card-toggle="true"
                onClick={() => {
                  triggerHaptic('light');
                  setIsOfficerExpanded((prev) => !prev);
                }}
                className={`flex items-center justify-between gap-2 cursor-pointer select-none ${
                  isOfficerExpanded ? 'pb-2 border-b border-blue-200/60 dark:border-sky-700/60' : ''
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-xl bg-blue-100 dark:bg-sky-950/80 text-blue-700 dark:text-sky-300 flex items-center justify-center shadow-2xs shrink-0">
                    <UserCheck className="w-4 h-4 text-blue-700 dark:text-sky-300" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] sm:text-xs text-slate-800 dark:text-slate-100 font-bold block">
                      ข้อมูลเจ้าหน้าที่ / ผู้เสนอราคา
                    </span>
                    {!isOfficerExpanded && (
                      <span className="text-[10px] text-slate-600 dark:text-slate-300 block truncate">
                        {officerName.trim() || 'ยังไม่ระบุชื่อ'}
                        {officerCode.trim() ? ` · รหัส ${officerCode.trim()}` : ''}
                        {officerLicense.trim() ? ` · นายหน้า ${officerLicense.trim()}` : ''}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerHaptic('light');
                    setIsOfficerExpanded((prev) => !prev);
                  }}
                  className="p-1.5 rounded-xl bg-white/90 hover:bg-slate-100 dark:bg-slate-800/90 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white transition-colors cursor-pointer border border-slate-200/80 dark:border-slate-700 shadow-2xs shrink-0"
                  title={isOfficerExpanded ? 'ย่อกล่อง' : 'แก้ไขข้อมูลเจ้าหน้าที่'}
                >
                  {isOfficerExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </div>

              {isOfficerExpanded && (
                <div className="grid grid-cols-12 gap-2 pt-0.5 animate-fade-in">
                  <div className="col-span-7 sm:col-span-8 min-w-0">
                    <label className="block text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-1">
                      ชื่อเจ้าหน้าที่
                    </label>
                    <input
                      type="text"
                      value={officerName}
                      onChange={(e) => handleOfficerNameChange(e.target.value)}
                      placeholder="ใส่ชื่อเจ้าหน้าที่"
                      className="w-full glass-input-field rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-bold outline-none"
                    />
                  </div>
                  <div className="col-span-5 sm:col-span-4 min-w-0">
                    <label className="block text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-1">
                      โค้ด / รหัส
                    </label>
                    <input
                      type="text"
                      value={officerCode}
                      onChange={(e) => handleOfficerCodeChange(e.target.value)}
                      placeholder="ใส่โค้ด"
                      className="w-full glass-input-field rounded-xl px-2.5 py-1.5 text-xs text-blue-900 dark:text-sky-200 font-bold font-mono outline-none"
                    />
                  </div>
                  <div className="col-span-12">
                    <label className="block text-[10px] text-slate-600 dark:text-slate-300 font-medium mb-1 flex items-center justify-between gap-2 flex-wrap">
                      <span className="flex items-center gap-1 font-semibold text-blue-950 dark:text-sky-200">
                        <Award className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
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
                      className="w-full glass-input-field rounded-xl px-2.5 py-1.5 text-xs text-blue-950 dark:text-sky-200 font-semibold font-mono outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
                    </div>

                    {/* Right Column Stack (ข้อมูลรถ, ประกัน PA, เงินดาวน์ & ยอดจัด) */}
                    <div className={isSaasWorkspace ? 'space-y-3 min-w-0' : 'contents'}>
              {/* Vehicle & Proposal Information Card (กล่องข้อมูลรถเหมือนกับกล่องข้อมูลเจ้าหน้าที่) */}
              <div
                data-card-id="pricing"
                className="order-3 p-3 sm:p-3.5 rounded-2xl glass-panel-blue space-y-2.5 relative overflow-hidden elevated-data-box elevated-box-blue"
              >
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 dark:via-sky-400/20 to-transparent opacity-90 pointer-events-none" />
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-[11px] text-slate-800 dark:text-slate-100 font-bold flex items-center gap-1.5">
                    <Bike className="w-3.5 h-3.5 text-blue-700 dark:text-sky-400 flex-shrink-0" />
                    <span>ข้อมูลรถและเงื่อนไขข้อเสนอ</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setShowEligibilityCriteriaModal(true);
                    }}
                    className="text-[10px] font-extrabold text-sky-800 dark:text-sky-200 bg-white/95 hover:bg-sky-50 dark:bg-sky-950/70 dark:hover:bg-sky-900/70 px-2.5 py-1 rounded-full border border-sky-300/90 dark:border-sky-700/70 shadow-2xs flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                    title="เปิดดูตารางเกณฑ์คุณสมบัติ ช่องทางการขาย และเงื่อนไข ACE"
                  >
                    <ClipboardCheck className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                    <span>เกณฑ์คุณสมบัติ ({customerEligibilityEval.tier.salesChannel})</span>
                  </button>
                </div>

                {/* Proposal Select */}
                <div>
                  <div className="flex justify-between items-center mb-1 gap-2">
                    <label className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1">
                      เลือกประเภทข้อเสนอ (Proposal) *
                    </label>
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setShowEligibilityCriteriaModal(true);
                        }}
                        className="text-[10px] text-sky-700 dark:text-sky-400 hover:underline flex items-center gap-0.5 font-bold cursor-pointer"
                      >
                        <Table className="w-3 h-3" /> ตารางเกณฑ์
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowProposalInfo(true)}
                        className="text-[10px] text-blue-700 dark:text-sky-300 hover:underline flex items-center gap-0.5 font-medium cursor-pointer"
                      >
                        <Info className="w-3 h-3" /> ดูเงื่อนไข
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      id="proposal-select-trigger"
                      onClick={() => setShowProposalSelector(true)}
                      className="w-full glass-input-field rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 font-semibold outline-none flex items-center justify-between cursor-pointer hover:border-blue-400 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                        <MarqueeText fitContent className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {currentProposal.name}
                        </MarqueeText>
                        <span className="font-mono text-[10px] text-blue-700 dark:text-sky-300 font-bold bg-blue-50 dark:bg-sky-950/70 px-1.5 py-0.5 rounded border border-blue-200/60 dark:border-sky-700/60 whitespace-nowrap flex-shrink-0">
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
                    <label className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                      ราคารถตัวเปล่า (บาท) *
                    </label>
                    {currentCalculation.insuranceTotalWithVat > 0 && (
                      <span className="text-[10px] font-bold text-blue-700 dark:text-sky-300 bg-blue-50 dark:bg-sky-950/70 px-2 py-0.5 rounded-full border border-blue-200 dark:border-sky-700/60">
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
                    className="w-full glass-input-field rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-bold outline-none"
                    placeholder="เช่น 65000"
                  />
                </div>
              </div>

              {/* PA Insurance Protection Selection (แผน A vs แผน B) */}
              <div
                data-card-id="insurance"
                className="order-4 p-3 sm:p-3.5 rounded-2xl glass-panel-amber space-y-2 relative overflow-hidden elevated-data-box elevated-box-amber"
              >
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 dark:via-amber-400/20 to-transparent opacity-90 pointer-events-none" />
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-700 dark:text-amber-400" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      ความคุ้มครองประกันภัย (Group PA)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowInsuranceModal(true)}
                      className="text-[10px] font-bold text-blue-700 dark:text-sky-400 hover:underline flex items-center gap-0.5 cursor-pointer"
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
                        : 'glass-pill text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-800/80'
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
                        : 'glass-pill text-blue-900 dark:text-sky-200 hover:bg-white/80 dark:hover:bg-slate-800/80'
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
                        : 'glass-pill text-amber-900 dark:text-amber-300 hover:bg-white/80 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    แผน B (PA+)
                  </button>
                </div>

                {/* If Plan A or Plan B Selected: Years Selection & Price Breakdown */}
                {insurancePlan !== 'none' && activeInsurancePlan && (
                  <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-600 dark:text-slate-300 font-medium">เลือกระยะเวลาคุ้มครอง:</span>
                      <span className="text-[10px] text-blue-800 dark:text-sky-300 font-semibold">
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
                              ? 'bg-blue-900 dark:bg-sky-600 text-white shadow-xs'
                              : 'glass-pill text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800/80'
                          }`}
                        >
                          <div>{y} ปี</div>
                          <div className="text-[10px] font-normal opacity-90">
                            +{formatBaht(activeInsurancePlan.premiums[y])}
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="p-2.5 rounded-xl glass-mini-card text-[11px] text-blue-950 dark:text-slate-100 space-y-1">
                      <div className="flex justify-between items-center font-bold">
                        <span>{currentCalculation.insurancePlanName}:</span>
                        <span className="text-blue-700 dark:text-sky-300 font-extrabold">
                          +{formatBaht(currentCalculation.insuranceTotalWithVat, true)}
                        </span>
                      </div>
                      <div className="flex flex-wrap justify-between gap-1 text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/50 dark:border-slate-700/60">
                        <span>เบี้ยสุทธิ {formatBaht(currentCalculation.insuranceBasePremium)} + VAT 7% ({formatBaht(currentCalculation.insuranceVat, true)})</span>
                        <span className="text-blue-800 dark:text-sky-300 font-medium">รวมในยอดจัดไฟแนนซ์</span>
                      </div>
                    </div>

                  </div>
                )}
              </div>

            {/* Financing Terms Card (กล่องข้อมูลเงินดาวน์และยอดจัดไฟแนนซ์) */}
            <div
              data-card-id="financing"
              className="order-5 p-3 sm:p-3.5 rounded-2xl glass-panel-indigo relative overflow-hidden elevated-data-box elevated-box-blue transition-all duration-200"
            >
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 dark:via-indigo-400/20 to-transparent opacity-90 pointer-events-none" />

                {/* Collapsible Header: นำป้าย 'ยอดจัด & ระยะเวลาผ่อน' ออกตามที่ระบุในรูป */}
                <div
                  data-card-toggle="true"
                  onClick={() => {
                    triggerHaptic('light');
                    setExpandedCard((prev) => (prev === 'financing' ? null : 'financing'));
                  }}
                  className={`flex items-center justify-between gap-2 cursor-pointer select-none transition-all ${
                    expandedCard === 'financing' ? 'pb-2.5 border-b border-blue-200/60 dark:border-indigo-700/60' : 'pb-0'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-xl bg-blue-100 dark:bg-indigo-950/80 text-blue-700 dark:text-indigo-300 flex items-center justify-center shadow-2xs shrink-0">
                      <Banknote className="w-4 h-4 text-blue-700 dark:text-indigo-300" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="text-[11px] sm:text-xs text-slate-800 dark:text-slate-100 font-bold flex items-center gap-1.5 cursor-pointer">
                          <span>ข้อมูลเงินดาวน์และยอดจัดไฟแนนซ์</span>
                        </label>
                      </div>
                      {expandedCard !== 'financing' && (
                        <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-600 dark:text-slate-300 mt-0.5 font-medium">
                          <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                            ดาวน์ {formatBaht(currentCalculation.downAmount)} ({currentCalculation.downPercent.toFixed(1)}%)
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-blue-800 dark:text-sky-300 font-bold">
                            ผ่อน {term} งวด
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-700 dark:text-slate-200 font-bold">
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
                    className="p-1.5 rounded-xl bg-white/90 hover:bg-slate-100 dark:bg-slate-800/90 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white transition-colors cursor-pointer border border-slate-200/80 dark:border-slate-700 shadow-2xs shrink-0"
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
                    <label className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
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
                      className="text-[10px] font-bold text-blue-700 hover:text-blue-900 dark:text-sky-300 dark:hover:text-sky-200 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md px-2 py-0.5 rounded-lg border border-blue-200/60 dark:border-sky-700/60 transition-colors cursor-pointer shadow-2xs"
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
                    className="w-full glass-input-field rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-bold outline-none"
                  />
                </div>

                {/* Quick Down Payment Chips */}
                <div className="pt-0.5">
                  <div className="text-[10px] text-slate-400 mb-1 flex justify-between font-medium">
                    <span>เลือกเงินดาวน์ด่วน:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
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
                              : 'glass-pill text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
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
                              : 'glass-pill text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
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
                    <span className="text-[10.5px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <Banknote className="w-3.5 h-3.5 text-blue-700 dark:text-sky-400" />
                      <span>ราคายอดจัด (หลังหักเงินดาวน์):</span>
                    </span>
                    <span className="text-sm font-black text-blue-900 dark:text-sky-300 font-mono">
                      {formatBaht(currentCalculation.vehicleFinanceAmount)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/50 dark:border-slate-700/60 text-[10px]">
                    <div className="min-w-0">
                      <span className="text-slate-400 block">ยอดจัดเฉพาะตัวรถ:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        {formatBaht(currentCalculation.vehicleFinanceAmount)}
                      </span>
                      <MarqueeText className="text-[9px] text-slate-400">
                        (ราคารถ - เงินดาวน์ {formatBaht(currentCalculation.downAmount)})
                      </MarqueeText>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block">ยอดจัดไฟแนนซ์รวม:</span>
                      <span className="font-extrabold text-blue-700 dark:text-sky-300">
                        {formatBaht(currentCalculation.financeAmount, true)}
                      </span>
                      <span className="text-[9px] text-blue-600 dark:text-sky-400 block">
                        {currentCalculation.insuranceTotalWithVat > 0 ? '(รวม PA+VAT)' : '(ยอดจัดสุทธิ)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Visual Ratio Bar (เงินดาวน์ vs ยอดจัด) */}
                <div className="pt-0.5 space-y-1">
                  <div className="relative py-0.5">
                    <div className="h-2.5 w-full bg-slate-200/80 dark:bg-slate-800/80 rounded-full overflow-hidden flex p-0.5 border border-white/90 dark:border-slate-700/80 shadow-inner">
                      <div
                        style={{
                          width: `${Math.min(Math.max(currentCalculation.downPercent, 0), 100)}%`,
                        }}
                        className={`h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500 ease-out shadow-2xs ${
                          currentCalculation.downPercent > 0 ? 'animate-fuel-shimmer' : ''
                        }`}
                      />
                      <div
                        style={{
                          width: `${Math.min(Math.max(100 - currentCalculation.downPercent, 0), 100)}%`,
                        }}
                        className={`h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-500 ease-out ${
                          100 - currentCalculation.downPercent > 0 ? 'animate-fuel-shimmer' : ''
                        }`}
                      />
                    </div>
                    {currentCalculation.downPercent > 0 && currentCalculation.downPercent < 100 && (
                      <div
                        className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-500 ease-out z-10"
                        style={{
                          left: `${Math.min(97, Math.max(3, currentCalculation.downPercent))}%`,
                        }}
                      >
                        <span className="absolute inset-0 w-3 h-3 -m-[2.5px] rounded-full bg-emerald-400 animate-fuel-tip-ping" />
                        <span className="block w-2 h-2 rounded-full bg-white border-[1.5px] border-slate-800 shadow-sm" />
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between items-center text-[9.5px] font-semibold text-slate-500 dark:text-slate-400 px-0.5">
                    <span className="flex items-center gap-1 text-emerald-800 dark:text-emerald-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      ดาวน์ {currentCalculation.downPercent.toFixed(1)}% ({formatBaht(currentCalculation.downAmount)})
                    </span>
                    <span className="flex items-center gap-1 text-blue-900 dark:text-sky-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block" />
                      จัด {(100 - currentCalculation.downPercent).toFixed(1)}% ({formatBaht(currentCalculation.vehicleFinanceAmount)})
                    </span>
                  </div>
                </div>

                {/* Term Selection */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                      ระยะเวลาผ่อน (งวด) *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowEirInfo(true)}
                      className="text-[10px] text-blue-700 hover:text-blue-900 dark:text-sky-300 dark:hover:text-sky-200 font-bold flex items-center gap-1 cursor-pointer transition-colors"
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
                      className="w-full appearance-none glass-input-field rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-bold outline-none pr-7 cursor-pointer"
                    >
                      {currentProposal.validTerms.map((t) => (
                        <option key={t} value={t} className="dark:bg-slate-900 dark:text-slate-100">
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
                      <label className="block text-[11px] text-slate-700 dark:text-slate-200 font-bold">
                        หลักเกณฑ์อัตราดอกเบี้ยที่ใช้
                      </label>
                      {isCustomRateEnabled && (
                        <span className="text-[9.5px] bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 font-bold px-1.5 py-0.5 rounded-full border border-amber-300 dark:border-amber-700/70 flex items-center gap-0.5 shadow-2xs">
                          <Pencil className="w-2.5 h-2.5 text-amber-700 dark:text-amber-400" /> ระบุเอง
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isCustomRateEnabled ? (
                        <button
                          type="button"
                          onClick={handleResetToProposalRate}
                          className="text-[10px] text-amber-800 hover:text-amber-950 dark:text-amber-200 dark:hover:text-white font-bold px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/70 border border-amber-300 dark:border-amber-700/70 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                          title="รีเซ็ตกลับเป็นอัตราตามเงื่อนไข Proposal เดิม"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          <span>รีเซ็ตตาม Proposal</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleToggleCustomRate}
                          className="text-[10px] text-blue-700 hover:text-blue-900 dark:text-sky-300 dark:hover:text-sky-200 font-bold px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-sky-950/70 dark:hover:bg-sky-900/70 border border-blue-200 dark:border-sky-700/70 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
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
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-50/95 via-orange-50/90 to-amber-100/60 dark:from-amber-950/80 dark:via-slate-900/90 dark:to-amber-950/60 border-2 border-amber-400/90 dark:border-amber-600/70 shadow-sm space-y-2.5 animate-fade-in elevated-data-box elevated-box-amber">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <div className="w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-xs shadow-xs shrink-0">
                            %
                          </div>
                          <div className="min-w-0 flex-1">
                            <MarqueeText className="text-[11.5px] font-bold text-amber-950 dark:text-amber-100">
                              แก้ไขดอกเบี้ยให้ตรงระบบบริษัท
                            </MarqueeText>
                            <MarqueeText className="text-[9.5px] text-amber-800 dark:text-amber-300">
                              ปรับเรทดอกเบี้ยสำหรับเคสพิเศษหรือระบบบริษัทที่ตัวเลขไม่ตรง
                            </MarqueeText>
                          </div>
                        </div>

                        {/* Switch Type: % ต่อเดือน vs % ต่อปี */}
                        <div className="flex items-center p-0.5 bg-amber-200/70 dark:bg-amber-950/80 rounded-xl border border-amber-300/80 dark:border-amber-700/70 text-[10px] shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCustomRateTypeChange('monthly')}
                            className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                              customRateType === 'monthly'
                                ? 'bg-white dark:bg-amber-500 text-amber-950 dark:text-white shadow-xs'
                                : 'text-amber-800 dark:text-amber-200 hover:text-amber-950 dark:hover:text-white'
                            }`}
                          >
                            % ต่อเดือน
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCustomRateTypeChange('annual')}
                            className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                              customRateType === 'annual'
                                ? 'bg-white dark:bg-amber-500 text-amber-950 dark:text-white shadow-xs'
                                : 'text-amber-800 dark:text-amber-200 hover:text-amber-950 dark:hover:text-white'
                            }`}
                          >
                            % ต่อปี
                          </button>
                        </div>
                      </div>

                      {/* Number Input - ปรับปรุงโครงสร้างให้กว้าง ไม่ซ้อนทับกัน */}
                      <div className="space-y-1.5">
                        <div className="flex items-center bg-white dark:bg-slate-900 rounded-xl border-2 border-amber-400 dark:border-amber-600 focus-within:border-amber-600 focus-within:ring-2 focus-within:ring-amber-300 shadow-inner px-3 py-1.5 transition-all">
                          <label className="text-xs font-bold text-amber-900 dark:text-amber-200 mr-2 shrink-0 select-none">
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
                            className="flex-1 text-center text-lg font-black text-slate-900 dark:text-white outline-none bg-transparent min-w-0"
                          />
                          <span className="text-xs font-bold text-amber-900 dark:text-amber-200 bg-amber-100/90 dark:bg-amber-950/80 px-2.5 py-1 rounded-lg border border-amber-300/80 dark:border-amber-700/70 shrink-0 ml-2 select-none whitespace-nowrap">
                            {customRateType === 'monthly' ? '% ต่อเดือน' : '% ต่อปี'}
                          </span>
                        </div>

                        {/* ปุ่มปรับละเอียด +/- 0.01 และ +/- 0.05 */}
                        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleAdjustRate(-0.05)}
                              className="px-2 sm:px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 border border-amber-300 dark:border-amber-700/70 text-amber-900 dark:text-amber-200 font-bold text-xs transition-all cursor-pointer shadow-2xs"
                              title="ลดลง 0.05%"
                            >
                              -0.05%
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdjustRate(-0.01)}
                              className="px-2 sm:px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 border border-amber-300 dark:border-amber-700/70 text-amber-900 dark:text-amber-200 font-bold text-xs transition-all cursor-pointer shadow-2xs"
                              title="ลดลง 0.01%"
                            >
                              -0.01%
                            </button>
                          </div>

                          <span className="text-[10px] text-amber-800 dark:text-amber-300 font-medium select-none">
                            ปุ่มปรับละเอียด
                          </span>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleAdjustRate(0.01)}
                              className="px-2 sm:px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 border border-amber-300 dark:border-amber-700/70 text-amber-900 dark:text-amber-200 font-bold text-xs transition-all cursor-pointer shadow-2xs"
                              title="เพิ่มขึ้น 0.01%"
                            >
                              +0.01%
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdjustRate(0.05)}
                              className="px-2 sm:px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 border border-amber-300 dark:border-amber-700/70 text-amber-900 dark:text-amber-200 font-bold text-xs transition-all cursor-pointer shadow-2xs"
                              title="เพิ่มขึ้น 0.05%"
                            >
                              +0.05%
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Quick Preset Chips */}
                      <div className="space-y-1">
                        <div className="text-[10px] text-amber-900 dark:text-amber-200 font-semibold flex items-center justify-between">
                          <span>แตะเพื่อเลือกเรทดอกเบี้ยยอดนิยม:</span>
                          <span className="text-[9.5px] text-amber-800 dark:text-amber-300">
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
                                    : 'bg-white hover:bg-amber-100/90 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-700/60'
                                }`}
                              >
                                {presetRate.toFixed(2)}%
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Compliance & EIR Information */}
                      <div className="pt-1.5 border-t border-amber-200/80 dark:border-amber-800/60 flex flex-wrap items-center justify-between gap-1 text-[10px]">
                        <span className="text-amber-950 dark:text-amber-100 font-medium">
                          EIR สัญญานี้: <strong className="text-amber-950 dark:text-amber-100 font-black">{currentCalculation.eirAnnualPercent.toFixed(2)}% ต่อปี</strong>{' '}
                          {currentCalculation.eirAnnualPercent <= 23 ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-bold">(✓ ไม่เกิน 23%)</span>
                          ) : (
                            <span className="text-amber-800 dark:text-amber-300 font-bold">(คำนวณตามเรทที่ระบุ)</span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 cursor-pointer text-amber-950 dark:text-amber-100 font-medium">
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
                            className="text-amber-800 dark:text-amber-300 underline hover:text-amber-950 dark:hover:text-white font-bold cursor-pointer"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
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
                      <div className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-200 mb-1 leading-snug">
                        อัตราดอกเบี้ย (%) <span className="text-rose-500">*</span>{' '}
                        <span className="text-amber-600 dark:text-amber-400 font-bold">ตาม Proposal ดั้งเดิม</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-base font-black text-slate-800 dark:text-slate-100">
                          {(currentCalculation.proposalMonthlyRate * 100).toFixed(3)}
                          <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400 ml-1">% / เดือน</span>
                        </div>
                        {isCustomRateEnabled ? (
                          <span className="text-slate-600 dark:text-slate-300 text-[9.5px] bg-slate-200/80 dark:bg-slate-700/80 px-1.5 py-0.5 rounded font-bold">
                            เรทเดิม
                          </span>
                        ) : currentCalculation.isCappedByEir ? (
                          <span className="text-amber-800 dark:text-amber-200 text-[9.5px] bg-amber-200/80 dark:bg-amber-900/70 px-1.5 py-0.5 rounded font-bold">
                            เกินเพดาน
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
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
                      <div className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-200 mb-1 leading-snug flex items-center justify-between">
                        <span>
                          อัตราดอกเบี้ย (%) <span className="text-rose-500">*</span>{' '}
                          <span className={isCustomRateEnabled ? 'text-amber-800 dark:text-amber-300 font-bold' : 'text-amber-600 dark:text-amber-400 font-bold'}>
                            {isCustomRateEnabled ? 'กำหนดเอง (ระบบบริษัท)' : currentCalculation.eirMaxMessage}
                          </span>
                        </span>
                        {!isCustomRateEnabled && (
                          <button
                            type="button"
                            onClick={handleToggleCustomRate}
                            className="text-[9.5px] text-blue-700 hover:text-blue-900 dark:text-sky-300 dark:hover:text-sky-200 font-bold underline cursor-pointer"
                          >
                            แก้ไขเรท
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div
                          className={`text-base font-black flex items-center gap-1 ${
                            isCustomRateEnabled ? 'text-amber-950 dark:text-amber-200' : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {isCustomRateEnabled ? (
                            <Pencil className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 inline" />
                          ) : (
                            <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 inline" />
                          )}
                          {(currentCalculation.effectiveMonthlyRate * 100).toFixed(3)}
                          <span
                            className={`text-[11px] font-normal ml-1 ${
                              isCustomRateEnabled ? 'text-amber-800 dark:text-amber-300' : 'text-emerald-800 dark:text-emerald-300'
                            }`}
                          >
                            % / เดือน
                          </span>
                        </div>
                        <span
                          className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${
                            isCustomRateEnabled
                              ? 'bg-amber-200 dark:bg-amber-900/70 text-amber-950 dark:text-amber-100'
                              : 'bg-emerald-200 dark:bg-emerald-900/70 text-emerald-900 dark:text-emerald-100'
                          }`}
                        >
                          {isCustomRateEnabled ? 'ใช้คำนวณจริง' : 'บังคับใช้จริง'}
                        </span>
                      </div>
                      <div
                        className={`text-[10px] font-medium mt-0.5 ${
                          isCustomRateEnabled ? 'text-amber-900 dark:text-amber-200 font-semibold' : 'text-emerald-800 dark:text-emerald-300'
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
                    <div className="p-2.5 rounded-xl glass-panel-amber text-[11px] text-amber-950 dark:text-amber-100 space-y-1 shadow-xs animate-fade-in">
                      <div className="flex items-start gap-1.5 font-bold text-amber-900 dark:text-amber-200">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <span>ทำไมถึงต้องใช้ {(currentCalculation.effectiveMonthlyRate * 100).toFixed(3)}% :</span>
                      </div>
                      <p className="text-[10.5px] text-amber-900/90 dark:text-amber-200/90 leading-relaxed pl-5">
                        เนื่องจากตามเงื่อนไขของเคสนี้ (ราคารถ {formatBaht(currentCalculation.baseVehiclePrice)}, เงินดาวน์ {formatBaht(currentCalculation.downAmount)} และระยะเวลาผ่อน {term} งวด) หากใช้ดอกเบี้ย {(currentCalculation.proposalMonthlyRate * 100).toFixed(3)}% จะทำให้อัตราดอกเบี้ยที่แท้จริงต่อปี (EIR) สูงเกินเพดานกฎหมายกำหนด (ไม่เกิน 23% ต่อปี) ระบบจึงทำการล็อกและบังคับให้ใช้อัตราสูงสุดที่ไม่ผิดกฎหมาย คือ <strong className="text-emerald-800 dark:text-emerald-300 underline font-bold">{(currentCalculation.effectiveMonthlyRate * 100).toFixed(3)}%</strong> แทน เพื่อให้ชุดข้อมูลชุดนี้ผ่านเกณฑ์การอนุมัติครับ
                      </p>
                      <div className="pl-5 pt-0.5 flex items-center justify-between">
                        <span className="text-[10px] text-amber-800 dark:text-amber-300 font-medium">
                          EIR สัญญานี้: {currentCalculation.eirAnnualPercent.toFixed(2)}% ต่อปี (ผ่านเกณฑ์)
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowEirInfo(true)}
                          className="text-[10px] text-blue-700 hover:text-blue-900 dark:text-sky-300 dark:hover:text-sky-200 font-bold underline cursor-pointer"
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
                    className="w-full flex items-center justify-between py-1.5 px-2.5 glass-pill rounded-xl text-[11px] font-medium text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-blue-700 dark:text-sky-400" />
                      ค่าใช้จ่ายวันออกรถ (พ.ร.บ. / ทะเบียน / ประกันรถหาย)
                    </span>
                    <span className="text-[10px] text-blue-700 dark:text-sky-400 font-bold">
                      {includeDeliveryFees ? 'ซ่อน' : '+ เพิ่ม'}
                    </span>
                  </button>

                  {includeDeliveryFees && (
                    <div className="mt-2 p-2.5 glass-mini-card text-xs space-y-2 elevated-data-box">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                            ค่าจดทะเบียน + พ.ร.บ.
                          </label>
                          <input
                            type="number"
                            value={registrationFee}
                            onChange={(e) => setRegistrationFee(Number(e.target.value))}
                            className="w-full glass-input-field px-2 py-1 rounded-lg text-xs font-semibold text-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                            ประกันรถหาย (1-2 ปี)
                          </label>
                          <input
                            type="number"
                            value={theftInsuranceFee}
                            onChange={(e) => setTheftInsuranceFee(Number(e.target.value))}
                            className="w-full glass-input-field px-2 py-1 rounded-lg text-xs font-semibold text-slate-900 dark:text-slate-100"
                          />
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 flex justify-between pt-1 border-t border-slate-200/50 dark:border-slate-700/60">
                        <span>รวมค่าใช้จ่ายส่วนเพิ่ม:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-100">
                          {formatBaht(registrationFee + theftInsuranceFee)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
                    </div>
                  </div>
                </div>

            {/* Navigation Buttons for Page 2 */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleTabChange('home')}
                className="flex-1 py-3 px-3 rounded-2xl bg-white/90 hover:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 border border-slate-200/90 dark:border-slate-700 shadow-2xs transition-all cursor-pointer whitespace-nowrap"
              >
                <ArrowLeft className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                <span>โฮมเพจ</span>
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('calculation')}
                className="flex-[2] py-3 px-4 rounded-2xl bg-gradient-to-r from-sky-500 via-sky-600 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 active:scale-[0.99] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-sky-500/25 transition-all cursor-pointer"
              >
                <span>ถัดไป: ผลคำนวณค่างวด</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            หน้าที่ 3: สรุปผลค่างวด & ตารางเปรียบเทียบ
            ======================================================== */}
        {activeTab === 'calculation' && (
          <div className="space-y-3 sm:space-y-3.5 animate-tab-fade">
            {/* Step Header Badge */}
            <div className="flex items-center justify-between px-1 text-xs">
              <span className="font-extrabold text-sky-950 dark:text-sky-100 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[11px] font-bold shadow-2xs">
                  2
                </span>
                สรุปผลค่างวด & ตารางเปรียบเทียบ
              </span>
              <span className="text-[10px] text-sky-800 dark:text-sky-200 bg-sky-50 dark:bg-sky-950/70 px-2.5 py-0.5 rounded-full font-bold border border-sky-200 dark:border-sky-700/70">
                ขั้นตอน 2 / 3
              </span>
            </div>

            {/* 2-Column SaaS Grid on Tablet/Desktop (Result Card + Term Comparison Table) */}
            <div
              data-saas-two-col={isSaasWorkspace ? 'true' : undefined}
              className={
                isSaasWorkspace
                  ? 'grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4 items-start'
                  : 'space-y-3 sm:space-y-3.5'
              }
            >
            {/* Result Hero Card - Frosted Glassmorphism Masterpiece matching Reference UI */}
            <div
              data-card-id="result"
              className={`glass-card-hero rounded-[28px] p-4 text-center relative overflow-hidden min-w-0 ${
                isSaasWorkspace && comparisons.length <= 1 ? 'md:col-span-2 max-w-2xl mx-auto w-full' : ''
              }`}
            >
              {/* Subtle top specular sheen */}
              <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/80 dark:via-sky-400/25 to-transparent opacity-95 pointer-events-none" />

              {/* Proposal Code Badge & Insurance Badge */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 mb-1.5">
                <span className="inline-block bg-white/85 dark:bg-sky-950/75 backdrop-blur-md text-sky-800 dark:text-sky-200 border border-sky-200/80 dark:border-sky-700/70 px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wide shadow-2xs">
                  {currentCalculation.proposalCode}
                </span>
                {currentCalculation.insurancePremium > 0 && (
                  <span className="inline-flex items-center gap-1 bg-amber-50/85 dark:bg-amber-950/70 backdrop-blur-md text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-700/70 px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wide shadow-2xs">
                    <ShieldCheck className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    {currentCalculation.insurancePlanName}
                  </span>
                )}
                {isCustomRateEnabled && (
                  <span className="inline-flex items-center gap-1 bg-amber-100/90 dark:bg-amber-950/80 backdrop-blur-md text-amber-950 dark:text-amber-100 border border-amber-300 dark:border-amber-700/70 px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wide shadow-2xs">
                    <Pencil className="w-2.5 h-2.5 text-amber-700 dark:text-amber-300" />
                    ดอกเบี้ยกำหนดเอง: {currentCalculation.rateDisplayText}
                  </span>
                )}
                {currentCalculation.minInterestApplied && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-rose-700 dark:text-rose-200 bg-rose-50/85 dark:bg-rose-950/70 backdrop-blur-md border border-rose-200 dark:border-rose-700/70 px-2.5 py-0.5 rounded-full font-semibold">
                    <ShieldAlert className="w-3 h-3" /> ดอกเบี้ยขั้นต่ำ
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium tracking-wide">
                ค่างวดต่อเดือน (รวมภาษีมูลค่าเพิ่ม 7%)
              </p>

              {/* Monthly Installment Highlight with Cyan-Blue Accent */}
              <div className="text-3xl sm:text-4xl font-black text-[#0284c7] dark:text-sky-400 my-1.5 tracking-tight drop-shadow-xs">
                {formatBaht(currentCalculation.monthlyInstallment)}
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1.5">/เดือน</span>
              </div>

              {/* Installment Rounding Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/70 dark:bg-cyan-950/70 backdrop-blur-md border border-cyan-200/80 dark:border-cyan-700/60 text-[10px] text-cyan-900 dark:text-cyan-200 font-semibold mb-1 shadow-2xs">
                <span>ปัดเศษลงท้าย 0 หรือ 5 (ระบบ Next Capital)</span>
                {currentCalculation.rawMonthlyInstallment !== currentCalculation.monthlyInstallment && (
                  <span className="text-slate-400 font-normal">
                    (เดิม {currentCalculation.rawMonthlyInstallment.toFixed(2)} บ.)
                  </span>
                )}
              </div>

              <MarqueeText className="text-[10px] text-slate-500 dark:text-slate-400 font-medium max-w-xs mx-auto text-center">
                {currentCalculation.remarkText}
              </MarqueeText>

              {/* Summary Grid - Translucent Glass Mini Cards */}
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-sky-100/80 dark:border-slate-700/70 text-left text-[11px]">
                <div className="glass-mini-card p-2.5 rounded-2xl min-w-0">
                  <div className="text-[10px] text-slate-400 font-medium">ยอดจัดไฟแนนซ์รวม:</div>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                    {formatBaht(currentCalculation.financeAmount, true)}
                  </span>
                  {currentCalculation.insuranceTotalWithVat > 0 ? (
                    <MarqueeText className="text-[9px] text-sky-700 dark:text-sky-300 font-semibold">
                      (รถ {formatBaht(currentCalculation.vehicleFinanceAmount)} + PA+VAT {formatBaht(currentCalculation.insuranceTotalWithVat, true)})
                    </MarqueeText>
                  ) : (
                    <div className="text-[9px] text-slate-500 dark:text-slate-400">
                      (ยอดจัดตัวรถ)
                    </div>
                  )}
                </div>
                <div className="glass-mini-card p-2.5 rounded-2xl min-w-0">
                  <div className="text-[10px] text-slate-400 font-medium">ดอกเบี้ยรายเดือน:</div>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                    {formatBaht(currentCalculation.monthlyInterest, true)} /งวด
                  </span>
                  <div className="text-[9px] text-slate-500 dark:text-slate-400">
                    รวมทั้งสัญญา: {formatBaht(currentCalculation.totalInterest, true)}
                  </div>
                </div>
                <div className="glass-mini-card p-2.5 rounded-2xl min-w-0">
                  <div className="text-[10px] text-slate-400 font-medium">ยอดรวมทั้งสัญญา:</div>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                    {formatBaht(currentCalculation.totalWithVat, true)}
                  </span>
                  <div className="text-[9px] text-slate-500 dark:text-slate-400">
                    (ยอดจัด + ดอกเบี้ยรวม)
                  </div>
                </div>
                <div className="glass-mini-card p-2.5 rounded-2xl min-w-0">
                  <div className="text-[10px] text-slate-400 font-medium">ภาษีมูลค่าเพิ่มในสัญญา (7%):</div>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                    {formatBaht(currentCalculation.vatAmount, true)}
                  </span>
                  <div className="text-[9px] text-slate-500 dark:text-slate-400">
                    ยอดก่อน VAT: {formatBaht(currentCalculation.totalBeforeVat, true)}
                  </div>
                </div>
              </div>

              {/* Drive Away Summary if extra fees enabled */}
              {includeDeliveryFees && (
                <div className="mt-2.5 p-2.5 glass-panel-amber rounded-2xl text-left flex justify-between items-center text-xs shadow-2xs">
                  <div>
                    <span className="font-bold text-amber-950 dark:text-amber-100 text-[11px] block">
                      เงินพร้อมออกรถ (วันรับรถ):
                    </span>
                    <span className="text-[10px] text-amber-800 dark:text-amber-300">
                      ดาวน์ {formatBaht(currentCalculation.downAmount)} + ทะเบียน พรบ. ประกัน
                    </span>
                  </div>
                  <span className="text-sm font-extrabold text-amber-900 dark:text-amber-200">
                    {formatBaht(currentCalculation.totalDriveAwayCost)}
                  </span>
                </div>
              )}

              {/* Save Case & Native Share Actions inside Hero card */}
              <div className="mt-3 pt-3 border-t border-sky-100/80 dark:border-slate-700/70 space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveCurrentCase(false)}
                    className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all cursor-pointer ${
                      editingCaseId
                        ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-amber-500/25'
                        : 'bg-gradient-to-r from-sky-500 via-sky-600 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white shadow-sky-500/25'
                    }`}
                    title={editingCaseId ? 'บันทึกการแก้ไขเคสนี้' : 'บันทึกผลคำนวณเคสนี้ลงในอุปกรณ์'}
                  >
                    {editingCaseId ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>บันทึกการแก้ไขเคส</span>
                      </>
                    ) : (
                      <>
                        <BookmarkPlus className="w-3.5 h-3.5" />
                        <span>บันทึกผลคำนวณเคสนี้</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      setShowSavedCases(true);
                    }}
                    className="py-2 px-3 rounded-xl bg-white/90 hover:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-200/90 dark:border-slate-700 shadow-2xs active:scale-98 transition-all cursor-pointer"
                    title="เปิดดูรายการเคสที่บันทึกไว้ในอุปกรณ์"
                  >
                    <FolderArchive className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <span>ดูเคสทั้งหมด ({savedCasesCount})</span>
                  </button>
                </div>

                {/* Share Format Selector & Preview Toggle */}
                <div className="pt-1 space-y-2">
                  {/* Format Style Segmented Control */}
                  <div className="grid grid-cols-3 gap-1 p-1 bg-sky-100/55 dark:bg-slate-800/80 backdrop-blur-sm border border-white/85 dark:border-slate-700/80 rounded-xl shadow-2xs">
                    <button
                      type="button"
                      onClick={() => handleShareStyleChange('card')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${
                        shareTextStyle === 'card'
                          ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span>✨</span>
                      <span>การ์ดเด่น</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShareStyleChange('compare')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${
                        shareTextStyle === 'compare'
                          ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span>📊</span>
                      <span>เทียบงวด</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShareStyleChange('compact')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${
                        shareTextStyle === 'compact'
                          ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span>⚡</span>
                      <span>กระชับ</span>
                    </button>
                  </div>

                  {/* Preview & Copy Utility Row */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setShowSharePreview((prev) => !prev);
                      }}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer active:scale-98 whitespace-nowrap shadow-2xs ${
                        showSharePreview
                          ? 'bg-sky-50 dark:bg-sky-950/70 text-sky-800 dark:text-sky-200 border-sky-300 dark:border-sky-700'
                          : 'bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800'
                      }`}
                      title="ดูตัวอย่างข้อความก่อนแชร์"
                    >
                      <Eye className="w-3.5 h-3.5 shrink-0" />
                      <span>{showSharePreview ? 'ซ่อนตัวอย่าง' : 'ดูตัวอย่าง'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleQuickCopy}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer active:scale-98 whitespace-nowrap shadow-2xs ${
                        copyFeedback
                          ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700'
                          : 'bg-white/90 hover:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-slate-700'
                      }`}
                      title="คัดลอกข้อความลงคลิปบอร์ด"
                    >
                      {copyFeedback ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                      )}
                      <span>{copyFeedback ? 'คัดลอกแล้ว!' : 'คัดลอก'}</span>
                    </button>
                  </div>

                  {/* Optional Collapsible Preview Box */}
                  {showSharePreview && (() => {
                    const previewText = buildInstallmentSummaryText();
                    return (
                      <div className="space-y-1">
                        <pre className="text-left font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-slate-100 bg-white/95 dark:bg-slate-900/90 border border-emerald-200 dark:border-emerald-800/70 rounded-xl p-3 shadow-inner max-h-56 overflow-y-auto select-text">
                          {previewText}
                        </pre>
                        <div className="flex items-center justify-end px-1 text-[10px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                          {shareTextStyle === 'compact'
                            ? `ความยาว ${previewText.length}/300 ตัวอักษร`
                            : `ความยาว ${previewText.length} ตัวอักษร`}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Action Row: Share Text & Create Share Card Image */}
                  <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleNativeShare}
                      className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 via-[#06c755] to-teal-600 hover:opacity-95 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/25 active:scale-98 transition-all cursor-pointer border border-white/25 whitespace-nowrap"
                      title="แชร์ข้อความสรุปค่างวดผ่าน LINE หรือช่องทางอื่นบนอุปกรณ์"
                    >
                      {copyFeedback ? (
                        <>
                          <Check className="w-4 h-4 text-white shrink-0" />
                          <span>คัดลอกแล้ว!</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-4 h-4 text-white shrink-0" />
                          <span>แชร์ข้อความ</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('medium');
                        setShowShareCardModal(true);
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 hover:opacity-95 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-blue-600/25 active:scale-98 transition-all cursor-pointer border border-white/25 whitespace-nowrap"
                      title="สร้างรูปภาพการ์ดสรุปค่างวดตกแต่งสวยงามสำหรับแชร์หรือบันทึก"
                    >
                      <ImageIcon className="w-4 h-4 text-white shrink-0" />
                      <span>สร้างรูปภาพการ์ด</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Term Comparisons Table */}
            <div data-card-id="comparison" className="min-w-0">
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
            </div>

            {/* Navigation Buttons for Page 3 */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleTabChange('financing')}
                className="flex-1 py-3 px-3 rounded-2xl bg-white/90 hover:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 border border-slate-200/90 dark:border-slate-700 shadow-2xs transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span>ย้อนกลับ</span>
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('documents')}
                className="flex-[2] py-3 px-4 rounded-2xl bg-gradient-to-r from-sky-500 via-sky-600 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 active:scale-[0.99] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-sky-500/25 transition-all cursor-pointer"
              >
                <span>ถัดไป: เอกสาร & ขออนุมัติ DV</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            หน้าที่ 4: เอกสารเสนอราคา, ขออนุมัติ DV & รายงานยอด (ตามรูปที่ 4 และ 5)
            ======================================================== */}
        {activeTab === 'documents' && (
          <div className="space-y-3 sm:space-y-3.5 animate-tab-fade">
            {/* Action Buttons: 3 primary action buttons (แผนความคุ้มครอง, ใบเสนอราคา, ใบอนุมัติผลชั่วคราว) */}
            <div data-card-id="actions" className="grid grid-cols-1 xl:grid-cols-3 gap-2.5">
              {/* 1. Coverage Plan Button */}
              <button
                type="button"
                onClick={() => setShowInsuranceDoc(true)}
                className="group relative overflow-hidden btn-fluid-primary py-3 px-4 rounded-2xl font-bold transition-all flex items-center justify-between cursor-pointer border border-white/30"
                title="ดาวน์โหลดแผนความคุ้มครองประกันภัย (Group PA)"
              >
                <div className="flex items-center gap-2.5 text-left min-w-0 flex-1 pr-2">
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <ShieldCheck className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold leading-tight flex items-center gap-1.5 text-white min-w-0">
                      <MarqueeText fitContent>แผนความคุ้มครอง</MarqueeText>
                      <span className="text-[10px] bg-white/25 text-white px-2 py-0.2 rounded-full font-semibold shrink-0">
                        รูปภาพ
                      </span>
                    </div>
                    <MarqueeText className="text-[10.5px] text-white/90 font-normal mt-0.5">
                      {cleanPlanNameForLine(currentCalculation.insurancePlanName)} ({insuranceYears} ปี)
                    </MarqueeText>
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
                <div className="flex items-center gap-2.5 text-left min-w-0 flex-1 pr-2">
                  <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <FileText className="w-4.5 h-4.5 text-cyan-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold leading-tight flex items-center gap-1.5 text-white min-w-0">
                      <MarqueeText fitContent>ใบเสนอราคา</MarqueeText>
                      <span className="text-[10px] bg-cyan-400/25 text-cyan-200 px-2 py-0.2 rounded-full font-semibold shrink-0">
                        รูปภาพ
                      </span>
                    </div>
                    <MarqueeText className="text-[10.5px] text-slate-300 font-normal mt-0.5">
                      งวดละ {formatBaht(currentCalculation.monthlyInstallment)} บ.
                    </MarqueeText>
                  </div>
                </div>
                <Printer className="w-4 h-4 text-slate-300 group-hover:scale-110 transition-transform shrink-0" />
              </button>

              {/* 3. Provisional Approval Certificate Button */}
              <button
                type="button"
                onClick={() => setShowProvisionalApproval(true)}
                className="group relative overflow-hidden bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 hover:opacity-95 active:scale-[0.98] text-white py-3 px-4 rounded-2xl font-bold shadow-lg shadow-emerald-950/20 transition-all flex items-center justify-between cursor-pointer border border-emerald-400/30"
                title="ออกใบแจ้งผลการอนุมัติสินเชื่อเช่าซื้อชั่วคราว (Provisional Approval Certificate)"
              >
                <div className="flex items-center gap-2.5 text-left min-w-0 flex-1 pr-2">
                  <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <FileCheck className="w-4.5 h-4.5 text-emerald-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold leading-tight flex items-center gap-1.5 text-white min-w-0">
                      <MarqueeText fitContent>ใบอนุมัติผลชั่วคราว</MarqueeText>
                      <span className="text-[10px] bg-emerald-400/30 text-emerald-200 px-2 py-0.2 rounded-full font-semibold shrink-0">
                        อนุมัติ
                      </span>
                    </div>
                    <MarqueeText className="text-[10.5px] text-emerald-200/90 font-normal mt-0.5">
                      {customerName ? customerName : 'สำหรับเคสอนุมัติ'} • {term} งวด
                    </MarqueeText>
                  </div>
                </div>
                <Award className="w-4 h-4 text-emerald-300 group-hover:scale-110 transition-transform shrink-0" />
              </button>
            </div>

            {/* Page 4 Tool & Report Cards: 2 Boxes Per Row (opens as popup modal on click) */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 items-stretch">
              {/* DV Case Approval Box */}
              <div data-card-id="dv" className="h-full">
                <DvApprovalCard
                  customerName={customerName}
                  bikeModelName={resolvedBikeModelName}
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
                  dealerName={dealerName}
                  proposalKey={proposalKey}
                  downPercent={currentCalculation.downPercent}
                  hasPaInsurance={insurancePlan !== 'none'}
                  customerAge={customerAge}
                  customerWorkMonths={customerWorkMonths}
                  customerIncome={customerIncome}
                  customerResidenceMonths={customerResidenceMonths}
                  customerOccupation={customerOccupation}
                  isAceCustomer={isAceCustomer}
                  onUpdateCustomerName={handleCustomerNameChange}
                  onUpdateDealerName={handleDealerNameChange}
                  isExpanded={expandedCard === 'dv'}
                  onToggleExpand={() => {
                    setExpandedCard((prev) => (prev === 'dv' ? null : 'dv'));
                  }}
                />
              </div>

              {/* Daily Dealer Finance Report Box */}
              <div data-card-id="daily_report" className="h-full">
                <DailyFinanceReportCard
                  officerName={officerName}
                  officerCode={officerCode}
                  officerDisplay={officerDisplay}
                  activeDealerName={dealerName}
                  isExpanded={expandedCard === 'daily_report'}
                  onToggleExpand={() => {
                    setExpandedCard((prev) => (prev === 'daily_report' ? null : 'daily_report'));
                  }}
                />
              </div>

              {/* Checker Insurance Commission Report Box */}
              <div data-card-id="checker_commission" className="h-full">
                <CheckerCommissionCard
                  officerName={officerName}
                  officerCode={officerCode}
                  officerDisplay={officerDisplay}
                  isExpanded={expandedCard === 'checker_commission'}
                  onToggleExpand={() => {
                    setExpandedCard((prev) => (prev === 'checker_commission' ? null : 'checker_commission'));
                  }}
                  onOpenSavedCases={() => setShowSavedCases(true)}
                />
              </div>

              {/* Period Closing Report Box (ปิดยอด 1-15 / สิ้นเดือน: Approve, รับรถ, ยกยอด) */}
              <div data-card-id="period_closing" className="h-full">
                <PeriodClosingReportCard
                  officerName={officerName}
                  officerCode={officerCode}
                  officerDisplay={officerDisplay}
                  isExpanded={expandedCard === 'period_closing'}
                  onToggleExpand={() => {
                    setExpandedCard((prev) => (prev === 'period_closing' ? null : 'period_closing'));
                  }}
                  onOpenSavedCases={() => setShowSavedCases(true)}
                  refreshTrigger={casesRevision}
                />
              </div>
            </div>

            {/* Cloud Backup & Multi-Device Sync Card */}
            <CloudSyncCard localCount={savedCasesCount} />

            {/* Navigation Buttons for Page 4 */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleTabChange('calculation')}
                className="flex-1 py-3 px-3 rounded-2xl bg-white/90 hover:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 border border-slate-200/90 dark:border-slate-700 shadow-2xs transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span>ย้อนกลับ: ตารางค่างวด</span>
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('home')}
                className="flex-1 py-3 px-3 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:opacity-95 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md shadow-sky-500/20 transition-all cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>กลับหน้า Dashboard</span>
              </button>
            </div>
          </div>
        )}

            {/* ========================================================
                หน้าที่ 5: ติดตามการชำระค่างวด งวดที่ 1 - 9 (รายชื่อ, ยี่ห้อ, รุ่น, รหัสรถ, ติ๊ก ✓/✗)
                ======================================================== */}
            {activeTab === 'installments' && (
              <InstallmentTrackingPage
                refreshTrigger={casesRevision}
                officerName={officerName}
                officerCode={officerCode}
                officerDisplay={officerDisplay}
                isTwoColumn={isSaasWorkspace}
                onDataChanged={() => {
                  setSavedCasesCount(getSavedCases().length);
                  setCasesRevision((v) => v + 1);
                }}
                onOpenSavedCases={() => setShowSavedCases(true)}
                onNotify={triggerToast}
              />
            )}
      </div>
    </main>

        {/* Bottom Floating Crystal Glass Navigation Capsule (Mobile & Phone Simulator Only) */}
        {!isSaasWorkspace && (
        <div
          className={`pointer-events-none absolute ${
            isHandheldViewport ? 'bottom-2 inset-x-2' : 'bottom-3 inset-x-4'
          } z-40 flex justify-center pb-[env(safe-area-inset-bottom)]`}
          style={{ transform: 'translate3d(0, 0, 0)' }}
        >
          <div
            className={`pointer-events-auto liquid-crystal-nav w-full ${
              isHandheldViewport ? 'p-1' : 'max-w-[590px] p-1.5'
            } rounded-full relative overflow-hidden`}
          >
            {/* Curved Top & Bottom Crystal Specular Glint Line */}
            <div
              className="pointer-events-none absolute inset-x-6 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/95 to-transparent opacity-95"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-gradient-to-r from-transparent via-white/75 to-transparent opacity-85"
              aria-hidden="true"
            />

            {/* Ambient Sweeping Specular Light Beam across the Crystal Capsule */}
            <div
              className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-transparent via-white/45 to-transparent animate-crystal-sheen"
              aria-hidden="true"
            />

            <nav
              aria-label="แถบนำทางหลัก"
              className="relative w-full flex items-center justify-between overflow-hidden rounded-full"
            >
              {/* Animated Smooth Sliding Crystal Pill Indicator with Liquid Jelly Rebound */}
              <div
                className="absolute top-0.5 bottom-0.5 transition-all duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)] pointer-events-none"
                style={{
                  width: `calc(${100 / NAV_TABS.length}% - 4px)`,
                  left: `calc(${Math.max(0, NAV_TABS.findIndex((t) => t.id === activeTab)) * (100 / NAV_TABS.length)}% + 2px)`,
                }}
              >
                <div
                  key={navAnimState.key}
                  className="liquid-crystal-active-pill animate-liquid-jelly w-full h-full rounded-full relative overflow-hidden animate-fuel-shimmer"
                >
                  {/* Top Lens Specular Rim */}
                  <div
                    className="pointer-events-none absolute inset-x-3 top-0.5 h-px bg-gradient-to-r from-transparent via-white/95 to-transparent"
                    aria-hidden="true"
                  />
                  {/* Glowing 3D Bottom Light Core */}
                  <div
                    className="pointer-events-none absolute bottom-1 inset-x-0 flex justify-center"
                    aria-hidden="true"
                  >
                    <span className="w-6 h-[2.5px] rounded-full bg-white/95 shadow-[0_0_8px_rgba(255,255,255,0.95)] animate-active-aura" />
                  </div>
                </div>
              </div>

              {NAV_TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                const showTapRipple = navAnimState.key > 0 && navAnimState.tab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleTabChange(tab.id)}
                    className={`group relative z-10 flex-1 min-w-0 flex ${
                      isHandheldViewport
                        ? 'flex-col gap-0.5 py-2 px-0.5'
                        : 'flex-col xl:flex-row gap-0.5 xl:gap-1.5 py-2 xl:py-2.5 px-0.5 xl:px-1.5'
                    } items-center justify-center rounded-full transition-all duration-200 cursor-pointer select-none active:scale-90 active:translate-y-0.5 overflow-hidden ${
                      isActive
                        ? 'text-white font-extrabold drop-shadow-[0_1px_2px_rgba(12,74,110,0.65)]'
                        : 'text-slate-900 dark:text-slate-100 hover:text-sky-950 dark:hover:text-white hover:bg-white/20 dark:hover:bg-slate-700/40 font-bold drop-shadow-[0_1px_2px_rgba(255,255,255,0.95)] dark:drop-shadow-none'
                    }`}
                  >
                    {/* Tactile Crystal Ripple Wave on Tap */}
                    {showTapRipple && (
                      <span
                        key={`ripple-${navAnimState.key}`}
                        className="pointer-events-none absolute w-10 h-10 rounded-full border border-white/85 bg-sky-200/35 animate-crystal-ripple"
                        aria-hidden="true"
                      />
                    )}

                    <Icon
                      className={`relative z-10 ${
                        isHandheldViewport ? 'w-[17px] h-[17px]' : 'w-[17px] h-[17px] xl:w-[18px] xl:h-[18px]'
                      } shrink-0 transition-transform duration-300 ${
                        isActive
                          ? 'text-white animate-tab-icon -translate-y-0.5 drop-shadow-[0_2px_6px_rgba(255,255,255,0.55)]'
                          : 'text-slate-900 dark:text-slate-200 group-hover:-translate-y-0.5 group-hover:scale-110'
                      }`}
                    />
                    <span
                      className={`relative z-10 ${
                        isHandheldViewport ? 'text-[10px]' : 'text-[10px] xl:text-xs'
                      } leading-tight whitespace-nowrap transition-transform duration-200 ${
                        isActive ? 'scale-105' : 'group-hover:scale-[1.03]'
                      }`}
                    >
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
        )}
        </div>
      </div>
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

      <EligibilityCriteriaModal
        isOpen={showEligibilityCriteriaModal}
        onClose={() => setShowEligibilityCriteriaModal(false)}
        activeTierKey={activeEligibilityTierKey}
        evaluation={customerEligibilityEval}
        bikeLabel={resolvedBikeModelName || currentProposal.name}
        isAceCustomer={isAceCustomer}
        onJumpToDv={handleOpenDvWithLinkedData}
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
        initialDealerName={dealerName}
        caseRecord={activeCaseRecord}
        onUpdateCustomer={(name, phone) => {
          handleCustomerNameChange(name);
          handleCustomerPhoneChange(phone);
        }}
        onUpdateDealer={handleDealerNameChange}
      />

      <ProvisionalApprovalModal
        isOpen={showProvisionalApproval}
        onClose={() => setShowProvisionalApproval(false)}
        data={{
          customerName: customerName || 'คุณลูกค้า',
          customerPhone: customerPhone || '',
          bikeModelName:
            selectedBike?.name ||
            (bikeModelCode
              ? MOTORCYCLE_MODELS.find(
                  (m) => m.code.toUpperCase() === bikeModelCode.trim().toUpperCase()
                )?.name
              : 'รถจักรยานยนต์'),
          bikeModelCode: bikeModelCode,
          vehiclePrice: vehiclePrice,
          downAmount: currentCalculation.downAmount,
          downPercent: currentCalculation.downPercent,
          financeAmount: currentCalculation.financeAmount,
          term: term,
          monthlyInstallment: currentCalculation.monthlyInstallment,
          interestRateText: currentCalculation.rateDisplayText,
          proposalCode: currentCalculation.proposalCode,
          proposalName: currentCalculation.proposalName,
          insurancePlanName: currentCalculation.insurancePlanName,
          insuranceYears: insuranceYears,
          insuranceTotalWithVat: currentCalculation.insuranceTotalWithVat,
          approvalStatus: activeCaseRecord?.approvalStatus,
          approvalDate: activeCaseRecord?.approvalDate,
          approvalUpdatedAt: activeCaseRecord?.approvalUpdatedAt,
          deliveryDate: activeCaseRecord?.deliveryDate,
          deliveryStatus: activeCaseRecord?.deliveryStatus,
          dealerName: dealerName.trim() || undefined,
          officerInfo: officerDisplay,
        }}
        onUpdateCustomer={(name, phone) => {
          handleCustomerNameChange(name);
          handleCustomerPhoneChange(phone);
        }}
        onUpdateDealer={handleDealerNameChange}
      />

      <InstallmentShareCardModal
        isOpen={showShareCardModal}
        onClose={() => setShowShareCardModal(false)}
        result={currentCalculation}
        comparisons={comparisons}
        bikeName={
          selectedBike?.name ||
          (bikeModelCode
            ? MOTORCYCLE_MODELS.find(
                (m) => m.code.toUpperCase() === bikeModelCode.trim().toUpperCase()
              )?.name
            : undefined)
        }
        bikeModelCode={bikeModelCode}
        customerDisplay={customerDisplay}
        hasCustomerInfo={Boolean(customerName || customerPhone)}
        officerInfo={officerDisplay}
        dealerName={dealerName}
        includeDeliveryFees={includeDeliveryFees}
        onShareSuccess={(msg) => triggerToast(msg)}
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
        caseRecord={activeCaseRecord}
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

      {/* Saved Cases Modal (เปิดดู / นำข้อมูลมาใช้งาน / จัดการเคสที่บันทึก) */}
      <SavedCasesModal
        isOpen={showSavedCases}
        onClose={() => {
          setShowSavedCases(false);
          setSavedCasesPreferAll(false);
          setSavedCasesCount(getSavedCases().length);
          setCasesRevision((v) => v + 1);
        }}
        onLoadCase={handleLoadCase}
        onEditCase={handleEditCase}
        onSaveCurrentCase={() => handleSaveCurrentCase(false)}
        onDeleteCase={(deletedId) => {
          setSavedCasesCount(getSavedCases().length);
          setCasesRevision((v) => v + 1);
          if (!deletedId || editingCaseId === deletedId) {
            setEditingCaseId(null);
            setEditingCaseTitle(null);
          }
          if (!deletedId || activeCaseId === deletedId) {
            setActiveCaseId(null);
          }
        }}
        activeEditingId={editingCaseId}
        initialShowAllMonths={savedCasesPreferAll}
      />

      {/* Thai National ID Card Scanner Modal (เปิดจากกล่องข้อมูลลูกค้าหน้าคำนวณเคสเท่านั้น) */}
      <IdCardScannerModal
        isOpen={showIdCardScanner}
        onClose={() => setShowIdCardScanner(false)}
        existingCustomerName={customerName}
        onApply={(scanned: AppliedThaiIdData) => {
          if (scanned.fullName) {
            handleCustomerNameChange(scanned.fullName);
          }
          if (scanned.age) {
            handleCustomerAgeChange(scanned.age);
          }
          handleCustomerIdCardChange(scanned.idCard);
          handleCustomerAddressChange(scanned.address);
          handleCustomerBirthDateChange(scanned.birthDateIso);
          if (scanned.photoUrl !== undefined) {
            handleCustomerPhotoUrlChange(scanned.photoUrl);
          }
          setShowIdCardDetails(true);
          triggerToast(
            scanned.photoUrl
              ? '✓ นำเข้าข้อมูลบัตรประชาชนและรูปโปรไฟล์ลูกค้าเรียบร้อยแล้ว'
              : '✓ นำเข้าข้อมูลบัตรประชาชน (ชื่อ, อายุ, เลข 13 หลัก, ที่อยู่) เรียบร้อยแล้ว'
          );
        }}
      />

      {/* Cloud Sync & Google Account Modal */}
      {showCloudSyncModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[75] flex items-center justify-center p-2 sm:p-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-slate-950/65 backdrop-blur-sm overflow-y-auto overscroll-contain animate-fade-in"
          onClick={() => setShowCloudSyncModal(false)}
        >
          <div
            className="w-full max-w-md max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] min-h-0 my-auto rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-sky-100 dark:border-slate-700/80 flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 flex items-center justify-between gap-2 px-4 sm:px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0">
                  <Cloud className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">
                    ซิงค์ข้อมูล Cloud อัตโนมัติ
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    เชื่อมต่อบัญชี Google เพื่อซิงค์ข้อมูลข้ามอุปกรณ์แบบเรียลไทม์
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCloudSyncModal(false)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer shrink-0"
                aria-label="ปิดหน้าต่าง Cloud Sync"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5">
              <CloudSyncCard localCount={savedCasesCount} />
            </div>

            <div className="shrink-0 px-4 sm:px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCloudSyncModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Toast Notice */}
      {toastNotice && (
        <div className="fixed top-5 inset-x-4 mx-auto max-w-md z-[70] p-3 rounded-2xl bg-slate-900/95 text-white text-xs font-semibold text-center shadow-2xl border border-white/20 backdrop-blur-xl animate-fade-in flex items-center justify-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <MarqueeText fitContent>{toastNotice}</MarqueeText>
        </div>
      )}
    </>
  );
}
