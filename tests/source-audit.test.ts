import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { auditSource } from "../lib/source-audit";

function tree(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "dimsum-"));
  for (const [path, body] of Object.entries(files)) { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), body); }
  return root;
}

test("routes + schema + tests propose PARTIAL; routes alone stay UNKNOWN; multi-branch stays NOT_AVAILABLE", async () => {
  const root = tree({
    "AADHAR_RESTAURANT_PRODUCT_AUDIT.md": "Multi-branch tenancy: future work. No branch_id model.\nKOT printing implemented.",
    "app/api/kot/route.ts": "export {}", "migrations/003_kot.sql": "CREATE TABLE kot_tickets (id uuid);", "tests/kot.test.ts": "",
    "app/api/payroll/route.ts": "export {}",
    "node_modules/x/app/api/branches/route.ts": "",
  });
  const result = await auditSource(root);
  const by = Object.fromEntries(result.features.map((feature) => [feature.featureKey, feature]));
  assert.equal(by.KOT.proposedStatus, "PARTIAL");
  assert.equal(by.PAYROLL.proposedStatus, "UNKNOWN");
  assert.equal(by.MULTI_BRANCH.proposedStatus, "NOT_AVAILABLE");
  assert.equal(by.MULTI_BRANCH.routes.length, 0);
  assert.ok(result.features.every((feature) => feature.proposedStatus !== "VERIFIED_AVAILABLE"));
  assert.equal(result.audit, "AADHAR_RESTAURANT_PRODUCT_AUDIT.md");
});
