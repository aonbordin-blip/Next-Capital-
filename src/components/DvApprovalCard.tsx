import React, { useState, useEffect, useMemo } from 'react';
import {
  FileCheck2,
  Share2,
  Copy,
  Check,
  RotateCcw,
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
} from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';

interface DvApprovalCardProps {
  customerName: string;
  bikeModelName: string;
  bikeModelCode?: string;
  downPaymentDisplay: string;
  financeAmount: number;
  monthlyInstallment?: number;
  term?: number;
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
  onUpdateCustomerName,
  className = '',
}: DvApprovalCardProps) {
  // Form states
  const [dvCustomerName, setDvCustomerName] = useState<string>(customerName || 'คุณลูกค้า');
  const [topic, setTopic] = useState<string>('ขออนุมัติเบื้องต้น');
  const [ncb, setNcb] = useState<string>('ปกติ (สถานะ 10)');
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
  const [financialDocs, setFinancialDocs] = useState<string>('สลิปเงินเดือน + Statement 6 เดือน');
  const [downPayment, setDownPayment] = useState<string>(downPaymentDisplay || '0 บาท (ฟรีดาวน์)');
  const [ck, setCk] = useState<string>('ผ่านเกณฑ์ / มีที่พักและที่ทำงานจริง');
  const [yodRate, setYodRate] = useState<string>('หัก 3%');

  // UI state
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [lineSentFeedback, setLineSentFeedback] = useState<boolean>(false);

  // Sync with main app customer and bike when they change, if user hasn't overridden or when clicked
  useEffect(() => {
    if (customerName && customerName.trim() !== '') {
      setDvCustomerName(customerName);
    }
  }, [customerName]);

  useEffect(() => {
    if (resolvedBike) {
      setBikeModel(resolvedBike);
    }
  }, [resolvedBike]);

  useEffect(() => {
    if (downPaymentDisplay) {
      setDownPayment(downPaymentDisplay);
    }
  }, [downPaymentDisplay]);

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
  };

  // Build formatted text matching EXACT user template:
  /*
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

  CK : 
  YOD1-9% : 
  */
  const generateDvText = (): string => {
    return `ขออนุมัติเคส DV
ชื่อลูกค้า : ${dvCustomerName || '-'}
หัวข้อ : ${topic || '-'}
NCB : ${ncb || '-'}
Dealer : ${dealer || '-'}
รุ่นรถ : ${bikeModel || '-'}
อาชีพ : ${occupation || '-'}
รายได้ : ${income || '-'}
เอกสารการเงิน : ${financialDocs || '-'}
เงินดาวน์ : ${downPayment || '-'}

CK : ${ck || '-'}
YOD1-9% : ${yodRate || '-'}`;
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

  // Quick preset pills
  const TOPIC_PRESETS = [
    'ขออนุมัติเบื้องต้น',
    'ขอปลดล็อกเงินดาวน์',
    'ขอปรับเกณฑ์พิเศษ',
    'ขอยกเว้นผู้ค้ำประกัน',
    'ขออนุมัติผลเคส',
  ];

  const NCB_PRESETS = [
    'ปกติ (สถานะ 10)',
    'เกรด A (ไม่มีประวัติล่าช้า)',
    'มีประวัติปิดหมดแล้ว',
    'ล่าช้าไม่เกิน 30 วัน',
    'ไม่มีประวัติสินเชื่อ',
  ];

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

  const DOCS_PRESETS = [
    'สลิปเงินเดือน + Statement 6 เดือน',
    'Statement ย้อนหลัง 6 เดือน',
    'หนังสือรับรองเงินเดือน + Statement',
    'ทะเบียนการค้า / หน้าร้าน',
    'บิลส่งของ / ใบเสร็จรับเงิน',
  ];

  const CK_PRESETS = [
    'ผ่านเกณฑ์ / มีที่พักและที่ทำงานจริง',
    'ผ่านเกณฑ์ / เช็คเกอร์ตรวจพื้นที่แล้ว',
    'ผ่านเกณฑ์ (พักอาศัยบ้านตนเอง)',
    'ผ่านเกณฑ์ (มีผู้ค้ำประกันร่วม)',
    'รอผลตรวจที่พัก',
  ];

  const YOD_PRESETS = [
    'หัก 1%',
    'หัก 3%',
    'หัก 5%',
    'หัก 7%',
    'หัก 9%',
    'ยอดจัดปกติ (ไม่หัก)',
  ];

  return (
    <div
      id="dv-approval-section"
      className={`glass-card-primary rounded-[26px] p-4 sm:p-5 relative overflow-hidden elevated-data-box border border-sky-200/80 shadow-md ${className}`}
    >
      {/* Header Accent Bar */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-teal-400 via-emerald-500 to-sky-500 opacity-90" />

      {/* Header Row */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-sky-100/80">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-xs shadow-emerald-500/30">
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
              ดึงชื่อลูกค้าและรุ่นรถอัตโนมัติ พร้อมส่งออกข้อความเข้า LINE ทันที
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleSyncFromCurrent}
            className="p-1.5 rounded-xl bg-white/80 hover:bg-sky-50 text-slate-600 hover:text-sky-700 border border-slate-200/80 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
            title="ดึงข้อมูลลูกค้าและรุ่นรถล่าสุดจากการคำนวณ"
          >
            <RefreshCw className="w-3.5 h-3.5 text-sky-600" />
            <span className="hidden sm:inline text-[10.5px]">ดึงข้อมูลล่าสุด</span>
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl bg-white/80 hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
            title={isExpanded ? 'ย่อกล่อง' : 'ขยายกล่อง'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Inputs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. ชื่อลูกค้า (Auto-populated) */}
            <div className="glass-panel-white p-2.5 rounded-2xl elevated-data-box elevated-box-blue border border-sky-100">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10.5px] font-bold text-slate-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-sky-600" />
                  <span>ชื่อลูกค้า</span>
                </label>
                <span className="text-[9px] text-sky-700 bg-sky-50 border border-sky-200/70 px-1.5 py-0.2 rounded font-semibold">
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

            {/* 2. รุ่นรถ (Auto-populated) */}
            <div className="glass-panel-white p-2.5 rounded-2xl elevated-data-box elevated-box-blue border border-sky-100">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10.5px] font-bold text-slate-700 flex items-center gap-1.5">
                  <Bike className="w-3.5 h-3.5 text-sky-600" />
                  <span>รุ่นรถ</span>
                </label>
                <span className="text-[9px] text-sky-700 bg-sky-50 border border-sky-200/70 px-1.5 py-0.2 rounded font-semibold">
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

            {/* 3. หัวข้อ */}
            <div className="glass-panel-white p-2.5 rounded-2xl elevated-data-box border border-sky-100">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10.5px] font-bold text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>หัวข้อ</span>
                </label>
              </div>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="เช่น ขออนุมัติเบื้องต้น, ขอปลดล็อกดาวน์"
                className="w-full glass-input-field px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 mb-1.5"
              />
              <div className="flex flex-wrap gap-1">
                {TOPIC_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setTopic(p);
                    }}
                    className={`text-[9.5px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                      topic === p
                        ? 'bg-sky-600 text-white border-sky-600 font-bold'
                        : 'bg-white/80 hover:bg-sky-50 text-slate-600 border-slate-200/80 font-medium'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. NCB */}
            <div className="glass-panel-white p-2.5 rounded-2xl elevated-data-box border border-sky-100">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10.5px] font-bold text-slate-700 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>NCB (เครดิตบูโร)</span>
                </label>
              </div>
              <input
                type="text"
                value={ncb}
                onChange={(e) => setNcb(e.target.value)}
                placeholder="เช่น ปกติ (สถานะ 10), มีประวัติปิดหมดแล้ว"
                className="w-full glass-input-field px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 mb-1.5"
              />
              <div className="flex flex-wrap gap-1">
                {NCB_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setNcb(p);
                    }}
                    className={`text-[9.5px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                      ncb === p
                        ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                        : 'bg-white/80 hover:bg-emerald-50 text-slate-600 border-slate-200/80 font-medium'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Dealer */}
            <div className="glass-panel-white p-2.5 rounded-2xl elevated-data-box border border-sky-100">
              <label className="text-[10.5px] font-bold text-slate-700 flex items-center gap-1.5 mb-1">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Dealer (ชื่อร้านตัวแทนจำหน่าย)</span>
              </label>
              <input
                type="text"
                value={dealer}
                onChange={(e) => handleDealerChange(e.target.value)}
                placeholder="เช่น สหพานิช, ฮอนด้าแสงชัย, ดีลเลอร์ กทม."
                className="w-full glass-input-field px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400"
              />
            </div>

            {/* 6. เงินดาวน์ (Auto-populated) */}
            <div className="glass-panel-white p-2.5 rounded-2xl elevated-data-box elevated-box-emerald border border-sky-100">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10.5px] font-bold text-slate-700 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-emerald-600" />
                  <span>เงินดาวน์</span>
                </label>
                <span className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-1.5 py-0.2 rounded font-semibold">
                  ดึงจากค่างวด
                </span>
              </div>
              <input
                type="text"
                value={downPayment}
                onChange={(e) => setDownPayment(e.target.value)}
                placeholder="เช่น 0 บาท (ฟรีดาวน์) หรือ 10,000 บาท (15%)"
                className="w-full glass-input-field px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400"
              />
            </div>

            {/* 7. อาชีพ */}
            <div className="glass-panel-white p-2.5 rounded-2xl elevated-data-box border border-sky-100">
              <label className="text-[10.5px] font-bold text-slate-700 flex items-center gap-1.5 mb-1">
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
                        : 'bg-white/80 hover:bg-indigo-50 text-slate-600 border-slate-200/80 font-medium'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* 8. รายได้ */}
            <div className="glass-panel-white p-2.5 rounded-2xl elevated-data-box border border-sky-100">
              <label className="text-[10.5px] font-bold text-slate-700 flex items-center gap-1.5 mb-1">
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
                        : 'bg-white/80 hover:bg-teal-50 text-slate-600 border-slate-200/80 font-medium'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* 9. เอกสารการเงิน */}
            <div className="glass-panel-white p-2.5 rounded-2xl elevated-data-box border border-sky-100">
              <label className="text-[10.5px] font-bold text-slate-700 flex items-center gap-1.5 mb-1">
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                <span>เอกสารการเงิน</span>
              </label>
              <input
                type="text"
                value={financialDocs}
                onChange={(e) => setFinancialDocs(e.target.value)}
                placeholder="เช่น สลิปเงินเดือน + Statement 6 เดือน"
                className="w-full glass-input-field px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 mb-1.5"
              />
              <div className="flex flex-wrap gap-1">
                {DOCS_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setFinancialDocs(p);
                    }}
                    className={`text-[9.5px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                      financialDocs === p
                        ? 'bg-blue-600 text-white border-blue-600 font-bold'
                        : 'bg-white/80 hover:bg-blue-50 text-slate-600 border-slate-200/80 font-medium'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* 10. CK (Checker) */}
            <div className="glass-panel-white p-2.5 rounded-2xl elevated-data-box border border-sky-100">
              <label className="text-[10.5px] font-bold text-slate-700 flex items-center gap-1.5 mb-1">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>CK (เช็คเกอร์ / ตรวจสอบพื้นที่)</span>
              </label>
              <input
                type="text"
                value={ck}
                onChange={(e) => setCk(e.target.value)}
                placeholder="เช่น ผ่านเกณฑ์ / เช็คเกอร์ตรวจพื้นที่แล้ว"
                className="w-full glass-input-field px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 mb-1.5"
              />
              <div className="flex flex-wrap gap-1">
                {CK_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setCk(p);
                    }}
                    className={`text-[9.5px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                      ck === p
                        ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                        : 'bg-white/80 hover:bg-emerald-50 text-slate-600 border-slate-200/80 font-medium'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* 11. YOD1-9% */}
            <div className="glass-panel-white p-2.5 rounded-2xl elevated-data-box elevated-box-amber border border-sky-100 sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10.5px] font-bold text-slate-700 flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-amber-600" />
                  <span>YOD1-9% (ยอดจัด / หักเปอร์เซ็นต์ตามเงื่อนไข)</span>
                </label>
                {financeAmount > 0 && (
                  <span className="text-[10px] text-slate-500 font-medium">
                    ยอดจัดอ้างอิง: {financeAmount.toLocaleString('th-TH')} บ.
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
              <div className="flex flex-wrap gap-1">
                {YOD_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setYodRate(p);
                    }}
                    className={`text-[9.5px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                      yodRate === p
                        ? 'bg-amber-600 text-white border-amber-600 font-bold'
                        : 'bg-white/80 hover:bg-amber-50 text-slate-600 border-slate-200/80 font-medium'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Live Preview Box */}
          <div className="mt-3 p-3.5 rounded-2xl bg-slate-900/90 text-slate-100 border border-slate-700/80 shadow-inner">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                ตัวอย่างข้อความที่จะส่ง LINE :
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {generateDvText().length} ตัวอักษร
              </span>
            </div>
            <pre className="font-sans text-[11.5px] leading-relaxed whitespace-pre-wrap text-slate-200 select-text">
              {generateDvText()}
            </pre>
          </div>

          {/* Action Buttons */}
          <div className="pt-1 flex flex-wrap items-center justify-end gap-2 sm:gap-2.5">
            {/* Reset */}
            <button
              type="button"
              onClick={handleSyncFromCurrent}
              className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 text-xs font-semibold flex items-center gap-1.5 shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>รีเซ็ตดึงค่าใหม่</span>
            </button>

            {/* Copy Button */}
            <button
              type="button"
              onClick={handleCopyText}
              className="px-4 py-2.5 rounded-xl bg-sky-50 hover:bg-sky-100/90 text-sky-900 border border-sky-200/90 text-xs font-bold flex items-center gap-1.5 shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              {isCopied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">คัดลอกสำเร็จ!</span>
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
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-[#06c755] to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-extrabold flex items-center gap-2 shadow-sm shadow-emerald-500/30 transition-all active:scale-95 cursor-pointer"
            >
              {lineSentFeedback ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>คัดลอก & ส่ง LINE เรียบร้อย!</span>
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
    </div>
  );
}
