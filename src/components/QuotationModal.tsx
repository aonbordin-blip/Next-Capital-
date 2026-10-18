import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Check,
  FileText,
  Share2,
  Printer,
  Download,
  Loader2,
  User,
  Phone,
  Bike,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { CalculationResult } from '../types';
import {
  formatBaht,
  cleanPlanNameForLine,
  formatTermYearMonth,
} from '../data/proposals';
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
  const [officerNameAndCode, setOfficerNameAndCode] = useState<string>(
    officerInfo || 'บดินทร์ (6683)'
  );

  const getModelNameByCode = (code: string): string | null => {
    if (!code || !code.trim()) return null;
    const found = findModelByCode(code);
    return found ? found.name : null;
  };

  const initialModelName =
    selectedBikeName && selectedBikeName !== 'รถจักรยานยนต์'
      ? selectedBikeName
      : getModelNameByCode(modelCode) || selectedBikeName || 'รถจักรยานยนต์';

  const [customerName, setCustomerName] = useState<string>(
    initialCustomerName || 'คุณลูกค้า'
  );
  const [customerPhone, setCustomerPhone] = useState<string>(
    initialCustomerPhone || ''
  );
  const [modelName, setModelName] = useState<string>(initialModelName);
  const [modelCodeState, setModelCodeState] = useState<string>(
    modelCode ? modelCode.toUpperCase() : ''
  );

  // Sync with prop updates
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

  // Zoom & Scale Refs matching InsuranceDocModal
  const exportTemplateRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const previewDocRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState<number>(1);
  const [previewHeight, setPreviewHeight] = useState<number>(1150);
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
    modelName,
    dealerName,
    result,
  ]);

  if (!isOpen) return null;

  const docNumber = `QT-${Math.floor(100000 + (result.vehiclePrice % 900000))}`;

  // Direct In-Browser High-Quality Image (PNG) Generation matching the displayed preview 100%
  const handleDownloadImage = async () => {
    if (!exportTemplateRef.current || isGeneratingImage) return;
    setIsGeneratingImage(true);
    setImageSuccessMessage(null);

    try {
      const cleanModelName = (modelName || 'รถจักรยานยนต์').replace(/\s+/g, '_');
      const fileName = `ใบเสนอราคา_${cleanModelName}_NextCapital.png`;
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

    const text = `📋 ใบเสนอราคาเช่าซื้อรถจักรยานยนต์
━━━━━━━━━━━━━━━━━━━━
🏢 ผู้เสนอ: ${dealerName}
👨‍💼 ผู้เสนอราคา/เจ้าหน้าที่: ${officerNameAndCode || 'บดินทร์ (6683)'}
👤 ลูกค้า: ${customerName} ${customerPhone ? `(${customerPhone})` : ''}
📅 วันที่: ${quotationDate}
━━━━━━━━━━━━━━━━━━━━
🏍️ รุ่นรถ: ${modelName}${modelCodeState ? `\n🔢 รหัสรุ่น: ${modelCodeState}` : ''}
🏷️ ราคารถตัวเปล่า: ${formatBaht(result.baseVehiclePrice)}
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
📌 หมายเหตุ: ${result.remarkText}
* ยอดจริงอาจมีการเปลี่ยนแปลงตามผลการอนุมัติสินเชื่อ Next Capital`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  /**
   * Render the formal A4 Quotation document with 100% inline CSS styling.
   * Rendered in both the high-res export container and the interactive scaled preview.
   */
  const renderQuotationDocument = () => {
    return (
      <div
        style={{
          width: '780px',
          backgroundColor: '#ffffff',
          padding: '26px 32px',
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
            paddingBottom: '14px',
            borderBottom: '2px solid #e2e8f0',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <NextCapitalLogo size={46} />
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
                {dealerName || 'บริษัท เน็กซ์ แคปปิตอล จำกัด (มหาชน)'}
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
            <div style={{ fontWeight: '600', color: '#1e293b', marginBottom: '2px' }}>
              เลขที่เอกสาร: {docNumber}
            </div>
            <div style={{ color: '#64748b' }}>วันที่: {quotationDate}</div>
          </div>
        </div>

        {/* Customer & Vehicle Info Cards - Symmetrical 2 Columns */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '14px',
            backgroundColor: '#f8fafc',
            padding: '14px 16px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            fontSize: '12px',
            marginTop: '14px',
            marginBottom: '14px',
          }}
        >
          {/* Customer Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                  padding: '0 10px',
                  fontWeight: '600',
                  color: '#0f172a',
                  height: '32px',
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
                  padding: '0 10px',
                  color: '#0f172a',
                  height: '32px',
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
                  padding: '0 10px',
                  fontWeight: '600',
                  color: '#1e40af',
                  height: '32px',
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div
              style={{
                fontWeight: 'bold',
                color: '#1e293b',
                fontSize: '12px',
                paddingBottom: '2px',
              }}
            >
              ข้อมูลยานพาหนะและข้อเสนอ
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
                  padding: '0 10px',
                  fontWeight: '600',
                  color: '#1e40af',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  lineHeight: '1.4',
                  boxSizing: 'border-box',
                }}
              >
                {modelName} {modelCodeState ? `(${modelCodeState})` : ''}
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
              <span style={{ color: '#64748b', lineHeight: '1.4' }}>ข้อเสนอ:</span>
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '0 10px',
                  color: '#0f172a',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  lineHeight: '1.4',
                  boxSizing: 'border-box',
                }}
              >
                {result.proposalName} ({result.proposalCode})
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
              <span style={{ color: '#64748b', lineHeight: '1.4' }}>ราคารถรวม VAT:</span>
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '0 10px',
                  fontWeight: 'bold',
                  color: '#0f172a',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  lineHeight: '1.4',
                  boxSizing: 'border-box',
                }}
              >
                {formatBaht(result.vehiclePrice)} บาท
              </div>
            </div>
          </div>
        </div>

        {/* Calculation Breakdown Table */}
        <div
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            overflow: 'hidden',
            marginBottom: '14px',
            fontSize: '12px',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr
                style={{
                  backgroundColor: '#f1f5f9',
                  borderBottom: '1px solid #e2e8f0',
                  color: '#334155',
                  fontSize: '12px',
                }}
              >
                <th style={{ padding: '8px 14px', fontWeight: 'bold' }}>
                  รายการจำแนกยอดจัดและดอกเบี้ย
                </th>
                <th
                  style={{
                    padding: '8px 14px',
                    textAlign: 'right',
                    fontWeight: 'bold',
                    width: '180px',
                  }}
                >
                  จำนวนเงิน (บาท)
                </th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '9px 14px', color: '#334155', lineHeight: '1.35' }}>
                  1. ราคารถจักรยานยนต์รวมภาษีมูลค่าเพิ่ม (Vehicle Price incl. VAT)
                </td>
                <td
                  style={{
                    padding: '9px 14px',
                    textAlign: 'right',
                    fontWeight: '600',
                    color: '#0f172a',
                  }}
                >
                  {formatBaht(result.vehiclePrice)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '9px 14px', color: '#334155', lineHeight: '1.35' }}>
                  2. เงินดาวน์ (Down Payment) ({result.downPercent.toFixed(1)}%)
                </td>
                <td
                  style={{
                    padding: '9px 14px',
                    textAlign: 'right',
                    fontWeight: '600',
                    color: '#b91c1c',
                  }}
                >
                  - {formatBaht(result.downAmount)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
                <td style={{ padding: '9px 14px', color: '#334155', lineHeight: '1.35' }}>
                  3. ยอดจัดไฟแนนซ์เฉพาะตัวรถ (Vehicle Finance Amount)
                </td>
                <td
                  style={{
                    padding: '9px 14px',
                    textAlign: 'right',
                    fontWeight: '600',
                    color: '#0f172a',
                  }}
                >
                  {formatBaht(result.vehicleFinanceAmount)}
                </td>
              </tr>
              {result.insuranceTotalWithVat > 0 && (
                <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#eff6ff' }}>
                  <td style={{ padding: '9px 14px', color: '#1e40af', lineHeight: '1.35' }}>
                    <div style={{ fontWeight: '600' }}>
                      4. ประกันภัย {cleanPlanNameForLine(result.insurancePlanName)} (รวมในยอดจัด)
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#3b82f6', marginTop: '1px' }}>
                      เบี้ยสุทธิ: {formatBaht(result.insuranceBasePremium)} | ภาษีมูลค่าเพิ่ม 7%: {formatBaht(result.insuranceVat, true)}
                    </div>
                  </td>
                  <td
                    style={{
                      padding: '9px 14px',
                      textAlign: 'right',
                      fontWeight: '600',
                      color: '#1e40af',
                    }}
                  >
                    + {formatBaht(result.insuranceTotalWithVat, true)}
                  </td>
                </tr>
              )}
              <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f1f5f9' }}>
                <td style={{ padding: '10px 14px', fontWeight: '700', color: '#1e293b' }}>
                  {result.insuranceTotalWithVat > 0 ? '5.' : '4.'} ยอดจัดไฟแนนซ์รวมทั้งสิ้น (Total Net Finance Amount)
                </td>
                <td
                  style={{
                    padding: '10px 14px',
                    textAlign: 'right',
                    fontWeight: 'bold',
                    color: '#1d4ed8',
                    fontSize: '13px',
                  }}
                >
                  {formatBaht(result.financeAmount, true)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '9px 14px', color: '#334155', lineHeight: '1.35' }}>
                  <div>
                    {result.insuranceTotalWithVat > 0 ? '6.' : '5.'} อัตราดอกเบี้ย:{' '}
                    <span style={{ fontWeight: '600', color: '#0f172a' }}>
                      {result.rateDisplayText}
                    </span>
                  </div>
                  {result.isCappedByEir && (
                    <div style={{ fontSize: '11px', color: '#047857', marginTop: '2px', fontWeight: 'bold' }}>
                      🔒 {result.eirMaxMessage}
                    </div>
                  )}
                </td>
                <td style={{ padding: '9px 14px', textAlign: 'right', color: '#475569', fontSize: '11px' }}>
                  {formatBaht(result.monthlyInterest, true)} /งวด
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '9px 14px', color: '#334155', lineHeight: '1.35' }}>
                  {result.insuranceTotalWithVat > 0 ? '7.' : '6.'} ดอกเบี้ยรวมทั้งสัญญา ({result.term} งวด)
                </td>
                <td
                  style={{
                    padding: '9px 14px',
                    textAlign: 'right',
                    fontWeight: '600',
                    color: '#0f172a',
                  }}
                >
                  {formatBaht(result.totalInterest, true)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
                <td style={{ padding: '9px 14px', fontWeight: '600', color: '#1e293b' }}>
                  {result.insuranceTotalWithVat > 0 ? '8.' : '7.'} ยอดรวมทั้งสัญญารวมดอกเบี้ย (Total Contract Amount)
                </td>
                <td
                  style={{
                    padding: '9px 14px',
                    textAlign: 'right',
                    fontWeight: 'bold',
                    color: '#0f172a',
                  }}
                >
                  {formatBaht(result.totalWithVat, true)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Big Highlight: Monthly Installment */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%)',
            borderRadius: '12px',
            padding: '14px 18px',
            textAlign: 'center',
            color: '#ffffff',
            marginBottom: '14px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div
            style={{
              fontSize: '11.5px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: '#dbeafe',
              fontWeight: '600',
            }}
          >
            ค่างวดผ่อนชำระต่อเดือน (รวมภาษีมูลค่าเพิ่ม 7%)
          </div>
          <div
            style={{
              fontSize: '28px',
              fontWeight: '800',
              margin: '3px 0',
              lineHeight: 1.1,
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
            ระยะเวลาผ่อนชำระ {result.term} งวด ( {formatTermYearMonth(result.term)} )
          </div>
        </div>

        {/* Delivery day expenses if applicable */}
        {(result.registrationFee > 0 || result.theftInsuranceFee > 0) && (
          <div
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '10px 14px',
              backgroundColor: '#f8fafc',
              fontSize: '11.5px',
              marginBottom: '14px',
              lineHeight: 1.4,
            }}
          >
            <div style={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}>
              สรุปเงินเตรียมพร้อมออกรถ (วันรับรถ)
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                color: '#475569',
                marginBottom: '2px',
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
                  marginBottom: '2px',
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
                  marginBottom: '2px',
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
                paddingTop: '5px',
                borderTop: '1px solid #e2e8f0',
                marginTop: '3px',
                fontSize: '11.5px',
              }}
            >
              <span>รวมเงินที่ต้องชำระวันออกรถสุทธิ:</span>
              <span>{formatBaht(result.totalDriveAwayCost)} บาท</span>
            </div>
          </div>
        )}

        {/* Signature Footer - 2 Columns */}
        <div
          style={{
            paddingTop: '14px',
            borderTop: '1px solid #e2e8f0',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            textAlign: 'center',
            fontSize: '11px',
            color: '#64748b',
            marginBottom: '10px',
          }}
        >
          <div>
            <div style={{ height: '32px' }} />
            <div
              style={{
                borderBottom: '1px dotted #94a3b8',
                width: '200px',
                margin: '0 auto 6px auto',
              }}
            />
            <div style={{ fontWeight: '600', color: '#1e293b' }}>
              ( {officerNameAndCode || 'ผู้เสนอราคา / เจ้าหน้าที่'} )
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
              ผู้เสนอราคา / เจ้าหน้าที่ บมจ. เน็กซ์ แคปปิตอล
            </div>
          </div>
          <div>
            <div style={{ height: '32px' }} />
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

        {/* Note */}
        <div
          style={{
            fontSize: '10.5px',
            color: '#1e3a8a',
            textAlign: 'center',
            lineHeight: 1.35,
            marginTop: '2px',
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
            marginTop: '1px',
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
            marginTop: '2px',
          }}
        >
          ระบบคำนวณค่างวดและออกใบเสนอราคา • บมจ. เน็กซ์ แคปปิตอล (NCAP)
        </div>
      </div>
    );
  };

  return (
    <>
      {/* 
        ================================================================
        HIGH-RESOLUTION EXPORT TEMPLATE CONTAINER
        Always renders off-screen at fixed width: 780px for export
        ================================================================
      */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '780px',
          zIndex: -9999,
          opacity: 0,
          pointerEvents: 'none',
          backgroundColor: '#ffffff',
        }}
      >
        <div id="ncap-quotation-export-root" ref={exportTemplateRef}>
          {renderQuotationDocument()}
        </div>
      </div>

      {/* 
        ================================================================
        INTERACTIVE SCREEN MODAL
        Matches the look & feel of InsuranceDocModal
        ================================================================
      */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
        <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto border border-slate-200">
          {/* Header Action Bar */}
          <div className="flex flex-wrap items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-amber-50/70">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-blue-800 text-white flex items-center justify-center shadow-md shadow-blue-700/20">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    ใบเสนอราคาเช่าซื้อรถจักรยานยนต์
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300 font-mono">
                    NCAP
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {modelName} • ค่างวด {formatBaht(result.monthlyInstallment)}/เดือน ({result.term} งวด)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2 sm:mt-0">
              <button
                type="button"
                onClick={handleCopyChatText}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-200 bg-white hover:bg-emerald-50/60 text-slate-700 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                title="คัดลอกข้อความสรุปสำหรับส่งลูกค้าทาง LINE"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>คัดลอกสำเร็จ!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>ส่ง LINE</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                title="พิมพ์เอกสาร"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>พิมพ์</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadImage}
                disabled={isGeneratingImage}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 hover:opacity-95 text-white text-xs font-bold shadow-md shadow-blue-700/20 transition-all cursor-pointer disabled:opacity-50"
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

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {imageSuccessMessage && (
            <div className="px-5 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between animate-fade-in">
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                {imageSuccessMessage}
              </span>
              <button
                onClick={() => setImageSuccessMessage(null)}
                className="text-emerald-600 hover:underline text-[10px]"
              >
                ปิด
              </button>
            </div>
          )}

          {/* Modal Interactive Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs text-slate-700 bg-slate-50/50">
            {/* Quick Customer & Document Info Inputs */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <User className="w-4 h-4 text-blue-700" />
                  ข้อมูลในใบเสนอราคา (แก้ไขและดูผลทันที):
                </span>
                <span className="text-[10px] text-slate-400">
                  เลขที่เอกสาร: {docNumber}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[10px] text-slate-500 font-medium mb-1">
                    ชื่อลูกค้า
                  </label>
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
                    placeholder="คุณลูกค้า"
                    className="w-full bg-slate-50 hover:bg-white focus:bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 font-semibold text-slate-900 text-xs outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 font-medium mb-1">
                    เบอร์โทรศัพท์
                  </label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomerPhone(val);
                      try {
                        localStorage.setItem('ncap_customer_phone', val);
                      } catch {}
                      onUpdateCustomer?.(customerName, val);
                    }}
                    placeholder="08X-XXX-XXXX"
                    className="w-full bg-slate-50 hover:bg-white focus:bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 font-mono text-slate-800 text-xs outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 font-medium mb-1">
                    ผู้เสนอราคา / เจ้าหน้าที่
                  </label>
                  <input
                    type="text"
                    value={officerNameAndCode}
                    onChange={(e) => setOfficerNameAndCode(e.target.value)}
                    placeholder="ชื่อ (รหัสเจ้าหน้าที่)"
                    className="w-full bg-slate-50 hover:bg-white focus:bg-white px-2.5 py-1.5 rounded-xl border border-blue-200 font-semibold text-blue-900 text-xs outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 font-medium mb-1">
                    ชื่อรุ่นรถจักรยานยนต์
                  </label>
                  <input
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="รุ่นรถ"
                    className="w-full bg-slate-50 hover:bg-white focus:bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 font-semibold text-blue-900 text-xs outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Live Document Preview Card */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-1.5 px-1">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  ตัวอย่างเอกสาร (ใบเสนอราคาเช่าซื้อ):
                </span>

                {/* Responsive View Mode Switcher */}
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

              {/* Dynamic Scaling Container */}
              <div
                ref={previewContainerRef}
                className={`bg-slate-200/80 p-1.5 sm:p-4 rounded-2xl flex justify-center shadow-inner ${
                  zoomMode === '100' ? 'overflow-x-auto' : 'overflow-hidden'
                }`}
              >
                <div
                  style={{
                    width:
                      zoomMode === '100'
                        ? '780px'
                        : `${Math.round(780 * previewScale)}px`,
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
                      transform:
                        zoomMode === '100' ? 'none' : `scale(${previewScale})`,
                      transformOrigin: 'top left',
                    }}
                  >
                    {renderQuotationDocument()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-5 py-3 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="text-slate-500 text-[11px]">
              ค่างวดผ่อนชำระ{' '}
              <strong className="text-blue-800 font-bold text-sm">
                {formatBaht(result.monthlyInstallment)} บาท/เดือน
              </strong>{' '}
              • ระยะเวลา{' '}
              <strong className="text-slate-800">
                {result.term} งวด ({formatTermYearMonth(result.term)})
              </strong>{' '}
              • รวม VAT 7%
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
              <button
                type="button"
                onClick={handleDownloadImage}
                disabled={isGeneratingImage}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 hover:opacity-95 text-white font-bold shadow-md shadow-blue-700/20 cursor-pointer disabled:opacity-50"
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
