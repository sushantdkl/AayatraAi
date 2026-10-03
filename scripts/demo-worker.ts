import "dotenv/config";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Pool, type PoolClient } from "pg";
import { PlaywrightDemoBrowser, type DemoLogin } from "../lib/demo-browser";
import { renderDemoVideo } from "../lib/demo-video";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query("BEGIN"); const value = await run(client); await client.query("COMMIT"); return value; }
  catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

type Job = { id: string; target_id: string; script_id: string | null; job_type: "HEALTH_CHECK" | "SCRIPT_TEST" | "VIDEO"; base_url: string; login_url: string | null; requires_login: boolean;
  username_secret_ref: string | null; password_secret_ref: string | null; navigation_profile: Record<string, string>; organization_id: string };

const job = await transaction(async (client) => {
  const claimed = await client.query<Job>(
    `SELECT j.id,j.target_id,j.script_id,j.job_type,t.base_url,t.login_url,t.requires_login,t.username_secret_ref,t.password_secret_ref,t.navigation_profile,j.organization_id
     FROM demo_jobs j JOIN demo_targets t ON t.id=j.target_id AND t.organization_id=j.organization_id
     WHERE j.status='QUEUED' AND t.status IN ('READY_FOR_TEST','HEALTHY')
       AND t.synthetic_data_evidence IS NOT NULL AND t.synthetic_data_approved_at IS NOT NULL
     ORDER BY j.created_at FOR UPDATE OF j SKIP LOCKED LIMIT 1`,
  );
  const value = claimed.rows[0];
  if (value) await client.query("UPDATE demo_jobs SET status='RUNNING',updated_at=now() WHERE id=$1", [value.id]);
  return value ?? null;
});

if (!job) { console.log("No eligible demo job"); await pool.end(); process.exit(0); }
const started = Date.now();
const browser = new PlaywrightDemoBrowser();

function syntheticLogin(target: Job): DemoLogin | null {
  if (!target.requires_login) return null;
  const profile = target.navigation_profile ?? {};
  const username = target.username_secret_ref ? process.env[target.username_secret_ref] : undefined;
  const password = target.password_secret_ref ? process.env[target.password_secret_ref] : undefined;
  if (!username || !password || !target.login_url || !profile.usernameSelector || !profile.passwordSelector || !profile.submitSelector)
    throw new Error("LOGIN_NOT_CONFIGURED: set login URL, secret references in the environment and reviewed selectors (usernameSelector/passwordSelector/submitSelector)");
  return { loginUrl: target.login_url, username, password, usernameSelector: profile.usernameSelector, passwordSelector: profile.passwordSelector, submitSelector: profile.submitSelector, successSelector: profile.successSelector ?? null };
}

try {
  let output: unknown;
  if (job.job_type === "HEALTH_CHECK") {
    if (job.requires_login) syntheticLogin(job);
    output = await browser.inspect(job.base_url);
  } else {
    if (!job.script_id) throw new Error("A reviewed script is required");
    const steps = (await pool.query("SELECT action,route,selector,caption,duration_hint_ms AS \"durationHintMs\",is_mutating AS \"isMutating\" FROM demo_script_steps WHERE script_id=$1 AND organization_id=$2 ORDER BY step_order", [job.script_id,job.organization_id])).rows;
    const outDir = resolve(process.env.DEMO_OUTPUT_DIR ?? join(process.cwd(), "storage", "demo"), job.organization_id, job.id);
    await mkdir(outDir, { recursive: true, mode: 0o700 });
    const frames = await browser.capture(job.base_url, steps, outDir, syntheticLogin(job));
    if (!frames.length) throw new Error("Script produced no CAPTURE frames");
    output = job.job_type === "VIDEO"
      ? { frames: frames.length, ...(await renderDemoVideo(frames, outDir, join(outDir, "demo.mp4"))) }
      : { frames: frames.map(({ path, caption, url }) => ({ path, caption, url })) };
  }
  await transaction(async (client) => {
    await client.query("UPDATE demo_jobs SET status='AWAITING_REVIEW',output_reference=$2,duration_ms=$3,updated_at=now() WHERE id=$1", [job.id,JSON.stringify(output),Date.now() - started]);
    if (job.job_type === "HEALTH_CHECK") await client.query("UPDATE demo_targets SET last_health_check=now(),status='PENDING_REVIEW',updated_at=now() WHERE id=$1 AND organization_id=$2", [job.target_id,job.organization_id]);
  });
  console.log(`Demo ${job.job_type} job ${job.id} finished; output awaits human review`);
} catch (error) {
  const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown demo failure";
  await transaction(async (client) => {
    await client.query("UPDATE demo_jobs SET status='FAILED',failure_reason=$2,duration_ms=$3,updated_at=now() WHERE id=$1", [job.id,message,Date.now() - started]);
    if (job.job_type === "HEALTH_CHECK") await client.query("UPDATE demo_targets SET last_health_check=now(),status='FAILED',updated_at=now() WHERE id=$1 AND organization_id=$2", [job.target_id,job.organization_id]);
  });
  console.error(`Demo job ${job.id} failed: ${message}`);
  process.exitCode = 1;
} finally { await pool.end(); }
