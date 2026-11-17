import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  where,
  writeBatch,
} from 'firebase/firestore';
import { get as rtdbGet, ref as rtdbRef } from 'firebase/database';
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
  getSavedCases,
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
  const path = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);

  let snap;
  try {
    snap = await getDocFromServer(userRef);
  } catch {
    try {
      snap = await getDoc(userRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  if (snap && snap.exists()) {
    const data = snap.data();
    return {
      officerName: typeof data.officerName === 'string' ? data.officerName : undefined,
      officerCode: typeof data.officerCode === 'string' ? data.officerCode : undefined,
      officerLicense: typeof data.officerLicense === 'string' ? data.officerLicense : undefined,
      dealerName: typeof data.dealerName === 'string' ? data.dealerName : undefined,
    };
  }

  const profilePayload: Record<string, unknown> = {
    uid: user.uid,
    email: safeStr((user.email || '').trim(), 320),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
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
    await setDoc(userRef, profilePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  return localPrefs || {};
}

export async function updateUserProfilePrefs(
  user: User,
  prefs: UserProfilePrefs
): Promise<void> {
  const path = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);

  let snap;
  try {
    snap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!snap || !snap.exists()) {
    await ensureUserProfileDoc(user, prefs);
    return;
  }

  const existing = snap.data();
  const payload: Record<string, unknown> = {
    uid: existing.uid,
    email: existing.email,
    createdAt: existing.createdAt,
    updatedAt: serverTimestamp(),
  };

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
    await setDoc(userRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function buildFirestoreCasePayload(
  record: SavedCaseRecord,
  uid: string,
  existingCreatedAt?: Timestamp,
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
    createdAt: existingCreatedAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // Optional fields strictly validated by blueprint and firestore.rules
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

  return payload;
}

export function fromFirestoreCaseDoc(
  data: Record<string, unknown>,
  fallbackId?: string
): SavedCaseRecord {
  const paymentsRaw = data.installmentPayments as Record<string, InstallmentPaymentStatus> | undefined;
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
    createdAt: Number(data.recordCreatedAt) || Date.now(),
    updatedAt: Number(data.recordUpdatedAt) || Date.now(),
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

function isPermissionDeniedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';
  return code.includes('permission-denied') || msg.toLowerCase().includes('permission');
}

export const RULE_REQUIRED_CASE_KEYS = [
  'ownerUid',
  'id',
  'caseTitle',
  'officerName',
  'officerCode',
  'customerName',
  'proposalKey',
  'vehiclePrice',
  'downMode',
  'downValue',
  'term',
  'includeDeliveryFees',
  'registrationFee',
  'theftInsuranceFee',
  'isCustomRateEnabled',
  'customRateInput',
  'customRateType',
  'enforceEirCap',
  'insurancePlan',
  'insuranceYears',
  'snapshot',
  'recordCreatedAt',
  'recordUpdatedAt',
  'createdAt',
  'updatedAt',
];

export const RULE_ALLOWED_CASE_KEYS = new Set([
  ...RULE_REQUIRED_CASE_KEYS,
  'officerLicense',
  'customerPhone',
  'customerNote',
  'customerAge',
  'customerWorkMonths',
  'customerIncome',
  'customerResidenceMonths',
  'customerOccupation',
  'isAceCustomer',
  'dealerName',
  'bikeModelName',
  'bikeModelCode',
  'bikeBrand',
  'approvalStatus',
  'deliveryStatus',
  'approvalDate',
  'deliveryDate',
  'deliveryConfirmedAt',
  'approvalNote',
  'approvalUpdatedAt',
  'paymentDueDay',
  'googleMapsLocation',
  'installmentPayments',
  'approvalDoc',
]);

export function diagnosePayloadAgainstRules(
  payload: Record<string, unknown>,
  uid: string,
  caseId: string
): string {
  const issues: string[] = [];
  const idRe = /^[a-zA-Z0-9_-]+$/;
  const checkStr = (key: string, maxLen: number, minLen = 0) => {
    if (!(key in payload)) return;
    const v = payload[key];
    if (typeof v !== 'string') issues.push(`${key}:type=${typeof v}`);
    else if (v.length < minLen || v.length > maxLen) issues.push(`${key}:len=${v.length}`);
  };
  const checkNum = (key: string, min?: number, max?: number) => {
    if (!(key in payload)) return;
    const v = payload[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) issues.push(`${key}:num=${String(v)}`);
    else if ((min !== undefined && v < min) || (max !== undefined && v > max)) {
      issues.push(`${key}:range=${v}`);
    }
  };
  const checkBool = (key: string) => {
    if (key in payload && typeof payload[key] !== 'boolean') {
      issues.push(`${key}:bool=${typeof payload[key]}`);
    }
  };

  if (!idRe.test(uid) || uid.length > 128) issues.push('uid');
  if (!idRe.test(caseId) || caseId.length > 128) issues.push('caseId');
  if (payload.ownerUid !== uid) issues.push('ownerUid!=uid');
  if (payload.id !== caseId) issues.push('id!=caseId');
  for (const reqKey of RULE_REQUIRED_CASE_KEYS) {
    if (!(reqKey in payload)) issues.push(`missing:${reqKey}`);
  }
  for (const key of Object.keys(payload)) {
    if (!RULE_ALLOWED_CASE_KEYS.has(key)) issues.push(`extra:${key}`);
  }

  checkStr('caseTitle', 300, 1);
  checkStr('officerName', 150);
  checkStr('officerCode', 50);
  checkStr('customerName', 200);
  if (!VALID_PROPOSAL_KEYS.includes(payload.proposalKey as ProposalKey)) {
    issues.push(`proposalKey=${String(payload.proposalKey)}`);
  }
  checkNum('vehiclePrice', 0, 10000000);
  if (payload.downMode !== 'amount' && payload.downMode !== 'percent') issues.push(`downMode=${String(payload.downMode)}`);
  checkNum('downValue', 0, 10000000);
  checkNum('term', 1, 120);
  checkBool('includeDeliveryFees');
  checkNum('registrationFee', 0, 1000000);
  checkNum('theftInsuranceFee', 0, 1000000);
  checkBool('isCustomRateEnabled');
  checkStr('customRateInput', 30);
  if (payload.customRateType !== 'monthly' && payload.customRateType !== 'annual') issues.push('customRateType');
  checkBool('enforceEirCap');
  if (!['none', 'plan_a', 'plan_b'].includes(String(payload.insurancePlan))) issues.push('insurancePlan');
  if (![1, 2, 3].includes(Number(payload.insuranceYears))) issues.push('insuranceYears');
  checkNum('recordCreatedAt', 1);
  checkNum('recordUpdatedAt', 1);

  checkStr('officerLicense', 100);
  checkStr('customerPhone', 50);
  checkStr('customerNote', 1000);
  checkStr('customerAge', 20);
  checkStr('customerWorkMonths', 20);
  checkStr('customerIncome', 30);
  checkStr('customerResidenceMonths', 20);
  checkStr('customerOccupation', 150);
  checkBool('isAceCustomer');
  checkStr('dealerName', 200);
  checkStr('bikeModelName', 200);
  checkStr('bikeModelCode', 80);
  checkStr('bikeBrand', 80);
  if (
    'approvalStatus' in payload &&
    !['pending', 'approved', 'rejected', 'cancelled'].includes(String(payload.approvalStatus))
  ) {
    issues.push(`approvalStatus=${String(payload.approvalStatus)}`);
  }
  if (
    'deliveryStatus' in payload &&
    !['pending_delivery', 'delivered'].includes(String(payload.deliveryStatus))
  ) {
    issues.push(`deliveryStatus=${String(payload.deliveryStatus)}`);
  }
  checkStr('approvalDate', 40);
  checkStr('deliveryDate', 40);
  checkNum('deliveryConfirmedAt');
  checkStr('approvalNote', 1000);
  checkNum('approvalUpdatedAt');
  checkNum('paymentDueDay', 1, 31);
  checkStr('googleMapsLocation', 1500);
  if ('installmentPayments' in payload) {
    const ip = payload.installmentPayments;
    if (!ip || typeof ip !== 'object' || Array.isArray(ip) || Object.keys(ip).length > 120) {
      issues.push('installmentPayments');
    }
  }
  if ('approvalDoc' in payload) {
    const ad = payload.approvalDoc as Record<string, unknown>;
    if (!ad || typeof ad !== 'object') issues.push('approvalDoc');
    else {
      for (const k of ['name', 'size', 'uploadedAt']) {
        if (!(k in ad)) issues.push(`adMissing:${k}`);
      }
      for (const k of Object.keys(ad)) {
        if (!['name', 'size', 'uploadedAt', 'type'].includes(k)) issues.push(`adExtra:${k}`);
      }
      if (typeof ad.name !== 'string' || ad.name.length < 1 || ad.name.length > 300) issues.push('ad.name');
      if (typeof ad.size !== 'number' || ad.size < 0) issues.push('ad.size');
      if (typeof ad.uploadedAt !== 'number') issues.push('ad.uploadedAt');
      if ('type' in ad && (typeof ad.type !== 'string' || ad.type.length > 120)) issues.push('ad.type');
    }
  }

  const snap = payload.snapshot as Record<string, unknown> | undefined;
  if (!snap || typeof snap !== 'object') {
    issues.push('snapshot');
  } else {
    const snapReq = [
      'monthlyInstallment',
      'financeAmount',
      'downAmount',
      'downPercent',
      'totalInterest',
      'totalWithVat',
      'effectiveMonthlyRate',
      'eirAnnualPercent',
      'proposalCode',
      'proposalName',
      'rateDisplayText',
    ];
    const snapAllowed = new Set([...snapReq, 'rawMonthlyInstallment', 'totalDriveAwayCost']);
    for (const sk of snapReq) {
      if (!(sk in snap)) issues.push(`snapMissing:${sk}`);
    }
    for (const sk of Object.keys(snap)) {
      if (!snapAllowed.has(sk)) issues.push(`snapExtra:${sk}`);
    }
    for (const nk of [
      'monthlyInstallment',
      'financeAmount',
      'downAmount',
      'downPercent',
      'totalInterest',
      'totalWithVat',
      'effectiveMonthlyRate',
      'eirAnnualPercent',
    ]) {
      if (typeof snap[nk] !== 'number' || !Number.isFinite(snap[nk] as number)) issues.push(`snap:${nk}`);
    }
    if (typeof snap.proposalCode !== 'string' || snap.proposalCode.length > 60) issues.push('snap:proposalCode');
    if (typeof snap.proposalName !== 'string' || snap.proposalName.length > 160) issues.push('snap:proposalName');
    if (typeof snap.rateDisplayText !== 'string' || snap.rateDisplayText.length > 160) issues.push('snap:rateDisplayText');
    if ('rawMonthlyInstallment' in snap && typeof snap.rawMonthlyInstallment !== 'number') issues.push('snap:rawMonthly');
    if ('totalDriveAwayCost' in snap && typeof snap.totalDriveAwayCost !== 'number') issues.push('snap:driveAway');
  }
  const optKeys = Object.keys(payload).filter((k) => !RULE_REQUIRED_CASE_KEYS.includes(k));
  return `check=${issues.length ? issues.join(',') : 'PASS'} opt=[${optKeys.join(',')}]`;
}

export async function upsertCloudCases(
  uid: string,
  records: SavedCaseRecord[],
  cloudCreatedAtMap: Map<string, Timestamp>,
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

  // Deduplicate by safeId (latest record wins) because writeBatch cannot touch the same doc twice
  const dedupedMap = new Map<string, { safeId: string; record: SavedCaseRecord }>();
  for (const record of records) {
    const safeId = sanitizeCaseId(record.id);
    dedupedMap.set(safeId, { safeId, record });
  }
  const uniqueItems = Array.from(dedupedMap.values());
  const allSafeIds = uniqueItems.map((i) => i.safeId);
  const totalCount = uniqueItems.length;

  // Mark all IDs pending BEFORE async Firestore writes so onSnapshot never wipes un-uploaded items
  markPendingCloudUploads(allSafeIds);

  let firstError: unknown = null;
  const succeededIds: string[] = [];
  const approvalDocSkippedIds = new Set<string>();
  let failedCount = 0;

  try {
    // 1. Pre-check existing docs efficiently
    const needLookup = uniqueItems.filter(
      ({ safeId }) => !cloudCreatedAtMap.has(safeId) && !knownNewIds?.has(safeId)
    );

    if (needLookup.length > 3) {
      const casesCol = collection(db, 'users', uid, 'cases');
      const q = query(casesCol, where('ownerUid', '==', uid));
      const listPath = `users/${uid}/cases`;
      try {
        let existingSnap;
        try {
          existingSnap = await getDocsFromServer(q);
        } catch {
          existingSnap = await getDocs(q);
        }
        existingSnap?.forEach((d) => {
          const existingData = d.data();
          const ts = existingData.createdAt;
          if (ts instanceof Timestamp) {
            cloudCreatedAtMap.set(d.id, ts);
          }
          if (typeof existingData.recordCreatedAt === 'number' && existingData.recordCreatedAt > 0) {
            cloudRecordCreatedAtMap?.set(d.id, existingData.recordCreatedAt);
          }
          markConfirmedCloudIds([d.id]);
        });
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
          const docRef = doc(db, 'users', uid, 'cases', safeId);
          try {
            let existingSnap;
            try {
              existingSnap = await getDocFromServer(docRef);
            } catch {
              existingSnap = await getDoc(docRef);
            }
            if (existingSnap && existingSnap.exists()) {
              const existingData = existingSnap.data();
              const ts = existingData.createdAt;
              if (ts instanceof Timestamp) {
                cloudCreatedAtMap.set(safeId, ts);
              }
              if (typeof existingData.recordCreatedAt === 'number' && existingData.recordCreatedAt > 0) {
                cloudRecordCreatedAtMap?.set(safeId, existingData.recordCreatedAt);
              }
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

    // 2. Commit via Firestore writeBatch in chunks of 50 (fast, mobile-friendly, atomic per batch)
    const BATCH_SIZE = 50;
    let processedCount = 0;

    for (let i = 0; i < uniqueItems.length; i += BATCH_SIZE) {
      const chunk = uniqueItems.slice(i, i + BATCH_SIZE);
      const prepared = chunk.map(({ safeId, record }) => {
        const createdAtTs = cloudCreatedAtMap.get(safeId);
        const existingRecordCreatedAt = cloudRecordCreatedAtMap?.get(safeId);
        const payload = buildFirestoreCasePayload(
          record,
          uid,
          createdAtTs,
          existingRecordCreatedAt,
          safeId
        );
        return {
          safeId,
          path: `users/${uid}/cases/${safeId}`,
          docRef: doc(db, 'users', uid, 'cases', safeId),
          payload,
          isUpdate: Boolean(createdAtTs),
        };
      });

      const commitSingleWithReconcile = async (
        item: (typeof prepared)[number],
        rec: SavedCaseRecord
      ): Promise<void> => {
        try {
          await setDoc(item.docRef, item.payload);
          if (typeof item.payload.recordCreatedAt === 'number') {
            cloudRecordCreatedAtMap?.set(item.safeId, item.payload.recordCreatedAt);
          }
          succeededIds.push(item.safeId);
          return;
        } catch (err) {
          let latestErr: unknown = err;
          let latestCreatedAt = cloudCreatedAtMap.get(item.safeId);
          let latestRecordCreatedAt = cloudRecordCreatedAtMap?.get(item.safeId);

          if (isPermissionDeniedError(err)) {
            let shouldTryOmitApprovalDoc = 'approvalDoc' in item.payload;

            try {
              const prevCreatedAt = cloudCreatedAtMap.get(item.safeId);
              const prevRecordCreatedAt = cloudRecordCreatedAtMap?.get(item.safeId);
              const serverSnap = await getDocFromServer(item.docRef);
              if (serverSnap.exists()) {
                const serverData = serverSnap.data();
                const serverCreatedAt =
                  serverData.createdAt instanceof Timestamp ? serverData.createdAt : undefined;
                const serverRecordCreatedAt =
                  typeof serverData.recordCreatedAt === 'number' && serverData.recordCreatedAt > 0
                    ? serverData.recordCreatedAt
                    : undefined;

                if (serverCreatedAt) {
                  cloudCreatedAtMap.set(item.safeId, serverCreatedAt);
                  latestCreatedAt = serverCreatedAt;
                }
                if (serverRecordCreatedAt) {
                  cloudRecordCreatedAtMap?.set(item.safeId, serverRecordCreatedAt);
                  latestRecordCreatedAt = serverRecordCreatedAt;
                }

                const createdAtChanged =
                  !prevCreatedAt ||
                  Boolean(serverCreatedAt && !serverCreatedAt.isEqual(prevCreatedAt));
                const recordCreatedAtChanged =
                  Boolean(serverRecordCreatedAt && serverRecordCreatedAt !== prevRecordCreatedAt);

                if (!item.isUpdate || createdAtChanged || recordCreatedAtChanged) {
                  const retryPayload = buildFirestoreCasePayload(
                    rec,
                    uid,
                    serverCreatedAt,
                    serverRecordCreatedAt,
                    item.safeId
                  );
                  await setDoc(item.docRef, retryPayload);
                  if (typeof retryPayload.recordCreatedAt === 'number') {
                    cloudRecordCreatedAtMap?.set(item.safeId, retryPayload.recordCreatedAt);
                  }
                  succeededIds.push(item.safeId);
                  return;
                }
              } else if (item.isUpdate) {
                cloudCreatedAtMap.delete(item.safeId);
                cloudRecordCreatedAtMap?.delete(item.safeId);
                latestCreatedAt = undefined;
                latestRecordCreatedAt = undefined;
                const retryPayload = buildFirestoreCasePayload(
                  rec,
                  uid,
                  undefined,
                  undefined,
                  item.safeId
                );
                await setDoc(item.docRef, retryPayload);
                if (typeof retryPayload.recordCreatedAt === 'number') {
                  cloudRecordCreatedAtMap?.set(item.safeId, retryPayload.recordCreatedAt);
                }
                succeededIds.push(item.safeId);
                return;
              }
            } catch (reconcileErr) {
              latestErr = reconcileErr;
              shouldTryOmitApprovalDoc =
                'approvalDoc' in item.payload && isPermissionDeniedError(reconcileErr);
            }

            if (shouldTryOmitApprovalDoc) {
              try {
                const fallbackPayload = buildFirestoreCasePayload(
                  rec,
                  uid,
                  latestCreatedAt,
                  latestRecordCreatedAt,
                  item.safeId,
                  { omitApprovalDoc: true }
                );
                await setDoc(item.docRef, fallbackPayload);
                if (typeof fallbackPayload.recordCreatedAt === 'number') {
                  cloudRecordCreatedAtMap?.set(item.safeId, fallbackPayload.recordCreatedAt);
                }
                approvalDocSkippedIds.add(item.safeId);
                succeededIds.push(item.safeId);
                return;
              } catch (fallbackErr) {
                latestErr = fallbackErr;
              }
            }
          }

          failedCount++;
          const existedOnServer = cloudCreatedAtMap.has(item.safeId);
          const diag = diagnosePayloadAgainstRules(item.payload, uid, item.safeId);
          const errMsg = latestErr instanceof Error ? latestErr.message : String(latestErr);
          const enrichedErr = new Error(`${errMsg} | ${diag}`);
          try {
            handleFirestoreError(
              enrichedErr,
              existedOnServer ? OperationType.UPDATE : OperationType.CREATE,
              item.path
            );
          } catch (wrapped) {
            if (!firstError) firstError = wrapped;
          }
        }
      };

      if (prepared.length === 1) {
        await commitSingleWithReconcile(prepared[0], chunk[0].record);
        processedCount += 1;
        options?.onProgress?.(processedCount, totalCount);
        continue;
      }

      try {
        const batch = writeBatch(db);
        for (const item of prepared) {
          batch.set(item.docRef, item.payload);
        }
        await batch.commit();
        for (const item of prepared) {
          if (typeof item.payload.recordCreatedAt === 'number') {
            cloudRecordCreatedAtMap?.set(item.safeId, item.payload.recordCreatedAt);
          }
          succeededIds.push(item.safeId);
        }
        processedCount += prepared.length;
        options?.onProgress?.(processedCount, totalCount);
      } catch {
        // Fallback: commit individually so 1 problematic doc doesn't block all remaining valid docs
        for (let idx = 0; idx < prepared.length; idx++) {
          await commitSingleWithReconcile(prepared[idx], chunk[idx].record);
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
    approvalDocSkippedCount: approvalDocSkippedIds.size,
    firstError,
  };
}

export async function fetchAllCloudCasesToLocal(
  uid: string,
  cloudCreatedAtMap: Map<string, Timestamp>,
  cloudRecordCreatedAtMap?: Map<string, number>
): Promise<{ cases: SavedCaseRecord[]; cloudCount: number }> {
  const casesCol = collection(db, 'users', uid, 'cases');
  const q = query(casesCol, where('ownerUid', '==', uid));
  const listPath = `users/${uid}/cases`;

  let cloudSnap;
  try {
    try {
      cloudSnap = await getDocsFromServer(q);
    } catch {
      cloudSnap = await getDocs(q);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, listPath);
  }

  const cloudRecords: SavedCaseRecord[] = [];
  cloudSnap?.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.createdAt instanceof Timestamp) {
      cloudCreatedAtMap.set(docSnap.id, data.createdAt);
    }
    if (typeof data.recordCreatedAt === 'number' && data.recordCreatedAt > 0) {
      cloudRecordCreatedAtMap?.set(docSnap.id, data.recordCreatedAt);
    }
    cloudRecords.push(fromFirestoreCaseDoc(data, docSnap.id));
  });

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
  cloudCreatedAtMap: Map<string, Timestamp>,
  cloudRecordCreatedAtMap?: Map<string, number>
): Promise<void> {
  if (ids.length === 0) return;

  const uniqueIds = Array.from(new Set(ids.map((rawId) => sanitizeCaseId(rawId))));
  const deletedIds: string[] = [];
  const BATCH_SIZE = 100;

  try {
    for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
      const chunk = uniqueIds.slice(i, i + BATCH_SIZE);
      if (chunk.length === 1) {
        const safeId = chunk[0];
        const path = `users/${uid}/cases/${safeId}`;
        try {
          await deleteDoc(doc(db, 'users', uid, 'cases', safeId));
          cloudCreatedAtMap.delete(safeId);
          cloudRecordCreatedAtMap?.delete(safeId);
          deletedIds.push(safeId);
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, path);
        }
        continue;
      }

      const batch = writeBatch(db);
      for (const safeId of chunk) {
        batch.delete(doc(db, 'users', uid, 'cases', safeId));
      }
      try {
        await batch.commit();
        for (const safeId of chunk) {
          cloudCreatedAtMap.delete(safeId);
          cloudRecordCreatedAtMap?.delete(safeId);
          deletedIds.push(safeId);
        }
      } catch {
        for (const safeId of chunk) {
          const path = `users/${uid}/cases/${safeId}`;
          try {
            await deleteDoc(doc(db, 'users', uid, 'cases', safeId));
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

function extractCasesFromRtdbSnapshotVal(rawTree: unknown): SavedCaseRecord[] {
  const results: SavedCaseRecord[] = [];
  if (!rawTree || typeof rawTree !== 'object') return results;

  const isCaseObj = (val: unknown): val is Record<string, unknown> =>
    Boolean(val && typeof val === 'object' && !Array.isArray(val) && ('snapshot' in val || 'vehiclePrice' in val));

  for (const [k1, v1] of Object.entries(rawTree as Record<string, unknown>)) {
    if (!v1 || typeof v1 !== 'object') continue;
    if (isCaseObj(v1)) {
      results.push(fromFirestoreCaseDoc(v1, k1));
      continue;
    }
    if (/^\d{4}$/.test(k1)) {
      for (const [, v2] of Object.entries(v1 as Record<string, unknown>)) {
        if (!v2 || typeof v2 !== 'object') continue;
        for (const [caseId, caseVal] of Object.entries(v2 as Record<string, unknown>)) {
          if (isCaseObj(caseVal)) {
            results.push(fromFirestoreCaseDoc(caseVal, caseId));
          }
        }
      }
    }
  }
  return results;
}

/**
 * Best-effort one-time rescue of any cases temporarily synced to Realtime Database
 * so switching back to Firestore never leaves any case stranded.
 */
async function rescueRtdbCasesOnce(uid: string): Promise<void> {
  const flagKey = `ncap_rtdb_rescued_v1_${uid}`;
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(flagKey)) {
      return;
    }
    const snap = await Promise.race([
      rtdbGet(rtdbRef(rtdb, `users/${uid}/cases`)),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
    ]);
    if (snap && snap.exists()) {
      const rescued = extractCasesFromRtdbSnapshotVal(snap.val());
      if (rescued.length > 0) {
        mergeCloudCasesIntoLocal(rescued, {
          fromCache: false,
          isServerSnapshotSettled: false,
        });
      }
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(flagKey, String(Date.now()));
    }
  } catch {
    // Non-fatal: continue Firestore sync normally
  }
}

export interface PushAllLocalCasesResult {
  pushedCount: number;
  uploadedCount: number;
  approvalDocSkippedCount: number;
}

export async function pushAllLocalCasesToCloud(
  uid: string,
  cloudCreatedAtMap: Map<string, Timestamp>,
  cloudRecordCreatedAtMap?: Map<string, number>,
  options?: { forcePushIds?: Set<string> }
): Promise<PushAllLocalCasesResult> {
  await rescueRtdbCasesOnce(uid);

  const localCases = normalizeLocalCaseIdsForCloud();
  if (localCases.length === 0) {
    return { pushedCount: 0, uploadedCount: 0, approvalDocSkippedCount: 0 };
  }

  const casesCol = collection(db, 'users', uid, 'cases');
  const q = query(casesCol, where('ownerUid', '==', uid));
  const listPath = `users/${uid}/cases`;

  let cloudSnap;
  try {
    try {
      cloudSnap = await getDocsFromServer(q);
    } catch {
      cloudSnap = await getDocs(q);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, listPath);
  }

  const cloudUpdatedMap = new Map<string, number>();
  const cloudHasApprovalDocSet = new Set<string>();
  cloudSnap?.forEach((d) => {
    const data = d.data();
    const ts = data.createdAt;
    if (ts instanceof Timestamp) {
      cloudCreatedAtMap.set(d.id, ts);
    }
    if (typeof data.recordCreatedAt === 'number' && data.recordCreatedAt > 0) {
      cloudRecordCreatedAtMap?.set(d.id, data.recordCreatedAt);
    }
    if (data.approvalDoc) {
      cloudHasApprovalDocSet.add(d.id);
    }
    cloudUpdatedMap.set(d.id, Number(data.recordUpdatedAt) || 0);
    markConfirmedCloudIds([d.id]);
  });

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
  cloudCreatedAtMap: Map<string, Timestamp>,
  cloudRecordCreatedAtMap: Map<string, number> | undefined,
  onSynced: (cases: SavedCaseRecord[], fromCache: boolean, cloudCount: number) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  const casesCol = collection(db, 'users', uid, 'cases');
  const q = query(casesCol, where('ownerUid', '==', uid));
  const listPath = `users/${uid}/cases`;
  let hasSettledServerSnapshot = false;

  return onSnapshot(
    q,
    (snapshot) => {
      if (!snapshot.metadata.fromCache) {
        hasSettledServerSnapshot = true;
      }

      const cloudRecords: SavedCaseRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.createdAt instanceof Timestamp) {
          cloudCreatedAtMap.set(docSnap.id, data.createdAt);
        }
        if (typeof data.recordCreatedAt === 'number' && data.recordCreatedAt > 0) {
          cloudRecordCreatedAtMap?.set(docSnap.id, data.recordCreatedAt);
        }
        cloudRecords.push(fromFirestoreCaseDoc(data, docSnap.id));
      });

      // Avoid processing an initial empty cache snapshot before server sync arrives
      if (snapshot.metadata.fromCache && cloudRecords.length === 0 && getSavedCases().length > 0) {
        return;
      }

      const merged = mergeCloudCasesIntoLocal(cloudRecords, {
        fromCache: snapshot.metadata.fromCache,
        isServerSnapshotSettled: hasSettledServerSnapshot,
      });
      onSynced(merged, snapshot.metadata.fromCache, cloudRecords.length);
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
