import {
  collection,
  getDocs,
  getDocsFromServer,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import {
  get,
  onValue,
  ref,
  remove,
  serverTimestamp as rtdbServerTimestamp,
  set,
  Unsubscribe,
  update,
} from 'firebase/database';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType, rtdb } from '../firebase';
import {
  InstallmentPaymentStatus,
  ProposalKey,
  SavedCaseRecord,
} from '../types';
import {
  clearPendingCloudDeletes,
  clearPendingCloudUploads,
  markConfirmedCloudIds,
  markPendingCloudUploads,
  mergeCloudCasesIntoLocal,
  normalizeLocalCaseIdsForCloud,
  sanitizeCaseId,
} from './savedCasesStorage';

const VALID_PROPOSAL_KEYS: ProposalKey[] = [
  'small_bike',
  'fazzio',
  'top_small',
  'aec',
  'vespa',
  'honda_yamaha',
  'second_hand',
];

function safeStr(val: unknown, maxLen: number, fallback = ''): string {
  if (typeof val === 'string') return val.slice(0, maxLen);
  if (typeof val === 'number' && Number.isFinite(val)) return String(val).slice(0, maxLen);
  return fallback;
}

function parseNumericInput(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/,/g, '').trim();
    if (!cleaned) return NaN;
    return Number(cleaned);
  }
  return NaN;
}

function safeNum(val: unknown, min: number, max: number, fallback = 0): number {
  const n = parseNumericInput(val);
  if (!Number.isFinite(n)) return fallback;
  const clamped = Math.min(max, Math.max(min, n));
  return clamped === 0 ? 0 : clamped;
}

function safeAnyNum(val: unknown, fallback = 0): number {
  const n = parseNumericInput(val);
  if (!Number.isFinite(n)) return fallback;
  return n === 0 ? 0 : n;
}

function toEpochMs(val: unknown): number | undefined {
  if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
    return val;
  }
  if (val instanceof Timestamp) {
    return val.toMillis();
  }
  if (
    val &&
    typeof val === 'object' &&
    'toMillis' in val &&
    typeof (val as { toMillis?: unknown }).toMillis === 'function'
  ) {
    const ms = (val as { toMillis: () => number }).toMillis();
    if (typeof ms === 'number' && Number.isFinite(ms) && ms > 0) return ms;
  }
  return undefined;
}

function stripUndefinedDeep<T>(value: T): T {
  if (value === null || value === undefined || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  const obj = value as Record<string, unknown>;
  // Preserve Firebase RTDB serverTimestamp placeholder { '.sv': 'timestamp' }
  if (typeof obj['.sv'] === 'string') {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = stripUndefinedDeep(v);
    }
  }
  return out as T;
}

export interface UserProfilePrefs {
  officerName?: string;
  officerCode?: string;
  officerLicense?: string;
  dealerName?: string;
}

export async function ensureUserProfileDoc(
  user: User,
  localPrefs?: UserProfilePrefs
): Promise<UserProfilePrefs> {
  const path = `users/${user.uid}/profile`;
  const profileRef = ref(rtdb, path);

  let snap;
  try {
    snap = await get(profileRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (snap && snap.exists()) {
    const data = snap.val() as Record<string, unknown>;
    return {
      officerName: typeof data.officerName === 'string' ? data.officerName : undefined,
      officerCode: typeof data.officerCode === 'string' ? data.officerCode : undefined,
      officerLicense: typeof data.officerLicense === 'string' ? data.officerLicense : undefined,
      dealerName: typeof data.dealerName === 'string' ? data.dealerName : undefined,
    };
  }

  const profilePayload: Record<string, unknown> = {
    uid: user.uid,
    email: safeStr(user.email || '', 320),
    createdAt: rtdbServerTimestamp(),
    updatedAt: rtdbServerTimestamp(),
  };

  if (user.displayName) {
    profilePayload.displayName = safeStr(user.displayName, 150);
  }
  if (localPrefs?.officerName !== undefined) {
    profilePayload.officerName = safeStr(localPrefs.officerName, 150);
  }
  if (localPrefs?.officerCode !== undefined) {
    profilePayload.officerCode = safeStr(localPrefs.officerCode, 50);
  }
  if (localPrefs?.officerLicense !== undefined) {
    profilePayload.officerLicense = safeStr(localPrefs.officerLicense, 100);
  }
  if (localPrefs?.dealerName !== undefined) {
    profilePayload.dealerName = safeStr(localPrefs.dealerName, 200);
  }

  try {
    await set(profileRef, stripUndefinedDeep(profilePayload));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  return localPrefs || {};
}

export async function updateUserProfilePrefs(
  user: User,
  prefs: UserProfilePrefs
): Promise<void> {
  const path = `users/${user.uid}/profile`;
  const profileRef = ref(rtdb, path);

  let snap;
  try {
    snap = await get(profileRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!snap || !snap.exists()) {
    await ensureUserProfileDoc(user, prefs);
    return;
  }

  const existing = (snap.val() || {}) as Record<string, unknown>;
  const payload: Record<string, unknown> = {
    uid: typeof existing.uid === 'string' ? existing.uid : user.uid,
    email: typeof existing.email === 'string' ? existing.email : safeStr(user.email || '', 320),
    createdAt: typeof existing.createdAt === 'number' ? existing.createdAt : rtdbServerTimestamp(),
    updatedAt: rtdbServerTimestamp(),
  };

  if (typeof existing.migratedFromFirestoreAt === 'number') {
    payload.migratedFromFirestoreAt = existing.migratedFromFirestoreAt;
  }

  if (typeof existing.displayName === 'string') {
    payload.displayName = safeStr(existing.displayName, 150);
  } else if (user.displayName) {
    payload.displayName = safeStr(user.displayName, 150);
  }

  if (prefs.officerName !== undefined) {
    payload.officerName = safeStr(prefs.officerName, 150);
  } else if (typeof existing.officerName === 'string') {
    payload.officerName = existing.officerName;
  }

  if (prefs.officerCode !== undefined) {
    payload.officerCode = safeStr(prefs.officerCode, 50);
  } else if (typeof existing.officerCode === 'string') {
    payload.officerCode = existing.officerCode;
  }

  if (prefs.officerLicense !== undefined) {
    payload.officerLicense = safeStr(prefs.officerLicense, 100);
  } else if (typeof existing.officerLicense === 'string') {
    payload.officerLicense = existing.officerLicense;
  }

  if (prefs.dealerName !== undefined) {
    payload.dealerName = safeStr(prefs.dealerName, 200);
  } else if (typeof existing.dealerName === 'string') {
    payload.dealerName = existing.dealerName;
  }

  try {
    await set(profileRef, stripUndefinedDeep(payload));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function buildRtdbCasePayload(
  record: SavedCaseRecord,
  uid: string,
  existingCreatedAt?: number,
  existingRecordCreatedAt?: number,
  explicitSafeId?: string,
  buildOptions?: { omitApprovalDoc?: boolean }
): Record<string, unknown> {
  const safeId = explicitSafeId || sanitizeCaseId(record.id);
  const proposalKey: ProposalKey = VALID_PROPOSAL_KEYS.includes(record.proposalKey)
    ? record.proposalKey
    : 'small_bike';

  const downMode = record.downMode === 'percent' ? 'percent' : 'amount';
  const customRateType = record.customRateType === 'annual' ? 'annual' : 'monthly';
  const insurancePlan =
    record.insurancePlan === 'plan_a' || record.insurancePlan === 'plan_b'
      ? record.insurancePlan
      : 'none';
  const insuranceYears =
    record.insuranceYears === 2 || record.insuranceYears === 3 ? record.insuranceYears : 1;

  const snapIn = record.snapshot || ({} as SavedCaseRecord['snapshot']);
  const snapshot: Record<string, unknown> = {
    monthlyInstallment: safeAnyNum(snapIn.monthlyInstallment, 0),
    financeAmount: safeAnyNum(snapIn.financeAmount, 0),
    downAmount: safeAnyNum(snapIn.downAmount, 0),
    downPercent: safeAnyNum(snapIn.downPercent, 0),
    totalInterest: safeAnyNum(snapIn.totalInterest, 0),
    totalWithVat: safeAnyNum(snapIn.totalWithVat, 0),
    effectiveMonthlyRate: safeAnyNum(snapIn.effectiveMonthlyRate, 0),
    eirAnnualPercent: safeAnyNum(snapIn.eirAnnualPercent, 0),
    proposalCode: safeStr(snapIn.proposalCode || '', 60),
    proposalName: safeStr(snapIn.proposalName || '', 160),
    rateDisplayText: safeStr(snapIn.rateDisplayText || '', 160),
  };

  if (snapIn.rawMonthlyInstallment !== undefined && Number.isFinite(Number(snapIn.rawMonthlyInstallment))) {
    snapshot.rawMonthlyInstallment = Number(snapIn.rawMonthlyInstallment);
  }
  if (snapIn.totalDriveAwayCost !== undefined && Number.isFinite(Number(snapIn.totalDriveAwayCost))) {
    snapshot.totalDriveAwayCost = Number(snapIn.totalDriveAwayCost);
  }

  const nowMs = Date.now();
  const resolvedRecordCreatedAt =
    existingRecordCreatedAt && existingRecordCreatedAt > 0
      ? existingRecordCreatedAt
      : Math.max(1, safeAnyNum(record.createdAt, nowMs));

  const rawTerm = parseNumericInput(record.term);
  const resolvedTerm =
    Number.isFinite(rawTerm) && rawTerm >= 1 ? Math.min(120, Math.round(rawTerm)) : 36;

  const rawCaseTitle =
    typeof record.caseTitle === 'string' ? record.caseTitle.trim() : safeStr(record.caseTitle, 300).trim();
  const rawCustName =
    typeof record.customerName === 'string' ? record.customerName.trim() : safeStr(record.customerName, 200).trim();

  const payload: Record<string, unknown> = {
    ownerUid: uid,
    id: safeId,
    caseTitle: safeStr(rawCaseTitle || rawCustName || 'คุณลูกค้า', 300) || 'คุณลูกค้า',
    officerName: safeStr(record.officerName || '', 150),
    officerCode: safeStr(record.officerCode || '', 50),
    customerName: safeStr(rawCustName || 'คุณลูกค้า', 200),
    proposalKey,
    vehiclePrice: safeNum(record.vehiclePrice, 0, 10000000, 0),
    downMode,
    downValue: safeNum(record.downValue, 0, 10000000, 0),
    term: resolvedTerm,
    includeDeliveryFees: Boolean(record.includeDeliveryFees),
    registrationFee: safeNum(record.registrationFee, 0, 1000000, 0),
    theftInsuranceFee: safeNum(record.theftInsuranceFee, 0, 1000000, 0),
    isCustomRateEnabled: Boolean(record.isCustomRateEnabled),
    customRateInput: safeStr(record.customRateInput || '', 30),
    customRateType,
    enforceEirCap: Boolean(record.enforceEirCap),
    insurancePlan,
    insuranceYears,
    snapshot,
    recordCreatedAt: resolvedRecordCreatedAt,
    recordUpdatedAt: Math.max(1, safeAnyNum(record.updatedAt, nowMs)),
    createdAt:
      typeof existingCreatedAt === 'number' && Number.isFinite(existingCreatedAt) && existingCreatedAt > 0
        ? existingCreatedAt
        : rtdbServerTimestamp(),
    updatedAt: rtdbServerTimestamp(),
  };

  if (typeof record.officerLicense === 'string' && record.officerLicense) {
    payload.officerLicense = safeStr(record.officerLicense, 100);
  }
  if (typeof record.customerPhone === 'string' && record.customerPhone) {
    payload.customerPhone = safeStr(record.customerPhone, 50);
  }
  if (typeof record.customerNote === 'string' && record.customerNote) {
    payload.customerNote = safeStr(record.customerNote, 1000);
  }
  if (typeof record.customerAge === 'string' && record.customerAge) {
    payload.customerAge = safeStr(record.customerAge, 20);
  }
  if (typeof record.customerWorkMonths === 'string' && record.customerWorkMonths) {
    payload.customerWorkMonths = safeStr(record.customerWorkMonths, 20);
  }
  if (typeof record.customerIncome === 'string' && record.customerIncome) {
    payload.customerIncome = safeStr(record.customerIncome, 30);
  }
  if (typeof record.customerResidenceMonths === 'string' && record.customerResidenceMonths) {
    payload.customerResidenceMonths = safeStr(record.customerResidenceMonths, 20);
  }
  if (typeof record.customerOccupation === 'string' && record.customerOccupation) {
    payload.customerOccupation = safeStr(record.customerOccupation, 150);
  }
  if (record.isAceCustomer !== undefined) {
    payload.isAceCustomer = Boolean(record.isAceCustomer);
  }
  if (typeof record.dealerName === 'string' && record.dealerName) {
    payload.dealerName = safeStr(record.dealerName, 200);
  }
  if (typeof record.bikeModelName === 'string' && record.bikeModelName) {
    payload.bikeModelName = safeStr(record.bikeModelName, 200);
  }
  if (typeof record.bikeModelCode === 'string' && record.bikeModelCode) {
    payload.bikeModelCode = safeStr(record.bikeModelCode, 80);
  }
  if (typeof record.bikeBrand === 'string' && record.bikeBrand) {
    payload.bikeBrand = safeStr(record.bikeBrand, 80);
  }
  if (
    record.approvalStatus === 'pending' ||
    record.approvalStatus === 'approved' ||
    record.approvalStatus === 'rejected' ||
    record.approvalStatus === 'cancelled'
  ) {
    payload.approvalStatus = record.approvalStatus;
  }
  if (
    record.deliveryStatus === 'pending_delivery' ||
    record.deliveryStatus === 'delivered'
  ) {
    payload.deliveryStatus = record.deliveryStatus;
  }
  if (typeof record.approvalDate === 'string' && record.approvalDate) {
    payload.approvalDate = safeStr(record.approvalDate, 40);
  }
  if (typeof record.deliveryDate === 'string' && record.deliveryDate) {
    payload.deliveryDate = safeStr(record.deliveryDate, 40);
  }
  if (typeof record.deliveryConfirmedAt === 'number' && Number.isFinite(record.deliveryConfirmedAt)) {
    payload.deliveryConfirmedAt = record.deliveryConfirmedAt;
  }
  if (typeof record.approvalNote === 'string' && record.approvalNote) {
    payload.approvalNote = safeStr(record.approvalNote, 1000);
  }
  if (typeof record.approvalUpdatedAt === 'number' && Number.isFinite(record.approvalUpdatedAt)) {
    payload.approvalUpdatedAt = record.approvalUpdatedAt;
  }
  if (
    typeof record.paymentDueDay === 'number' &&
    Number.isFinite(record.paymentDueDay) &&
    record.paymentDueDay >= 1 &&
    record.paymentDueDay <= 31
  ) {
    payload.paymentDueDay = Math.round(record.paymentDueDay);
  }
  if (typeof record.googleMapsLocation === 'string' && record.googleMapsLocation) {
    payload.googleMapsLocation = safeStr(record.googleMapsLocation, 1500);
  }
  if (record.installmentPayments && typeof record.installmentPayments === 'object') {
    const cleanPayments: Record<string, InstallmentPaymentStatus> = {};
    let count = 0;
    for (const [k, v] of Object.entries(record.installmentPayments)) {
      if (count >= 120) break;
      const numKey = Number(k);
      if (Number.isFinite(numKey) && numKey >= 1 && (v === 'paid' || v === 'unpaid')) {
        cleanPayments[String(Math.round(numKey))] = v;
        count++;
      }
    }
    if (count > 0) {
      payload.installmentPayments = cleanPayments;
    }
  }
  if (!buildOptions?.omitApprovalDoc && record.approvalDoc && typeof record.approvalDoc.name === 'string') {
    const cleanDocName = safeStr(record.approvalDoc.name.trim(), 300);
    if (cleanDocName.length >= 1) {
      const cleanDoc: Record<string, unknown> = {
        name: cleanDocName,
        size: Math.max(0, safeAnyNum(record.approvalDoc.size, 0)),
        uploadedAt: safeAnyNum(record.approvalDoc.uploadedAt, nowMs),
      };
      if (typeof record.approvalDoc.type === 'string' && record.approvalDoc.type) {
        cleanDoc.type = safeStr(record.approvalDoc.type, 120);
      }
      payload.approvalDoc = cleanDoc;
    }
  }

  return stripUndefinedDeep(payload);
}

export function fromCloudCaseDoc(
  data: Record<string, unknown>,
  fallbackId?: string
): SavedCaseRecord {
  const paymentsRaw = data.installmentPayments as
    | Record<string, InstallmentPaymentStatus>
    | Array<InstallmentPaymentStatus | null>
    | undefined;
  let installmentPayments: Record<number, InstallmentPaymentStatus> | undefined;
  if (paymentsRaw && typeof paymentsRaw === 'object') {
    installmentPayments = {};
    for (const [k, v] of Object.entries(paymentsRaw)) {
      const idx = Number(k);
      if (Number.isFinite(idx) && (v === 'paid' || v === 'unpaid')) {
        installmentPayments[idx] = v;
      }
    }
    if (Object.keys(installmentPayments).length === 0) {
      installmentPayments = undefined;
    }
  }

  const rawSnap =
    data.snapshot && typeof data.snapshot === 'object'
      ? (data.snapshot as Record<string, unknown>)
      : {};

  const snapshot: SavedCaseRecord['snapshot'] = {
    monthlyInstallment: Number(rawSnap.monthlyInstallment) || 0,
    financeAmount: Number(rawSnap.financeAmount) || 0,
    downAmount: Number(rawSnap.downAmount) || 0,
    downPercent: Number(rawSnap.downPercent) || 0,
    totalInterest: Number(rawSnap.totalInterest) || 0,
    totalWithVat: Number(rawSnap.totalWithVat) || 0,
    effectiveMonthlyRate: Number(rawSnap.effectiveMonthlyRate) || 0,
    eirAnnualPercent: Number(rawSnap.eirAnnualPercent) || 0,
    proposalCode: String(rawSnap.proposalCode || ''),
    proposalName: String(rawSnap.proposalName || ''),
    rateDisplayText: String(rawSnap.rateDisplayText || ''),
    ...(typeof rawSnap.rawMonthlyInstallment === 'number'
      ? { rawMonthlyInstallment: rawSnap.rawMonthlyInstallment }
      : {}),
    ...(typeof rawSnap.totalDriveAwayCost === 'number'
      ? { totalDriveAwayCost: rawSnap.totalDriveAwayCost }
      : {}),
  };

  return {
    id: String(data.id || fallbackId || sanitizeCaseId()),
    createdAt: Number(data.recordCreatedAt) || toEpochMs(data.createdAt) || Date.now(),
    updatedAt: Number(data.recordUpdatedAt) || toEpochMs(data.updatedAt) || Date.now(),
    caseTitle: String(data.caseTitle || 'คุณลูกค้า'),
    officerName: String(data.officerName || ''),
    officerCode: String(data.officerCode || ''),
    officerLicense: typeof data.officerLicense === 'string' ? data.officerLicense : undefined,
    customerName: String(data.customerName || 'คุณลูกค้า'),
    customerPhone: typeof data.customerPhone === 'string' ? data.customerPhone : undefined,
    customerNote: typeof data.customerNote === 'string' ? data.customerNote : undefined,
    customerAge: typeof data.customerAge === 'string' ? data.customerAge : undefined,
    customerWorkMonths: typeof data.customerWorkMonths === 'string' ? data.customerWorkMonths : undefined,
    customerIncome: typeof data.customerIncome === 'string' ? data.customerIncome : undefined,
    customerResidenceMonths:
      typeof data.customerResidenceMonths === 'string' ? data.customerResidenceMonths : undefined,
    customerOccupation: typeof data.customerOccupation === 'string' ? data.customerOccupation : undefined,
    isAceCustomer: typeof data.isAceCustomer === 'boolean' ? data.isAceCustomer : undefined,
    dealerName: typeof data.dealerName === 'string' ? data.dealerName : undefined,
    proposalKey: (data.proposalKey as ProposalKey) || 'small_bike',
    vehiclePrice: Number(data.vehiclePrice) || 0,
    bikeModelName: typeof data.bikeModelName === 'string' ? data.bikeModelName : undefined,
    bikeModelCode: typeof data.bikeModelCode === 'string' ? data.bikeModelCode : undefined,
    bikeBrand: typeof data.bikeBrand === 'string' ? data.bikeBrand : undefined,
    downMode: (data.downMode as 'amount' | 'percent') || 'amount',
    downValue: Number(data.downValue) || 0,
    term: Number(data.term) || 36,
    includeDeliveryFees: Boolean(data.includeDeliveryFees),
    registrationFee: Number(data.registrationFee) || 0,
    theftInsuranceFee: Number(data.theftInsuranceFee) || 0,
    isCustomRateEnabled: Boolean(data.isCustomRateEnabled),
    customRateInput: String(data.customRateInput || ''),
    customRateType: (data.customRateType as 'monthly' | 'annual') || 'monthly',
    enforceEirCap: Boolean(data.enforceEirCap),
    insurancePlan: (data.insurancePlan as SavedCaseRecord['insurancePlan']) || 'none',
    insuranceYears: (Number(data.insuranceYears) as SavedCaseRecord['insuranceYears']) || 1,
    snapshot,
    approvalStatus: data.approvalStatus as SavedCaseRecord['approvalStatus'],
    deliveryStatus: data.deliveryStatus as SavedCaseRecord['deliveryStatus'],
    approvalDate: typeof data.approvalDate === 'string' ? data.approvalDate : undefined,
    deliveryDate: typeof data.deliveryDate === 'string' ? data.deliveryDate : undefined,
    deliveryConfirmedAt: typeof data.deliveryConfirmedAt === 'number' ? data.deliveryConfirmedAt : undefined,
    approvalNote: typeof data.approvalNote === 'string' ? data.approvalNote : undefined,
    approvalUpdatedAt: typeof data.approvalUpdatedAt === 'number' ? data.approvalUpdatedAt : undefined,
    paymentDueDay: typeof data.paymentDueDay === 'number' ? data.paymentDueDay : undefined,
    googleMapsLocation: typeof data.googleMapsLocation === 'string' ? data.googleMapsLocation : undefined,
    installmentPayments,
    approvalDoc: data.approvalDoc as SavedCaseRecord['approvalDoc'],
  };
}

export interface UpsertCloudCasesResult {
  uploadedCount: number;
  failedCount: number;
  totalCount: number;
  approvalDocSkippedCount: number;
  firstError: unknown;
}

export interface UpsertCloudCasesOptions {
  onProgress?: (done: number, total: number) => void;
  throwOnError?: boolean;
}

export async function upsertCloudCases(
  uid: string,
  records: SavedCaseRecord[],
  cloudCreatedAtMap: Map<string, number>,
  cloudRecordCreatedAtMap?: Map<string, number>,
  knownNewIds?: Set<string>,
  options?: UpsertCloudCasesOptions
): Promise<UpsertCloudCasesResult> {
  if (records.length === 0) {
    return {
      uploadedCount: 0,
      failedCount: 0,
      totalCount: 0,
      approvalDocSkippedCount: 0,
      firstError: null,
    };
  }

  // Deduplicate by safeId (latest record wins)
  const dedupedMap = new Map<string, { safeId: string; record: SavedCaseRecord }>();
  for (const record of records) {
    const safeId = sanitizeCaseId(record.id);
    dedupedMap.set(safeId, { safeId, record });
  }
  const uniqueItems = Array.from(dedupedMap.values());
  const allSafeIds = uniqueItems.map((i) => i.safeId);
  const totalCount = uniqueItems.length;

  markPendingCloudUploads(allSafeIds);

  let firstError: unknown = null;
  const succeededIds: string[] = [];
  let failedCount = 0;

  try {
    // 1. Pre-check existing RTDB records for createdAt preservation
    const needLookup = uniqueItems.filter(
      ({ safeId }) => !cloudCreatedAtMap.has(safeId) && !knownNewIds?.has(safeId)
    );

    if (needLookup.length > 3) {
      const listPath = `users/${uid}/cases`;
      try {
        const snap = await get(ref(rtdb, listPath));
        if (snap.exists()) {
          const val = snap.val() as Record<string, Record<string, unknown>>;
          for (const [caseId, existingData] of Object.entries(val || {})) {
            if (!existingData || typeof existingData !== 'object') continue;
            const createdMs = toEpochMs(existingData.createdAt);
            if (createdMs) {
              cloudCreatedAtMap.set(caseId, createdMs);
            }
            if (typeof existingData.recordCreatedAt === 'number' && existingData.recordCreatedAt > 0) {
              cloudRecordCreatedAtMap?.set(caseId, existingData.recordCreatedAt);
            }
            markConfirmedCloudIds([caseId]);
          }
        }
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.LIST, listPath);
        } catch (wrapped) {
          if (!firstError) firstError = wrapped;
        }
      }
    } else if (needLookup.length > 0) {
      await Promise.all(
        needLookup.map(async ({ safeId }) => {
          const path = `users/${uid}/cases/${safeId}`;
          try {
            const snap = await get(ref(rtdb, path));
            if (snap.exists()) {
              const existingData = snap.val() as Record<string, unknown>;
              const createdMs = toEpochMs(existingData.createdAt);
              if (createdMs) {
                cloudCreatedAtMap.set(safeId, createdMs);
              }
              if (typeof existingData.recordCreatedAt === 'number' && existingData.recordCreatedAt > 0) {
                cloudRecordCreatedAtMap?.set(safeId, existingData.recordCreatedAt);
              }
              markConfirmedCloudIds([safeId]);
            }
          } catch (error) {
            try {
              handleFirestoreError(error, OperationType.GET, path);
            } catch (wrapped) {
              if (!firstError) firstError = wrapped;
            }
          }
        })
      );
    }

    // 2. Commit via RTDB multi-path update in chunks of 50 (with per-item fallback)
    const BATCH_SIZE = 50;
    const casesPath = `users/${uid}/cases`;
    const casesRef = ref(rtdb, casesPath);
    let processedCount = 0;

    for (let i = 0; i < uniqueItems.length; i += BATCH_SIZE) {
      const chunk = uniqueItems.slice(i, i + BATCH_SIZE);
      const prepared = chunk.map(({ safeId, record }) => {
        const createdAtMs = cloudCreatedAtMap.get(safeId);
        const existingRecordCreatedAt = cloudRecordCreatedAtMap?.get(safeId);
        const payload = buildRtdbCasePayload(
          record,
          uid,
          createdAtMs,
          existingRecordCreatedAt,
          safeId
        );
        return {
          safeId,
          path: `users/${uid}/cases/${safeId}`,
          payload,
          isUpdate: Boolean(createdAtMs),
        };
      });

      if (prepared.length === 1) {
        const item = prepared[0];
        try {
          await set(ref(rtdb, item.path), item.payload);
          if (typeof item.payload.recordCreatedAt === 'number') {
            cloudRecordCreatedAtMap?.set(item.safeId, item.payload.recordCreatedAt);
          }
          succeededIds.push(item.safeId);
        } catch (err) {
          failedCount++;
          try {
            handleFirestoreError(
              err,
              item.isUpdate ? OperationType.UPDATE : OperationType.CREATE,
              item.path
            );
          } catch (wrapped) {
            if (!firstError) firstError = wrapped;
          }
        }
        processedCount += 1;
        options?.onProgress?.(processedCount, totalCount);
        continue;
      }

      const multiUpdates: Record<string, unknown> = {};
      for (const item of prepared) {
        multiUpdates[item.safeId] = item.payload;
      }

      try {
        await update(casesRef, multiUpdates);
        for (const item of prepared) {
          if (typeof item.payload.recordCreatedAt === 'number') {
            cloudRecordCreatedAtMap?.set(item.safeId, item.payload.recordCreatedAt);
          }
          succeededIds.push(item.safeId);
        }
        processedCount += prepared.length;
        options?.onProgress?.(processedCount, totalCount);
      } catch {
        // Fallback: write individually so 1 problematic record never blocks remaining valid records
        for (const item of prepared) {
          try {
            await set(ref(rtdb, item.path), item.payload);
            if (typeof item.payload.recordCreatedAt === 'number') {
              cloudRecordCreatedAtMap?.set(item.safeId, item.payload.recordCreatedAt);
            }
            succeededIds.push(item.safeId);
          } catch (err) {
            failedCount++;
            try {
              handleFirestoreError(
                err,
                item.isUpdate ? OperationType.UPDATE : OperationType.CREATE,
                item.path
              );
            } catch (wrapped) {
              if (!firstError) firstError = wrapped;
            }
          }
          processedCount += 1;
          options?.onProgress?.(processedCount, totalCount);
        }
      }
    }
  } finally {
    if (succeededIds.length > 0) {
      markConfirmedCloudIds(succeededIds);
      clearPendingCloudUploads(succeededIds);
    }
  }

  if (firstError && failedCount > 0 && options?.throwOnError !== false) {
    throw firstError;
  }

  return {
    uploadedCount: succeededIds.length,
    failedCount,
    totalCount,
    approvalDocSkippedCount: 0,
    firstError,
  };
}

export async function fetchAllCloudCasesToLocal(
  uid: string,
  cloudCreatedAtMap: Map<string, number>,
  cloudRecordCreatedAtMap?: Map<string, number>
): Promise<{ cases: SavedCaseRecord[]; cloudCount: number }> {
  const listPath = `users/${uid}/cases`;
  let snap;
  try {
    snap = await get(ref(rtdb, listPath));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, listPath);
  }

  const cloudRecords: SavedCaseRecord[] = [];
  if (snap && snap.exists()) {
    const val = snap.val() as Record<string, Record<string, unknown>>;
    for (const [caseId, data] of Object.entries(val || {})) {
      if (!data || typeof data !== 'object') continue;
      const createdMs = toEpochMs(data.createdAt);
      if (createdMs) {
        cloudCreatedAtMap.set(caseId, createdMs);
      }
      if (typeof data.recordCreatedAt === 'number' && data.recordCreatedAt > 0) {
        cloudRecordCreatedAtMap?.set(caseId, data.recordCreatedAt);
      }
      cloudRecords.push(fromCloudCaseDoc(data, caseId));
    }
  }

  const merged = mergeCloudCasesIntoLocal(cloudRecords, {
    fromCache: false,
    isServerSnapshotSettled: false,
  });

  return {
    cases: merged,
    cloudCount: cloudRecords.length,
  };
}

export async function deleteCloudCases(
  uid: string,
  ids: string[],
  cloudCreatedAtMap: Map<string, number>,
  cloudRecordCreatedAtMap?: Map<string, number>
): Promise<void> {
  if (ids.length === 0) return;

  const uniqueIds = Array.from(new Set(ids.map((rawId) => sanitizeCaseId(rawId))));
  const deletedIds: string[] = [];
  const BATCH_SIZE = 100;
  const casesRef = ref(rtdb, `users/${uid}/cases`);

  try {
    for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
      const chunk = uniqueIds.slice(i, i + BATCH_SIZE);
      if (chunk.length === 1) {
        const safeId = chunk[0];
        const path = `users/${uid}/cases/${safeId}`;
        try {
          await remove(ref(rtdb, path));
          cloudCreatedAtMap.delete(safeId);
          cloudRecordCreatedAtMap?.delete(safeId);
          deletedIds.push(safeId);
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, path);
        }
        continue;
      }

      const deleteMap: Record<string, null> = {};
      for (const safeId of chunk) {
        deleteMap[safeId] = null;
      }
      try {
        await update(casesRef, deleteMap);
        for (const safeId of chunk) {
          cloudCreatedAtMap.delete(safeId);
          cloudRecordCreatedAtMap?.delete(safeId);
          deletedIds.push(safeId);
        }
      } catch {
        for (const safeId of chunk) {
          const path = `users/${uid}/cases/${safeId}`;
          try {
            await remove(ref(rtdb, path));
            cloudCreatedAtMap.delete(safeId);
            cloudRecordCreatedAtMap?.delete(safeId);
            deletedIds.push(safeId);
          } catch (error) {
            handleFirestoreError(error, OperationType.DELETE, path);
          }
        }
      }
    }
  } finally {
    if (deletedIds.length > 0) {
      clearPendingCloudDeletes(deletedIds);
    }
  }
}

/**
 * Best-effort one-time rescue of any legacy Firestore cases into local/RTDB
 * so switching from Firestore -> Realtime Database never strands cases on another device.
 */
async function rescueLegacyFirestoreCasesOnce(uid: string): Promise<void> {
  const profilePath = `users/${uid}/profile`;
  const profileRef = ref(rtdb, profilePath);

  try {
    const profileSnap = await get(profileRef);
    const profileVal = profileSnap.exists()
      ? (profileSnap.val() as Record<string, unknown>)
      : null;
    if (profileVal && profileVal.migratedFromFirestoreAt) {
      return;
    }

    const casesCol = collection(db, 'users', uid, 'cases');
    const q = query(casesCol, where('ownerUid', '==', uid));

    const legacySnap = await Promise.race([
      getDocsFromServer(q).catch(() => getDocs(q)),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);

    if (legacySnap && !legacySnap.empty) {
      const legacyRecords: SavedCaseRecord[] = [];
      legacySnap.forEach((docSnap) => {
        legacyRecords.push(fromCloudCaseDoc(docSnap.data(), docSnap.id));
      });
      if (legacyRecords.length > 0) {
        mergeCloudCasesIntoLocal(legacyRecords, {
          fromCache: false,
          isServerSnapshotSettled: false,
        });
      }
    }

    if (profileVal) {
      await update(profileRef, {
        migratedFromFirestoreAt: Date.now(),
        updatedAt: rtdbServerTimestamp(),
      });
    }
  } catch {
    // Non-fatal: RTDB migration works from local storage even if legacy Firestore is unreachable
  }
}

export interface PushAllLocalCasesResult {
  pushedCount: number;
  uploadedCount: number;
  approvalDocSkippedCount: number;
}

export async function pushAllLocalCasesToCloud(
  uid: string,
  cloudCreatedAtMap: Map<string, number>,
  cloudRecordCreatedAtMap?: Map<string, number>,
  options?: { forcePushIds?: Set<string> }
): Promise<PushAllLocalCasesResult> {
  await rescueLegacyFirestoreCasesOnce(uid);

  const localCases = normalizeLocalCaseIdsForCloud();
  if (localCases.length === 0) {
    return { pushedCount: 0, uploadedCount: 0, approvalDocSkippedCount: 0 };
  }

  const listPath = `users/${uid}/cases`;
  let cloudSnap;
  try {
    cloudSnap = await get(ref(rtdb, listPath));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, listPath);
  }

  const cloudUpdatedMap = new Map<string, number>();
  const cloudHasApprovalDocSet = new Set<string>();
  if (cloudSnap && cloudSnap.exists()) {
    const val = cloudSnap.val() as Record<string, Record<string, unknown>>;
    for (const [caseId, data] of Object.entries(val || {})) {
      if (!data || typeof data !== 'object') continue;
      const createdMs = toEpochMs(data.createdAt);
      if (createdMs) {
        cloudCreatedAtMap.set(caseId, createdMs);
      }
      if (typeof data.recordCreatedAt === 'number' && data.recordCreatedAt > 0) {
        cloudRecordCreatedAtMap?.set(caseId, data.recordCreatedAt);
      }
      if (data.approvalDoc) {
        cloudHasApprovalDocSet.add(caseId);
      }
      cloudUpdatedMap.set(caseId, Number(data.recordUpdatedAt) || 0);
      markConfirmedCloudIds([caseId]);
    }
  }

  const toPush: SavedCaseRecord[] = [];
  const knownNewIds = new Set<string>();
  for (const localCase of localCases) {
    const safeId = sanitizeCaseId(localCase.id);
    const cloudUpdated = cloudUpdatedMap.get(safeId);
    const localUpdated = Number(localCase.updatedAt) || 0;
    const needsApprovalDocBackfill =
      Boolean(localCase.approvalDoc) && !cloudHasApprovalDocSet.has(safeId);
    const isForced = Boolean(options?.forcePushIds?.has(safeId));

    if (cloudUpdated === undefined) {
      knownNewIds.add(safeId);
      toPush.push(localCase);
    } else if (localUpdated > cloudUpdated || needsApprovalDocBackfill || isForced) {
      toPush.push(localCase);
    }
  }

  if (toPush.length > 0) {
    const upsertRes = await upsertCloudCases(
      uid,
      toPush,
      cloudCreatedAtMap,
      cloudRecordCreatedAtMap,
      knownNewIds
    );
    return {
      pushedCount: toPush.length,
      uploadedCount: upsertRes.uploadedCount,
      approvalDocSkippedCount: upsertRes.approvalDocSkippedCount,
    };
  }

  return {
    pushedCount: 0,
    uploadedCount: 0,
    approvalDocSkippedCount: 0,
  };
}

export function subscribeUserCases(
  uid: string,
  cloudCreatedAtMap: Map<string, number>,
  cloudRecordCreatedAtMap: Map<string, number> | undefined,
  onSynced: (cases: SavedCaseRecord[], fromCache: boolean, cloudCount: number) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  const listPath = `users/${uid}/cases`;
  const casesRef = ref(rtdb, listPath);
  let hasSettledServerSnapshot = false;

  return onValue(
    casesRef,
    (snapshot) => {
      hasSettledServerSnapshot = true;
      const cloudRecords: SavedCaseRecord[] = [];

      if (snapshot.exists()) {
        const val = snapshot.val() as Record<string, Record<string, unknown>>;
        for (const [caseId, data] of Object.entries(val || {})) {
          if (!data || typeof data !== 'object') continue;
          const createdMs = toEpochMs(data.createdAt);
          if (createdMs) {
            cloudCreatedAtMap.set(caseId, createdMs);
          }
          if (typeof data.recordCreatedAt === 'number' && data.recordCreatedAt > 0) {
            cloudRecordCreatedAtMap?.set(caseId, data.recordCreatedAt);
          }
          cloudRecords.push(fromCloudCaseDoc(data, caseId));
        }
      }

      const merged = mergeCloudCasesIntoLocal(cloudRecords, {
        fromCache: false,
        isServerSnapshotSettled: hasSettledServerSnapshot,
      });
      onSynced(merged, false, cloudRecords.length);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, listPath);
      } catch (wrappedErr) {
        onError(wrappedErr);
      }
    }
  );
}
