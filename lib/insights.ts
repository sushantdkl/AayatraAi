import type { Industry, ProductFamily } from "./types";

export const signalKeys = [
  "WEBSITE_EXISTS",
  "DIRECT_BOOKING",
  "ECOMMERCE_EXISTS",
  "DIGITAL_ORDERING",
  "MANUAL_ORDERING",
  "LARGE_CATALOG",
  "RESTAURANT_ON_SITE",
  "MANUAL_KOT",
  "MULTI_BRANCH",
] as const;
export type SignalKey = (typeof signalKeys)[number];
export type Observation = {
  signal_key: SignalKey;
  observed_value: boolean;
  confidence: number;
  observed_at: string;
};
type SignalMap = Partial<Record<SignalKey, Observation>>;

const digitalAxes: Partial<Record<Industry, SignalKey[]>> = {
  HOTEL: ["WEBSITE_EXISTS", "DIRECT_BOOKING"],
  HOTEL_RESTAURANT: ["WEBSITE_EXISTS", "DIRECT_BOOKING", "DIGITAL_ORDERING"],
  RESTAURANT: ["WEBSITE_EXISTS", "DIGITAL_ORDERING"],
  RETAIL: ["WEBSITE_EXISTS", "ECOMMERCE_EXISTS"],
  COSMETICS: ["WEBSITE_EXISTS", "ECOMMERCE_EXISTS"],
  KAWAII_ACCESSORIES: ["WEBSITE_EXISTS", "ECOMMERCE_EXISTS"],
  SOCIAL_COMMERCE: ["WEBSITE_EXISTS", "ECOMMERCE_EXISTS"],
  SALON: ["WEBSITE_EXISTS", "DIRECT_BOOKING"],
};

export type Candidate = {
  product: ProductFamily;
  reason: string;
  confidence: "OBSERVED" | "SEGMENT_ONLY";
};
export type Insight = {
  fitScore: number | null;
  fitLabel: string;
  digitalMaturityScore: number | null;
  digitalCoverage: string;
  buyingIntentScore: null;
  candidates: Candidate[];
  evidenceCount: number;
};

export function deriveInsights(
  industry: Industry,
  history: Observation[],
): Insight {
  const latest: SignalMap = {};
  for (const item of [...history].sort((a, b) =>
    b.observed_at.localeCompare(a.observed_at),
  )) {
    if (!(item.signal_key in latest)) latest[item.signal_key] = item;
  }
  const axes = digitalAxes[industry] ?? ["WEBSITE_EXISTS"];
  const observedAxes = axes.filter((axis) => latest[axis]);
  const maturity = observedAxes.length
    ? Math.round(
        (100 *
          observedAxes.filter((axis) => latest[axis]?.observed_value).length) /
          observedAxes.length,
      )
    : null;
  const known = Object.values(latest).filter(Boolean).length;
  const segmentBase = industry === "OTHER" ? 10 : 35;
  const gap =
    (latest.WEBSITE_EXISTS?.observed_value === false ? 12 : 0) +
    (latest.DIRECT_BOOKING?.observed_value === false &&
    ["HOTEL", "HOTEL_RESTAURANT"].includes(industry)
      ? 10
      : 0) +
    (latest.ECOMMERCE_EXISTS?.observed_value === false &&
    ["RETAIL", "COSMETICS", "KAWAII_ACCESSORIES", "SOCIAL_COMMERCE"].includes(
      industry,
    )
      ? 10
      : 0);
  const complexity =
    (latest.LARGE_CATALOG?.observed_value ? 12 : 0) +
    (latest.RESTAURANT_ON_SITE?.observed_value ? 12 : 0) +
    (latest.MULTI_BRANCH?.observed_value ? 8 : 0) +
    (latest.MANUAL_ORDERING?.observed_value ? 7 : 0) +
    (latest.MANUAL_KOT?.observed_value ? 7 : 0);
  const fitScore =
    known >= 2 ? Math.min(100, segmentBase + gap + complexity) : null;
  const candidates: Candidate[] = [];
  const add = (
    product: ProductFamily,
    reason: string,
    confidence: Candidate["confidence"],
  ) => {
    if (!candidates.some((item) => item.product === product))
      candidates.push({ product, reason, confidence });
  };
  if (
    industry === "HOTEL_RESTAURANT" ||
    (industry === "HOTEL" && latest.RESTAURANT_ON_SITE?.observed_value)
  )
    add(
      "HOTEL_RESTAURANT_COMBINED",
      "Lodging and restaurant operations are recorded",
      "OBSERVED",
    );
  else if (industry === "HOTEL")
    add("HOTEL_SYSTEM", "Hotel segment", "SEGMENT_ONLY");
  if (industry === "RESTAURANT")
    add("RESTAURANT_SYSTEM", "Restaurant segment", "SEGMENT_ONLY");
  if (
    ["RETAIL", "COSMETICS", "KAWAII_ACCESSORIES", "SOCIAL_COMMERCE"].includes(
      industry,
    )
  )
    add(
      "RETAIL_ERP",
      latest.LARGE_CATALOG?.observed_value
        ? "Large catalogue recorded"
        : "Retail segment",
      latest.LARGE_CATALOG?.observed_value ? "OBSERVED" : "SEGMENT_ONLY",
    );
  if (industry === "SALON")
    add("SALON_SYSTEM", "Salon segment", "SEGMENT_ONLY");
  if (latest.WEBSITE_EXISTS?.observed_value === false)
    add("WEBSITE", "No website observed", "OBSERVED");
  if (
    latest.ECOMMERCE_EXISTS?.observed_value === false &&
    ["RETAIL", "COSMETICS", "KAWAII_ACCESSORIES", "SOCIAL_COMMERCE"].includes(
      industry,
    )
  )
    add("ECOMMERCE", "No ecommerce flow observed", "OBSERVED");
  return {
    fitScore,
    fitLabel:
      fitScore == null ? "More evidence needed" : "Provisional lead fit",
    digitalMaturityScore: maturity,
    digitalCoverage: `${observedAxes.length}/${axes.length} relevant signals observed`,
    buyingIntentScore: null,
    candidates,
    evidenceCount: known,
  };
}
