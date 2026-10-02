export const automationFeatures = [
  "RESEARCH", "LEAD_SCORING", "MESSAGE_DRAFTING", "AUTO_SEND", "INBOUND_AI_REPLIES",
  "DEMO_GENERATION", "PROPOSAL_GENERATION", "FOLLOW_UPS", "NEGOTIATION",
  "PAYMENT_REQUESTS", "CLOSING", "ONBOARDING",
] as const;
export type AutomationFeature = (typeof automationFeatures)[number];
export type AutomationMode = "OFF" | "ASSISTED" | "AUTOMATIC_WITH_RULES";

export function allowedAutomationMode(feature: AutomationFeature, mode: AutomationMode): boolean {
  if (mode === "OFF" || mode === "ASSISTED") return true;
  return feature === "LEAD_SCORING";
}
