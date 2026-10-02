import assert from "node:assert/strict";
import test from "node:test";
import { classifyIntent, detectLanguage, extractSignals } from "../lib/intent";
import { nextTemperature, temperatureForIntent } from "../lib/sales-temperature";

test("explicit opt-out overrides a price question", () => {
  assert.equal(classifyIntent("What is the price? Do not contact me again.").intent, "DO_NOT_CONTACT");
});
test("price questions are answerable from the canonical catalogue; demo requests are recognised", () => {
  assert.deepEqual(classifyIntent("Restaurant software kati parcha?"), { intent: "PRICE_QUERY", needsHuman: false, reason: "Pricing question answered from canonical catalogue" });
  assert.equal(classifyIntent("Please show me a demo").intent, "DEMO_REQUEST");
});
test("unclear mixed-language messages do not receive fabricated confidence", () => {
  const result = classifyIntent("tyo kura heram");
  assert.equal(result.intent, "UNKNOWN");
  assert.equal(result.needsHuman, true);
  assert.equal("confidence" in result, false);
});

const temperatureOf = (message: string) => nextTemperature("COLD", temperatureForIntent(classifyIntent(message).intent));
test("§21 buying-intent examples map to the owner's temperatures", () => {
  assert.equal(temperatureOf("price kati ho?"), "INTERESTED");
  assert.equal(temperatureOf("demo pathaunu"), "HOT");
  assert.equal(temperatureOf("Growth package final kati?"), "NEGOTIATING");
  assert.equal(temperatureOf("proposal pathaunu"), "READY_TO_BUY");
  assert.equal(temperatureOf("QR send garnu, proceed garam"), "PAYMENT_PENDING");
  assert.equal(temperatureOf("not interested"), "NOT_INTERESTED");
});
test("Devanagari Nepali is classified without word boundaries", () => {
  assert.equal(classifyIntent("मूल्य कति हो?").intent, "PRICE_QUERY");
  assert.equal(classifyIntent("डेमो देखाउनु").intent, "DEMO_REQUEST");
  assert.equal(classifyIntent("प्रस्ताव पठाउनुहोस्").intent, "PROPOSAL_REQUEST");
  assert.equal(classifyIntent("अहिले चाहिँदैन").intent, "NOT_INTERESTED");
});
test("temperature never regresses from message text, except an explicit no; revival is allowed", () => {
  assert.equal(nextTemperature("READY_TO_BUY", "INTERESTED"), "READY_TO_BUY");
  assert.equal(nextTemperature("PAYMENT_PENDING", "NOT_INTERESTED"), "NOT_INTERESTED");
  assert.equal(nextTemperature("NOT_INTERESTED", "HOT"), "HOT");
  assert.equal(nextTemperature("CLOSED_WON", "NOT_INTERESTED"), "CLOSED_WON");
  assert.equal(nextTemperature("HOT", "PROPOSAL_SENT"), "HOT");
});
test("language detection distinguishes English, Devanagari and Romanized Nepali", () => {
  assert.equal(detectLanguage("What does the Growth plan include?"), "EN");
  assert.equal(detectLanguage("मूल्य कति हो?"), "NE");
  assert.equal(detectLanguage("price kati ho?"), "NE_ROMAN");
  assert.equal(detectLanguage("malai restaurant ko lagi system chahiyo"), "NE_ROMAN");
});
test("signals extract family, package and billing", () => {
  assert.deepEqual(extractSignals("Growth package monthly for my cafe"), { productFamily: "RESTAURANT_SYSTEM", packageCode: "GROWTH", billing: "MONTH", mentionsHardware: false, hasEquipment: false });
  assert.equal(extractSignals("mero kirana pasal ko lagi").productFamily, "RETAIL_ERP");
  assert.equal(extractSignals("hotel and restaurant both").productFamily, "HOTEL_RESTAURANT_COMBINED");
});
