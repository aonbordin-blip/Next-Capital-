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
  AlertCircle,
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

  // Direct In-Browser PDF Generation (Works 100% inside iframes & mobile!)
  const handleDownloadPdf = async () => {
    if (!quotationRef.current || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    setPdfSuccessMessage(null);

    try {
      const element = quotationRef.current;
      const canvas = await html2canvas(element, {
        scale: 2, // high quality retina resolution
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 800,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

      const fileName = `ใบเสนอราคา_${modelName.replace(/\s+/g, '_')}_NextCapital.pdf`;
      pdf.save(fileName);

      setPdfSuccessMessage('ดาวน์โหลดไฟล์ PDF เรียบร้อยแล้ว!');
      setTimeout(() => setPdfSuccessMessage(null), 3500);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      // Fallback: try window.print
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
    try {
      // If inside an iframe where print is blocked, attempt print or fallback
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
${
  result.insurancePremium > 0
    ? `🛡️ ประกันภัย: ${result.insurancePlanName} (+${formatBaht(result.insurancePremium)})\n📦 ราคารวมเบี้ยประกัน: ${formatBaht(result.vehiclePrice)}\n`
    : `🏷️ ราคารถรวม: ${formatBaht(result.vehiclePrice)}\n`
}💰 เงินดาวน์: ${formatBaht(result.downAmount)} (${result.downPercent.toFixed(1)}%)
💳 ยอดจัดไฟแนนซ์: ${formatBaht(result.financeAmount)}
📊 ข้อเสนอ: ${result.proposalName} (${result.proposalCode})
⏱️ ระยะเวลาผ่อน: ${result.term} งวด (${(result.term / 12).toFixed(1)} ปี)
📈 อัตราดอกเบี้ย: ${result.rateDisplayText}

✨ ค่างวดต่อเดือน: ${formatBaht(result.monthlyInstallment)} /เดือน
(รวมภาษีมูลค่าเพิ่ม 7% เรียบร้อยแล้ว)
━━━━━━━━━━━━━━━━━━━━
💵 สรุปค่าใช้จ่ายสัญญา:
• ดอกเบี้ยรวมทั้งสัญญา: ${formatBaht(result.totalInterest)}
• ยอดรวมก่อน VAT: ${formatBaht(result.totalBeforeVat)}
• ภาษีมูลค่าเพิ่ม VAT 7%: ${formatBaht(result.vatAmount)}
• ยอดชำระรวมทั้งสิ้น: ${formatBaht(result.totalWithVat)}
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
        {/* Modal Action Bar (Hidden when printing) */}
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
                พิมพ์ หรือดาวน์โหลดเป็นไฟล์ PDF ได้ทันที
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
              onClick={handlePrint}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
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

        {/* Printable & Canvas-Capturable Quotation Document */}
        <div
          ref={quotationRef}
          className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-5 text-slate-800 print:p-0 print:overflow-visible bg-white"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-5 border-b border-slate-200 gap-4">
            <div className="flex items-center gap-3">
              <NextCapitalLogo size={42} />
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <input
                    type="text"
                    value={dealerName}
                    onChange={(e) => setDealerName(e.target.value)}
                    className="font-bold text-base sm:text-lg text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-blue-700 focus:outline-none transition-colors w-full sm:w-80"
                    placeholder="ชื่อศูนย์บริการ / ตัวแทนจำหน่าย"
                  />
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  ใบเสนอราคาเช่าซื้อรถจักรยานยนต์ (Hire Purchase Quotation)
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right space-y-1 text-xs text-slate-500">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs">
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
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-xs">
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
                {result.insurancePremium > 0 && (
                  <tr className="bg-blue-50/50">
                    <td className="py-2.5 px-4 font-semibold text-blue-950">
                      + เบี้ยประกันอุบัติเหตุ PA ({result.insurancePlanName})
                    </td>
                    <td className="py-2.5 px-4 text-right text-blue-900 font-bold">
                      +{formatBaht(result.insurancePremium)}
                    </td>
                  </tr>
                )}
                <tr className="bg-slate-50/80 font-bold">
                  <td className="py-2.5 px-4 text-slate-900">
                    2. ราคารถรวมจัดไฟแนนซ์ (Total Vehicle Price with Insurance)
                  </td>
                  <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                    {formatBaht(result.vehiclePrice)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-medium text-slate-700">
                    3. เงินดาวน์ (Down Payment) ({result.downPercent.toFixed(1)}%)
                  </td>
                  <td className="py-2.5 px-4 text-right text-emerald-700 font-semibold">
                    - {formatBaht(result.downAmount)}
                  </td>
                </tr>
                <tr className="bg-slate-50/50 font-semibold">
                  <td className="py-2.5 px-4 text-slate-800">4. ยอดจัดไฟแนนซ์ (Finance Amount)</td>
                  <td className="py-2.5 px-4 text-right text-slate-900 font-bold">
                    {formatBaht(result.financeAmount)}
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
                    6. ดอกเบี้ยรวมทั้งสัญญา ({result.term} งวด)
                    {result.minInterestApplied && (
                      <span className="text-[10px] text-rose-500 ml-1 font-semibold">
                        (เกณฑ์ขั้นต่ำ 7,000 บ.)
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-right font-medium">
                    {formatBaht(result.totalInterest)}
                  </td>
                </tr>
                <tr className="bg-slate-50/60">
                  <td className="py-2.5 px-4 font-medium text-slate-700">
                    7. มูลค่ารวมก่อนภาษีมูลค่าเพิ่ม (Total Before VAT)
                  </td>
                  <td className="py-2.5 px-4 text-right font-medium">
                    {formatBaht(result.totalBeforeVat)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-slate-700">8. ภาษีมูลค่าเพิ่ม VAT 7%</td>
                  <td className="py-2.5 px-4 text-right font-medium">
                    {formatBaht(result.vatAmount)}
                  </td>
                </tr>
                <tr className="bg-blue-50/60 font-bold border-t border-blue-200">
                  <td className="py-3 px-4 text-blue-950">
                    9. มูลค่ารวมทั้งสัญญารวม VAT (Total with VAT)
                  </td>
                  <td className="py-3 px-4 text-right text-blue-950 font-extrabold">
                    {formatBaht(result.totalWithVat)}
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
  );
};
