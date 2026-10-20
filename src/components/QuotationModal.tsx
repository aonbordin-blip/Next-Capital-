import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Check,
  FileText,
  Share2,
  Calendar,
  User,
  Download,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { CalculationResult } from '../types';
import { formatBaht, cleanPlanNameForLine, formatTermYearMonth } from '../data/proposals';
import { findModelByCode } from '../data/motorcycleModels';
import { NextCapitalLogo } from './NextCapitalLogo';
import { downloadElementAsImage } from '../utils/exportImage';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  result: CalculationResult;
  selectedBikeName?: string;
  modelCode?: string;
  officerInfo?: string;
  initialCustomerName?: string;
  initialCustomerPhone?: string;
  onUpdateCustomer?: (name: string, phone: string) => void;
}

export const QuotationModal: React.FC<Props> = ({
  isOpen,
  onClose,
  result,
  selectedBikeName,
  modelCode = '',
  officerInfo = 'บดินทร์ (6683)',
  initialCustomerName = 'คุณลูกค้า',
  initialCustomerPhone = '',
  onUpdateCustomer,
}) => {
  const [dealerName, setDealerName] = useState<string>(
    'บริษัท เน็กซ์ แคปปิตอล จำกัด (มหาชน)'
  );
  const [officerNameAndCode, setOfficerNameAndCode] = useState<string>(officerInfo);

  // Find model name matching model code if available
  const getModelNameByCode = (code: string): string | null => {
    if (!code || !code.trim()) return null;
    const found = findModelByCode(code);
    return found ? found.name : null;
  };

  const initialModelName =
    selectedBikeName && selectedBikeName !== 'รถจักรยานยนต์'
      ? selectedBikeName
      : getModelNameByCode(modelCode) || selectedBikeName || 'รถจักรยานยนต์';

  const [customerName, setCustomerName] = useState<string>(initialCustomerName || 'คุณลูกค้า');
  const [customerPhone, setCustomerPhone] = useState<string>(initialCustomerPhone || '');
  const [modelName, setModelName] = useState<string>(initialModelName);
  const [modelCodeState, setModelCodeState] = useState<string>(modelCode ? modelCode.toUpperCase() : '');

  // Keep officer, customer name and phone in sync with prop updates
  useEffect(() => {
    if (officerInfo) {
      setOfficerNameAndCode(officerInfo);
    }
  }, [officerInfo]);

  useEffect(() => {
    if (modelCode !== undefined) {
      const upper = modelCode.toUpperCase();
      setModelCodeState(upper);
      const matchedName = getModelNameByCode(upper);
      if (matchedName) {
        setModelName(matchedName);
      }
    }
  }, [modelCode]);

  useEffect(() => {
    if (selectedBikeName && selectedBikeName !== 'รถจักรยานยนต์') {
      setModelName(selectedBikeName);
    } else if (modelCode) {
      const matchedName = getModelNameByCode(modelCode);
      if (matchedName) {
        setModelName(matchedName);
      }
    }
  }, [selectedBikeName, modelCode]);

  useEffect(() => {
    if (initialCustomerName) {
      setCustomerName(initialCustomerName);
    }
  }, [initialCustomerName]);

  useEffect(() => {
    if (initialCustomerPhone !== undefined) {
      setCustomerPhone(initialCustomerPhone);
    }
  }, [initialCustomerPhone]);

/**
 * สร้างเลขที่เอกสารจากวันเดือนปีเวลาที่ทำรายการ ไม่เอาวินาที
 * รูปแบบ: วว ดด ปป(2 หลัก) ชช(24ชม) นน เช่น 2010262026
 */
const generateQuotationDocNumber = (date: Date = new Date()): string => {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${dd}${mm}${yy}${hh}${min}`;
};

  const [docNumber, setDocNumber] = useState<string>(() => generateQuotationDocNumber());

  useEffect(() => {
    if (isOpen) {
      setDocNumber(generateQuotationDocNumber());
    }
  }, [isOpen]);

  const [quotationDate] = useState<string>(
    new Date().toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  );
  const [copied, setCopied] = useState<boolean>(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);
  const [imageSuccessMessage, setImageSuccessMessage] = useState<string | null>(null);

  // Scaling & Responsive Viewport Refs
  const exportTemplateRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const previewDocRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState<number>(1);
  const [previewHeight, setPreviewHeight] = useState<number>(1200);
  const [zoomMode, setZoomMode] = useState<'fit' | '100'>('fit');

  // Auto-scale preview to fit screen perfectly on mobile devices (matching InsuranceDocModal)
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
  }, [isOpen, customerName, customerPhone, officerNameAndCode, dealerName, modelName, result]);

  if (!isOpen) return null;

  // Direct In-Browser High-Quality Image (PNG) Generation matching the displayed preview 100%
  const handleDownloadImage = async () => {
    if (!exportTemplateRef.current || isGeneratingImage) return;
    setIsGeneratingImage(true);
    setImageSuccessMessage(null);

    try {
      const cleanModelName = (modelName || 'รถจักรยานยนต์').replace(/\s+/g, '_');
      const fileName = `ใบเสนอราคา_${docNumber}_${cleanModelName}_NextCapital.png`;
      await downloadElementAsImage(exportTemplateRef.current, fileName, 780);

      setImageSuccessMessage('ดาวน์โหลดรูปภาพใบเสนอราคาเรียบร้อยแล้ว!');
      setTimeout(() => setImageSuccessMessage(null), 3500);
    } catch (err) {
      console.error('Failed to generate image:', err);
      alert('เกิดข้อผิดพลาดในการสร้างรูปภาพ: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleCopyChatText = async () => {
    const cleanInsuranceName = cleanPlanNameForLine(result.insurancePlanName);

    const summary = `📄 ใบเสนอราคาเช่าซื้อรถจักรยานยนต์
🔢 เลขที่เอกสาร: ${docNumber}
🏢 ${dealerName}
━━━━━━━━━━━━━━━━━━━━
👨‍💼 ผู้เสนอราคา: ${officerNameAndCode}
👤 ลูกค้า: ${customerName}${customerPhone ? ` (${customerPhone})` : ''}
🛵 รุ่นรถ: ${modelName}
${modelCodeState ? `🏷️ รหัสรุ่น: ${modelCodeState}\n` : ''}💰 ราคารถ: ${formatBaht(result.vehiclePrice)}
💰 เงินดาวน์: ${formatBaht(result.downAmount)} (${result.downPercent.toFixed(1)}%)
🛵 ยอดจัดเฉพาะตัวรถ: ${formatBaht(result.vehicleFinanceAmount)}
${
  result.insuranceTotalWithVat > 0
    ? `🛡️ ประกันภัย: ${cleanInsuranceName}
   • ค่าเบี้ยประกัน: ${formatBaht(result.insuranceBasePremium)}
   • ภาษี VAT 7%: ${formatBaht(result.insuranceVat, true)}
   • ค่าเบี้ยรวมภาษี 7%: ${formatBaht(result.insuranceTotalWithVat, true)}\n`
    : ''
}💳 ยอดจัดไฟแนนซ์รวม: ${formatBaht(result.financeAmount, true)}
📊 ข้อเสนอ: ${result.proposalName} (${result.proposalCode})
⏱️ ระยะเวลาผ่อน: ${result.term} งวด (${formatTermYearMonth(result.term)})
📈 อัตราดอกเบี้ย: ${result.rateDisplayText}
${result.isCappedByEir ? `⚖️ ควบคุมดอกเบี้ย: ${result.eirMaxMessage} (ตามเกณฑ์ สคบ. EIR ไม่เกิน 23% ต่อปี)\n` : ''}💵 ดอกเบี้ยต่อเดือน: ${formatBaht(result.monthlyInterest, true)} /เดือน
💵 ดอกเบี้ยรวมทั้งสัญญา: ${formatBaht(result.totalInterest, true)}

✨ ค่างวดต่อเดือน: ${formatBaht(result.monthlyInstallment)} /เดือน
(รวมภาษีมูลค่าเพิ่ม 7% เรียบร้อยแล้ว)
━━━━━━━━━━━━━━━━━━━━
💵 สรุปค่าใช้จ่ายสัญญา:
• ยอดรวมทั้งสัญญา: ${formatBaht(result.totalWithVat, true)}
• มูลค่าก่อน VAT: ${formatBaht(result.totalBeforeVat, true)}
• ภาษีมูลค่าเพิ่ม VAT 7%: ${formatBaht(result.vatAmount, true)}
${
  result.totalDriveAwayCost > result.downAmount
    ? `• เงินพร้อมออกรถสุทธิ: ${formatBaht(result.totalDriveAwayCost)}`
    : ''
}

* ยอดจริงอาจมีการเปลี่ยนแปลงตามผลการอนุมัติสินเชื่อ Next Capital
(เอกสารนี้เป็นเพียงการจำลองคำนวณค่างวดเบื้องต้นเพื่อประกอบการตัดสินใจ)`;

    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // fallback
    }
  };

  const cleanInsuranceName = cleanPlanNameForLine(result.insurancePlanName);

  // Render the exact, beautifully balanced quotation document matching Image 2
  const renderQuotationDocument = (isExport = false) => (
    <div
      style={{
        width: '780px',
        backgroundColor: '#ffffff',
        padding: '28px 34px',
        boxSizing: 'border-box',
        fontFamily: "'Prompt', -apple-system, BlinkMacSystemFont, sans-serif",
        color: '#1e293b',
      }}
    >
      {/* Header */}
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
              width: '54px',
              height: '54px',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              flexShrink: 0,
            }}
          >
            <NextCapitalLogo size={42} />
          </div>
          <div>
            <div
              style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#0f172a',
                lineHeight: '1.35',
                marginBottom: '2px',
              }}
            >
              {dealerName || 'ศูนย์บริการ / ตัวแทนจำหน่าย'}
            </div>
            <div
              style={{
                fontSize: '12px',
                color: '#475569',
                fontWeight: '500',
                lineHeight: '1.35',
              }}
            >
              ใบเสนอราคาเช่าซื้อรถจักรยานยนต์ (Hire Purchase Quotation)
            </div>
          </div>
        </div>
        <div
          style={{
            textAlign: 'right',
            fontSize: '12px',
            color: '#475569',
            lineHeight: '1.4',
            flexShrink: 0,
          }}
        >
          <div style={{ fontWeight: '600', color: '#1e293b', marginBottom: '3px' }}>
            เลขที่เอกสาร: {docNumber}
          </div>
          <div style={{ color: '#64748b' }}>
            วันที่: {quotationDate}
          </div>
        </div>
      </div>

      {/* Customer & Vehicle Info Cards - Symmetrical 2 Columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          backgroundColor: '#f8fafc',
          padding: '16px 18px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          fontSize: '12px',
          marginTop: '16px',
          marginBottom: '16px',
        }}
      >
        {/* Customer Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
          <div
            style={{
              fontWeight: 'bold',
              color: '#1e293b',
              fontSize: '12px',
              paddingBottom: '2px',
            }}
          >
            ข้อมูลลูกค้า & ผู้เสนอราคา
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#64748b', lineHeight: '1.4' }}>ชื่อลูกค้า:</span>
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '0 12px',
                fontWeight: '600',
                color: '#0f172a',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                lineHeight: '1.4',
                boxSizing: 'border-box',
              }}
            >
              {customerName || 'คุณลูกค้า'}
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#64748b', lineHeight: '1.4' }}>เบอร์โทรศัพท์:</span>
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '0 12px',
                color: '#0f172a',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                lineHeight: '1.4',
                boxSizing: 'border-box',
              }}
            >
              {customerPhone || '-'}
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#64748b', lineHeight: '1.4' }}>ผู้เสนอราคา:</span>
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '0 12px',
                fontWeight: '600',
                color: '#1e40af',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                lineHeight: '1.4',
                boxSizing: 'border-box',
              }}
            >
              {officerNameAndCode || 'บดินทร์ (6683)'}
            </div>
          </div>
        </div>

        {/* Vehicle & Proposal Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
          <div
            style={{
              fontWeight: 'bold',
              color: '#1e293b',
              fontSize: '12px',
              paddingBottom: '2px',
            }}
          >
            ข้อมูลยานพาหนะและเงื่อนไข
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#64748b', lineHeight: '1.4' }}>รุ่นรถ:</span>
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '0 12px',
                fontWeight: 'bold',
                color: '#1d4ed8',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                lineHeight: '1.4',
                boxSizing: 'border-box',
              }}
            >
              {modelName || 'รถจักรยานยนต์'}
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#64748b', lineHeight: '1.4' }}>รหัสรุ่น:</span>
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '0 12px',
                color: '#0f172a',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                fontFamily: 'monospace',
                fontWeight: '600',
                lineHeight: '1.4',
                boxSizing: 'border-box',
              }}
            >
              {modelCodeState || '-'}
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#64748b', lineHeight: '1.4' }}>รหัสข้อเสนอ:</span>
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '0 12px',
                color: '#0f172a',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                fontFamily: 'monospace',
                fontWeight: '600',
                lineHeight: '1.4',
                boxSizing: 'border-box',
              }}
            >
              {result.proposalCode || '-'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Breakdown Table - Exact Alignment & Structure matching Image 2 */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '12px',
          marginBottom: '16px',
        }}
      >
        <thead>
          <tr
            style={{
              backgroundColor: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              borderBottom: '1px solid #e2e8f0',
            }}
          >
            <th
              style={{
                padding: '9px 16px',
                textAlign: 'left',
                fontWeight: 'bold',
                color: '#1e293b',
              }}
            >
              รายการ
            </th>
            <th
              style={{
                padding: '9px 16px',
                textAlign: 'right',
                fontWeight: 'bold',
                color: '#1e293b',
                width: '190px',
              }}
            >
              จำนวนเงิน (บาท)
            </th>
          </tr>
        </thead>
        <tbody>
          {/* 1. Base Vehicle Price */}
          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
            <td
              style={{
                padding: '11px 16px 13px 16px',
                color: '#334155',
                verticalAlign: 'middle',
                lineHeight: '1.4',
              }}
            >
              1. ราคารถตัวเปล่า (Base Vehicle Price)
            </td>
            <td
              style={{
                padding: '11px 16px 13px 16px',
                textAlign: 'right',
                fontWeight: 'bold',
                color: '#0f172a',
                verticalAlign: 'middle',
                lineHeight: '1.4',
              }}
            >
              {formatBaht(result.vehiclePrice)}
            </td>
          </tr>

          {/* 2. Down Payment */}
          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
            <td
              style={{
                padding: '11px 16px 13px 16px',
                color: '#334155',
                verticalAlign: 'middle',
                lineHeight: '1.4',
              }}
            >
              2. เงินดาวน์ (Down Payment) ({result.downPercent.toFixed(1)}%)
            </td>
            <td
              style={{
                padding: '11px 16px 13px 16px',
                textAlign: 'right',
                color: '#047857',
                fontWeight: 'bold',
                verticalAlign: 'middle',
                lineHeight: '1.4',
              }}
            >
              - {formatBaht(result.downAmount)}
            </td>
          </tr>

          {/* 3. Vehicle Finance Amount */}
          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
            <td
              style={{
                padding: '11px 16px 13px 16px',
                fontWeight: '600',
                color: '#1e293b',
                verticalAlign: 'middle',
                lineHeight: '1.4',
              }}
            >
              3. ยอดจัดเฉพาะตัวรถ (Vehicle Finance Amount)
            </td>
            <td
              style={{
                padding: '11px 16px 13px 16px',
                textAlign: 'right',
                fontWeight: 'bold',
                color: '#0f172a',
                verticalAlign: 'middle',
                lineHeight: '1.4',
              }}
            >
              {formatBaht(result.vehicleFinanceAmount)}
            </td>
          </tr>

          {/* Insurance Breakdown if included */}
          {result.insuranceTotalWithVat > 0 && (
            <>
              <tr style={{ borderBottom: '1px solid #f8fafc', backgroundColor: '#fcfdfd' }}>
                <td
                  style={{
                    padding: '8px 16px 8px 32px',
                    color: '#1d4ed8',
                    fontSize: '11.5px',
                    verticalAlign: 'middle',
                    lineHeight: '1.4',
                  }}
                >
                  • ค่าเบี้ยประกันภัย PA ({cleanInsuranceName})
                </td>
                <td
                  style={{
                    padding: '8px 16px',
                    textAlign: 'right',
                    color: '#1d4ed8',
                    fontSize: '11.5px',
                    verticalAlign: 'middle',
                    lineHeight: '1.4',
                  }}
                >
                  +{formatBaht(result.insuranceBasePremium)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f8fafc', backgroundColor: '#fcfdfd' }}>
                <td
                  style={{
                    padding: '8px 16px 8px 32px',
                    color: '#1d4ed8',
                    fontSize: '11.5px',
                    verticalAlign: 'middle',
                    lineHeight: '1.4',
                  }}
                >
                  • ภาษีมูลค่าเพิ่ม 7% ของค่าเบี้ยประกัน
                </td>
                <td
                  style={{
                    padding: '8px 16px',
                    textAlign: 'right',
                    color: '#1d4ed8',
                    fontSize: '11.5px',
                    verticalAlign: 'middle',
                    lineHeight: '1.4',
                  }}
                >
                  +{formatBaht(result.insuranceVat, true)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#f0fdf4' }}>
                <td
                  style={{
                    padding: '9px 16px 10px 24px',
                    color: '#1d4ed8',
                    fontWeight: '600',
                    fontSize: '11.5px',
                    verticalAlign: 'middle',
                    lineHeight: '1.4',
                  }}
                >
                  + ค่าเบี้ยประกันรวมภาษี 7% (Insurance with VAT)
                </td>
                <td
                  style={{
                    padding: '9px 16px 10px 16px',
                    textAlign: 'right',
                    color: '#1d4ed8',
                    fontWeight: 'bold',
                    fontSize: '11.5px',
                    verticalAlign: 'middle',
                    lineHeight: '1.4',
                  }}
                >
                  +{formatBaht(result.insuranceTotalWithVat, true)}
                </td>
              </tr>
            </>
          )}

          {/* 4. Total Finance Amount */}
          <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#eff6ff' }}>
            <td
              style={{
                padding: '12px 16px 14px 16px',
                fontWeight: 'bold',
                color: '#1e40af',
                verticalAlign: 'middle',
                lineHeight: '1.4',
              }}
            >
              4. ยอดจัดไฟแนนซ์รวม (Total Finance Amount)
            </td>
            <td
              style={{
                padding: '12px 16px 14px 16px',
                textAlign: 'right',
                fontWeight: 'bold',
                color: '#1e40af',
                fontSize: '13px',
                verticalAlign: 'middle',
                lineHeight: '1.4',
              }}
            >
              {formatBaht(result.financeAmount, true)}
            </td>
          </tr>

          {/* 5. Interest Rate */}
          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
            <td
              style={{
                padding: '11px 16px 13px 16px',
                color: '#334155',
                verticalAlign: 'middle',
                lineHeight: '1.4',
              }}
            >
              5. อัตราดอกเบี้ย ({result.rateDisplayText})
            </td>
            <td
              style={{
                padding: '11px 16px 13px 16px',
                textAlign: 'right',
                fontWeight: 'bold',
                color: '#1d4ed8',
                verticalAlign: 'middle',
                lineHeight: '1.4',
              }}
            >
              {result.rateDisplayText}
            </td>
          </tr>

          {/* 6. Monthly Interest */}
          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
            <td
              style={{
                padding: '11px 16px 13px 16px',
                color: '#334155',
                verticalAlign: 'middle',
                lineHeight: '1.4',
              }}
            >
              6. ดอกเบี้ยรายเดือน (Monthly Interest)
            </td>
            <td
              style={{
                padding: '11px 16px 13px 16px',
                textAlign: 'right',
                verticalAlign: 'middle',
                lineHeight: '1.4',
              }}
            >
              {formatBaht(result.monthlyInterest, true)}
            </td>
          </tr>

          {/* 7. Total Interest */}
          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
            <td
              style={{
                padding: '11px 16px 13px 16px',
                color: '#334155',
                verticalAlign: 'middle',
                lineHeight: '1.4',
              }}
            >
              7. ดอกเบี้ยรวมทั้งสัญญา ({result.term} งวด)
            </td>
            <td
              style={{
                padding: '11px 16px 13px 16px',
                textAlign: 'right',
                verticalAlign: 'middle',
                lineHeight: '1.4',
              }}
            >
              {formatBaht(result.totalInterest, true)}
            </td>
          </tr>

          {/* 8. Total Contract Amount */}
          <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
            <td
              style={{
                padding: '11px 16px 13px 16px',
                fontWeight: '600',
                color: '#1e293b',
                verticalAlign: 'middle',
                lineHeight: '1.4',
              }}
            >
              8. ยอดรวมทั้งสัญญารวมดอกเบี้ย (Total Contract Amount)
            </td>
            <td
              style={{
                padding: '11px 16px 13px 16px',
                textAlign: 'right',
                fontWeight: 'bold',
                color: '#0f172a',
                verticalAlign: 'middle',
                lineHeight: '1.4',
              }}
            >
              {formatBaht(result.totalWithVat, true)}
            </td>
          </tr>

          {/* Sub-rows: before VAT & VAT */}
          <tr style={{ borderBottom: '1px solid #f8fafc' }}>
            <td
              style={{
                padding: '8px 16px 8px 32px',
                color: '#64748b',
                fontSize: '11.5px',
                verticalAlign: 'middle',
                lineHeight: '1.4',
              }}
            >
              • ยอดรวมก่อนภาษีมูลค่าเพิ่ม (Total before VAT)
            </td>
            <td
              style={{
                padding: '8px 16px',
                textAlign: 'right',
                color: '#64748b',
                fontSize: '11.5px',
                verticalAlign: 'middle',
                lineHeight: '1.4',
              }}
            >
              {formatBaht(result.totalBeforeVat, true)}
            </td>
          </tr>
          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
            <td
              style={{
                padding: '8px 16px 10px 32px',
                color: '#64748b',
                fontSize: '11.5px',
                verticalAlign: 'middle',
                lineHeight: '1.4',
              }}
            >
              • ภาษีมูลค่าเพิ่ม 7% (VAT 7%)
            </td>
            <td
              style={{
                padding: '8px 16px 10px 16px',
                textAlign: 'right',
                color: '#64748b',
                fontSize: '11.5px',
                verticalAlign: 'middle',
                lineHeight: '1.4',
              }}
            >
              {formatBaht(result.vatAmount, true)}
            </td>
          </tr>

          {/* Special Installment Row */}
          <tr style={{ backgroundColor: '#eff6ff', borderTop: '2px solid #bfdbfe' }}>
            <td
              style={{
                padding: '12px 16px 14px 16px',
                fontWeight: 'bold',
                color: '#1e40af',
                verticalAlign: 'middle',
                lineHeight: '1.4',
              }}
            >
              ค่างวดผ่อนชำระต่อเดือน (รวม VAT 7%)
            </td>
            <td
              style={{
                padding: '12px 16px 14px 16px',
                textAlign: 'right',
                fontWeight: 'bold',
                color: '#1d4ed8',
                fontSize: '14px',
                verticalAlign: 'middle',
                lineHeight: '1.4',
              }}
            >
              {formatBaht(result.monthlyInstallment)} /เดือน
            </td>
          </tr>
        </tbody>
      </table>

      {/* Prominent Monthly Installment Box - Matches Image 2 perfectly */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1d4ed8 0%, #312e81 100%)',
          color: '#ffffff',
          borderRadius: '14px',
          padding: '18px 24px',
          textAlign: 'center',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            fontSize: '13px',
            fontWeight: '600',
            color: '#e0e7ff',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '4px',
          }}
        >
          ค่างวดผ่อนชำระต่อเดือน (รวมภาษีมูลค่าเพิ่ม 7%)
        </div>
        <div
          style={{
            fontSize: '34px',
            fontWeight: '800',
            letterSpacing: '-0.5px',
            margin: '4px 0',
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <span>{formatBaht(result.monthlyInstallment)}</span>
          <span style={{ fontSize: '13px', fontWeight: 'normal', color: '#bfdbfe' }}>
            บาท / เดือน
          </span>
        </div>
        <div style={{ fontSize: '11px', color: '#bfdbfe', lineHeight: 1.2 }}>
          ระยะเวลาผ่อนชำระ: {result.term} งวด ( {formatTermYearMonth(result.term)} )
        </div>
      </div>

      {/* Delivery day expenses if applicable */}
      {(result.registrationFee > 0 || result.theftInsuranceFee > 0) && (
        <div
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px 16px',
            backgroundColor: '#f8fafc',
            fontSize: '12px',
            marginBottom: '16px',
            lineHeight: 1.4,
          }}
        >
          <div style={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '6px' }}>
            สรุปเงินเตรียมพร้อมออกรถ (วันรับรถ)
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              color: '#475569',
              marginBottom: '3px',
            }}
          >
            <span>• เงินดาวน์:</span>
            <span style={{ fontWeight: '500' }}>{formatBaht(result.downAmount)} บาท</span>
          </div>
          {result.registrationFee > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                color: '#475569',
                marginBottom: '3px',
              }}
            >
              <span>• ค่าจดทะเบียน + พ.ร.บ.:</span>
              <span style={{ fontWeight: '500' }}>{formatBaht(result.registrationFee)} บาท</span>
            </div>
          )}
          {result.theftInsuranceFee > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                color: '#475569',
                marginBottom: '3px',
              }}
            >
              <span>• ประกันรถหาย:</span>
              <span style={{ fontWeight: '500' }}>{formatBaht(result.theftInsuranceFee)} บาท</span>
            </div>
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 'bold',
              color: '#1d4ed8',
              paddingTop: '6px',
              borderTop: '1px solid #e2e8f0',
              marginTop: '4px',
              fontSize: '12px',
            }}
          >
            <span>รวมเงินที่ต้องชำระวันออกรถสุทธิ:</span>
            <span>{formatBaht(result.totalDriveAwayCost)} บาท</span>
          </div>
        </div>
      )}

      {/* Signature Footer - 2 Symmetrical Columns */}
      <div
        style={{
          paddingTop: '16px',
          borderTop: '1px solid #e2e8f0',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
          textAlign: 'center',
          fontSize: '11px',
          color: '#64748b',
          marginBottom: '12px',
        }}
      >
        <div>
          <div style={{ height: '36px' }} />
          <div
            style={{
              borderBottom: '1px dotted #94a3b8',
              width: '200px',
              margin: '0 auto 6px auto',
            }}
          />
          <div style={{ fontWeight: '600', color: '#1e293b' }}>
            ( {officerNameAndCode || 'บดินทร์ วงศ์หาโคตร (6683)'} )
          </div>
          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
            ผู้เสนอราคา / เจ้าหน้าที่
          </div>
        </div>
        <div>
          <div style={{ height: '36px' }} />
          <div
            style={{
              borderBottom: '1px dotted #94a3b8',
              width: '200px',
              margin: '0 auto 6px auto',
            }}
          />
          <div style={{ fontWeight: '600', color: '#1e293b' }}>
            ( {customerName || 'ลูกค้า / ผู้ขอเช่าซื้อ'} )
          </div>
          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
            ลูกค้า / ผู้ขอเช่าซื้อ
          </div>
        </div>
      </div>

      {/* Disclaimers matching Image 2 */}
      <div
        style={{
          fontSize: '10.5px',
          color: '#1e3a8a',
          textAlign: 'center',
          lineHeight: 1.4,
          marginTop: '4px',
          fontWeight: 'bold',
        }}
      >
        * ยอดจริงอาจมีการเปลี่ยนแปลงตามผลการอนุมัติสินเชื่อ Next Capital
      </div>
      <div
        style={{
          fontSize: '9px',
          color: '#64748b',
          textAlign: 'center',
          lineHeight: 1.3,
          marginTop: '2px',
        }}
      >
        (เอกสารนี้เป็นเพียงการจำลองคำนวณค่างวดเบื้องต้นตามเงื่อนไข Proposal เพื่อประกอบการตัดสินใจ)
      </div>
      <div
        style={{
          fontSize: '9px',
          color: '#94a3b8',
          textAlign: 'center',
          lineHeight: 1.3,
          marginTop: '3px',
        }}
      >
        ระบบคำนวณค่างวดและออกใบเสนอราคา • บมจ. เน็กซ์ แคปปิตอล (NCAP)
      </div>
    </div>
  );

  return (
    <>
      {/* 
        ================================================================
        OFFSCREEN DEDICATED EXPORT ROOT FOR HTML2CANVAS (100% Matching Image 2)
        ================================================================
      */}
      <div
        style={{
          position: 'fixed',
          left: '-9999px',
          top: '-9999px',
          width: '780px',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -9999,
          backgroundColor: '#ffffff',
        }}
      >
        <div id="ncap-quotation-export-root" ref={exportTemplateRef}>
          {renderQuotationDocument(true)}
        </div>
      </div>

      {/* 
        ================================================================
        SCREEN MODAL VIEW - Matching Image 1 (InsuranceDocModal layout)
        ================================================================
      */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
        <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 relative my-auto">
          {/* Header Bar matching Image 1 */}
          <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="p-2 sm:p-2.5 bg-gradient-to-br from-blue-700 to-indigo-800 text-white rounded-2xl shadow-md shadow-blue-500/20 flex-shrink-0">
                  <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-slate-800 leading-tight">
                    ใบเสนอราคาเช่าซื้อรถจักรยานยนต์
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                    แสดงตัวอย่างใบเสนอราคา (รุ่น <span className="font-semibold text-slate-700">{modelName || 'รถจักรยานยนต์'}</span>)
                  </p>
                </div>
              </div>

              {/* ปุ่มปิดหน้าต่าง (X) มุมขวาบน */}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 rounded-full transition-colors cursor-pointer flex-shrink-0 -mr-1"
                title="ปิดหน้าต่าง"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ฟังก์ชั่นส่ง LINE และดาวน์โหลด จัดตำแหน่งกึ่งกลาง */}
            <div className="flex items-center justify-center gap-2.5 sm:gap-3 mt-3 pt-2.5 border-t border-slate-200/70">
              <button
                type="button"
                onClick={handleCopyChatText}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-95"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>คัดลอกสำเร็จ!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    <span>ส่ง LINE</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownloadImage}
                disabled={isGeneratingImage}
                className="flex items-center justify-center gap-1.5 px-4.5 py-2 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 hover:opacity-95 text-white text-xs font-bold shadow-md shadow-blue-700/20 cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
              >
                {isGeneratingImage ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>กำลังดาวน์โหลด...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>ดาวน์โหลด</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Progress / Success Notifications */}
          {isGeneratingImage && (
            <div className="bg-blue-50 border-b border-blue-200 text-blue-800 text-xs px-5 py-2 flex items-center justify-center gap-2 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
              <span className="font-semibold">กำลังสร้างรูปภาพใบเสนอราคาคุณภาพสูง... กรุณารอสักครู่</span>
            </div>
          )}

          {imageSuccessMessage && (
            <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs px-5 py-2 flex items-center justify-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-semibold">{imageSuccessMessage}</span>
            </div>
          )}

          {/* Modal Scrollable Body */}
          <div className="p-3 sm:p-5 overflow-y-auto flex-1 space-y-3.5 bg-slate-50/60">
            {/* Quick Edit Bar - Allows adjusting Customer & Officer information before downloading */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-700" /> ข้อมูลที่แสดงในใบเสนอราคา:
                </span>
                <span className="text-[10px] text-slate-400 font-normal">
                  (สามารถแก้ไขเพื่ออัปเดตบนเอกสารได้ทันที)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">ชื่อลูกค้า</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomerName(val);
                      try {
                        localStorage.setItem('ncap_customer_name', val);
                      } catch {}
                      onUpdateCustomer?.(val, customerPhone);
                    }}
                    placeholder="ชื่อลูกค้า"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-semibold outline-none focus:border-blue-500 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">เบอร์โทรศัพท์ลูกค้า</label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomerPhone(val);
                      try {
                        localStorage.setItem('ncap_customer_phone', val);
                      } catch {}
                      onUpdateCustomer?.(customerName, val);
                    }}
                    placeholder="เบอร์โทรศัพท์"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono outline-none focus:border-blue-500 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">ผู้เสนอราคา / เจ้าหน้าที่</label>
                  <input
                    type="text"
                    value={officerNameAndCode}
                    onChange={(e) => setOfficerNameAndCode(e.target.value)}
                    placeholder="ชื่อและโค้ดเจ้าหน้าที่"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-blue-900 font-semibold outline-none focus:border-blue-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Document Preview Area matching Image 1 */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-1.5 px-1">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  ตัวอย่างเอกสาร (ใบเสนอราคาเช่าซื้อ):
                </span>

                {/* Responsive View Mode Switcher matching Image 1 */}
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center bg-slate-200/90 p-0.5 rounded-lg border border-slate-300">
                    <button
                      type="button"
                      onClick={() => setZoomMode('fit')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                        zoomMode === 'fit'
                          ? 'bg-white text-blue-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      พอดีหน้าจอ
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomMode('100')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                        zoomMode === '100'
                          ? 'bg-white text-blue-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      ขนาดจริง (100%)
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 hidden sm:inline">1 หน้า A4</span>
                </div>
              </div>

              {/* Dynamic Scaling Container matching Image 1 */}
              <div
                ref={previewContainerRef}
                className={`bg-slate-200/80 p-1.5 sm:p-4 rounded-2xl flex justify-center shadow-inner ${
                  zoomMode === '100' ? 'overflow-x-auto' : 'overflow-hidden'
                }`}
              >
                <div
                  style={{
                    width: zoomMode === '100' ? '780px' : `${Math.round(780 * previewScale)}px`,
                    height:
                      zoomMode === '100'
                        ? 'auto'
                        : `${Math.round(previewHeight * previewScale)}px`,
                    position: 'relative',
                    transition: 'width 0.15s ease, height 0.15s ease',
                  }}
                  className="bg-white rounded-xl shadow-lg border border-slate-300 overflow-hidden shrink-0"
                >
                  <div
                    ref={previewDocRef}
                    style={{
                      width: '780px',
                      transform: zoomMode === '100' ? 'none' : `scale(${previewScale})`,
                      transformOrigin: 'top left',
                    }}
                  >
                    {renderQuotationDocument(false)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Sticky Footer matching Image 1 */}
          <div className="px-5 py-3 border-t border-slate-200 bg-white flex flex-col items-center justify-center gap-2.5 text-xs">
            <div className="text-slate-500 text-[11px] text-center">
              รุ่นรถ: <strong className="text-slate-800">{modelName || 'รถจักรยานยนต์'}</strong> • ยอดจัดรวม:{' '}
              <strong className="text-slate-800">{formatBaht(result.financeAmount)} บาท</strong> • ค่างวด:{' '}
              <strong className="text-blue-800">{formatBaht(result.monthlyInstallment)} /เดือน</strong> ({result.term} งวด)
            </div>

            {/* ปุ่มด้านล่างจัดวางตำแหน่งกึ่งกลาง */}
            <div className="flex items-center justify-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold cursor-pointer transition-colors text-center"
              >
                ปิดหน้าต่าง
              </button>
              <button
                type="button"
                onClick={handleDownloadImage}
                disabled={isGeneratingImage}
                className="flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 hover:opacity-95 text-white font-bold shadow-md shadow-blue-700/20 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
              >
                {isGeneratingImage ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>กำลังดาวน์โหลด...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>ดาวน์โหลด</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
