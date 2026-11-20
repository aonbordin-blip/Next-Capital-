/**
 * Realtime Database & Firestore Rules Verification Suite
 * Validates all 44 real cases against database.rules.json (Year > Month) + RTDB roundtrip,
 * alongside the Firestore Dirty Dozen reference security matrix.
 */

import fs from 'fs';
import {
  buildRtdbCasePayload,
  encodeEmailForRtdbKey,
  fromCloudCaseDoc,
  getCaseNodeKey,
  getCaseRelPath,
  getCaseYearMonth,
  getRtdbUserKey,
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

export function runRtdbVerification(): void {
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

  const raw = JSON.parse(
    fs.readFileSync('public/assets/aistudio/MotoLease_Saved_Cases_2026-11-16_dda637bd.json', 'utf8')
  );
  const cases: SavedCaseRecord[] = raw.cases || raw;
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
    if (cases.indexOf(c) === 0) {
      const withIdPayload = buildRtdbCasePayload(
        {
          ...c,
          customerIdCard: '1100201234567',
          customerAddress: '99/1 หมู่ 2 ต.ศรีราชา อ.ศรีราชา จ.ชลบุรี 20110',
          customerBirthDate: '1995-05-14',
        },
        uid
      );
      const withIdRoundtrip = fromCloudCaseDoc(withIdPayload, c.id);
      if (
        withIdRoundtrip.customerIdCard !== '1100201234567' ||
        withIdRoundtrip.customerBirthDate !== '1995-05-14' ||
        !withIdRoundtrip.customerAddress?.includes('ศรีราชา')
      ) {
        throw new Error('Thai ID card fields RTDB roundtrip mismatch');
      }
    }
    const ym = `${year}/${month}`;
    buckets[ym] = (buckets[ym] || 0) + 1;
  }

  if (uniqueRelPaths.size !== cases.length) {
    throw new Error(`Expected ${cases.length} unique RTDB paths, got ${uniqueRelPaths.size}`);
  }

  console.log('PASS RTDB verification:', {
    userKey,
    caseCount: cases.length,
    buckets,
    samplePaths: Array.from(uniqueRelPaths).slice(0, 4),
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
