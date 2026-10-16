import React, { useState, useRef } from 'react';
import {
  X,
  Printer,
  Check,
  FileText,
  Share2,
  Shield,
  Calendar,
  User,
  Download,
  Loader2,
  FileCheck2,
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { CalculationResult } from '../types';
import { formatBaht } from '../data/proposals';
import { NextCapitalLogo } from './NextCapitalLogo';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  result: CalculationResult;
  selectedBikeName?: string;
}

export const QuotationModal: React.FC<Props> = ({
  isOpen,
  onClose,
  result,
  selectedBikeName,
}) => {
  const [dealerName, setDealerName] = useState<string>(
    'บริษัท เน็กซ์ แคปปิตอล จำกัด (มหาชน) - Next Capital'
  );
  const [customerName, setCustomerName] = useState<string>('คุณลูกค้า');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [modelName, setModelName] = useState<string>(selectedBikeName || 'รถจักรยานยนต์');
  const [quotationDate] = useState<string>(
    new Date().toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  );
  const [copied, setCopied] = useState<boolean>(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfSuccessMessage, setPdfSuccessMessage] = useState<string | null>(null);

  const quotationRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // Standard A4 PDF Generation with Auto-Fit & Margins (Zero Truncation on Mobile & Desktop)
  const handleDownloadPdf = async () => {
    if (!quotationRef.current || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    setPdfSuccessMessage(null);

    try {
      // Ensure web fonts are rendered before rasterizing
      if (document.fonts) {
        await document.fonts.ready;
      }

      const element = quotationRef.current;

      // Rasterize using html2canvas with standard A4 dimensions (794px width)
      const canvas = await html2canvas(element, {
        scale: 2, // High resolution (retina / 300dpi equivalent)
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: 840,
        onclone: (clonedDoc, clonedElement) => {
          // Force cloned element into exact standard A4 sheet proportion and layout
          clonedElement.style.width = '794px';
          clonedElement.style.maxWidth = '794px';
          clonedElement.style.minWidth = '794px';
          clonedElement.style.height = 'auto';
          clonedElement.style.maxHeight = 'none';
          clonedElement.style.overflow = 'visible';
          clonedElement.style.boxSizing = 'border-box';
          clonedElement.style.padding = '32px 36px';
          clonedElement.style.margin = '0 auto';
          clonedElement.style.background = '#ffffff';
          clonedElement.style.borderRadius = '0';
          clonedElement.style.boxShadow = 'none';
          clonedElement.style.border = 'none';

          // Convert all input elements into clean, unclipped text spans in the PDF
          const inputs = clonedElement.querySelectorAll('input');
          inputs.forEach((input) => {
            const span = clonedDoc.createElement('span');
            span.textContent = input.value || input.placeholder || '';
            span.className = input.className;
            span.style.display = 'inline-block';
            span.style.width = 'auto';
            span.style.maxWidth = '100%';
            span.style.border = 'none';
            span.style.background = 'transparent';
            span.style.padding = '0';
            span.style.color = '#0f172a';
            if (input.parentNode) {
              input.parentNode.replaceChild(span, input);
            }
          });

          // Ensure hide elements marked with no-print
          const noPrintEls = clonedElement.querySelectorAll('.no-print');
          noPrintEls.forEach((el) => {
            (el as HTMLElement).style.display = 'none';
          });
        },
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const pageWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const margin = 8; // 8mm safe printable margin
      const usableWidth = pageWidth - margin * 2; // 194mm
      const usableHeight = pageHeight - margin * 2; // 281mm

      const contentRatio = canvas.width / canvas.height;

      // Calculate width and height that fit completely within 1 A4 page
      let renderWidth = usableWidth;
      let renderHeight = usableWidth / contentRatio;

      // If content height exceeds usable A4 height, scale down proportionately
      if (renderHeight > usableHeight) {
        renderHeight = usableHeight;
        renderWidth = usableHeight * contentRatio;
      }

      // Center horizontally and vertically within safe margins
      const posX = margin + (usableWidth - renderWidth) / 2;
      const posY = margin + (usableHeight - renderHeight) / 2;

      pdf.addImage(
        imgData,
        'PNG',
        posX,
        posY,
        renderWidth,
        renderHeight,
        undefined,
        'FAST'
      );

      const fileName = `ใบเสนอราคา_${modelName.replace(/\s+/g, '_')}_NextCapital_A4.pdf`;
      pdf.save(fileName);

      setPdfSuccessMessage('บันทึกเอกสาร A4 เป็นไฟล์ PDF เรียบร้อยแล้ว (ไม่ตกขอบ 100%)');
      setTimeout(() => setPdfSuccessMessage(null), 3500);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      try {
        window.print();
      } catch {
        alert('เกิดข้อผิดพลาดในการสร้าง PDF');
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Browser print with fallback to direct PDF download
  const handlePrint = () => {
    document.body.classList.add('printing-quotation-only');
    const handleAfterPrint = () => {
      document.body.classList.remove('printing-quotation-only');
      window.removeEventListener('afterprint', handleAfterPrint);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    try {
      window.print();
    } catch {
      handleDownloadPdf();
    }
  };

  const handleCopyChatText = async () => {
    const text = `📋 ใบเสนอราคาเช่าซื้อรถจักรยานยนต์
━━━━━━━━━━━━━━━━━━━━
🏢 ผู้เสนอ: ${dealerName}
👤 ลูกค้า: ${customerName} ${customerPhone ? `(${customerPhone})` : ''}
📅 วันที่: ${quotationDate}
━━━━━━━━━━━━━━━━━━━━
🏍️ รุ่นรถ: ${modelName}
🏷️ ราคารถตัวเปล่า: ${formatBaht(result.baseVehiclePrice)}
💰 เงินดาวน์: ${formatBaht(result.downAmount)} (${result.downPercent.toFixed(1)}%)
🛵 ยอดจัดเฉพาะตัวรถ: ${formatBaht(result.vehicleFinanceAmount)}
${
  result.insuranceTotalWithVat > 0
    ? `🛡️ ประกันภัย: ${result.insurancePlanName}
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
📌 หมายเหตุ: ${result.remarkText}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  return (
    <div className="quotation-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="quotation-paper-modal bg-slate-100 rounded-2xl sm:rounded-3xl w-full max-w-4xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden my-auto border border-slate-300">
        {/* Modal Action Bar (Hidden when printing) */}
        <div className="no-print flex flex-wrap items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200 bg-white/95 backdrop-blur-md gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-blue-800 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-800">
                  ใบเสนอราคาเช่าซื้อ (Quotation)
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  <FileCheck2 className="w-3 h-3 text-blue-600" /> รูปแบบ A4 พอดีขอบ
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                ขนาดกระดาษมาตรฐาน A4 (210 × 297 มม.) บันทึกเป็น PDF หรือพิมพ์ได้ทันที
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={handleCopyChatText}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
              title="คัดลอกข้อความสรุปสำหรับส่งทางแชต LINE"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" /> คัดลอกสำเร็จ!
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" /> ส่ง LINE
                </>
              )}
            </button>

            {/* Direct Instant A4 PDF Download Button */}
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-blue-700 to-indigo-700 hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-700/20 transition-all cursor-pointer disabled:opacity-50"
              title="บันทึกเป็นไฟล์ PDF ขนาด A4 พอดีหน้ากระดาษ"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังสร้าง PDF...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" /> ดาวน์โหลด PDF (A4)
                </>
              )}
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
              title="สั่งพิมพ์ผ่านหน้าต่างเบราว์เซอร์"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" /> พิมพ์
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Success Alert Banner if PDF generated */}
        {pdfSuccessMessage && (
          <div className="no-print bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs px-5 py-2 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">{pdfSuccessMessage}</span>
          </div>
        )}

        {/* Scrollable Viewport containing the A4 Sheet Document */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-5 bg-slate-200/50">
          {/* Printable & Canvas-Capturable A4 Quotation Sheet */}
          <div
            ref={quotationRef}
            className="quotation-a4-sheet bg-white mx-auto p-5 sm:p-6 space-y-3 text-slate-800 rounded-xl shadow-lg border border-slate-200/80 max-w-[794px]"
            style={{ width: '100%', boxSizing: 'border-box', pageBreakInside: 'avoid', breakInside: 'avoid' }}
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3.5 border-b border-slate-200 gap-3">
              <div className="flex items-center gap-3">
                <NextCapitalLogo size={42} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <input
                      type="text"
                      value={dealerName}
                      onChange={(e) => setDealerName(e.target.value)}
                      className="font-bold text-base sm:text-lg text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-blue-700 focus:outline-none transition-colors w-full"
                      placeholder="ชื่อศูนย์บริการ / ตัวแทนจำหน่าย"
                    />
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    ใบเสนอราคาเช่าซื้อรถจักรยานยนต์ (Hire Purchase Quotation)
                  </p>
                </div>
              </div>
              <div className="text-left sm:text-right space-y-1 text-xs text-slate-500 shrink-0">
                <div className="font-semibold text-slate-700">
                  เลขที่เอกสาร: QT-{Math.floor(100000 + (result.vehiclePrice % 900000))}
                </div>
                <div className="flex items-center sm:justify-end gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 no-print" />
                  <span>วันที่: {quotationDate}</span>
                </div>
              </div>
            </div>

            {/* Customer & Vehicle Info Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200/90 text-xs">
              <div className="space-y-1.5">
                <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" /> ข้อมูลลูกค้า
                </div>
                <div className="grid grid-cols-3 gap-2 items-center">
                  <span className="text-slate-500">ชื่อลูกค้า:</span>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="col-span-2 bg-white px-2 py-1 rounded border border-slate-200 font-medium text-slate-800"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 items-center">
                  <span className="text-slate-500">เบอร์โทรศัพท์:</span>
                  <input
                    type="text"
                    placeholder="08X-XXX-XXXX"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="col-span-2 bg-white px-2 py-1 rounded border border-slate-200 text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-slate-400" /> ข้อมูลยานพาหนะและข้อเสนอ
                </div>
                <div className="grid grid-cols-3 gap-2 items-center">
                  <span className="text-slate-500">รุ่นรถ:</span>
                  <input
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    className="col-span-2 bg-white px-2 py-1 rounded border border-slate-200 font-bold text-blue-900"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 items-center">
                  <span className="text-slate-500">รหัสข้อเสนอ:</span>
                  <span className="col-span-2 font-mono text-[11px] text-slate-800 font-bold">
                    {result.proposalCode}
                  </span>
                </div>
              </div>
            </div>

            {/* Core Table Breakdown */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-xs">
                <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3.5 text-left">รายการ</th>
                    <th className="py-2 px-3.5 text-right whitespace-nowrap">จำนวนเงิน (บาท)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2 px-3.5 font-medium text-slate-700">
                      1. ราคารถตัวเปล่า (Base Vehicle Price)
                    </td>
                    <td className="py-2 px-3.5 text-right font-semibold text-slate-900 whitespace-nowrap">
                      {formatBaht(result.baseVehiclePrice)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3.5 font-medium text-slate-700">
                      2. เงินดาวน์ (Down Payment) ({result.downPercent.toFixed(1)}%)
                    </td>
                    <td className="py-2 px-3.5 text-right text-emerald-700 font-semibold whitespace-nowrap">
                      - {formatBaht(result.downAmount)}
                    </td>
                  </tr>
                  <tr className="bg-slate-50/70 font-semibold">
                    <td className="py-2 px-3.5 text-slate-800">
                      3. ยอดจัดเฉพาะตัวรถ (Vehicle Finance Amount)
                    </td>
                    <td className="py-2 px-3.5 text-right font-bold text-slate-900 whitespace-nowrap">
                      {formatBaht(result.vehicleFinanceAmount)}
                    </td>
                  </tr>
                  {result.insuranceTotalWithVat > 0 && (
                    <>
                      <tr className="bg-blue-50/40">
                        <td className="py-1.5 px-3.5 text-blue-900 pl-6">
                          • ค่าเบี้ยประกันภัย PA ({result.insurancePlanName})
                        </td>
                        <td className="py-1.5 px-3.5 text-right text-blue-900 font-medium whitespace-nowrap">
                          +{formatBaht(result.insuranceBasePremium)}
                        </td>
                      </tr>
                      <tr className="bg-blue-50/40">
                        <td className="py-1.5 px-3.5 text-blue-900 pl-6">
                          • ภาษีมูลค่าเพิ่ม 7% ของค่าเบี้ยประกัน
                        </td>
                        <td className="py-1.5 px-3.5 text-right text-blue-900 font-medium whitespace-nowrap">
                          +{formatBaht(result.insuranceVat, true)}
                        </td>
                      </tr>
                      <tr className="bg-blue-50/80 font-bold border-y border-blue-200/60">
                        <td className="py-2 px-3.5 text-blue-950">
                          + ค่าเบี้ยประกันรวมภาษี 7% (Insurance with VAT)
                        </td>
                        <td className="py-2 px-3.5 text-right text-blue-900 font-bold whitespace-nowrap">
                          +{formatBaht(result.insuranceTotalWithVat, true)}
                        </td>
                      </tr>
                    </>
                  )}
                  <tr className="bg-indigo-50/60 font-bold">
                    <td className="py-2 px-3.5 text-indigo-950">
                      4. ยอดจัดไฟแนนซ์รวม (Total Finance Amount)
                    </td>
                    <td className="py-2 px-3.5 text-right text-indigo-900 font-extrabold whitespace-nowrap">
                      {formatBaht(result.financeAmount, true)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3.5 text-slate-700">
                      5. อัตราดอกเบี้ย ({result.rateDisplayText})
                    </td>
                    <td className="py-2 px-3.5 text-right text-blue-700 font-bold whitespace-nowrap">
                      {result.rateDisplayText}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3.5 text-slate-700">
                      6. ดอกเบี้ยรายเดือน (Monthly Interest)
                    </td>
                    <td className="py-2 px-3.5 text-right font-medium text-slate-800 whitespace-nowrap">
                      {formatBaht(result.monthlyInterest, true)} /เดือน
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3.5 text-slate-700">
                      7. ดอกเบี้ยรวมทั้งสัญญา ({result.term} งวด)
                      {result.minInterestApplied && (
                        <span className="text-[10px] text-rose-500 ml-1 font-semibold">
                          (เกณฑ์ขั้นต่ำ 7,000 บ.)
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3.5 text-right font-medium whitespace-nowrap">
                      {formatBaht(result.totalInterest, true)}
                    </td>
                  </tr>
                  <tr className="bg-slate-50/60">
                    <td className="py-2 px-3.5 font-medium text-slate-700">
                      8. ยอดรวมทั้งสัญญารวมดอกเบี้ย (Total Contract Amount)
                    </td>
                    <td className="py-2 px-3.5 text-right font-bold text-slate-900 whitespace-nowrap">
                      {formatBaht(result.totalWithVat, true)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-3.5 text-slate-500 text-[11px]">
                      (จำแนก: ยอดก่อน VAT {formatBaht(result.totalBeforeVat, true)} + VAT 7% {formatBaht(result.vatAmount, true)})
                    </td>
                    <td className="py-1.5 px-3.5 text-right text-slate-500 text-[11px] whitespace-nowrap">
                      ภาษี VAT 7%: {formatBaht(result.vatAmount, true)}
                    </td>
                  </tr>
                  <tr className="bg-blue-100/70 font-bold border-t-2 border-blue-400">
                    <td className="py-2.5 px-3.5 text-blue-950 text-xs sm:text-sm">
                      ⭐ ค่างวดผ่อนชำระต่อเดือน (รวม VAT 7%)
                    </td>
                    <td className="py-2.5 px-3.5 text-right text-blue-950 text-sm sm:text-base font-extrabold whitespace-nowrap">
                      {formatBaht(result.monthlyInstallment)} /งวด
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Monthly Payment Hero Box */}
            <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white rounded-xl py-3 px-4 text-center shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-100">
                ค่างวดผ่อนชำระต่อเดือน (รวมภาษีมูลค่าเพิ่ม 7%)
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold my-1 tracking-tight">
                {formatBaht(result.monthlyInstallment)}
                <span className="text-xs font-normal text-blue-100 ml-1">/ เดือน</span>
              </div>
              <div className="text-[11px] text-blue-200">
                ระยะเวลาผ่อนชำระ {result.term} งวด ( {(result.term / 12).toFixed(1)} ปี )
              </div>
            </div>

            {/* Delivery day expenses if applicable */}
            {(result.registrationFee > 0 || result.theftInsuranceFee > 0) && (
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-xs space-y-1.5">
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
                <div className="flex justify-between font-bold text-blue-800 pt-1 border-t border-slate-200 text-xs sm:text-sm">
                  <span>รวมเงินที่ต้องชำระวันออกรถ:</span>
                  <span>{formatBaht(result.totalDriveAwayCost)}</span>
                </div>
              </div>
            )}

            {/* Signature & Note Footer */}
            <div className="pt-3 border-t border-slate-200 grid grid-cols-2 gap-6 text-center text-xs text-slate-500">
              <div className="space-y-4">
                <div className="h-6 border-b border-dashed border-slate-300 w-3/4 mx-auto" />
                <div>ลงชื่อ ....................................................<br />( ผู้เสนอราคา / เจ้าหน้าที่ )</div>
              </div>
              <div className="space-y-4">
                <div className="h-6 border-b border-dashed border-slate-300 w-3/4 mx-auto" />
                <div>ลงชื่อ ....................................................<br />( ลูกค้า / ผู้ขอเช่าซื้อ )</div>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 text-center pt-1 border-t border-slate-100">
              * เอกสารนี้เป็นเพียงการจำลองคำนวณค่างวดเบื้องต้นตามเงื่อนไข Proposal เพื่อประกอบการตัดสินใจ ยอดจริงอาจเปลี่ยนแปลงตามผลการอนุมัติสินเชื่อ Next Capital
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
