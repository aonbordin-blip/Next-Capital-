export type ProposalKey =
  | 'small_bike'
  | 'fazzio'
  | 'top_small'
  | 'aec'
  | 'vespa'
  | 'honda_yamaha'
  | 'second_hand';

export type DownMode = 'amount' | 'percent';

export type InsurancePlan = 'none' | 'plan_a' | 'plan_b';
export type InsuranceYears = 1 | 2 | 3;

export interface InsurancePlanDetail {
  id: InsurancePlan;
  name: string;
  code: string;
  badge: string;
  premiums: Record<InsuranceYears, number>;
  generalAccident: number;
  motorcycleAccident: number;
  assaultMurder: number;
  medicalExpense: number;
  funeralExpense: number;
  hospitalCompensationPerDay: number;
}

export interface ProposalDefinition {
  key: ProposalKey;
  name: string;
  code: string;
  category: string;
  defaultDownMode: DownMode;
  defaultDownValue: number;
  validTerms: number[];
  description: string;
  badgeColor: string;
  minInterestRule?: number;
  fixedTerm?: number;
  conditionNote?: string;
}

export interface BikePreset {
  id: string;
  name: string;
  brand: 'Honda' | 'Yamaha' | 'Vespa' | 'Lambretta' | 'Other';
  price: number;
  proposalKey: ProposalKey;
  defaultDownPercent: number;
  badge?: string;
  popular?: boolean;
  code?: string;
}

export interface CalculationResult {
  proposalCode: string;
  proposalName: string;
  baseVehiclePrice: number; // ราคารถตัวเปล่า เช่น 71,500
  vehiclePrice: number; // ราคารถ (คงไว้เพื่อ backward compatibility)
  downAmount: number; // เงินดาวน์
  downPercent: number; // เงินดาวน์ %
  vehicleFinanceAmount: number; // ยอดจัดเฉพาะตัวรถ (ราคารถ - เงินดาวน์) เช่น 71,500
  baseFinanceAmount: number; // ยอดจัดเฉพาะตัวรถ (alias ของ vehicleFinanceAmount)
  insurancePlan: InsurancePlan;
  insurancePlanName: string;
  insuranceYears: InsuranceYears;
  insurancePremium: number; // เบี้ยประกันสุทธิ เช่น 3,987
  insuranceBasePremium: number; // เบี้ยประกันสุทธิ เช่น 3,987
  insuranceVat: number; // ภาษีมูลค่าเพิ่ม 7% ของเบี้ยประกัน เช่น 279.09
  insuranceTotalWithVat: number; // เบี้ยประกันรวมภาษี 7% เช่น 4,266.09
  financeAmount: number; // ยอดจัดไฟแนนซ์รวม (ยอดจัดตัวรถ + เบี้ยประกันรวมภาษี) เช่น 75,766.09
  term: number; // ระยะเวลาผ่อน เช่น 36
  rateDisplayText: string;
  monthlyRate: number; // อัตราดอกเบี้ยต่อเดือนที่นำไปใช้คำนวณจริง เช่น 0.01089 (1.089%)
  annualRate: number;
  isAnnualRate: boolean;
  // EIR (Effective Interest Rate) Compliance Fields
  proposalMonthlyRate: number; // อัตราดอกเบี้ยตาม Proposal ที่ขอมา เช่น 0.01090 (1.090%)
  maxAllowedMonthlyRate: number; // อัตราดอกเบี้ยสูงสุดที่ไม่เกินเพดาน EIR 23% เช่น 0.01089 (1.089%)
  effectiveMonthlyRate: number; // อัตราดอกเบี้ยที่ใช้จริง (ผ่านการควบคุมเพดาน EIR) เช่น 0.01089
  isCappedByEir: boolean; // มีการล็อกและบังคับใช้อัตราสูงสุดหรือไม่ (true เมื่อ proposalMonthlyRate > maxAllowedMonthlyRate)
  eirMaxMessage: string; // ข้อความกำกับ เช่น "สูงสุด 1.089 เป็นอัตราดอกเบี้ยไม่เกิน EIR 23%"
  eirAnnualPercent: number; // อัตราดอกเบี้ยที่แท้จริงต่อปี (EIR %) เช่น 22.92%
  eirReason: string; // คำอธิบายเกณฑ์และเหตุผลการล็อกอัตราดอกเบี้ย
  monthlyInterest: number; // ดอกเบี้ยต่อเดือน เช่น 825.850381
  totalInterest: number; // ดอกเบี้ยรวมทั้งสัญญา เช่น 29,730.613716
  minInterestApplied: boolean;
  totalBeforeVat: number; // มูลค่ารวมก่อนภาษีมูลค่าเพิ่ม (ถอด VAT 7%)
  vatAmount: number; // ภาษีมูลค่าเพิ่ม 7% รวม
  totalWithVat: number; // ยอดรวมทั้งสัญญา (ยอดจัด + ดอกเบี้ยรวม) เช่น 105,496.703716
  rawMonthlyInstallment: number; // ค่างวดก่อนปัดเศษ เช่น 2,410.71
  monthlyInstallment: number; // ค่างวดต่อเดือนตามเกณฑ์ Next Capital ปัดเศษลงท้าย 0 หรือ 5 เช่น 2,415 หรือ 2,420
  roundingRuleNote: string; // คำอธิบายเกณฑ์ปัดเศษค่างวด
  remarkText: string;
  // Custom Interest Rate Fields (แก้ไขดอกเบี้ยตามระบบบริษัท)
  isCustomRate?: boolean;
  customRateType?: 'monthly' | 'annual';
  customRateValue?: number;
  // Day of delivery costs
  registrationFee: number;
  theftInsuranceFee: number;
  totalDriveAwayCost: number; // เงินที่ต้องจ่ายวันออกรถ
}

export interface CustomRateConfig {
  rate: number; // e.g. 1.09 for 1.09% per month or 6.5 for 6.5% per year
  type: 'monthly' | 'annual';
  enforceEirCap?: boolean; // false = calculate exact custom rate, true = cap at EIR 23%
}

export interface TermComparisonItem {
  term: number;
  monthlyInstallment: number;
  totalInterest: number;
  totalWithVat: number;
  rateDisplayText: string;
  isCurrent: boolean;
  proposalMonthlyRate?: number;
  maxAllowedMonthlyRate?: number;
  effectiveMonthlyRate?: number;
  isCappedByEir?: boolean;
  eirAnnualPercent?: number;

  // เปรียบเทียบส่วนประกันภัย PA
  hasInsurance?: boolean;
  monthlyInstallmentWithoutInsurance: number;
  insuranceMonthlyDiff: number; // ค่างวดที่เพิ่มมาเนื่องจากทำประกัน (บาท/เดือน)
  totalWithoutInsurance: number;
  insuranceTotalDiff: number;   // ยอดรวมทั้งสัญญาที่เพิ่มมาเนื่องจากทำประกัน (บาท)
  insurancePlanName?: string;
  planAInstallment?: number;
  planADiff?: number;
  planBInstallment?: number;
  planBDiff?: number;
}
