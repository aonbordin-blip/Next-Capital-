export type ProposalKey =
  | 'small_bike'
  | 'fazzio'
  | 'top_small'
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
  baseVehiclePrice: number;
  insurancePlan: InsurancePlan;
  insurancePlanName: string;
  insuranceYears: InsuranceYears;
  insurancePremium: number;
  vehiclePrice: number; // Includes insurance premium as requested by user
  downAmount: number;
  downPercent: number;
  financeAmount: number;
  term: number;
  rateDisplayText: string;
  monthlyRate: number;
  annualRate: number;
  isAnnualRate: boolean;
  totalInterest: number;
  minInterestApplied: boolean;
  totalBeforeVat: number;
  vatAmount: number;
  totalWithVat: number;
  monthlyInstallment: number;
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
