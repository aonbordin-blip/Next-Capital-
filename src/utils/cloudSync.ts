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
  DvRequestStatus,
  InstallmentPaymentStatus,
  ProposalKey,
  SavedCaseRecord,
  SavedDvRequestRecord,
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
import {
  clearPendingDvDeletes,
  clearPendingDvUploads,
  getPendingDvDeletes,
  getSavedDvRequests,
  markConfirmedDvCloudIds,
  mergeCloudDvRequestsIntoLocal,
  sanitizeDvRequestId,
} from './dvCasesStorage';

const VALID_PROPOSAL_KEYS: ProposalKey[] = [
  'small_bike',
  'fazzio',
  'top_small',
  'aec',
  'vespa',
  'honda_yamaha',
  'second_hand',
];

export interface CloudUserIdentity {
  uid: string;
  email?: string | null;
  displayName?: string | null;
}

export function encodeEmailForRtdbKey(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .replace(/[.$\#\[\]\/\x00-\x1f\x7f]/g, '_');
}

export function getRtdbUserKey(userOrUid: CloudUserIdentity | string): string {
  if (typeof userOrUid === 'string') {
    if (userOrUid.includes('@')) {
      return encodeEmailForRtdbKey(userOrUid);
    }
    return userOrUid;
  }
  const email = (userOrUid.email || '').trim();
  if (email) {
    const encoded = encodeEmailForRtdbKey(email);
    if (encoded) return encoded;
  }
  return userOrUid.uid;
}

export function sanitizeCustomerKeyPart(name?: string, fallbackTitle?: string): string {
  const raw = String(name || fallbackTitle || 'คุณลูกค้า')
    .trim()
    .replace(/\./g, '')
    .replace(/[$#\[\]\/\x00-\x1f\x7f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const cleaned = raw.slice(0, 80).trim();
  return cleaned || 'คุณลูกค้า';
}

export function getCaseShortTag(safeId: string): string {
  const cleanId = sanitizeCaseId(safeId);
  const parts = cleanId.split('-').filter(Boolean);
  const lastPart = parts[parts.length - 1] || cleanId;
  if (/^[a-z0-9]{4,10}$/i.test(lastPart) && parts.length >= 3) {
    return lastPart;
  }
  let hash = 2166136261;
  for (let i = 0; i < cleanId.length; i++) {
    hash ^= cleanId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(6, '0').slice(0, 6);
}

export function getCaseNodeKey(
  safeId: string,
  customerName?: string,
  caseTitle?: string
): string {
  const cleanName = sanitizeCustomerKeyPart(customerName, caseTitle);
  const tag = getCaseShortTag(safeId);
  return `${cleanName} (${tag})`;
}

// Track relative paths under `users/${userKey}/cases` (e.g. "2026/10/สมชาย ใจดี (wrk6f)" or legacy "2026/10/case-...")
const cloudKnownRelPathsMap = new Map<string, Set<string>>();

function getRelPathMapKey(userKey: string, safeId: string): string {
  return `${userKey}::${safeId}`;
}

function addKnownRelPath(userKey: string, safeId: string, relPath: string): void {
  const key = getRelPathMapKey(userKey, safeId);
  let setPaths = cloudKnownRelPathsMap.get(key);
  if (!setPaths) {
    setPaths = new Set<string>();
    cloudKnownRelPathsMap.set(key, setPaths);
  }
  setPaths.add(relPath);
}

function setExactKnownRelPath(userKey: string, safeId: string, relPath: string): void {
  cloudKnownRelPathsMap.set(getRelPathMapKey(userKey, safeId), new Set([relPath]));
}

function getKnownRelPaths(userKey: string, safeId: string): string[] {
  const setPaths = cloudKnownRelPathsMap.get(getRelPathMapKey(userKey, safeId));
  return setPaths ? Array.from(setPaths) : [];
}

function deleteKnownRelPaths(userKey: string, safeId: string): void {
  cloudKnownRelPathsMap.delete(getRelPathMapKey(userKey, safeId));
}

export function getCaseYearMonth(createdAtMs: unknown): { year: string; month: string } {
  const ts =
    typeof createdAtMs === 'number' && Number.isFinite(createdAtMs) && createdAtMs > 0
      ? createdAtMs
      : Date.now();
  const date = new Date(ts);
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(date);
    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    if (year && /^\d{4}$/.test(year) && month && /^(0[1-9]|1[0-2])$/.test(month)) {
      return { year, month };
    }
  } catch {
    // Fallback to UTC+7 offset calculation
  }
  const bkk = new Date(ts + 7 * 60 * 60 * 1000);
  const year = String(bkk.getUTCFullYear()).padStart(4, '0');
  const month = String(bkk.getUTCMonth() + 1).padStart(2, '0');
  return { year, month };
}

export function getCaseRelPath(
  createdAtMs: unknown,
  safeId: string,
  customerName?: string,
  caseTitle?: string
): string {
  const { year, month } = getCaseYearMonth(createdAtMs);
  const nodeKey = getCaseNodeKey(safeId, customerName, caseTitle);
  return `${year}/${month}/${nodeKey}`;
}

interface RtdbCaseEntry {
  caseId: string;
  relPath: string;
  isLegacyFlat: boolean;
  data: Record<string, unknown>;
}

function isDvRequestNode(val: unknown, nodeKey?: string): boolean {
  if (typeof nodeKey === 'string' && nodeKey.startsWith('DV - ')) return true;
  if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
  const obj = val as Record<string, unknown>;
  return (
    obj.recordType === 'dv_request' ||
    'dvData' in obj ||
    (typeof obj.id === 'string' && obj.id.startsWith('dv-')) ||
    (typeof obj.caseTitle === 'string' && obj.caseTitle.startsWith('DV:'))
  );
}

function isCaseObjectNode(val: unknown): val is Record<string, unknown> {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
  const obj = val as Record<string, unknown>;
  return (
    'snapshot' in obj ||
    'ownerUid' in obj ||
    'vehiclePrice' in obj ||
    'caseTitle' in obj ||
    'proposalKey' in obj
  );
}

function collectRtdbCaseEntries(rawTree: unknown): RtdbCaseEntry[] {
  const entries: RtdbCaseEntry[] = [];
  if (!rawTree || typeof rawTree !== 'object') return entries;

  for (const [level1Key, level1Val] of Object.entries(rawTree as Record<string, unknown>)) {
    if (!level1Val || typeof level1Val !== 'object') continue;

    // 1. Legacy flat structure: users/${userKey}/cases/${caseId}
    if (isCaseObjectNode(level1Val)) {
      if (isDvRequestNode(level1Val, level1Key)) continue;
      entries.push({
        caseId: sanitizeCaseId(String(level1Val.id || level1Key)),
        relPath: level1Key,
        isLegacyFlat: true,
        data: level1Val,
      });
      continue;
    }

    // 2. Year > Month > CaseKey structure: users/${userKey}/cases/${year}/${month}/${caseKey}
    if (/^\d{4}$/.test(level1Key)) {
      for (const [level2Key, level2Val] of Object.entries(level1Val as Record<string, unknown>)) {
        if (!level2Val || typeof level2Val !== 'object') continue;
        for (const [caseKey, caseVal] of Object.entries(level2Val as Record<string, unknown>)) {
          if (!isCaseObjectNode(caseVal)) continue;
          if (isDvRequestNode(caseVal, caseKey)) continue;
          entries.push({
            caseId: sanitizeCaseId(String(caseVal.id || caseKey)),
            relPath: `${level1Key}/${level2Key}/${caseKey}`,
            isLegacyFlat: false,
            data: caseVal,
          });
        }
      }
    }
  }

  return entries;
}

function dedupeRtdbEntries(userKey: string, entries: RtdbCaseEntry[]): RtdbCaseEntry[] {
  const bestByCaseId = new Map<string, RtdbCaseEntry>();

  for (const entry of entries) {
    addKnownRelPath(userKey, entry.caseId, entry.relPath);
    const existing = bestByCaseId.get(entry.caseId);
    if (!existing) {
      bestByCaseId.set(entry.caseId, entry);
      continue;
    }

    const existingUpdated = Number(existing.data.recordUpdatedAt) || 0;
    const incomingUpdated = Number(entry.data.recordUpdatedAt) || 0;
    if (
      incomingUpdated > existingUpdated ||
      (incomingUpdated === existingUpdated && existing.isLegacyFlat && !entry.isLegacyFlat)
    ) {
      bestByCaseId.set(entry.caseId, entry);
    }
  }

  return Array.from(bestByCaseId.values());
}

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
  const userKey = getRtdbUserKey(user);
  const path = `users/${userKey}/profile`;
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

  // Carry over prefs from legacy `users/${user.uid}/profile` if it exists
  let legacyProfileData: Record<string, unknown> | null = null;
  if (userKey !== user.uid) {
    try {
      const legacySnap = await get(ref(rtdb, `users/${user.uid}/profile`));
      if (legacySnap.exists()) {
        legacyProfileData = legacySnap.val() as Record<string, unknown>;
      }
    } catch {
      // ignore if unreadable
    }
  }

  const resolvedPrefs: UserProfilePrefs = {
    officerName:
      localPrefs?.officerName ??
      (typeof legacyProfileData?.officerName === 'string' ? legacyProfileData.officerName : undefined),
    officerCode:
      localPrefs?.officerCode ??
      (typeof legacyProfileData?.officerCode === 'string' ? legacyProfileData.officerCode : undefined),
    officerLicense:
      localPrefs?.officerLicense ??
      (typeof legacyProfileData?.officerLicense === 'string'
        ? legacyProfileData.officerLicense
        : undefined),
    dealerName:
      localPrefs?.dealerName ??
      (typeof legacyProfileData?.dealerName === 'string' ? legacyProfileData.dealerName : undefined),
  };

  const profilePayload: Record<string, unknown> = {
    uid: user.uid,
    email: safeStr((user.email || '').trim(), 320),
    createdAt:
      typeof legacyProfileData?.createdAt === 'number'
        ? legacyProfileData.createdAt
        : rtdbServerTimestamp(),
    updatedAt: rtdbServerTimestamp(),
  };

  if (typeof legacyProfileData?.migratedFromFirestoreAt === 'number') {
    profilePayload.migratedFromFirestoreAt = legacyProfileData.migratedFromFirestoreAt;
  }

  if (user.displayName) {
    profilePayload.displayName = safeStr(user.displayName, 150);
  }
  if (resolvedPrefs.officerName !== undefined) {
    profilePayload.officerName = safeStr(resolvedPrefs.officerName, 150);
  }
  if (resolvedPrefs.officerCode !== undefined) {
    profilePayload.officerCode = safeStr(resolvedPrefs.officerCode, 50);
  }
  if (resolvedPrefs.officerLicense !== undefined) {
    profilePayload.officerLicense = safeStr(resolvedPrefs.officerLicense, 100);
  }
  if (resolvedPrefs.dealerName !== undefined) {
    profilePayload.dealerName = safeStr(resolvedPrefs.dealerName, 200);
  }

  try {
    await set(profileRef, stripUndefinedDeep(profilePayload));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  return resolvedPrefs;
}

export async function updateUserProfilePrefs(
  user: User,
  prefs: UserProfilePrefs
): Promise<void> {
  const userKey = getRtdbUserKey(user);
  const path = `users/${userKey}/profile`;
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
    email: typeof existing.email === 'string' ? existing.email : safeStr((user.email || '').trim(), 320),
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

  if (
    snapIn.rawMonthlyInstallment !== undefined &&
    snapIn.rawMonthlyInstallment !== null &&
    String(snapIn.rawMonthlyInstallment).trim() !== '' &&
    Number.isFinite(Number(snapIn.rawMonthlyInstallment))
  ) {
    snapshot.rawMonthlyInstallment = Number(snapIn.rawMonthlyInstallment);
  }
  if (
    snapIn.totalDriveAwayCost !== undefined &&
    snapIn.totalDriveAwayCost !== null &&
    String(snapIn.totalDriveAwayCost).trim() !== '' &&
    Number.isFinite(Number(snapIn.totalDriveAwayCost))
  ) {
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
  if (typeof record.customerIdCard === 'string' && record.customerIdCard) {
    const cleanId = record.customerIdCard.replace(/\D/g, '').slice(0, 13);
    if (cleanId.length === 13) {
      payload.customerIdCard = cleanId;
    }
  }
  if (typeof record.customerAddress === 'string' && record.customerAddress.trim()) {
    payload.customerAddress = safeStr(record.customerAddress.trim(), 500);
  }
  if (typeof record.customerBirthDate === 'string' && record.customerBirthDate.trim()) {
    payload.customerBirthDate = safeStr(record.customerBirthDate.trim(), 20);
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
  if (typeof record.engineNumber === 'string' && record.engineNumber.trim()) {
    payload.engineNumber = safeStr(record.engineNumber.trim().toUpperCase(), 60);
  }
  if (typeof record.chassisNumber === 'string' && record.chassisNumber.trim()) {
    payload.chassisNumber = safeStr(record.chassisNumber.trim().toUpperCase(), 60);
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
    customerIdCard: typeof data.customerIdCard === 'string' ? data.customerIdCard : undefined,
    customerAddress: typeof data.customerAddress === 'string' ? data.customerAddress : undefined,
    customerBirthDate: typeof data.customerBirthDate === 'string' ? data.customerBirthDate : undefined,
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
    engineNumber: typeof data.engineNumber === 'string' ? data.engineNumber : undefined,
    chassisNumber: typeof data.chassisNumber === 'string' ? data.chassisNumber : undefined,
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
  userOrUid: CloudUserIdentity | string,
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

  const uid = typeof userOrUid === 'string' ? userOrUid : userOrUid.uid;
  const userKey = getRtdbUserKey(userOrUid);

  // Deduplicate by safeId (latest record wins) and strictly exclude DV request IDs
  const dedupedMap = new Map<string, { safeId: string; record: SavedCaseRecord }>();
  for (const record of records) {
    const safeId = sanitizeCaseId(record.id);
    if (safeId.startsWith('dv-')) continue;
    dedupedMap.set(safeId, { safeId, record });
  }
  const uniqueItems = Array.from(dedupedMap.values());
  if (uniqueItems.length === 0) {
    return {
      uploadedCount: 0,
      failedCount: 0,
      totalCount: 0,
      approvalDocSkippedCount: 0,
      firstError: null,
    };
  }
  const allSafeIds = uniqueItems.map((i) => i.safeId);
  const totalCount = uniqueItems.length;

  markPendingCloudUploads(allSafeIds);

  let firstError: unknown = null;
  const succeededIds: string[] = [];
  let failedCount = 0;

  try {
    // 1. Pre-check existing RTDB records for createdAt & path tracking
    const needLookup = uniqueItems.filter(
      ({ safeId }) => !cloudCreatedAtMap.has(safeId) && !knownNewIds?.has(safeId)
    );

    if (needLookup.length > 0) {
      const hasAnyKnownRel = needLookup.every(({ safeId }) => getKnownRelPaths(userKey, safeId).length > 0);
      if (needLookup.length > 3 || !hasAnyKnownRel) {
        const listPath = `users/${userKey}/cases`;
        try {
          const snap = await get(ref(rtdb, listPath));
          if (snap.exists()) {
            const entries = dedupeRtdbEntries(userKey, collectRtdbCaseEntries(snap.val()));
            for (const entry of entries) {
              const createdMs = toEpochMs(entry.data.createdAt);
              if (createdMs) {
                cloudCreatedAtMap.set(entry.caseId, createdMs);
              }
              if (typeof entry.data.recordCreatedAt === 'number' && entry.data.recordCreatedAt > 0) {
                cloudRecordCreatedAtMap?.set(entry.caseId, entry.data.recordCreatedAt);
              }
              markConfirmedCloudIds([entry.caseId]);
            }
          }
        } catch (error) {
          try {
            handleFirestoreError(error, OperationType.LIST, listPath);
          } catch (wrapped) {
            if (!firstError) firstError = wrapped;
          }
        }
      } else {
        await Promise.all(
          needLookup.map(async ({ safeId, record }) => {
            const existingRel = getKnownRelPaths(userKey, safeId)[0];
            const expectedRel = getCaseRelPath(
              cloudRecordCreatedAtMap?.get(safeId) ?? record.createdAt,
              safeId,
              record.customerName,
              record.caseTitle
            );
            const candidateRels = Array.from(
              new Set([existingRel, expectedRel].filter(Boolean) as string[])
            );

            for (const relPath of candidateRels) {
              const fullPath = `users/${userKey}/cases/${relPath}`;
              try {
                const snap = await get(ref(rtdb, fullPath));
                if (snap.exists() && isCaseObjectNode(snap.val())) {
                  const existingData = snap.val() as Record<string, unknown>;
                  addKnownRelPath(userKey, safeId, relPath);
                  const createdMs = toEpochMs(existingData.createdAt);
                  if (createdMs) {
                    cloudCreatedAtMap.set(safeId, createdMs);
                  }
                  if (typeof existingData.recordCreatedAt === 'number' && existingData.recordCreatedAt > 0) {
                    cloudRecordCreatedAtMap?.set(safeId, existingData.recordCreatedAt);
                  }
                  markConfirmedCloudIds([safeId]);
                  break;
                }
              } catch (error) {
                try {
                  handleFirestoreError(error, OperationType.GET, fullPath);
                } catch (wrapped) {
                  if (!firstError) firstError = wrapped;
                }
              }
            }
          })
        );
      }
    }

    // 2. Commit via RTDB multi-path update under `users/${userKey}/cases/${year}/${month}/${customerName} (${tag})`
    const BATCH_SIZE = 50;
    const casesBasePath = `users/${userKey}/cases`;
    const casesRef = ref(rtdb, casesBasePath);
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
        const targetRelPath = getCaseRelPath(
          payload.recordCreatedAt,
          safeId,
          String(payload.customerName || record.customerName || ''),
          String(payload.caseTitle || record.caseTitle || '')
        );
        const obsoleteRelPaths = getKnownRelPaths(userKey, safeId).filter((p) => p !== targetRelPath);

        return {
          safeId,
          targetRelPath,
          obsoleteRelPaths,
          fullPath: `${casesBasePath}/${targetRelPath}`,
          payload,
          isUpdate: Boolean(createdAtMs),
        };
      });

      if (prepared.length === 1) {
        const item = prepared[0];
        try {
          if (item.obsoleteRelPaths.length > 0) {
            const singleUpdates: Record<string, unknown> = {
              [item.targetRelPath]: item.payload,
            };
            for (const oldRel of item.obsoleteRelPaths) {
              singleUpdates[oldRel] = null;
            }
            await update(casesRef, singleUpdates);
          } else {
            await set(ref(rtdb, item.fullPath), item.payload);
          }

          if (typeof item.payload.recordCreatedAt === 'number') {
            cloudRecordCreatedAtMap?.set(item.safeId, item.payload.recordCreatedAt);
          }
          setExactKnownRelPath(userKey, item.safeId, item.targetRelPath);
          succeededIds.push(item.safeId);
        } catch (err) {
          failedCount++;
          try {
            handleFirestoreError(
              err,
              item.isUpdate ? OperationType.UPDATE : OperationType.CREATE,
              item.fullPath
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
        multiUpdates[item.targetRelPath] = item.payload;
        for (const oldRel of item.obsoleteRelPaths) {
          if (!(oldRel in multiUpdates)) {
            multiUpdates[oldRel] = null;
          }
        }
      }

      try {
        await update(casesRef, multiUpdates);
        for (const item of prepared) {
          if (typeof item.payload.recordCreatedAt === 'number') {
            cloudRecordCreatedAtMap?.set(item.safeId, item.payload.recordCreatedAt);
          }
          setExactKnownRelPath(userKey, item.safeId, item.targetRelPath);
          succeededIds.push(item.safeId);
        }
        processedCount += prepared.length;
        options?.onProgress?.(processedCount, totalCount);
      } catch {
        // Fallback: write individually so 1 problematic record never blocks remaining valid records
        for (const item of prepared) {
          try {
            await set(ref(rtdb, item.fullPath), item.payload);
            for (const oldRel of item.obsoleteRelPaths) {
              await remove(ref(rtdb, `${casesBasePath}/${oldRel}`)).catch(() => {});
            }
            if (typeof item.payload.recordCreatedAt === 'number') {
              cloudRecordCreatedAtMap?.set(item.safeId, item.payload.recordCreatedAt);
            }
            setExactKnownRelPath(userKey, item.safeId, item.targetRelPath);
            succeededIds.push(item.safeId);
          } catch (err) {
            failedCount++;
            try {
              handleFirestoreError(
                err,
                item.isUpdate ? OperationType.UPDATE : OperationType.CREATE,
                item.fullPath
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
  userOrUid: CloudUserIdentity | string,
  cloudCreatedAtMap: Map<string, number>,
  cloudRecordCreatedAtMap?: Map<string, number>
): Promise<{ cases: SavedCaseRecord[]; cloudCount: number }> {
  const userKey = getRtdbUserKey(userOrUid);
  const listPath = `users/${userKey}/cases`;
  let snap;
  try {
    snap = await get(ref(rtdb, listPath));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, listPath);
  }

  const cloudRecords: SavedCaseRecord[] = [];
  if (snap && snap.exists()) {
    const entries = dedupeRtdbEntries(userKey, collectRtdbCaseEntries(snap.val()));
    for (const entry of entries) {
      const createdMs = toEpochMs(entry.data.createdAt);
      if (createdMs) {
        cloudCreatedAtMap.set(entry.caseId, createdMs);
      }
      if (typeof entry.data.recordCreatedAt === 'number' && entry.data.recordCreatedAt > 0) {
        cloudRecordCreatedAtMap?.set(entry.caseId, entry.data.recordCreatedAt);
      }
      cloudRecords.push(fromCloudCaseDoc(entry.data, entry.caseId));
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
  userOrUid: CloudUserIdentity | string,
  ids: string[],
  cloudCreatedAtMap: Map<string, number>,
  cloudRecordCreatedAtMap?: Map<string, number>
): Promise<void> {
  if (ids.length === 0) return;

  const userKey = getRtdbUserKey(userOrUid);
  const uniqueIds = Array.from(new Set(ids.map((rawId) => sanitizeCaseId(rawId))));
  const deletedIds: string[] = [];
  const BATCH_SIZE = 100;
  const casesBasePath = `users/${userKey}/cases`;
  const casesRef = ref(rtdb, casesBasePath);

  const missingPathIds = uniqueIds.filter((safeId) => getKnownRelPaths(userKey, safeId).length === 0);
  if (missingPathIds.length > 0) {
    try {
      const snap = await get(casesRef);
      if (snap.exists()) {
        const entries = collectRtdbCaseEntries(snap.val());
        for (const entry of entries) {
          addKnownRelPath(userKey, entry.caseId, entry.relPath);
        }
      }
    } catch {
      // Fallback if scan fails
    }
  }

  try {
    for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
      const chunk = uniqueIds.slice(i, i + BATCH_SIZE);
      const deleteMap: Record<string, null> = {};
      const resolvedIdsInChunk: string[] = [];

      for (const safeId of chunk) {
        const knownPaths = getKnownRelPaths(userKey, safeId);
        if (knownPaths.length > 0) {
          for (const relPath of knownPaths) {
            deleteMap[relPath] = null;
          }
        } else {
          const recCreatedAt = cloudRecordCreatedAtMap?.get(safeId);
          if (recCreatedAt) {
            deleteMap[`${getCaseYearMonth(recCreatedAt).year}/${getCaseYearMonth(recCreatedAt).month}/${safeId}`] = null;
          }
          deleteMap[safeId] = null;
        }
        resolvedIdsInChunk.push(safeId);
      }

      const targetRelPaths = Object.keys(deleteMap);
      if (targetRelPaths.length === 1 && resolvedIdsInChunk.length === 1) {
        const safeId = resolvedIdsInChunk[0];
        const fullPath = `${casesBasePath}/${targetRelPaths[0]}`;
        try {
          await remove(ref(rtdb, fullPath));
          cloudCreatedAtMap.delete(safeId);
          cloudRecordCreatedAtMap?.delete(safeId);
          deleteKnownRelPaths(userKey, safeId);
          deletedIds.push(safeId);
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, fullPath);
        }
        continue;
      }

      try {
        await update(casesRef, deleteMap);
        for (const safeId of chunk) {
          cloudCreatedAtMap.delete(safeId);
          cloudRecordCreatedAtMap?.delete(safeId);
          deleteKnownRelPaths(userKey, safeId);
          deletedIds.push(safeId);
        }
      } catch {
        for (const safeId of chunk) {
          const rels = getKnownRelPaths(userKey, safeId);
          for (const relPath of rels) {
            const fullPath = `${casesBasePath}/${relPath}`;
            try {
              await remove(ref(rtdb, fullPath));
            } catch (error) {
              handleFirestoreError(error, OperationType.DELETE, fullPath);
            }
          }
          cloudCreatedAtMap.delete(safeId);
          cloudRecordCreatedAtMap?.delete(safeId);
          deleteKnownRelPaths(userKey, safeId);
          deletedIds.push(safeId);
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
 * Best-effort one-time rescue of any legacy Firestore cases into local/RTDB.
 */
async function rescueLegacyFirestoreCasesOnce(user: CloudUserIdentity): Promise<void> {
  const userKey = getRtdbUserKey(user);
  const profilePath = `users/${userKey}/profile`;
  const profileRef = ref(rtdb, profilePath);

  try {
    const profileSnap = await get(profileRef);
    const profileVal = profileSnap.exists()
      ? (profileSnap.val() as Record<string, unknown>)
      : null;
    if (profileVal && profileVal.migratedFromFirestoreAt) {
      return;
    }

    const casesCol = collection(db, 'users', user.uid, 'cases');
    const q = query(casesCol, where('ownerUid', '==', user.uid));

    const legacySnap = await Promise.race([
      getDocsFromServer(q).catch(() => getDocs(q)),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
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
    // Non-fatal
  }
}

/**
 * Reads any legacy RTDB cases stored under `users/${uid}/cases` so they can be migrated
 * to `users/${emailKey}/cases/${year}/${month}/${customerName} (${tag})`.
 */
async function collectLegacyUidRtdbCases(
  user: CloudUserIdentity,
  cloudCreatedAtMap: Map<string, number>,
  cloudRecordCreatedAtMap?: Map<string, number>
): Promise<{ hasLegacyUidNode: boolean }> {
  const userKey = getRtdbUserKey(user);
  if (userKey === user.uid) {
    return { hasLegacyUidNode: false };
  }

  try {
    const legacyUidSnap = await get(ref(rtdb, `users/${user.uid}`));
    if (!legacyUidSnap.exists()) {
      return { hasLegacyUidNode: false };
    }
    const val = legacyUidSnap.val() as Record<string, unknown>;
    if (val && val.cases) {
      const entries = collectRtdbCaseEntries(val.cases);
      if (entries.length > 0) {
        const legacyRecords: SavedCaseRecord[] = [];
        for (const entry of entries) {
          const createdMs = toEpochMs(entry.data.createdAt);
          if (createdMs && !cloudCreatedAtMap.has(entry.caseId)) {
            cloudCreatedAtMap.set(entry.caseId, createdMs);
          }
          if (
            typeof entry.data.recordCreatedAt === 'number' &&
            entry.data.recordCreatedAt > 0 &&
            !cloudRecordCreatedAtMap?.has(entry.caseId)
          ) {
            cloudRecordCreatedAtMap?.set(entry.caseId, entry.data.recordCreatedAt);
          }
          legacyRecords.push(fromCloudCaseDoc(entry.data, entry.caseId));
        }
        if (legacyRecords.length > 0) {
          mergeCloudCasesIntoLocal(legacyRecords, {
            fromCache: false,
            isServerSnapshotSettled: false,
          });
        }
      }
    }
    return { hasLegacyUidNode: true };
  } catch {
    return { hasLegacyUidNode: false };
  }
}

export interface PushAllLocalCasesResult {
  pushedCount: number;
  uploadedCount: number;
  approvalDocSkippedCount: number;
}

export async function pushAllLocalCasesToCloud(
  userOrUid: CloudUserIdentity | string,
  cloudCreatedAtMap: Map<string, number>,
  cloudRecordCreatedAtMap?: Map<string, number>,
  options?: { forcePushIds?: Set<string> }
): Promise<PushAllLocalCasesResult> {
  const user: CloudUserIdentity =
    typeof userOrUid === 'string' ? { uid: userOrUid } : userOrUid;
  const userKey = getRtdbUserKey(user);

  await rescueLegacyFirestoreCasesOnce(user);
  const { hasLegacyUidNode } = await collectLegacyUidRtdbCases(
    user,
    cloudCreatedAtMap,
    cloudRecordCreatedAtMap
  );

  const listPath = `users/${userKey}/cases`;
  let cloudSnap;
  try {
    cloudSnap = await get(ref(rtdb, listPath));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, listPath);
  }

  const cloudUpdatedMap = new Map<string, number>();
  const cloudHasApprovalDocSet = new Set<string>();
  const cloudActiveRelPathMap = new Map<string, string>();
  const cloudNeedsPathMigrationSet = new Set<string>();
  const cloudOnlyRecords: SavedCaseRecord[] = [];

  if (cloudSnap && cloudSnap.exists()) {
    const rawEntries = collectRtdbCaseEntries(cloudSnap.val());
    const countByCaseId = new Map<string, number>();
    for (const e of rawEntries) {
      countByCaseId.set(e.caseId, (countByCaseId.get(e.caseId) || 0) + 1);
    }

    const entries = dedupeRtdbEntries(userKey, rawEntries);
    for (const entry of entries) {
      const createdMs = toEpochMs(entry.data.createdAt);
      if (createdMs) {
        cloudCreatedAtMap.set(entry.caseId, createdMs);
      }
      if (typeof entry.data.recordCreatedAt === 'number' && entry.data.recordCreatedAt > 0) {
        cloudRecordCreatedAtMap?.set(entry.caseId, entry.data.recordCreatedAt);
      }
      if (entry.data.approvalDoc) {
        cloudHasApprovalDocSet.add(entry.caseId);
      }
      cloudUpdatedMap.set(entry.caseId, Number(entry.data.recordUpdatedAt) || 0);
      cloudActiveRelPathMap.set(entry.caseId, entry.relPath);
      if (entry.isLegacyFlat || (countByCaseId.get(entry.caseId) || 0) > 1) {
        cloudNeedsPathMigrationSet.add(entry.caseId);
      }
      cloudOnlyRecords.push(fromCloudCaseDoc(entry.data, entry.caseId));
      markConfirmedCloudIds([entry.caseId]);
    }
  }

  let localCases = normalizeLocalCaseIdsForCloud();
  const localIdSet = new Set(localCases.map((c) => sanitizeCaseId(c.id)));
  const migratedCloudRecords = cloudOnlyRecords.filter(
    (c) => cloudNeedsPathMigrationSet.has(sanitizeCaseId(c.id)) && !localIdSet.has(sanitizeCaseId(c.id))
  );
  if (migratedCloudRecords.length > 0) {
    localCases = [...localCases, ...migratedCloudRecords];
  }

  const allCandidateMap = new Map<string, SavedCaseRecord>();
  for (const c of cloudOnlyRecords) {
    const sid = sanitizeCaseId(c.id);
    if (sid.startsWith('dv-')) continue;
    allCandidateMap.set(sid, c);
  }
  for (const c of localCases) {
    const sid = sanitizeCaseId(c.id);
    if (sid.startsWith('dv-')) continue;
    allCandidateMap.set(sid, c);
  }

  const toPush: SavedCaseRecord[] = [];
  const knownNewIds = new Set<string>();
  for (const candidate of allCandidateMap.values()) {
    const safeId = sanitizeCaseId(candidate.id);
    const cloudUpdated = cloudUpdatedMap.get(safeId);
    const localUpdated = Number(candidate.updatedAt) || 0;
    const needsApprovalDocBackfill =
      Boolean(candidate.approvalDoc) && !cloudHasApprovalDocSet.has(safeId);
    const isForced = Boolean(options?.forcePushIds?.has(safeId));

    const resolvedCreatedAt = cloudRecordCreatedAtMap?.get(safeId) ?? candidate.createdAt;
    const expectedRelPath = getCaseRelPath(
      resolvedCreatedAt,
      safeId,
      candidate.customerName,
      candidate.caseTitle
    );
    const currentRelPath = cloudActiveRelPathMap.get(safeId);
    const needsPathMigration =
      cloudNeedsPathMigrationSet.has(safeId) ||
      (currentRelPath !== undefined && currentRelPath !== expectedRelPath);

    if (cloudUpdated === undefined) {
      knownNewIds.add(safeId);
      toPush.push(candidate);
    } else if (localUpdated > cloudUpdated || needsApprovalDocBackfill || needsPathMigration || isForced) {
      toPush.push(candidate);
    }
  }

  let result: PushAllLocalCasesResult = {
    pushedCount: 0,
    uploadedCount: 0,
    approvalDocSkippedCount: 0,
  };

  if (toPush.length > 0) {
    const upsertRes = await upsertCloudCases(
      user,
      toPush,
      cloudCreatedAtMap,
      cloudRecordCreatedAtMap,
      knownNewIds
    );
    result = {
      pushedCount: toPush.length,
      uploadedCount: upsertRes.uploadedCount,
      approvalDocSkippedCount: upsertRes.approvalDocSkippedCount,
    };
  }

  // After all cases are safely synced under `users/${userKey}`, clean up legacy `users/${user.uid}` node
  if (hasLegacyUidNode && userKey !== user.uid) {
    try {
      await remove(ref(rtdb, `users/${user.uid}`));
    } catch {
      // Non-fatal; will retry on next sync if needed
    }
  }

  return result;
}

export function subscribeUserCases(
  userOrUid: CloudUserIdentity | string,
  cloudCreatedAtMap: Map<string, number>,
  cloudRecordCreatedAtMap: Map<string, number> | undefined,
  onSynced: (cases: SavedCaseRecord[], fromCache: boolean, cloudCount: number) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  const userKey = getRtdbUserKey(userOrUid);
  const listPath = `users/${userKey}/cases`;
  const casesRef = ref(rtdb, listPath);
  let hasSettledServerSnapshot = false;

  return onValue(
    casesRef,
    (snapshot) => {
      hasSettledServerSnapshot = true;
      const cloudRecords: SavedCaseRecord[] = [];

      if (snapshot.exists()) {
        const rawEntries = collectRtdbCaseEntries(snapshot.val());
        for (const key of Array.from(cloudKnownRelPathsMap.keys())) {
          if (key.startsWith(`${userKey}::`)) {
            cloudKnownRelPathsMap.delete(key);
          }
        }
        const entries = dedupeRtdbEntries(userKey, rawEntries);
        for (const entry of entries) {
          const createdMs = toEpochMs(entry.data.createdAt);
          if (createdMs) {
            cloudCreatedAtMap.set(entry.caseId, createdMs);
          }
          if (typeof entry.data.recordCreatedAt === 'number' && entry.data.recordCreatedAt > 0) {
            cloudRecordCreatedAtMap?.set(entry.caseId, entry.data.recordCreatedAt);
          }
          cloudRecords.push(fromCloudCaseDoc(entry.data, entry.caseId));
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

// =========================================================================
// DV Approval Customer Requests (Firebase Realtime Database Sync)
// Stored under `users/${userKey}/cases/${year}/${month}/DV - ${customerName} (${tag})`
// with `recordType: 'dv_request'` so it adheres strictly to existing RTDB rules.
// =========================================================================

const dvKnownRelPathsMap = new Map<string, Set<string>>();
const dvCloudCreatedAtMap = new Map<string, number>();

function getDvRelMapKey(userKey: string, safeId: string): string {
  return `${userKey}::${safeId}`;
}

function addKnownDvRelPath(userKey: string, safeId: string, relPath: string): void {
  const key = getDvRelMapKey(userKey, safeId);
  let setPaths = dvKnownRelPathsMap.get(key);
  if (!setPaths) {
    setPaths = new Set<string>();
    dvKnownRelPathsMap.set(key, setPaths);
  }
  setPaths.add(relPath);
}

function getKnownDvRelPaths(userKey: string, safeId: string): string[] {
  const setPaths = dvKnownRelPathsMap.get(getDvRelMapKey(userKey, safeId));
  return setPaths ? Array.from(setPaths) : [];
}

function setExactKnownDvRelPath(userKey: string, safeId: string, relPath: string): void {
  dvKnownRelPathsMap.set(getDvRelMapKey(userKey, safeId), new Set([relPath]));
}

function deleteKnownDvRelPaths(userKey: string, safeId: string): void {
  dvKnownRelPathsMap.delete(getDvRelMapKey(userKey, safeId));
}

export function getDvRequestRelPath(
  createdAtMs: unknown,
  safeId: string,
  customerName?: string
): string {
  const { year, month } = getCaseYearMonth(createdAtMs);
  const cleanName = sanitizeCustomerKeyPart(customerName, 'คุณลูกค้า');
  const tag = getCaseShortTag(safeId);
  return `${year}/${month}/DV - ${cleanName} (${tag})`;
}

interface RtdbDvEntry {
  dvId: string;
  relPath: string;
  data: Record<string, unknown>;
}

function collectRtdbDvEntries(rawTree: unknown): RtdbDvEntry[] {
  const entries: RtdbDvEntry[] = [];
  if (!rawTree || typeof rawTree !== 'object') return entries;

  for (const [level1Key, level1Val] of Object.entries(rawTree as Record<string, unknown>)) {
    if (!level1Val || typeof level1Val !== 'object' || Array.isArray(level1Val)) continue;
    const level1Obj = level1Val as Record<string, unknown>;
    if (isDvRequestNode(level1Obj, level1Key)) {
      entries.push({
        dvId: sanitizeDvRequestId(String(level1Obj.id || level1Key)),
        relPath: level1Key,
        data: level1Obj,
      });
      continue;
    }
    if (/^\d{4}$/.test(level1Key)) {
      for (const [level2Key, level2Val] of Object.entries(level1Obj)) {
        if (!level2Val || typeof level2Val !== 'object' || Array.isArray(level2Val)) continue;
        for (const [nodeKey, nodeVal] of Object.entries(level2Val as Record<string, unknown>)) {
          if (!isDvRequestNode(nodeVal, nodeKey)) continue;
          const nodeObj = nodeVal as Record<string, unknown>;
          entries.push({
            dvId: sanitizeDvRequestId(String(nodeObj.id || nodeKey)),
            relPath: `${level1Key}/${level2Key}/${nodeKey}`,
            data: nodeObj,
          });
        }
      }
    }
  }

  return entries;
}

export function buildRtdbDvPayload(
  record: SavedDvRequestRecord,
  uid: string,
  existingCreatedAt?: number
): Record<string, unknown> {
  const safeId = sanitizeDvRequestId(record.id);
  const proposalKey: ProposalKey =
    record.proposalKey && VALID_PROPOSAL_KEYS.includes(record.proposalKey)
      ? record.proposalKey
      : 'small_bike';
  const nowMs = Date.now();
  const cleanName = safeStr(record.customerName || 'คุณลูกค้า', 200).trim() || 'คุณลูกค้า';
  const cleanModel = safeStr(record.bikeModel || '', 200).trim();
  const caseTitle = safeStr(
    cleanModel ? `DV: ${cleanName} • ${cleanModel}` : `DV: ${cleanName}`,
    300
  );
  const status: DvRequestStatus =
    record.status === 'approved' || record.status === 'rejected' ? record.status : 'pending';

  const dvData: Record<string, unknown> = {
    customerName: cleanName,
    topics: Array.isArray(record.topics)
      ? record.topics.map((t) => safeStr(t, 200)).filter(Boolean).slice(0, 30)
      : [],
    ncb: safeStr(record.ncb || 'Normal', 60),
    dealer: safeStr(record.dealer || '', 200),
    bikeModel: cleanModel,
    bikeCode: safeStr(record.bikeCode || '', 80),
    occupation: safeStr(record.occupation || '', 150),
    income: safeStr(record.income || '', 120),
    financialDocs: safeStr(record.financialDocs || '', 120),
    downPayment: safeStr(record.downPayment || '', 120),
    remark: safeStr(record.remark || '', 2000),
    ck: safeStr(record.ck || '', 150),
    yodRate: safeStr(record.yodRate || '', 120),
    dvMessage: safeStr(record.dvMessage || '', 4000),
    status,
    proposalKey,
    financeAmount: safeAnyNum(record.financeAmount, 0),
    monthlyInstallment: safeAnyNum(record.monthlyInstallment, 0),
    term: Math.max(1, Math.min(120, Math.round(safeAnyNum(record.term, 36) || 36))),
  };

  if (typeof record.customerAge === 'string' && record.customerAge) {
    dvData.customerAge = safeStr(record.customerAge, 20);
  }
  if (typeof record.customerWorkMonths === 'string' && record.customerWorkMonths) {
    dvData.customerWorkMonths = safeStr(record.customerWorkMonths, 20);
  }
  if (typeof record.customerIncome === 'string' && record.customerIncome) {
    dvData.customerIncome = safeStr(record.customerIncome, 30);
  }
  if (typeof record.customerResidenceMonths === 'string' && record.customerResidenceMonths) {
    dvData.customerResidenceMonths = safeStr(record.customerResidenceMonths, 20);
  }
  if (record.isAceCustomer !== undefined) {
    dvData.isAceCustomer = Boolean(record.isAceCustomer);
  }

  const payload: Record<string, unknown> = {
    ownerUid: uid,
    id: safeId,
    recordType: 'dv_request',
    caseTitle,
    customerName: cleanName,
    ...(cleanModel ? { bikeModelName: cleanModel } : {}),
    ...(dvData.dealer ? { dealerName: dvData.dealer } : {}),
    proposalKey,
    vehiclePrice: 0,
    term: Math.max(1, Math.min(120, Math.round(safeAnyNum(record.term, 36) || 36))),
    snapshot: {
      monthlyInstallment: safeAnyNum(record.monthlyInstallment, 0),
      financeAmount: safeAnyNum(record.financeAmount, 0),
    },
    dvData,
    recordCreatedAt: Math.max(1, safeAnyNum(record.createdAt, nowMs)),
    recordUpdatedAt: Math.max(1, safeAnyNum(record.updatedAt, nowMs)),
    createdAt:
      typeof existingCreatedAt === 'number' && Number.isFinite(existingCreatedAt) && existingCreatedAt > 0
        ? existingCreatedAt
        : rtdbServerTimestamp(),
    updatedAt: rtdbServerTimestamp(),
  };

  return stripUndefinedDeep(payload);
}

export function fromCloudDvDoc(
  data: Record<string, unknown>,
  fallbackId?: string
): SavedDvRequestRecord {
  const hasNestedDvData = Boolean(
    data.dvData && typeof data.dvData === 'object' && !Array.isArray(data.dvData)
  );
  const dvRaw = hasNestedDvData ? (data.dvData as Record<string, unknown>) : data;

  const statusRaw = dvRaw.status;
  const status: DvRequestStatus =
    statusRaw === 'approved' || statusRaw === 'rejected' ? statusRaw : 'pending';

  const topics = Array.isArray(dvRaw.topics)
    ? dvRaw.topics.map((t) => String(t)).filter(Boolean)
    : [];

  // Recover name/model if an older sync stripped dvData but preserved caseTitle ("DV: Name • Model")
  let titleNameFallback = '';
  let titleModelFallback = '';
  const rawCaseTitle = typeof data.caseTitle === 'string' ? data.caseTitle.trim() : '';
  if (rawCaseTitle.startsWith('DV:')) {
    const stripped = rawCaseTitle.slice(3).trim();
    const parts = stripped.split('•').map((p) => p.trim());
    if (parts[0]) titleNameFallback = parts[0];
    if (parts[1]) titleModelFallback = parts[1];
  } else if (rawCaseTitle && rawCaseTitle !== 'คุณลูกค้า') {
    titleNameFallback = rawCaseTitle;
  }

  const rawDvName = typeof dvRaw.customerName === 'string' ? dvRaw.customerName.trim() : '';
  const rawTopName = typeof data.customerName === 'string' ? data.customerName.trim() : '';
  const resolvedCustomerName =
    (rawDvName && rawDvName !== 'คุณลูกค้า' ? rawDvName : '') ||
    (rawTopName && rawTopName !== 'คุณลูกค้า' ? rawTopName : '') ||
    titleNameFallback ||
    rawDvName ||
    rawTopName ||
    'คุณลูกค้า';

  const snapRaw =
    data.snapshot && typeof data.snapshot === 'object'
      ? (data.snapshot as Record<string, unknown>)
      : {};
  const fallbackDownAmount =
    typeof snapRaw.downAmount === 'number' && snapRaw.downAmount > 0
      ? `${snapRaw.downAmount.toLocaleString('th-TH')} บาท`
      : '';
  const fallbackIncome =
    typeof data.customerIncome === 'string' && data.customerIncome.trim()
      ? `${Number(data.customerIncome.replace(/,/g, '')) ? Number(data.customerIncome.replace(/,/g, '')).toLocaleString('th-TH') + ' บาท/เดือน' : data.customerIncome.trim()}`
      : '';

  return {
    id: sanitizeDvRequestId(String(data.id || fallbackId || '')),
    createdAt: Number(data.recordCreatedAt) || toEpochMs(data.createdAt) || Date.now(),
    updatedAt: Number(data.recordUpdatedAt) || toEpochMs(data.updatedAt) || Date.now(),
    customerName: resolvedCustomerName,
    topics,
    ncb: String(dvRaw.ncb || 'Normal'),
    dealer: String(dvRaw.dealer || data.dealerName || ''),
    bikeModel: String(dvRaw.bikeModel || data.bikeModelName || titleModelFallback || ''),
    bikeCode: String(dvRaw.bikeCode || data.bikeModelCode || ''),
    occupation: String(dvRaw.occupation || data.customerOccupation || ''),
    income: String(dvRaw.income || fallbackIncome || ''),
    financialDocs: String(dvRaw.financialDocs || ''),
    downPayment: String(dvRaw.downPayment || fallbackDownAmount || ''),
    remark: String(dvRaw.remark || ''),
    ck: String(dvRaw.ck || data.officerName || ''),
    yodRate: String(dvRaw.yodRate || ''),
    dvMessage: String(dvRaw.dvMessage || ''),
    status,
    proposalKey: (dvRaw.proposalKey || data.proposalKey) as ProposalKey | undefined,
    financeAmount:
      typeof dvRaw.financeAmount === 'number'
        ? dvRaw.financeAmount
        : typeof snapRaw.financeAmount === 'number'
        ? snapRaw.financeAmount
        : undefined,
    monthlyInstallment:
      typeof dvRaw.monthlyInstallment === 'number'
        ? dvRaw.monthlyInstallment
        : typeof snapRaw.monthlyInstallment === 'number'
        ? snapRaw.monthlyInstallment
        : undefined,
    term:
      typeof dvRaw.term === 'number'
        ? dvRaw.term
        : typeof data.term === 'number'
        ? data.term
        : undefined,
    customerAge:
      typeof dvRaw.customerAge === 'string'
        ? dvRaw.customerAge
        : typeof data.customerAge === 'string'
        ? data.customerAge
        : undefined,
    customerWorkMonths:
      typeof dvRaw.customerWorkMonths === 'string'
        ? dvRaw.customerWorkMonths
        : typeof data.customerWorkMonths === 'string'
        ? data.customerWorkMonths
        : undefined,
    customerIncome:
      typeof dvRaw.customerIncome === 'string'
        ? dvRaw.customerIncome
        : typeof data.customerIncome === 'string'
        ? data.customerIncome
        : undefined,
    customerResidenceMonths:
      typeof dvRaw.customerResidenceMonths === 'string'
        ? dvRaw.customerResidenceMonths
        : typeof data.customerResidenceMonths === 'string'
        ? data.customerResidenceMonths
        : undefined,
    isAceCustomer:
      typeof dvRaw.isAceCustomer === 'boolean'
        ? dvRaw.isAceCustomer
        : typeof data.isAceCustomer === 'boolean'
        ? data.isAceCustomer
        : undefined,
  };
}

export async function upsertCloudDvRequest(
  userOrUid: CloudUserIdentity | string,
  record: SavedDvRequestRecord
): Promise<void> {
  const uid = typeof userOrUid === 'string' ? userOrUid : userOrUid.uid;
  const userKey = getRtdbUserKey(userOrUid);
  const safeId = sanitizeDvRequestId(record.id);
  const casesBasePath = `users/${userKey}/cases`;
  const targetRelPath = getDvRequestRelPath(record.createdAt, safeId, record.customerName);
  const fullPath = `${casesBasePath}/${targetRelPath}`;

  const existingCreatedAt = dvCloudCreatedAtMap.get(getDvRelMapKey(userKey, safeId));
  const payload = buildRtdbDvPayload(record, uid, existingCreatedAt);

  const oldRelPaths = getKnownDvRelPaths(userKey, safeId).filter((p) => p !== targetRelPath);

  try {
    await set(ref(rtdb, fullPath), payload);
    setExactKnownDvRelPath(userKey, safeId, targetRelPath);
    for (const oldRel of oldRelPaths) {
      await remove(ref(rtdb, `${casesBasePath}/${oldRel}`)).catch(() => {});
    }
    markConfirmedDvCloudIds([safeId]);
    clearPendingDvUploads([safeId]);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, fullPath);
  }
}

export async function deleteCloudDvRequest(
  userOrUid: CloudUserIdentity | string,
  id: string
): Promise<void> {
  const userKey = getRtdbUserKey(userOrUid);
  const safeId = sanitizeDvRequestId(id);
  const casesBasePath = `users/${userKey}/cases`;

  let relPaths = getKnownDvRelPaths(userKey, safeId);
  if (relPaths.length === 0) {
    try {
      const snap = await get(ref(rtdb, casesBasePath));
      if (snap.exists()) {
        const entries = collectRtdbDvEntries(snap.val());
        for (const e of entries) {
          addKnownDvRelPath(userKey, e.dvId, e.relPath);
        }
        relPaths = getKnownDvRelPaths(userKey, safeId);
      }
    } catch {
      // ignore scan error and try delete anyway
    }
  }

  for (const relPath of relPaths) {
    const fullPath = `${casesBasePath}/${relPath}`;
    try {
      await remove(ref(rtdb, fullPath));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, fullPath);
    }
  }

  deleteKnownDvRelPaths(userKey, safeId);
  dvCloudCreatedAtMap.delete(getDvRelMapKey(userKey, safeId));
  clearPendingDvDeletes([safeId]);
}

export async function pushLocalDvRequestsToCloud(
  userOrUid: CloudUserIdentity | string
): Promise<number> {
  const userKey = getRtdbUserKey(userOrUid);
  const listPath = `users/${userKey}/cases`;

  let cloudSnap;
  try {
    cloudSnap = await get(ref(rtdb, listPath));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, listPath);
  }

  const cloudUpdatedMap = new Map<string, number>();
  const cloudMissingDvDataSet = new Set<string>();
  const cloudRecords: SavedDvRequestRecord[] = [];
  const pendingDeletes = getPendingDvDeletes();

  if (cloudSnap && cloudSnap.exists()) {
    const entries = collectRtdbDvEntries(cloudSnap.val());
    for (const entry of entries) {
      if (pendingDeletes.has(entry.dvId)) continue;
      addKnownDvRelPath(userKey, entry.dvId, entry.relPath);
      const createdMs = toEpochMs(entry.data.createdAt);
      if (createdMs) {
        dvCloudCreatedAtMap.set(getDvRelMapKey(userKey, entry.dvId), createdMs);
      }
      cloudUpdatedMap.set(entry.dvId, Number(entry.data.recordUpdatedAt) || 0);
      if (!entry.data.dvData || typeof entry.data.dvData !== 'object') {
        cloudMissingDvDataSet.add(entry.dvId);
      }
      cloudRecords.push(fromCloudDvDoc(entry.data, entry.dvId));
      markConfirmedDvCloudIds([entry.dvId]);
    }
  }

  // Delete any pending deletes from cloud first
  for (const delId of pendingDeletes) {
    await deleteCloudDvRequest(userOrUid, delId).catch(() => {});
  }

  const merged = mergeCloudDvRequestsIntoLocal(cloudRecords, {
    isServerSnapshotSettled: false,
  });

  let uploadedCount = 0;
  for (const rec of merged) {
    const safeId = sanitizeDvRequestId(rec.id);
    if (pendingDeletes.has(safeId)) continue;
    const cloudUpdated = cloudUpdatedMap.get(safeId);
    const localHasRichDetails = Boolean(
      rec.bikeModel ||
        rec.downPayment ||
        rec.income ||
        rec.dealer ||
        rec.topics.length > 0 ||
        (rec.customerName && rec.customerName !== 'คุณลูกค้า')
    );
    if (
      cloudUpdated === undefined ||
      rec.updatedAt > cloudUpdated ||
      (cloudMissingDvDataSet.has(safeId) && localHasRichDetails)
    ) {
      await upsertCloudDvRequest(userOrUid, rec);
      uploadedCount += 1;
    }
  }

  return uploadedCount;
}

export function subscribeUserDvRequests(
  userOrUid: CloudUserIdentity | string,
  onSynced: (records: SavedDvRequestRecord[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  const userKey = getRtdbUserKey(userOrUid);
  const listPath = `users/${userKey}/cases`;
  const casesRef = ref(rtdb, listPath);
  let hasSettled = false;

  return onValue(
    casesRef,
    (snapshot) => {
      hasSettled = true;
      const cloudRecords: SavedDvRequestRecord[] = [];
      const pendingDeletes = getPendingDvDeletes();

      for (const key of Array.from(dvKnownRelPathsMap.keys())) {
        if (key.startsWith(`${userKey}::`)) {
          dvKnownRelPathsMap.delete(key);
        }
      }

      if (snapshot.exists()) {
        const entries = collectRtdbDvEntries(snapshot.val());
        const bestById = new Map<string, RtdbDvEntry>();
        for (const entry of entries) {
          addKnownDvRelPath(userKey, entry.dvId, entry.relPath);
          const createdMs = toEpochMs(entry.data.createdAt);
          if (createdMs) {
            dvCloudCreatedAtMap.set(getDvRelMapKey(userKey, entry.dvId), createdMs);
          }
          const existing = bestById.get(entry.dvId);
          if (
            !existing ||
            (Number(entry.data.recordUpdatedAt) || 0) > (Number(existing.data.recordUpdatedAt) || 0)
          ) {
            bestById.set(entry.dvId, entry);
          }
        }

        for (const entry of bestById.values()) {
          if (pendingDeletes.has(entry.dvId)) continue;
          markConfirmedDvCloudIds([entry.dvId]);
          cloudRecords.push(fromCloudDvDoc(entry.data, entry.dvId));
        }
      }

      const merged = mergeCloudDvRequestsIntoLocal(cloudRecords, {
        isServerSnapshotSettled: hasSettled,
      });
      onSynced(merged);
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

