import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";

test(
  "database enforces tenant ownership references and records source + stage history",
  { skip: !process.env.DATABASE_URL },
  async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const org = await client.query<{ id: string }>(
        "INSERT INTO organizations(name) VALUES('Test tenant') RETURNING id",
      );
      const org2 = await client.query<{ id: string }>(
        "INSERT INTO organizations(name) VALUES('Other tenant') RETURNING id",
      );
      const user = await client.query<{ id: string }>(
        "INSERT INTO users(organization_id,email,display_name,password_hash,role) VALUES($1,'test@local','Tester','not-a-real-hash','OWNER') RETURNING id",
        [org.rows[0].id],
      );
      const business = await client.query<{ id: string }>(
        "INSERT INTO businesses(organization_id,name,normalized_name,industry) VALUES($1,'Test Hotel','test hotel','HOTEL') RETURNING id",
        [org.rows[0].id],
      );
      const source = await client.query<{ id: string }>(
        "INSERT INTO source_records(organization_id,business_id,source_type,created_by) VALUES($1,$2,'MANUAL',$3) RETURNING id",
        [org.rows[0].id, business.rows[0].id, user.rows[0].id],
      );
      const lead = await client.query<{ id: string }>(
        "INSERT INTO leads(organization_id,business_id,source_record_id) VALUES($1,$2,$3) RETURNING id",
        [org.rows[0].id, business.rows[0].id, source.rows[0].id],
      );
      const opportunity = await client.query<{ id: string }>(
        "INSERT INTO opportunities(organization_id,lead_id,title,product_family) VALUES($1,$2,'Hotel website','WEBSITE') RETURNING id",
        [org.rows[0].id, lead.rows[0].id],
      );
      await client.query(
        "INSERT INTO stage_history(organization_id,opportunity_id,to_stage,reason,actor_id) VALUES($1,$2,'INTERESTED','Created',$3)",
        [org.rows[0].id, opportunity.rows[0].id, user.rows[0].id],
      );
      const count = await client.query<{ count: string }>(
        "SELECT count(*) FROM stage_history WHERE opportunity_id=$1 AND organization_id=$2",
        [opportunity.rows[0].id, org.rows[0].id],
      );
      assert.equal(count.rows[0].count, "1");
      const crossTenant = await client.query(
        "SELECT * FROM leads WHERE id=$1 AND organization_id=$2",
        [lead.rows[0].id, org2.rows[0].id],
      );
      assert.equal(crossTenant.rowCount, 0);
      await client.query("SAVEPOINT cross_tenant_check");
      await assert.rejects(
        client.query(
          "INSERT INTO contacts(organization_id,business_id,email,contact_source) VALUES($1,$2,'wrong@local','test')",
          [org2.rows[0].id, business.rows[0].id],
        ),
        { code: "23503" },
      );
      await client.query("ROLLBACK TO SAVEPOINT cross_tenant_check");
      const capability = await client.query<{ id: string }>(
        "INSERT INTO product_capabilities(organization_id,product_family,capability_name) VALUES($1,'HOTEL_SYSTEM','Room management') RETURNING id",
        [org.rows[0].id],
      );
      const version = await client.query<{ id: string }>(
        "INSERT INTO capability_versions(organization_id,capability_id,version,status,actor_id) VALUES($1,$2,1,'UNVERIFIED',$3) RETURNING id",
        [org.rows[0].id, capability.rows[0].id, user.rows[0].id],
      );
      await client.query("SAVEPOINT immutable_check");
      await assert.rejects(
        client.query(
          "UPDATE capability_versions SET status='VERIFIED' WHERE id=$1",
          [version.rows[0].id],
        ),
        /append-only/,
      );
      await client.query("ROLLBACK TO SAVEPOINT immutable_check");
      await client.query("ROLLBACK");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
      await pool.end();
    }
  },
);
