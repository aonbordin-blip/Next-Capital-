import { SavedCaseRecord, InsurancePlan, InsuranceYears } from '../types';

export type CheckerTier = 1 | 2 | 3;

export interface CommissionPlanRate {
  1: number; // 1 ปี
  2: number; // 2 ปี
  3: number; // 3 ปี
}

export interface CheckerTierRule {
  tier: CheckerTier;
  label: string;
  minPercent: number; // inclusive
  maxPercent: number; // inclusive
  rates: {
    pa: CommissionPlanRate;
    pa_plus: CommissionPlanRate;
  };
}

/**
 * เกณฑ์การคำนวณและการจ่ายค่าแนะนำสำหรับ Checker (ตามประกาศทางการ)
 * Target Achievement % สำหรับ Checker = (จำนวนสัญญาที่ลูกค้าตกลงซื้อความคุ้มครองเพิ่มเติม (PA + PA Plus) ภายใต้รหัส Checker)
 *                                      ÷ (จำนวนสัญญาทั้งหมดของสาขา/Checker ที่เข้าเงื่อนไข [อนุมัติและรับรถแล้ว]) x 100
 */
export const CHECKER_TIER_RULES: Record<CheckerTier, CheckerTierRule> = {
  1: {
    tier: 1,
    label: 'Tier 1 (≤ 60.00%)',
    minPercent: 0,
    maxPercent: 60.0,
    rates: {
      pa: {
        1: 50,
        2: 75,
        3: 100,
      },
      pa_plus: {
        1: 70,
        2: 125,
        3: 180,
      },
    },
  },
  2: {
    tier: 2,
    label: 'Tier 2 (60.01% - 75.00%)',
    minPercent: 60.01,
    maxPercent: 75.0,
    rates: {
      pa: {
        1: 70,
        2: 150,
        3: 250,
      },
      pa_plus: {
        1: 120,
        2: 250,
        3: 400,
      },
    },
  },
  3: {
    tier: 3,
    label: 'Tier 3 (≥ 75.01%)',
    minPercent: 75.01,
    maxPercent: 1000, // over 75.01%
    rates: {
      pa: {
        1: 90,
        2: 200,
        3: 350,
      },
      pa_plus: {
        1: 170,
        2: 350,
        3: 550,
      },
    },
  },
};

export interface CaseCommissionDetail {
  record: SavedCaseRecord;
  isInsured: boolean;
  planType: 'pa' | 'pa_plus' | 'none';
  planName: string;
  insuranceYears: InsuranceYears;
  unitRate: number; // บาท / กรมธรรม์
  commissionAmount: number; // ยอดค่าแนะนำที่ได้รับ (บาท)
}

export interface CheckerCommissionSummary {
  // สรุปยอดสัญญา
  totalDeliveredContracts: number; // สัญญาทั้งหมดที่อนุมัติและรับรถแล้ว
  totalInsuredContracts: number; // จำนวนสัญญาที่ซื้อประกัน (PA + PA Plus)
  totalNoInsuranceContracts: number; // จำนวนสัญญาที่ไม่ซื้อประกัน
  
  // สรุปแยกรายแผน
  paCount: number; // รวม PA ปกติ
  paPlusCount: number; // รวม PA PLUS
  
  // สรุปแยกรายแผนและระยะเวลา
  breakdown: {
    pa: Record<InsuranceYears, { count: number; unitRate: number; total: number }>;
    pa_plus: Record<InsuranceYears, { count: number; unitRate: number; total: number }>;
    none: { count: number; unitRate: number; total: number };
  };

  // Target Achievement & Tier
  achievementPercent: number; // e.g. 78.50%
  tier: CheckerTier;
  tierRule: CheckerTierRule;
  
  // รวมค่าคอมมิชชั่นที่จะได้รับ
  totalCommissionBaht: number;

  // เป้าหมายเพื่อเลื่อน Tier
  nextTierNeeded?: {
    nextTier: CheckerTier;
    targetPercent: number;
    additionalInsuredNeeded: number; // ต้องขายเพิ่มอีกกี่คันภายใต้จำนวนส่งมอบปัจจุบัน
    potentialCommissionIncrease: number; // ยอดเงินที่จะได้เพิ่มขึ้นหากขยับ Tier
  };

  // รายการเคสที่นำมาคำนวณ
  cases: CaseCommissionDetail[];
}

/**
 * ดึงประเภทแผนประกันที่ใช้คำนวณ
 */
export function getInsurancePlanCategory(plan?: InsurancePlan): 'pa' | 'pa_plus' | 'none' {
  if (plan === 'plan_a') return 'pa';
  if (plan === 'plan_b') return 'pa_plus';
  return 'none';
}

/**
 * คำนวณ Tier จาก % Achievement
 */
export function determineCheckerTier(percent: number): CheckerTier {
  if (percent >= 75.01) return 3;
  if (percent > 60.0) return 2;
  return 1;
}

/**
 * ตรวจสอบว่าเคสเข้าเงื่อนไข "อนุมัติและรับรถแล้ว" หรือไม่
 */
export function isDeliveredAndApprovedCase(record: SavedCaseRecord): boolean {
  return record.approvalStatus === 'approved' && record.deliveryStatus === 'delivered';
}

/**
 * ดึงวันที่สำหรับจัดกลุ่มเดือนของเคส (ใช้วันที่รับรถ deliveryDate ถ้ามี, มิฉะนั้น approvalDate หรือ createdAt)
 */
export function getCaseEffectiveDate(record: SavedCaseRecord): string {
  if (record.deliveryDate && /^\d{4}-\d{2}-\d{2}$/.test(record.deliveryDate)) {
    return record.deliveryDate;
  }
  if (record.approvalDate && /^\d{4}-\d{2}-\d{2}$/.test(record.approvalDate)) {
    return record.approvalDate;
  }
  const d = new Date(record.createdAt || Date.now());
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * คำนวณค่าคอมมิชชั่น Checker จากรายการเคสที่บันทึกไว้
 */
export function calculateCheckerCommission(
  savedCases: SavedCaseRecord[],
  filterYearMonth?: string // รูปแบบ 'YYYY-MM' หรือ undefined เพื่อดูทั้งหมด
): CheckerCommissionSummary {
  // 1. คัดกรองเฉพาะเคสที่ "อนุมัติและรับรถแล้ว"
  let eligibleCases = savedCases.filter(isDeliveredAndApprovedCase);

  // 2. คัดกรองตามเดือน/ปี หากระบุ
  if (filterYearMonth && filterYearMonth !== 'all') {
    eligibleCases = eligibleCases.filter((c) => {
      const dateStr = getCaseEffectiveDate(c);
      return dateStr.startsWith(filterYearMonth);
    });
  }

  const totalDeliveredContracts = eligibleCases.length;

  // 3. นับจำนวนสัญญาที่ซื้อประกัน (PA + PA PLUS)
  let paCount = 0;
  let paPlusCount = 0;
  let totalNoInsuranceContracts = 0;

  eligibleCases.forEach((c) => {
    const category = getInsurancePlanCategory(c.insurancePlan);
    if (category === 'pa') {
      paCount += 1;
    } else if (category === 'pa_plus') {
      paPlusCount += 1;
    } else {
      totalNoInsuranceContracts += 1;
    }
  });

  const totalInsuredContracts = paCount + paPlusCount;

  // 4. คำนวณ Target Achievement %
  const rawPercent =
    totalDeliveredContracts > 0
      ? (totalInsuredContracts / totalDeliveredContracts) * 100
      : 0;
  // ปัดเศษทศนิยม 2 ตำแหน่ง
  const achievementPercent = Math.round(rawPercent * 100) / 100;

  // 5. ตัดสิน Tier (1, 2, 3)
  const tier = determineCheckerTier(achievementPercent);
  const tierRule = CHECKER_TIER_RULES[tier];

  // 6. คำนวณค่าคอมมิชชั่นรายเคสและรวมยอด
  const breakdown: CheckerCommissionSummary['breakdown'] = {
    pa: {
      1: { count: 0, unitRate: tierRule.rates.pa[1], total: 0 },
      2: { count: 0, unitRate: tierRule.rates.pa[2], total: 0 },
      3: { count: 0, unitRate: tierRule.rates.pa[3], total: 0 },
    },
    pa_plus: {
      1: { count: 0, unitRate: tierRule.rates.pa_plus[1], total: 0 },
      2: { count: 0, unitRate: tierRule.rates.pa_plus[2], total: 0 },
      3: { count: 0, unitRate: tierRule.rates.pa_plus[3], total: 0 },
    },
    none: {
      count: 0,
      unitRate: 0,
      total: 0,
    },
  };

  let totalCommissionBaht = 0;

  const caseDetails: CaseCommissionDetail[] = eligibleCases.map((record) => {
    const category = getInsurancePlanCategory(record.insurancePlan);
    const years: InsuranceYears = record.insuranceYears && [1, 2, 3].includes(record.insuranceYears)
      ? record.insuranceYears
      : 1;

    let unitRate = 0;
    let planName = 'ไม่ทำประกัน PA';
    let isInsured = false;

    if (category === 'pa') {
      isInsured = true;
      unitRate = tierRule.rates.pa[years];
      planName = `แผน A (PA ปกติ ${years} ปี)`;
      breakdown.pa[years].count += 1;
      breakdown.pa[years].total += unitRate;
    } else if (category === 'pa_plus') {
      isInsured = true;
      unitRate = tierRule.rates.pa_plus[years];
      planName = `แผน B (PA PLUS ${years} ปี)`;
      breakdown.pa_plus[years].count += 1;
      breakdown.pa_plus[years].total += unitRate;
    } else {
      isInsured = false;
      unitRate = 0;
      planName = 'ไม่รับความคุ้มครอง';
      breakdown.none.count += 1;
    }

    totalCommissionBaht += unitRate;

    return {
      record,
      isInsured,
      planType: category,
      planName,
      insuranceYears: years,
      unitRate,
      commissionAmount: unitRate,
    };
  });

  // 7. คำนวณโอกาสเลื่อน Tier ถัดไป (Next Tier Target)
  let nextTierNeeded: CheckerCommissionSummary['nextTierNeeded'] | undefined = undefined;

  if (tier < 3 && totalDeliveredContracts > 0) {
    const nextTier: CheckerTier = (tier + 1) as CheckerTier;
    const targetPercent = nextTier === 2 ? 60.01 : 75.01;
    // คำนวณจำนวนประกันที่ต้องได้เพื่อให้ถึง targetPercent
    // (currentInsured + needed) / totalDeliveredContracts >= targetPercent / 100
    // => needed = ceil((targetPercent * totalDeliveredContracts / 100) - currentInsured)
    const requiredTotalInsured = Math.ceil((targetPercent / 100) * totalDeliveredContracts);
    const additionalInsuredNeeded = Math.max(1, requiredTotalInsured - totalInsuredContracts);

    // คำนวณมูลค่าที่จะได้เพิ่มหากอยู่ Tier ถัดไปสำหรับเคสเดิม
    const nextTierRule = CHECKER_TIER_RULES[nextTier];
    let potentialNextTierTotal = 0;
    eligibleCases.forEach((c) => {
      const cat = getInsurancePlanCategory(c.insurancePlan);
      const yrs: InsuranceYears = c.insuranceYears && [1, 2, 3].includes(c.insuranceYears) ? c.insuranceYears : 1;
      if (cat === 'pa') {
        potentialNextTierTotal += nextTierRule.rates.pa[yrs];
      } else if (cat === 'pa_plus') {
        potentialNextTierTotal += nextTierRule.rates.pa_plus[yrs];
      }
    });

    const potentialCommissionIncrease = Math.max(0, potentialNextTierTotal - totalCommissionBaht);

    nextTierNeeded = {
      nextTier,
      targetPercent,
      additionalInsuredNeeded,
      potentialCommissionIncrease,
    };
  }

  return {
    totalDeliveredContracts,
    totalInsuredContracts,
    totalNoInsuranceContracts,
    paCount,
    paPlusCount,
    breakdown,
    achievementPercent,
    tier,
    tierRule,
    totalCommissionBaht,
    nextTierNeeded,
    cases: caseDetails,
  };
}

/**
 * สร้างข้อความสรุปค่าคอมมิชชั่นสำหรับส่งแชร์ใน LINE
 */
export function generateLineCommissionReport(
  summary: CheckerCommissionSummary,
  officerDisplay: string,
  periodLabel: string
): string {
  const lines: string[] = [
    `📊 สรุปค่าแนะนำขายประกันภัย (Checker)`,
    `👤 เจ้าหน้าที่: ${officerDisplay}`,
    `📅 ประจำงวด: ${periodLabel}`,
    `--------------------------------`,
    `🚗 สัญญารับรถทั้งหมด: ${summary.totalDeliveredContracts} คัน`,
    `🛡️ ซื้อประกัน (PA + PA PLUS): ${summary.totalInsuredContracts} คัน`,
    `📈 Target Achievement: ${summary.achievementPercent.toFixed(2)}%`,
    `⭐ ระดับผลงาน: Tier ${summary.tier} (${summary.tierRule.label})`,
    `--------------------------------`,
    `💰 สรุปยอดค่าแนะนำที่จะได้รับ:`,
  ];

  // PA breakdown
  if (summary.paCount > 0) {
    lines.push(`• แผน PA (ปกติ): ${summary.paCount} กรมธรรม์`);
    ([1, 2, 3] as InsuranceYears[]).forEach((y) => {
      const item = summary.breakdown.pa[y];
      if (item.count > 0) {
        lines.push(`  - PA ${y} ปี: ${item.count} คัน x ฿${item.unitRate} = ฿${item.total.toLocaleString()} บ.`);
      }
    });
  }

  // PA PLUS breakdown
  if (summary.paPlusCount > 0) {
    lines.push(`• แผน PA PLUS: ${summary.paPlusCount} กรมธรรม์`);
    ([1, 2, 3] as InsuranceYears[]).forEach((y) => {
      const item = summary.breakdown.pa_plus[y];
      if (item.count > 0) {
        lines.push(`  - PA+ ${y} ปี: ${item.count} คัน x ฿${item.unitRate} = ฿${item.total.toLocaleString()} บ.`);
      }
    });
  }

  if (summary.totalNoInsuranceContracts > 0) {
    lines.push(`• ไม่ทำประกัน: ${summary.totalNoInsuranceContracts} คัน (0 บ.)`);
  }

  lines.push(`--------------------------------`);
  lines.push(`💵 รวมค่าแนะนำสุทธิ: ฿${summary.totalCommissionBaht.toLocaleString()} บาท`);

  if (summary.nextTierNeeded) {
    lines.push(
      `🎯 เป้าหมายถัดไป: อีก ${summary.nextTierNeeded.additionalInsuredNeeded} คัน เพื่อขึ้น Tier ${summary.nextTierNeeded.nextTier} (รับเพิ่ม +฿${summary.nextTierNeeded.potentialCommissionIncrease.toLocaleString()} บ.)`
    );
  }

  lines.push(`--------------------------------`);
  lines.push(`*คำนวณจากเคสที่สถานะ "อนุมัติและรับรถแล้ว" ตามเกณฑ์ NCAP`);

  return lines.join('\n');
}
