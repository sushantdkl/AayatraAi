import assert from "node:assert/strict";
import test from "node:test";
import { draftReply, draftFollowUp, type ReplyContext } from "../lib/ai-replies";
import { featureDefinitions, salesPolicy, type FeatureRecord } from "../lib/feature-matrix";
import { posterCatalogue, rupeesToMinor } from "../lib/owner-config";

const features: FeatureRecord[] = featureDefinitions.map((definition) => ({
  product_family: definition.productFamily, feature_key: definition.key, name: definition.name,
  implementation_status: definition.seedStatus, commercial_status: definition.seedCommercial ?? salesPolicy[definition.seedStatus].defaultCommercial,
  approved_language: null, limitations: definition.limitations ?? null, conditions: null, keywords: definition.keywords,
}));
const context = (overrides: Partial<ReplyContext> = {}): ReplyContext => ({
  company: { name: "Aayatra Enterprises", brand: "Aadhar POS", whatsapp: "+977 9804573494", taxStatus: "PAN_ONLY", panNumber: null, panVerified: false },
  prices: Object.fromEntries(posterCatalogue.map((item) => [item.sku, rupeesToMinor(item.rupees)])),
  features, demoLinks: {}, leadFamily: null, temperature: "COLD", ...overrides,
});

test("restaurant price reply quotes all canonical poster prices and cites them", () => {
  const draft = draftReply("Restaurant ko lagi price kati ho?", context());
  assert.equal(draft.intent, "PRICE_QUERY");
  assert.equal(draft.language, "NE_ROMAN");
  assert.equal(draft.temperature, "INTERESTED");
  for (const price of ["NPR 15,000", "NPR 1,500", "NPR 25,000", "NPR 2,500", "NPR 40,000", "NPR 4,000"]) assert.match(draft.body ?? "", new RegExp(price));
  assert.equal(draft.requiresHuman, false);
  assert.equal(draft.autoSendEligible, true);
  assert.ok(draft.citations.skus.includes("RESTAURANT_ENTERPRISE_YEARLY"));
});
test("retail and hardware replies use the approved poster wording and values", () => {
  const retail = draftReply("How much is the POS for my retail shop?", context());
  assert.match(retail.body ?? "", /NPR 1,000\/month, NPR 10,000\/year, or a NPR 30,000 one-time setup/);
  assert.match(retail.body ?? "", /Already have the equipment\?/);
  const hardware = draftReply("printer ko price?", context());
  assert.match(hardware.body ?? "", /NPR 14,000.*NPR 20,000.*NPR 8,000/);
});
test("prices are never invented when the catalogue is not active", () => {
  const draft = draftReply("restaurant price?", context({ prices: {} }));
  assert.doesNotMatch(draft.body ?? "", /NPR/);
  assert.equal(draft.requiresHuman, true);
});
test("final-price requests negotiate without any discount figure and need a human", () => {
  const draft = draftReply("Growth package final kati?", context({ leadFamily: "RESTAURANT_SYSTEM" }));
  assert.equal(draft.intent, "NEGOTIATION");
  assert.equal(draft.temperature, "NEGOTIATING");
  assert.equal(draft.requiresHuman, true);
  assert.equal(draft.autoSendEligible, false);
  assert.ok(draft.nextActions.includes("MOVE_TO_NEGOTIATING"));
  assert.match(draft.body ?? "", /NPR 25,000/);
  assert.doesNotMatch(draft.body ?? "", /%|discount of|NPR 2[0-4],/i);
});
test("multi-branch is never promised; the owner's escalation wording is used", () => {
  const draft = draftReply("Does Enterprise support multi branch for my 3 restaurant outlets?", context());
  assert.match(draft.body ?? "", /Multi-branch capability needs to be confirmed against the current deployment\/version/);
  assert.equal(draft.requiresHuman, true);
  assert.ok(draft.citations.features.includes("MULTI_BRANCH"));
});
test("unverified features are not guessed", () => {
  const draft = draftReply("KOT print milcha?", context({ leadFamily: "RESTAURANT_SYSTEM" }));
  assert.equal(draft.requiresHuman, true);
  assert.match(draft.body ?? "", /confirm/i);
  assert.doesNotMatch(draft.body ?? "", /^Ho —|^Yes/);
});
test("verified features are sold with approved wording only", () => {
  const verified = features.map((feature) => feature.feature_key === "KOT" ? { ...feature, implementation_status: "VERIFIED_AVAILABLE" as const, approved_language: "orders print KOT tickets in the kitchen automatically" } : feature);
  const draft = draftReply("Does it support KOT?", context({ features: verified, leadFamily: "RESTAURANT_SYSTEM" }));
  assert.equal(draft.body, "Yes — orders print KOT tickets in the kitchen automatically.");
  assert.equal(draft.requiresHuman, false);
});
test("PAN-only VAT answer never adds VAT and never claims IRD certification", () => {
  const vat = draftReply("Is VAT included?", context());
  assert.match(vat.body ?? "", /VAT is not separately charged/);
  const ird = draftReply("Is your software IRD approved?", context({ company: { name: "Aayatra Enterprises", brand: "Aadhar POS", whatsapp: null, taxStatus: "PAN_ONLY", panNumber: "123456789", panVerified: true } }));
  assert.match(ird.body ?? "", /PAN-registered/);
  assert.match(ird.body ?? "", /don't describe the Aadhar POS software itself as IRD-certified/);
  assert.equal(ird.requiresHuman, true);
  const unverified = draftReply("PAN number?", context());
  assert.doesNotMatch(unverified.body ?? "", /PAN-registered/);
});
test("payment replies never claim money was received", () => {
  const draft = draftReply("QR send garnu, proceed garam", context());
  assert.equal(draft.temperature, "PAYMENT_PENDING");
  assert.equal(draft.requiresHuman, true);
  assert.ok(draft.nextActions.includes("CREATE_PAYMENT_REQUEST"));
  assert.doesNotMatch(draft.body ?? "", /received|confirmed your payment|paid/i);
});
test("not interested stops follow-ups and opt-out sends nothing", () => {
  const no = draftReply("not interested", context({ temperature: "INTERESTED" }));
  assert.equal(no.temperature, "NOT_INTERESTED");
  assert.ok(no.nextActions.includes("STOP_FOLLOW_UP"));
  const stop = draftReply("Stop messaging me", context());
  assert.equal(stop.body, null);
  assert.ok(stop.nextActions.includes("RECORD_OPT_OUT"));
});
test("replies follow the prospect's language", () => {
  assert.match(draftReply("नमस्ते", context()).body ?? "", /धन्यवाद/);
  assert.match(draftReply("रेस्टुरेन्टको मूल्य कति हो?", context()).body ?? "", /वर्ष/);
  assert.match(draftReply("hello", context()).body ?? "", /Thank you for contacting Aayatra Enterprises/);
});
test("demo replies link only an owner-reviewed demo URL", () => {
  assert.doesNotMatch(draftReply("demo pathaunu", context()).body ?? "", /https:/);
  const linked = draftReply("demo pathaunu restaurant ko", context({ demoLinks: { RESTAURANT_SYSTEM: "https://demo.example.com" } }));
  assert.match(linked.body ?? "", /https:\/\/demo\.example\.com/);
});
test("follow-ups exist for active temperatures and never for closed ones", () => {
  assert.ok(draftFollowUp("HOT", "EN", 1));
  assert.equal(draftFollowUp("NOT_INTERESTED", "EN", 1), null);
  assert.equal(draftFollowUp("CLOSED_WON", "NE", 1), null);
});

test("conversation memory summary is human-readable", async () => {
  const { memorySummary } = await import("../lib/reply-pipeline");
  assert.equal(memorySummary({ interest: ["AADHAR_RETAIL_ERP"], package: "GROWTH", billing: "MONTH", temperature: "PAYMENT_PENDING", nextAction: "CREATE_PAYMENT_REQUEST" }),
    "Interest: Aadhar retail erp · Package: Growth (monthly) · Stage: Payment pending · Next: Create payment request");
});
