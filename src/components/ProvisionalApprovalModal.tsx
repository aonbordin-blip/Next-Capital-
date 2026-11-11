import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Check,
  Share2,
  Calendar,
  User,
  Download,
  Printer,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Bike,
  Building2,
  Phone,
  Clock,
  FileCheck,
  BadgePercent,
  CalendarClock,
  Award,
} from 'lucide-react';
import { CalculationResult, VehicleDeliveryStatus } from '../types';
import { formatBaht, cleanPlanNameForLine, formatTermYearMonth } from '../data/proposals';
import { findModelByCode } from '../data/motorcycleModels';
import { NextCapitalLogo } from './NextCapitalLogo';
import { downloadElementAsImage } from '../utils/exportImage';
import { calculateFirstPaymentDueDate } from '../utils/savedCasesStorage';
import { triggerHaptic } from '../utils/haptics';

export interface ProvisionalApprovalData {
  customerName?: string;
  customerPhone?: string;
  bikeModelName?: string;
  bikeModelCode?: string;
  vehiclePrice?: number;
  downAmount?: number;
  downPercent?: number;
  financeAmount?: number;
  vehicleFinanceAmount?: number;
  term?: number;
  monthlyInstallment?: number;
  interestRateText?: string;
  proposalCode?: string;
  proposalName?: string;
  insurancePlanName?: string;
  insuranceYears?: number;
  insuranceTotalWithVat?: number;
  approvalDate?: string; // YYYY-MM-DD
  deliveryDate?: string; // YYYY-MM-DD
  deliveryStatus?: VehicleDeliveryStatus;
  dealerName?: string;
  officerInfo?: string;
  docNumber?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: ProvisionalApprovalData;
  onUpdateCustomer?: (name: string, phone: string) => void;
}

const THAI_MONTHS_NAMES = [
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

function formatThaiDateDisplay(dateInput?: string | Date | number): string {
  if (!dateInput) {
    const now = new Date();
    return `${now.getDate()} ${THAI_MONTHS_NAMES[now.getMonth()]} พ.ศ. ${now.getFullYear() + 543}`;
  }
  let d: Date;
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const parts = dateInput.split('-').map(Number);
    d = new Date(parts[0], parts[1] - 1, parts[2]);
  } else {
    d = new Date(dateInput);
  }
  if (isNaN(d.getTime())) {
    d = new Date();
  }
  const day = d.getDate();
  const month = THAI_MONTHS_NAMES[d.getMonth()] || '';
  const year = d.getFullYear() + 543;
  return `${day} ${month} พ.ศ. ${year}`;
}

function calculateExpiryDateDisplay(approvalDateInput?: string | Date | number): string {
  let d: Date;
  if (!approvalDateInput) {
    d = new Date();
  } else if (typeof approvalDateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(approvalDateInput)) {
    const parts = approvalDateInput.split('-').map(Number);
    d = new Date(parts[0], parts[1] - 1, parts[2]);
  } else {
    d = new Date(approvalDateInput);
  }
  if (isNaN(d.getTime())) d = new Date();

  // 30 days validity period
  const expiry = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 30);
  const day = expiry.getDate();
  const month = THAI_MONTHS_NAMES[expiry.getMonth()] || '';
  const year = expiry.getFullYear() + 543;
  return `${day} ${month} พ.ศ. ${year}`;
}

const generateApprovalDocNumber = (date: Date = new Date()): string => {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `NCAP-APV-${yy}${mm}${dd}-${hh}${min}`;
};

export const ProvisionalApprovalModal: React.FC<Props> = ({
  isOpen,
  onClose,
  data,
  onUpdateCustomer,
}) => {
  const [dealerName, setDealerName] = useState<string>(
    data.dealerName || 'บริษัท เน็กซ์ แคปปิตอล จำกัด (มหาชน)'
  );
  const [officerNameAndCode, setOfficerNameAndCode] = useState<string>(
    data.officerInfo || 'บดินทร์ (6683)'
  );
  const [customerName, setCustomerName] = useState<string>(data.customerName || 'คุณลูกค้า');
  const [customerPhone, setCustomerPhone] = useState<string>(data.customerPhone || '');
  const [approvalDate, setApprovalDate] = useState<string>(
    data.approvalDate || new Date().toISOString().slice(0, 10)
  );

  const getModelNameByCode = (code?: string): string | null => {
    if (!code || !code.trim()) return null;
    const found = findModelByCode(code);
    return found ? found.name : null;
  };

  const initialModelName =
    data.bikeModelName && data.bikeModelName !== 'รถจักรยานยนต์'
      ? data.bikeModelName
      : getModelNameByCode(data.bikeModelCode) || data.bikeModelName || 'รถจักรยานยนต์';

  const [modelName, setModelName] = useState<string>(initialModelName);
  const [modelCodeState, setModelCodeState] = useState<string>(
    data.bikeModelCode ? data.bikeModelCode.toUpperCase() : ''
  );
  const [docNumber, setDocNumber] = useState<string>(
    () => data.docNumber || generateApprovalDocNumber()
  );

  // Sync state when props change
  useEffect(() => {
    if (data.dealerName) setDealerName(data.dealerName);
    if (data.officerInfo) setOfficerNameAndCode(data.officerInfo);
    if (data.customerName) setCustomerName(data.customerName);
    if (data.customerPhone !== undefined) setCustomerPhone(data.customerPhone);
    if (data.approvalDate) setApprovalDate(data.approvalDate);
    if (data.bikeModelCode) setModelCodeState(data.bikeModelCode.toUpperCase());
    if (data.bikeModelName) setModelName(data.bikeModelName);
    if (data.docNumber) setDocNumber(data.docNumber);
  }, [data]);

  const [copied, setCopied] = useState<boolean>(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);
  const [imageSuccessMessage, setImageSuccessMessage] = useState<string | null>(null);

  // Scaling & Responsive Viewport Refs
  const exportTemplateRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const previewDocRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState<number>(1);
  const [previewHeight, setPreviewHeight] = useState<number>(1280);
  const [zoomMode, setZoomMode] = useState<'fit' | '100'>('fit');

  // Auto-scale preview to fit screen perfectly on mobile devices
  useEffect(() => {
    if (!isOpen) return;

    const measureAndScale = () => {
      if (previewDocRef.current) {
        const h = previewDocRef.current.scrollHeight;
        if (h > 0) setPreviewHeight(h);
      }
      if (previewContainerRef.current) {
        const containerWidth = previewContainerRef.current.clientWidth - 16;
        if (containerWidth > 0 && containerWidth < 780) {
          const s = Math.max(0.3, containerWidth / 780);
          setPreviewScale(s);
        } else {
          setPreviewScale(1);
        }
      }
    };

    measureAndScale();
    const t1 = setTimeout(measureAndScale, 60);
    const t2 = setTimeout(measureAndScale, 250);

    window.addEventListener('resize', measureAndScale);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', measureAndScale);
    };
  }, [
    isOpen,
    customerName,
    customerPhone,
    officerNameAndCode,
    dealerName,
    modelName,
    approvalDate,
    data,
  ]);

  if (!isOpen) return null;

  const vehiclePrice = data.vehiclePrice || 0;
  const downAmount = data.downAmount || 0;
  const downPercent = data.downPercent || 0;
  const financeAmount = data.financeAmount || Math.max(0, vehiclePrice - downAmount);
  const term = data.term || 36;
  const monthlyInstallment = data.monthlyInstallment || 0;
  const rawRateText = data.interestRateText || 'อัตราดอกเบี้ยพิเศษตามประกาศ NCAP';
  // Strip redundant "[กำหนดเอง]" or "(กำหนดเอง)"
  const cleanRateText = rawRateText
    .replace(/\s*\[\s*กำหนดเอง\s*\]/gi, '')
    .replace(/\s*\(\s*กำหนดเอง\s*\)/gi, '')
    .trim();

  const proposalCode = data.proposalCode || 'NCAP-STANDARD';
  const proposalName = data.proposalName || 'สินเชื่อเช่าซื้อรถจักรยานยนต์';
  const insuranceYears = data.insuranceYears || 0;

  // Clean insurance plan name to avoid duplicate year texts like "แผน B (คุ้มครอง 3 ปี) (3 ปี)"
  const displayInsurancePlan = (() => {
    if (!data.insurancePlanName || data.insurancePlanName === 'none' || data.insurancePlanName === 'ไม่มีประกัน') {
      return 'ไม่มีประกัน';
    }
    const clean = cleanPlanNameForLine(data.insurancePlanName);
    if (/คุ้มครอง\s*\d+\s*ปี/i.test(clean) || /\(\s*\d+\s*ปี\s*\)/i.test(clean)) {
      return clean;
    }
    return insuranceYears > 0 ? `${clean} (คุ้มครอง ${insuranceYears} ปี)` : clean;
  })();

  // First payment due date
  const firstDueInfo = calculateFirstPaymentDueDate(data.deliveryDate || approvalDate);
  const formattedApprovalDate = formatThaiDateDisplay(approvalDate);
  const formattedExpiryDate = calculateExpiryDateDisplay(approvalDate);

  // In-Browser High-Quality PNG Generation
  const handleDownloadImage = async () => {
    if (!exportTemplateRef.current || isGeneratingImage) return;
    setIsGeneratingImage(true);
    setImageSuccessMessage(null);
    triggerHaptic('medium');

    try {
      const cleanCustomer = (customerName || 'ลูกค้า').replace(/\s+/g, '_');
      const cleanModel = (modelName || 'รถจักรยานยนต์').replace(/\s+/g, '_');
      const fileName = `ใบอนุมัติผลชั่วคราว_${cleanCustomer}_${cleanModel}_NextCapital.png`;
      await downloadElementAsImage(exportTemplateRef.current, fileName, 780);

      triggerHaptic('success');
      setImageSuccessMessage('ดาวน์โหลดรูปภาพใบอนุมัติผลชั่วคราวเรียบร้อยแล้ว!');
      setTimeout(() => setImageSuccessMessage(null), 3500);
    } catch (err) {
      console.error('Failed to generate image:', err);
      alert('เกิดข้อผิดพลาดในการสร้างรูปภาพ: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handlePrint = () => {
    triggerHaptic('light');
    window.print();
  };

  const handleCopyChatText = async () => {
    triggerHaptic('light');
    const summary = `🎉 ใบแจ้งผลการอนุมัติสินเชื่อเช่าซื้อ (เบื้องต้น)
🏢 บริษัท เน็กซ์ แคปปิตอล จำกัด (มหาชน)
🔢 เลขที่อนุมัติ: ${docNumber}
📅 วันที่อนุมัติ: ${formattedApprovalDate}
⏳ ผลอนุมัติใช้ได้ถึง: ${formattedExpiryDate} (30 วัน)
━━━━━━━━━━━━━━━━━━━━
👤 ผู้เช่าซื้อ: ${customerName}${customerPhone ? ` (${customerPhone})` : ''}
🏪 ตัวแทนจำหน่าย: ${dealerName}
👨‍💼 เจ้าหน้าที่ผู้ดูแล: ${officerNameAndCode}

🛵 ข้อมูลรถจักรยานยนต์:
• รุ่นรถ: ${modelName} ${modelCodeState ? `(${modelCodeState})` : ''}
• ราคารถ: ${formatBaht(vehiclePrice)} บาท

💳 เงื่อนไขสินเชื่อที่ได้รับอนุมัติ:
• เงินดาวน์: ${formatBaht(downAmount)} บาท (${downPercent.toFixed(1)}%)
• ยอดจัดสินเชื่อ: ${formatBaht(financeAmount, true)} บาท
• ระยะเวลาผ่อน: ${term} งวด (${formatTermYearMonth(term)})
• อัตราดอกเบี้ย: ${cleanRateText}
${
  displayInsurancePlan && displayInsurancePlan !== 'ไม่มีประกัน' && displayInsurancePlan !== 'ไม่รับความคุ้มครอง PA'
    ? `• ประกันภัย: ${displayInsurancePlan}\n`
    : ''
}
✨ ค่างวดที่ได้รับอนุมัติ:
👉 ${formatBaht(monthlyInstallment)} บาท / เดือน (รวม VAT 7%)
📅 กำหนดชำระ: ทุกวันที่ 2 ของเดือน
📌 งวดแรกครบกำหนด: ${firstDueInfo.formattedLong}

━━━━━━━━━━━━━━━━━━━━
* ข้อกำหนดสำคัญ:
1. การอนุมัตินี้เป็นการอนุมัติสินเชื่อเบื้องต้น
2. กรุณานำบัตรประชาชนตัวจริงมาแสดง ณ วันรับมอบรถและทำสัญญาเช่าซื้อ
3. ผลอนุมัติมีผลใช้ได้ภายใน 30 วันนับจากวันที่อนุมัติ`;

    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      triggerHaptic('success');
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // fallback
    }
  };

  // Render the official Provisional Approval Certificate Document
  const renderApprovalDocument = (isExport = false) => (
    <div
      style={{
        width: '780px',
        backgroundColor: '#ffffff',
        padding: '30px 36px',
        boxSizing: 'border-box',
        fontFamily: "'Prompt', -apple-system, BlinkMacSystemFont, sans-serif",
        color: '#0f172a',
        position: 'relative',
        border: isExport ? 'none' : '1px solid #cbd5e1',
        boxShadow: isExport ? 'none' : '0 10px 25px -5px rgba(0,0,0,0.08)',
      }}
    >
      {/* Decorative Guilloche Security Border Trim */}
      <div
        style={{
          border: '2px solid #1C449C',
          borderRadius: '16px',
          padding: '24px 26px',
          position: 'relative',
          backgroundColor: '#ffffff',
        }}
      >
        {/* Top Header Row: Next Capital Logo & Company Details */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: '16px',
            borderBottom: '2px solid #e2e8f0',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '60px',
                height: '60px',
                backgroundColor: '#ffffff',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1.5px solid #1C449C',
                boxShadow: '0 2px 4px rgba(28, 68, 156, 0.08)',
                flexShrink: 0,
              }}
            >
              <NextCapitalLogo size={46} />
            </div>
            <div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: '800',
                  color: '#1C449C',
                  lineHeight: '1.3',
                  letterSpacing: '-0.02em',
                }}
              >
                บริษัท เน็กซ์ แคปปิตอล จำกัด (มหาชน)
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: '#475569',
                  fontWeight: '500',
                  lineHeight: '1.35',
                  marginTop: '1px',
                }}
              >
                NEXT CAPITAL PUBLIC COMPANY LIMITED • เลขประจำตัวผู้เสียภาษี 0107563000289
              </div>
              <div
                style={{
                  fontSize: '10.5px',
                  color: '#64748b',
                  lineHeight: '1.35',
                }}
              >
                ศูนย์บริการสินเชื่อเช่าซื้อรถจักรยานยนต์ • โทร. 02-117-5999 www.nextcapital.co.th
              </div>
            </div>
          </div>

          {/* Reference and Approved Status Seal */}
          <div
            style={{
              textAlign: 'right',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#ecfdf5',
                border: '1.5px solid #10b981',
                borderRadius: '9999px',
                padding: '4px 12px',
                marginBottom: '6px',
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '9999px',
                  backgroundColor: '#059669',
                }}
              />
              <span
                style={{
                  color: '#065f46',
                  fontSize: '11.5px',
                  fontWeight: '800',
                  letterSpacing: '0.03em',
                }}
              >
                ผ่านการอนุมัติ (APPROVED)
              </span>
            </div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: '700',
                color: '#1e293b',
              }}
            >
              เลขที่: {docNumber}
            </div>
            <div
              style={{
                fontSize: '10.5px',
                color: '#64748b',
                marginTop: '1px',
              }}
            >
              วันที่อนุมัติ: {formattedApprovalDate}
            </div>
          </div>
        </div>

        {/* Certificate Title Banner */}
        <div
          style={{
            marginTop: '16px',
            marginBottom: '16px',
            textAlign: 'center',
            backgroundColor: 'linear-gradient(135deg, #1C449C 0%, #0f172a 100%)',
            background: '#1C449C',
            borderRadius: '12px',
            padding: '12px 16px',
            color: '#ffffff',
            boxShadow: '0 4px 6px -1px rgba(28, 68, 156, 0.15)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              fontSize: '17px',
              fontWeight: '800',
              letterSpacing: '0.01em',
              lineHeight: '1.3',
            }}
          >
            หนังสือแจ้งผลการอนุมัติสินเชื่อเช่าซื้อรถจักรยานยนต์ (เบื้องต้น)
          </div>
          <div
            style={{
              fontSize: '10.5px',
              color: '#cbd5e1',
              fontWeight: '500',
              letterSpacing: '0.06em',
              marginTop: '2px',
            }}
          >
            PROVISIONAL HIRE PURCHASE CREDIT APPROVAL CERTIFICATE
          </div>
        </div>

        {/* Two-Column Information Cards: Customer & Motorcycle */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '14px',
            marginBottom: '14px',
          }}
        >
          {/* Column 1: Customer Details */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '14px 16px',
              fontSize: '11.5px',
            }}
          >
            <div
              style={{
                fontSize: '11.5px',
                fontWeight: '800',
                color: '#1C449C',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderBottom: '1px dashed #cbd5e1',
                paddingBottom: '5px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              <span>👤 ข้อมูลผู้ขอสินเชื่อ / ผู้เช่าซื้อ</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: '#64748b' }}>ชื่อ-นามสกุล:</span>
              <span style={{ fontWeight: '700', color: '#0f172a' }}>{customerName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: '#64748b' }}>เบอร์โทรศัพท์:</span>
              <span style={{ fontWeight: '600', color: '#0f172a' }}>{customerPhone || '-'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: '#64748b' }}>ร้านผู้จำหน่าย:</span>
              <span style={{ fontWeight: '600', color: '#0f172a', textAlign: 'right', maxWidth: '210px' }}>
                {dealerName}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>เจ้าหน้าที่ตรวจสอบ:</span>
              <span style={{ fontWeight: '600', color: '#1C449C' }}>{officerNameAndCode}</span>
            </div>
          </div>

          {/* Column 2: Vehicle Details */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '14px 16px',
              fontSize: '11.5px',
            }}
          >
            <div
              style={{
                fontSize: '11.5px',
                fontWeight: '800',
                color: '#1C449C',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderBottom: '1px dashed #cbd5e1',
                paddingBottom: '5px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              <span>🛵 ข้อมูลรถจักรยานยนต์ที่ได้รับอนุมัติ</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: '#64748b' }}>ยี่ห้อ / รุ่นรถ:</span>
              <span style={{ fontWeight: '700', color: '#0f172a', textAlign: 'right' }}>{modelName}</span>
            </div>
            {modelCodeState && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748b' }}>รหัสรุ่น:</span>
                <span style={{ fontWeight: '600', color: '#475569' }}>{modelCodeState}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: '#64748b' }}>ราคารถเงินสด:</span>
              <span style={{ fontWeight: '700', color: '#0f172a' }}>{formatBaht(vehiclePrice)} บาท</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>แผนสินเชื่อ:</span>
              <span style={{ fontWeight: '600', color: '#1C449C' }}>
                {proposalName} ({proposalCode})
              </span>
            </div>
          </div>
        </div>

        {/* HERO CARD: Approved Monthly Installment Banner */}
        <div
          style={{
            backgroundColor: '#f0fdf4',
            border: '2px solid #86efac',
            borderRadius: '14px',
            padding: '16px 20px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 2px 5px rgba(16, 185, 129, 0.08)',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: '700',
                color: '#065f46',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>🌟 ค่างวดเช่าซื้อที่ได้รับอนุมัติ (รวม VAT 7% แล้ว)</span>
            </div>
            <div
              style={{
                fontSize: '11px',
                color: '#047857',
                marginTop: '2px',
              }}
            >
              ระยะเวลาผ่อนชำระ {term} งวด ({formatTermYearMonth(term)}) • ชำระทุกวันที่ 2 ของทุกเดือน
            </div>
          </div>
          <div
            style={{
              textAlign: 'right',
            }}
          >
            <div
              style={{
                fontSize: '26px',
                fontWeight: '900',
                color: '#047857',
                letterSpacing: '-0.03em',
                lineHeight: '1',
              }}
            >
              {formatBaht(monthlyInstallment)}
              <span style={{ fontSize: '14px', fontWeight: '700', marginLeft: '4px', color: '#065f46' }}>
                บ./ด.
              </span>
            </div>
            <div
              style={{
                fontSize: '10px',
                color: '#059669',
                fontWeight: '600',
                marginTop: '2px',
              }}
            >
              งวดแรกครบกำหนด: {firstDueInfo.formattedShort}
            </div>
          </div>
        </div>

        {/* Approved Credit Terms Table */}
        <div
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            overflow: 'hidden',
            marginBottom: '16px',
            fontSize: '11.5px',
          }}
        >
          <div
            style={{
              backgroundColor: '#f1f5f9',
              padding: '8px 14px',
              fontWeight: '800',
              color: '#1e293b',
              fontSize: '12px',
              borderBottom: '1px solid #e2e8f0',
            }}
          >
            📋 รายละเอียดเงื่อนไขสัญญาเช่าซื้อที่ได้รับการอนุมัติ
          </div>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              tableLayout: 'fixed',
              fontSize: '11px',
            }}
          >
            <colgroup>
              <col style={{ width: '18%' }} />
              <col style={{ width: '32%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '32%' }} />
            </colgroup>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '8px 10px', color: '#64748b', whiteSpace: 'nowrap' }}>เงินดาวน์ที่อนุมัติ:</td>
                <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap' }}>
                  {formatBaht(downAmount)} บาท ({downPercent.toFixed(1)}%)
                </td>
                <td style={{ padding: '8px 10px', color: '#64748b', whiteSpace: 'nowrap' }}>ยอดจัดสินเชื่อรวม:</td>
                <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap' }}>
                  {formatBaht(financeAmount, true)} บาท
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#fafafa' }}>
                <td style={{ padding: '8px 10px', color: '#64748b', whiteSpace: 'nowrap' }}>อัตราดอกเบี้ย:</td>
                <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', fontSize: cleanRateText.length > 30 ? '10px' : '11px' }}>
                  {cleanRateText}
                </td>
                <td style={{ padding: '8px 10px', color: '#64748b', whiteSpace: 'nowrap' }}>ระยะเวลาสัญญา:</td>
                <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap' }}>
                  {term} งวด ({formatTermYearMonth(term)})
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '8px 10px', color: '#64748b', whiteSpace: 'nowrap' }}>ประกันภัยคุ้มครอง:</td>
                <td style={{ padding: '8px 10px', fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap' }}>
                  {displayInsurancePlan}
                </td>
                <td style={{ padding: '8px 10px', color: '#64748b', whiteSpace: 'nowrap' }}>กำหนดชำระค่างวด:</td>
                <td style={{ padding: '8px 10px', fontWeight: '700', color: '#1C449C', whiteSpace: 'nowrap' }}>
                  ทุกวันที่ 2 ของทุกเดือน
                </td>
              </tr>
              <tr style={{ backgroundColor: '#fafafa' }}>
                <td style={{ padding: '8px 10px', color: '#64748b', whiteSpace: 'nowrap' }}>กำหนดชำระงวดแรก:</td>
                <td style={{ padding: '8px 10px', fontWeight: '700', color: '#1C449C', whiteSpace: 'nowrap' }}>
                  {firstDueInfo.formattedLong}
                </td>
                <td style={{ padding: '8px 10px', color: '#64748b', whiteSpace: 'nowrap' }}>อายุผลอนุมัติ:</td>
                <td style={{ padding: '8px 10px', fontWeight: '700', color: '#b45309', whiteSpace: 'nowrap' }}>
                  ถึง {formattedExpiryDate} (30 วัน)
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Important Terms and Conditions Note */}
        <div
          style={{
            backgroundColor: '#f8fafc',
            border: '1px dashed #cbd5e1',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '10px',
            color: '#475569',
            lineHeight: '1.5',
            marginBottom: '18px',
          }}
        >
          <div style={{ fontWeight: '800', color: '#1e293b', marginBottom: '2px' }}>
            ข้อกำหนดและเงื่อนไขการอนุมัติเบื้องต้น:
          </div>
          <div>1. เอกสารฉบับนี้เป็นการแจ้งผลการพิจารณาอนุมัติสินเชื่อเบื้องต้น (Provisional Approval) ภายใต้เกณฑ์พิจารณาของ บมจ. เน็กซ์ แคปปิตอล</div>
          <div>2. กรุณานำบัตรประจำตัวประชาชนตัวจริงมาแสดงต่อตัวแทนจำหน่ายในวันรับมอบรถและลงนามในสัญญาเช่าซื้อฉบับจริง</div>
          <div>3. ผลการอนุมัติสินเชื่อนี้มีผลใช้ได้ภายใน 30 วันนับแต่วันที่ระบุในหนังสือ หากพ้นกำหนดระยะเวลาดังกล่าว ถือว่าผลอนุมัติเป็นอันสิ้นสุด</div>
        </div>

        {/* Signatures Footer */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '24px',
            alignItems: 'flex-end',
            paddingTop: '12px',
          }}
        >
          {/* Officer Signature */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '24px' }}>
              ลงชื่อ ................................................................
            </div>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#0f172a' }}>
              ( {officerNameAndCode} )
            </div>
            <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>
              เจ้าหน้าที่ตรวจสอบสินเชื่อ
            </div>
            <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '1px' }}>
              บริษัท เน็กซ์ แคปปิตอล จำกัด (มหาชน)
            </div>
          </div>

          {/* Customer Signature Acceptance */}
          <div
            style={{
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '24px' }}>
              ลงชื่อ ................................................................
            </div>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#0f172a' }}>
              ( {customerName} )
            </div>
            <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>
              ผู้ขอสินเชื่อ / ผู้เช่าซื้อที่ได้รับอนุมัติ
            </div>
            <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>
              วันที่ ............. / ............. / .............
            </div>
          </div>
        </div>

        {/* Security watermark footer */}
        <div
          style={{
            marginTop: '16px',
            paddingTop: '8px',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '9px',
            color: '#94a3b8',
          }}
        >
          <span>เอกสารระบบดิจิทัล Next Capital MotoLease • อ้างอิง {docNumber}</span>
          <span>สร้างเมื่อ {new Date().toLocaleDateString('th-TH')}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-xs animate-fade-in overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[96vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden relative print:border-none print:shadow-none print:max-w-none print:max-h-none print:w-full">
        {/* Top Specular Accent Sheen */}
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-600 opacity-95 print:hidden" />

        {/* Modal Header Toolbar */}
        <div className="p-3.5 sm:p-5 pb-3 border-b border-emerald-100 flex items-center justify-between gap-3 bg-gradient-to-b from-emerald-50/90 via-teal-50/30 to-white shrink-0 print:hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
              <FileCheck className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-slate-900 truncate flex items-center gap-1.5">
                <span>ใบแจ้งผลการอนุมัติสินเชื่อ (ชั่วคราว)</span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Provisional Approval
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 truncate">
                สำหรับส่งให้ลูกค้าหรือตัวแทนจำหน่ายเพื่อเตรียมรับรถ • {customerName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Zoom Toggle */}
            <div className="hidden xs:inline-flex rounded-xl p-0.5 bg-slate-100 text-xs font-bold gap-0.5 border border-slate-200">
              <button
                type="button"
                onClick={() => setZoomMode('fit')}
                className={`px-2 py-1 rounded-lg text-[10.5px] cursor-pointer transition-colors ${
                  zoomMode === 'fit'
                    ? 'bg-white text-emerald-800 shadow-2xs font-black'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                พอดีจอ
              </button>
              <button
                type="button"
                onClick={() => setZoomMode('100')}
                className={`px-2 py-1 rounded-lg text-[10.5px] cursor-pointer transition-colors ${
                  zoomMode === '100'
                    ? 'bg-white text-emerald-800 shadow-2xs font-black'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                100%
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="ปิดหน้าต่าง"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Quick Edit Bar */}
        <div className="px-3.5 sm:px-5 py-2.5 bg-slate-50/80 border-b border-slate-200/70 flex items-center justify-between gap-2 flex-wrap text-xs shrink-0 print:hidden">
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  onUpdateCustomer?.(e.target.value, customerPhone);
                }}
                placeholder="ชื่อลูกค้า"
                className="w-32 sm:w-40 font-bold text-slate-800 text-xs focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => {
                  setCustomerPhone(e.target.value);
                  onUpdateCustomer?.(customerName, e.target.value);
                }}
                placeholder="เบอร์โทร"
                className="w-24 sm:w-28 font-medium text-slate-800 text-xs focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={dealerName}
                onChange={(e) => setDealerName(e.target.value)}
                placeholder="ชื่อตัวแทนจำหน่าย"
                className="w-36 sm:w-48 font-medium text-slate-800 text-xs focus:outline-none"
              />
            </div>
          </div>

          {/* Action Buttons in Toolbar */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Copy Text Summary */}
            <button
              type="button"
              onClick={handleCopyChatText}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
              title="คัดลอกข้อความสรุปผลอนุมัติสำหรับส่งใน LINE"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-emerald-600" />}
              <span>{copied ? 'คัดลอกแล้ว!' : 'คัดลอก LINE'}</span>
            </button>

            {/* Print / Save PDF */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
              title="พิมพ์เอกสาร หรือบันทึกเป็น PDF"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">พิมพ์/PDF</span>
            </button>

            {/* Download Image Button */}
            <button
              type="button"
              onClick={handleDownloadImage}
              disabled={isGeneratingImage}
              className="px-3 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm shadow-emerald-600/25 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              title="ดาวน์โหลดเป็นรูปภาพความละเอียดสูง (PNG 2x) ส่งต่อได้ทันที"
            >
              {isGeneratingImage ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>กำลังสร้างรูปภาพ...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>ดาวน์โหลดรูปภาพ</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Success Toast */}
        {imageSuccessMessage && (
          <div className="p-2 text-center bg-emerald-50 border-b border-emerald-200 text-xs font-bold text-emerald-800 animate-fade-in flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{imageSuccessMessage}</span>
          </div>
        )}

        {/* Scrollable Preview Workspace Container */}
        <div
          ref={previewContainerRef}
          className="flex-1 overflow-y-auto p-2 sm:p-4 bg-slate-100/90 flex justify-center items-start print:p-0 print:bg-white print:overflow-visible"
        >
          {/* Zoom & Centering Container */}
          <div
            style={{
              width: zoomMode === '100' ? '780px' : '100%',
              maxWidth: '780px',
              height: zoomMode === 'fit' && previewScale < 1 ? `${previewHeight * previewScale + 20}px` : 'auto',
              display: 'flex',
              justifyContent: 'center',
            }}
            className="print:w-full print:max-w-none print:h-auto"
          >
            <div
              ref={previewDocRef}
              style={{
                transform: zoomMode === 'fit' && previewScale < 1 ? `scale(${previewScale})` : 'none',
                transformOrigin: 'top center',
                transition: 'transform 0.15s ease-out',
              }}
              className="print:transform-none"
            >
              {renderApprovalDocument(false)}
            </div>
          </div>
        </div>

        {/* Hidden Export Template rendered at pristine unscaled 780px for exportImage */}
        <div
          style={{
            position: 'absolute',
            left: '-9999px',
            top: 0,
            width: '780px',
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          <div ref={exportTemplateRef}>
            {renderApprovalDocument(true)}
          </div>
        </div>
      </div>
    </div>
  );
};
