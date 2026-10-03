import assert from "node:assert/strict";
import test from "node:test";
import { quoteApprovalRequirement } from "../lib/quote-policy";

const standard = { sku: "RESTAURANT_GROWTH_YEARLY", kind: "SOFTWARE", approvalRequired: false, commercialSource: "OWNER_APPROVED_POSTER_2026" };
test("standard undiscounted poster quote is auto-approved", () => {
  assert.deepEqual(quoteApprovalRequirement({ discountMinor: 0, lines: [standard], policyApproved: true, exceptions: [] }), { autoApprove: true, reasons: [] });
});
test("discount, custom work, multi-branch and non-standard hardware need a human", () => {
  assert.deepEqual(quoteApprovalRequirement({ discountMinor: 100, lines: [standard], policyApproved: true, exceptions: [] }).reasons, ["DISCOUNT"]);
  assert.ok(quoteApprovalRequirement({ discountMinor: 0, lines: [standard], policyApproved: true, exceptions: ["MULTI_BRANCH_PROMISE", "CUSTOM_SLA"] }).reasons.includes("MULTI_BRANCH_PROMISE"));
  const hw = quoteApprovalRequirement({ discountMinor: 0, lines: [{ sku: null, kind: "HARDWARE", approvalRequired: false, commercialSource: "supplier quote" }], policyApproved: true, exceptions: [] });
  assert.deepEqual(hw, { autoApprove: false, reasons: ["NON_STANDARD_HARDWARE"] });
  assert.equal(quoteApprovalRequirement({ discountMinor: 0, lines: [standard], policyApproved: false, exceptions: [] }).autoApprove, false);
});
