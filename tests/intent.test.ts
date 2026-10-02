import assert from "node:assert/strict";
import test from "node:test";
import { classifyIntent } from "../lib/intent";

test("explicit opt-out overrides a price question", () => {
  assert.equal(classifyIntent("What is the price? Do not contact me again.").intent, "DO_NOT_CONTACT");
});
test("price and demo interest remain human-led until verified data and policy exist", () => {
  assert.deepEqual(classifyIntent("Restaurant software kati parcha?"), { intent: "PRICE_QUERY", needsHuman: true, reason: "Pricing question needs verified commercial record" });
  assert.equal(classifyIntent("Please show me a demo").intent, "DEMO_REQUEST");
});
test("unclear mixed-language messages do not receive fabricated confidence", () => {
  const result = classifyIntent("hajur tyo kura heram");
  assert.equal(result.intent, "UNKNOWN");
  assert.equal(result.needsHuman, true);
  assert.equal("confidence" in result, false);
});
