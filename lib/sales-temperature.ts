import type { Intent } from "@/lib/intent";

export const temperatures = [
  "COLD", "WARM", "INTERESTED", "HOT", "READY_TO_BUY", "NEGOTIATING",
  "PROPOSAL_SENT", "PAYMENT_PENDING", "CLOSED_WON", "NOT_INTERESTED",
] as const;
export type Temperature = (typeof temperatures)[number];

const rank: Record<Temperature, number> = {
  NOT_INTERESTED: -1, COLD: 0, WARM: 1, INTERESTED: 2, HOT: 3, READY_TO_BUY: 4,
  NEGOTIATING: 5, PROPOSAL_SENT: 6, PAYMENT_PENDING: 7, CLOSED_WON: 8,
};

/** The temperature a message signals on its own; null means it carries no buying signal. */
export function temperatureForIntent(intent: Intent): Temperature | null {
  switch (intent) {
    case "GREETING": case "GENERAL_QUESTION": return "WARM";
    case "FEATURE_QUESTION": case "PRICE_QUERY": case "PACKAGE_QUERY":
    case "HARDWARE_QUERY": case "OBJECTION_PRICE": case "OBJECTION_EXISTING_SYSTEM":
    case "IMPLEMENTATION_QUERY": case "CUSTOM_REQUIREMENT": case "TAX_REGISTRATION_QUERY":
      return "INTERESTED";
    case "DEMO_REQUEST": case "MEETING_REQUEST": return "HOT";
    // "Growth package final kati?" — a named package plus a final-price ask is HOT / NEGOTIATING.
    case "NEGOTIATION": return "NEGOTIATING";
    case "PROPOSAL_REQUEST": case "PURCHASE_INTENT": return "READY_TO_BUY";
    case "PAYMENT_QUERY": return "PAYMENT_PENDING";
    case "NOT_INTERESTED": case "DO_NOT_CONTACT": return "NOT_INTERESTED";
    case "OBJECTION_TIMING": case "FOLLOW_UP_LATER": return "WARM";
    default: return null;
  }
}

/**
 * Temperature only moves forward from messages, except an explicit "not interested" / opt-out.
 * A prospect who said "not interested" and later shows interest again is revived.
 * PROPOSAL_SENT and CLOSED_WON are set by system events (quote sent, deal won), never by message text.
 */
export function nextTemperature(current: Temperature, signalled: Temperature | null): Temperature {
  if (!signalled) return current;
  if (current === "CLOSED_WON") return current;
  if (signalled === "NOT_INTERESTED") return "NOT_INTERESTED";
  if (signalled === "PROPOSAL_SENT" || signalled === "CLOSED_WON") return current;
  if (current === "NOT_INTERESTED") return signalled;
  return rank[signalled] > rank[current] ? signalled : current;
}

export function stopsFollowUp(temperature: Temperature): boolean {
  return temperature === "NOT_INTERESTED" || temperature === "CLOSED_WON";
}

export const hotTemperatures: Temperature[] = ["HOT", "READY_TO_BUY", "NEGOTIATING", "PROPOSAL_SENT", "PAYMENT_PENDING"];
export const readyTemperatures: Temperature[] = ["READY_TO_BUY", "PAYMENT_PENDING"];

/** Priority inbox ordering: money-adjacent first, then hot, then human-needed. Lower sorts first. */
export function inboxPriority(input: { temperature: Temperature; needsHuman: boolean; unread: number }): number {
  const base: Record<Temperature, number> = {
    PAYMENT_PENDING: 0, READY_TO_BUY: 1, NEGOTIATING: 2, PROPOSAL_SENT: 3, HOT: 4,
    INTERESTED: 6, WARM: 7, COLD: 8, CLOSED_WON: 9, NOT_INTERESTED: 10,
  };
  return base[input.temperature] * 10 + (input.needsHuman ? 0 : 3) + (input.unread > 0 ? 0 : 1);
}
