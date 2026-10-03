import { draftReply, type ReplyContext } from "@/lib/ai-replies";
import { featureDefinitions, salesPolicy, type FeatureRecord } from "@/lib/feature-matrix";
import { detectLanguage } from "@/lib/intent";
import { analyzeMessage } from "@/lib/message-analysis";
import { posterCatalogue, rupeesToMinor } from "@/lib/owner-config";
import { draftViolations } from "@/lib/reply-safety";
import { nextTemperature } from "@/lib/sales-temperature";
import type { EvalCase } from "../tests/fixtures/ai-eval-dataset";

export function seedReplyContext(overrides: Partial<ReplyContext> = {}): ReplyContext {
  const features: FeatureRecord[] = featureDefinitions.map((definition) => ({
    product_family: definition.productFamily, feature_key: definition.key, name: definition.name,
    implementation_status: definition.seedStatus, commercial_status: definition.seedCommercial ?? salesPolicy[definition.seedStatus].defaultCommercial,
    approved_language: null, limitations: definition.limitations ?? null, conditions: null, keywords: definition.keywords,
  }));
  return {
    company: { name: "Aayatra Enterprises", brand: "Aadhar POS", whatsapp: "+977 9804573494", taxStatus: "PAN_ONLY", panNumber: null, panVerified: false },
    prices: Object.fromEntries(posterCatalogue.map((item) => [item.sku, rupeesToMinor(item.rupees)])),
    features, demoLinks: {}, leadFamily: null, temperature: "COLD", ...overrides,
  };
}

export function runEvaluation(cases: EvalCase[]) {
  const context = seedReplyContext();
  const prices = Object.values(context.prices);
  const rows = cases.map((item) => {
    const analysis = analyzeMessage(item.message);
    const draft = draftReply(item.message, context);
    const temperature = nextTemperature("COLD", analysis.pipeline_stage);
    const expectedTemperature = item.temperature ?? "COLD";
    const violations = draftViolations(draft, prices);
    return {
      ...item,
      gotIntent: analysis.intent, gotTemperature: temperature, gotLanguage: detectLanguage(item.message),
      intentOk: analysis.intent === item.intent, temperatureOk: temperature === expectedTemperature,
      languageOk: detectLanguage(item.message) === item.language,
      requiresHuman: draft.requiresHuman, reply: draft.body, violations,
    };
  });
  const rate = (key: "intentOk" | "temperatureOk" | "languageOk") => rows.filter((row) => row[key]).length / rows.length;
  return {
    total: rows.length,
    intentAccuracy: rate("intentOk"), temperatureAccuracy: rate("temperatureOk"), languageAccuracy: rate("languageOk"),
    safetyViolations: rows.filter((row) => row.violations.length).length,
    humanReviewRate: rows.filter((row) => row.requiresHuman).length / rows.length,
    rows,
  };
}
