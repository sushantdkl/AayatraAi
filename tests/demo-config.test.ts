import assert from "node:assert/strict";
import test from "node:test";
import { demoTargetSchema, publicDemoUrl } from "../lib/automation-schemas";

test("demo URLs reject localhost, HTTP, credentials, fragments and raw IPs", () => {
  for (const value of ["http://demo.example.com", "https://localhost", "https://127.0.0.1", "https://user:pass@demo.example.com", "https://demo.example.com/#secret"])
    assert.equal(publicDemoUrl.safeParse(value).success, false, value);
  assert.equal(publicDemoUrl.safeParse("https://demo.example.com/app").success, true);
});
test("missing demo URL remains valid but cannot be enabled", () => {
  const base = { productFamily: "RETAIL_ERP", name: "Retail demo", baseUrl: null, environment: "DEMO" };
  assert.equal(demoTargetSchema.safeParse(base).success, true);
  assert.equal(demoTargetSchema.safeParse({ ...base, enabled: true }).success, false);
  assert.equal(demoTargetSchema.safeParse({ ...base, allowMutations: true }).success, false);
});
