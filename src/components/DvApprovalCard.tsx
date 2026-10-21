import React, { useState, useEffect, useMemo } from 'react';
import {
  FileCheck2,
  Share2,
  Copy,
  Check,
  Plus,
  Trash2,
  RefreshCw,
  User,
  Bike,
  Building2,
  Briefcase,
  Wallet,
  FileSpreadsheet,
  Coins,
  ShieldCheck,
  Percent,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ExternalLink,
  MessageSquareText,
  HelpCircle,
  Tag,
  Shield,
} from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';

export interface DvTopicItem {
  code: string;
  label: string;
  category: string;
  description?: string;
}

// 18 Official DV Topics from the guidelines image (IMG_20261021_221905)
export const DV_TOPICS: DvTopicItem[] = [
  { code: 'A1', label: 'อายุตัว', category: 'คุณสมบัติผู้ขอสินเชื่อ (A)' },
  { code: 'A2', label: 'อายุงานไม่ผ่าน', category: 'คุณสมบัติผู้ขอสินเชื่อ (A)' },
  { code: 'A4', label: 'รายได้ไม่ผ่าน', category: 'คุณสมบัติผู้ขอสินเชื่อ (A)' },
  { code: 'A6', label: 'ระยะเวลาพักอาศัยไม่ผ่าน', category: 'คุณสมบัติผู้ขอสินเชื่อ (A)' },
  { code: 'B1', label: 'กำลังผ่อนมอเตอร์ไซค์<6เดือน', category: 'ภาระหนี้ / เครดิต (B)' },
  { code: 'B2', label: 'มีประวัติยื่น Leasing ภายใน3เดือน', category: 'ภาระหนี้ / เครดิต (B)' },
  { code: 'B3', label: 'มีประวัติค้างชำระรถจักรยานยนต์', category: 'ภาระหนี้ / เครดิต (B)' },
  { code: 'B5', label: 'มีประวัติค้างชำระสินเชื่อที่พักอาศัย', category: 'ภาระหนี้ / เครดิต (B)' },
  { code: 'G1', label: 'ซื้อแทนบุคคลอื่น', category: 'พฤติกรรมการซื้อ (G)' },
  { code: 'J2', label: 'ผลการSVR ไม่สมบูรณ์', category: 'ผลการตรวจสอบ (J)' },
  { code: 'J9', label: 'MRR/DSR เกินกว่าที่กำหนด', category: 'ผลการตรวจสอบ (J)' },
  { code: 'J12', label: 'ผลการตรวจสอบผิดปกติ', category: 'ผลการตรวจสอบ (J)' },
  { code: 'X1', label: 'ลดยอดจัดน้อยกว่าเงื่อนไข 5%', category: 'เงื่อนไขยอดจัด / เครดิต (X)' },
  { code: 'X2', label: 'ลดยอดจัดน้อยกว่าเงื่อนไข 10%', category: 'เงื่อนไขยอดจัด / เครดิต (X)' },
  { code: 'X3', label: 'Quata DV', category: 'เงื่อนไขยอดจัด / เครดิต (X)' },
  { code: 'X4', label: 'ไม่สามารถลดยอดจัดได้ตามเงื่อนไขกำหนด', category: 'เงื่อนไขยอดจัด / เครดิต (X)' },
  { code: 'X5', label: 'กลุ่มลูกค้าเสี่ยง', category: 'เงื่อนไขยอดจัด / เครดิต (X)' },
  { code: 'X6', label: 'Reject By Credit', category: 'เงื่อนไขยอดจัด / เครดิต (X)' },
];

// Exact NCB options as requested
export const NCB_OPTIONS = ['Normal', 'Not Found', 'Default 1', 'Default 2'] as const;

// Exact Financial Documents options as requested
export const FINANCIAL_DOCS_OPTIONS = [
  'สลิปเงินเดือน',
  'หนังสือรับรองเงินเดือน',
  'Statement 4 เดือน',
  'Statement 6 เดือน',
  'ไม่มีเอกสาร',
] as const;

interface DvApprovalCardProps {
  customerName: string;
  bikeModelName: string;
  bikeModelCode?: string;
  downPaymentDisplay: string;
  financeAmount: number;
  monthlyInstallment?: number;
  term?: number;
  officerName?: string;
  officerCode?: string;
  officerDisplay?: string;
  onUpdateCustomerName?: (name: string) => void;
  className?: string;
}

export function DvApprovalCard({
  customerName,
  bikeModelName,
  bikeModelCode,
  downPaymentDisplay,
  financeAmount,
  monthlyInstallment,
  term,
  officerName,
  officerCode,
  officerDisplay,
  onUpdateCustomerName,
  className = '',
}: DvApprovalCardProps) {
  // Determine default officer label for CK
  const resolvedOfficer = useMemo(() => {
    if (officerName && officerCode) {
      return `${officerName} (${officerCode})`;
    }
    return officerName || officerDisplay || 'บดินทร์ (6683)';
  }, [officerName, officerCode, officerDisplay]);

  // Form states
  const [dvCustomerName, setDvCustomerName] = useState<string>(customerName || 'คุณลูกค้า');
  const [topics, setTopics] = useState<string[]>(['A1 : อายุตัว']);
  const [activeTopicIndexForModal, setActiveTopicIndexForModal] = useState<number | null>(null);
  const [ncb, setNcb] = useState<string>('Normal');
  const [dealer, setDealer] = useState<string>(() => {
    try {
      return localStorage.getItem('ncap_dv_dealer') ?? '';
    } catch {
      return '';
    }
  });

  const resolvedBike = useMemo(() => {
    if (bikeModelName && bikeModelCode) {
      return `${bikeModelName} (${bikeModelCode})`;
    }
    return bikeModelName || (bikeModelCode ? `รหัส ${bikeModelCode}` : 'Honda Wave 110i');
  }, [bikeModelName, bikeModelCode]);

  const [bikeModel, setBikeModel] = useState<string>(resolvedBike);
  const [occupation, setOccupation] = useState<string>('พนักงานประจำ / โรงงาน');
  const [income, setIncome] = useState<string>('18,000 บาท/เดือน');
  const [financialDocs, setFinancialDocs] = useState<string>('สลิปเงินเดือน');
  const [downPayment, setDownPayment] = useState<string>(downPaymentDisplay || '0 บาท (ฟรีดาวน์)');
  const [remark, setRemark] = useState<string>('');
  const [ck, setCk] = useState<string>(resolvedOfficer);
  const [yodRate, setYodRate] = useState<string>('หัก 3%');

  // UI state
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [showAllTopicsModal, setShowAllTopicsModal] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [lineSentFeedback, setLineSentFeedback] = useState<boolean>(false);

  // Sync with main app customer name when changed externally
  useEffect(() => {
    if (customerName && customerName.trim() !== '') {
      setDvCustomerName(customerName);
    }
  }, [customerName]);

  // Sync bike model
  useEffect(() => {
    if (resolvedBike) {
      setBikeModel(resolvedBike);
    }
  }, [resolvedBike]);

  // Sync down payment
  useEffect(() => {
    if (downPaymentDisplay) {
      setDownPayment(downPaymentDisplay);
    }
  }, [downPaymentDisplay]);

  // Automatically sync officer name to CK whenever officer changes
  useEffect(() => {
    if (resolvedOfficer) {
      setCk(resolvedOfficer);
    }
  }, [resolvedOfficer]);

  // Persist dealer name
  const handleDealerChange = (val: string) => {
    setDealer(val);
    try {
      localStorage.setItem('ncap_dv_dealer', val);
    } catch {
      // ignore
    }
  };

  // Re-sync all fields from current calculation
  const handleSyncFromCurrent = () => {
    triggerHaptic('medium');
    setDvCustomerName(customerName || 'คุณลูกค้า');
    setBikeModel(resolvedBike);
    setDownPayment(downPaymentDisplay || '0 บาท (ฟรีดาวน์)');
    setCk(resolvedOfficer);
  };

  // Topic handlers
  const handleAddTopic = (initialValue?: string) => {
    triggerHaptic('light');
    const unused = DV_TOPICS.find((t) => !topics.some((item) => item.startsWith(t.code)));
    const newTopicVal = initialValue || (unused ? `${unused.code} : ${unused.label}` : '');
    setTopics((prev) => [...prev, newTopicVal]);
  };

  const handleRemoveTopic = (index: number) => {
    triggerHaptic('medium');
    setTopics((prev) => {
      if (prev.length <= 1) return [''];
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleTopicChange = (index: number, value: string) => {
    setTopics((prev) => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  };

  const handleSelectTopic = (item: DvTopicItem, index?: number) => {
    triggerHaptic('light');
    const topicString = `${item.code} : ${item.label}`;
    if (typeof index === 'number' && index >= 0 && index < topics.length) {
      handleTopicChange(index, topicString);
    } else if (activeTopicIndexForModal !== null && activeTopicIndexForModal < topics.length) {
      handleTopicChange(activeTopicIndexForModal, topicString);
    } else {
      setTopics((prev) => [...prev, topicString]);
    }
    setShowAllTopicsModal(false);
    setActiveTopicIndexForModal(null);
  };

  /*
    Exact Template Requested:
    ขออนุมัติเคส DV
    ชื่อลูกค้า :
    หัวข้อ :  
    NCB : 
    Dealer : 
    รุ่นรถ : 
    อาชีพ : 
    รายได้ : 
    เอกสารการเงิน : 
    เงินดาวน์ : 
    หมายเหตุ : 

    CK : 
    YOD1-9%
  */
  const generateDvText = (): string => {
    const activeTopics = topics.map((t) => t.trim()).filter(Boolean);
    const topicsFormatted = activeTopics.length > 0 ? activeTopics.join('\n') : '-';

    const lines = [
      'ขออนุมัติเคส DV',
      `ชื่อลูกค้า : ${dvCustomerName || '-'}`,
      `หัวข้อ : ${topicsFormatted}`,
      `NCB : ${ncb || '-'}`,
      `Dealer : ${dealer || '-'}`,
      `รุ่นรถ : ${bikeModel || '-'}`,
      `อาชีพ : ${occupation || '-'}`,
      `รายได้ : ${income || '-'}`,
      `เอกสารการเงิน : ${financialDocs || '-'}`,
      `เงินดาวน์ : ${downPayment || '-'}`,
      `หมายเหตุ : ${remark.trim() ? remark.trim() : '-'}`,
      '',
      `CK : ${ck || '-'}`,
      `YOD1-9% : ${yodRate || '-'}`,
    ];
    return lines.join('\n');
  };

  const handleCopyText = async () => {
    triggerHaptic('success');
    const text = generateDvText();
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2400);
    } catch {
      // fallback
    }
  };

  const handleSendLine = async () => {
    triggerHaptic('success');
    const text = generateDvText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
    setLineSentFeedback(true);
    setTimeout(() => setLineSentFeedback(false), 3000);

    const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
    window.open(lineUrl, '_blank', 'noopener,noreferrer');
  };

  const OCCUPATION_PRESETS = [
    'พนักงานประจำ / โรงงาน',
    'ค้าขาย / ธุรกิจส่วนตัว',
    'ไรเดอร์ / ขับรถรับจ้าง',
    'รับจ้างทั่วไป',
    'ข้าราชการ / รัฐวิสาหกิจ',
    'เกษตรกร',
  ];

  const INCOME_PRESETS = [
    '15,000 บาท/เดือน',
    '18,000 บาท/เดือน',
    '20,000 - 25,000 บาท/เดือน',
    '30,000+ บาท/เดือน',
  ];

  const REMARK_PRESETS = [
    'มีผู้ค้ำประกันร่วม',
    'เช็คเกอร์ตรวจพื้นที่ผ่านแล้ว',
    'มีรายได้เสริมจากการค้าขาย',
    'ขออนุมัติตามเงื่อนไขพิเศษ',
  ];

  const YOD_PRESETS = [
    'หัก 1%',
    'หัก 3%',
    'หัก 5%',
    'หัก 7%',
    'หัก 9%',
    'ยอดจัดปกติ (ไม่หัก)',
  ];

  // Group topics by category for select dropdown
  const groupedTopics = useMemo(() => {
    const groups: Record<string, DvTopicItem[]> = {};
    DV_TOPICS.forEach((item) => {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    });
    return groups;
  }, []);

  return (
    <div
      id="dv-approval-section"
      className={`glass-card-primary rounded-[26px] p-4 sm:p-5 relative overflow-hidden elevated-data-box border border-sky-200/80 shadow-md ${className}`}
    >
      {/* Top Gradient Header Accent Bar */}
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-teal-400 via-emerald-500 to-sky-500 opacity-95" />

      {/* Header Row */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-sky-100/80">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-600 flex items-center justify-center text-white shadow-xs shadow-emerald-500/30">
            <FileCheck2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm sm:text-base text-slate-800 tracking-tight">
                ขออนุมัติเคส DV
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100/90 text-emerald-800 border border-emerald-200/80">
                Dealer Verification
              </span>
            </div>
            <p className="text-[10.5px] text-slate-500 font-medium">
              ดึงชื่อลูกค้า, รุ่นรถ, และชื่อเจ้าหน้าที่ (CK) อัตโนมัติ พร้อมส่งออกเข้า LINE ทันที
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleSyncFromCurrent}
            className="p-1.5 rounded-xl bg-white/90 hover:bg-sky-50 text-slate-600 hover:text-sky-700 border border-slate-200/80 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
            title="ดึงข้อมูลลูกค้า รุ่นรถ เงินดาวน์ และเจ้าหน้าที่ล่าสุด"
          >
            <RefreshCw className="w-3.5 h-3.5 text-sky-600" />
            <span className="hidden sm:inline text-[10.5px]">ดึงข้อมูลล่าสุด</span>
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl bg-white/90 hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer border border-slate-200/80 shadow-2xs"
            title={isExpanded ? 'ย่อกล่อง' : 'ขยายกล่อง'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Main 2-Column Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* COLUMN 1 (Left) */}
            <div className="space-y-3.5">
              {/* 1. ชื่อลูกค้า (Auto-populated) */}
              <div className="glass-panel-white p-3 rounded-2xl elevated-data-box elevated-box-blue border border-sky-100/90 shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-sky-600" />
                    <span>ชื่อลูกค้า</span>
                  </label>
                  <span className="text-[9px] text-sky-700 bg-sky-50 border border-sky-200/70 px-1.5 py-0.5 rounded font-semibold">
                    ดึงอัตโนมัติ
                  </span>
                </div>
                <input
                  type="text"
                  value={dvCustomerName}
                  onChange={(e) => {
                    setDvCustomerName(e.target.value);
                    if (onUpdateCustomerName) {
                      onUpdateCustomerName(e.target.value);
                    }
                  }}
                  placeholder="ระบุชื่อ-นามสกุลลูกค้า"
                  className="w-full glass-input-field px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400"
                />
              </div>

              {/* 2. หัวข้อ (รองรับหลายหัวข้อ + ปุ่มเพิ่มหัวข้อ + ตัดทางลัดออก) */}
              <div className="glass-panel-white p-3 rounded-2xl elevated-data-box elevated-box-purple border border-indigo-100/90 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <label className="text-[11px] font-bold text-slate-700">
                      หัวข้อขออนุมัติ DV
                    </label>
                    {topics.length > 1 && (
                      <span className="text-[9.5px] px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-700 font-bold">
                        {topics.length} ข้อ
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTopicIndexForModal(null);
                      setShowAllTopicsModal(true);
                    }}
                    className="text-[9.5px] text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 px-2 py-0.5 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <Tag className="w-3 h-3 text-indigo-600" />
                    <span>ดูตาราง 18 หัวข้อ</span>
                  </button>
                </div>

                {/* Topic Rows */}
                <div className="space-y-2.5">
                  {topics.map((itemTopic, idx) => {
                    const matchedCode =
                      DV_TOPICS.find((t) => itemTopic.startsWith(t.code))?.code || '';
                    return (
                      <div
                        key={idx}
                        className="p-2 sm:p-2.5 rounded-xl bg-indigo-50/40 border border-indigo-100 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-indigo-900 flex items-center gap-1">
                            <span className="w-4 h-4 rounded-full bg-indigo-200/80 text-indigo-800 flex items-center justify-center text-[9px] font-extrabold">
                              {idx + 1}
                            </span>
                            <span>หัวข้อที่ {idx + 1}</span>
                          </span>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTopicIndexForModal(idx);
                                setShowAllTopicsModal(true);
                              }}
                              className="text-[9px] text-indigo-600 hover:text-indigo-800 px-1.5 py-0.5 rounded hover:bg-indigo-100 transition-colors cursor-pointer"
                              title="เลือกจากตาราง 18 ข้อ"
                            >
                              เลือกจากตาราง
                            </button>
                            {topics.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveTopic(idx)}
                                className="text-[9.5px] text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer flex items-center gap-0.5"
                                title="ลบหัวข้อนี้"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Dropdown Select from 18 codes */}
                        <select
                          value={matchedCode}
                          onChange={(e) => {
                            const found = DV_TOPICS.find((t) => t.code === e.target.value);
                            if (found) {
                              handleTopicChange(idx, `${found.code} : ${found.label}`);
                            }
                          }}
                          className="w-full glass-input-field px-2.5 py-1.5 rounded-xl text-xs font-bold text-indigo-950 bg-white/95 border border-indigo-200/90 cursor-pointer shadow-2xs"
                        >
                          <option value="" disabled>
                            -- เลือกหัวข้อที่ {idx + 1} (18 รหัส) --
                          </option>
                          {Object.entries(groupedTopics).map(([groupName, items]) => (
                            <optgroup key={groupName} label={`📌 ${groupName}`}>
                              {items.map((item) => (
                                <option key={item.code} value={item.code}>
                                  {item.code} : {item.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>

                {/* Add Topic Button */}
                <button
                  type="button"
                  onClick={() => handleAddTopic()}
                  className="mt-2.5 w-full py-2 px-3 rounded-xl border border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/60 hover:bg-indigo-100/70 text-indigo-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] cursor-pointer shadow-2xs"
                >
                  <Plus className="w-4 h-4 text-indigo-600" />
                  <span>เพิ่มหัวข้อขออนุมัติ DV</span>
                </button>
              </div>

              {/* 3. NCB (Only 4 options: Normal, Not Found, Default 1, Default 2) */}
              <div className="glass-panel-white p-3 rounded-2xl elevated-data-box elevated-box-emerald border border-emerald-100/90 shadow-2xs">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>NCB (เครดิตบูโร)</span>
                  </label>
                  <span className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded font-semibold">
                    4 ตัวเลือก
                  </span>
                </div>

                {/* Text input */}
                <input
                  type="text"
                  value={ncb}
                  onChange={(e) => setNcb(e.target.value)}
                  placeholder="Normal / Not Found / Default 1 / Default 2"
                  className="w-full glass-input-field px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 mb-2"
                />

                {/* 4 Exact Button Options */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {NCB_OPTIONS.map((opt) => {
                    const isSelected = ncb.trim().toLowerCase() === opt.toLowerCase();
                    let activeStyles = 'bg-emerald-600 text-white border-emerald-600 shadow-2xs';
                    let inactiveStyles =
                      'bg-white hover:bg-emerald-50 text-emerald-800 border-emerald-200/80';

                    if (opt === 'Not Found') {
                      activeStyles = 'bg-amber-500 text-white border-amber-500 shadow-2xs';
                      inactiveStyles =
                        'bg-white hover:bg-amber-50 text-amber-800 border-amber-200/80';
                    } else if (opt === 'Default 1') {
                      activeStyles = 'bg-orange-500 text-white border-orange-500 shadow-2xs';
                      inactiveStyles =
                        'bg-white hover:bg-orange-50 text-orange-800 border-orange-200/80';
                    } else if (opt === 'Default 2') {
                      activeStyles = 'bg-rose-600 text-white border-rose-600 shadow-2xs';
                      inactiveStyles =
                        'bg-white hover:bg-rose-50 text-rose-800 border-rose-200/80';
                    }

                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setNcb(opt);
                        }}
                        className={`text-[10px] py-1.5 px-2 rounded-xl border font-bold transition-all text-center cursor-pointer ${
                          isSelected ? activeStyles : inactiveStyles
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Dealer */}
              <div className="glass-panel-white p-3 rounded-2xl elevated-data-box border border-sky-100/90 shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Dealer (ชื่อร้านตัวแทนจำหน่าย)</span>
                  </label>
                  <span className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-medium">
                    จำค่าอัตโนมัติ
                  </span>
                </div>
                <input
                  type="text"
                  value={dealer}
                  onChange={(e) => handleDealerChange(e.target.value)}
                  placeholder="เช่น สหพานิช, ฮอนด้าแสงชัย, ดีลเลอร์ กทม."
                  className="w-full glass-input-field px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400"
                />
              </div>

              {/* 5. อาชีพ */}
              <div className="glass-panel-white p-3 rounded-2xl elevated-data-box border border-sky-100/90 shadow-2xs">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 mb-1">
                  <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                  <span>อาชีพ</span>
                </label>
                <input
                  type="text"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  placeholder="เช่น พนักงานประจำ, ค้าขาย, ไรเดอร์"
                  className="w-full glass-input-field px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 mb-1.5"
                />
                <div className="flex flex-wrap gap-1">
                  {OCCUPATION_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setOccupation(p);
                      }}
                      className={`text-[9.5px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                        occupation === p
                          ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                          : 'bg-white hover:bg-indigo-50 text-slate-600 border-slate-200/80 font-medium'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* 6. เอกสารการเงิน (สลิปเงินเดือน, หนังสือรับรองเงินเดือน, Statement 4 เดือน, Statement 6 เดือน, ไม่มีเอกสาร) */}
              <div className="glass-panel-white p-3 rounded-2xl elevated-data-box elevated-box-blue border border-sky-100/90 shadow-2xs">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                    <span>เอกสารการเงิน</span>
                  </label>
                  <span className="text-[9px] text-blue-700 bg-blue-50 border border-blue-200/80 px-1.5 py-0.5 rounded font-semibold">
                    5 ตัวเลือก
                  </span>
                </div>
                <input
                  type="text"
                  value={financialDocs}
                  onChange={(e) => setFinancialDocs(e.target.value)}
                  placeholder="เลือกหรือพิมพ์เอกสารการเงิน"
                  className="w-full glass-input-field px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 mb-1.5"
                />
                <div className="flex flex-wrap gap-1">
                  {FINANCIAL_DOCS_OPTIONS.map((doc) => {
                    const isSelected = financialDocs === doc;
                    return (
                      <button
                        key={doc}
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setFinancialDocs(doc);
                        }}
                        className={`text-[9.5px] px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-2xs'
                            : 'bg-white hover:bg-blue-50 text-slate-700 border-slate-200/80 font-medium'
                        }`}
                      >
                        {doc}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* COLUMN 2 (Right) */}
            <div className="space-y-3.5">
              {/* 7. รุ่นรถ (Auto-populated) */}
              <div className="glass-panel-white p-3 rounded-2xl elevated-data-box elevated-box-blue border border-sky-100/90 shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                    <Bike className="w-3.5 h-3.5 text-sky-600" />
                    <span>รุ่นรถ</span>
                  </label>
                  <span className="text-[9px] text-sky-700 bg-sky-50 border border-sky-200/70 px-1.5 py-0.5 rounded font-semibold">
                    ดึงอัตโนมัติ
                  </span>
                </div>
                <input
                  type="text"
                  value={bikeModel}
                  onChange={(e) => setBikeModel(e.target.value)}
                  placeholder="ระบุชื่อรุ่นรถ / รหัสรุ่น"
                  className="w-full glass-input-field px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400"
                />
              </div>

              {/* 8. เงินดาวน์ (Auto-populated) */}
              <div className="glass-panel-white p-3 rounded-2xl elevated-data-box elevated-box-emerald border border-emerald-100/90 shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-emerald-600" />
                    <span>เงินดาวน์</span>
                  </label>
                  <span className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-1.5 py-0.5 rounded font-semibold">
                    ดึงจากค่างวด
                  </span>
                </div>
                <input
                  type="text"
                  value={downPayment}
                  onChange={(e) => setDownPayment(e.target.value)}
                  placeholder="เช่น 0 บาท (ฟรีดาวน์ 0%) หรือ 10,000 บาท (15%)"
                  className="w-full glass-input-field px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400"
                />
              </div>

              {/* 9. หมายเหตุ (NEW: วางไว้ใต้เงินดาวน์โดยตรงตามความต้องการ) */}
              <div className="glass-panel-white p-3 rounded-2xl elevated-data-box elevated-box-amber border border-amber-200/90 bg-gradient-to-br from-amber-50/40 via-white to-white shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                    <MessageSquareText className="w-3.5 h-3.5 text-amber-600" />
                    <span>หมายเหตุ (ใต้เงินดาวน์)</span>
                  </label>
                  <span className="text-[9px] text-amber-800 bg-amber-100/80 border border-amber-300/70 px-1.5 py-0.5 rounded font-semibold">
                    ข้อมูลเพิ่มเติม
                  </span>
                </div>
                <input
                  type="text"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="ระบุข้อมูลเพิ่มเติม เช่น มีผู้ค้ำประกัน, ที่อยู่จัดส่งเอกสาร"
                  className="w-full glass-input-field px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 mb-1.5"
                />
                <div className="flex flex-wrap gap-1">
                  {REMARK_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setRemark(p);
                      }}
                      className={`text-[9.5px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                        remark === p
                          ? 'bg-amber-600 text-white border-amber-600 font-bold'
                          : 'bg-white hover:bg-amber-50 text-slate-600 border-amber-200/80 font-medium'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  {remark && (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setRemark('');
                      }}
                      className="text-[9px] px-1.5 py-0.5 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                      title="ล้างหมายเหตุ"
                    >
                      ล้าง
                    </button>
                  )}
                </div>
              </div>

              {/* 10. รายได้ */}
              <div className="glass-panel-white p-3 rounded-2xl elevated-data-box border border-sky-100/90 shadow-2xs">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 mb-1">
                  <Wallet className="w-3.5 h-3.5 text-teal-600" />
                  <span>รายได้</span>
                </label>
                <input
                  type="text"
                  value={income}
                  onChange={(e) => setIncome(e.target.value)}
                  placeholder="เช่น 18,000 บาท/เดือน"
                  className="w-full glass-input-field px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 mb-1.5"
                />
                <div className="flex flex-wrap gap-1">
                  {INCOME_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setIncome(p);
                      }}
                      className={`text-[9.5px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                        income === p
                          ? 'bg-teal-600 text-white border-teal-600 font-bold'
                          : 'bg-white hover:bg-teal-50 text-slate-600 border-slate-200/80 font-medium'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* 11. CK (ดึงเอาชื่อเจ้าหน้าที่มาอัตโนมัติ) */}
              <div className="glass-panel-white p-3 rounded-2xl elevated-data-box elevated-box-teal border border-teal-100/90 shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-teal-600" />
                    <span>CK (เจ้าหน้าที่ตรวจสอบ / ผู้เสนอราคา)</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-teal-700 bg-teal-50 border border-teal-200/80 px-1.5 py-0.5 rounded font-semibold">
                      ดึงชื่อเจ้าหน้าที่อัตโนมัติ
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setCk(resolvedOfficer);
                      }}
                      className="text-[9px] text-sky-700 hover:text-sky-900 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200 transition-colors"
                      title="รีเซ็ตเป็นชื่อเจ้าหน้าที่ปัจจุบัน"
                    >
                      รีเซ็ต
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={ck}
                  onChange={(e) => setCk(e.target.value)}
                  placeholder="ชื่อเจ้าหน้าที่ตรวจสอบ เช่น บดินทร์ (6683)"
                  className="w-full glass-input-field px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400"
                />
                <p className="text-[9.5px] text-slate-500 mt-1">
                  ดึงจากข้อมูลผู้เสนอราคา ({resolvedOfficer}) สามารถแก้ไขหรือพิมพ์เพิ่มเติมได้
                </p>
              </div>
            </div>
          </div>

          {/* 12. YOD1-9% (Span Full Width) */}
          <div className="glass-panel-white p-3.5 rounded-2xl elevated-data-box elevated-box-amber border border-amber-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-amber-600" />
                <span>YOD1-9% (หักยอดจัดตามเงื่อนไข DV)</span>
              </label>
              {financeAmount > 0 && (
                <span className="text-[10px] text-slate-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200/60">
                  ยอดจัดอ้างอิง: {financeAmount.toLocaleString('th-TH')} บาท
                </span>
              )}
            </div>
            <input
              type="text"
              value={yodRate}
              onChange={(e) => setYodRate(e.target.value)}
              placeholder="เช่น หัก 3%, หัก 5% หรือระบุเงื่อนไข"
              className="w-full glass-input-field px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 mb-1.5"
            />
            <div className="flex flex-wrap gap-1.5">
              {YOD_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setYodRate(p);
                  }}
                  className={`text-[9.5px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    yodRate === p
                      ? 'bg-amber-600 text-white border-amber-600 font-bold shadow-2xs'
                      : 'bg-white hover:bg-amber-50 text-slate-600 border-slate-200/80 font-medium'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Live LINE Message Preview Box (ปรับสีให้อ่อน สว่าง สบายตา สไตล์ LINE) */}
          <div className="mt-3 p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50/80 via-teal-50/40 to-sky-50/60 border border-emerald-200/80 shadow-2xs">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-200/70 text-[11px]">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#06c755] animate-pulse" />
                ตัวอย่างข้อความขออนุมัติเคส DV ที่จะส่งเข้า LINE :
              </span>
              <span className="text-[10px] text-emerald-800 font-semibold bg-white/90 border border-emerald-200/80 px-2 py-0.5 rounded-full shadow-2xs">
                {generateDvText().length} ตัวอักษร
              </span>
            </div>
            <pre className="font-sans text-[11.5px] leading-relaxed whitespace-pre-wrap text-slate-800 select-text bg-white/95 p-3 rounded-xl border border-emerald-200/70 shadow-2xs">
              {generateDvText()}
            </pre>
          </div>

          {/* Action Buttons: ปุ่มคัดลอกข้อความและส่ง Line ให้อยู่แถวเดียวกันในตำแหน่งกึ่งกลาง (เอาปุ่มดึงค่าล่าสุดออก) */}
          <div className="pt-3 flex flex-row items-center justify-center gap-3 sm:gap-4 w-full">
            {/* Copy Text Button */}
            <button
              type="button"
              onClick={handleCopyText}
              className="flex-1 sm:flex-initial sm:min-w-[175px] justify-center px-4 py-2.5 rounded-xl bg-sky-50 hover:bg-sky-100/90 text-sky-900 border border-sky-200/90 text-xs font-bold flex items-center gap-2 shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              {isCopied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">คัดลอกเรียบร้อย!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-sky-700" />
                  <span>คัดลอกข้อความ</span>
                </>
              )}
            </button>

            {/* Send to LINE Button */}
            <button
              type="button"
              onClick={handleSendLine}
              className="flex-1 sm:flex-initial sm:min-w-[175px] justify-center px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-[#06c755] to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-extrabold flex items-center gap-2 shadow-sm shadow-emerald-500/30 transition-all active:scale-95 cursor-pointer"
            >
              {lineSentFeedback ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>คัดลอก & กำลังส่ง LINE!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 text-white" />
                  <span>ส่ง Line</span>
                  <ExternalLink className="w-3 h-3 text-emerald-200" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Modal: View All 18 DV Topics Grid */}
      {showAllTopicsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-4 sm:p-5 shadow-2xl border border-indigo-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-800">
                    ตารางหัวข้อขออนุมัติ DV (ทั้งหมด 18 หัวข้อ)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {activeTopicIndexForModal !== null
                      ? `คลิกเลือกเพื่อใส่แทนใน "หัวข้อที่ ${activeTopicIndexForModal + 1}" หรือกด "+ เพิ่ม" เป็นหัวข้อใหม่`
                      : 'คลิกเพื่อเลือกหัวข้อที่ต้องการ หรือกดปุ่ม "+ เพิ่ม" เพื่อเพิ่มลงในรายการ'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAllTopicsModal(false);
                  setActiveTopicIndexForModal(null);
                }}
                className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto py-3 space-y-4 flex-1 pr-1">
              {Object.entries(groupedTopics).map(([category, items]) => (
                <div key={category} className="space-y-1.5">
                  <h5 className="text-[11px] font-bold text-slate-600 px-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    {category}
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {items.map((item) => {
                      const isSelected = topics.some((t) => t.startsWith(item.code));
                      return (
                        <div
                          key={item.code}
                          className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 font-semibold shadow-2xs'
                              : 'bg-slate-50/70 hover:bg-white hover:border-indigo-200 text-slate-700 border-slate-200/80 font-medium'
                          }`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span
                              className={`text-[11px] font-mono px-2 py-0.5 rounded-md font-bold shrink-0 ${
                                isSelected
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-indigo-100 text-indigo-800'
                              }`}
                            >
                              {item.code}
                            </span>
                            <span className="text-xs truncate">{item.label}</span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleSelectTopic(item, activeTopicIndexForModal ?? undefined)}
                              className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer shadow-2xs active:scale-95"
                            >
                              {activeTopicIndexForModal !== null
                                ? `ใส่ข้อที่ ${activeTopicIndexForModal + 1}`
                                : 'เลือก'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleAddTopic(`${item.code} : ${item.label}`);
                                setShowAllTopicsModal(false);
                                setActiveTopicIndexForModal(null);
                              }}
                              className="text-[10px] font-bold px-2 py-1 rounded-lg bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 transition-all cursor-pointer flex items-center gap-0.5 active:scale-95"
                              title="เพิ่มเป็นหัวข้อใหม่"
                            >
                              <Plus className="w-3 h-3 text-indigo-600" />
                              <span>เพิ่ม</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                เลือกแล้ว {topics.filter((t) => t.trim()).length} หัวข้อ
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowAllTopicsModal(false);
                  setActiveTopicIndexForModal(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
