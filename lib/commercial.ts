export type PriceSource = {
  price_minor: number | string;
  is_canonical: boolean;
  active: boolean;
};

export type QuoteableItem = {
  catalog_status: string;
  verification_status: string;
  is_active: boolean;
  approval_required: boolean;
  effective_from: string | null;
  effective_to: string | null;
};

export class CommercialReviewRequired extends Error {
  code = "COMMERCIAL_PRICE_REVIEW_REQUIRED";
}

export function resolveActivePrice(
  item: QuoteableItem,
  sources: PriceSource[],
  today = new Date().toISOString().slice(0, 10),
): number {
  if (
    item.catalog_status !== "ACTIVE" ||
    item.verification_status !== "VERIFIED" ||
    !item.is_active ||
    item.approval_required ||
    (item.effective_from && today < item.effective_from) ||
    (item.effective_to && today > item.effective_to)
  )
    throw new CommercialReviewRequired("Item is not approved for automatic quotation");
  const active = sources.filter((source) => source.active);
  if (!active.length) throw new CommercialReviewRequired("No active price source");
  const canonical = active.filter((source) => source.is_canonical);
  if (canonical.length > 1)
    throw new CommercialReviewRequired("Multiple canonical prices");
  const prices = new Set(active.map((source) => Number(source.price_minor)));
  if (prices.size > 1 && canonical.length !== 1)
    throw new CommercialReviewRequired("Conflicting active prices have no canonical source");
  const chosen = canonical[0] ?? active[0];
  const value = Number(chosen.price_minor);
  if (!Number.isSafeInteger(value) || value < 0)
    throw new CommercialReviewRequired("Price is not a safe minor-unit value");
  return value;
}
