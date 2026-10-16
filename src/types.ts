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
}

export interface CalculationResult {
  proposalCode: string;
  proposalName: string;
  baseVehiclePrice: number; // ราคารถตัวเปล่า เช่น 71,500
  vehiclePrice: number; // ราคารถ (คงไว้เพื่อ backward compatibility)
  downAmount: number; // เงินดาวน์
  downPercent: number; // เงินดาวน์ %
  vehicleFinanceAmount: number; // ยอดจัดเฉพาะตัวรถ (ราคารถ - เงินดาวน์) เช่น 71,500
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
  monthlyRate: number; // อัตราดอกเบี้ยต่อเดือน เช่น 0.0109 (1.09%)
  annualRate: number;
  isAnnualRate: boolean;
  monthlyInterest: number; // ดอกเบี้ยต่อเดือน เช่น 825.850381
  totalInterest: number; // ดอกเบี้ยรวมทั้งสัญญา เช่น 29,730.613716
  minInterestApplied: boolean;
  totalBeforeVat: number; // มูลค่ารวมก่อนภาษีมูลค่าเพิ่ม (ถอด VAT 7%)
  vatAmount: number; // ภาษีมูลค่าเพิ่ม 7% รวม
  totalWithVat: number; // ยอดรวมทั้งสัญญา (ยอดจัด + ดอกเบี้ยรวม) เช่น 105,496.703716
  monthlyInstallment: number; // ค่างวดต่อเดือน เช่น 2,930
  remarkText: string;
  // Day of delivery costs
  registrationFee: number;
  theftInsuranceFee: number;
  totalDriveAwayCost: number; // เงินที่ต้องจ่ายวันออกรถ
}

export interface TermComparisonItem {
  term: number;
  monthlyInstallment: number;
  totalInterest: number;
  totalWithVat: number;
  rateDisplayText: string;
  isCurrent: boolean;
}
