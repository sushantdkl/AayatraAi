import { POSTER_SOURCE, type QuoteException } from "@/lib/owner-config";

export type QuoteLinePolicy = { sku: string | null; kind: string; approvalRequired: boolean; commercialSource: string | null };

/**
 * §20: a standard, undiscounted quote built only from owner-approved canonical items may be
 * approved automatically. Anything else needs a human.
 */
export function quoteApprovalRequirement(input: {
  discountMinor: number;
  lines: QuoteLinePolicy[];
  policyApproved: boolean;
  exceptions: QuoteException[];
}): { autoApprove: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!input.policyApproved) reasons.push("Commercial/tax policy is not approved");
  if (input.discountMinor > 0) reasons.push("DISCOUNT");
  for (const exception of input.exceptions) if (exception !== "DISCOUNT" && !reasons.includes(exception)) reasons.push(exception);
  for (const line of input.lines) {
    if (line.approvalRequired) reasons.push(`Item ${line.sku ?? "(custom)"} requires approval`);
    else if (line.commercialSource !== POSTER_SOURCE)
      reasons.push(line.kind === "HARDWARE" ? "NON_STANDARD_HARDWARE" : `Item ${line.sku ?? "(custom)"} is not an owner-approved standard price`);
  }
  return { autoApprove: reasons.length === 0, reasons: [...new Set(reasons)] };
}
