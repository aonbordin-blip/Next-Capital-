import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Download,
  Printer,
  Copy,
  Check,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { CalculationResult, InsurancePlan, InsuranceYears } from '../types';
import { INSURANCE_PLANS, formatBaht } from '../data/proposals';
import { NextCapitalLogo } from './NextCapitalLogo';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  result: CalculationResult;
  selectedPlan: InsurancePlan;
  selectedYears: InsuranceYears;
  selectedBikeName?: string;
  officerInfo?: string;
  onUpdatePlan?: (plan: InsurancePlan, years: InsuranceYears) => void;
}

export const InsuranceDocModal: React.FC<Props> = ({
  isOpen,
  onClose,
  result,
  selectedPlan: initialPlan,
  selectedYears: initialYears,
  selectedBikeName,
  officerInfo = 'บดินทร์ (6683)',
  onUpdatePlan,
}) => {
  // If user opened with 'none', default to 'plan_b' (the recommended plan)
  const [activePlan, setActivePlan] = useState<InsurancePlan>(
    initialPlan === 'none' ? 'plan_b' : initialPlan
  );
  const [activeYears, setActiveYears] = useState<InsuranceYears>(initialYears || 3);

  // Sync state if props change when opening
  useEffect(() => {
    if (initialPlan && initialPlan !== 'none') {
      setActivePlan(initialPlan);
    }
    if (initialYears) {
      setActiveYears(initialYears);
    }
  }, [initialPlan, initialYears, isOpen]);

  const [documentDate] = useState<string>(
    new Date().toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  );

  const [copied, setCopied] = useState<boolean>(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfSuccessMessage, setPdfSuccessMessage] = useState<string | null>(null);

  // Refs
  const exportTemplateRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const planKey = (activePlan === 'plan_a' ? 'plan_a' : 'plan_b') as 'plan_a' | 'plan_b';
  const planDetail = INSURANCE_PLANS[planKey];
  const isPlanB = planKey === 'plan_b';

  const premiumAmount = planDetail.premiums[activeYears];
  const premiumVat = Math.round(premiumAmount * 0.07 * 100) / 100;
  const premiumTotalWithVat = Math.round((premiumAmount + premiumVat) * 100) / 100;

  // Approximate monthly addition to installment
  const monthlyImpact =
    result.term > 0
      ? Math.round(
          (premiumTotalWithVat +
            premiumTotalWithVat * result.monthlyRate * result.term) /
            result.term
        )
      : Math.round(premiumTotalWithVat / (activeYears * 12));

  const docNumber = `PA-${Math.floor(100000 + (premiumAmount % 900000))}/${new Date().getFullYear() + 543}`;

  // Handle plan switch inside modal
  const handleSelectPlan = (plan: InsurancePlan, years: InsuranceYears) => {
    setActivePlan(plan);
    setActiveYears(years);
    if (onUpdatePlan) {
      onUpdatePlan(plan, years);
    }
  };

  // High quality PDF generation matching standard A4 dimensions
  const handleDownloadPdf = async () => {
    if (!exportTemplateRef.current || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    setPdfSuccessMessage(null);

    try {
      if (document.fonts) {
        await document.fonts.ready;
      }
      await new Promise((r) => setTimeout(r, 100));

      const element = exportTemplateRef.current;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 780,
        windowWidth: 780,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc) => {
          // Remove problematic external CSS rules that cause oklch color parsing errors
          clonedDoc.querySelectorAll('style').forEach((st) => {
            if (
              st.textContent &&
              (st.textContent.includes('oklch') || st.textContent.includes('tailwindcss'))
            ) {
              st.remove();
            }
          });
          clonedDoc.querySelectorAll('link[rel="stylesheet"]').forEach((l) => {
            const href = l.getAttribute('href') || '';
            if (!href.includes('fonts.googleapis.com')) {
              l.remove();
            }
          });

          // Inject clean Prompt font stylesheet
          const cleanStyle = clonedDoc.createElement('style');
          cleanStyle.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Prompt:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');
            * {
              box-sizing: border-box !important;
              font-family: 'Prompt', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
              -webkit-font-smoothing: antialiased !important;
            }
            body {
              background-color: #ffffff !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 780px !important;
              font-family: 'Prompt', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            }
            table {
              border-collapse: collapse !important;
            }
            table th, table td {
              font-family: 'Prompt', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            }
          `;
          clonedDoc.head.appendChild(cleanStyle);
        },
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(
        `NCAP-CoveragePlan-${planKey.toUpperCase()}-${activeYears}Y-${new Date().toISOString().slice(0, 10)}.pdf`
      );

      setPdfSuccessMessage('สร้างและดาวน์โหลดเอกสาร PDF แผนความคุ้มครองเรียบร้อยแล้ว');
      setTimeout(() => setPdfSuccessMessage(null), 4000);
    } catch (err) {
      console.error('PDF export error:', err);
      alert('เกิดข้อผิดพลาดในการดาวน์โหลด PDF กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Quick summary copy for LINE / chat
  const handleCopySummary = async () => {
    const text = `📋 ตารางแผนความคุ้มครองประกันภัยอุบัติเหตุกลุ่ม (Group PA)
🏢 บริษัท เน็กซ์ แคปปิตอล จำกัด (มหาชน) ร่วมกับ LOCKTON
━━━━━━━━━━━━━━━━━━━━
🛡️ แผนความคุ้มครอง: ${planDetail.name}
⏱️ ระยะเวลาคุ้มครอง: ${activeYears} ปี
💰 รวมเบี้ยประกันภัย: ${formatBaht(premiumAmount)} บาท (รวม VAT 7%: ${formatBaht(premiumTotalWithVat, true)} บาท)
💳 รวมในยอดจัดไฟแนนซ์: เพิ่มเพียงประมาณ +${formatBaht(monthlyImpact)} บาท/งวด
🏍️ ยานพาหนะ: ${selectedBikeName || 'รถจักรยานยนต์'}

⭐ สรุปผลประโยชน์ความคุ้มครอง (${planDetail.name}):
1. กรณีอุบัติเหตุทั่วไป (อบ.1): ${formatBaht(planDetail.generalAccident)} บาท
2. กรณีขับขี่หรือโดยสารรถจักรยานยนต์: ${formatBaht(planDetail.motorcycleAccident)} บาท
3. กรณีถูกฆาตกรรมหรือทำร้ายร่างกาย: ${formatBaht(planDetail.assaultMurder)} บาท
4. ค่ารักษาพยาบาล/อุบัติเหตุแต่ละครั้ง: ${formatBaht(planDetail.medicalExpense)} บาท (ไม่ต้องสำรองจ่าย)
5. ค่าปลงศพ (เจ็บป่วย/บาดเจ็บ): ${formatBaht(planDetail.funeralExpense)} บาท
${isPlanB ? `6. ชดเชยรายได้ระหว่างรักษาตัวใน รพ. (IPD): 500 บาท/วัน (สูงสุด 30 วัน/ปี)\n` : ''}━━━━━━━━━━━━━━━━━━━━
📌 คุ้มครองตลอด 24 ชม. ทั่วโลก • สถานพยาบาลคู่สัญญากว่า 400 แห่งทั่วประเทศ
ผู้เสนอขาย: ${officerInfo}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  // Render the single-plan document contents with bright, light, comfortable styling and perfect typography
  const renderDocumentContent = () => (
    <div
      style={{
        width: '100%',
        maxWidth: '780px',
        backgroundColor: '#ffffff',
        padding: '24px 30px',
        boxSizing: 'border-box',
        fontFamily: "'Prompt', -apple-system, BlinkMacSystemFont, sans-serif",
        color: '#1e293b',
        lineHeight: 1.38,
      }}
    >
      {/* 1. Official Document Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '12px',
          borderBottom: '2px solid #0f2744',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <NextCapitalLogo size={50} />
          <div>
            <div
              style={{
                fontSize: '17px',
                fontWeight: '800',
                color: '#0f2744',
                lineHeight: '1.25',
                letterSpacing: '-0.01em',
              }}
            >
              บริษัท เน็กซ์ แคปปิตอล จำกัด (มหาชน)
            </div>
            <div
              style={{
                fontSize: '12.5px',
                color: '#1e40af',
                fontWeight: '700',
                lineHeight: '1.3',
                marginTop: '1px',
              }}
            >
              ตารางแสดงความคุ้มครองและเบี้ยประกันภัยอุบัติเหตุกลุ่ม (Group PA)
            </div>
            <div
              style={{
                fontSize: '10.5px',
                color: '#64748b',
                fontWeight: '500',
                lineHeight: '1.3',
                marginTop: '1px',
              }}
            >
              โครงการพิเศษ PA advised by LOCKTON (บจ. ล็อคตั้น วัฒนา อินชัวรันส์ โบรคเกอร์ส)
            </div>
          </div>
        </div>
        <div
          style={{
            textAlign: 'right',
            fontSize: '11px',
            color: '#475569',
            lineHeight: '1.4',
            flexShrink: 0,
            borderLeft: '1px solid #e2e8f0',
            paddingLeft: '14px',
          }}
        >
          <div style={{ fontWeight: '700', color: '#0f2744', whiteSpace: 'nowrap' }}>
            เลขที่เอกสาร: {docNumber}
          </div>
          <div style={{ color: '#475569', whiteSpace: 'nowrap' }}>
            วันที่: {documentDate}
          </div>
          <div style={{ color: '#1e40af', fontWeight: '600', whiteSpace: 'nowrap' }}>
            ผู้เสนอขาย: {officerInfo}
          </div>
          {selectedBikeName && (
            <div style={{ color: '#64748b', fontSize: '10.5px', whiteSpace: 'nowrap' }}>
              ยานพาหนะ: {selectedBikeName}
            </div>
          )}
        </div>
      </div>

      {/* 2. Selected Plan Spotlight Hero Card - BRIGHT, LIGHT, COMFORTABLE COLORS */}
      <div
        style={{
          background: isPlanB
            ? 'linear-gradient(135deg, #ffffff 0%, #fffdf7 45%, #fef3c7 100%)'
            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #eff6ff 100%)',
          borderRadius: '12px',
          padding: '12px 18px',
          marginTop: '12px',
          marginBottom: '12px',
          border: isPlanB ? '1.5px solid #fde68a' : '1.5px solid #bfdbfe',
          borderLeft: isPlanB ? '5px solid #d97706' : '5px solid #2563eb',
          boxShadow: '0 2px 5px rgba(0, 0, 0, 0.03)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: '3px' }}>
            <span
              style={{
                backgroundColor: isPlanB ? '#fef3c7' : '#dbeafe',
                border: isPlanB ? '1px solid #fde68a' : '1px solid #93c5fd',
                color: isPlanB ? '#92400e' : '#1e40af',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '10px',
                fontWeight: '700',
                display: 'inline-block',
                whiteSpace: 'nowrap',
              }}
            >
              {isPlanB ? '★ แผนที่เลือกเสนอขาย: แผนแนะนำ ยอดนิยม (PA PLUS)' : '🛡️ แผนที่เลือกเสนอขาย: แผนมาตรฐาน (PA ปกติ)'}
            </span>
          </div>

          <div
            style={{
              fontSize: '20px',
              fontWeight: '800',
              lineHeight: '1.25',
              color: '#0f2744',
              whiteSpace: 'nowrap',
            }}
          >
            {planDetail.name} — ระยะเวลาคุ้มครอง {activeYears} ปี
          </div>

          <div
            style={{
              fontSize: '11px',
              color: '#475569',
              lineHeight: '1.3',
              marginTop: '3px',
              whiteSpace: 'nowrap',
            }}
          >
            คุ้มครองตลอด 24 ชม. ทั่วโลก • สถานพยาบาลคู่สัญญาไม่ต้องสำรองจ่าย • รวมในค่างวดเช่าซื้อได้
          </div>
        </div>

        <div
          style={{
            textAlign: 'right',
            flexShrink: 0,
            borderLeft: isPlanB ? '1px solid #fde68a' : '1px solid #dbeafe',
            paddingLeft: '16px',
          }}
        >
          <div
            style={{
              fontSize: '10.5px',
              color: '#64748b',
              fontWeight: '600',
              whiteSpace: 'nowrap',
            }}
          >
            เบี้ยประกันภัยสุทธิ
          </div>
          <div
            style={{
              fontSize: '25px',
              fontWeight: '800',
              lineHeight: '1.15',
              color: '#0f2744',
              whiteSpace: 'nowrap',
              letterSpacing: '-0.02em',
            }}
          >
            {formatBaht(premiumAmount)}{' '}
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>บาท</span>
          </div>
          <div
            style={{
              fontSize: '10px',
              color: '#64748b',
              marginTop: '1px',
              whiteSpace: 'nowrap',
            }}
          >
            (ภาษี 7%: {formatBaht(premiumVat, true)} บ. • รวม VAT: <strong style={{ color: '#0f2744' }}>{formatBaht(premiumTotalWithVat, true)}</strong> บ.)
          </div>
        </div>
      </div>

      {/* 3. Detailed Single-Plan Benefits Table - LIGHT & AIRY */}
      <div
        style={{
          border: '1.5px solid #cbd5e1',
          borderRadius: '10px',
          overflow: 'hidden',
          marginBottom: '11px',
          backgroundColor: '#ffffff',
        }}
      >
        {/* Table Top Banner */}
        <div
          style={{
            backgroundColor: '#f1f5f9',
            borderBottom: '1.5px solid #cbd5e1',
            color: '#0f2744',
            padding: '7px 14px',
            fontWeight: '700',
            fontSize: '11.5px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            ตารางผลประโยชน์และความคุ้มครองเฉพาะ {planDetail.name}
          </span>
          <span
            style={{
              fontSize: '10px',
              fontWeight: '600',
              color: '#1e40af',
              whiteSpace: 'nowrap',
            }}
          >
            ความคุ้มครอง {activeYears} ปี • สถานพยาบาลคู่สัญญากว่า 400 แห่งทั่วประเทศ
          </span>
        </div>

        <table
          style={{
            width: '100%',
            fontSize: '11px',
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
          }}
        >
          <colgroup>
            <col style={{ width: '8%' }} />
            <col style={{ width: '64%' }} />
            <col style={{ width: '28%' }} />
          </colgroup>
          <thead>
            <tr
              style={{
                backgroundColor: '#f8fafc',
                borderBottom: '1.5px solid #cbd5e1',
                color: '#334155',
              }}
            >
              <th
                style={{
                  padding: '7px 8px',
                  textAlign: 'center',
                  fontWeight: '700',
                  verticalAlign: 'middle',
                  whiteSpace: 'nowrap',
                }}
              >
                ลำดับ
              </th>
              <th
                style={{
                  padding: '7px 12px',
                  textAlign: 'left',
                  fontWeight: '700',
                  verticalAlign: 'middle',
                  whiteSpace: 'nowrap',
                }}
              >
                รายการผลประโยชน์ความคุ้มครอง
              </th>
              <th
                style={{
                  padding: '7px 14px',
                  textAlign: 'right',
                  fontWeight: '700',
                  verticalAlign: 'middle',
                  whiteSpace: 'nowrap',
                  backgroundColor: isPlanB ? '#fffbeb' : '#eff6ff',
                  color: isPlanB ? '#92400e' : '#1e40af',
                  borderLeft: '1px solid #e2e8f0',
                }}
              >
                วงเงินความคุ้มครอง
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Category 1 Header */}
            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
              <td
                colSpan={3}
                style={{
                  padding: '5px 12px',
                  fontWeight: '700',
                  color: '#0f2744',
                  fontSize: '10.5px',
                  verticalAlign: 'middle',
                  whiteSpace: 'nowrap',
                }}
              >
                หมวดที่ 1: การเสียชีวิต สูญเสียอวัยวะ สายตา หรือทุพพลภาพถาวรสิ้นเชิง (อบ.1)
              </td>
            </tr>

            {/* 1.1 General Accident */}
            <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#ffffff' }}>
              <td
                style={{
                  padding: '6px 8px',
                  textAlign: 'center',
                  color: '#64748b',
                  fontWeight: '600',
                  verticalAlign: 'middle',
                  whiteSpace: 'nowrap',
                }}
              >
                1.1
              </td>
              <td
                style={{
                  padding: '6px 12px',
                  color: '#1e293b',
                  verticalAlign: 'middle',
                  lineHeight: '1.3',
                }}
              >
                <div style={{ fontWeight: '600', color: '#0f2744', whiteSpace: 'nowrap' }}>
                  กรณีอุบัติเหตุทั่วไป (ตลอด 24 ชั่วโมง ทั่วโลก)
                </div>
                <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '1px', whiteSpace: 'nowrap' }}>
                  คุ้มครองอุบัติเหตุทั่วไปทั้งในและต่างประเทศ
                </div>
              </td>
              <td
                style={{
                  padding: '6px 14px',
                  textAlign: 'right',
                  fontWeight: '800',
                  fontSize: '12px',
                  color: isPlanB ? '#b45309' : '#1e40af',
                  verticalAlign: 'middle',
                  whiteSpace: 'nowrap',
                  backgroundColor: isPlanB ? '#fffdf7' : '#f8faff',
                  borderLeft: '1px solid #f1f5f9',
                }}
              >
                {formatBaht(planDetail.generalAccident)} บาท
              </td>
            </tr>

            {/* 1.2 Motorcycle Accident */}
            <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#fafbfc' }}>
              <td
                style={{
                  padding: '6px 8px',
                  textAlign: 'center',
                  color: '#64748b',
                  fontWeight: '600',
                  verticalAlign: 'middle',
                  whiteSpace: 'nowrap',
                }}
              >
                1.2
              </td>
              <td
                style={{
                  padding: '6px 12px',
                  color: '#1e293b',
                  verticalAlign: 'middle',
                  lineHeight: '1.3',
                }}
              >
                <div style={{ fontWeight: '600', color: '#0f2744', whiteSpace: 'nowrap' }}>
                  กรณีการขับขี่ หรือโดยสารรถจักรยานยนต์
                </div>
                <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '1px', whiteSpace: 'nowrap' }}>
                  คุ้มครองครอบคลุมทั้งผู้ขับขี่และผู้ซ้อนท้ายรถจักรยานยนต์
                </div>
              </td>
              <td
                style={{
                  padding: '6px 14px',
                  textAlign: 'right',
                  fontWeight: '800',
                  fontSize: '12px',
                  color: isPlanB ? '#b45309' : '#1e40af',
                  verticalAlign: 'middle',
                  whiteSpace: 'nowrap',
                  backgroundColor: isPlanB ? '#fffdf7' : '#f8faff',
                  borderLeft: '1px solid #f1f5f9',
                }}
              >
                {formatBaht(planDetail.motorcycleAccident)} บาท
              </td>
            </tr>

            {/* 1.3 Assault / Murder */}
            <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#ffffff' }}>
              <td
                style={{
                  padding: '6px 8px',
                  textAlign: 'center',
                  color: '#64748b',
                  fontWeight: '600',
                  verticalAlign: 'middle',
                  whiteSpace: 'nowrap',
                }}
              >
                1.3
              </td>
              <td
                style={{
                  padding: '6px 12px',
                  color: '#1e293b',
                  verticalAlign: 'middle',
                  lineHeight: '1.3',
                }}
              >
                <div style={{ fontWeight: '600', color: '#0f2744', whiteSpace: 'nowrap' }}>
                  กรณีการถูกฆาตกรรม หรือถูกทำร้ายร่างกาย
                </div>
                <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '1px', whiteSpace: 'nowrap' }}>
                  คุ้มครองกรณีถูกลอบทำร้ายโดยมิได้มีเจตนาร่วม
                </div>
              </td>
              <td
                style={{
                  padding: '6px 14px',
                  textAlign: 'right',
                  fontWeight: '800',
                  fontSize: '12px',
                  color: isPlanB ? '#b45309' : '#1e40af',
                  verticalAlign: 'middle',
                  whiteSpace: 'nowrap',
                  backgroundColor: isPlanB ? '#fffdf7' : '#f8faff',
                  borderLeft: '1px solid #f1f5f9',
                }}
              >
                {formatBaht(planDetail.assaultMurder)} บาท
              </td>
            </tr>

            {/* Category 2 Header */}
            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', borderTop: '1px solid #cbd5e1' }}>
              <td
                colSpan={3}
                style={{
                  padding: '5px 12px',
                  fontWeight: '700',
                  color: '#0f2744',
                  fontSize: '10.5px',
                  verticalAlign: 'middle',
                  whiteSpace: 'nowrap',
                }}
              >
                หมวดที่ 2: ค่ารักษาพยาบาลและค่าใช้จ่ายปลงศพ
              </td>
            </tr>

            {/* 2.1 Medical Expense */}
            <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#ffffff' }}>
              <td
                style={{
                  padding: '6px 8px',
                  textAlign: 'center',
                  color: '#64748b',
                  fontWeight: '600',
                  verticalAlign: 'middle',
                  whiteSpace: 'nowrap',
                }}
              >
                2.1
              </td>
              <td
                style={{
                  padding: '6px 12px',
                  color: '#1e293b',
                  verticalAlign: 'middle',
                  lineHeight: '1.3',
                }}
              >
                <div style={{ fontWeight: '600', color: '#0f2744', whiteSpace: 'nowrap' }}>
                  ค่ารักษาพยาบาลต่ออุบัติเหตุแต่ละครั้ง
                </div>
                <div style={{ fontSize: '9.5px', color: '#166534', marginTop: '1px', fontWeight: '500', whiteSpace: 'nowrap' }}>
                  ✓ ไม่ต้องสำรองจ่ายในสถานพยาบาลคู่สัญญากว่า 400 แห่งทั่วประเทศ
                </div>
              </td>
              <td
                style={{
                  padding: '6px 14px',
                  textAlign: 'right',
                  fontWeight: '800',
                  fontSize: '12px',
                  color: '#15803d',
                  verticalAlign: 'middle',
                  whiteSpace: 'nowrap',
                  backgroundColor: isPlanB ? '#fffdf7' : '#f8faff',
                  borderLeft: '1px solid #f1f5f9',
                }}
              >
                {formatBaht(planDetail.medicalExpense)} บาท
              </td>
            </tr>

            {/* 2.2 Funeral Expense */}
            <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#fafbfc' }}>
              <td
                style={{
                  padding: '6px 8px',
                  textAlign: 'center',
                  color: '#64748b',
                  fontWeight: '600',
                  verticalAlign: 'middle',
                  whiteSpace: 'nowrap',
                }}
              >
                2.2
              </td>
              <td
                style={{
                  padding: '6px 12px',
                  color: '#1e293b',
                  verticalAlign: 'middle',
                  lineHeight: '1.3',
                }}
              >
                <div style={{ fontWeight: '600', color: '#0f2744', whiteSpace: 'nowrap' }}>
                  ค่าปลงศพและค่าใช้จ่ายในการจัดการงานศพ
                </div>
                <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '1px', whiteSpace: 'nowrap' }}>
                  กรณีเสียชีวิตจากการบาดเจ็บหรือเจ็บป่วย (กรณีเจ็บป่วยมีระยะเวลารอคอย 180 วัน)
                </div>
              </td>
              <td
                style={{
                  padding: '6px 14px',
                  textAlign: 'right',
                  fontWeight: '800',
                  fontSize: '12px',
                  color: '#0f172a',
                  verticalAlign: 'middle',
                  whiteSpace: 'nowrap',
                  backgroundColor: isPlanB ? '#fffdf7' : '#f8faff',
                  borderLeft: '1px solid #f1f5f9',
                }}
              >
                {formatBaht(planDetail.funeralExpense)} บาท
              </td>
            </tr>

            {/* Category 3: Special Hospital Compensation for Plan B */}
            {isPlanB && (
              <>
                <tr style={{ backgroundColor: '#fef3c7', borderBottom: '1px solid #fde68a', borderTop: '1px solid #cbd5e1' }}>
                  <td
                    colSpan={3}
                    style={{
                      padding: '5px 12px',
                      fontWeight: '700',
                      color: '#92400e',
                      fontSize: '10.5px',
                      verticalAlign: 'middle',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    หมวดที่ 3: ★ สิทธิประโยชน์พิเศษเฉพาะแผน B (PA PLUS)
                  </td>
                </tr>
                <tr style={{ backgroundColor: '#fffbeb' }}>
                  <td
                    style={{
                      padding: '7px 8px',
                      textAlign: 'center',
                      color: '#b45309',
                      fontWeight: '700',
                      verticalAlign: 'middle',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    3.1
                  </td>
                  <td
                    style={{
                      padding: '7px 12px',
                      color: '#1e293b',
                      verticalAlign: 'middle',
                      lineHeight: '1.3',
                    }}
                  >
                    <div style={{ fontWeight: '700', color: '#92400e', whiteSpace: 'nowrap' }}>
                      เงินชดเชยรายได้ระหว่างรักษาตัวในโรงพยาบาล (IPD) จากอุบัติเหตุ
                    </div>
                    <div style={{ fontSize: '9.5px', color: '#b45309', marginTop: '1px', whiteSpace: 'nowrap' }}>
                      ชดเชยวันละ 500 บาท สูงสุด 30 วัน/ปี (สิทธิประโยชน์พิเศษเฉพาะแผน B)
                    </div>
                  </td>
                  <td
                    style={{
                      padding: '7px 14px',
                      textAlign: 'right',
                      fontWeight: '800',
                      fontSize: '12.5px',
                      color: '#b45309',
                      verticalAlign: 'middle',
                      whiteSpace: 'nowrap',
                      borderLeft: '1px solid #fde68a',
                    }}
                  >
                    500 บาท / วัน
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Single-Plan Premium Rates Breakdown - CLEAN, NO OVERLAP */}
      <div
        style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '10px',
          padding: '8px 12px',
          marginBottom: '10px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '6px',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '3px',
          }}
        >
          <span style={{ fontWeight: '700', fontSize: '10.5px', color: '#0f2744', whiteSpace: 'nowrap' }}>
            อัตราเบี้ยประกันภัยสุทธิต่อคนสำหรับ {planDetail.name} (รวมอากรแสตมป์ 20 บาท/กรมธรรม์)
          </span>
          <span style={{ fontSize: '9.5px', color: '#1e40af', fontWeight: '600', whiteSpace: 'nowrap' }}>
            เลือกผ่อนรวมในสัญญาเช่าซื้อได้ทันที
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          {([1, 2, 3] as InsuranceYears[]).map((y) => {
            const isSelected = activeYears === y;
            const termCost = planDetail.premiums[y];
            const termVat = Math.round(termCost * 0.07 * 100) / 100;
            const termTotal = Math.round((termCost + termVat) * 100) / 100;

            return (
              <div
                key={y}
                style={{
                  backgroundColor: isSelected
                    ? isPlanB
                      ? '#fffbeb'
                      : '#eff6ff'
                    : '#ffffff',
                  border: isSelected
                    ? isPlanB
                      ? '1.8px solid #d97706'
                      : '1.8px solid #2563eb'
                    : '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '6px 8px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    marginBottom: '2px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: '700',
                      color: isSelected
                        ? isPlanB
                          ? '#92400e'
                          : '#1e40af'
                        : '#475569',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ความคุ้มครอง {y} ปี
                  </span>
                  {isSelected && (
                    <span
                      style={{
                        fontSize: '8.5px',
                        backgroundColor: isPlanB ? '#d97706' : '#2563eb',
                        color: '#ffffff',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        fontWeight: '700',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      ★ แผนที่เลือก
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: '800',
                    color: isSelected
                      ? isPlanB
                        ? '#92400e'
                        : '#1e40af'
                      : '#0f172a',
                    lineHeight: '1.2',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatBaht(termCost)} บาท
                </div>
                <div
                  style={{
                    fontSize: '9px',
                    color: '#64748b',
                    marginTop: '1px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  รวม VAT: {formatBaht(termTotal, true)} บาท
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Financing Benefit Note & Key Highlights - CLEAN & NO WRAPPING */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.65fr 1fr',
          gap: '8px',
          marginBottom: '10px',
        }}
      >
        <div
          style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '10px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div style={{ fontWeight: '700', color: '#166534', marginBottom: '2px', whiteSpace: 'nowrap' }}>
            💳 สิทธิพิเศษสินเชื่อเช่าซื้อ NCAP: รวมในยอดจัดไฟแนนซ์ได้
          </div>
          <div style={{ color: '#15803d', lineHeight: '1.3', whiteSpace: 'nowrap' }}>
            ไม่ต้องจ่ายเงินสดวันรับรถ • ผ่อนเพิ่มเฉลี่ยเพียงประมาณ{' '}
            <strong style={{ fontSize: '10.5px', color: '#14532d' }}>
              +{formatBaht(monthlyImpact)} บาท/งวด
            </strong>
          </div>
          <div style={{ color: '#166534', fontSize: '9px', marginTop: '1px', whiteSpace: 'nowrap' }}>
            (คำนวณจากงวดเช่าซื้อ {result.term} งวด • อนุมัติความคุ้มครองพร้อมสัญญาเช่าซื้อ)
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '8px',
            padding: '6px 10px',
            fontSize: '9.5px',
            color: '#1e40af',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            lineHeight: '1.35',
          }}
        >
          <div style={{ whiteSpace: 'nowrap' }}>
            <strong>✓ คุ้มครองทันที</strong> ตลอด 24 ชม. ทั่วโลก
          </div>
          <div style={{ whiteSpace: 'nowrap' }}>
            <strong>✓ สถานพยาบาลคู่สัญญา</strong> ไม่ต้องสำรองจ่าย
          </div>
        </div>
      </div>

      {/* 6. Official Signatures Block - CLEAN, AMPLE SPACING */}
      <div
        style={{
          paddingTop: '8px',
          borderTop: '1px solid #cbd5e1',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
          textAlign: 'center',
          fontSize: '10.5px',
          color: '#475569',
          marginBottom: '4px',
        }}
      >
        <div>
          <div style={{ height: '28px' }} />
          <div
            style={{
              borderBottom: '1px dotted #94a3b8',
              width: '210px',
              margin: '0 auto 4px auto',
            }}
          />
          <div style={{ fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap' }}>
            ( {officerInfo || 'ผู้เสนอขาย / เจ้าหน้าที่'} )
          </div>
          <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '1px', whiteSpace: 'nowrap' }}>
            ผู้เสนอขาย / เจ้าหน้าที่ บมจ. เน็กซ์ แคปปิตอล
          </div>
        </div>
        <div>
          <div style={{ height: '28px' }} />
          <div
            style={{
              borderBottom: '1px dotted #94a3b8',
              width: '210px',
              margin: '0 auto 4px auto',
            }}
          />
          <div style={{ fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap' }}>
            ( ............................................................ )
          </div>
          <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '1px', whiteSpace: 'nowrap' }}>
            ผู้เอาประกันภัย / ลูกค้าผู้ขอเช่าซื้อ
          </div>
        </div>
      </div>

      {/* 7. Footer Note */}
      <div
        style={{
          fontSize: '8.5px',
          color: '#94a3b8',
          textAlign: 'center',
          lineHeight: 1.25,
          paddingTop: '3px',
          whiteSpace: 'nowrap',
        }}
      >
        * โครงการประกันภัยอุบัติเหตุกลุ่ม PA advised by LOCKTON (บจ. ล็อคตั้น วัฒนา อินชัวรันส์ โบรคเกอร์ส) ร่วมกับ บมจ. เน็กซ์ แคปปิตอล • พัฒนาระบบโดย Bordin 6683
      </div>
    </div>
  );

  return (
    <>
      {/* 
        ================================================================
        HIGH-RESOLUTION EXPORT TEMPLATE FOR PDF GENERATION
        Rendered permanently offscreen (left: -10000px, zIndex: -9999).
        Cloned by html2canvas to render pixel-perfect single-plan A4 document.
        ================================================================
      */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: '-10000px',
          width: '780px',
          zIndex: -9999,
          pointerEvents: 'none',
          backgroundColor: '#ffffff',
          overflow: 'hidden',
        }}
      >
        <div id="ncap-insurance-export-root" ref={exportTemplateRef}>
          {renderDocumentContent()}
        </div>
      </div>

      {/* 
        ================================================================
        INTERACTIVE SCREEN MODAL
        Modern, executive modal for previewing and downloading the document
        ================================================================
      */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
        <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto border border-slate-200">
          {/* Header Action Bar */}
          <div className="flex flex-wrap items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-amber-50/70">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-amber-600 text-white flex items-center justify-center shadow-md shadow-blue-700/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    เอกสารแผนความคุ้มครอง {planDetail.name}
                  </h2>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isPlanB
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-blue-100 text-blue-800 border border-blue-300'
                    }`}
                  >
                    LOCKTON
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  แสดงเฉพาะแผนที่เลือกเสนอขาย ({planDetail.name} • คุ้มครอง {activeYears} ปี)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2 sm:mt-0">
              <button
                type="button"
                onClick={handleCopySummary}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                title="คัดลอกข้อความสรุปสำหรับส่งลูกค้าทาง LINE"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>คัดลอกแล้ว</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>คัดลอกสรุป</span>
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
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 hover:opacity-95 text-white text-xs font-bold shadow-md shadow-blue-700/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isGeneratingPdf ? 'กำลังสร้าง PDF...' : 'ดาวน์โหลด PDF'}</span>
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

          {pdfSuccessMessage && (
            <div className="px-5 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between animate-fade-in">
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                {pdfSuccessMessage}
              </span>
              <button
                onClick={() => setPdfSuccessMessage(null)}
                className="text-emerald-600 hover:underline text-[10px]"
              >
                ปิด
              </button>
            </div>
          )}

          {/* Modal Interactive Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs text-slate-700 bg-slate-50/50">
            {/* Quick Plan Switcher */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-700" />
                  เลือกแผนความคุ้มครองที่ต้องการแสดงในเอกสาร:
                </span>
                <span className="text-[11px] text-slate-500">
                  (เอกสารจะแสดงเฉพาะแผนที่เลือกเท่านั้น)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Plan A Switch */}
                <button
                  type="button"
                  onClick={() => handleSelectPlan('plan_a', activeYears)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    activePlan === 'plan_a'
                      ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-600/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-900 text-xs">
                      แผน A (PA ปกติ)
                    </span>
                    <span className="text-[10px] text-blue-700 font-bold bg-blue-100 px-1.5 py-0.5 rounded-full">
                      มาตรฐาน
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    คุ้มครองอุบัติเหตุ 80,000 บ. • ค่ารักษา 1,000 บ.
                  </div>
                </button>

                {/* Plan B Switch */}
                <button
                  type="button"
                  onClick={() => handleSelectPlan('plan_b', activeYears)}
                  className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden cursor-pointer ${
                    activePlan === 'plan_b'
                      ? 'border-amber-500 bg-amber-50/80 ring-2 ring-amber-500/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1">
                      แผน B (PA PLUS)
                      <Sparkles className="w-3 h-3 text-amber-600" />
                    </span>
                    <span className="text-[10px] text-amber-900 font-bold bg-amber-100 px-1.5 py-0.5 rounded-full">
                      ★ แนะนำ ยอดนิยม
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    คุ้มครอง 200,000 บ. • ชดเชยรายวัน 500 บ./วัน
                  </div>
                </button>
              </div>

              {/* Years Selector */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] text-slate-500 font-medium">
                  ระยะเวลา:
                </span>
                <div className="flex-1 grid grid-cols-3 gap-2">
                  {([1, 2, 3] as InsuranceYears[]).map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => handleSelectPlan(activePlan, y)}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeYears === y
                          ? activePlan === 'plan_b'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-blue-800 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {y} ปี ({formatBaht(planDetail.premiums[y])} บ.)
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Document Preview Card */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  ตัวอย่างเอกสารที่จะพิมพ์ / บันทึกเป็น PDF (เฉพาะ{planDetail.name}):
                </span>
                <span className="text-[11px] text-slate-400">ขนาด 1 หน้า A4 • สีสว่าง สบายตา</span>
              </div>

              <div className="bg-slate-200/80 p-2 sm:p-4 rounded-2xl flex justify-center overflow-x-auto shadow-inner">
                <div className="bg-white rounded-xl shadow-lg border border-slate-300 transform scale-[0.98] sm:scale-100 origin-top">
                  {renderDocumentContent()}
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-5 py-3 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="text-slate-500 text-[11px]">
              แสดงเฉพาะแผน <strong className="text-slate-800">{planDetail.name}</strong> • ระยะเวลา{' '}
              <strong className="text-slate-800">{activeYears} ปี</strong> • เบี้ยสุทธิ{' '}
              <strong className="text-blue-800">{formatBaht(premiumAmount)} บาท</strong>
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
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 hover:opacity-95 text-white font-bold shadow-md shadow-blue-700/20 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isGeneratingPdf ? 'กำลังดาวน์โหลด...' : 'ดาวน์โหลด PDF แผนนี้'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
