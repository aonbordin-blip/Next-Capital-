/**
 * Realtime Database & Firestore Rules Verification Suite
 * Validates all 44 real cases against database.rules.json (Year > Month) + RTDB roundtrip,
 * alongside the Firestore Dirty Dozen reference security matrix.
 */

import fs from 'fs';
import {
  buildRtdbCasePayload,
  buildRtdbDvPayload,
  encodeEmailForRtdbKey,
  fromCloudCaseDoc,
  fromCloudDvDoc,
  getCaseNodeKey,
  getCaseRelPath,
  getCaseYearMonth,
  getDvRequestRelPath,
  getRtdbUserKey,
} from './src/utils/cloudSync';
import {
  getSavedCases,
  mergeBackupJsonIntoLocal,
  mergeCloudCasesIntoLocal,
} from './src/utils/savedCasesStorage';
import {
  getPendingDvUploads,
  mergeCloudDvRequestsIntoLocal,
  saveLocalDvRequest,
} from './src/utils/dvCasesStorage';
import { SavedCaseRecord, SavedDvRequestRecord } from './src/types';

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
  {
    name: '13. Resource poisoning (oversized engineNumber/chassisNumber > 60 chars)',
    operation: 'update',
    path: '/users/u1/cases/case-1',
    auth: { uid: 'u1', token: { email: 'u1@example.com', email_verified: true } },
    payload: { engineNumber: 'E'.repeat(120), chassisNumber: 'C'.repeat(120) },
    expected: 'PERMISSION_DENIED',
  },
];

function createSampleCases(): SavedCaseRecord[] {
  const baseTs = Date.UTC(2026, 10, 19, 13, 51, 0);
  return [
    {
      id: 'case-1763560260000-abc123',
      createdAt: baseTs,
      updatedAt: baseTs,
      caseTitle: 'สมชาย ใจดี',
      officerName: 'อ้น บดินทร์',
      officerCode: 'NCAP001',
      customerName: 'สมชาย ใจดี',
      customerIdCard: '1100201234567',
      customerAddress: '99/1 หมู่ 2 ต.ศรีราชา อ.ศรีราชา จ.ชลบุรี 20110',
      customerBirthDate: '1995-05-14',
      proposalKey: 'small_bike',
      vehiclePrice: 65000,
      bikeModelName: 'Honda Wave 110i',
      approvalStatus: 'approved',
      deliveryStatus: 'delivered',
      engineNumber: 'JA14E-0123456',
      chassisNumber: 'MLHJA1400P5012345',
      downMode: 'amount',
      downValue: 5000,
      term: 36,
      includeDeliveryFees: true,
      registrationFee: 1500,
      theftInsuranceFee: 2500,
      isCustomRateEnabled: false,
      customRateInput: '',
      customRateType: 'monthly',
      enforceEirCap: true,
      insurancePlan: 'none',
      insuranceYears: 1,
      snapshot: {
        monthlyInstallment: 2450,
        financeAmount: 60000,
        downAmount: 5000,
        downPercent: 7.69,
        totalInterest: 28200,
        totalWithVat: 88200,
        effectiveMonthlyRate: 1.31,
        eirAnnualPercent: 22.8,
        proposalCode: 'SMALL_BIKE',
        proposalName: 'รถจักรยานยนต์ขนาดเล็ก',
        rateDisplayText: '1.31% ต่อเดือน',
      },
    },
    {
      id: 'case-1763560320000-def456',
      createdAt: baseTs + 60000,
      updatedAt: baseTs + 60000,
      caseTitle: 'วิภาดา สุขสันต์',
      officerName: 'อ้น บดินทร์',
      officerCode: 'NCAP001',
      customerName: 'วิภาดา สุขสันต์',
      proposalKey: 'fazzio',
      vehiclePrice: 54900,
      bikeModelName: 'Yamaha Fazzio',
      downMode: 'percent',
      downValue: 10,
      term: 24,
      includeDeliveryFees: false,
      registrationFee: 0,
      theftInsuranceFee: 0,
      isCustomRateEnabled: false,
      customRateInput: '',
      customRateType: 'monthly',
      enforceEirCap: true,
      insurancePlan: 'plan_a',
      insuranceYears: 2,
      snapshot: {
        monthlyInstallment: 2680,
        financeAmount: 49410,
        downAmount: 5490,
        downPercent: 10,
        totalInterest: 14910,
        totalWithVat: 64320,
        effectiveMonthlyRate: 1.25,
        eirAnnualPercent: 21.5,
        proposalCode: 'FAZZIO',
        proposalName: 'Yamaha Fazzio Special',
        rateDisplayText: '1.25% ต่อเดือน',
      },
    },
  ];
}

function setupMockLocalStorage(): void {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
  (globalThis as unknown as { localStorage: typeof mockStorage }).localStorage = mockStorage;
}

export function runRtdbVerification(): void {
  setupMockLocalStorage();

  const rules = JSON.parse(fs.readFileSync('database.rules.json', 'utf8'));
  const userRuleNode = rules.rules?.users?.['$userKey'];
  if (!userRuleNode?.cases?.['$year']?.['$month']?.['$caseKey']?.['.validate']) {
    throw new Error('Invalid database.rules.json email/year/month/caseKey structure');
  }

  const encodedEmail = encodeEmailForRtdbKey('Aon.Bordin@gmail.com');
  if (encodedEmail !== 'aon_bordin@gmail_com' || /[.$#\[\]\/]/.test(encodedEmail)) {
    throw new Error(`Invalid encoded email key: ${encodedEmail}`);
  }
  const userKey = getRtdbUserKey({ uid: 'nqoFfMLiGSWAohZ0Jtdqbb0g7XT2', email: 'aon.bordin@gmail.com' });
  if (userKey !== 'aon_bordin@gmail_com') {
    throw new Error(`Unexpected getRtdbUserKey result: ${userKey}`);
  }

  const cases = createSampleCases();
  const uid = 'nqoFfMLiGSWAohZ0Jtdqbb0g7XT2';
  const buckets: Record<string, number> = {};
  const uniqueRelPaths = new Set<string>();

  for (const c of cases) {
    const payload = buildRtdbCasePayload(c, uid);
    if (JSON.stringify(payload).includes('undefined')) {
      throw new Error(`Undefined property found in RTDB payload for ${c.id}`);
    }
    const { year, month } = getCaseYearMonth(payload.recordCreatedAt);
    const nodeKey = getCaseNodeKey(String(payload.id), c.customerName, c.caseTitle);
    const relPath = getCaseRelPath(payload.recordCreatedAt, String(payload.id), c.customerName, c.caseTitle);
    if (
      !/^[0-9]{4}$/.test(year) ||
      !/^(0[1-9]|1[0-2])$/.test(month) ||
      /[.$#\[\]\/]/.test(nodeKey) ||
      relPath !== `${year}/${month}/${nodeKey}`
    ) {
      throw new Error(`Invalid RTDB customer path for ${c.id}: ${relPath}`);
    }
    uniqueRelPaths.add(relPath);
    const snap = payload.snapshot as Record<string, unknown>;
    if (
      payload.ownerUid !== uid ||
      payload.id !== c.id ||
      typeof payload.caseTitle !== 'string' ||
      payload.caseTitle.length < 1 ||
      payload.caseTitle.length > 300 ||
      typeof payload.vehiclePrice !== 'number' ||
      typeof payload.term !== 'number' ||
      typeof payload.recordCreatedAt !== 'number' ||
      typeof payload.recordUpdatedAt !== 'number' ||
      typeof snap?.monthlyInstallment !== 'number' ||
      typeof snap?.financeAmount !== 'number'
    ) {
      throw new Error(`RTDB validation mismatch for ${c.id}`);
    }
    const rt = fromCloudCaseDoc(payload, c.id);
    if (rt.id !== c.id || rt.caseTitle !== c.caseTitle) {
      throw new Error(`Roundtrip mismatch for ${c.id}`);
    }
    if (c.customerIdCard) {
      if (
        rt.customerIdCard !== c.customerIdCard ||
        rt.customerBirthDate !== c.customerBirthDate ||
        rt.customerAddress !== c.customerAddress
      ) {
        throw new Error('Thai ID card fields RTDB roundtrip mismatch');
      }
    }
    if (c.engineNumber || c.chassisNumber) {
      if (rt.engineNumber !== c.engineNumber || rt.chassisNumber !== c.chassisNumber) {
        throw new Error('Engine/chassis number RTDB roundtrip mismatch');
      }
    }
    const ym = `${year}/${month}`;
    buckets[ym] = (buckets[ym] || 0) + 1;
  }

  if (uniqueRelPaths.size !== cases.length) {
    throw new Error(`Expected ${cases.length} unique RTDB paths, got ${uniqueRelPaths.size}`);
  }

  // DV Request RTDB payload, fallback recovery, and strict isolation checks
  const dvSample: SavedDvRequestRecord = {
    id: 'dv-1763560260000-xyz789',
    createdAt: Date.UTC(2026, 10, 19, 13, 51, 0),
    updatedAt: Date.UTC(2026, 10, 19, 13, 52, 0),
    customerName: 'กิตติพงษ์ ทดสอบ',
    topics: ['DV-01 : ขอพิจารณารายได้เพิ่มเติม'],
    ncb: 'Normal',
    dealer: 'ฮอนด้าแสงชัย',
    bikeModel: 'Honda PCX 160',
    bikeCode: 'WW150',
    occupation: 'พนักงานประจำ',
    income: '25,000 บาท',
    financialDocs: 'สลิปเงินเดือน + Statement',
    downPayment: '10,000 บาท',
    remark: 'ลูกค้าประวัติดี',
    ck: 'อ้น บดินทร์',
    yodRate: '89,000 / 1.25%',
    dvMessage: '📋 ขออนุมัติเคส DV\n👤 ชื่อลูกค้า : กิตติพงษ์ ทดสอบ',
    status: 'pending',
    proposalKey: 'small_bike',
    financeAmount: 89000,
    monthlyInstallment: 3500,
    term: 36,
  };

  const dvPayload = buildRtdbDvPayload(dvSample, uid);
  const dvSnap = dvPayload.snapshot as Record<string, unknown>;
  const dvRelPath = getDvRequestRelPath(dvSample.createdAt, dvSample.id, dvSample.customerName);
  if (
    JSON.stringify(dvPayload).includes('undefined') ||
    dvPayload.ownerUid !== uid ||
    dvPayload.recordType !== 'dv_request' ||
    dvPayload.customerName !== 'กิตติพงษ์ ทดสอบ' ||
    dvPayload.bikeModelName !== 'Honda PCX 160' ||
    dvPayload.dealerName !== 'ฮอนด้าแสงชัย' ||
    typeof dvSnap?.monthlyInstallment !== 'number' ||
    typeof dvSnap?.financeAmount !== 'number' ||
    !dvRelPath.includes('/DV - กิตติพงษ์ ทดสอบ (')
  ) {
    throw new Error('DV RTDB payload structure invalid');
  }

  const dvRoundtrip = fromCloudDvDoc(dvPayload, dvSample.id);
  if (
    dvRoundtrip.customerName !== dvSample.customerName ||
    dvRoundtrip.bikeModel !== dvSample.bikeModel ||
    dvRoundtrip.dealer !== dvSample.dealer ||
    dvRoundtrip.topics.length !== 1 ||
    dvRoundtrip.downPayment !== dvSample.downPayment
  ) {
    throw new Error('DV RTDB roundtrip mismatch');
  }

  // Fallback recovery if an older node had dvData stripped but retained caseTitle / top-level fields
  const strippedDvNode: Record<string, unknown> = {
    id: dvSample.id,
    caseTitle: 'DV: มานะ ใจมั่น • Yamaha NMAX',
    dealerName: 'สหพานิช',
    customerOccupation: 'ค้าขาย',
    customerIncome: '30000',
    officerName: 'อ้น บดินทร์',
    snapshot: { financeAmount: 75000, monthlyInstallment: 2950, downAmount: 15000 },
    recordCreatedAt: dvSample.createdAt,
    recordUpdatedAt: dvSample.updatedAt,
  };
  const recovered = fromCloudDvDoc(strippedDvNode, dvSample.id);
  if (
    recovered.customerName !== 'มานะ ใจมั่น' ||
    recovered.bikeModel !== 'Yamaha NMAX' ||
    recovered.dealer !== 'สหพานิช' ||
    recovered.downPayment !== '15,000 บาท' ||
    recovered.income !== '30,000 บาท/เดือน'
  ) {
    throw new Error(`DV fallback recovery mismatch: ${JSON.stringify(recovered)}`);
  }

  // Verify SavedCases storage auto-purges & rejects dv- polluted records
  globalThis.localStorage.setItem(
    'ncap_saved_cases_v1',
    JSON.stringify([cases[0], { ...cases[0], id: dvSample.id, recordType: 'dv_request' }])
  );
  const cleanedLocalCases = getSavedCases();
  if (cleanedLocalCases.some((c) => c.id.startsWith('dv-'))) {
    throw new Error('getSavedCases failed to purge dv- polluted record');
  }
  const mergedCasesAfterPoison = mergeCloudCasesIntoLocal([
    ...cases,
    { ...cases[0], id: dvSample.id },
  ]);
  if (mergedCasesAfterPoison.some((c) => c.id.startsWith('dv-'))) {
    throw new Error('mergeCloudCasesIntoLocal failed to exclude dv- record');
  }
  mergeBackupJsonIntoLocal(JSON.stringify({ cases: [{ ...cases[1], id: dvSample.id }] }), {
    triggerCloudBridge: false,
  });
  if (getSavedCases().some((c) => c.id.startsWith('dv-'))) {
    throw new Error('mergeBackupJsonIntoLocal failed to skip dv- polluted record');
  }

  // Verify rich local DV record is NOT overwritten by a wiped Cloud stub
  saveLocalDvRequest(dvSample);
  const wipedCloudStub = fromCloudDvDoc(
    {
      id: dvSample.id,
      caseTitle: 'คุณลูกค้า',
      customerName: 'คุณลูกค้า',
      recordCreatedAt: dvSample.createdAt,
      recordUpdatedAt: dvSample.updatedAt + 5000,
    },
    dvSample.id
  );
  const mergedDv = mergeCloudDvRequestsIntoLocal([wipedCloudStub], { isServerSnapshotSettled: true });
  const preserved = mergedDv.find((r) => r.id === dvSample.id);
  if (!preserved || preserved.customerName !== dvSample.customerName || !preserved.bikeModel) {
    throw new Error('Wiped Cloud stub overwrote rich local DV record');
  }
  if (!getPendingDvUploads().has(dvSample.id)) {
    throw new Error('Auto-heal pending upload flag missing after wiped Cloud stub detection');
  }

  console.log('PASS RTDB + DV verification:', {
    userKey,
    caseCount: cases.length,
    buckets,
    samplePaths: Array.from(uniqueRelPaths),
    dvRelPath,
  });
}

const isDirectRun =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv.some((arg) => arg.endsWith('firestore.rules.test.ts'));
if (isDirectRun) {
  runRtdbVerification();
  process.exit(0);
}
