/**
 * Owner-approved configuration addendum dated 2026-10-03.
 * Company identity, PAN-only tax status and poster prices are confirmed by the owner.
 * Feature availability is NOT confirmed here: see lib/feature-matrix.ts.
 */
export const OWNER_CONFIG_REFERENCE = "OWNER_APPROVED_CONFIG_2026-10-03";
export const POSTER_SOURCE = "OWNER_APPROVED_POSTER_2026";
export const LEGACY_SNAPSHOT_SOURCE = "Aayatra continuation prompt marketing snapshot 2026-10-01";

export const companyIdentity = {
  legalOrTradingName: "Aayatra Enterprises",
  brand: "Aadhar POS",
  city: "Kathmandu",
  country: "Nepal",
  primaryWhatsapp: "+977 9804573494",
  taxStatus: "PAN_ONLY",
} as const;

/** Still external; stored as settings, never blocking internal development. */
export const pendingCompanyFields = [
  "PAN_NUMBER", "PAN_REGISTRATION_DOCUMENT", "FULL_REGISTERED_ADDRESS",
  "AUTHORIZED_SIGNATORY", "LEGAL_EMAIL", "BANK_DETAILS", "FINAL_LEGAL_SLA_APPROVAL",
] as const;

export type PosterItem = {
  sku: string;
  productFamily: "RESTAURANT_SYSTEM" | "RETAIL_ERP" | "POS_HARDWARE";
  packageCode: string;
  kind: "SOFTWARE" | "HARDWARE";
  name: string;
  billingType: "ONE_TIME" | "RECURRING";
  billingPeriod: "MONTH" | "YEAR" | null;
  rupees: number;
  /** Older draft item this record supersedes (same organization, legacy snapshot). */
  supersedes: string | null;
};

const plan = (sku: string, packageCode: string, name: string, period: "MONTH" | "YEAR", rupees: number, supersedes: string): PosterItem =>
  ({ sku, productFamily: "RESTAURANT_SYSTEM", packageCode, kind: "SOFTWARE", name, billingType: "RECURRING", billingPeriod: period, rupees, supersedes });

export const posterCatalogue: PosterItem[] = [
  plan("RESTAURANT_STARTER_YEARLY", "STARTER", "Restaurant Starter (yearly)", "YEAR", 15000, "Starter yearly"),
  plan("RESTAURANT_STARTER_MONTHLY", "STARTER", "Restaurant Starter (monthly)", "MONTH", 1500, "Starter monthly"),
  plan("RESTAURANT_GROWTH_YEARLY", "GROWTH", "Restaurant Growth (yearly)", "YEAR", 25000, "Growth yearly"),
  plan("RESTAURANT_GROWTH_MONTHLY", "GROWTH", "Restaurant Growth (monthly)", "MONTH", 2500, "Growth monthly"),
  plan("RESTAURANT_ENTERPRISE_YEARLY", "ENTERPRISE", "Restaurant Enterprise (yearly)", "YEAR", 40000, "Enterprise yearly"),
  plan("RESTAURANT_ENTERPRISE_MONTHLY", "ENTERPRISE", "Restaurant Enterprise (monthly)", "MONTH", 4000, "Enterprise monthly"),
  { sku: "RETAIL_ONE_TIME_SETUP", productFamily: "RETAIL_ERP", packageCode: "ONE_TIME_SETUP", kind: "SOFTWARE", name: "Retail POS one-time setup", billingType: "ONE_TIME", billingPeriod: null, rupees: 30000, supersedes: "Retail POS setup" },
  { sku: "RETAIL_YEARLY", productFamily: "RETAIL_ERP", packageCode: "YEARLY", kind: "SOFTWARE", name: "Retail POS yearly plan", billingType: "RECURRING", billingPeriod: "YEAR", rupees: 10000, supersedes: "Retail POS yearly" },
  { sku: "RETAIL_MONTHLY", productFamily: "RETAIL_ERP", packageCode: "MONTHLY", kind: "SOFTWARE", name: "Retail POS monthly plan", billingType: "RECURRING", billingPeriod: "MONTH", rupees: 1000, supersedes: "Retail POS monthly" },
  { sku: "HW_THERMAL_PRINTER", productFamily: "POS_HARDWARE", packageCode: "THERMAL_PRINTER", kind: "HARDWARE", name: "Thermal printer", billingType: "ONE_TIME", billingPeriod: null, rupees: 14000, supersedes: "Thermal printer" },
  { sku: "HW_THERMAL_LABEL_PRINTER", productFamily: "POS_HARDWARE", packageCode: "THERMAL_LABEL_PRINTER", kind: "HARDWARE", name: "Thermal + label printer", billingType: "ONE_TIME", billingPeriod: null, rupees: 20000, supersedes: "Thermal + label printer" },
  { sku: "HW_BARCODE_SCANNER", productFamily: "POS_HARDWARE", packageCode: "BARCODE_SCANNER", kind: "HARDWARE", name: "Barcode scanner gun", billingType: "ONE_TIME", billingPeriod: null, rupees: 8000, supersedes: "Barcode scanner gun" },
];

/** Discount policy: negotiable, but the AI may never apply a discount on its own. */
export const discountPolicy = {
  priceNegotiable: true,
  aiAutonomousDiscountBps: 0,
  defaultDiscountBps: 0,
  autoDiscountLimitBps: 0,
  managerDiscountLimitBps: 0,
} as const;

/** Demo URLs remain configurable; empty means WAITING_FOR_DEMO_URL. */
export const demoUrlSettings = [
  { env: "AADHAR_RESTAURANT_DEMO_URL", productFamily: "RESTAURANT_SYSTEM", name: "Aadhar Restaurant demo" },
  { env: "AADHAR_RETAIL_DEMO_URL", productFamily: "RETAIL_ERP", name: "Aadhar Retail demo" },
  { env: "AADHAR_HOTEL_DEMO_URL", productFamily: "HOTEL_SYSTEM", name: "Aadhar Hotel demo" },
  { env: "AADHAR_HOTEL_RESTAURANT_DEMO_URL", productFamily: "HOTEL_RESTAURANT_COMBINED", name: "Aadhar Hotel + Restaurant demo" },
  { env: "THE_HAIRCUT_DEMO_URL", productFamily: "SALON_SYSTEM", name: "The Haircut demo" },
] as const;

/** Assisted (draft-only) modes enabled by the addendum. Nothing here sends on its own. */
export const assistedAutomation = ["MESSAGE_DRAFTING", "INBOUND_AI_REPLIES", "FOLLOW_UPS", "NEGOTIATION", "PROPOSAL_GENERATION", "PAYMENT_REQUESTS", "DEMO_GENERATION"] as const;

/** Quote exceptions that always need human approval, even at standard price. */
export const quoteExceptions = ["DISCOUNT", "CUSTOM_DEVELOPMENT", "SPECIAL_INTEGRATION", "NON_STANDARD_HARDWARE", "CUSTOM_SLA", "ENTERPRISE_FEATURE_EXCEPTION", "MULTI_BRANCH_PROMISE"] as const;
export type QuoteException = (typeof quoteExceptions)[number];

export function rupeesToMinor(rupees: number): number { return rupees * 100; }

export function formatNpr(minor: number): string {
  return `NPR ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(minor / 100))}`;
}
