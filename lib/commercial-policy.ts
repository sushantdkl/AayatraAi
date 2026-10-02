import { CommercialReviewRequired } from "@/lib/commercial";

export type CommercialPolicySnapshot = {
  status: "DRAFT" | "APPROVED";
  version: number;
  tax_mode: "UNCONFIGURED" | "EXEMPT" | "EXCLUSIVE" | "PAN_ONLY";
  tax_rate_bps: number | null;
  max_manual_discount_bps: number;
};

export function calculateQuoteAmounts(input: {
  subtotalMinor: number;
  discountMinor: number;
  submittedTaxMinor: number;
  floorTotalMinor: number | null;
  lineFloors?: Array<{ lineTotalMinor: number; floorMinor: number }>;
  policy: CommercialPolicySnapshot | null;
  /** Company registration; VAT is never added unless the company is verified VAT-registered. */
  companyTaxStatus?: "PAN_ONLY" | "VAT_REGISTERED" | null;
}): { taxMinor: number; totalMinor: number; policyVersion: number | null; needsPolicyReview: boolean } {
  const { subtotalMinor, discountMinor, submittedTaxMinor, floorTotalMinor, lineFloors, policy, companyTaxStatus } = input;
  if (policy?.tax_mode === "EXCLUSIVE" && companyTaxStatus !== "VAT_REGISTERED")
    throw new CommercialReviewRequired("VAT cannot be charged: company is not verified as VAT-registered");
  if (![subtotalMinor, discountMinor, submittedTaxMinor].every(Number.isSafeInteger) || subtotalMinor < 0 || discountMinor < 0 || submittedTaxMinor < 0)
    throw new CommercialReviewRequired("Quote amounts must be nonnegative safe minor-unit integers");
  if (discountMinor > subtotalMinor) throw new CommercialReviewRequired("Discount exceeds subtotal");
  const approved = policy?.status === "APPROVED" && policy.tax_mode !== "UNCONFIGURED";
  if (discountMinor > 0) {
    if (!approved || !policy) throw new CommercialReviewRequired("Discount policy has not been approved");
    if (floorTotalMinor === null || !Number.isSafeInteger(floorTotalMinor))
      throw new CommercialReviewRequired("Every discounted item needs an approved minimum selling price");
    if (subtotalMinor - discountMinor < floorTotalMinor)
      throw new CommercialReviewRequired("Discount would fall below the approved minimum selling price");
    if (!lineFloors?.length || lineFloors.some(({ lineTotalMinor, floorMinor }) =>
      !Number.isSafeInteger(lineTotalMinor) || !Number.isSafeInteger(floorMinor) || lineTotalMinor < 0 || floorMinor < 0 || floorMinor > lineTotalMinor ||
      BigInt(discountMinor) * BigInt(lineTotalMinor) > BigInt(lineTotalMinor - floorMinor) * BigInt(subtotalMinor)))
      throw new CommercialReviewRequired("Proportional discount would put an item below its approved minimum selling price");
    if (BigInt(discountMinor) * 10000n > BigInt(subtotalMinor) * BigInt(policy.max_manual_discount_bps))
      throw new CommercialReviewRequired("Discount exceeds the approved manual limit");
  }
  let taxMinor = 0;
  if (approved && policy.tax_mode === "EXCLUSIVE") {
    const net = subtotalMinor - discountMinor;
    taxMinor = Number((BigInt(net) * BigInt(policy.tax_rate_bps ?? 0) + 5000n) / 10000n);
    if (!Number.isSafeInteger(taxMinor)) throw new CommercialReviewRequired("Calculated tax is too large");
  }
  if (submittedTaxMinor !== 0 && submittedTaxMinor !== taxMinor)
    throw new CommercialReviewRequired("Tax amount must come from the approved policy, not the request");
  const totalMinor = subtotalMinor - discountMinor + taxMinor;
  if (!Number.isSafeInteger(totalMinor)) throw new CommercialReviewRequired("Quote total is too large");
  return { taxMinor, totalMinor, policyVersion: approved ? policy.version : null, needsPolicyReview: !approved };
}
