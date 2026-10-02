export const implementationStatuses = [
  "VERIFIED_AVAILABLE", "AVAILABLE_WITH_CONFIGURATION", "PARTIAL", "BETA",
  "PLANNED", "CUSTOM_ONLY", "NOT_AVAILABLE", "UNKNOWN",
] as const;
export type ImplementationStatus = (typeof implementationStatuses)[number];
export const commercialStatuses = ["SELLABLE", "SELL_WITH_DISCLOSURE", "REVIEW_REQUIRED", "NOT_SALES_SAFE"] as const;
export type CommercialStatus = (typeof commercialStatuses)[number];

export type SalesTreatment = "SELL" | "SELL_WITH_CONDITIONS" | "DISCLOSE_AND_REVIEW" | "NOT_STANDARD" | "NOT_AVAILABLE_NOW" | "TECHNICAL_REVIEW" | "SAY_UNAVAILABLE" | "DO_NOT_GUESS";

/** §16 AI policy per implementation state. */
export const salesPolicy: Record<ImplementationStatus, { treatment: SalesTreatment; requiresHuman: boolean; defaultCommercial: CommercialStatus }> = {
  VERIFIED_AVAILABLE: { treatment: "SELL", requiresHuman: false, defaultCommercial: "SELLABLE" },
  AVAILABLE_WITH_CONFIGURATION: { treatment: "SELL_WITH_CONDITIONS", requiresHuman: false, defaultCommercial: "SELLABLE" },
  PARTIAL: { treatment: "DISCLOSE_AND_REVIEW", requiresHuman: true, defaultCommercial: "SELL_WITH_DISCLOSURE" },
  BETA: { treatment: "NOT_STANDARD", requiresHuman: true, defaultCommercial: "REVIEW_REQUIRED" },
  PLANNED: { treatment: "NOT_AVAILABLE_NOW", requiresHuman: false, defaultCommercial: "NOT_SALES_SAFE" },
  CUSTOM_ONLY: { treatment: "TECHNICAL_REVIEW", requiresHuman: true, defaultCommercial: "REVIEW_REQUIRED" },
  NOT_AVAILABLE: { treatment: "SAY_UNAVAILABLE", requiresHuman: false, defaultCommercial: "NOT_SALES_SAFE" },
  UNKNOWN: { treatment: "DO_NOT_GUESS", requiresHuman: true, defaultCommercial: "REVIEW_REQUIRED" },
};

export type FeatureDefinition = {
  productFamily: string;
  key: string;
  name: string;
  /** Words a prospect may use (English, Romanized Nepali, Devanagari). */
  keywords: string[];
  /** Path segments that indicate implementation in a source tree (app/, migrations/, tests/). */
  sourcePatterns: string[];
  seedStatus: ImplementationStatus;
  seedEvidence: string;
  seedCommercial?: CommercialStatus;
  limitations?: string;
};

const OWNER_REPORTED = "OWNER_REPORTED (2026-10-03): code evidence reported in the dimsum Aadhar restaurant repository. The archive was not available to this sales engine; run scripts/audit-source.ts, review tests and validate on the live demo before upgrading.";
const NO_SOURCE = "No source, test or demo evidence supplied for this product line yet.";

const restaurant = (key: string, name: string, keywords: string[], sourcePatterns: string[]): FeatureDefinition =>
  ({ productFamily: "RESTAURANT_SYSTEM", key, name, keywords, sourcePatterns, seedStatus: "UNKNOWN", seedEvidence: OWNER_REPORTED });
const retail = (key: string, name: string, keywords: string[]): FeatureDefinition =>
  ({ productFamily: "RETAIL_ERP", key, name, keywords, sourcePatterns: [], seedStatus: "UNKNOWN", seedEvidence: NO_SOURCE });

export const featureDefinitions: FeatureDefinition[] = [
  restaurant("POS", "Point of sale", ["pos", "point of sale", "billing machine", "बिलिङ मेसिन"], ["pos"]),
  restaurant("ORDERS", "Order management", ["order", "orders", "अर्डर"], ["orders", "order"]),
  restaurant("BILLING", "Billing and bills", ["bill", "billing", "invoice", "बिल"], ["bills", "billing", "bill"]),
  restaurant("KOT", "Kitchen order tickets (KOT)", ["kot", "kitchen order", "kitchen ticket", "kitchen print", "किचन"], ["kot", "kitchen"]),
  restaurant("TABLES", "Table management", ["table", "tables", "टेबल"], ["tables", "table"]),
  restaurant("RESERVATIONS", "Reservations", ["reservation", "reserve", "book a table", "table booking", "आरक्षण", "बुकिङ"], ["reservations", "reservation"]),
  restaurant("ONLINE_ORDERS", "Online orders", ["online order", "online ordering", "website order", "अनलाइन अर्डर"], ["online-orders", "online_orders", "online"]),
  restaurant("INVENTORY", "Inventory and stock", ["inventory", "stock", "stok", "स्टक", "मौज्दात"], ["inventory", "stock"]),
  restaurant("INVENTORY_MOVEMENTS", "Inventory movements", ["stock movement", "stock transfer", "wastage", "inventory movement"], ["inventory-movements", "inventory_movements", "movements"]),
  restaurant("PURCHASES", "Purchases", ["purchase", "purchasing", "kharid", "खरिद"], ["purchases", "purchase"]),
  restaurant("SUPPLIERS_AP", "Suppliers and payables", ["supplier", "vendor", "payable", "आपूर्तिकर्ता"], ["suppliers", "supplier", "payables", "ap"]),
  restaurant("CUSTOMERS_AR", "Customers and receivables (credit)", ["customer credit", "receivable", "udharo", "उधारो", "customer"], ["customers", "receivables", "ar"]),
  restaurant("EXPENSES", "Expenses", ["expense", "kharcha", "खर्च"], ["expenses", "expense"]),
  restaurant("CASH_BOOK", "Cash book", ["cash book", "cashbook", "day book"], ["cashbook", "cash-book", "cash_book", "book"]),
  restaurant("BUSINESS_DAYS", "Business day open/close", ["day close", "day end", "business day", "closing report"], ["business-days", "business_days", "business-day", "day-close"]),
  restaurant("CASH_DRAWER", "Cash drawer", ["cash drawer", "drawer", "galla", "गल्ला"], ["cash-drawer", "cash_drawer", "drawer"]),
  restaurant("BANK_RECONCILIATION", "Bank and reconciliation", ["bank reconciliation", "reconcile", "bank"], ["bank", "reconciliation", "reconcile"]),
  restaurant("ACCOUNTING_GL", "Accounting and general ledger", ["accounting", "ledger", "journal", "lekha", "लेखा", "account"], ["accounting", "general-ledger", "ledger", "journal", "gl"]),
  restaurant("REPORTS", "Reports and analytics", ["report", "reports", "analytics", "sales report", "रिपोर्ट"], ["reports", "report", "analytics"]),
  restaurant("EMPLOYEES_HR", "Employees and HR", ["staff", "employee", "attendance", "hr", "कर्मचारी", "हाजिरी"], ["employees", "employee", "hr", "staff", "attendance"]),
  restaurant("PAYROLL", "Payroll", ["payroll", "salary", "talab", "तलब"], ["payroll", "salary"]),
  restaurant("PUBLIC_WEBSITE", "Public website, menu and reviews", ["qr menu", "digital menu", "website", "menu", "review", "मेनु"], ["menu", "reviews", "review", "public", "website"]),
  {
    productFamily: "RESTAURANT_SYSTEM", key: "MULTI_BRANCH", name: "Multi-branch operation",
    keywords: ["branch", "branches", "multi branch", "multi-branch", "multiple outlet", "outlets", "शाखा", "multiple location"],
    sourcePatterns: ["branch", "branches", "branch_id", "tenant", "outlet"],
    seedStatus: "NOT_AVAILABLE", seedCommercial: "NOT_SALES_SAFE",
    seedEvidence: "Repository audit (AADHAR_RESTAURANT_PRODUCT_AUDIT.md, owner summary 2026-10-03): no complete multi-tenant / branch_id domain model; multi-branch is future work. Enterprise poster wording does not override this.",
    limitations: "Needs source upgrade and re-verification before it can be sold.",
  },
  {
    productFamily: "RESTAURANT_SYSTEM", key: "IRD_CERTIFICATION", name: "IRD-approved / certified software claim",
    keywords: ["ird approved", "ird certified", "ird certification", "government approved", "sarkar le approve"],
    sourcePatterns: [], seedStatus: "NOT_AVAILABLE", seedCommercial: "NOT_SALES_SAFE",
    seedEvidence: "No official software approval/certification document supplied. Company PAN registration is not product certification.",
  },
  restaurant("OFFLINE_MODE", "Offline operation", ["offline", "without internet", "internet bina", "इन्टरनेट बिना"], ["offline", "sync"]),
  restaurant("PAYMENT_WALLETS", "eSewa / Khalti / FonePay integration", ["esewa", "khalti", "fonepay", "wallet", "qr payment"], ["esewa", "khalti", "fonepay", "payment-gateway"]),
  restaurant("MOBILE_APP", "Mobile app", ["mobile app", "android app", "ios app", "phone app"], ["mobile", "android", "ios"]),
  retail("RETAIL_BILLING", "Retail billing", ["billing", "bill", "बिल", "pos"]),
  retail("BARCODE", "Barcode scanning and labels", ["barcode", "label", "scanner", "बारकोड"]),
  retail("RETAIL_INVENTORY", "Retail inventory", ["stock", "inventory", "स्टक"]),
  retail("RETAIL_CUSTOMERS", "Customer records and credit", ["customer", "udharo", "उधारो"]),
  retail("RETAIL_REPORTS", "Retail reports", ["report", "रिपोर्ट"]),
];

export type FeatureRecord = {
  product_family: string;
  feature_key: string;
  name: string;
  implementation_status: ImplementationStatus;
  commercial_status: CommercialStatus;
  approved_language: string | null;
  limitations: string | null;
  conditions: string | null;
  keywords: string[];
};

/** Find the feature a prospect is asking about. Longest keyword wins to prefer specific phrases. */
export function matchFeature(text: string, features: FeatureRecord[], family?: string | null): FeatureRecord | null {
  const value = ` ${text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ")} `;
  let best: { feature: FeatureRecord; score: number } | null = null;
  for (const feature of features) {
    for (const keyword of feature.keywords) {
      const needle = keyword.toLowerCase();
      const ascii = /^[\x20-\x7e]+$/.test(needle);
      const hit = ascii ? value.includes(` ${needle} `) || value.includes(` ${needle}s `) : value.includes(needle);
      if (!hit) continue;
      const score = needle.length + (family && feature.product_family === family ? 100 : 0);
      if (!best || score > best.score) best = { feature, score };
    }
  }
  return best?.feature ?? null;
}

/** A feature may only be upgraded to an available state with real evidence and a human verifier. */
export function validateFeatureChange(input: { status: ImplementationStatus; commercial: CommercialStatus; evidence: string; approvedLanguage?: string | null; conditions?: string | null }): string | null {
  if (input.evidence.trim().length < 12) return "Evidence reference is required";
  if (/poster|marketing|brochure/i.test(input.evidence) && ["VERIFIED_AVAILABLE", "AVAILABLE_WITH_CONFIGURATION"].includes(input.status))
    return "Marketing material cannot verify a feature; cite source, tests or a live demo check";
  if (["VERIFIED_AVAILABLE", "AVAILABLE_WITH_CONFIGURATION"].includes(input.status) && !input.approvedLanguage?.trim())
    return "Approved customer-facing wording is required";
  if (input.status === "AVAILABLE_WITH_CONFIGURATION" && !input.conditions?.trim()) return "Describe the configuration conditions";
  if (input.commercial === "SELLABLE" && !["VERIFIED_AVAILABLE", "AVAILABLE_WITH_CONFIGURATION"].includes(input.status))
    return "Only verified features can be marked sellable";
  return null;
}
