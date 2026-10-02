import assert from "node:assert/strict";
import test from "node:test";
import { allowedAutomationMode, automationFeatures } from "../lib/automation-controls";

test("high-impact autonomy is locked until policy and providers are verified", () => {
  assert.ok(automationFeatures.includes("AUTO_SEND"));
  assert.equal(allowedAutomationMode("AUTO_SEND", "AUTOMATIC_WITH_RULES"), false);
  assert.equal(allowedAutomationMode("PAYMENT_REQUESTS", "AUTOMATIC_WITH_RULES"), false);
  assert.equal(allowedAutomationMode("LEAD_SCORING", "AUTOMATIC_WITH_RULES"), true);
});
