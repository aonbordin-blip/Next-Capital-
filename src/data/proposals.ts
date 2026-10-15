import {
  ProposalDefinition,
  BikePreset,
  ProposalKey,
  CalculationResult,
  DownMode,
  TermComparisonItem,
  InsurancePlan,
  InsuranceYears,
  InsurancePlanDetail,
} from '../types';

export const INSURANCE_PLANS: Record<'plan_a' | 'plan_b', InsurancePlanDetail> = {
  plan_a: {
    id: 'plan_a',
    name: 'แผน A (PA ปกติ)',
    code: 'PA',
    badge: 'คุ้มครองอุบัติเหตุมาตรฐาน',
    premiums: {
      1: 670,
      2: 1340,
      3: 2010,
    },
    generalAccident: 80000,
    motorcycleAccident: 50000,
    assaultMurder: 50000,
    medicalExpense: 1000,
    funeralExpense: 10000,
    hospitalCompensationPerDay: 0,
  },
  plan_b: {
    id: 'plan_b',
    name: 'แผน B (PA PLUS)',
    code: 'PA+',
    badge: 'คุ้มครอง 200,000 + ชดเชยรายวัน 500/วัน',
    premiums: {
      1: 1329,
      2: 2658,
      3: 3987,
    },
    generalAccident: 200000,
    motorcycleAccident: 200000,
    assaultMurder: 200000,
    medicalExpense: 1000,
    funeralExpense: 10000,
    hospitalCompensationPerDay: 500, // สูงสุด 30 วัน/ปี
  },
};

export const PROPOSALS: Record<ProposalKey, ProposalDefinition> = {
  small_bike: {
    key: 'small_bike',
    name: 'Small Bike',
    code: 'MS.MTS.0082/2568',
    category: 'รถครอบครัว / ออโตเมติกขนาดเล็ก',
    defaultDownMode: 'amount',
    defaultDownValue: 5000,
    validTerms: [12, 18, 24, 30, 36, 42],
    description: 'อัตราดอกเบี้ย Flat Rate 1.06% - 1.10% ต่อเดือน ตามระยะเวลางวดผ่อน',
    badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
    conditionNote: 'คำนวณตามหลักเกณฑ์เช่าซื้อมาตรฐาน Flat Rate',
  },
  fazzio: {
    key: 'fazzio',
    name: 'FAZZIO เท่านั้น',
    code: 'MS.MTS.0376/2569',
    category: 'Yamaha Fazzio เฉพาะรุ่น',
    defaultDownMode: 'amount',
    defaultDownValue: 5000,
    validTerms: [48],
    fixedTerm: 48,
    description: 'เงื่อนไขพิเศษเฉพาะ Yamaha FAZZIO อัตราคงที่ 1.10%/เดือน สำหรับ 48 งวด',
    badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    conditionNote: 'เงื่อนไขเฉพาะเกรด Normal เท่านั้น (48 งวด)',
  },
  top_small: {
    key: 'top_small',
    name: 'Top Small / AEC',
    code: 'MS.MTS.0093/2568',
    category: 'พรีเมียม สกู๊ตเตอร์ 150-160cc (PCX, Click, ADV, Grand Filano)',
    defaultDownMode: 'amount',
    defaultDownValue: 10000,
    validTerms: [12, 18, 24, 30, 36, 42, 48],
    description: 'อัตราดอกเบี้ย 1.06% - 1.11% ต่อเดือน ผ่อนได้สูงสุดถึง 48 งวด',
    badgeColor: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    conditionNote: 'กลุ่มรถยอดนิยม 12-36 งวด ดอกเบี้ย 1.06% ต่อเดือน',
  },
  vespa: {
    key: 'vespa',
    name: 'VESPA / LAMBRETTA',
    code: 'MS.MTS.0351/2569',
    category: 'พรีเมียมคลาสสิกอิตาเลียน สกู๊ตเตอร์',
    defaultDownMode: 'amount',
    defaultDownValue: 20000,
    validTerms: [12, 18, 24, 30, 36, 42, 48, 60],
    description: 'อัตราดอกเบี้ยคิดเป็นรายปีตามขั้นบันไดเงินดาวน์ (6.75% - 9.00% ต่อปี)',
    badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
    conditionNote: 'ดาวน์ 35,000+ รับดอกเบี้ยต่ำสุด 6.75% ต่อปี',
  },
  honda_yamaha: {
    key: 'honda_yamaha',
    name: 'Honda, Yamaha 250-399 CC.',
    code: 'MS.MTS.0098/2569',
    category: 'มิดเดิลคลาส บิ๊กสกู๊ตเตอร์ & สปอร์ต (Forza 350, XMAX, CBR300R)',
    defaultDownMode: 'percent',
    defaultDownValue: 15,
    validTerms: [12, 18, 24, 30, 36, 42, 48, 60],
    description: 'คิดอัตราดอกเบี้ยรายปีตามร้อยละของเงินดาวน์ (5.00% - 7.00% ต่อปี)',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    conditionNote: 'ดาวน์ขั้นต่ำ 10% (แนะนำดาวน์ 20% เพื่อรับดอกเบี้ย 5.00% ต่อปี)',
  },
  second_hand: {
    key: 'second_hand',
    name: 'รถมือสอง 2 ND',
    code: 'MP.MAP.0080/2568',
    category: 'รถจักรยานยนต์ใช้แล้วสภาพดี',
    defaultDownMode: 'amount',
    defaultDownValue: 5000,
    validTerms: [24, 30, 36, 42],
    description: 'อัตราดอกเบี้ย 1.06% - 1.09% ต่อเดือน พร้อมเกณฑ์ดอกเบี้ยรวมขั้นต่ำ 7,000 บาท',
    badgeColor: 'bg-rose-100 text-rose-700 border-rose-200',
    minInterestRule: 7000,
    conditionNote: 'มีเกณฑ์ดอกเบี้ยรวมขั้นต่ำทั้งสัญญา 7,000 บาท',
  },
};

export const BIKE_PRESETS: BikePreset[] = [
  {
    id: 'wave-110i',
    name: 'Honda Wave 110i',
    brand: 'Honda',
    price: 46400,
    proposalKey: 'small_bike',
    defaultDownPercent: 10,
    badge: 'ประหยัดน้ำมันยอดนิยม',
    popular: true,
  },
  {
    id: 'wave-125i',
    name: 'Honda Wave 125i',
    brand: 'Honda',
    price: 55200,
    proposalKey: 'small_bike',
    defaultDownPercent: 15,
    badge: 'ผู้นำรถครอบครัวพรีเมียม',
    popular: true,
  },
  {
    id: 'scoopy',
    name: 'Honda Scoopy (Urban / Prestige)',
    brand: 'Honda',
    price: 50400,
    proposalKey: 'small_bike',
    defaultDownPercent: 10,
    badge: 'แฟชั่นสกู๊ตเตอร์วัยรุ่น',
    popular: true,
  },
  {
    id: 'click-160',
    name: 'Honda Click 160',
    brand: 'Honda',
    price: 63500,
    proposalKey: 'top_small',
    defaultDownPercent: 15,
    badge: 'สปอร์ต เอ.ที. พลังแรง',
    popular: true,
  },
  {
    id: 'lead-125',
    name: 'Honda Lead 125',
    brand: 'Honda',
    price: 61500,
    proposalKey: 'small_bike',
    defaultDownPercent: 10,
    badge: 'U-Box ใหญ่สะใจ 37 ลิตร',
  },
  {
    id: 'pcx-160',
    name: 'Honda PCX 160 (Standard/ABS)',
    brand: 'Honda',
    price: 87400,
    proposalKey: 'top_small',
    defaultDownPercent: 15,
    badge: 'พรีเมียม สกู๊ตเตอร์ อันดับ 1',
    popular: true,
  },
  {
    id: 'adv-160',
    name: 'Honda ADV 160',
    brand: 'Honda',
    price: 99900,
    proposalKey: 'top_small',
    defaultDownPercent: 15,
    badge: 'SUV Bike สายลุย',
  },
  {
    id: 'fazzio-hybrid',
    name: 'Yamaha FAZZIO Hybrid',
    brand: 'Yamaha',
    price: 54900,
    proposalKey: 'fazzio',
    defaultDownPercent: 10,
    badge: 'โปรโมชันพิเศษ 48 งวด',
    popular: true,
  },
  {
    id: 'grand-filano',
    name: 'Yamaha Grand Filano Hybrid Connected',
    brand: 'Yamaha',
    price: 63700,
    proposalKey: 'top_small',
    defaultDownPercent: 15,
    badge: 'ดีไซน์พรีเมียมคลาสสิก',
    popular: true,
  },
  {
    id: 'aerox-155',
    name: 'Yamaha Aerox 155',
    brand: 'Yamaha',
    price: 72900,
    proposalKey: 'top_small',
    defaultDownPercent: 15,
    badge: 'สปอร์ต ออโตเมติก สไตล์เรซซิ่ง',
  },
  {
    id: 'vespa-sprint-150',
    name: 'Vespa Sprint 150 i-Get ABS',
    brand: 'Vespa',
    price: 139900,
    proposalKey: 'vespa',
    defaultDownPercent: 20,
    badge: 'ไอคอนิก อิตาเลียน ดีไซน์',
    popular: true,
  },
  {
    id: 'lambretta-v200',
    name: 'Lambretta V200 Special',
    brand: 'Lambretta',
    price: 103000,
    proposalKey: 'vespa',
    defaultDownPercent: 20,
    badge: 'สกู๊ตเตอร์คลาสสิกในตำนาน',
  },
  {
    id: 'forza-350',
    name: 'Honda Forza 350',
    brand: 'Honda',
    price: 179000,
    proposalKey: 'honda_yamaha',
    defaultDownPercent: 15,
    badge: 'บิ๊กสกู๊ตเตอร์ทัวร์ริ่งยอดฮิต',
    popular: true,
  },
  {
    id: 'xmax-300',
    name: 'Yamaha XMAX Connected 300',
    brand: 'Yamaha',
    price: 189900,
    proposalKey: 'honda_yamaha',
    defaultDownPercent: 15,
    badge: 'Sport Heritage MAX Series',
    popular: true,
  },
  {
    id: 'cbr300r',
    name: 'Honda CBR300R',
    brand: 'Honda',
    price: 151000,
    proposalKey: 'honda_yamaha',
    defaultDownPercent: 15,
    badge: 'สปอร์ตไบค์ฟูลแฟริ่ง',
  },
  {
    id: 'used-standard',
    name: 'รถจักรยานยนต์มือสอง เกรด A (2ND)',
    brand: 'Other',
    price: 36000,
    proposalKey: 'second_hand',
    defaultDownPercent: 15,
    badge: 'ตรวจสภาพพร้อมใช้งาน',
    popular: true,
  },
];

export function calculateLease(
  proposalKey: ProposalKey,
  price: number,
  downValue: number,
  downMode: DownMode,
  term: number,
  registrationFee: number = 0,
  theftInsuranceFee: number = 0,
  insurancePlan: InsurancePlan = 'none',
  insuranceYears: InsuranceYears = 1
): CalculationResult {
  const proposal = PROPOSALS[proposalKey];
  const safeBasePrice = Math.max(0, price || 0);

  // Insurance premium computation based on Lockton Group PA Plan A / Plan B
  let insurancePremium = 0;
  let insurancePlanName = 'ไม่รับความคุ้มครอง PA';
  if (insurancePlan !== 'none' && INSURANCE_PLANS[insurancePlan]) {
    const planDetail = INSURANCE_PLANS[insurancePlan];
    insurancePremium = planDetail.premiums[insuranceYears] || 0;
    insurancePlanName = `${planDetail.name} (คุ้มครอง ${insuranceYears} ปี)`;
  }

  // Requirement: "เมื่อเลือกแผน เลือกปีคุ้มครอง ค่าเบี้ยให้รวมเข้ากับราคารถเลยนะ"
  const totalVehiclePrice = safeBasePrice + insurancePremium;
  const safePrice = totalVehiclePrice;

  // Compute effective down amount and percent
  let downAmount = 0;
  let downPercent = 0;

  if (downMode === 'percent') {
    downPercent = Math.max(0, Math.min(100, downValue || 0));
    downAmount = safePrice * (downPercent / 100);
  } else {
    downAmount = Math.max(0, Math.min(safePrice, downValue || 0));
    downPercent = safePrice > 0 ? (downAmount / safePrice) * 100 : 0;
  }

  let financeAmount = Math.max(0, safePrice - downAmount);

  // Fallback term if invalid for proposal
  let validTerm = term;
  if (!proposal.validTerms.includes(term)) {
    validTerm = proposal.validTerms[0];
  }

  let monthlyRate = 0;
  let annualRate = 0;
  let isAnnualRate = false;
  let rateDisplayText = '';
  let remarkText = proposal.conditionNote || 'คำนวณตามเงื่อนไข Proposal';

  if (proposalKey === 'small_bike') {
    if (validTerm === 12) monthlyRate = 0.0106;
    else if (validTerm === 18) monthlyRate = 0.0107;
    else if (validTerm === 24) monthlyRate = 0.0107;
    else if (validTerm === 30) monthlyRate = 0.0108;
    else if (validTerm === 36) monthlyRate = 0.0109;
    else monthlyRate = 0.011; // 42
    rateDisplayText = `${(monthlyRate * 100).toFixed(2)}% ต่อเดือน (Flat Rate)`;
  } else if (proposalKey === 'fazzio') {
    monthlyRate = 0.011;
    validTerm = 48;
    rateDisplayText = '1.10% ต่อเดือน (48 งวด)';
    remarkText = 'เงื่อนไขเฉพาะเกรด Normal เท่านั้น (48 งวด)';
  } else if (proposalKey === 'top_small') {
    if (validTerm <= 36) monthlyRate = 0.0106;
    else if (validTerm === 42) monthlyRate = 0.011;
    else monthlyRate = 0.0111; // 48
    rateDisplayText = `${(monthlyRate * 100).toFixed(2)}% ต่อเดือน (Flat Rate)`;
  } else if (proposalKey === 'vespa') {
    isAnnualRate = true;
    if (downAmount >= 35000) annualRate = 0.0675;
    else if (downAmount >= 25000) annualRate = 0.07;
    else if (downAmount >= 20000) annualRate = 0.0725;
    else if (downAmount >= 15000) annualRate = 0.075;
    else annualRate = 0.09;

    monthlyRate = annualRate / 12;
    rateDisplayText = `${(annualRate * 100).toFixed(2)}% ต่อปี (${(monthlyRate * 100).toFixed(3)}%/เดือน)`;
    remarkText = `ขั้นบันไดเงินดาวน์: ${(annualRate * 100).toFixed(2)}% ต่อปี`;
  } else if (proposalKey === 'honda_yamaha') {
    isAnnualRate = true;
    if (downPercent >= 20) {
      annualRate = validTerm <= 48 ? 0.05 : 0.055;
    } else if (downPercent >= 15) {
      annualRate = validTerm <= 48 ? 0.055 : 0.06;
    } else {
      annualRate = 0.07;
    }
    monthlyRate = annualRate / 12;
    rateDisplayText = `${(annualRate * 100).toFixed(2)}% ต่อปี (ดาวน์ ${downPercent.toFixed(0)}%)`;
    remarkText = `ดาวน์ ${downPercent.toFixed(1)}% | ดอกเบี้ย ${(annualRate * 100).toFixed(2)}% ต่อปี`;
  } else if (proposalKey === 'second_hand') {
    if (validTerm === 24 || validTerm === 30) monthlyRate = 0.0106;
    else if (validTerm === 36) monthlyRate = 0.0108;
    else monthlyRate = 0.0109; // 42
    rateDisplayText = `${(monthlyRate * 100).toFixed(2)}% ต่อเดือน`;
    remarkText = 'มีเกณฑ์ดอกเบี้ยรวมขั้นต่ำ 7,000 บาท';
  }

  // Calculate Interest
  let totalInterest = 0;
  if (isAnnualRate) {
    totalInterest = financeAmount * annualRate * (validTerm / 12);
  } else {
    totalInterest = financeAmount * monthlyRate * validTerm;
  }

  let minInterestApplied = false;
  if (proposalKey === 'second_hand' && totalInterest < 7000 && financeAmount > 0) {
    totalInterest = 7000;
    minInterestApplied = true;
    remarkText = 'ปรับใช้ดอกเบี้ยขั้นต่ำตามเกณฑ์ 7,000 บาท';
  }

  const totalBeforeVat = financeAmount + totalInterest;
  const vatAmount = totalBeforeVat * 0.07;
  const totalWithVat = totalBeforeVat + vatAmount;
  const monthlyInstallment = validTerm > 0 ? totalWithVat / validTerm : 0;

  const totalDriveAwayCost = downAmount + registrationFee + theftInsuranceFee;

  return {
    proposalCode: proposal.code,
    proposalName: proposal.name,
    baseVehiclePrice: safeBasePrice,
    insurancePlan,
    insurancePlanName,
    insuranceYears,
    insurancePremium,
    vehiclePrice: safePrice,
    downAmount,
    downPercent,
    financeAmount,
    term: validTerm,
    rateDisplayText,
    monthlyRate,
    annualRate,
    isAnnualRate,
    totalInterest,
    minInterestApplied,
    totalBeforeVat,
    vatAmount,
    totalWithVat,
    monthlyInstallment,
    remarkText,
    registrationFee,
    theftInsuranceFee,
    totalDriveAwayCost,
  };
}

export function getTermComparisons(
  proposalKey: ProposalKey,
  price: number,
  downValue: number,
  downMode: DownMode,
  currentTerm: number,
  insurancePlan: InsurancePlan = 'none',
  insuranceYears: InsuranceYears = 1
): TermComparisonItem[] {
  const proposal = PROPOSALS[proposalKey];
  return proposal.validTerms.map((t) => {
    const res = calculateLease(
      proposalKey,
      price,
      downValue,
      downMode,
      t,
      0,
      0,
      insurancePlan,
      insuranceYears
    );
    return {
      term: t,
      monthlyInstallment: res.monthlyInstallment,
      totalInterest: res.totalInterest,
      totalWithVat: res.totalWithVat,
      rateDisplayText: res.rateDisplayText,
      isCurrent: t === currentTerm,
    };
  });
}

export function formatBaht(amount: number, showDecimals = false): string {
  if (isNaN(amount)) return '฿0';
  if (showDecimals) {
    return `฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `฿${Math.round(amount).toLocaleString('th-TH')}`;
}

export function formatNumber(amount: number, decimals = 0): string {
  if (isNaN(amount)) return '0';
  return amount.toLocaleString('th-TH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
