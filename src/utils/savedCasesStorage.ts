import {
  SavedCaseRecord,
  CaseApprovalStatus,
  VehicleDeliveryStatus,
  ApprovalDocInfo,
  InstallmentPaymentStatus,
  ProposalKey,
} from '../types';
import { deleteApprovalDocFile, saveApprovalDocDataUrl } from './approvalDocsStorage';
import { findModelByCode } from '../data/motorcycleModels';

const STORAGE_KEY = 'ncap_saved_cases_v1';

const VALID_PROPOSAL_KEYS: ProposalKey[] = [
  'small_bike',
  'fazzio',
  'top_small',
  'aec',
  'vespa',
  'honda_yamaha',
  'second_hand',
];

export interface CloudSyncBridge {
  upsertCases: (records: SavedCaseRecord[]) => void;
  deleteCases: (ids: string[]) => void;
}

let activeCloudBridge: CloudSyncBridge | null = null;

// Track in-flight local uploads/deletes & confirmed Cloud IDs so real-time snapshots never wipe unsynced local cases
const pendingCloudUploadIds = new Set<string>();
const pendingCloudDeleteIds = new Set<string>();
const confirmedCloudIds = new Set<string>();

export function markPendingCloudUploads(ids: string[]): void {
  for (const id of ids) {
    const safeId = sanitizeCaseId(id);
    pendingCloudUploadIds.add(safeId);
    pendingCloudDeleteIds.delete(safeId);
  }
}

export function clearPendingCloudUploads(ids: string[]): void {
  for (const id of ids) {
    pendingCloudUploadIds.delete(sanitizeCaseId(id));
  }
}

export function markConfirmedCloudIds(ids: string[]): void {
  for (const id of ids) {
    confirmedCloudIds.add(sanitizeCaseId(id));
  }
}

export function markPendingCloudDeletes(ids: string[]): void {
  for (const id of ids) {
    const safeId = sanitizeCaseId(id);
    pendingCloudDeleteIds.add(safeId);
    pendingCloudUploadIds.delete(safeId);
  }
}

export function clearPendingCloudDeletes(ids: string[]): void {
  for (const id of ids) {
    const safeId = sanitizeCaseId(id);
    pendingCloudDeleteIds.delete(safeId);
    confirmedCloudIds.delete(safeId);
  }
}

export function resetCloudSyncTracking(): void {
  pendingCloudUploadIds.clear();
  pendingCloudDeleteIds.clear();
  confirmedCloudIds.clear();
}

export function registerCloudSyncBridge(bridge: CloudSyncBridge | null): void {
  activeCloudBridge = bridge;
}

export function sanitizeCaseId(rawId?: string): string {
  const cleaned = (typeof rawId === 'string' ? rawId : '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  if (cleaned && /^[a-zA-Z0-9_-]+$/.test(cleaned)) {
    return cleaned;
  }
  return `case-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

function emitLocalCasesChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ncap-cases-synced'));
  }
}

function stripHeavyApprovalDocDataUrl(cases: SavedCaseRecord[]): SavedCaseRecord[] {
  return cases.map((c) => {
    if (!c.approvalDoc?.dataUrl) return c;
    void saveApprovalDocDataUrl(c.id, {
      name: c.approvalDoc.name || 'เอกสารการอนุมัติ.pdf',
      size: c.approvalDoc.size,
      type: c.approvalDoc.type,
      uploadedAt: c.approvalDoc.uploadedAt,
      dataUrl: c.approvalDoc.dataUrl,
    });
    const { dataUrl: _omitted, ...restDoc } = c.approvalDoc;
    return {
      ...c,
      approvalDoc: restDoc,
    };
  });
}

function persistSavedCases(cases: SavedCaseRecord[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
    return true;
  } catch (err) {
    // Retry after offloading any inline base64 PDFs to IndexedDB
    try {
      const lighter = stripHeavyApprovalDocDataUrl(cases);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lighter));
      return true;
    } catch (retryErr) {
      console.error('Failed to persist saved cases to localStorage:', err, retryErr);
      return false;
    }
  }
}

/**
 * Ensure all existing local cases have unique Firestore-valid IDs and valid timestamps before Cloud sync
 */
export function normalizeLocalCaseIdsForCloud(): SavedCaseRecord[] {
  const current = getSavedCases();
  if (current.length === 0) return current;

  const seenIds = new Set<string>();
  let changed = false;
  const now = Date.now();

  const normalized = current.map((c, idx) => {
    let nextId = typeof c.id === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(c.id)
      ? c.id
      : sanitizeCaseId(c.id);

    if (seenIds.has(nextId)) {
      changed = true;
      let suffix = idx + 1;
      const base = nextId.slice(0, 108);
      while (seenIds.has(`${base}-${suffix}`)) {
        suffix++;
      }
      nextId = `${base}-${suffix}`;
    } else if (nextId !== c.id) {
      changed = true;
    }
    seenIds.add(nextId);

    const createdAt = typeof c.createdAt === 'number' && Number.isFinite(c.createdAt) && c.createdAt > 0
      ? c.createdAt
      : now - idx;
    const updatedAt = typeof c.updatedAt === 'number' && Number.isFinite(c.updatedAt) && c.updatedAt > 0
      ? c.updatedAt
      : createdAt;

    if (createdAt !== c.createdAt || updatedAt !== c.updatedAt) {
      changed = true;
    }

    let approvalDoc = c.approvalDoc;
    if (approvalDoc?.dataUrl) {
      changed = true;
      void saveApprovalDocDataUrl(nextId, {
        name: approvalDoc.name || 'เอกสารการอนุมัติ.pdf',
        size: approvalDoc.size,
        type: approvalDoc.type,
        uploadedAt: approvalDoc.uploadedAt,
        dataUrl: approvalDoc.dataUrl,
      });
      const { dataUrl: _omitted, ...restDoc } = approvalDoc;
      approvalDoc = restDoc;
    }

    return {
      ...c,
      id: nextId,
      createdAt,
      updatedAt,
      ...(approvalDoc ? { approvalDoc } : {}),
    };
  });

  if (changed) {
    normalized.sort((a, b) => b.createdAt - a.createdAt);
    persistSavedCases(normalized);
  }
  return normalized;
}

export interface MergeCloudCasesOptions {
  fromCache?: boolean;
  isServerSnapshotSettled?: boolean;
}

export function mergeCloudCasesIntoLocal(
  cloudCases: SavedCaseRecord[],
  options: MergeCloudCasesOptions = {}
): SavedCaseRecord[] {
  const { fromCache = false, isServerSnapshotSettled = false } = options;
  const localCurrent = getSavedCases();

  const localMap = new Map<string, SavedCaseRecord>();
  for (const c of localCurrent) {
    const safeId = sanitizeCaseId(c.id);
    localMap.set(safeId, c.id === safeId ? c : { ...c, id: safeId });
  }

  const cloudMap = new Map<string, SavedCaseRecord>();
  for (const c of cloudCases) {
    const safeId = sanitizeCaseId(c.id);
    if (pendingCloudDeleteIds.has(safeId)) continue;
    cloudMap.set(safeId, c.id === safeId ? c : { ...c, id: safeId });
    if (!fromCache) {
      confirmedCloudIds.add(safeId);
    }
  }

  const resultMap = new Map<string, SavedCaseRecord>();

  // 1. Reconcile cases present in Cloud
  for (const [id, cloudRecord] of cloudMap.entries()) {
    const localRecord = localMap.get(id);
    if (!localRecord) {
      resultMap.set(id, cloudRecord);
      continue;
    }

    const isPendingLocalWrite = pendingCloudUploadIds.has(id);
    const localUpdated = Number(localRecord.updatedAt) || 0;
    const cloudUpdated = Number(cloudRecord.updatedAt) || 0;

    let hydratedCloud: SavedCaseRecord = cloudRecord;
    if (cloudRecord.approvalDoc && localRecord.approvalDoc?.dataUrl && !cloudRecord.approvalDoc.dataUrl) {
      hydratedCloud = {
        ...cloudRecord,
        approvalDoc: {
          ...cloudRecord.approvalDoc,
          dataUrl: localRecord.approvalDoc.dataUrl,
        },
      };
    } else if (!cloudRecord.approvalDoc && localRecord.approvalDoc && localUpdated >= cloudUpdated) {
      hydratedCloud = {
        ...cloudRecord,
        approvalDoc: localRecord.approvalDoc,
      };
    }

    if (isPendingLocalWrite || localUpdated > cloudUpdated) {
      resultMap.set(id, localRecord);
    } else {
      resultMap.set(id, hydratedCloud);
    }
  }

  // 2. Preserve local-only cases that haven't been synced to Cloud yet!
  for (const [id, localRecord] of localMap.entries()) {
    if (resultMap.has(id)) continue;
    if (pendingCloudDeleteIds.has(id)) continue;

    const shouldDeleteFromLocal =
      !pendingCloudUploadIds.has(id) &&
      !fromCache &&
      isServerSnapshotSettled &&
      confirmedCloudIds.has(id);

    if (!shouldDeleteFromLocal) {
      resultMap.set(id, localRecord);
    }
  }

  const merged = Array.from(resultMap.values()).sort(
    (a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)
  );

  persistSavedCases(merged);
  emitLocalCasesChanged();
  return merged;
}

export function replaceSavedCasesFromCloud(cloudCases: SavedCaseRecord[]): SavedCaseRecord[] {
  return mergeCloudCasesIntoLocal(cloudCases, {
    fromCache: false,
    isServerSnapshotSettled: false,
  });
}

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
        deliveryConfirmedAt: data.deliveryConfirmedAt !== undefined ? data.deliveryConfirmedAt : existing.deliveryConfirmedAt,
        paymentDueDay: data.paymentDueDay !== undefined ? data.paymentDueDay : existing.paymentDueDay,
        googleMapsLocation: data.googleMapsLocation !== undefined ? data.googleMapsLocation : existing.googleMapsLocation,
        bikeBrand: data.bikeBrand !== undefined ? data.bikeBrand : existing.bikeBrand,
        installmentPayments:
          data.installmentPayments !== undefined ? data.installmentPayments : existing.installmentPayments,
        approvalDoc: data.approvalDoc !== undefined ? data.approvalDoc : existing.approvalDoc,
        updatedAt: now,
      };
      cases[index] = updated;
      persistSavedCases(cases);
      markPendingCloudUploads([updated.id]);
      activeCloudBridge?.upsertCases([updated]);
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
  const initialDeliveryConfirmedAt =
    initialDeliveryStatus === 'delivered' ? (data.deliveryConfirmedAt || now) : data.deliveryConfirmedAt;

  const newRecord: SavedCaseRecord = {
    ...data,
    approvalStatus: initialApprovalStatus,
    deliveryStatus: initialDeliveryStatus,
    approvalDate: initialApprovalDate,
    deliveryDate: initialDeliveryDate,
    deliveryConfirmedAt: initialDeliveryConfirmedAt,
    paymentDueDay: data.paymentDueDay,
    googleMapsLocation: data.googleMapsLocation,
    bikeBrand: data.bikeBrand,
    installmentPayments: data.installmentPayments,
    approvalDoc: data.approvalDoc,
    id: sanitizeCaseId(data.id),
    createdAt: now,
    updatedAt: now,
  };

  const updatedCases = [newRecord, ...cases];
  persistSavedCases(updatedCases);
  markPendingCloudUploads([newRecord.id]);
  activeCloudBridge?.upsertCases([newRecord]);
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
  markPendingCloudDeletes([id]);
  activeCloudBridge?.deleteCases([id]);
  return filtered;
}

function finalizeUpdatedCase(updated: SavedCaseRecord[], id: string): SavedCaseRecord[] {
  persistSavedCases(updated);
  const changed = updated.find((c) => c.id === id);
  if (changed) {
    markPendingCloudUploads([changed.id]);
    activeCloudBridge?.upsertCases([changed]);
  }
  return updated;
}

export function updateCaseTitle(id: string, newTitle: string): SavedCaseRecord[] {
  const cases = getSavedCases();
  const updated = cases.map((c) =>
    c.id === id ? { ...c, caseTitle: newTitle, customerName: newTitle, updatedAt: Date.now() } : c
  );
  return finalizeUpdatedCase(updated, id);
}

export function updateCaseDealerName(id: string, dealerName: string): SavedCaseRecord[] {
  const cases = getSavedCases();
  const updated = cases.map((c) =>
    c.id === id ? { ...c, dealerName: dealerName.trim() || undefined, updatedAt: Date.now() } : c
  );
  return finalizeUpdatedCase(updated, id);
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
  return finalizeUpdatedCase(updated, id);
}

export function updateCaseDeliveryStatus(
  id: string,
  deliveryStatus: VehicleDeliveryStatus
): SavedCaseRecord[] {
  const cases = getSavedCases();
  const todayStr = getLocalTodayDateStr();
  const now = Date.now();
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
      deliveryConfirmedAt: deliveryStatus === 'delivered' ? now : undefined,
      paymentDueDay: deliveryStatus === 'delivered' ? (c.paymentDueDay || 2) : c.paymentDueDay,
      updatedAt: now,
    };
  });
  return finalizeUpdatedCase(updated, id);
}

export function updateCaseDates(
  id: string,
  dates: { approvalDate?: string; deliveryDate?: string }
): SavedCaseRecord[] {
  const cases = getSavedCases();
  const updated = cases.map((c) =>
    c.id === id
      ? {
          ...c,
          approvalDate: dates.approvalDate !== undefined ? dates.approvalDate : c.approvalDate,
          deliveryDate: dates.deliveryDate !== undefined ? dates.deliveryDate : c.deliveryDate,
          updatedAt: Date.now(),
        }
      : c
  );
  return finalizeUpdatedCase(updated, id);
}

export function updateCasePaymentDueDay(
  id: string,
  paymentDueDay: number | undefined
): SavedCaseRecord[] {
  const cases = getSavedCases();
  const updated = cases.map((c) =>
    c.id === id
      ? {
          ...c,
          paymentDueDay,
          updatedAt: Date.now(),
        }
      : c
  );
  return finalizeUpdatedCase(updated, id);
}

export function updateCaseGoogleMapsLocation(
  id: string,
  googleMapsLocation: string
): SavedCaseRecord[] {
  const cases = getSavedCases();
  const updated = cases.map((c) =>
    c.id === id
      ? {
          ...c,
          googleMapsLocation,
          updatedAt: Date.now(),
        }
      : c
  );
  return finalizeUpdatedCase(updated, id);
}

export function updateCaseApprovalDoc(
  id: string,
  approvalDoc?: ApprovalDocInfo
): SavedCaseRecord[] {
  const cases = getSavedCases();
  const updated = cases.map((c) =>
    c.id === id
      ? {
          ...c,
          approvalDoc,
          updatedAt: Date.now(),
        }
      : c
  );
  return finalizeUpdatedCase(updated, id);
}

export function getGoogleMapsNavigationUrl(input?: string): string {
  if (!input || !input.trim()) return '';
  const trimmed = input.trim();

  // Extract an embedded http/https URL if user pasted share text from Google Maps app
  const urlMatch = trimmed.match(/https?:\/\/[^\s]+/i);
  if (urlMatch) {
    return urlMatch[0];
  }

  // Handle schemeless Google Maps links like "maps.app.goo.gl/..." or "www.google.com/maps/..."
  if (/^(maps\.app\.goo\.gl|goo\.gl\/maps|(?:www\.|maps\.)?google\.com\/maps)\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  // Otherwise format coordinates or address text as Google Maps search / navigation query
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
}

export function clearAllCaseRecords(): void {
  const existingIds = getSavedCases().map((c) => c.id);
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear cases in localStorage:', err);
  }
  if (existingIds.length > 0) {
    markPendingCloudDeletes(existingIds);
    activeCloudBridge?.deleteCases(existingIds);
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

function parseFlexNumber(val: unknown, fallback = 0): number {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : fallback;
  }
  if (typeof val === 'string') {
    const cleaned = val.replace(/,/g, '').trim();
    if (!cleaned) return fallback;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function parseFlexTimestamp(val: unknown, fallback: number): number {
  if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
    return Math.round(val);
  }
  if (typeof val === 'string' && val.trim()) {
    const asNum = Number(val.trim());
    if (Number.isFinite(asNum) && asNum > 0) return Math.round(asNum);
    const parsed = Date.parse(val.trim());
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

function isLikelyCaseObject(raw: unknown): raw is Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const obj = raw as Record<string, unknown>;
  return (
    obj.vehiclePrice !== undefined ||
    obj.snapshot !== undefined ||
    obj.customerName !== undefined ||
    obj.caseTitle !== undefined ||
    obj.proposalKey !== undefined ||
    obj.bikeModelName !== undefined ||
    obj.term !== undefined ||
    obj.downValue !== undefined
  );
}

function normalizeImportedRecord(
  raw: Record<string, unknown>,
  finalId: string,
  fallbackNow: number
): SavedCaseRecord {
  const rawSnap =
    raw.snapshot && typeof raw.snapshot === 'object' && !Array.isArray(raw.snapshot)
      ? (raw.snapshot as Record<string, unknown>)
      : {};

  const proposalKeyRaw = typeof raw.proposalKey === 'string' ? raw.proposalKey.trim() : '';
  const proposalKey: ProposalKey = VALID_PROPOSAL_KEYS.includes(proposalKeyRaw as ProposalKey)
    ? (proposalKeyRaw as ProposalKey)
    : 'small_bike';

  const vehiclePrice = Math.max(0, Math.min(10000000, parseFlexNumber(raw.vehiclePrice, 0)));
  const downMode: 'amount' | 'percent' = raw.downMode === 'percent' ? 'percent' : 'amount';
  const downValue = Math.max(0, Math.min(10000000, parseFlexNumber(raw.downValue, 0)));
  const term = Math.max(1, Math.min(120, Math.round(parseFlexNumber(raw.term, 36)) || 36));
  const registrationFee = Math.max(0, Math.min(1000000, parseFlexNumber(raw.registrationFee, 0)));
  const theftInsuranceFee = Math.max(0, Math.min(1000000, parseFlexNumber(raw.theftInsuranceFee, 0)));
  const customRateType: 'monthly' | 'annual' = raw.customRateType === 'annual' ? 'annual' : 'monthly';
  const insurancePlan: 'none' | 'plan_a' | 'plan_b' =
    raw.insurancePlan === 'plan_a' || raw.insurancePlan === 'plan_b' ? raw.insurancePlan : 'none';
  const parsedInsYears = parseFlexNumber(raw.insuranceYears, 1);
  const insuranceYears: 1 | 2 | 3 = parsedInsYears === 2 ? 2 : parsedInsYears === 3 ? 3 : 1;

  const customerName =
    typeof raw.customerName === 'string' && raw.customerName.trim()
      ? raw.customerName.trim()
      : typeof raw.caseTitle === 'string' && raw.caseTitle.trim()
      ? raw.caseTitle.trim()
      : 'คุณลูกค้า';
  const caseTitle =
    typeof raw.caseTitle === 'string' && raw.caseTitle.trim()
      ? raw.caseTitle.trim()
      : customerName;

  const createdAt = parseFlexTimestamp(raw.createdAt ?? raw.recordCreatedAt, fallbackNow);
  const updatedAt = parseFlexTimestamp(raw.updatedAt ?? raw.recordUpdatedAt, createdAt);

  const downAmount = parseFlexNumber(
    rawSnap.downAmount,
    downMode === 'percent' ? Math.round((vehiclePrice * downValue) / 100) : downValue
  );
  const financeAmount = parseFlexNumber(rawSnap.financeAmount, Math.max(0, vehiclePrice - downAmount));
  const downPercent = parseFlexNumber(
    rawSnap.downPercent,
    vehiclePrice > 0 ? Number(((downAmount / vehiclePrice) * 100).toFixed(2)) : 0
  );

  const snapshot: SavedCaseRecord['snapshot'] = {
    monthlyInstallment: parseFlexNumber(rawSnap.monthlyInstallment, 0),
    financeAmount,
    downAmount,
    downPercent,
    totalInterest: parseFlexNumber(rawSnap.totalInterest, 0),
    totalWithVat: parseFlexNumber(rawSnap.totalWithVat, financeAmount),
    effectiveMonthlyRate: parseFlexNumber(rawSnap.effectiveMonthlyRate, 0),
    eirAnnualPercent: parseFlexNumber(rawSnap.eirAnnualPercent, 0),
    proposalCode: typeof rawSnap.proposalCode === 'string' ? rawSnap.proposalCode : '',
    proposalName: typeof rawSnap.proposalName === 'string' ? rawSnap.proposalName : '',
    rateDisplayText: typeof rawSnap.rateDisplayText === 'string' ? rawSnap.rateDisplayText : '',
    ...(rawSnap.rawMonthlyInstallment !== undefined
      ? { rawMonthlyInstallment: parseFlexNumber(rawSnap.rawMonthlyInstallment, 0) }
      : {}),
    ...(rawSnap.totalDriveAwayCost !== undefined
      ? { totalDriveAwayCost: parseFlexNumber(rawSnap.totalDriveAwayCost, 0) }
      : {}),
  };

  let approvalDoc: ApprovalDocInfo | undefined;
  if (raw.approvalDoc && typeof raw.approvalDoc === 'object' && !Array.isArray(raw.approvalDoc)) {
    const docObj = raw.approvalDoc as Record<string, unknown>;
    const docName = typeof docObj.name === 'string' ? docObj.name.trim() : '';
    if (docName) {
      const uploadedAt = parseFlexTimestamp(docObj.uploadedAt, createdAt);
      const size = Math.max(0, parseFlexNumber(docObj.size, 0));
      const type = typeof docObj.type === 'string' && docObj.type ? docObj.type : undefined;
      if (typeof docObj.dataUrl === 'string' && docObj.dataUrl) {
        void saveApprovalDocDataUrl(finalId, {
          name: docName,
          size,
          type,
          uploadedAt,
          dataUrl: docObj.dataUrl,
        });
      }
      approvalDoc = {
        name: docName,
        size,
        uploadedAt,
        ...(type ? { type } : {}),
      };
    }
  }

  let installmentPayments: Record<number, InstallmentPaymentStatus> | undefined;
  if (raw.installmentPayments && typeof raw.installmentPayments === 'object' && !Array.isArray(raw.installmentPayments)) {
    const clean: Record<number, InstallmentPaymentStatus> = {};
    let count = 0;
    for (const [k, v] of Object.entries(raw.installmentPayments as Record<string, unknown>)) {
      if (count >= 12) break;
      const idx = Number(k);
      if (Number.isFinite(idx) && (v === 'paid' || v === 'unpaid')) {
        clean[idx] = v;
        count++;
      }
    }
    if (count > 0) installmentPayments = clean;
  }

  const approvalStatusRaw = raw.approvalStatus;
  const approvalStatus: CaseApprovalStatus | undefined =
    approvalStatusRaw === 'pending' ||
    approvalStatusRaw === 'approved' ||
    approvalStatusRaw === 'rejected' ||
    approvalStatusRaw === 'cancelled'
      ? approvalStatusRaw
      : undefined;

  const deliveryStatusRaw = raw.deliveryStatus;
  const deliveryStatus: VehicleDeliveryStatus | undefined =
    deliveryStatusRaw === 'pending_delivery' || deliveryStatusRaw === 'delivered'
      ? deliveryStatusRaw
      : undefined;

  const paymentDueDayRaw = raw.paymentDueDay !== undefined ? parseFlexNumber(raw.paymentDueDay, 0) : 0;
  const paymentDueDay =
    paymentDueDayRaw >= 1 && paymentDueDayRaw <= 31 ? Math.round(paymentDueDayRaw) : undefined;

  return {
    id: finalId,
    createdAt,
    updatedAt,
    caseTitle,
    officerName: typeof raw.officerName === 'string' ? raw.officerName : '',
    officerCode: typeof raw.officerCode === 'string' ? raw.officerCode : '',
    ...(typeof raw.officerLicense === 'string' && raw.officerLicense ? { officerLicense: raw.officerLicense } : {}),
    customerName,
    ...(typeof raw.customerPhone === 'string' && raw.customerPhone ? { customerPhone: raw.customerPhone } : {}),
    ...(typeof raw.customerNote === 'string' && raw.customerNote ? { customerNote: raw.customerNote } : {}),
    ...(typeof raw.customerAge === 'string' && raw.customerAge ? { customerAge: raw.customerAge } : {}),
    ...(typeof raw.customerWorkMonths === 'string' && raw.customerWorkMonths
      ? { customerWorkMonths: raw.customerWorkMonths }
      : {}),
    ...(typeof raw.customerIncome === 'string' && raw.customerIncome
      ? { customerIncome: raw.customerIncome }
      : {}),
    ...(typeof raw.customerResidenceMonths === 'string' && raw.customerResidenceMonths
      ? { customerResidenceMonths: raw.customerResidenceMonths }
      : {}),
    ...(typeof raw.customerOccupation === 'string' && raw.customerOccupation
      ? { customerOccupation: raw.customerOccupation }
      : {}),
    ...(raw.isAceCustomer !== undefined ? { isAceCustomer: Boolean(raw.isAceCustomer) } : {}),
    ...(typeof raw.dealerName === 'string' && raw.dealerName ? { dealerName: raw.dealerName } : {}),
    proposalKey,
    vehiclePrice,
    ...(typeof raw.bikeModelName === 'string' && raw.bikeModelName ? { bikeModelName: raw.bikeModelName } : {}),
    ...(typeof raw.bikeModelCode === 'string' && raw.bikeModelCode ? { bikeModelCode: raw.bikeModelCode } : {}),
    ...(typeof raw.bikeBrand === 'string' && raw.bikeBrand ? { bikeBrand: raw.bikeBrand } : {}),
    downMode,
    downValue,
    term,
    includeDeliveryFees: Boolean(raw.includeDeliveryFees),
    registrationFee,
    theftInsuranceFee,
    isCustomRateEnabled: Boolean(raw.isCustomRateEnabled),
    customRateInput: typeof raw.customRateInput === 'string' ? raw.customRateInput : '',
    customRateType,
    enforceEirCap: Boolean(raw.enforceEirCap),
    insurancePlan,
    insuranceYears,
    snapshot,
    ...(approvalStatus ? { approvalStatus } : {}),
    ...(deliveryStatus ? { deliveryStatus } : {}),
    ...(typeof raw.approvalDate === 'string' && raw.approvalDate ? { approvalDate: raw.approvalDate } : {}),
    ...(typeof raw.deliveryDate === 'string' && raw.deliveryDate ? { deliveryDate: raw.deliveryDate } : {}),
    ...(raw.deliveryConfirmedAt !== undefined
      ? { deliveryConfirmedAt: parseFlexTimestamp(raw.deliveryConfirmedAt, updatedAt) }
      : {}),
    ...(typeof raw.approvalNote === 'string' && raw.approvalNote ? { approvalNote: raw.approvalNote } : {}),
    ...(raw.approvalUpdatedAt !== undefined
      ? { approvalUpdatedAt: parseFlexTimestamp(raw.approvalUpdatedAt, updatedAt) }
      : {}),
    ...(paymentDueDay !== undefined ? { paymentDueDay } : {}),
    ...(typeof raw.googleMapsLocation === 'string' && raw.googleMapsLocation
      ? { googleMapsLocation: raw.googleMapsLocation }
      : {}),
    ...(installmentPayments ? { installmentPayments } : {}),
    ...(approvalDoc ? { approvalDoc } : {}),
  };
}

export interface ImportCasesResult {
  success: boolean;
  count: number;
  addedCount?: number;
  updatedCount?: number;
  skippedCount?: number;
  totalCount?: number;
  records?: SavedCaseRecord[];
  error?: string;
}

export function mergeBackupJsonIntoLocal(
  jsonStr: string,
  options: { triggerCloudBridge?: boolean } = { triggerCloudBridge: true }
): ImportCasesResult {
  try {
    const cleanJson = jsonStr.replace(/^\uFEFF/, '').trim();
    const data = JSON.parse(cleanJson);

    let incoming: unknown[] | null = null;
    if (Array.isArray(data)) {
      incoming = data;
    } else if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      if (Array.isArray(obj.cases)) incoming = obj.cases;
      else if (Array.isArray(obj.records)) incoming = obj.records;
      else if (Array.isArray(obj.data)) incoming = obj.data;
      else if (Array.isArray(obj.items)) incoming = obj.items;
      else if (isLikelyCaseObject(obj)) incoming = [obj];
    }

    if (!Array.isArray(incoming)) {
      return { success: false, count: 0, error: 'รูปแบบไฟล์ไม่ถูกต้อง (ต้องเป็นรายการเคส .json)' };
    }

    const current = normalizeLocalCaseIdsForCloud();
    const existingIndexMap = new Map<string, number>();
    const usedIds = new Set<string>();
    const merged: SavedCaseRecord[] = [...current];
    merged.forEach((c, idx) => {
      existingIndexMap.set(c.id, idx);
      usedIds.add(c.id);
    });

    const seenInImportFile = new Set<string>();
    const toSyncRecords: SavedCaseRecord[] = [];
    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const baseNow = Date.now();

    incoming.forEach((rawItem, idx) => {
      if (!isLikelyCaseObject(rawItem)) {
        skippedCount++;
        return;
      }

      const rawIdStr = typeof rawItem.id === 'string' && rawItem.id.trim() ? rawItem.id.trim() : '';
      const cleanedBaseId = rawIdStr
        ? rawIdStr.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 120)
        : '';

      const fallbackTime = baseNow - idx;

      // If this item has an explicit valid ID matching an existing local case (and not seen twice in this file),
      // merge/update in place without duplicating or losing fields
      if (
        cleanedBaseId &&
        /^[a-zA-Z0-9_-]+$/.test(cleanedBaseId) &&
        existingIndexMap.has(cleanedBaseId) &&
        !seenInImportFile.has(cleanedBaseId)
      ) {
        seenInImportFile.add(cleanedBaseId);
        const existingIdx = existingIndexMap.get(cleanedBaseId)!;
        const existingRec = merged[existingIdx];
        const normalizedIncoming = normalizeImportedRecord(rawItem, cleanedBaseId, fallbackTime);
        const mergedRec: SavedCaseRecord =
          normalizedIncoming.updatedAt >= (existingRec.updatedAt || 0)
            ? {
                ...existingRec,
                ...normalizedIncoming,
                id: cleanedBaseId,
                createdAt: existingRec.createdAt || normalizedIncoming.createdAt,
                updatedAt: Math.max(normalizedIncoming.updatedAt, existingRec.updatedAt || 0),
                approvalDoc: normalizedIncoming.approvalDoc || existingRec.approvalDoc,
              }
            : {
                ...normalizedIncoming,
                ...existingRec,
                id: cleanedBaseId,
                approvalDoc: existingRec.approvalDoc || normalizedIncoming.approvalDoc,
              };

        merged[existingIdx] = mergedRec;
        toSyncRecords.push(mergedRec);
        updatedCount++;
        return;
      }

      // Otherwise allocate a guaranteed unique Firestore-safe ID
      let finalId =
        cleanedBaseId && /^[a-zA-Z0-9_-]+$/.test(cleanedBaseId)
          ? cleanedBaseId
          : `case-${baseNow}-${idx + 1}`;

      if (usedIds.has(finalId)) {
        const prefix = finalId.slice(0, 108);
        let counter = 1;
        while (usedIds.has(`${prefix}-${counter}`)) {
          counter++;
        }
        finalId = `${prefix}-${counter}`;
      }

      seenInImportFile.add(finalId);
      usedIds.add(finalId);

      const normalizedRecord = normalizeImportedRecord(rawItem, finalId, fallbackTime);
      merged.push(normalizedRecord);
      toSyncRecords.push(normalizedRecord);
      addedCount++;
    });

    merged.sort((a, b) => b.createdAt - a.createdAt);
    const persisted = persistSavedCases(merged);
    if (!persisted) {
      return {
        success: false,
        count: 0,
        error: 'หน่วยความจำในเบราว์เซอร์เต็ม ไม่สามารถบันทึกเคสทั้งหมดได้',
      };
    }

    if (toSyncRecords.length > 0) {
      markPendingCloudUploads(toSyncRecords.map((r) => r.id));
      if (options.triggerCloudBridge !== false) {
        activeCloudBridge?.upsertCases(toSyncRecords);
      }
    }

    emitLocalCasesChanged();
    return {
      success: true,
      count: addedCount + updatedCount,
      addedCount,
      updatedCount,
      skippedCount,
      totalCount: merged.length,
      records: toSyncRecords,
    };
  } catch {
    return { success: false, count: 0, error: 'ไม่สามารถอ่านไฟล์ JSON ได้ หรือไฟล์เสียหาย' };
  }
}

export function importCasesFromJson(jsonStr: string): ImportCasesResult {
  return mergeBackupJsonIntoLocal(jsonStr, { triggerCloudBridge: true });
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
  return finalizeUpdatedCase(updated, id);
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
  return finalizeUpdatedCase(updated, id);
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

function parseFlexibleLocalDate(input?: string | number | Date): Date {
  if (!input) return new Date();
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? new Date() : input;
  }
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    const [y, m, d] = input.trim().split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return isNaN(dt.getTime()) ? new Date() : dt;
  }
  const dt = new Date(input);
  return isNaN(dt.getTime()) ? new Date() : dt;
}

export function formatThaiFullDocumentDate(input?: string | number | Date): string {
  const d = parseFlexibleLocalDate(input);
  const day = d.getDate();
  const monthName = THAI_MONTH_NAMES_LIST[d.getMonth()] || '';
  const thaiYear = d.getFullYear() + 543;
  return `${day} ${monthName} ${thaiYear}`;
}

export function formatThaiShortDateWithTime(
  dateInput?: string | number | Date,
  timeInput?: string | number | Date
): string {
  const d = parseFlexibleLocalDate(dateInput);
  const t = parseFlexibleLocalDate(timeInput || dateInput);
  const day = d.getDate();
  const monthShort = THAI_MONTH_SHORTS_LIST[d.getMonth()] || '';
  const thaiShortYear = ((d.getFullYear() + 543) % 100).toString().padStart(2, '0');
  const hh = String(t.getHours()).padStart(2, '0');
  const min = String(t.getMinutes()).padStart(2, '0');
  return `${day} ${monthShort} ${thaiShortYear} เวลา ${hh}:${min} น.`;
}

export function formatBuddhistDDMMYYYY(input?: string | number | Date): string {
  const d = parseFlexibleLocalDate(input);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const thaiYear = String(d.getFullYear() + 543);
  return `${dd}${mm}${thaiYear}`;
}

export function formatTimeHHMM(input?: string | number | Date): string {
  const d = parseFlexibleLocalDate(input);
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${hh}${min}`;
}

export interface ResolvedCaseDocumentMeta {
  docDate: Date;
  timeDate: Date;
  ddmmyyyyBE: string;
  hhmm: string;
  hhmmColon: string;
  formattedDateLong: string;
  sourceType: 'delivered' | 'contract' | 'now';
  sourceLabel: string;
}

export function resolveCaseDocumentDateAndTime(
  caseRecord?: SavedCaseRecord | null
): ResolvedCaseDocumentMeta {
  if (!caseRecord) {
    const now = new Date();
    const ddmmyyyyBE = formatBuddhistDDMMYYYY(now);
    const hhmm = formatTimeHHMM(now);
    const hhmmColon = `${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}`;
    return {
      docDate: now,
      timeDate: now,
      ddmmyyyyBE,
      hhmm,
      hhmmColon,
      formattedDateLong: formatThaiFullDocumentDate(now),
      sourceType: 'now',
      sourceLabel: `วันที่ปัจจุบัน ${formatThaiFullDocumentDate(now)} (${hhmmColon} น.)`,
    };
  }

  const hasDeliveryInfo =
    caseRecord.deliveryStatus === 'delivered' || Boolean(caseRecord.deliveryDate);

  const dateSource: string | number = hasDeliveryInfo
    ? caseRecord.deliveryDate || caseRecord.deliveryConfirmedAt || caseRecord.createdAt
    : caseRecord.approvalDate || caseRecord.createdAt;

  const timeSource: number = hasDeliveryInfo
    ? caseRecord.deliveryConfirmedAt ||
      (caseRecord.deliveryStatus === 'delivered'
        ? caseRecord.updatedAt || caseRecord.createdAt
        : caseRecord.createdAt)
    : caseRecord.createdAt;

  const docDate = parseFlexibleLocalDate(dateSource);
  const timeDate = parseFlexibleLocalDate(timeSource);
  const ddmmyyyyBE = formatBuddhistDDMMYYYY(docDate);
  const hhmm = formatTimeHHMM(timeDate);
  const hhmmColon = `${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}`;
  const formattedDateLong = formatThaiFullDocumentDate(docDate);

  return {
    docDate,
    timeDate,
    ddmmyyyyBE,
    hhmm,
    hhmmColon,
    formattedDateLong,
    sourceType: hasDeliveryInfo ? 'delivered' : 'contract',
    sourceLabel: hasDeliveryInfo
      ? `วันรับรถ ${formattedDateLong} (เวลา ${hhmmColon} น.)`
      : `วันทำสัญญา/บันทึกเคส ${formattedDateLong} (เวลา ${hhmmColon} น.)`,
  };
}

export function buildDeliveryBasedDocNumber(
  prefix: string,
  caseRecord?: SavedCaseRecord | null
): string {
  const meta = resolveCaseDocumentDateAndTime(caseRecord);
  return `${prefix}-${meta.ddmmyyyyBE}-${meta.hhmm}`;
}



