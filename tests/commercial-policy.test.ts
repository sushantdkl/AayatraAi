import assert from "node:assert/strict";
import test from "node:test";
import { calculateQuoteAmounts, type CommercialPolicySnapshot } from "../lib/commercial-policy";
import { CommercialReviewRequired } from "../lib/commercial";

const approved: CommercialPolicySnapshot = {
  status: "APPROVED", version: 3, tax_mode: "EXCLUSIVE", tax_rate_bps: 1300, max_manual_discount_bps: 1000,
};

test("unapproved policy keeps a quotation in review and forbids invented tax", () => {
  assert.deepEqual(calculateQuoteAmounts({ subtotalMinor: 10000, discountMinor: 0, submittedTaxMinor: 0, floorTotalMinor: null, policy: null }), {
    taxMinor: 0, totalMinor: 10000, policyVersion: null, needsPolicyReview: true,
  });
  assert.throws(() => calculateQuoteAmounts({ subtotalMinor: 10000, discountMinor: 0, submittedTaxMinor: 1300, floorTotalMinor: null, policy: null }), CommercialReviewRequired);
});

test("discount requires approved limit and item floors", () => {
  const base = { subtotalMinor: 10000, submittedTaxMinor: 0, policy: approved, companyTaxStatus: "VAT_REGISTERED" as const, lineFloors: [{ lineTotalMinor: 10000, floorMinor: 9000 }] };
  assert.throws(() => calculateQuoteAmounts({ ...base, discountMinor: 100, floorTotalMinor: null }), CommercialReviewRequired);
  assert.throws(() => calculateQuoteAmounts({ ...base, discountMinor: 1001, floorTotalMinor: 0 }), CommercialReviewRequired);
  assert.throws(() => calculateQuoteAmounts({ ...base, discountMinor: 500, floorTotalMinor: 9600 }), CommercialReviewRequired);
  assert.deepEqual(calculateQuoteAmounts({ ...base, discountMinor: 500, floorTotalMinor: 9000 }), {
    taxMinor: 1235, totalMinor: 10735, policyVersion: 3, needsPolicyReview: false,
  });
});

test("a quote-wide discount cannot hide one line below its floor behind another line", () => {
  assert.throws(() => calculateQuoteAmounts({ subtotalMinor: 20000, discountMinor: 1000, submittedTaxMinor: 0,
    floorTotalMinor: 18000, lineFloors: [{ lineTotalMinor: 10000, floorMinor: 9900 }, { lineTotalMinor: 10000, floorMinor: 8100 }], policy: approved, companyTaxStatus: "VAT_REGISTERED" }), CommercialReviewRequired);
});

test("tax is calculated server-side and cannot be supplied at a different amount", () => {
  assert.throws(() => calculateQuoteAmounts({ subtotalMinor: 10000, discountMinor: 0, submittedTaxMinor: 1200, floorTotalMinor: null, policy: approved, companyTaxStatus: "VAT_REGISTERED" }), CommercialReviewRequired);
  assert.equal(calculateQuoteAmounts({ subtotalMinor: 10000, discountMinor: 0, submittedTaxMinor: 0, floorTotalMinor: null, policy: approved, companyTaxStatus: "VAT_REGISTERED" }).taxMinor, 1300);
});

test("PAN-only policy never adds VAT: Growth annual NPR 25,000 totals NPR 25,000", () => {
  const panOnly = { status: "APPROVED" as const, version: 1, tax_mode: "PAN_ONLY" as const, tax_rate_bps: 0, max_manual_discount_bps: 0 };
  const result = calculateQuoteAmounts({ subtotalMinor: 2500000, discountMinor: 0, submittedTaxMinor: 0, floorTotalMinor: null, policy: panOnly, companyTaxStatus: "PAN_ONLY" });
  assert.deepEqual(result, { taxMinor: 0, totalMinor: 2500000, policyVersion: 1, needsPolicyReview: false });
  assert.throws(() => calculateQuoteAmounts({ subtotalMinor: 2500000, discountMinor: 0, submittedTaxMinor: 325000, floorTotalMinor: null, policy: panOnly, companyTaxStatus: "PAN_ONLY" }), /approved policy/);
});

test("VAT is never inferred from PAN registration", () => {
  const vat = { status: "APPROVED" as const, version: 2, tax_mode: "EXCLUSIVE" as const, tax_rate_bps: 1300, max_manual_discount_bps: 0 };
  assert.throws(() => calculateQuoteAmounts({ subtotalMinor: 2500000, discountMinor: 0, submittedTaxMinor: 0, floorTotalMinor: null, policy: vat, companyTaxStatus: "PAN_ONLY" }), /not verified as VAT-registered/);
  assert.equal(calculateQuoteAmounts({ subtotalMinor: 2500000, discountMinor: 0, submittedTaxMinor: 0, floorTotalMinor: null, policy: vat, companyTaxStatus: "VAT_REGISTERED" }).taxMinor, 325000);
});

test("zero discount ceiling rejects any discount even with floors", () => {
  const panOnly = { status: "APPROVED" as const, version: 1, tax_mode: "PAN_ONLY" as const, tax_rate_bps: 0, max_manual_discount_bps: 0 };
  assert.throws(() => calculateQuoteAmounts({ subtotalMinor: 2500000, discountMinor: 100000, submittedTaxMinor: 0, floorTotalMinor: 2000000, lineFloors: [{ lineTotalMinor: 2500000, floorMinor: 2000000 }], policy: panOnly, companyTaxStatus: "PAN_ONLY" }), /manual limit/);
});
