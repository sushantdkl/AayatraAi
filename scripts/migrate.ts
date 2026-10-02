import "dotenv/config";
import { config } from "dotenv";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";

if (process.argv.includes("--e2e")) config({ path: ".env.e2e.local", override: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString });
try {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const files = (await readdir(join(process.cwd(), "db")))
    .filter((name) => /^\d+_.*\.sql$/.test(name))
    .sort();
  let count = 0;
  for (const name of files) {
    const applied = await pool.query(
      "SELECT 1 FROM schema_migrations WHERE name=$1",
      [name],
    );
    if (applied.rowCount) continue;
    const sql = await readFile(join(process.cwd(), "db", name), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(name) VALUES($1)", [
        name,
      ]);
      await client.query("COMMIT");
      console.log(`Applied ${name}`);
      count++;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  if (!count) console.log("Database is up to date");
} finally {
  await pool.end();
}
