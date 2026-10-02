import "dotenv/config";
import { Pool, type PoolClient } from "pg";
import { PlaywrightDemoBrowser } from "../lib/demo-browser";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query("BEGIN"); const value = await run(client); await client.query("COMMIT"); return value; }
  catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

const job = await transaction(async (client) => {
  const claimed = await client.query<{ id: string; target_id: string; base_url: string; requires_login: boolean; organization_id: string }>(
    `SELECT j.id,j.target_id,t.base_url,t.requires_login,j.organization_id
     FROM demo_jobs j JOIN demo_targets t ON t.id=j.target_id AND t.organization_id=j.organization_id
     WHERE j.status='QUEUED' AND j.job_type='HEALTH_CHECK' AND t.status IN ('READY_FOR_TEST','HEALTHY')
       AND t.synthetic_data_evidence IS NOT NULL AND t.synthetic_data_approved_at IS NOT NULL
     ORDER BY j.created_at FOR UPDATE OF j SKIP LOCKED LIMIT 1`,
  );
  const value = claimed.rows[0];
  if (value) await client.query("UPDATE demo_jobs SET status='RUNNING',updated_at=now() WHERE id=$1", [value.id]);
  return value ?? null;
});

if (!job) { console.log("No eligible demo health job"); await pool.end(); process.exit(0); }
const started = Date.now();
try {
  if (job.requires_login) throw new Error("LOGIN_ADAPTER_NOT_CONFIGURED: login flow needs reviewed selectors and secret references");
  const result = await new PlaywrightDemoBrowser().inspect(job.base_url);
  await transaction(async (client) => {
    await client.query("UPDATE demo_jobs SET status='AWAITING_REVIEW',output_reference=$2,duration_ms=$3,updated_at=now() WHERE id=$1", [job.id,JSON.stringify(result),Date.now() - started]);
    await client.query("UPDATE demo_targets SET last_health_check=now(),status='PENDING_REVIEW',updated_at=now() WHERE id=$1 AND organization_id=$2", [job.target_id,job.organization_id]);
  });
  console.log(`Demo health job ${job.id} captured navigation for human review`);
} catch (error) {
  const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown demo check failure";
  await transaction(async (client) => {
    await client.query("UPDATE demo_jobs SET status='FAILED',failure_reason=$2,duration_ms=$3,updated_at=now() WHERE id=$1", [job.id,message,Date.now() - started]);
    await client.query("UPDATE demo_targets SET last_health_check=now(),status='FAILED',updated_at=now() WHERE id=$1 AND organization_id=$2", [job.target_id,job.organization_id]);
  });
  console.error(`Demo health job ${job.id} failed: ${message}`);
  process.exitCode = 1;
} finally { await pool.end(); }
