import { SavedCaseRecord, CaseApprovalStatus, VehicleDeliveryStatus } from '../types';

const STORAGE_KEY = 'ncap_saved_cases_v1';

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

  const todayStr = new Date().toISOString().slice(0, 10);
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
  const todayStr = new Date().toISOString().slice(0, 10);
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

