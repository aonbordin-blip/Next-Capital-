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
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
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
    'บริษัท เน็กซ์ แคปปิตอล จำกัด (มหาชน)'
  );
  const [customerName, setCustomerName] = useState<string>('คุณลูกค้า');
  const [customerPhone, setCustomerPhone] = useState<string>('08X-XXX-XXXX');
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

  // Direct In-Browser High-Quality PDF Generation matching the attached layout exactly
  const handleDownloadPdf = async () => {
    if (!quotationRef.current || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    setPdfSuccessMessage(null);

    let clone: HTMLElement | null = null;
    try {
      if (document.fonts) {
        await document.fonts.ready;
      }

      const element = quotationRef.current;

      // Create an offscreen clone with fixed desktop dimensions (780px)
      // This ensures the exported PDF always has the exact 2-column layout from the attached image
      clone = element.cloneNode(true) as HTMLElement;
      clone.style.width = '780px';
      clone.style.minWidth = '780px';
      clone.style.maxWidth = '780px';
      clone.style.position = 'fixed';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      clone.style.zIndex = '-9999';
      clone.style.backgroundColor = '#ffffff';
      clone.style.padding = '32px 36px';
      clone.style.borderRadius = '0px';

      // Ensure 2-column layout in the cloned element
      const infoGrid = clone.querySelector('.info-grid');
      if (infoGrid) {
        infoGrid.classList.remove('grid-cols-1');
        infoGrid.classList.add('grid-cols-2');
      }

      // Transform inputs into styled elements so user-typed text renders flawlessly
      const origInputs = element.querySelectorAll('input');
      const cloneInputs = clone.querySelectorAll('input');
      cloneInputs.forEach((input, i) => {
        const val = origInputs[i]?.value || input.value || input.placeholder || '';
        const replacement = document.createElement('div');
        replacement.textContent = val;
        replacement.className = input.className;
        replacement.style.display = 'flex';
        replacement.style.alignItems = 'center';
        replacement.style.minHeight = '28px';
        replacement.style.lineHeight = '1.4';
        input.parentNode?.replaceChild(replacement, input);
      });

      document.body.appendChild(clone);

      // Convert to PNG using html-to-image (supports Tailwind v4 and modern color spaces natively)
      const dataUrl = await toPng(clone, {
        quality: 0.98,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        skipFonts: true,
      });

      // Remove offscreen clone immediately
      document.body.removeChild(clone);
      clone = null;

      // Measure image dimensions
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm

      // Professional 10mm margins
      const margin = 10;
      const printWidth = pageWidth - margin * 2; // 190mm
      const printHeight = (img.height * printWidth) / img.width;

      // Position centered vertically if compact, or with neat top margin
      const yPos = printHeight < pageHeight - 25 ? Math.max(10, (pageHeight - printHeight) / 3) : margin;

      pdf.addImage(dataUrl, 'PNG', margin, yPos, printWidth, printHeight, undefined, 'FAST');

      const cleanModelName = (modelName || 'รถจักรยานยนต์').replace(/\s+/g, '_');
      const fileName = `ใบเสนอราคา_${cleanModelName}_NextCapital.pdf`;

      // Universal cross-browser download trigger (works on mobile browsers and Android)
      const blob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

      setPdfSuccessMessage('ดาวน์โหลดไฟล์ PDF เรียบร้อยแล้ว!');
      setTimeout(() => setPdfSuccessMessage(null), 3500);
    } catch (err) {
      if (clone && clone.parentNode) {
        document.body.removeChild(clone);
      }
      console.error('Failed to generate PDF:', err);
      alert('เกิดข้อผิดพลาดในการสร้าง PDF: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsGeneratingPdf(false);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto border border-slate-200">
        {/* Modal Action Bar */}
        <div className="no-print flex flex-wrap items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50/90 gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-800 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-800">
                ใบเสนอราคาเช่าซื้อ (Quotation)
              </h2>
              <p className="text-[11px] text-slate-500">
                ดาวน์โหลดเป็นไฟล์ PDF หรือแชร์ผ่าน LINE ได้ทันที
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={handleCopyChatText}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
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

            {/* Direct Instant PDF Download Button */}
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-700 to-indigo-600 hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-700/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังสร้าง PDF...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" /> ดาวน์โหลด PDF
                </>
              )}
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

        {/* Scrollable Container with Sheet Presentation */}
        <div className="flex-1 overflow-y-auto overflow-x-auto p-2 sm:p-5 bg-slate-100/60">
          {/* Printable & Canvas-Capturable Quotation Document */}
          <div
            ref={quotationRef}
            data-quotation-root="true"
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
                  เลขที่เอกสาร: QT-{Math.floor(100000 + (result.vehiclePrice % 900000))}
                </div>
                <div className="flex items-center justify-end gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>วันที่: {quotationDate}</span>
                </div>
              </div>
            </div>

            {/* Customer & Vehicle Info Inputs - Responsive on screen, 2 cols in PDF export */}
            <div className="info-grid grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200/80 text-xs">
            <div className="space-y-2">
              <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" /> ข้อมูลลูกค้า
              </div>
              <div className="grid grid-cols-3 gap-2 items-center">
                <span className="text-slate-500">ชื่อลูกค้า:</span>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="col-span-2 bg-white px-2 py-1 rounded border border-slate-200 font-medium"
                />
              </div>
              <div className="grid grid-cols-3 gap-2 items-center">
                <span className="text-slate-500">เบอร์โทรศัพท์:</span>
                <input
                  type="text"
                  placeholder="08X-XXX-XXXX"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="col-span-2 bg-white px-2 py-1 rounded border border-slate-200"
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
                  className="col-span-2 bg-white px-2 py-1 rounded border border-slate-200 font-semibold text-blue-900"
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
          <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-xs">
            <table className="w-full text-xs min-w-[480px] sm:min-w-0">
              <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 text-left">รายการ</th>
                  <th className="py-2.5 px-4 text-right">จำนวนเงิน (บาท)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2.5 px-4 font-medium text-slate-700">
                    1. ราคารถตัวเปล่า (Base Vehicle Price)
                  </td>
                  <td className="py-2.5 px-4 text-right font-semibold">
                    {formatBaht(result.baseVehiclePrice)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-medium text-slate-700">
                    2. เงินดาวน์ (Down Payment) ({result.downPercent.toFixed(1)}%)
                  </td>
                  <td className="py-2.5 px-4 text-right text-emerald-700 font-semibold">
                    - {formatBaht(result.downAmount)}
                  </td>
                </tr>
                <tr className="bg-slate-50/70 font-semibold">
                  <td className="py-2.5 px-4 text-slate-800">
                    3. ยอดจัดเฉพาะตัวรถ (Vehicle Finance Amount)
                  </td>
                  <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                    {formatBaht(result.vehicleFinanceAmount)}
                  </td>
                </tr>
                {result.insuranceTotalWithVat > 0 && (
                  <>
                    <tr className="bg-blue-50/40">
                      <td className="py-2 px-4 text-blue-900 pl-6">
                        • ค่าเบี้ยประกันภัย PA ({result.insurancePlanName})
                      </td>
                      <td className="py-2 px-4 text-right text-blue-900 font-medium">
                        +{formatBaht(result.insuranceBasePremium)}
                      </td>
                    </tr>
                    <tr className="bg-blue-50/40">
                      <td className="py-2 px-4 text-blue-900 pl-6">
                        • ภาษีมูลค่าเพิ่ม 7% ของค่าเบี้ยประกัน
                      </td>
                      <td className="py-2 px-4 text-right text-blue-900 font-medium">
                        +{formatBaht(result.insuranceVat, true)}
                      </td>
                    </tr>
                    <tr className="bg-blue-50/80 font-bold border-y border-blue-200/60">
                      <td className="py-2.5 px-4 text-blue-950">
                        + ค่าเบี้ยประกันรวมภาษี 7% (Insurance with VAT)
                      </td>
                      <td className="py-2.5 px-4 text-right text-blue-900 font-bold">
                        +{formatBaht(result.insuranceTotalWithVat, true)}
                      </td>
                    </tr>
                  </>
                )}
                <tr className="bg-indigo-50/60 font-bold">
                  <td className="py-2.5 px-4 text-indigo-950">
                    4. ยอดจัดไฟแนนซ์รวม (Total Finance Amount)
                  </td>
                  <td className="py-2.5 px-4 text-right text-indigo-900 font-extrabold">
                    {formatBaht(result.financeAmount, true)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-slate-700">
                    5. อัตราดอกเบี้ย ({result.rateDisplayText})
                  </td>
                  <td className="py-2.5 px-4 text-right text-blue-700 font-bold">
                    {result.rateDisplayText}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-slate-700">
                    6. ดอกเบี้ยรายเดือน (Monthly Interest)
                  </td>
                  <td className="py-2.5 px-4 text-right font-medium text-slate-800">
                    {formatBaht(result.monthlyInterest, true)} /เดือน
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-slate-700">
                    7. ดอกเบี้ยรวมทั้งสัญญา ({result.term} งวด)
                    {result.minInterestApplied && (
                      <span className="text-[10px] text-rose-500 ml-1 font-semibold">
                        (เกณฑ์ขั้นต่ำ 7,000 บ.)
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-right font-medium">
                    {formatBaht(result.totalInterest, true)}
                  </td>
                </tr>
                <tr className="bg-slate-50/60">
                  <td className="py-2.5 px-4 font-medium text-slate-700">
                    8. ยอดรวมทั้งสัญญารวมดอกเบี้ย (Total Contract Amount)
                  </td>
                  <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                    {formatBaht(result.totalWithVat, true)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                    (จำแนก: ยอดก่อน VAT {formatBaht(result.totalBeforeVat, true)} + VAT 7% {formatBaht(result.vatAmount, true)})
                  </td>
                  <td className="py-2.5 px-4 text-right text-slate-500 text-[11px]">
                    ภาษี VAT 7%: {formatBaht(result.vatAmount, true)}
                  </td>
                </tr>
                <tr className="bg-blue-100/70 font-bold border-t-2 border-blue-400">
                  <td className="py-3 px-4 text-blue-950 text-sm">
                    ⭐ ค่างวดผ่อนชำระต่อเดือน (รวม VAT 7%)
                  </td>
                  <td className="py-3 px-4 text-right text-blue-950 text-base font-extrabold">
                    {formatBaht(result.monthlyInstallment)} /งวด
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
            <div className="space-y-6">
              <div className="h-8 border-b border-dashed border-slate-300 w-3/4 mx-auto" />
              <div>ลงชื่อ ....................................................<br />( ผู้เสนอราคา / เจ้าหน้าที่ )</div>
            </div>
            <div className="space-y-6">
              <div className="h-8 border-b border-dashed border-slate-300 w-3/4 mx-auto" />
              <div>ลงชื่อ ....................................................<br />( ลูกค้า / ผู้ขอเช่าซื้อ )</div>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 text-center">
            * เอกสารนี้เป็นเพียงการจำลองคำนวณค่างวดเบื้องต้นตามเงื่อนไข Proposal เพื่อประกอบการตัดสินใจ ยอดจริงอาจเปลี่ยนแปลงตามผลการอนุมัติสินเชื่อ Next Capital
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};
