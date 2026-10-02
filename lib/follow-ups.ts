import type { Temperature } from "@/lib/sales-temperature";
import { stopsFollowUp } from "@/lib/sales-temperature";

/** Hours of silence after our last message before each follow-up (§40: FU1 → value reminder → final, then stop). */
export const followUpCadenceHours: Partial<Record<Temperature, number[]>> = {
  WARM: [72, 168, 336],
  INTERESTED: [48, 120, 240],
  HOT: [24, 72, 168],
  READY_TO_BUY: [24, 48, 120],
  NEGOTIATING: [24, 72, 168],
  PROPOSAL_SENT: [48, 120, 240],
  PAYMENT_PENDING: [24, 72, 168],
};
export const MAX_FOLLOW_UPS = 3;

export type FollowUpState = {
  temperature: Temperature;
  followUpStopped: boolean;
  doNotContact: boolean;
  contactEligible: boolean;
  conversationOpen: boolean;
  lastDirection: "INBOUND" | "OUTBOUND" | null;
  lastMessageAt: Date | null;
  followUpsSinceLastInbound: number;
  customerRequestedAt: Date | null;
};

export type FollowUpDecision = { due: true; attempt: number; dueAt: Date; reason: string } | { due: false; reason: string };

export function planFollowUp(state: FollowUpState, now = new Date()): FollowUpDecision {
  if (state.doNotContact || !state.contactEligible) return { due: false, reason: "Contact is not eligible or opted out" };
  if (state.followUpStopped || stopsFollowUp(state.temperature)) return { due: false, reason: "Follow-ups stopped" };
  if (!state.conversationOpen) return { due: false, reason: "Conversation is paused or closed" };
  if (state.customerRequestedAt) {
    return state.customerRequestedAt <= now
      ? { due: true, attempt: state.followUpsSinceLastInbound + 1, dueAt: state.customerRequestedAt, reason: "Customer asked to be contacted at this time" }
      : { due: false, reason: "Waiting for the customer's requested date" };
  }
  const cadence = followUpCadenceHours[state.temperature];
  if (!cadence) return { due: false, reason: `No automatic follow-up for ${state.temperature}` };
  if (state.lastDirection !== "OUTBOUND" || !state.lastMessageAt) return { due: false, reason: "Customer spoke last; handle in the inbox" };
  if (state.followUpsSinceLastInbound >= Math.min(MAX_FOLLOW_UPS, cadence.length)) return { due: false, reason: "Follow-up sequence finished; stop" };
  const dueAt = new Date(state.lastMessageAt.getTime() + cadence[state.followUpsSinceLastInbound] * 3600000);
  return dueAt <= now
    ? { due: true, attempt: state.followUpsSinceLastInbound + 1, dueAt, reason: `${state.temperature} follow-up ${state.followUpsSinceLastInbound + 1} of ${Math.min(MAX_FOLLOW_UPS, cadence.length)}` }
    : { due: false, reason: `Next follow-up at ${dueAt.toISOString()}` };
}
