import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";
import { marketingSnapshot } from "../lib/marketing-snapshot";
import { marketingDiscrepancies } from "../lib/client-kit";
import { applyOwnerConfig } from "../lib/owner-config-apply";
import { LEGACY_SNAPSHOT_SOURCE } from "../lib/owner-config";

test("owner config supersedes (never deletes) old drafts, resolves their conflicts, seeds PAN-only and is idempotent",
  { skip: !process.env.DATABASE_URL }, async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const org = await client.query<{ id: string }>("INSERT INTO organizations(name) VALUES('Owner config test') RETURNING id");
      const orgId = org.rows[0].id;
      const owner = await client.query<{ id: string }>("INSERT INTO users(organization_id,email,display_name,password_hash,role) VALUES($1,'owner-config@test','Owner','x','OWNER') RETURNING id", [orgId]);
      for (const item of marketingSnapshot) {
        const created = await client.query<{ id: string }>(
          "INSERT INTO commercial_items(organization_id,product_family,kind,name,billing_type,billing_period,source) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",
          [orgId, item.productFamily, item.kind, item.name, item.billingType, item.billingPeriod, LEGACY_SNAPSHOT_SOURCE],
        );
        await client.query("INSERT INTO commercial_price_sources(organization_id,item_id,price_minor,source_name) VALUES($1,$2,$3,'legacy')", [orgId, created.rows[0].id, item.priceMinor]);
        const discrepancy = marketingDiscrepancies[item.name];
        if (discrepancy) await client.query("INSERT INTO commercial_discrepancies(organization_id,item_id,code,description,source_reference) VALUES($1,$2,$3,$4,$5)", [orgId, created.rows[0].id, discrepancy.code, discrepancy.description, discrepancy.sourceReference]);
      }
      const first = await applyOwnerConfig(client, orgId, owner.rows[0].id, {});
      assert.equal(first.catalogueCreated, 12);
      assert.equal(first.legacySuperseded, marketingSnapshot.length);
      assert.equal(first.policy, "APPROVED_PAN_ONLY");
      const legacy = await client.query("SELECT catalog_status,superseded_by FROM commercial_items WHERE organization_id=$1 AND source=$2", [orgId, LEGACY_SNAPSHOT_SOURCE]);
      assert.equal(legacy.rowCount, marketingSnapshot.length, "old values are kept");
      assert.ok(legacy.rows.every((row) => row.catalog_status === "SUPERSEDED" && row.superseded_by));
      const open = await client.query("SELECT 1 FROM commercial_discrepancies WHERE organization_id=$1 AND status='OPEN'", [orgId]);
      assert.equal(open.rowCount, 0);
      const enterprise = await client.query<{ price_minor: string }>(
        "SELECT s.price_minor FROM commercial_items i JOIN commercial_price_sources s ON s.item_id=i.id WHERE i.organization_id=$1 AND i.sku='RESTAURANT_ENTERPRISE_YEARLY' AND i.catalog_status='ACTIVE' AND s.is_canonical", [orgId]);
      assert.equal(Number(enterprise.rows[0].price_minor), 4000000);
      const policy = await client.query("SELECT status,tax_mode,tax_rate_bps,max_auto_discount_bps,max_manual_discount_bps FROM commercial_policies WHERE organization_id=$1", [orgId]);
      assert.deepEqual(policy.rows[0], { status: "APPROVED", tax_mode: "PAN_ONLY", tax_rate_bps: 0, max_auto_discount_bps: 0, max_manual_discount_bps: 0 });
      const branch = await client.query("SELECT implementation_status,commercial_status FROM product_features WHERE organization_id=$1 AND feature_key='MULTI_BRANCH'", [orgId]);
      assert.deepEqual(branch.rows[0], { implementation_status: "NOT_AVAILABLE", commercial_status: "NOT_SALES_SAFE" });
      const demos = await client.query("SELECT status FROM demo_targets WHERE organization_id=$1", [orgId]);
      assert.equal(demos.rowCount, 5);
      assert.ok(demos.rows.every((row) => row.status === "WAITING_FOR_DEMO_URL"));
      const second = await applyOwnerConfig(client, orgId, owner.rows[0].id, {});
      assert.deepEqual({ ...second }, { companyProfile: "KEPT", policy: "KEPT", catalogueCreated: 0, legacySuperseded: 0, featuresSeeded: 0, demoTargetsSeeded: 0, automationAssisted: 0 });
      await assert.rejects(client.query("UPDATE company_profiles SET tax_status='VAT_REGISTERED' WHERE organization_id=$1", [orgId]), /check/i, "VAT status needs its own verified evidence");
    } finally {
      await client.query("ROLLBACK");
      client.release();
      await pool.end();
    }
  });
