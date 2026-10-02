import "dotenv/config";
import { Pool } from "pg";
import { hashPassword } from "../lib/password";

const { DATABASE_URL, BOOTSTRAP_EMAIL, BOOTSTRAP_PASSWORD } = process.env;
if (!DATABASE_URL || !BOOTSTRAP_EMAIL || !BOOTSTRAP_PASSWORD)
  throw new Error("Set DATABASE_URL, BOOTSTRAP_EMAIL and BOOTSTRAP_PASSWORD");
const pool = new Pool({ connectionString: DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const existing = await client.query(
    "SELECT id FROM users WHERE lower(email)=lower($1)",
    [BOOTSTRAP_EMAIL],
  );
  if (existing.rowCount) throw new Error("Bootstrap user already exists");
  const organization = await client.query<{ id: string }>(
    "INSERT INTO organizations(name) VALUES('Aayatra Enterprises') RETURNING id",
  );
  await client.query(
    "INSERT INTO users(organization_id,email,display_name,password_hash,role) VALUES($1,$2,'Owner',$3,'OWNER')",
    [
      organization.rows[0].id,
      BOOTSTRAP_EMAIL.toLowerCase(),
      await hashPassword(BOOTSTRAP_PASSWORD),
    ],
  );
  await client.query("COMMIT");
  console.log(`Created organization and owner ${BOOTSTRAP_EMAIL}`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
