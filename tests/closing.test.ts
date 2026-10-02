import assert from "node:assert/strict";
import test from "node:test";
import { canCloseWon, onboardingSteps } from "../lib/closing";
import { missingOnboardingPrerequisites, marketingDiscrepancies } from "../lib/client-kit";

test("a verbal yes, accepted quote alone, or unverified payment cannot close", () => {
  assert.equal(canCloseWon({ quotationAccepted: false, agreementAccepted: false, verifiedPaidMinor: 0, requiredPaidMinor: 100 }), false);
  assert.equal(canCloseWon({ quotationAccepted: true, agreementAccepted: false, verifiedPaidMinor: 100, requiredPaidMinor: 100 }), false);
  assert.equal(canCloseWon({ quotationAccepted: true, agreementAccepted: true, verifiedPaidMinor: 0, requiredPaidMinor: 100 }), false);
  assert.equal(canCloseWon({ quotationAccepted: true, agreementAccepted: true, verifiedPaidMinor: 100, requiredPaidMinor: 100 }), true);
});
test("onboarding checklist has distinct UAT, go-live and handover gates", () => {
  const keys = onboardingSteps.map(([key]) => key);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.includes("UAT") && keys.includes("GO_LIVE") && keys.includes("HANDOVER"));
});
test("client kit requires migration, device, training and signed launch controls", () => {
  assert.equal(onboardingSteps.length, 18);
  assert.deepEqual(missingOnboardingPrerequisites("UAT", {}), ["MIGRATION_SIGNOFF", "HARDWARE", "CONFIGURATION", "TRAINING", "WORKFLOW_TESTS"]);
  assert.deepEqual(missingOnboardingPrerequisites("GO_LIVE", { GO_LIVE_APPROVAL: "PASS" }), []);
  assert.deepEqual(missingOnboardingPrerequisites("HANDOVER", { GO_LIVE: "PASS" }), ["SUPPORT_PLAN"]);
});
test("kit pricing conflicts remain explicit rather than becoming exact approved prices", () => {
  assert.match(marketingDiscrepancies["Enterprise yearly"].description, /40,000\/year.*50,000\/year/);
  assert.match(marketingDiscrepancies["Thermal printer"].description, /14,000.*8,000/);
});
