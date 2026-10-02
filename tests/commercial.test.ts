import assert from "node:assert/strict";
import test from "node:test";
import { CommercialReviewRequired, resolveActivePrice } from "../lib/commercial";

const item = {
  catalog_status: "ACTIVE",
  verification_status: "VERIFIED",
  is_active: true,
  approval_required: false,
  effective_from: null,
  effective_to: null,
};

test("marketing drafts and human-approval prices cannot be quoted automatically", () => {
  const source = [{ price_minor: 1500000, is_canonical: true, active: true }];
  assert.throws(() => resolveActivePrice({ ...item, catalog_status: "DRAFT" }, source), CommercialReviewRequired);
  assert.throws(() => resolveActivePrice({ ...item, approval_required: true }, source), CommercialReviewRequired);
});

test("conflicting active price sources fail safely without a canonical source", () => {
  const sources = [
    { price_minor: 4000000, is_canonical: false, active: true },
    { price_minor: 4500000, is_canonical: false, active: true },
  ];
  assert.throws(() => resolveActivePrice(item, sources), (error) => error instanceof CommercialReviewRequired && error.code === "COMMERCIAL_PRICE_REVIEW_REQUIRED");
  assert.equal(resolveActivePrice(item, [{ ...sources[0], is_canonical: true }, sources[1]]), 4000000);
});

test("expired prices and unsafe minor-unit values are rejected", () => {
  assert.throws(() => resolveActivePrice({ ...item, effective_to: "2020-01-01" }, [{ price_minor: 100, is_canonical: true, active: true }]), CommercialReviewRequired);
  assert.throws(() => resolveActivePrice(item, [{ price_minor: "9007199254740993", is_canonical: true, active: true }]), CommercialReviewRequired);
});
