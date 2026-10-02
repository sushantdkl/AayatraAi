import assert from "node:assert/strict";
import test from "node:test";
import {
  canPublishCapability,
  canTransition,
  normalizeBusinessName,
  normalizeContact,
} from "../lib/domain";
import { createLeadSchema, createOpportunitySchema } from "../lib/schemas";
import { hashPassword, verifyPassword } from "../lib/password";

test("pipeline allows supported moves and only permits won from payment", () => {
  assert.equal(canTransition("INTERESTED", "HOT"), true);
  assert.equal(canTransition("HOT", "PROPOSAL"), true);
  assert.equal(canTransition("INTERESTED", "PAYMENT"), false);
  assert.equal(canTransition("PAYMENT", "WON"), true);
  assert.equal(canTransition("WON", "INTERESTED"), false);
});

test("customer-facing capabilities require both evidence and approved wording", () => {
  assert.equal(
    canPublishCapability(
      "VERIFIED",
      "https://example.com/proof",
      "Supports room charges",
    ),
    true,
  );
  assert.equal(
    canPublishCapability("VERIFIED", null, "Supports room charges"),
    false,
  );
  assert.equal(
    canPublishCapability("OPTIONAL", "https://example.com/proof", null),
    false,
  );
  assert.equal(
    canPublishCapability("PLANNED", "https://example.com/proof", "Coming soon"),
    false,
  );
});

test("lead input requires source and valid business details", () => {
  const valid = createLeadSchema.parse({
    name: "  Pokhara Inn  ",
    industry: "HOTEL",
    sourceType: "MANUAL",
  });
  assert.equal(valid.name, "Pokhara Inn");
  assert.equal(valid.city, "");
  assert.equal(
    createLeadSchema.safeParse({
      name: "X",
      industry: "HOTEL",
      sourceType: "MANUAL",
    }).success,
    false,
  );
  assert.equal(
    createLeadSchema.safeParse({ name: "Pokhara Inn", industry: "HOTEL" })
      .success,
    false,
  );
  assert.equal(
    createLeadSchema.safeParse({
      name: "Pokhara Inn",
      industry: "HOTEL",
      sourceType: "MANUAL",
      website: "javascript:alert(1)",
    }).success,
    false,
  );
});

test("opportunity value is stored as nonnegative integer minor units", () => {
  const base = {
    leadId: "8ba4bf90-fc4a-4a6a-86ab-19b2769dbc03",
    title: "New hotel website",
    productFamily: "WEBSITE",
  };
  assert.equal(
    createOpportunitySchema.safeParse({ ...base, valueMinor: 500000 }).success,
    true,
  );
  assert.equal(
    createOpportunitySchema.safeParse({ ...base, valueMinor: -1 }).success,
    false,
  );
  assert.equal(
    createOpportunitySchema.safeParse({ ...base, valueMinor: 2.5 }).success,
    false,
  );
});

test("normalization reduces common duplicate forms", () => {
  assert.equal(normalizeBusinessName("  Aayatra   Hotel  "), "aayatra hotel");
  assert.equal(normalizeContact(" SALES@AAYATRA.COM "), "sales@aayatra.com");
});

test("password hashing verifies without storing plaintext", async () => {
  const hash = await hashPassword("a-long-unique-test-password");
  assert.equal(hash.includes("a-long-unique-test-password"), false);
  assert.equal(await verifyPassword("a-long-unique-test-password", hash), true);
  assert.equal(await verifyPassword("wrong-password", hash), false);
});
