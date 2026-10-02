import "dotenv/config";
import { Pool } from "pg";
import { applyOwnerConfig } from "../lib/owner-config-apply";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  const owners = await client.query<{ id: string; organization_id: string }>(
    "SELECT DISTINCT ON (organization_id) id,organization_id FROM users WHERE role='OWNER' AND active ORDER BY organization_id,created_at",
  );
  if (!owners.rowCount) throw new Error("No owner account exists; run npm run db:bootstrap first");
  for (const owner of owners.rows) {
    await client.query("BEGIN");
    try {
      const result = await applyOwnerConfig(client, owner.organization_id, owner.id);
      await client.query("COMMIT");
      console.log(`Organization ${owner.organization_id}:`, result);
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  }
} finally { client.release(); await pool.end(); }
