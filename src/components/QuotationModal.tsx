import React, { useState, useRef } from 'react';
import {
  X,
  Check,
  FileText,
  Share2,
  Shield,
  Calendar,
  User,
  Download,
  Loader2,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { CalculationResult } from '../types';
import { formatBaht, cleanPlanNameForLine } from '../data/proposals';
import { MOTORCYCLE_MODELS, findModelByCode } from '../data/motorcycleModels';
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
  React.useEffect(() => {
    if (officerInfo) {
      setOfficerNameAndCode(officerInfo);
    }
  }, [officerInfo]);

  // Keep modelCode and auto-fill modelName by code in sync with prop updates
  React.useEffect(() => {
    if (modelCode !== undefined) {
      const upper = modelCode.toUpperCase();
      setModelCodeState(upper);
      const matchedName = getModelNameByCode(upper);
      if (matchedName) {
        setModelName(matchedName);
      }
    }
  }, [modelCode]);

  // Keep modelName in sync when selectedBikeName changes
  React.useEffect(() => {
    if (selectedBikeName && selectedBikeName !== 'รถจักรยานยนต์') {
      setModelName(selectedBikeName);
    } else if (modelCode) {
      const matchedName = getModelNameByCode(modelCode);
      if (matchedName) {
        setModelName(matchedName);
      }
    }
  }, [selectedBikeName, modelCode]);

  React.useEffect(() => {
    if (initialCustomerName) {
      setCustomerName(initialCustomerName);
    }
  }, [initialCustomerName]);

  React.useEffect(() => {
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

  // Screen interactive ref
  const quotationRef = useRef<HTMLDivElement>(null);
  // Dedicated fixed-dimension export template ref
  const exportTemplateRef = useRef<HTMLDivElement>(null);

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
⏱️ ระยะเวลาผ่อน: ${result.term} งวด (${(result.term / 12).toFixed(1)} ปี)
📈 อัตราดอกเบี้ย: ${result.rateDisplayText}
💵 ดอกเบี้ยต่อเดือน: ${formatBaht(result.monthlyInterest, true)} /เดือน
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

  return (
    <>
      {/* 
        ================================================================
        HIGH-RESOLUTION EXPORT TEMPLATE
        Rendered permanently offscreen (left: -10000px, zIndex: -9999).
        Cloned into a virtual iframe by html2canvas for PDF creation.
        NEVER displayed over or interfering with the user's view!
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
        <div
          id="ncap-quotation-export-root"
          ref={exportTemplateRef}
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
              <NextCapitalLogo size={46} />
              <div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', lineHeight: '1.35', marginBottom: '2px' }}>
                  {dealerName || 'ศูนย์บริการ / ตัวแทนจำหน่าย'}
                </div>
                <div style={{ fontSize: '12px', color: '#475569', fontWeight: '500', lineHeight: '1.35' }}>
                  ใบเสนอราคาเช่าซื้อรถจักรยานยนต์ (Hire Purchase Quotation)
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '12px', color: '#475569', lineHeight: '1.4', flexShrink: 0 }}>
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
              <div style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '12px', paddingBottom: '2px' }}>
                ข้อมูลลูกค้า & ผู้เสนอราคา
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px', alignItems: 'center' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px', alignItems: 'center' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px', alignItems: 'center' }}>
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
              <div style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '12px', paddingBottom: '2px' }}>
                ข้อมูลยานพาหนะและเงื่อนไข
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px', alignItems: 'center' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px', alignItems: 'center' }}>
                <span style={{ color: '#64748b', lineHeight: '1.4' }}>รหัสรุ่น:</span>
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '0 12px',
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    fontSize: '11px',
                    color: '#1e40af',
                    textTransform: 'uppercase',
                    height: '34px',
                    display: 'flex',
                    alignItems: 'center',
                    lineHeight: '1.4',
                    boxSizing: 'border-box',
                  }}
                >
                  {modelCodeState ? modelCodeState.toUpperCase() : '-'}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px', alignItems: 'center' }}>
                <span style={{ color: '#64748b', lineHeight: '1.4' }}>รหัสข้อเสนอ:</span>
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '0 12px',
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    fontSize: '11px',
                    color: '#0f172a',
                    height: '34px',
                    display: 'flex',
                    alignItems: 'center',
                    lineHeight: '1.4',
                    boxSizing: 'border-box',
                  }}
                >
                  {result.proposalCode}
                </div>
              </div>
            </div>
          </div>

          {/* Core Table Breakdown - Vertically Centered Rows with Balanced Thai Typography */}
          <div
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              overflow: 'hidden',
              marginBottom: '16px',
            }}
          >
            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '68%' }} />
                <col style={{ width: '32%' }} />
              </colgroup>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', color: '#1e293b' }}>
                  <th style={{ padding: '11px 16px 13px 16px', textAlign: 'left', fontWeight: 'bold', verticalAlign: 'middle', lineHeight: '1.4' }}>
                    รายการ
                  </th>
                  <th style={{ padding: '11px 16px 13px 16px', textAlign: 'right', fontWeight: 'bold', verticalAlign: 'middle', lineHeight: '1.4' }}>
                    จำนวนเงิน (บาท)
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '11px 16px 13px 16px', color: '#334155', verticalAlign: 'middle', lineHeight: '1.4' }}>
                    1. ราคารถตัวเปล่า (Base Vehicle Price)
                  </td>
                  <td style={{ padding: '11px 16px 13px 16px', textAlign: 'right', fontWeight: '600', verticalAlign: 'middle', lineHeight: '1.4' }}>
                    {formatBaht(result.baseVehiclePrice)}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '11px 16px 13px 16px', color: '#334155', verticalAlign: 'middle', lineHeight: '1.4' }}>
                    2. เงินดาวน์ (Down Payment) ({result.downPercent.toFixed(1)}%)
                  </td>
                  <td style={{ padding: '11px 16px 13px 16px', textAlign: 'right', fontWeight: '600', color: '#059669', verticalAlign: 'middle', lineHeight: '1.4' }}>
                    - {formatBaht(result.downAmount)}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
                  <td style={{ padding: '11px 16px 13px 16px', fontWeight: '600', color: '#1e293b', verticalAlign: 'middle', lineHeight: '1.4' }}>
                    3. ยอดจัดเฉพาะตัวรถ (Vehicle Finance Amount)
                  </td>
                  <td style={{ padding: '11px 16px 13px 16px', textAlign: 'right', fontWeight: 'bold', color: '#0f172a', verticalAlign: 'middle', lineHeight: '1.4' }}>
                    {formatBaht(result.vehicleFinanceAmount)}
                  </td>
                </tr>
                {result.insuranceTotalWithVat > 0 && (
                  <>
                    <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#f0fdf4' }}>
                      <td style={{ padding: '9px 16px 11px 28px', color: '#1e3a8a', verticalAlign: 'middle', lineHeight: '1.4' }}>
                        • ค่าเบี้ยประกันภัย PA ({result.insurancePlanName})
                      </td>
                      <td style={{ padding: '9px 16px 11px 16px', textAlign: 'right', color: '#1e3a8a', fontWeight: '500', verticalAlign: 'middle', lineHeight: '1.4' }}>
                        +{formatBaht(result.insuranceBasePremium)}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#f0fdf4' }}>
                      <td style={{ padding: '9px 16px 11px 28px', color: '#1e3a8a', verticalAlign: 'middle', lineHeight: '1.4' }}>
                        • ภาษีมูลค่าเพิ่ม 7% ของค่าเบี้ยประกัน
                      </td>
                      <td style={{ padding: '9px 16px 11px 16px', textAlign: 'right', color: '#1e3a8a', fontWeight: '500', verticalAlign: 'middle', lineHeight: '1.4' }}>
                        +{formatBaht(result.insuranceVat, true)}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#eff6ff', fontWeight: 'bold' }}>
                      <td style={{ padding: '11px 16px 13px 16px', color: '#172554', verticalAlign: 'middle', lineHeight: '1.4' }}>
                        + ค่าเบี้ยประกันรวมภาษี 7% (Insurance with VAT)
                      </td>
                      <td style={{ padding: '11px 16px 13px 16px', textAlign: 'right', color: '#1d4ed8', fontWeight: 'bold', verticalAlign: 'middle', lineHeight: '1.4' }}>
                        +{formatBaht(result.insuranceTotalWithVat, true)}
                      </td>
                    </tr>
                  </>
                )}
                <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#eef2ff' }}>
                  <td style={{ padding: '11px 16px 13px 16px', fontWeight: 'bold', color: '#312e81', verticalAlign: 'middle', lineHeight: '1.4' }}>
                    4. ยอดจัดไฟแนนซ์รวม (Total Finance Amount)
                  </td>
                  <td style={{ padding: '11px 16px 13px 16px', textAlign: 'right', fontWeight: '800', color: '#312e81', verticalAlign: 'middle', lineHeight: '1.4' }}>
                    {formatBaht(result.financeAmount, true)}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '11px 16px 13px 16px', color: '#334155', verticalAlign: 'middle', lineHeight: '1.4' }}>
                    5. อัตราดอกเบี้ย ({result.rateDisplayText})
                  </td>
                  <td style={{ padding: '11px 16px 13px 16px', textAlign: 'right', fontWeight: 'bold', color: '#2563eb', verticalAlign: 'middle', lineHeight: '1.4' }}>
                    {result.rateDisplayText}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '11px 16px 13px 16px', color: '#334155', verticalAlign: 'middle', lineHeight: '1.4' }}>
                    6. ดอกเบี้ยรายเดือน (Monthly Interest)
                  </td>
                  <td style={{ padding: '11px 16px 13px 16px', textAlign: 'right', color: '#1e293b', verticalAlign: 'middle', lineHeight: '1.4' }}>
                    {formatBaht(result.monthlyInterest, true)}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '11px 16px 13px 16px', color: '#334155', verticalAlign: 'middle', lineHeight: '1.4' }}>
                    7. ดอกเบี้ยรวมทั้งสัญญา ({result.term} งวด)
                  </td>
                  <td style={{ padding: '11px 16px 13px 16px', textAlign: 'right', verticalAlign: 'middle', lineHeight: '1.4' }}>
                    {formatBaht(result.totalInterest, true)}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
                  <td style={{ padding: '11px 16px 13px 16px', fontWeight: '600', color: '#1e293b', verticalAlign: 'middle', lineHeight: '1.4' }}>
                    8. ยอดรวมทั้งสัญญารวมดอกเบี้ย (Total Contract Amount)
                  </td>
                  <td style={{ padding: '11px 16px 13px 16px', textAlign: 'right', fontWeight: 'bold', color: '#0f172a', verticalAlign: 'middle', lineHeight: '1.4' }}>
                    {formatBaht(result.totalWithVat, true)}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9', fontSize: '11px', color: '#64748b' }}>
                  <td style={{ padding: '9px 16px 11px 28px', verticalAlign: 'middle', lineHeight: '1.4' }}>
                    • ยอดรวมก่อนภาษีมูลค่าเพิ่ม (Total before VAT)
                  </td>
                  <td style={{ padding: '9px 16px 11px 16px', textAlign: 'right', verticalAlign: 'middle', lineHeight: '1.4' }}>
                    {formatBaht(result.totalBeforeVat, true)}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9', fontSize: '11px', color: '#64748b' }}>
                  <td style={{ padding: '9px 16px 11px 28px', verticalAlign: 'middle', lineHeight: '1.4' }}>
                    • ภาษีมูลค่าเพิ่ม 7% (VAT 7%)
                  </td>
                  <td style={{ padding: '9px 16px 11px 16px', textAlign: 'right', verticalAlign: 'middle', lineHeight: '1.4' }}>
                    {formatBaht(result.vatAmount, true)}
                  </td>
                </tr>
                <tr
                  style={{
                    backgroundColor: '#dbeafe',
                    borderTop: '2px solid #60a5fa',
                    color: '#172554',
                    fontWeight: 'bold',
                  }}
                >
                  <td style={{ padding: '13px 16px 15px 16px', fontSize: '13px', verticalAlign: 'middle', lineHeight: '1.4' }}>
                    ค่างวดผ่อนชำระต่อเดือน (รวม VAT 7%)
                  </td>
                  <td style={{ padding: '13px 16px 15px 16px', textAlign: 'right', fontSize: '15px', fontWeight: '800', verticalAlign: 'middle', lineHeight: '1.4' }}>
                    {formatBaht(result.monthlyInstallment)} /เดือน
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Monthly Payment Hero Box */}
          <div
            style={{
              background: 'linear-gradient(135deg, #1d4ed8 0%, #312e81 100%)',
              color: '#ffffff',
              borderRadius: '12px',
              padding: '14px 20px',
              textAlign: 'center',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
              marginBottom: '16px',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#dbeafe', letterSpacing: '0.04em', lineHeight: 1.2 }}>
              ค่างวดผ่อนชำระต่อเดือน (รวมภาษีมูลค่าเพิ่ม 7%)
            </div>
            <div
              style={{
                fontSize: '28px',
                fontWeight: '800',
                margin: '4px 0 4px 0',
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
              ระยะเวลาผ่อนชำระ {result.term} งวด ( {(result.term / 12).toFixed(1)} ปี )
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
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', marginBottom: '3px' }}>
                <span>• เงินดาวน์:</span>
                <span style={{ fontWeight: '500' }}>{formatBaht(result.downAmount)} บาท</span>
              </div>
              {result.registrationFee > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', marginBottom: '3px' }}>
                  <span>• ค่าจดทะเบียน + พ.ร.บ.:</span>
                  <span style={{ fontWeight: '500' }}>{formatBaht(result.registrationFee)} บาท</span>
                </div>
              )}
              {result.theftInsuranceFee > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', marginBottom: '3px' }}>
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

          {/* Signature Footer - 2 Columns */}
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
              <div style={{ borderBottom: '1px dotted #94a3b8', width: '200px', margin: '0 auto 6px auto' }} />
              <div style={{ fontWeight: '600', color: '#1e293b' }}>( {officerNameAndCode || 'ผู้เสนอราคา / เจ้าหน้าที่'} )</div>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>ผู้เสนอราคา / เจ้าหน้าที่</div>
            </div>
            <div>
              <div style={{ height: '36px' }} />
              <div style={{ borderBottom: '1px dotted #94a3b8', width: '200px', margin: '0 auto 6px auto' }} />
              <div style={{ fontWeight: '600', color: '#1e293b' }}>( {customerName || 'ลูกค้า / ผู้ขอเช่าซื้อ'} )</div>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>ลูกค้า / ผู้ขอเช่าซื้อ</div>
            </div>
          </div>

          {/* Note */}
          <div style={{ fontSize: '10.5px', color: '#1e3a8a', textAlign: 'center', lineHeight: 1.4, marginTop: '4px', fontWeight: 'bold' }}>
            * ยอดจริงอาจมีการเปลี่ยนแปลงตามผลการอนุมัติสินเชื่อ Next Capital
          </div>
          <div style={{ fontSize: '9px', color: '#64748b', textAlign: 'center', lineHeight: 1.3, marginTop: '2px' }}>
            (เอกสารนี้เป็นเพียงการจำลองคำนวณค่างวดเบื้องต้นตามเงื่อนไข Proposal เพื่อประกอบการตัดสินใจ)
          </div>
          <div style={{ fontSize: '9px', color: '#94a3b8', textAlign: 'center', lineHeight: 1.3, marginTop: '3px' }}>
            ระบบคำนวณค่างวดและออกใบเสนอราคา • พัฒนาระบบโดย Bordin 6683
          </div>
        </div>
      </div>

      {/* 
        ================================================================
        INTERACTIVE MODAL FOR SCREEN VIEW
        ================================================================
      */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
        <div className="relative bg-white rounded-3xl w-full max-w-3xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto border border-slate-200">
          {/* Dedicated Top-Right Close Button */}
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 z-20 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 active:scale-95 rounded-full transition-all cursor-pointer shadow-xs bg-white/80 backdrop-blur-sm"
            title="ปิดหน้าต่าง (Close)"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Modal Action Bar */}
          <div className="no-print relative px-5 py-3.5 border-b border-slate-200 bg-slate-50/95 flex flex-col sm:flex-row items-center justify-between gap-3 pr-14 sm:pr-16">
            {/* Left: Document Title + Creator Badge */}
            <div className="flex items-center gap-2.5 self-start sm:self-center">
              <div className="p-2 bg-blue-100 text-blue-800 rounded-xl flex-shrink-0 shadow-xs">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-bold text-slate-800">
                    ใบเสนอราคาเช่าซื้อ (Quotation)
                  </h2>
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-indigo-700 bg-indigo-50/90 border border-indigo-200 px-2 py-0.5 rounded-full shadow-2xs">
                    ✨ by Bordin 6683
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  ดาวน์โหลดเป็นรูปภาพ หรือส่งทาง LINE ได้ทันที
                </p>
              </div>
            </div>

            {/* Center: Action Buttons (ส่ง LINE & ดาวน์โหลด) */}
            <div className="flex items-center justify-center gap-2.5 w-full sm:w-auto">
              <button
                onClick={handleCopyChatText}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-semibold shadow-sm shadow-emerald-700/20 transition-all cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" /> คัดลอกสำเร็จ!
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" /> ส่ง LINE
                  </>
                )}
              </button>

              {/* Direct Instant Image Download Button */}
              <button
                onClick={handleDownloadImage}
                disabled={isGeneratingImage}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 hover:opacity-95 active:scale-95 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-700/25 transition-all cursor-pointer disabled:opacity-50"
              >
                {isGeneratingImage ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> กำลังดาวน์โหลด...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" /> ดาวน์โหลด
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Progress Banner while generating Image */}
          {isGeneratingImage && (
            <div className="no-print bg-blue-50 border-b border-blue-200 text-blue-800 text-xs px-5 py-2.5 flex items-center justify-center gap-2 animate-pulse">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
              <span className="font-semibold">กำลังประมวลผลและสร้างรูปภาพคุณภาพสูง... กรุณารอสักครู่</span>
            </div>
          )}

          {/* Success Alert Banner if Image generated */}
          {imageSuccessMessage && (
            <div className="no-print bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs px-5 py-2 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="font-semibold">{imageSuccessMessage}</span>
            </div>
          )}

          {/* Scrollable Container with Sheet Presentation */}
          <div className="flex-1 overflow-y-auto overflow-x-auto p-2 sm:p-5 bg-slate-100/60">
            {/* Interactive Screen Quotation Document */}
            <div
              ref={quotationRef}
              className="w-full max-w-[760px] mx-auto p-4 sm:p-8 space-y-4 sm:space-y-5 text-slate-800 bg-white rounded-2xl shadow-sm border border-slate-200"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 sm:pb-5 border-b border-slate-200 gap-3 sm:gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <NextCapitalLogo size={44} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <input
                        type="text"
                        value={dealerName}
                        onChange={(e) => setDealerName(e.target.value)}
                        className="font-bold text-sm sm:text-base text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-blue-700 focus:outline-none transition-colors w-full"
                        placeholder="ชื่อศูนย์บริการ / ตัวแทนจำหน่าย"
                      />
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                      ใบเสนอราคาเช่าซื้อรถจักรยานยนต์ (Hire Purchase Quotation)
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right space-y-1 text-xs text-slate-500 flex-shrink-0 w-full sm:w-auto flex flex-row sm:flex-col justify-between sm:justify-start">
                  <div className="font-semibold text-slate-700">
                    เลขที่เอกสาร: {docNumber}
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>วันที่: {quotationDate}</span>
                  </div>
                </div>
              </div>

              {/* Customer, Officer & Vehicle Info Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 text-xs">
                <div className="space-y-2">
                  <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" /> ข้อมูลลูกค้า & ผู้เสนอราคา
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="text-slate-500">ชื่อลูกค้า:</span>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="col-span-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 font-medium leading-normal"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="text-slate-500">เบอร์โทรศัพท์:</span>
                    <input
                      type="text"
                      placeholder="08X-XXX-XXXX"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="col-span-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 leading-normal"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="text-slate-500 font-medium text-blue-900">ผู้เสนอราคา:</span>
                    <input
                      type="text"
                      placeholder="ใส่ชื่อเจ้าหน้าที่ (ใส่โค้ด)"
                      value={officerNameAndCode}
                      onChange={(e) => setOfficerNameAndCode(e.target.value)}
                      className="col-span-2 bg-white px-3 py-1.5 rounded-lg border border-blue-200 font-semibold text-blue-900 leading-normal focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-slate-400" /> ข้อมูลยานพาหนะและข้อเสนอ
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="text-slate-500">รุ่นรถ:</span>
                    <input
                      type="text"
                      value={modelName}
                      onChange={(e) => setModelName(e.target.value)}
                      className="col-span-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 font-semibold text-blue-900 leading-normal"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="text-slate-500 font-medium text-blue-900">รหัสรุ่น:</span>
                    <input
                      type="text"
                      placeholder="เช่น WW160AV TH, ACF125CBT TH"
                      value={modelCodeState}
                      onChange={(e) => {
                        const upper = e.target.value.toUpperCase();
                        setModelCodeState(upper);
                        const matched = getModelNameByCode(upper);
                        if (matched) {
                          setModelName(matched);
                        }
                      }}
                      className="col-span-2 bg-white px-3 py-1.5 rounded-lg border border-blue-200 font-mono text-xs font-bold text-blue-950 uppercase tracking-wide leading-normal focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="text-slate-500">รหัสข้อเสนอ:</span>
                    <span className="col-span-2 font-mono text-[11px] text-slate-800 font-bold">
                      {result.proposalCode}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <span className="text-slate-500">ลงชื่อในใบ:</span>
                    <span className="col-span-2 text-[11px] text-blue-950 font-bold truncate">
                      ( {officerNameAndCode || 'ผู้เสนอราคา / เจ้าหน้าที่'} )
                    </span>
                  </div>
                </div>
              </div>

              {/* Core Table Breakdown - Vertically Centered */}
              <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-xs">
                <table className="w-full text-xs min-w-[480px] sm:min-w-0">
                  <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="pt-3 pb-3.5 px-4 text-left align-middle leading-normal">รายการ</th>
                      <th className="pt-3 pb-3.5 px-4 text-right align-middle leading-normal">จำนวนเงิน (บาท)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="pt-3 pb-3.5 px-4 font-medium text-slate-700 align-middle leading-normal">
                        1. ราคารถตัวเปล่า (Base Vehicle Price)
                      </td>
                      <td className="pt-3 pb-3.5 px-4 text-right font-semibold align-middle leading-normal">
                        {formatBaht(result.baseVehiclePrice)}
                      </td>
                    </tr>
                    <tr>
                      <td className="pt-3 pb-3.5 px-4 font-medium text-slate-700 align-middle leading-normal">
                        2. เงินดาวน์ (Down Payment) ({result.downPercent.toFixed(1)}%)
                      </td>
                      <td className="pt-3 pb-3.5 px-4 text-right text-emerald-700 font-semibold align-middle leading-normal">
                        - {formatBaht(result.downAmount)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/70 font-semibold">
                      <td className="pt-3 pb-3.5 px-4 text-slate-800 align-middle leading-normal">
                        3. ยอดจัดเฉพาะตัวรถ (Vehicle Finance Amount)
                      </td>
                      <td className="pt-3 pb-3.5 px-4 text-right font-bold text-slate-900 align-middle leading-normal">
                        {formatBaht(result.vehicleFinanceAmount)}
                      </td>
                    </tr>
                    {result.insuranceTotalWithVat > 0 && (
                      <>
                        <tr className="bg-blue-50/40">
                          <td className="pt-2.5 pb-3 px-4 text-blue-900 pl-6 align-middle leading-normal">
                            • ค่าเบี้ยประกันภัย PA ({result.insurancePlanName})
                          </td>
                          <td className="pt-2.5 pb-3 px-4 text-right text-blue-900 font-medium align-middle leading-normal">
                            +{formatBaht(result.insuranceBasePremium)}
                          </td>
                        </tr>
                        <tr className="bg-blue-50/40">
                          <td className="pt-2.5 pb-3 px-4 text-blue-900 pl-6 align-middle leading-normal">
                            • ภาษีมูลค่าเพิ่ม 7% ของค่าเบี้ยประกัน
                          </td>
                          <td className="pt-2.5 pb-3 px-4 text-right text-blue-900 font-medium align-middle leading-normal">
                            +{formatBaht(result.insuranceVat, true)}
                          </td>
                        </tr>
                        <tr className="bg-blue-50/80 font-bold border-y border-blue-200/60">
                          <td className="pt-3 pb-3.5 px-4 text-blue-950 align-middle leading-normal">
                            + ค่าเบี้ยประกันรวมภาษี 7% (Insurance with VAT)
                          </td>
                          <td className="pt-3 pb-3.5 px-4 text-right text-blue-900 font-bold align-middle leading-normal">
                            +{formatBaht(result.insuranceTotalWithVat, true)}
                          </td>
                        </tr>
                      </>
                    )}
                    <tr className="bg-indigo-50/60 font-bold">
                      <td className="pt-3 pb-3.5 px-4 text-indigo-950 align-middle leading-normal">
                        4. ยอดจัดไฟแนนซ์รวม (Total Finance Amount)
                      </td>
                      <td className="pt-3 pb-3.5 px-4 text-right text-indigo-900 font-extrabold align-middle leading-normal">
                        {formatBaht(result.financeAmount, true)}
                      </td>
                    </tr>
                    <tr>
                      <td className="pt-3 pb-3.5 px-4 text-slate-700 align-middle leading-normal">
                        5. อัตราดอกเบี้ย ({result.rateDisplayText})
                      </td>
                      <td className="pt-3 pb-3.5 px-4 text-right text-blue-700 font-bold align-middle leading-normal">
                        {result.rateDisplayText}
                      </td>
                    </tr>
                    <tr>
                      <td className="pt-3 pb-3.5 px-4 text-slate-700 align-middle leading-normal">
                        6. ดอกเบี้ยรายเดือน (Monthly Interest)
                      </td>
                      <td className="pt-3 pb-3.5 px-4 text-right font-medium text-slate-800 align-middle leading-normal">
                        {formatBaht(result.monthlyInterest, true)} /เดือน
                      </td>
                    </tr>
                    <tr>
                      <td className="pt-3 pb-3.5 px-4 text-slate-700 align-middle leading-normal">
                        7. ดอกเบี้ยรวมทั้งสัญญา ({result.term} งวด)
                        {result.minInterestApplied && (
                          <span className="text-[10px] text-rose-500 ml-1 font-semibold">
                            (เกณฑ์ขั้นต่ำ 7,000 บ.)
                          </span>
                        )}
                      </td>
                      <td className="pt-3 pb-3.5 px-4 text-right font-medium align-middle leading-normal">
                        {formatBaht(result.totalInterest, true)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/60">
                      <td className="pt-3 pb-3.5 px-4 font-medium text-slate-700 align-middle leading-normal">
                        8. ยอดรวมทั้งสัญญารวมดอกเบี้ย (Total Contract Amount)
                      </td>
                      <td className="pt-3 pb-3.5 px-4 text-right font-bold text-slate-900 align-middle leading-normal">
                        {formatBaht(result.totalWithVat, true)}
                      </td>
                    </tr>
                    <tr>
                      <td className="pt-2.5 pb-3 px-4 text-slate-500 text-[11px] pl-6 align-middle leading-normal">
                        • ยอดรวมก่อนภาษีมูลค่าเพิ่ม (Total before VAT)
                      </td>
                      <td className="pt-2.5 pb-3 px-4 text-right text-slate-600 text-[11px] font-medium align-middle leading-normal">
                        {formatBaht(result.totalBeforeVat, true)}
                      </td>
                    </tr>
                    <tr>
                      <td className="pt-2.5 pb-3 px-4 text-slate-500 text-[11px] pl-6 align-middle leading-normal">
                        • ภาษีมูลค่าเพิ่ม 7% (VAT 7%)
                      </td>
                      <td className="pt-2.5 pb-3 px-4 text-right text-slate-600 text-[11px] font-medium align-middle leading-normal">
                        {formatBaht(result.vatAmount, true)}
                      </td>
                    </tr>
                    <tr className="bg-blue-100/70 font-bold border-t-2 border-blue-400">
                      <td className="pt-3.5 pb-4 px-4 text-blue-950 text-sm align-middle leading-normal">
                        ค่างวดผ่อนชำระต่อเดือน (รวม VAT 7%)
                      </td>
                      <td className="pt-3.5 pb-4 px-4 text-right text-blue-950 text-base font-extrabold align-middle leading-normal">
                        {formatBaht(result.monthlyInstallment)} /เดือน
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Monthly Payment Hero Box */}
              <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white rounded-2xl p-5 text-center shadow-md">
                <div className="text-xs font-semibold uppercase tracking-wider text-blue-100">
                  ค่างวดผ่อนชำระต่อเดือน (รวมภาษีมูลค่าเพิ่ม 7%)
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold my-1.5 tracking-tight">
                  {formatBaht(result.monthlyInstallment)}
                  <span className="text-sm font-normal text-blue-100 ml-1">/ เดือน</span>
                </div>
                <div className="text-xs text-blue-200">
                  ระยะเวลาผ่อนชำระ {result.term} งวด ( {(result.term / 12).toFixed(1)} ปี )
                </div>
              </div>

              {/* Delivery day expenses if applicable */}
              {(result.registrationFee > 0 || result.theftInsuranceFee > 0) && (
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 text-xs space-y-2">
                  <div className="font-bold text-slate-800">สรุปเงินเตรียมพร้อมออกรถ (วันรับรถ)</div>
                  <div className="flex justify-between text-slate-600">
                    <span>• เงินดาวน์:</span>
                    <span>{formatBaht(result.downAmount)}</span>
                  </div>
                  {result.registrationFee > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>• ค่าจดทะเบียน + พ.ร.บ.:</span>
                      <span>{formatBaht(result.registrationFee)}</span>
                    </div>
                  )}
                  {result.theftInsuranceFee > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>• ประกันรถหาย:</span>
                      <span>{formatBaht(result.theftInsuranceFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-blue-800 pt-1 border-t border-slate-200 text-sm">
                    <span>รวมเงินที่ต้องชำระวันออกรถ:</span>
                    <span>{formatBaht(result.totalDriveAwayCost)}</span>
                  </div>
                </div>
              )}

              {/* Signature & Note Footer */}
              <div className="pt-5 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs text-slate-500">
                <div className="space-y-5">
                  <div className="h-8 border-b border-dashed border-slate-300 w-3/4 mx-auto" />
                  <div className="leading-relaxed">
                    ลงชื่อ ....................................................<br />
                    <span className="font-semibold text-slate-800">( {officerNameAndCode || 'ผู้เสนอราคา / เจ้าหน้าที่'} )</span><br />
                    <span className="text-[10px] text-slate-400">ผู้เสนอราคา / เจ้าหน้าที่</span>
                  </div>
                </div>
                <div className="space-y-5">
                  <div className="h-8 border-b border-dashed border-slate-300 w-3/4 mx-auto" />
                  <div className="leading-relaxed">
                    ลงชื่อ ....................................................<br />
                    <span className="font-semibold text-slate-800">( {customerName || 'ลูกค้า / ผู้ขอเช่าซื้อ'} )</span><br />
                    <span className="text-[10px] text-slate-400">ลูกค้า / ผู้ขอเช่าซื้อ</span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-blue-900 text-center font-bold">
                * ยอดจริงอาจมีการเปลี่ยนแปลงตามผลการอนุมัติสินเชื่อ Next Capital
              </div>
              <div className="text-[9.5px] text-slate-500 text-center font-normal">
                (เอกสารนี้เป็นเพียงการจำลองคำนวณค่างวดเบื้องต้นตามเงื่อนไข Proposal เพื่อประกอบการตัดสินใจ)
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
                <span>ระบบคำนวณค่างวดและออกใบเสนอราคา</span>
                <span>•</span>
                <span className="font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                  by Bordin 6683
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
