import { z } from "zod";
import { classifyIntent, CLASSIFIER_VERSION, extractSignals, normalizeMessage, type Intent } from "@/lib/intent";
import { matchTopic } from "@/lib/sales-playbook";
import { temperatureForIntent, temperatures } from "@/lib/sales-temperature";

/** §24 structured, server-validated classification. Confidence is rule strength, not a model probability. */
export const messageAnalysisSchema = z.object({
  intent: z.string(),
  pipeline_stage: z.enum(temperatures).nullable(),
  intent_score: z.number().int().min(0).max(100),
  sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE"]),
  product_interest: z.array(z.string()),
  objection: z.string().nullable(),
  decision_maker_signal: z.enum(["LIKELY", "UNLIKELY", "UNKNOWN"]),
  timeline: z.enum(["NOW", "SOON", "LATER", "UNKNOWN"]),
  budget_signal: z.enum(["PRICE_SENSITIVE", "HAS_BUDGET", "UNKNOWN"]),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
  recommended_next_action: z.string(),
  needs_human_review: z.boolean(),
  classifier_version: z.string(),
});
export type MessageAnalysis = z.infer<typeof messageAnalysisSchema>;

const intentScore: Partial<Record<Intent, number>> = {
  PAYMENT_QUERY: 95, PURCHASE_INTENT: 90, PROPOSAL_REQUEST: 85, NEGOTIATION: 80, DEMO_REQUEST: 70,
  MEETING_REQUEST: 70, PRICE_QUERY: 55, PACKAGE_QUERY: 55, HARDWARE_QUERY: 50, FEATURE_QUESTION: 45,
  IMPLEMENTATION_QUERY: 50, CUSTOM_REQUIREMENT: 45, TAX_REGISTRATION_QUERY: 40, OBJECTION_PRICE: 35,
  OBJECTION_EXISTING_SYSTEM: 25, GENERAL_QUESTION: 30, GREETING: 15, FOLLOW_UP_LATER: 20, OBJECTION_TIMING: 20,
  NOT_INTERESTED: 0, DO_NOT_CONTACT: 0, COMPLAINT: 10, UNKNOWN: 10,
};
const nextAction: Partial<Record<Intent, string>> = {
  PAYMENT_QUERY: "SEND_OFFICIAL_PAYMENT_DETAILS", PURCHASE_INTENT: "PREPARE_QUOTATION", PROPOSAL_REQUEST: "PREPARE_QUOTATION",
  NEGOTIATION: "HUMAN_NEGOTIATION", DEMO_REQUEST: "SCHEDULE_DEMO", MEETING_REQUEST: "SCHEDULE_MEETING",
  PRICE_QUERY: "SEND_PRICE_OPTIONS", PACKAGE_QUERY: "SEND_PRICE_OPTIONS", HARDWARE_QUERY: "SEND_HARDWARE_PRICES",
  FEATURE_QUESTION: "ANSWER_FROM_VERIFIED_FEATURES", NOT_INTERESTED: "STOP_FOLLOW_UP", DO_NOT_CONTACT: "RECORD_OPT_OUT",
  FOLLOW_UP_LATER: "SCHEDULE_FOLLOW_UP", COMPLAINT: "ESCALATE_SUPPORT", LEGAL_OR_CONTRACT: "ESCALATE_LEGAL", UNKNOWN: "HUMAN_REVIEW",
};
const familyProduct: Record<string, string> = {
  RESTAURANT_SYSTEM: "AADHAR_RESTAURANT", RETAIL_ERP: "AADHAR_RETAIL_ERP", HOTEL_SYSTEM: "HOTEL_SYSTEM",
  HOTEL_RESTAURANT_COMBINED: "HOTEL_RESTAURANT_COMBINED", SALON_SYSTEM: "THE_HAIRCUT",
};

export function analyzeMessage(body: string): MessageAnalysis {
  const value = normalizeMessage(body);
  const result = classifyIntent(body);
  const signals = extractSignals(body);
  const topic = matchTopic(body);
  const interest = new Set<string>();
  if (signals.productFamily) interest.add(familyProduct[signals.productFamily]);
  if (signals.mentionsHardware) interest.add("POS_HARDWARE");
  if (topic?.key === "WEBSITE_ECOMMERCE") interest.add(/ecommerce|e-commerce|online store/.test(value) ? "ECOMMERCE" : "WEBSITE");
  if (topic?.key === "SOCIAL_COMMERCE") { interest.add("AADHAR_RETAIL_ERP"); interest.add("ECOMMERCE"); }
  if (topic?.key === "AI_AUTOMATION") interest.add("AI_AUTOMATION");
  if (/\b(erp|inventory|stock|variants?)\b/.test(value)) interest.add("AADHAR_RETAIL_ERP");
  const negative = ["NOT_INTERESTED", "DO_NOT_CONTACT", "COMPLAINT"].includes(result.intent) || /\b(bad|worst|angry|useless|ramro chaina)\b/.test(value);
  const positive = ["PURCHASE_INTENT", "PROPOSAL_REQUEST", "PAYMENT_QUERY", "DEMO_REQUEST"].includes(result.intent) || /\b(great|good|nice|ramro|interested)\b/.test(value);
  const unknown = result.intent === "UNKNOWN";
  // Deterministic rules: explicit multi-word phrases are stronger than single keywords.
  const confidence = unknown ? 0.2 : value.split(" ").length <= 2 && result.intent !== "GREETING" ? 0.6 : 0.85;
  return messageAnalysisSchema.parse({
    intent: result.intent,
    pipeline_stage: temperatureForIntent(result.intent),
    intent_score: intentScore[result.intent] ?? 20,
    sentiment: negative ? "NEGATIVE" : positive ? "POSITIVE" : "NEUTRAL",
    product_interest: [...interest],
    objection: topic?.objectionType ?? (result.intent === "OBJECTION_PRICE" ? "too expensive" : result.intent === "OBJECTION_EXISTING_SYSTEM" ? "already have software" : null),
    decision_maker_signal: /\b(i am the owner|my (shop|restaurant|hotel|business)|mero (pasal|restaurant|hotel|business)|owner hu|malik)\b|मेरो/.test(value) ? "LIKELY" : /\b(ask (my )?(boss|owner)|sahu lai sodhera|manager le)\b/.test(value) ? "UNLIKELY" : "UNKNOWN",
    timeline: /\b(today|now|aaja|aile|asap|urgent|this week)\b|आज|अहिले/.test(value) ? "NOW" : /\b(next week|soon|chadai|chhito)\b/.test(value) ? "SOON" : result.intent === "FOLLOW_UP_LATER" ? "LATER" : "UNKNOWN",
    budget_signal: result.intent === "OBJECTION_PRICE" || result.intent === "NEGOTIATION" ? "PRICE_SENSITIVE" : result.intent === "PAYMENT_QUERY" || result.intent === "PURCHASE_INTENT" ? "HAS_BUDGET" : "UNKNOWN",
    confidence,
    reason: topic ? `${result.reason}; topic ${topic.key}` : result.reason,
    recommended_next_action: nextAction[result.intent] ?? "REPLY_AND_QUALIFY",
    needs_human_review: result.needsHuman || confidence < 0.5,
    classifier_version: CLASSIFIER_VERSION,
  });
}
