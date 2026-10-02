import assert from "node:assert/strict";
import test from "node:test";
import { deriveInsights, type Observation } from "../lib/insights";

const at = (
  signal_key: Observation["signal_key"],
  observed_value: boolean,
  date: string,
): Observation => ({
  signal_key,
  observed_value,
  confidence: 0.9,
  observed_at: date,
});

test("unknown evidence stays unknown and segment alone never creates buying intent", () => {
  const result = deriveInsights("HOTEL", []);
  assert.equal(result.fitScore, null);
  assert.equal(result.digitalMaturityScore, null);
  assert.equal(result.buyingIntentScore, null);
  assert.equal(result.candidates[0].confidence, "SEGMENT_ONLY");
});

test("verified business signals raise hotel + restaurant fit and route a bundle candidate", () => {
  const result = deriveInsights("HOTEL", [
    at("RESTAURANT_ON_SITE", true, "2026-09-01T00:00:00Z"),
    at("WEBSITE_EXISTS", false, "2026-09-02T00:00:00Z"),
    at("DIRECT_BOOKING", false, "2026-09-03T00:00:00Z"),
  ]);
  assert.equal(result.fitScore, 69);
  assert.equal(result.digitalMaturityScore, 0);
  assert.equal(result.digitalCoverage, "2/2 relevant signals observed");
  assert.equal(result.candidates[0].product, "HOTEL_RESTAURANT_COMBINED");
  assert.equal(result.candidates[1].product, "WEBSITE");
  assert.equal(result.buyingIntentScore, null);
});

test("most recent observation wins without erasing older evidence", () => {
  const result = deriveInsights("RETAIL", [
    at("WEBSITE_EXISTS", false, "2026-09-01T00:00:00Z"),
    at("WEBSITE_EXISTS", true, "2026-09-10T00:00:00Z"),
    at("ECOMMERCE_EXISTS", false, "2026-09-02T00:00:00Z"),
  ]);
  assert.equal(result.digitalMaturityScore, 50);
  assert.equal(result.fitScore, 45);
  assert.equal(
    result.candidates.some((item) => item.product === "WEBSITE"),
    false,
  );
  assert.equal(
    result.candidates.some((item) => item.product === "ECOMMERCE"),
    true,
  );
});
