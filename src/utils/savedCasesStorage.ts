import {
  SavedCaseRecord,
  CaseApprovalStatus,
  VehicleDeliveryStatus,
  ApprovalDocInfo,
  InstallmentPaymentStatus,
} from '../types';
import { deleteApprovalDocFile } from './approvalDocsStorage';
import { findModelByCode } from '../data/motorcycleModels';

const STORAGE_KEY = 'ncap_saved_cases_v1';

export function getLocalTodayDateStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isCaseDeliveredAndApproved(record: SavedCaseRecord): boolean {
  return record.approvalStatus === 'approved' && record.deliveryStatus === 'delivered';
}

export function getCustomerDisplayName(record: SavedCaseRecord): string {
  if (record.customerName && record.customerName.trim()) {
    return record.customerName.trim();
  }
  if (record.caseTitle) {
    const parts = record.caseTitle.split(' - ');
    if (parts.length > 0 && parts[0].trim()) {
      return parts[0].trim();
    }
    return record.caseTitle.trim();
  }
  return 'คุณลูกค้า';
}

export function getSavedCases(): SavedCaseRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.sort((a, b) => b.createdAt - a.createdAt);
    }
    return [];
  } catch (err) {
    console.error('Failed to read saved cases from localStorage:', err);
    return [];
  }
}

export function saveCaseRecord(
  data: Omit<SavedCaseRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): SavedCaseRecord {
  const cases = getSavedCases();
  const now = Date.now();

  if (data.id) {
    // Update existing
    const index = cases.findIndex((c) => c.id === data.id);
    if (index >= 0) {
      const existing = cases[index];
      const updated: SavedCaseRecord = {
        ...existing,
        ...data,
        id: data.id,
        approvalStatus: data.approvalStatus !== undefined ? data.approvalStatus : (existing.approvalStatus || 'pending'),
        deliveryStatus: data.deliveryStatus !== undefined ? data.deliveryStatus : existing.deliveryStatus,
        approvalDate: data.approvalDate !== undefined ? data.approvalDate : existing.approvalDate,
        deliveryDate: data.deliveryDate !== undefined ? data.deliveryDate : existing.deliveryDate,
        paymentDueDay: data.paymentDueDay !== undefined ? data.paymentDueDay : existing.paymentDueDay,
        googleMapsLocation: data.googleMapsLocation !== undefined ? data.googleMapsLocation : existing.googleMapsLocation,
        bikeBrand: data.bikeBrand !== undefined ? data.bikeBrand : existing.bikeBrand,
        installmentPayments:
          data.installmentPayments !== undefined ? data.installmentPayments : existing.installmentPayments,
        approvalDoc: data.approvalDoc !== undefined ? data.approvalDoc : existing.approvalDoc,
        updatedAt: now,
      };
      cases[index] = updated;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
      } catch (err) {
        console.error('Failed to update case in localStorage:', err);
      }
      return updated;
    }
  }

  // Create new
  const initialApprovalStatus: CaseApprovalStatus = data.approvalStatus || 'pending';
  const initialDeliveryStatus: VehicleDeliveryStatus | undefined =
    initialApprovalStatus === 'approved' ? (data.deliveryStatus || 'pending_delivery') : data.deliveryStatus;

  const todayStr = getLocalTodayDateStr();
  const initialApprovalDate =
    initialApprovalStatus === 'approved' ? (data.approvalDate || todayStr) : data.approvalDate;
  const initialDeliveryDate =
    initialDeliveryStatus === 'delivered' ? (data.deliveryDate || todayStr) : data.deliveryDate;

  const newRecord: SavedCaseRecord = {
    ...data,
    approvalStatus: initialApprovalStatus,
    deliveryStatus: initialDeliveryStatus,
    approvalDate: initialApprovalDate,
    deliveryDate: initialDeliveryDate,
    paymentDueDay: data.paymentDueDay,
    googleMapsLocation: data.googleMapsLocation,
    bikeBrand: data.bikeBrand,
    installmentPayments: data.installmentPayments,
    approvalDoc: data.approvalDoc,
    id: `case-${now}-${Math.random().toString(36).substring(2, 7)}`,
    createdAt: now,
    updatedAt: now,
  };

  const updatedCases = [newRecord, ...cases];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCases));
  } catch (err) {
    console.error('Failed to save case in localStorage:', err);
  }
  return newRecord;
}

export function deleteCaseRecord(id: string): SavedCaseRecord[] {
  const cases = getSavedCases();
  const filtered = cases.filter((c) => c.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    // Clean up indexedDB stored file if present
    deleteApprovalDocFile(id).catch((err) => console.warn('Could not delete doc file:', err));
  } catch (err) {
    console.error('Failed to delete case from localStorage:', err);
  }
  return filtered;
}

export function updateCaseTitle(id: string, newTitle: string): SavedCaseRecord[] {
  const cases = getSavedCases();
  const updated = cases.map((c) =>
    c.id === id ? { ...c, caseTitle: newTitle, customerName: newTitle, updatedAt: Date.now() } : c
  );
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to update title in localStorage:', err);
  }
  return updated;
}

export function updateCaseDealerName(id: string, dealerName: string): SavedCaseRecord[] {
  const cases = getSavedCases();
  const updated = cases.map((c) =>
    c.id === id ? { ...c, dealerName: dealerName.trim() || undefined, updatedAt: Date.now() } : c
  );
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to update dealerName in localStorage:', err);
  }
  return updated;
}

export function updateCaseApprovalStatus(
  id: string,
  approvalStatus: CaseApprovalStatus,
  deliveryStatus?: VehicleDeliveryStatus
): SavedCaseRecord[] {
  const cases = getSavedCases();
  const todayStr = new Date().toISOString().slice(0, 10);
  const updated = cases.map((c) => {
    if (c.id !== id) return c;
    const resolvedDeliveryStatus: VehicleDeliveryStatus | undefined =
      approvalStatus === 'approved'
        ? (deliveryStatus || c.deliveryStatus || 'pending_delivery')
        : undefined;

    const resolvedApprovalDate =
      approvalStatus === 'approved'
        ? (c.approvalDate || todayStr)
        : c.approvalDate;

    return {
      ...c,
      approvalStatus,
      deliveryStatus: resolvedDeliveryStatus,
      approvalDate: resolvedApprovalDate,
      updatedAt: Date.now(),
      approvalUpdatedAt: Date.now(),
    };
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to update approval status in localStorage:', err);
  }
  return updated;
}

export function updateCaseDeliveryStatus(
  id: string,
  deliveryStatus: VehicleDeliveryStatus
): SavedCaseRecord[] {
  const cases = getSavedCases();
  const todayStr = getLocalTodayDateStr();
  const updated = cases.map((c) => {
    if (c.id !== id) return c;
    const resolvedDeliveryDate =
      deliveryStatus === 'delivered'
        ? (c.deliveryDate || todayStr)
        : c.deliveryDate;

    return {
      ...c,
      deliveryStatus,
      deliveryDate: resolvedDeliveryDate,
      paymentDueDay: deliveryStatus === 'delivered' ? (c.paymentDueDay || 2) : c.paymentDueDay,
      updatedAt: Date.now(),
    };
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to update delivery status in localStorage:', err);
  }
  return updated;
}

export function updateCaseDates(
  id: string,
  dates: { approvalDate?: string; deliveryDate?: string }
): SavedCaseRecord[] {
  const cases = getSavedCases();
  const updated = cases.map((c) => {
    if (c.id !== id) return c;
    return {
      ...c,
      approvalDate: dates.approvalDate !== undefined ? dates.approvalDate : c.approvalDate,
      deliveryDate: dates.deliveryDate !== undefined ? dates.deliveryDate : c.deliveryDate,
      updatedAt: Date.now(),
    };
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to update case dates in localStorage:', err);
  }
  return updated;
}

export function updateCasePaymentDueDay(
  id: string,
  paymentDueDay: number | undefined
): SavedCaseRecord[] {
  const cases = getSavedCases();
  const updated = cases.map((c) => {
    if (c.id !== id) return c;
    return {
      ...c,
      paymentDueDay,
      updatedAt: Date.now(),
    };
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to update payment due day in localStorage:', err);
  }
  return updated;
}

export function updateCaseGoogleMapsLocation(
  id: string,
  googleMapsLocation: string
): SavedCaseRecord[] {
  const cases = getSavedCases();
  const updated = cases.map((c) => {
    if (c.id !== id) return c;
    return {
      ...c,
      googleMapsLocation,
      updatedAt: Date.now(),
    };
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to update Google Maps location in localStorage:', err);
  }
  return updated;
}

export function updateCaseApprovalDoc(
  id: string,
  approvalDoc?: ApprovalDocInfo
): SavedCaseRecord[] {
  const cases = getSavedCases();
  const updated = cases.map((c) => {
    if (c.id !== id) return c;
    return {
      ...c,
      approvalDoc,
      updatedAt: Date.now(),
    };
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to update approval doc in localStorage:', err);
  }
  return updated;
}

export function getGoogleMapsNavigationUrl(input?: string): string {
  if (!input || !input.trim()) return '';
  const trimmed = input.trim();
  // If already a web link (https://maps.app.goo.gl/..., https://goo.gl/maps/..., https://www.google.com/maps...)
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  // Otherwise format as Google Maps search / navigation query
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
}

export function clearAllCaseRecords(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear cases in localStorage:', err);
  }
}

export function exportCasesAsJson(): string {
  const cases = getSavedCases();
  return JSON.stringify(
    {
      app: 'MotoLease Calculator Next Capital',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      cases,
    },
    null,
    2
  );
}

export function importCasesFromJson(jsonStr: string): { success: boolean; count: number; error?: string } {
  try {
    const data = JSON.parse(jsonStr);
    const incoming: SavedCaseRecord[] = Array.isArray(data) ? data : data.cases;
    if (!Array.isArray(incoming)) {
      return { success: false, count: 0, error: 'รูปแบบไฟล์ไม่ถูกต้อง (ต้องเป็นรายการเคส)' };
    }

    const current = getSavedCases();
    const currentIds = new Set(current.map((c) => c.id));
    let addedCount = 0;

    const merged = [...current];
    incoming.forEach((item) => {
      if (item && item.vehiclePrice && item.proposalKey) {
        // Ensure id is unique
        let finalId = item.id || `case-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        if (currentIds.has(finalId)) {
          finalId = `case-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        }
        merged.push({
          ...item,
          id: finalId,
          createdAt: item.createdAt || Date.now(),
          updatedAt: item.updatedAt || Date.now(),
        });
        currentIds.add(finalId);
        addedCount++;
      }
    });

    merged.sort((a, b) => b.createdAt - a.createdAt);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return { success: true, count: addedCount };
  } catch (err) {
    return { success: false, count: 0, error: 'ไม่สามารถอ่านไฟล์ JSON ได้ หรือไฟล์เสียหาย' };
  }
}

export interface FirstPaymentDueDateInfo {
  date: Date;
  isoDateStr: string; // "2026-11-02"
  day: number; // 2
  month: number; // 1 to 12
  monthName: string; // "พฤศจิกายน"
  monthShort: string; // "พ.ย."
  year: number; // 2026
  thaiYear: number; // 2569
  thaiShortYear: string; // "69"
  formattedShort: string; // "2 พ.ย. 2569"
  formattedLong: string; // "2 พฤศจิกายน พ.ศ. 2569"
  cycleRangeText: string; // "รอบรับรถ 11 ก.ย. - 10 ต.ค."
  key: string; // "2569-11"
}

const THAI_MONTH_NAMES_LIST = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];
const THAI_MONTH_SHORTS_LIST = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

/**
 * คำนวณวันกำหนดชำระงวดแรกอัตโนมัติตามเกณฑ์:
 * - กำหนดชำระทุกวันที่ 2 ของทุกเดือนทุกราย
 * - ช่วงวันรับรถ 11 เดือน M ถึง 10 เดือน M+1 จะชำระงวดแรก 2 เดือน M+2
 *   ตัวอย่าง:
 *   - รับรถ 11 ก.ย. - 10 ต.ค. -> งวดแรก 2 พ.ย.
 *   - รับรถ 11 ต.ค. - 10 พ.ย. -> งวดแรก 2 ธ.ค.
 */
export function calculateFirstPaymentDueDate(deliveryDateInput?: string | number): FirstPaymentDueDateInfo {
  let d: Date;
  if (!deliveryDateInput) {
    d = new Date();
  } else if (typeof deliveryDateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(deliveryDateInput)) {
    const parts = deliveryDateInput.split('-').map(Number);
    d = new Date(parts[0], parts[1] - 1, parts[2]);
  } else {
    d = new Date(deliveryDateInput);
  }

  if (isNaN(d.getTime())) {
    d = new Date();
  }

  const deliveryDay = d.getDate();
  const deliveryMonth = d.getMonth(); // 0 to 11
  const deliveryYear = d.getFullYear();

  // กฎการตัดรอบ:
  // หากรับรถวันที่ 1-10 ของเดือน ให้บวก 1 เดือน -> วันที่ 2 ของเดือนถัดไป
  // หากรับรถวันที่ 11 ขึ้นไปของเดือน ให้บวก 2 เดือน -> วันที่ 2 ของอีก 2 เดือนถัดไป
  const offset = deliveryDay <= 10 ? 1 : 2;
  const dueDate = new Date(deliveryYear, deliveryMonth + offset, 2);

  const dueDay = 2;
  const dueMonth = dueDate.getMonth() + 1; // 1 to 12
  const dueYear = dueDate.getFullYear();
  const thaiYear = dueYear + 543;
  const thaiShortYear = (thaiYear % 100).toString().padStart(2, '0');

  const monthName = THAI_MONTH_NAMES_LIST[dueMonth - 1] || `เดือน ${dueMonth}`;
  const monthShort = THAI_MONTH_SHORTS_LIST[dueMonth - 1] || `${dueMonth}`;

  // คำนวณช่วงรอบการรับรถเพื่อแสดงผลประกอบความเข้าใจ
  const startCycleMonthIndex = deliveryDay <= 10 ? deliveryMonth - 1 : deliveryMonth;
  const endCycleMonthIndex = deliveryDay <= 10 ? deliveryMonth : deliveryMonth + 1;
  const startRef = new Date(deliveryYear, startCycleMonthIndex, 11);
  const endRef = new Date(deliveryYear, endCycleMonthIndex, 10);
  const startMonthShort = THAI_MONTH_SHORTS_LIST[startRef.getMonth()];
  const endMonthShort = THAI_MONTH_SHORTS_LIST[endRef.getMonth()];
  const cycleRangeText = `รอบรับรถ 11 ${startMonthShort} - 10 ${endMonthShort}`;

  const isoMonthStr = dueMonth.toString().padStart(2, '0');
  const isoDateStr = `${dueYear}-${isoMonthStr}-02`;

  return {
    date: dueDate,
    isoDateStr,
    day: dueDay,
    month: dueMonth,
    monthName,
    monthShort,
    year: dueYear,
    thaiYear,
    thaiShortYear,
    formattedShort: `2 ${monthShort} ${thaiYear}`,
    formattedLong: `2 ${monthName} พ.ศ. ${thaiYear}`,
    cycleRangeText,
    key: `${thaiYear}-${isoMonthStr}`,
  };
}

export function updateCaseInstallmentPayment(
  id: string,
  installmentNo: number,
  status?: InstallmentPaymentStatus
): SavedCaseRecord[] {
  const cases = getSavedCases();
  const updated = cases.map((c) => {
    if (c.id !== id) return c;
    const nextPayments: Record<number, InstallmentPaymentStatus> = {
      ...(c.installmentPayments || {}),
    };
    if (status) {
      nextPayments[installmentNo] = status;
    } else {
      delete nextPayments[installmentNo];
    }
    return {
      ...c,
      installmentPayments: nextPayments,
      updatedAt: Date.now(),
    };
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to update installment payment status in localStorage:', err);
  }
  return updated;
}

export function updateCaseTrackingDetails(
  id: string,
  updates: {
    customerName?: string;
    customerPhone?: string;
    bikeBrand?: string;
    bikeModelName?: string;
    bikeModelCode?: string;
    deliveryDate?: string;
    paymentDueDay?: number;
    monthlyInstallment?: number;
    googleMapsLocation?: string;
  }
): SavedCaseRecord[] {
  const cases = getSavedCases();
  const updated = cases.map((c) => {
    if (c.id !== id) return c;
    const cleanName = updates.customerName !== undefined ? updates.customerName.trim() : undefined;
    return {
      ...c,
      ...(cleanName ? { customerName: cleanName, caseTitle: cleanName } : {}),
      ...(updates.customerPhone !== undefined ? { customerPhone: updates.customerPhone.trim() || undefined } : {}),
      ...(updates.bikeBrand !== undefined ? { bikeBrand: updates.bikeBrand.trim() || undefined } : {}),
      ...(updates.bikeModelName !== undefined ? { bikeModelName: updates.bikeModelName.trim() || undefined } : {}),
      ...(updates.bikeModelCode !== undefined ? { bikeModelCode: updates.bikeModelCode.trim().toUpperCase() || undefined } : {}),
      ...(updates.deliveryDate !== undefined ? { deliveryDate: updates.deliveryDate || undefined } : {}),
      ...(updates.paymentDueDay !== undefined ? { paymentDueDay: updates.paymentDueDay } : {}),
      ...(updates.googleMapsLocation !== undefined
        ? { googleMapsLocation: updates.googleMapsLocation.trim() || undefined }
        : {}),
      ...(updates.monthlyInstallment !== undefined && updates.monthlyInstallment > 0
        ? {
            snapshot: {
              ...c.snapshot,
              monthlyInstallment: updates.monthlyInstallment,
            },
          }
        : {}),
      updatedAt: Date.now(),
    };
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to update tracking details in localStorage:', err);
  }
  return updated;
}

export function resolveBikeBrand(record: {
  bikeBrand?: string;
  bikeModelCode?: string;
  bikeModelName?: string;
  proposalKey?: string;
}): string {
  if (record.bikeBrand && record.bikeBrand.trim()) {
    return record.bikeBrand.trim().toUpperCase();
  }
  if (record.bikeModelCode) {
    const matched = findModelByCode(record.bikeModelCode);
    if (matched?.brand) {
      return matched.brand.trim().toUpperCase();
    }
  }
  const nameUpper = (record.bikeModelName || '').toUpperCase();
  const knownBrands = ['HONDA', 'YAMAHA', 'VESPA', 'LAMBRETTA', 'SUZUKI', 'KAWASAKI', 'GPX'];
  for (const b of knownBrands) {
    if (nameUpper.includes(b)) return b;
  }
  if (record.proposalKey === 'fazzio') return 'YAMAHA';
  if (record.proposalKey === 'vespa') return 'VESPA/LAMBRETTA';
  return '-';
}

export interface InstallmentDueSlot {
  installmentNo: number;
  dueDate: Date;
  isoDate: string;
  monthKey: string; // e.g. "2026-10"
  monthLabelShort: string; // e.g. "ต.ค. 69"
  monthLabelLong: string; // e.g. "ตุลาคม 2569"
  formattedShort: string; // e.g. "2 พ.ย. 69"
  formattedFull: string; // e.g. "2 พ.ย. 2569"
  status?: InstallmentPaymentStatus;
}

export function formatThaiMonthYearLabel(monthKey: string): { short: string; long: string } {
  const [yStr, mStr] = monthKey.split('-');
  const y = Number(yStr) || new Date().getFullYear();
  const m = Math.min(12, Math.max(1, Number(mStr) || 1));
  const thaiYear = y + 543;
  const thaiShortYear = (thaiYear % 100).toString().padStart(2, '0');
  const monthShort = THAI_MONTH_SHORTS_LIST[m - 1] || `${m}`;
  const monthName = THAI_MONTH_NAMES_LIST[m - 1] || `เดือน ${m}`;
  return {
    short: `${monthShort} ${thaiShortYear}`,
    long: `${monthName} ${thaiYear}`,
  };
}

export function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const [yStr, mStr] = monthKey.split('-');
  const y = Number(yStr) || new Date().getFullYear();
  const m = (Number(mStr) || 1) - 1;
  const d = new Date(y, m + deltaMonths, 1);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

export function getNineInstallmentSchedule(record: SavedCaseRecord): InstallmentDueSlot[] {
  const firstDue = calculateFirstPaymentDueDate(
    record.deliveryDate || record.createdAt
  );
  const targetDay = record.paymentDueDay && record.paymentDueDay >= 1 && record.paymentDueDay <= 31
    ? record.paymentDueDay
    : firstDue.day;

  const baseYear = firstDue.year;
  const baseMonthIndex = firstDue.month - 1;
  const payments = record.installmentPayments || {};

  const slots: InstallmentDueSlot[] = [];
  for (let i = 1; i <= 9; i++) {
    const refMonthStart = new Date(baseYear, baseMonthIndex + (i - 1), 1);
    const y = refMonthStart.getFullYear();
    const m = refMonthStart.getMonth();
    const maxDay = new Date(y, m + 1, 0).getDate();
    const clampedDay = Math.min(targetDay, maxDay);
    const dueDate = new Date(y, m, clampedDay);

    const monthShort = THAI_MONTH_SHORTS_LIST[m] || `${m + 1}`;
    const monthName = THAI_MONTH_NAMES_LIST[m] || `เดือน ${m + 1}`;
    const thaiYear = y + 543;
    const thaiShortYear = (thaiYear % 100).toString().padStart(2, '0');
    const isoMonth = (m + 1).toString().padStart(2, '0');
    const isoDay = clampedDay.toString().padStart(2, '0');

    slots.push({
      installmentNo: i,
      dueDate,
      isoDate: `${y}-${isoMonth}-${isoDay}`,
      monthKey: `${y}-${isoMonth}`,
      monthLabelShort: `${monthShort} ${thaiShortYear}`,
      monthLabelLong: `${monthName} ${thaiYear}`,
      formattedShort: `${clampedDay} ${monthShort} ${thaiShortYear}`,
      formattedFull: `${clampedDay} ${monthShort} ${thaiYear}`,
      status: payments[i],
    });
  }
  return slots;
}



