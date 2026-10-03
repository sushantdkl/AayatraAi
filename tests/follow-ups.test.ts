import assert from "node:assert/strict";
import test from "node:test";
import { planFollowUp, type FollowUpState } from "../lib/follow-ups";

const now = new Date("2026-10-10T10:00:00Z");
const base: FollowUpState = { temperature: "HOT", followUpStopped: false, doNotContact: false, contactEligible: true, conversationOpen: true,
  lastDirection: "OUTBOUND", lastMessageAt: new Date("2026-10-09T08:00:00Z"), followUpsSinceLastInbound: 0, customerRequestedAt: null };

test("HOT lead silent for 26h after our message is due for follow-up 1", () => {
  assert.deepEqual(planFollowUp(base, now), { due: true, attempt: 1, dueAt: new Date("2026-10-10T08:00:00Z"), reason: "HOT follow-up 1 of 3" });
});
test("sequence stops after three follow-ups and for not-interested, DNC and won", () => {
  assert.equal(planFollowUp({ ...base, followUpsSinceLastInbound: 3 }, now).due, false);
  assert.equal(planFollowUp({ ...base, temperature: "NOT_INTERESTED" }, now).due, false);
  assert.equal(planFollowUp({ ...base, doNotContact: true }, now).due, false);
  assert.equal(planFollowUp({ ...base, temperature: "CLOSED_WON" }, now).due, false);
  assert.equal(planFollowUp({ ...base, temperature: "COLD" }, now).due, false);
});
test("never follows up when the customer spoke last", () => {
  assert.equal(planFollowUp({ ...base, lastDirection: "INBOUND" }, now).due, false);
});
test("a customer-requested date is honoured exactly", () => {
  assert.equal(planFollowUp({ ...base, customerRequestedAt: new Date("2026-10-20T04:00:00Z") }, now).due, false);
  assert.equal(planFollowUp({ ...base, lastDirection: "INBOUND", customerRequestedAt: new Date("2026-10-10T04:00:00Z") }, now).due, true);
});
