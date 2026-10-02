export const industries = [
  "HOTEL",
  "HOTEL_RESTAURANT",
  "RESTAURANT",
  "RETAIL",
  "COSMETICS",
  "KAWAII_ACCESSORIES",
  "SOCIAL_COMMERCE",
  "SALON",
  "OTHER",
] as const;

export const productFamilies = [
  "RESTAURANT_SYSTEM",
  "HOTEL_SYSTEM",
  "HOTEL_RESTAURANT_COMBINED",
  "RETAIL_ERP",
  "SALON_SYSTEM",
  "WEBSITE",
  "ECOMMERCE",
  "AI_AUTOMATION",
  "CUSTOM_SOFTWARE",
] as const;

export const stages = [
  "INTERESTED",
  "HOT",
  "READY",
  "DEMO",
  "MEETING",
  "PROPOSAL",
  "NEGOTIATING",
  "PAYMENT",
  "WON",
  "LOST",
] as const;

export type Stage = (typeof stages)[number];

const transitions: Record<Stage, Stage[]> = {
  INTERESTED: ["HOT", "READY", "DEMO", "MEETING", "LOST"],
  HOT: ["INTERESTED", "READY", "DEMO", "MEETING", "PROPOSAL", "LOST"],
  READY: ["HOT", "DEMO", "MEETING", "PROPOSAL", "NEGOTIATING", "LOST"],
  DEMO: ["HOT", "READY", "MEETING", "PROPOSAL", "LOST"],
  MEETING: ["HOT", "READY", "DEMO", "PROPOSAL", "LOST"],
  PROPOSAL: ["READY", "NEGOTIATING", "PAYMENT", "LOST"],
  NEGOTIATING: ["READY", "PROPOSAL", "PAYMENT", "LOST"],
  PAYMENT: ["NEGOTIATING", "WON", "LOST"],
  WON: [],
  LOST: ["INTERESTED"],
};

export function canTransition(from: Stage, to: Stage): boolean {
  return transitions[from].includes(to);
}

export function normalizeBusinessName(name: string): string {
  return name
    .trim()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en");
}

export function normalizeContact(value: string): string {
  return value.trim().toLocaleLowerCase("en");
}

export const capabilityStatuses = [
  "UNVERIFIED",
  "VERIFIED",
  "OPTIONAL",
  "BETA",
  "PLANNED",
  "CUSTOM_REVIEW",
  "UNSUPPORTED",
] as const;

export type CapabilityStatus = (typeof capabilityStatuses)[number];

export function canPublishCapability(
  status: CapabilityStatus,
  evidenceUrl: string | null,
  approvedLanguage: string | null,
): boolean {
  return (
    (status === "VERIFIED" || status === "OPTIONAL") &&
    Boolean(evidenceUrl?.trim()) &&
    Boolean(approvedLanguage?.trim())
  );
}
