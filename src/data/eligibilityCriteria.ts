import { ProposalKey } from '../types';

export type EligibilityTierKey = 'small_bike' | 'top_small' | 'medium_bike';

export interface EligibilityTierSpec {
  key: EligibilityTierKey;
  title: string;
  shortTitle: string;
  subtitle: string;
  salesChannel: 'TRD' | 'MD2';
  minWorkMonths: number;
  workMonthsLabel: string;
  minIncome: number;
  incomeLabel: string;
  minAge: number;
  maxAge: number;
  ageLabel: string;
  minResidenceMonths: number;
  residenceLabel: string;
}

export const ELIGIBILITY_TIERS: Record<EligibilityTierKey, EligibilityTierSpec> = {
  small_bike: {
    key: 'small_bike',
    title: 'Small Bike (ไม่เกิน 125 CC ยกเว้น Lead)',
    shortTitle: 'Small Bike (≤ 125 CC ยกเว้น Lead)',
    subtitle: 'รถครอบครัว / สกู๊ตเตอร์ไม่เกิน 125 CC (ยกเว้นรุ่น Lead)',
    salesChannel: 'TRD',
    minWorkMonths: 4,
    workMonthsLabel: '4 เดือน',
    minIncome: 9000,
    incomeLabel: '9,000',
    minAge: 18,
    maxAge: 65,
    ageLabel: '18-65',
    minResidenceMonths: 4,
    residenceLabel: '4 เดือน',
  },
  top_small: {
    key: 'top_small',
    title: 'Top Small Bike 150 CC (+ Lead)',
    shortTitle: 'Top Small 150 CC (+ Lead)',
    subtitle: 'รถกลุ่ม 150-160 CC และ Honda Lead ทุกรุ่น',
    salesChannel: 'TRD',
    minWorkMonths: 6,
    workMonthsLabel: '6 เดือน',
    minIncome: 12000,
    incomeLabel: '12,000',
    minAge: 21,
    maxAge: 65,
    ageLabel: '21-65',
    minResidenceMonths: 6,
    residenceLabel: '6 เดือน',
  },
  medium_bike: {
    key: 'medium_bike',
    title: 'Medium Bike (250-399 CC)',
    shortTitle: 'Medium Bike (250-399 CC)',
    subtitle: 'บิ๊กสกู๊ตเตอร์ / สปอร์ตขนาดกลาง 250-399 CC',
    salesChannel: 'MD2',
    minWorkMonths: 6,
    workMonthsLabel: '6 เดือน',
    minIncome: 15000,
    incomeLabel: '15,000',
    minAge: 23,
    maxAge: 65,
    ageLabel: '23-65',
    minResidenceMonths: 6,
    residenceLabel: '6 เดือน',
  },
};

export const ELIGIBILITY_TIER_ORDER: EligibilityTierKey[] = [
  'small_bike',
  'top_small',
  'medium_bike',
];

export const ACE_FULL_NOTE =
  'ACE ให้ใช้เขียน NCB / ห้ามขาย PA / ใช้เงื่อนไขเดียวกับคนไทยแต่ขอ 10% ขึ้น / ให้แค่ไม่เกิน 150CC';

export const ACE_RULE_ITEMS = [
  'ให้ใช้เขียน NCB',
  'ห้ามขาย PA',
  'ใช้เงื่อนไขเดียวกับคนไทย แต่ขอเงินดาวน์ 10% ขึ้น',
  'ให้แค่ไม่เกิน 150 CC',
] as const;

/**
 * หาว่า Proposal / รุ่นรถที่เลือก ตรงกับเกณฑ์กลุ่มใดตามตาราง:
 * - รุ่น Lead (เช่น LEAD125 / NHX125) จัดเข้ากลุ่ม Top Small Bike 150 CC (+ Lead)
 * - กลุ่ม 250-399 CC (เช่น honda_yamaha, Forza, XMAX, ADV350, X300) จัดเข้า Medium Bike (250-399 CC)
 * - กลุ่ม 150-160 CC (top_small, vespa, PCX, NMAX, ADV160, CLICK160, AEROX) จัดเข้า Top Small Bike 150 CC (+ Lead)
 * - กลุ่มไม่เกิน 125 CC ยกเว้น Lead จัดเข้า Small Bike
 */
export function resolveEligibilityTierKey(
  proposalKey?: ProposalKey,
  bikeModelName?: string,
  bikeModelCode?: string
): EligibilityTierKey {
  const combined = `${bikeModelName || ''} ${bikeModelCode || ''}`.toUpperCase();

  // Medium Bike (250-399 CC)
  if (
    proposalKey === 'honda_yamaha' ||
    /\b(250|300|350|399)\b|FORZA|XMAX|ADV\s*350|NSS350|X300|CBR300/.test(combined)
  ) {
    // หมายเหตุ: PG-1 / XSR155 / MT-15 / EXCITER 155 / WR155 / CBR150 อยู่ใน honda_yamaha หรือ 150cc
    if (/(150|155|PG-?1)/.test(combined) && !/(250|300|350|399)/.test(combined)) {
      return 'top_small';
    }
    return 'medium_bike';
  }

  // Lead 125 (+ Lead) & 150-160 CC -> Top Small Bike 150 CC (+ Lead)
  if (
    proposalKey === 'top_small' ||
    proposalKey === 'vespa' ||
    /LEAD|NHX125|PCX|NMAX|AEROX|ADV\s*160|CLICK\s*160|ACB160|WW160|VESPA|LAMBRETTA|GRAND\s*FILANO/.test(
      combined
    )
  ) {
    return 'top_small';
  }

  return 'small_bike';
}

export interface FailedDvCriterion {
  code: 'A1' | 'A2' | 'A4' | 'A6';
  dvTopic: string;
  fieldLabel: string;
  detail: string;
}

export interface CustomerEligibilityInput {
  age?: string;
  workMonths?: string;
  income?: string;
  residenceMonths?: string;
  occupation?: string;
  isAce?: boolean;
}

export interface CustomerEligibilityResult {
  tier: EligibilityTierSpec;
  hasAnyInput: boolean;
  checkedCount: number;
  passedCount: number;
  failedTopics: FailedDvCriterion[];
  fieldStatus: {
    age: 'empty' | 'pass' | 'fail';
    workMonths: 'empty' | 'pass' | 'fail';
    income: 'empty' | 'pass' | 'fail';
    residenceMonths: 'empty' | 'pass' | 'fail';
  };
  aceWarnings: string[];
  allCheckedPassed: boolean;
}

function parsePositiveNumber(raw?: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, '').trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) && num >= 0 ? num : null;
}

export function evaluateCustomerEligibility(
  tierKey: EligibilityTierKey,
  input: CustomerEligibilityInput,
  options?: {
    downPercent?: number;
    hasPaInsurance?: boolean;
    proposalKey?: ProposalKey;
  }
): CustomerEligibilityResult {
  const tier = ELIGIBILITY_TIERS[tierKey];
  const ageVal = parsePositiveNumber(input.age);
  const workVal = parsePositiveNumber(input.workMonths);
  const incomeVal = parsePositiveNumber(input.income);
  const residenceVal = parsePositiveNumber(input.residenceMonths);

  const failedTopics: FailedDvCriterion[] = [];
  let checkedCount = 0;
  let passedCount = 0;

  // 1. อายุ -> A1 : อายุตัว
  let ageStatus: 'empty' | 'pass' | 'fail' = 'empty';
  if (ageVal !== null) {
    checkedCount += 1;
    if (ageVal < tier.minAge || ageVal > tier.maxAge) {
      ageStatus = 'fail';
      failedTopics.push({
        code: 'A1',
        dvTopic: 'A1 : อายุตัว',
        fieldLabel: 'อายุ',
        detail: `อายุ ${ageVal} ปี (เกณฑ์ ${tier.ageLabel} ปี)`,
      });
    } else {
      ageStatus = 'pass';
      passedCount += 1;
    }
  }

  // 2. อายุงาน -> A2 : อายุงานไม่ผ่าน
  let workStatus: 'empty' | 'pass' | 'fail' = 'empty';
  if (workVal !== null) {
    checkedCount += 1;
    if (workVal < tier.minWorkMonths) {
      workStatus = 'fail';
      failedTopics.push({
        code: 'A2',
        dvTopic: 'A2 : อายุงานไม่ผ่าน',
        fieldLabel: 'อายุงาน',
        detail: `อายุงาน ${workVal} เดือน (เกณฑ์ ≥ ${tier.workMonthsLabel})`,
      });
    } else {
      workStatus = 'pass';
      passedCount += 1;
    }
  }

  // 3. รายได้ -> A4 : รายได้ไม่ผ่าน
  let incomeStatus: 'empty' | 'pass' | 'fail' = 'empty';
  if (incomeVal !== null) {
    checkedCount += 1;
    if (incomeVal < tier.minIncome) {
      incomeStatus = 'fail';
      failedTopics.push({
        code: 'A4',
        dvTopic: 'A4 : รายได้ไม่ผ่าน',
        fieldLabel: 'รายได้',
        detail: `รายได้ ${incomeVal.toLocaleString('th-TH')} บ. (เกณฑ์ ≥ ${tier.incomeLabel} บ.)`,
      });
    } else {
      incomeStatus = 'pass';
      passedCount += 1;
    }
  }

  // 4. ระยะเวลาพักอาศัย -> A6 : ระยะเวลาพักอาศัยไม่ผ่าน
  let residenceStatus: 'empty' | 'pass' | 'fail' = 'empty';
  if (residenceVal !== null) {
    checkedCount += 1;
    if (residenceVal < tier.minResidenceMonths) {
      residenceStatus = 'fail';
      failedTopics.push({
        code: 'A6',
        dvTopic: 'A6 : ระยะเวลาพักอาศัยไม่ผ่าน',
        fieldLabel: 'พักอาศัย',
        detail: `พักอาศัย ${residenceVal} เดือน (เกณฑ์ ≥ ${tier.residenceLabel})`,
      });
    } else {
      residenceStatus = 'pass';
      passedCount += 1;
    }
  }

  // ACE Special Warnings
  const isAceActive = Boolean(input.isAce) || options?.proposalKey === 'aec';
  const aceWarnings: string[] = [];
  if (isAceActive) {
    if (options?.hasPaInsurance) {
      aceWarnings.push('ACE ห้ามขาย PA (กรุณาเลือก "ไม่รับประกัน")');
    }
    if (typeof options?.downPercent === 'number' && options.downPercent < 10) {
      aceWarnings.push(`ACE ต้องขอเงินดาวน์ 10% ขึ้นไป (ปัจจุบัน ${options.downPercent.toFixed(1)}%)`);
    }
    if (tierKey === 'medium_bike') {
      aceWarnings.push('ACE ให้สินเชื่อได้แค่รถไม่เกิน 150 CC เท่านั้น');
    }
  }

  return {
    tier,
    hasAnyInput:
      checkedCount > 0 || Boolean(input.occupation?.trim()) || Boolean(input.isAce),
    checkedCount,
    passedCount,
    failedTopics,
    fieldStatus: {
      age: ageStatus,
      workMonths: workStatus,
      income: incomeStatus,
      residenceMonths: residenceStatus,
    },
    aceWarnings,
    allCheckedPassed: checkedCount > 0 && failedTopics.length === 0 && aceWarnings.length === 0,
  };
}
