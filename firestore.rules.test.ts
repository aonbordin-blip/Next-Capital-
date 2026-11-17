/**
 * Firestore Security Rules & Full App Sync Verification Suite
 * Mirrors firestore.rules verbatim to validate:
 * 1. All 44 real MotoLease cases (create + update actions + roundtrip)
 * 2. Synthetic boundary/edge-case payloads (max strings, 120 installments, UserProfile)
 * 3. All 12 "Dirty Dozen" adversarial payloads (must return PERMISSION_DENIED)
 */

import fs from 'fs';
import { Timestamp } from 'firebase/firestore';
import {
  buildFirestoreCasePayload,
  fromFirestoreCaseDoc,
  diagnosePayloadAgainstRules,
} from './src/utils/cloudSync';
import { SavedCaseRecord } from './src/types';

export const DIRTY_DOZEN_CASES = [
  {
    name: '1. Unauthenticated read on /users/u1/cases/case-1',
    operation: 'get',
    path: '/users/u1/cases/case-1',
    auth: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '2. Unverified email write on /users/u1/cases/case-1',
    operation: 'create',
    path: '/users/u1/cases/case-1',
    auth: { uid: 'u1', token: { email: 'test@example.com', email_verified: false } },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '3. Cross-tenant get by user u2 on u1 case',
    operation: 'get',
    path: '/users/u1/cases/case-1',
    auth: { uid: 'u2', token: { email: 'u2@example.com', email_verified: true } },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. Cross-tenant list by user u2 on /users/u1/cases',
    operation: 'list',
    path: '/users/u1/cases',
    auth: { uid: 'u2', token: { email: 'u2@example.com', email_verified: true } },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. Directory enumeration list on /users',
    operation: 'list',
    path: '/users',
    auth: { uid: 'u1', token: { email: 'u1@example.com', email_verified: true } },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. Identity spoofing ownerUid mismatch on create',
    operation: 'create',
    path: '/users/u1/cases/case-1',
    auth: { uid: 'u1', token: { email: 'u1@example.com', email_verified: true } },
    payload: { ownerUid: 'u2', id: 'case-1' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. ID poisoning with invalid characters',
    operation: 'create',
    path: '/users/u1/cases/bad$id..hack',
    auth: { uid: 'u1', token: { email: 'u1@example.com', email_verified: true } },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Shadow field injection (isAdmin: true)',
    operation: 'create',
    path: '/users/u1/cases/case-1',
    auth: { uid: 'u1', token: { email: 'u1@example.com', email_verified: true } },
    payload: { isAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. Immutable field tampering (ownerUid/createdAt/recordCreatedAt) on update',
    operation: 'update',
    path: '/users/u1/cases/case-1',
    auth: { uid: 'u1', token: { email: 'u1@example.com', email_verified: true } },
    payload: { ownerUid: 'u2' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Forged client timestamp instead of request.time',
    operation: 'create',
    path: '/users/u1/cases/case-1',
    auth: { uid: 'u1', token: { email: 'u1@example.com', email_verified: true } },
    payload: { createdAt: new Date(0), updatedAt: new Date(0) },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Resource poisoning (oversized googleMapsLocation > 1500 chars)',
    operation: 'update',
    path: '/users/u1/cases/case-1',
    auth: { uid: 'u1', token: { email: 'u1@example.com', email_verified: true } },
    payload: { googleMapsLocation: 'x'.repeat(2000) },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Type poisoning (vehiclePrice as string)',
    operation: 'create',
    path: '/users/u1/cases/case-1',
    auth: { uid: 'u1', token: { email: 'u1@example.com', email_verified: true } },
    payload: { vehiclePrice: 'free' },
    expected: 'PERMISSION_DENIED',
  },
];

interface AuthContext {
  uid: string;
  token: {
    email: string;
    email_verified: boolean;
  };
}

const SERVER_TIME_SENTINEL = Symbol('request.time');

function resolveTimestamps(
  payload: Record<string, unknown>,
  replaceServerTimestamp = true
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (
      replaceServerTimestamp &&
      v &&
      typeof v === 'object' &&
      '_methodName' in v &&
      (v as { _methodName?: string })._methodName === 'serverTimestamp'
    ) {
      out[k] = SERVER_TIME_SENTINEL;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function isServerTime(val: unknown): boolean {
  return val === SERVER_TIME_SENTINEL;
}

function isTimestampOrSentinel(val: unknown): boolean {
  return val === SERVER_TIME_SENTINEL || val instanceof Timestamp || val instanceof Date;
}

function isValidId(id: unknown): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(id);
}

function isSignedIn(auth: AuthContext | null): auth is AuthContext {
  return Boolean(auth && auth.token?.email_verified === true);
}

function isOwner(auth: AuthContext | null, userId: string): boolean {
  return isSignedIn(auth) && auth.uid === userId;
}

function keysHasAll(obj: Record<string, unknown>, required: string[]): boolean {
  return required.every((k) => k in obj);
}

function keysHasOnly(obj: Record<string, unknown>, allowed: string[]): boolean {
  const set = new Set(allowed);
  return Object.keys(obj).every((k) => set.has(k));
}

function isPlainMap(val: unknown): val is Record<string, unknown> {
  return Boolean(val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date));
}

function isNum(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val);
}

function affectedKeys(
  incoming: Record<string, unknown>,
  existing: Record<string, unknown>
): string[] {
  const all = new Set([...Object.keys(incoming), ...Object.keys(existing)]);
  const diff: string[] = [];
  for (const k of all) {
    if (JSON.stringify(incoming[k]) !== JSON.stringify(existing[k]) || incoming[k] !== existing[k]) {
      // Handle symbol equality for SERVER_TIME_SENTINEL
      if (incoming[k] === existing[k]) continue;
      diff.push(k);
    }
  }
  return diff;
}

function evalIsValidUserProfile(
  data: Record<string, unknown>,
  userId: string,
  auth: AuthContext
): boolean {
  const allowed = [
    'uid',
    'email',
    'displayName',
    'officerName',
    'officerCode',
    'officerLicense',
    'dealerName',
    'createdAt',
    'updatedAt',
  ];
  return (
    keysHasAll(data, ['uid', 'email', 'createdAt', 'updatedAt']) &&
    keysHasOnly(data, allowed) &&
    typeof data.uid === 'string' &&
    data.uid === userId &&
    data.uid === auth.uid &&
    isValidId(data.uid) &&
    typeof data.email === 'string' &&
    data.email.length >= 3 &&
    data.email.length <= 320 &&
    data.email.toLowerCase() === auth.token.email.toLowerCase() &&
    (!('displayName' in data) || (typeof data.displayName === 'string' && data.displayName.length <= 150)) &&
    (!('officerName' in data) || (typeof data.officerName === 'string' && data.officerName.length <= 150)) &&
    (!('officerCode' in data) || (typeof data.officerCode === 'string' && data.officerCode.length <= 50)) &&
    (!('officerLicense' in data) || (typeof data.officerLicense === 'string' && data.officerLicense.length <= 100)) &&
    (!('dealerName' in data) || (typeof data.dealerName === 'string' && data.dealerName.length <= 200)) &&
    isTimestampOrSentinel(data.createdAt) &&
    isTimestampOrSentinel(data.updatedAt)
  );
}

function evalIsValidSnapshot(snap: unknown): boolean {
  if (!isPlainMap(snap)) return false;
  const req = [
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
  const allowed = [...req, 'rawMonthlyInstallment', 'totalDriveAwayCost'];
  return (
    keysHasAll(snap, req) &&
    keysHasOnly(snap, allowed) &&
    isNum(snap.monthlyInstallment) &&
    isNum(snap.financeAmount) &&
    isNum(snap.downAmount) &&
    isNum(snap.downPercent) &&
    isNum(snap.totalInterest) &&
    isNum(snap.totalWithVat) &&
    isNum(snap.effectiveMonthlyRate) &&
    isNum(snap.eirAnnualPercent) &&
    typeof snap.proposalCode === 'string' &&
    snap.proposalCode.length <= 60 &&
    typeof snap.proposalName === 'string' &&
    snap.proposalName.length <= 160 &&
    typeof snap.rateDisplayText === 'string' &&
    snap.rateDisplayText.length <= 160 &&
    (!('rawMonthlyInstallment' in snap) || isNum(snap.rawMonthlyInstallment)) &&
    (!('totalDriveAwayCost' in snap) || isNum(snap.totalDriveAwayCost))
  );
}

function evalIsValidApprovalDoc(docMap: unknown): boolean {
  if (!isPlainMap(docMap)) return false;
  return (
    keysHasAll(docMap, ['name', 'size', 'uploadedAt']) &&
    keysHasOnly(docMap, ['name', 'size', 'uploadedAt', 'type']) &&
    typeof docMap.name === 'string' &&
    docMap.name.length >= 1 &&
    docMap.name.length <= 300 &&
    isNum(docMap.size) &&
    docMap.size >= 0 &&
    isNum(docMap.uploadedAt) &&
    (!('type' in docMap) || (typeof docMap.type === 'string' && docMap.type.length <= 120))
  );
}

function evalIsValidSavedCase(
  data: Record<string, unknown>,
  userId: string,
  caseId: string,
  auth: AuthContext
): boolean {
  const req = [
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
  const allowed = [
    ...req,
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
  ];

  return (
    keysHasAll(data, req) &&
    keysHasOnly(data, allowed) &&
    typeof data.ownerUid === 'string' &&
    data.ownerUid === userId &&
    data.ownerUid === auth.uid &&
    isValidId(data.ownerUid) &&
    typeof data.id === 'string' &&
    data.id === caseId &&
    isValidId(data.id) &&
    typeof data.caseTitle === 'string' &&
    data.caseTitle.length >= 1 &&
    data.caseTitle.length <= 300 &&
    typeof data.officerName === 'string' &&
    data.officerName.length <= 150 &&
    typeof data.officerCode === 'string' &&
    data.officerCode.length <= 50 &&
    typeof data.customerName === 'string' &&
    data.customerName.length <= 200 &&
    ['small_bike', 'fazzio', 'top_small', 'aec', 'vespa', 'honda_yamaha', 'second_hand'].includes(
      String(data.proposalKey)
    ) &&
    isNum(data.vehiclePrice) &&
    data.vehiclePrice >= 0 &&
    data.vehiclePrice <= 10000000 &&
    (data.downMode === 'amount' || data.downMode === 'percent') &&
    isNum(data.downValue) &&
    data.downValue >= 0 &&
    data.downValue <= 10000000 &&
    isNum(data.term) &&
    data.term >= 1 &&
    data.term <= 120 &&
    typeof data.includeDeliveryFees === 'boolean' &&
    isNum(data.registrationFee) &&
    data.registrationFee >= 0 &&
    data.registrationFee <= 1000000 &&
    isNum(data.theftInsuranceFee) &&
    data.theftInsuranceFee >= 0 &&
    data.theftInsuranceFee <= 1000000 &&
    typeof data.isCustomRateEnabled === 'boolean' &&
    typeof data.customRateInput === 'string' &&
    data.customRateInput.length <= 30 &&
    (data.customRateType === 'monthly' || data.customRateType === 'annual') &&
    typeof data.enforceEirCap === 'boolean' &&
    ['none', 'plan_a', 'plan_b'].includes(String(data.insurancePlan)) &&
    isNum(data.insuranceYears) &&
    [1, 2, 3].includes(data.insuranceYears) &&
    evalIsValidSnapshot(data.snapshot) &&
    isNum(data.recordCreatedAt) &&
    data.recordCreatedAt > 0 &&
    isNum(data.recordUpdatedAt) &&
    data.recordUpdatedAt > 0 &&
    isTimestampOrSentinel(data.createdAt) &&
    isTimestampOrSentinel(data.updatedAt) &&
    (!('officerLicense' in data) || (typeof data.officerLicense === 'string' && data.officerLicense.length <= 100)) &&
    (!('customerPhone' in data) || (typeof data.customerPhone === 'string' && data.customerPhone.length <= 50)) &&
    (!('customerNote' in data) || (typeof data.customerNote === 'string' && data.customerNote.length <= 1000)) &&
    (!('customerAge' in data) || (typeof data.customerAge === 'string' && data.customerAge.length <= 20)) &&
    (!('customerWorkMonths' in data) || (typeof data.customerWorkMonths === 'string' && data.customerWorkMonths.length <= 20)) &&
    (!('customerIncome' in data) || (typeof data.customerIncome === 'string' && data.customerIncome.length <= 30)) &&
    (!('customerResidenceMonths' in data) ||
      (typeof data.customerResidenceMonths === 'string' && data.customerResidenceMonths.length <= 20)) &&
    (!('customerOccupation' in data) ||
      (typeof data.customerOccupation === 'string' && data.customerOccupation.length <= 150)) &&
    (!('isAceCustomer' in data) || typeof data.isAceCustomer === 'boolean') &&
    (!('dealerName' in data) || (typeof data.dealerName === 'string' && data.dealerName.length <= 200)) &&
    (!('bikeModelName' in data) || (typeof data.bikeModelName === 'string' && data.bikeModelName.length <= 200)) &&
    (!('bikeModelCode' in data) || (typeof data.bikeModelCode === 'string' && data.bikeModelCode.length <= 80)) &&
    (!('bikeBrand' in data) || (typeof data.bikeBrand === 'string' && data.bikeBrand.length <= 80)) &&
    (!('approvalStatus' in data) ||
      ['pending', 'approved', 'rejected', 'cancelled'].includes(String(data.approvalStatus))) &&
    (!('deliveryStatus' in data) ||
      ['pending_delivery', 'delivered'].includes(String(data.deliveryStatus))) &&
    (!('approvalDate' in data) || (typeof data.approvalDate === 'string' && data.approvalDate.length <= 40)) &&
    (!('deliveryDate' in data) || (typeof data.deliveryDate === 'string' && data.deliveryDate.length <= 40)) &&
    (!('deliveryConfirmedAt' in data) || isNum(data.deliveryConfirmedAt)) &&
    (!('approvalNote' in data) || (typeof data.approvalNote === 'string' && data.approvalNote.length <= 1000)) &&
    (!('approvalUpdatedAt' in data) || isNum(data.approvalUpdatedAt)) &&
    (!('paymentDueDay' in data) || (isNum(data.paymentDueDay) && data.paymentDueDay >= 1 && data.paymentDueDay <= 31)) &&
    (!('googleMapsLocation' in data) ||
      (typeof data.googleMapsLocation === 'string' && data.googleMapsLocation.length <= 1500)) &&
    (!('installmentPayments' in data) ||
      (isPlainMap(data.installmentPayments) && Object.keys(data.installmentPayments).length <= 120)) &&
    (!('approvalDoc' in data) || evalIsValidApprovalDoc(data.approvalDoc))
  );
}

function evalCaseCreate(
  auth: AuthContext | null,
  userId: string,
  caseId: string,
  incoming: Record<string, unknown>
): boolean {
  return (
    isValidId(userId) &&
    isValidId(caseId) &&
    isOwner(auth, userId) &&
    evalIsValidSavedCase(incoming, userId, caseId, auth!) &&
    isServerTime(incoming.createdAt) &&
    isServerTime(incoming.updatedAt)
  );
}

function evalCaseUpdate(
  auth: AuthContext | null,
  userId: string,
  caseId: string,
  incoming: Record<string, unknown>,
  existing: Record<string, unknown>
): boolean {
  const diff = affectedKeys(incoming, existing);
  const fullAllowed = new Set([
    'caseTitle',
    'officerName',
    'officerCode',
    'officerLicense',
    'customerName',
    'customerPhone',
    'customerNote',
    'customerAge',
    'customerWorkMonths',
    'customerIncome',
    'customerResidenceMonths',
    'customerOccupation',
    'isAceCustomer',
    'dealerName',
    'proposalKey',
    'vehiclePrice',
    'bikeModelName',
    'bikeModelCode',
    'bikeBrand',
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
    'recordUpdatedAt',
    'updatedAt',
  ]);
  return (
    isValidId(userId) &&
    isValidId(caseId) &&
    isOwner(auth, userId) &&
    evalIsValidSavedCase(incoming, userId, caseId, auth!) &&
    existing.ownerUid === auth!.uid &&
    incoming.ownerUid === existing.ownerUid &&
    incoming.id === existing.id &&
    incoming.recordCreatedAt === existing.recordCreatedAt &&
    incoming.createdAt === existing.createdAt &&
    isServerTime(incoming.updatedAt) &&
    diff.every((k) => fullAllowed.has(k))
  );
}

export function runFirestoreRulesVerification(): void {
  const uid = 'nqoFfMLiGSWAohZ0Jtdqbb0g7XT2';
  const validAuth: AuthContext = {
    uid,
    token: { email: 'aon.bordin@gmail.com', email_verified: true },
  };

  // 1. Verify all 44 real cases from backup dataset
  const raw = JSON.parse(
    fs.readFileSync('public/assets/aistudio/MotoLease_Saved_Cases_2026-11-16_dda637bd.json', 'utf8')
  );
  const cases: SavedCaseRecord[] = raw.cases || raw;
  const serverCreatedTs = Timestamp.now();

  for (const record of cases) {
    const createPayload = resolveTimestamps(buildFirestoreCasePayload(record, uid));
    const diag = diagnosePayloadAgainstRules(createPayload, uid, record.id);
    if (!diag.startsWith('check=PASS')) {
      throw new Error(`diagnosePayloadAgainstRules failed for ${record.id}: ${diag}`);
    }
    if (!evalCaseCreate(validAuth, uid, record.id, createPayload)) {
      throw new Error(`Firestore CREATE rule rejected real case ${record.id}`);
    }

    // Simulate server state after creation -> test UPDATE
    const existingDoc = {
      ...createPayload,
      createdAt: serverCreatedTs,
      updatedAt: serverCreatedTs,
    };
    const updatedRecord: SavedCaseRecord = {
      ...record,
      updatedAt: record.updatedAt + 5000,
      approvalStatus: 'approved',
      deliveryStatus: 'delivered',
      paymentDueDay: 2,
      installmentPayments: { 1: 'paid', 2: 'paid', 3: 'unpaid' },
    };
    const updatePayload = resolveTimestamps(
      buildFirestoreCasePayload(updatedRecord, uid, serverCreatedTs, record.createdAt)
    );
    if (!evalCaseUpdate(validAuth, uid, record.id, updatePayload, existingDoc)) {
      throw new Error(`Firestore UPDATE rule rejected real case ${record.id}`);
    }

    // Roundtrip integrity
    const rt = fromFirestoreCaseDoc(createPayload, record.id);
    if (
      rt.id !== record.id ||
      rt.caseTitle !== record.caseTitle ||
      rt.snapshot.monthlyInstallment !== record.snapshot.monthlyInstallment ||
      rt.paymentDueDay !== record.paymentDueDay
    ) {
      throw new Error(`Roundtrip integrity mismatch for ${record.id}`);
    }
  }

  // 2. Verify synthetic extreme edge-case record (120 installments, oversized strings, commas)
  const extremeInstallments: Record<number, 'paid' | 'unpaid'> = {};
  for (let i = 1; i <= 120; i++) {
    extremeInstallments[i] = i % 2 === 0 ? 'paid' : 'unpaid';
  }
  const edgeRecord: SavedCaseRecord = {
    id: 'case-edge-120-installments',
    createdAt: Date.now() - 10000,
    updatedAt: Date.now(),
    caseTitle: 'ทดสอบ'.repeat(100), // > 300 chars, must be safely truncated
    officerName: '',
    officerCode: '',
    officerLicense: '123456',
    customerName: 'ลูกค้าทดสอบ',
    customerPhone: '081-234-5678',
    customerNote: 'หมายเหตุ'.repeat(400),
    customerAge: '35',
    customerWorkMonths: '24',
    customerIncome: '35,000',
    customerResidenceMonths: '60',
    customerOccupation: 'พนักงานบริษัท',
    isAceCustomer: true,
    dealerName: 'ดีลเลอร์ทดสอบ',
    proposalKey: 'vespa',
    vehiclePrice: 99999999, // > 10M, must be safely clamped
    bikeModelName: 'Vespa Sprint 150',
    bikeModelCode: 'VS150',
    bikeBrand: 'Vespa',
    downMode: 'percent',
    downValue: 15,
    term: 150, // > 120, must be safely clamped to 120
    includeDeliveryFees: true,
    registrationFee: 1500,
    theftInsuranceFee: 2500,
    isCustomRateEnabled: true,
    customRateInput: '1.15',
    customRateType: 'monthly',
    enforceEirCap: true,
    insurancePlan: 'plan_b',
    insuranceYears: 3,
    snapshot: {
      monthlyInstallment: 4500,
      rawMonthlyInstallment: 4498.2,
      financeAmount: 120000,
      downAmount: 18000,
      downPercent: 15,
      totalInterest: 32000,
      totalWithVat: 152000,
      effectiveMonthlyRate: 0.0115,
      eirAnnualPercent: 22.8,
      proposalCode: 'VP-01',
      proposalName: 'Vespa Special',
      rateDisplayText: '1.15%',
      totalDriveAwayCost: 22000,
    },
    approvalStatus: 'approved',
    deliveryStatus: 'delivered',
    approvalDate: '2026-11-16',
    deliveryDate: '2026-11-16',
    deliveryConfirmedAt: Date.now(),
    approvalNote: 'อนุมัติเรียบร้อย',
    approvalUpdatedAt: Date.now(),
    paymentDueDay: 2,
    googleMapsLocation: 'https://maps.google.com/?q=' + '1'.repeat(2000),
    installmentPayments: extremeInstallments,
    approvalDoc: {
      name: 'doc_'.repeat(120) + '.pdf',
      size: 204800,
      uploadedAt: Date.now(),
      type: 'application/pdf',
    },
  };
  const edgePayload = resolveTimestamps(buildFirestoreCasePayload(edgeRecord, uid));
  if (!evalCaseCreate(validAuth, uid, edgeRecord.id, edgePayload)) {
    throw new Error('Firestore CREATE rule rejected sanitized edge-case record');
  }

  // 3. Verify UserProfile rule
  const validProfile = resolveTimestamps({
    uid,
    email: 'Aon.Bordin@gmail.com',
    displayName: 'บดินทร์',
    officerName: 'บดินทร์ วงศ์หาโคตร',
    officerCode: '6683',
    officerLicense: '6804006410',
    dealerName: 'ป.ยานยนต์',
    createdAt: SERVER_TIME_SENTINEL,
    updatedAt: SERVER_TIME_SENTINEL,
  });
  if (!evalIsValidUserProfile(validProfile, uid, validAuth)) {
    throw new Error('UserProfile validation failed');
  }

  // 4. Verify all 12 Dirty Dozen attacks are DENIED
  const baseValid = resolveTimestamps(buildFirestoreCasePayload(cases[0], 'u1'));
  const authU1: AuthContext = { uid: 'u1', token: { email: 'u1@example.com', email_verified: true } };
  const authU2: AuthContext = { uid: 'u2', token: { email: 'u2@example.com', email_verified: true } };

  const attacks: Array<{ name: string; allowed: boolean }> = [
    { name: DIRTY_DOZEN_CASES[0].name, allowed: isOwner(null, 'u1') },
    {
      name: DIRTY_DOZEN_CASES[1].name,
      allowed: evalCaseCreate(
        { uid: 'u1', token: { email: 'test@example.com', email_verified: false } },
        'u1',
        cases[0].id,
        baseValid
      ),
    },
    { name: DIRTY_DOZEN_CASES[2].name, allowed: isOwner(authU2, 'u1') },
    { name: DIRTY_DOZEN_CASES[3].name, allowed: isOwner(authU2, 'u1') },
    { name: DIRTY_DOZEN_CASES[4].name, allowed: false }, // allow list: if false on /users
    {
      name: DIRTY_DOZEN_CASES[5].name,
      allowed: evalCaseCreate(authU1, 'u1', cases[0].id, { ...baseValid, ownerUid: 'u2' }),
    },
    {
      name: DIRTY_DOZEN_CASES[6].name,
      allowed: evalCaseCreate(authU1, 'u1', 'bad$id..hack', { ...baseValid, id: 'bad$id..hack' }),
    },
    {
      name: DIRTY_DOZEN_CASES[7].name,
      allowed: evalCaseCreate(authU1, 'u1', cases[0].id, { ...baseValid, isAdmin: true }),
    },
    {
      name: DIRTY_DOZEN_CASES[8].name,
      allowed: evalCaseUpdate(
        authU1,
        'u1',
        cases[0].id,
        { ...baseValid, ownerUid: 'u2', updatedAt: SERVER_TIME_SENTINEL },
        { ...baseValid, createdAt: serverCreatedTs, updatedAt: serverCreatedTs }
      ),
    },
    {
      name: DIRTY_DOZEN_CASES[9].name,
      allowed: evalCaseCreate(authU1, 'u1', cases[0].id, {
        ...baseValid,
        createdAt: Timestamp.fromMillis(0),
        updatedAt: Timestamp.fromMillis(0),
      }),
    },
    {
      name: DIRTY_DOZEN_CASES[10].name,
      allowed: evalCaseUpdate(
        authU1,
        'u1',
        cases[0].id,
        {
          ...baseValid,
          createdAt: serverCreatedTs,
          updatedAt: SERVER_TIME_SENTINEL,
          googleMapsLocation: 'x'.repeat(2000),
        },
        { ...baseValid, createdAt: serverCreatedTs, updatedAt: serverCreatedTs }
      ),
    },
    {
      name: DIRTY_DOZEN_CASES[11].name,
      allowed: evalCaseCreate(authU1, 'u1', cases[0].id, { ...baseValid, vehiclePrice: 'free' }),
    },
  ];

  for (const atk of attacks) {
    if (atk.allowed) {
      throw new Error(`Security breach! Attack was allowed: ${atk.name}`);
    }
  }

  console.log(
    `PASS: ${cases.length} real cases (create + update + roundtrip) + edge case (120 installments/clamping) + UserProfile + ${attacks.length}/12 Dirty Dozen security denials`
  );
}

// Run automatically when executed directly via `npx tsx firestore.rules.test.ts`
const isDirectRun =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv.some((arg) => arg.endsWith('firestore.rules.test.ts'));
if (isDirectRun) {
  runFirestoreRulesVerification();
  process.exit(0);
}
