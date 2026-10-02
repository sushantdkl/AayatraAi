import type { DemoInspection } from "@/lib/demo-browser";
import { salesPolicy, type FeatureRecord } from "@/lib/feature-matrix";

export type BuiltStep = { action: "OPEN_ROUTE" | "CAPTURE"; route: string; caption: string; featureKey: string; isMutating: false };
export type BuiltScript = { steps: BuiltStep[]; covered: string[]; skipped: Array<{ featureKey: string; reason: string }> };

/** Path → feature evidence: link text or URL segment must match a feature keyword. */
function linkMatches(link: { text: string; href: string }, feature: FeatureRecord, origin: string): string | null {
  let url: URL;
  try { url = new URL(link.href); } catch { return null; }
  if (url.origin !== origin) return null;
  const haystack = `${link.text} ${url.pathname.replace(/[/_-]+/g, " ")}`.toLowerCase();
  return feature.keywords.some((keyword) => /^[\x20-\x7e]+$/.test(keyword) && new RegExp(`\\b${keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(haystack)) ? url.pathname : null;
}

/**
 * §15 navigation verification → script verification. Only features that are sellable or
 * disclosable get a scene; NOT_AVAILABLE / PLANNED / UNKNOWN features are never shown as capabilities.
 * Steps are read-only (OPEN_ROUTE + CAPTURE); the script is created as DRAFT for human review.
 */
export function buildDemoScript(inspection: DemoInspection, features: FeatureRecord[], productFamily: string): BuiltScript {
  const origin = new URL(inspection.finalUrl).origin;
  const steps: BuiltStep[] = [{ action: "OPEN_ROUTE", route: new URL(inspection.finalUrl).pathname, caption: `${inspection.title || "Aadhar POS"} — overview`, featureKey: "OVERVIEW", isMutating: false },
    { action: "CAPTURE", route: new URL(inspection.finalUrl).pathname, caption: "Dashboard overview", featureKey: "OVERVIEW", isMutating: false }];
  const covered: string[] = [];
  const skipped: BuiltScript["skipped"] = [];
  const used = new Set<string>();
  for (const feature of features.filter((item) => item.product_family === productFamily)) {
    const treatment = salesPolicy[feature.implementation_status].treatment;
    if (!["SELL", "SELL_WITH_CONDITIONS", "DISCLOSE_AND_REVIEW"].includes(treatment)) { skipped.push({ featureKey: feature.feature_key, reason: `${feature.implementation_status}: not shown as a capability` }); continue; }
    const route = inspection.navigation.map((link) => linkMatches(link, feature, origin)).find((value): value is string => Boolean(value) && !used.has(value!));
    if (!route) { skipped.push({ featureKey: feature.feature_key, reason: "No matching navigation link on the live demo" }); continue; }
    used.add(route);
    const caption = feature.approved_language ?? feature.name;
    steps.push({ action: "OPEN_ROUTE", route, caption, featureKey: feature.feature_key, isMutating: false }, { action: "CAPTURE", route, caption: treatment === "DISCLOSE_AND_REVIEW" && feature.limitations ? `${caption} (${feature.limitations})` : caption, featureKey: feature.feature_key, isMutating: false });
    covered.push(feature.feature_key);
  }
  return { steps, covered, skipped };
}
