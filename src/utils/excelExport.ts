import * as XLSX from 'xlsx';
import { CalculationResult, SavedCaseRecord } from '../types';
import {
  calculateFirstPaymentDueDate,
  getCustomerDisplayName,
  getGoogleMapsNavigationUrl,
  InstallmentDueSlot,
  resolveBikeBrand,
} from './savedCasesStorage';

const THAI_MONTH_SHORTS = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

function formatThaiShortDate(input?: string | number): string {
  if (!input) return '-';
  let d: Date;
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, day] = input.split('-').map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = new Date(input);
  }
  if (isNaN(d.getTime())) return '-';
  const day = d.getDate();
  const monthShort = THAI_MONTH_SHORTS[d.getMonth()] || '';
  const thaiYear = d.getFullYear() + 543;
  return `${day} ${monthShort} ${thaiYear}`;
}

function getApprovalStatusThai(status?: string): string {
  switch (status) {
    case 'approved':
      return 'อนุมัติ';
    case 'rejected':
      return 'ไม่อนุมัติ';
    case 'cancelled':
      return 'ยกเลิก';
    default:
      return 'รอผล';
  }
}

function getDeliveryStatusThai(record: SavedCaseRecord): string {
  if (record.approvalStatus !== 'approved') return '-';
  return record.deliveryStatus === 'delivered' ? 'รับรถแล้ว' : 'รอรับรถ';
}

function computeAutoColumnWidths(
  rows: (string | number | null | undefined)[][],
  minWidth = 10,
  maxWidth = 48
): { wch: number }[] {
  if (!rows || rows.length === 0) return [];
  const colCount = Math.max(...rows.map((r) => r.length));
  const widths: number[] = Array(colCount).fill(minWidth);

  for (const row of rows) {
    for (let c = 0; c < colCount; c++) {
      const val = row[c];
      if (val === null || val === undefined) continue;
      const str = String(val);
      // Thai combining vowels/tone marks don't add horizontal width as much, but give comfortable padding
      const len = str.length + 3;
      if (len > widths[c]) {
        widths[c] = Math.min(maxWidth, len);
      }
    }
  }

  return widths.map((wch) => ({ wch }));
}

function triggerWorkbookDownload(wb: XLSX.WorkBook, fileName: string): void {
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1500);
}

function sanitizeFileSegment(text: string): string {
  return text.replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '');
}

export interface InstallmentTrackingExportItem {
  record: SavedCaseRecord;
  customerName: string;
  brand: string;
  modelName: string;
  modelCode: string;
  deliveryDateShort: string;
  firstDueMonthKey: string;
  firstDueLabelShort: string;
  firstDueLabelLong: string;
  cycleRangeText: string;
  schedule: InstallmentDueSlot[];
  mapsUrl: string;
}

/**
 * ส่งออกรายชื่อลูกค้ากำหนดชำระ (งวด 1 - 9) เป็นไฟล์ Excel (.xlsx)
 */
export function exportInstallmentTrackingToExcel(
  items: InstallmentTrackingExportItem[],
  filterLabel?: string
): string {
  const headers = [
    'ลำดับ',
    'ชื่อลูกค้า',
    'เบอร์โทร',
    'ยี่ห้อ',
    'รุ่นรถ',
    'รหัสรถ',
    'เลขเครื่อง',
    'เลขถัง',
    'ดีลเลอร์/ร้านค้า',
    'วันรับรถ',
    'รอบรับรถ',
    'ค่างวด/เดือน (บาท)',
    'กำหนดงวดแรก',
    'งวดที่ 1',
    'งวดที่ 2',
    'งวดที่ 3',
    'งวดที่ 4',
    'งวดที่ 5',
    'งวดที่ 6',
    'งวดที่ 7',
    'งวดที่ 8',
    'งวดที่ 9',
    'ลิงก์ Google Maps',
    'ข้อความตำแหน่งเดิม',
  ];

  const dataRows: (string | number)[][] = items.map((item, idx) => {
    const monthly = item.record.snapshot?.monthlyInstallment || 0;
    const slotValues = Array.from({ length: 9 }, (_, i) => item.schedule[i]?.formattedShort || '-');
    return [
      idx + 1,
      item.customerName,
      item.record.customerPhone || '-',
      item.brand,
      item.modelName,
      item.modelCode,
      item.record.engineNumber || '-',
      item.record.chassisNumber || '-',
      item.record.dealerName || '-',
      item.deliveryDateShort,
      item.cycleRangeText,
      monthly > 0 ? Math.round(monthly) : 0,
      item.firstDueLabelShort,
      ...slotValues,
      item.mapsUrl || '-',
      item.record.googleMapsLocation || '-',
    ];
  });

  const totalMonthly = items.reduce(
    (sum, item) => sum + (item.record.snapshot?.monthlyInstallment || 0),
    0
  );

  const footerRow: (string | number)[] = [
    '',
    `รวมทั้งหมด ${items.length} ราย`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    Math.round(totalMonthly),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ];

  const sheet1AoA = [headers, ...dataRows, [], footerRow];
  const ws1 = XLSX.utils.aoa_to_sheet(sheet1AoA);
  ws1['!cols'] = computeAutoColumnWidths(sheet1AoA, 10, 42);

  // Sheet 2: สรุปตามกลุ่มเดือนงวดแรก
  const cohortMap = new Map<
    string,
    { label: string; cycle: string; count: number; totalMonthly: number }
  >();
  items.forEach((item) => {
    const existing = cohortMap.get(item.firstDueMonthKey);
    const amt = item.record.snapshot?.monthlyInstallment || 0;
    if (existing) {
      existing.count += 1;
      existing.totalMonthly += amt;
    } else {
      cohortMap.set(item.firstDueMonthKey, {
        label: item.firstDueLabelLong,
        cycle: item.cycleRangeText,
        count: 1,
        totalMonthly: amt,
      });
    }
  });

  const summaryHeaders = [
    'ลำดับ',
    'กำหนดชำระงวดแรก',
    'รอบรับรถ',
    'จำนวนลูกค้า (ราย)',
    'รวมค่างวด/เดือน (บาท)',
  ];
  const summaryRows = Array.from(cohortMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, val], idx) => [
      idx + 1,
      val.label,
      val.cycle,
      val.count,
      Math.round(val.totalMonthly),
    ]);

  const summaryTotalRow = [
    '',
    'รวมทั้งหมด',
    '',
    items.length,
    Math.round(totalMonthly),
  ];
  const sheet2AoA = [summaryHeaders, ...summaryRows, [], summaryTotalRow];
  const ws2 = XLSX.utils.aoa_to_sheet(sheet2AoA);
  ws2['!cols'] = computeAutoColumnWidths(sheet2AoA, 12, 36);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'กำหนดชำระ_งวด1-9');
  XLSX.utils.book_append_sheet(wb, ws2, 'สรุปกลุ่มเดือน');

  const today = new Date().toISOString().slice(0, 10);
  const suffix = filterLabel ? `_${sanitizeFileSegment(filterLabel)}` : '';
  const fileName = `กำหนดชำระค่างวด${suffix}_${today}.xlsx`;
  triggerWorkbookDownload(wb, fileName);
  return fileName;
}

/**
 * ส่งออกรายการเคสที่บันทึกไว้ทั้งหมด/ที่กรองอยู่ เป็นไฟล์ Excel (.xlsx)
 */
export function exportSavedCasesToExcel(
  cases: SavedCaseRecord[],
  filterLabel?: string
): string {
  const headers = [
    'ลำดับ',
    'วันที่บันทึก',
    'ชื่อลูกค้า',
    'เบอร์โทร',
    'ดีลเลอร์/ร้านค้า',
    'ข้อเสนอ (Proposal)',
    'รหัส Proposal',
    'ยี่ห้อรถ',
    'รุ่นรถ',
    'รหัสรถ',
    'เลขเครื่อง',
    'เลขถัง',
    'ราคารถ (บาท)',
    'เงินดาวน์ (บาท)',
    'ดาวน์ (%)',
    'ยอดจัดไฟแนนซ์ (บาท)',
    'ระยะผ่อน (งวด)',
    'ค่างวด/เดือน (บาท)',
    'อัตราดอกเบี้ย',
    'EIR (%/ปี)',
    'สถานะอนุมัติ',
    'วันที่อนุมัติ',
    'สถานะรับรถ',
    'วันที่รับรถ',
    'กำหนดชำระงวดแรก',
    'ลิงก์ Google Maps',
    'ข้อความตำแหน่งเดิม',
    'เจ้าหน้าที่',
    'หมายเหตุ',
  ];

  const rows: (string | number)[][] = cases.map((c, idx) => {
    const isDelivered = c.approvalStatus === 'approved' && c.deliveryStatus === 'delivered';
    const firstDue = isDelivered
      ? calculateFirstPaymentDueDate(c.deliveryDate || c.createdAt).formattedShort
      : '-';
    const mapsUrl = getGoogleMapsNavigationUrl(c.googleMapsLocation);
    const officerText = [c.officerCode, c.officerName].filter(Boolean).join(' ') || '-';

    return [
      idx + 1,
      formatThaiShortDate(c.createdAt),
      getCustomerDisplayName(c),
      c.customerPhone || '-',
      c.dealerName || '-',
      c.snapshot?.proposalName || '-',
      c.snapshot?.proposalCode || '-',
      resolveBikeBrand(c),
      c.bikeModelName || '-',
      c.bikeModelCode || '-',
      c.engineNumber || '-',
      c.chassisNumber || '-',
      Math.round(c.vehiclePrice || 0),
      Math.round(c.snapshot?.downAmount || 0),
      Number((c.snapshot?.downPercent || 0).toFixed(2)),
      Math.round(c.snapshot?.financeAmount || 0),
      c.term || 0,
      Math.round(c.snapshot?.monthlyInstallment || 0),
      c.snapshot?.rateDisplayText || '-',
      Number((c.snapshot?.eirAnnualPercent || 0).toFixed(2)),
      getApprovalStatusThai(c.approvalStatus),
      c.approvalDate ? formatThaiShortDate(c.approvalDate) : '-',
      getDeliveryStatusThai(c),
      c.deliveryDate ? formatThaiShortDate(c.deliveryDate) : '-',
      firstDue,
      mapsUrl || '-',
      c.googleMapsLocation || '-',
      officerText,
      c.customerNote || c.approvalNote || '-',
    ];
  });

  const sheet1AoA = [headers, ...rows];
  const ws1 = XLSX.utils.aoa_to_sheet(sheet1AoA);
  ws1['!cols'] = computeAutoColumnWidths(sheet1AoA, 10, 40);

  // Sheet 2: สรุปภาพรวมเคส
  const approvedCases = cases.filter((c) => c.approvalStatus === 'approved');
  const deliveredCases = approvedCases.filter((c) => c.deliveryStatus === 'delivered');
  const pendingDeliveryCases = approvedCases.filter((c) => c.deliveryStatus !== 'delivered');
  const pendingCases = cases.filter((c) => !c.approvalStatus || c.approvalStatus === 'pending');
  const rejectedCases = cases.filter((c) => c.approvalStatus === 'rejected');
  const cancelledCases = cases.filter((c) => c.approvalStatus === 'cancelled');

  const totalFinanceApproved = approvedCases.reduce(
    (s, c) => s + (c.snapshot?.financeAmount || 0),
    0
  );
  const totalFinanceDelivered = deliveredCases.reduce(
    (s, c) => s + (c.snapshot?.financeAmount || 0),
    0
  );
  const totalMonthlyDelivered = deliveredCases.reduce(
    (s, c) => s + (c.snapshot?.monthlyInstallment || 0),
    0
  );

  const summaryAoA: (string | number)[][] = [
    ['หัวข้อสรุป', 'จำนวน (ราย)', 'มูลค่ารวม (บาท)'],
    ['เคสทั้งหมดในรายการที่ส่งออก', cases.length, '-'],
    ['อนุมัติแล้ว (รวม)', approvedCases.length, Math.round(totalFinanceApproved)],
    ['  - รับรถแล้ว', deliveredCases.length, Math.round(totalFinanceDelivered)],
    ['  - รอรับรถ', pendingDeliveryCases.length, Math.round(totalFinanceApproved - totalFinanceDelivered)],
    ['รอผลการพิจารณา', pendingCases.length, '-'],
    ['ไม่อนุมัติ', rejectedCases.length, '-'],
    ['ยกเลิกเคส', cancelledCases.length, '-'],
    [],
    ['รวมยอดค่างวด/เดือน (เคสรับรถแล้ว)', deliveredCases.length, Math.round(totalMonthlyDelivered)],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(summaryAoA);
  ws2['!cols'] = computeAutoColumnWidths(summaryAoA, 16, 40);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'รายการเคสที่บันทึก');
  XLSX.utils.book_append_sheet(wb, ws2, 'สรุปสถานะเคส');

  const today = new Date().toISOString().slice(0, 10);
  const suffix = filterLabel ? `_${sanitizeFileSegment(filterLabel)}` : '';
  const fileName = `รายการเคสที่บันทึก${suffix}_${today}.xlsx`;
  triggerWorkbookDownload(wb, fileName);
  return fileName;
}

/**
 * ส่งออกตารางผ่อนชำระรายงวด (Amortization Schedule) เป็นไฟล์ Excel (.xlsx)
 */
export function exportAmortizationToExcel(result: CalculationResult): string {
  const term = result.term;
  const principalPerMonth = term > 0 ? result.financeAmount / term : 0;
  const interestPerMonth = term > 0 ? result.totalInterest / term : 0;
  const monthlyInstallment = result.monthlyInstallment;
  const vatPerMonth = (monthlyInstallment * 7) / 107;
  const beforeVatPerMonth = monthlyInstallment - vatPerMonth;

  const headers = [
    'งวดที่',
    'เงินต้น (บาท)',
    'ดอกเบี้ย (บาท)',
    'มูลค่าก่อน VAT (บาท)',
    'VAT 7% (บาท)',
    'ค่างวดรวม (บาท)',
    'เงินต้นคงเหลือ (บาท)',
  ];

  const rows: (string | number)[][] = [];
  let remaining = result.financeAmount;
  for (let i = 1; i <= term; i++) {
    remaining = Math.max(0, remaining - principalPerMonth);
    rows.push([
      i,
      Number(principalPerMonth.toFixed(2)),
      Number(interestPerMonth.toFixed(2)),
      Number(beforeVatPerMonth.toFixed(2)),
      Number(vatPerMonth.toFixed(2)),
      Number(monthlyInstallment.toFixed(2)),
      Number(remaining.toFixed(2)),
    ]);
  }

  const sheet1AoA = [headers, ...rows];
  const ws1 = XLSX.utils.aoa_to_sheet(sheet1AoA);
  ws1['!cols'] = computeAutoColumnWidths(sheet1AoA, 12, 26);

  const summaryAoA: (string | number)[][] = [
    ['รายการ', 'รายละเอียด / จำนวน'],
    ['ข้อเสนอ (Proposal)', `${result.proposalName} (${result.proposalCode})`],
    ['ราคารถตัวเปล่า (บาท)', Math.round(result.baseVehiclePrice)],
    ['เงินดาวน์ (บาท)', Math.round(result.downAmount)],
    ['ยอดจัดไฟแนนซ์รวม (บาท)', Number(result.financeAmount.toFixed(2))],
    ['อัตราดอกเบี้ย', result.rateDisplayText],
    ['EIR ต่อปี (%)', Number(result.eirAnnualPercent.toFixed(2))],
    ['ระยะเวลาผ่อน (งวด)', result.term],
    ['ดอกเบี้ยรวมทั้งสัญญา (บาท)', Number(result.totalInterest.toFixed(2))],
    ['ค่างวดต่อเดือน (บาท)', Math.round(result.monthlyInstallment)],
    ['ยอดรวมทั้งสัญญา (บาท)', Number(result.totalWithVat.toFixed(2))],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(summaryAoA);
  ws2['!cols'] = computeAutoColumnWidths(summaryAoA, 22, 42);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'ตารางผ่อนรายงวด');
  XLSX.utils.book_append_sheet(wb, ws2, 'สรุปสัญญา');

  const today = new Date().toISOString().slice(0, 10);
  const fileName = `ตารางผ่อน_${term}งวด_${today}.xlsx`;
  triggerWorkbookDownload(wb, fileName);
  return fileName;
}
