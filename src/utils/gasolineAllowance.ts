export interface GasolineTierRule {
  tierIndex: number; // 0 to 6
  minContracts: number;
  maxContracts: number | null; // null = 51+
  rangeLabel: string; // ตามตารางเงื่อนไข
  shortRangeLabel: string; // สำหรับชิป / gauge
  tierName: string;
  allowanceBaht: number;
  milestonePositionPercent: number; // ตำแหน่งบนเกจ (0 - 100)
}

export const GASOLINE_TIER_RULES: GasolineTierRule[] = [
  {
    tierIndex: 0,
    minContracts: 0,
    maxContracts: 14,
    rangeLabel: '0 - 14',
    shortRangeLabel: '0–14',
    tierName: 'ยังไม่ถึงเกณฑ์',
    allowanceBaht: 0,
    milestonePositionPercent: 0,
  },
  {
    tierIndex: 1,
    minContracts: 15,
    maxContracts: 19,
    rangeLabel: '15 - 19',
    shortRangeLabel: '15–19',
    tierName: 'ขั้นที่ 1',
    allowanceBaht: 1200,
    milestonePositionPercent: 18,
  },
  {
    tierIndex: 2,
    minContracts: 20,
    maxContracts: 24,
    rangeLabel: '20 - 24',
    shortRangeLabel: '20–24',
    tierName: 'ขั้นที่ 2',
    allowanceBaht: 1900,
    milestonePositionPercent: 34,
  },
  {
    tierIndex: 3,
    minContracts: 25,
    maxContracts: 29,
    rangeLabel: '25 - 29',
    shortRangeLabel: '25–29',
    tierName: 'ขั้นที่ 3',
    allowanceBaht: 2600,
    milestonePositionPercent: 50,
  },
  {
    tierIndex: 4,
    minContracts: 30,
    maxContracts: 39,
    rangeLabel: '30 - 39',
    shortRangeLabel: '30–39',
    tierName: 'ขั้นที่ 4',
    allowanceBaht: 4200,
    milestonePositionPercent: 66,
  },
  {
    tierIndex: 5,
    minContracts: 40,
    maxContracts: 50,
    rangeLabel: '40 - 50',
    shortRangeLabel: '40–50',
    tierName: 'ขั้นที่ 5',
    allowanceBaht: 6200,
    milestonePositionPercent: 83,
  },
  {
    tierIndex: 6,
    minContracts: 51,
    maxContracts: null,
    rangeLabel: 'ตั้งแต่ 51 สัญญาขึ้นไป',
    shortRangeLabel: '51+',
    tierName: 'ขั้นสูงสุด',
    allowanceBaht: 8200,
    milestonePositionPercent: 100,
  },
];

export interface GasolineAllowanceSummary {
  contractCount: number;
  allowanceBaht: number;
  currentTier: GasolineTierRule;
  nextTier: GasolineTierRule | null;
  contractsNeededForNext: number;
  potentialGainBaht: number;
  gaugePercent: number; // 0 - 100 สัมพันธ์กับ milestonePositionPercent
  isMaxTier: boolean;
  isUnlocked: boolean;
  allTiers: GasolineTierRule[];
}

/**
 * แปลงจำนวนสัญญาเป็นเปอร์เซ็นต์บนเกจ (0-100%)
 * เพื่อให้ปลายเกจตรงกับหมุด 15, 20, 25, 30, 40, 51+ อย่างแม่นยำ
 */
function calculateGaugePercent(count: number): number {
  if (count <= 0) return 0;
  if (count >= 51) return 100;

  const segments: Array<{ fromCount: number; toCount: number; fromPct: number; toPct: number }> = [
    { fromCount: 0, toCount: 15, fromPct: 0, toPct: 18 },
    { fromCount: 15, toCount: 20, fromPct: 18, toPct: 34 },
    { fromCount: 20, toCount: 25, fromPct: 34, toPct: 50 },
    { fromCount: 25, toCount: 30, fromPct: 50, toPct: 66 },
    { fromCount: 30, toCount: 40, fromPct: 66, toPct: 83 },
    { fromCount: 40, toCount: 51, fromPct: 83, toPct: 100 },
  ];

  for (const seg of segments) {
    if (count >= seg.fromCount && count <= seg.toCount) {
      const ratio = (count - seg.fromCount) / (seg.toCount - seg.fromCount);
      return Math.round((seg.fromPct + ratio * (seg.toPct - seg.fromPct)) * 10) / 10;
    }
  }

  return 100;
}

/**
 * คำนวณค่าน้ำมันตามเกณฑ์จำนวนสัญญา (เงื่อนไขการจ่ายค่าน้ำมัน)
 */
export function calculateGasolineAllowance(rawContractCount: number): GasolineAllowanceSummary {
  const contractCount = Math.max(0, Math.floor(Number.isFinite(rawContractCount) ? rawContractCount : 0));

  const currentTier =
    GASOLINE_TIER_RULES.find(
      (tier) =>
        contractCount >= tier.minContracts &&
        (tier.maxContracts === null || contractCount <= tier.maxContracts)
    ) || GASOLINE_TIER_RULES[0];

  const nextTier =
    currentTier.tierIndex < GASOLINE_TIER_RULES.length - 1
      ? GASOLINE_TIER_RULES[currentTier.tierIndex + 1]
      : null;

  const contractsNeededForNext = nextTier ? Math.max(1, nextTier.minContracts - contractCount) : 0;
  const potentialGainBaht = nextTier ? Math.max(0, nextTier.allowanceBaht - currentTier.allowanceBaht) : 0;

  return {
    contractCount,
    allowanceBaht: currentTier.allowanceBaht,
    currentTier,
    nextTier,
    contractsNeededForNext,
    potentialGainBaht,
    gaugePercent: calculateGaugePercent(contractCount),
    isMaxTier: currentTier.tierIndex === GASOLINE_TIER_RULES.length - 1,
    isUnlocked: currentTier.allowanceBaht > 0,
    allTiers: GASOLINE_TIER_RULES,
  };
}
