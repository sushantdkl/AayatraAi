import "dotenv/config";
import { Pool } from "pg";
import { draftFollowUp } from "../lib/ai-replies";
import { planFollowUp } from "../lib/follow-ups";
import type { Language } from "../lib/intent";
import { storeDraft } from "../lib/reply-pipeline";
import type { Temperature } from "../lib/sales-temperature";

/** Creates follow-up DRAFTS for human approval. It never sends anything. */
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
let drafted = 0;
try {
  const candidates = await client.query<{ organization_id: string; conversation_id: string; lead_id: string; temperature: Temperature; follow_up_stopped: boolean; contact_eligible: boolean | null; dnc: boolean; status: string; last_direction: "INBOUND" | "OUTBOUND" | null; last_at: Date | null; sent: string; requested_at: Date | null; language: Language | null }>(
    `SELECT c.organization_id,c.id AS conversation_id,c.lead_id,l.sales_temperature AS temperature,l.follow_up_stopped,ct.contact_eligible,
       EXISTS(SELECT 1 FROM do_not_contact d WHERE d.organization_id=c.organization_id AND d.normalized_value IN (lower(trim(coalesce(ct.phone,''))),lower(trim(coalesce(ct.email,''))))) AS dnc,
       c.status,m.direction AS last_direction,m.created_at AS last_at,
       (SELECT count(*) FROM follow_up_tasks f WHERE f.conversation_id=c.id AND f.status IN ('DRAFTED','DONE') AND f.created_at > coalesce((SELECT max(created_at) FROM conversation_messages i WHERE i.conversation_id=c.id AND i.direction='INBOUND'),'epoch')) AS sent,
       (SELECT min(due_at) FROM follow_up_tasks f WHERE f.conversation_id=c.id AND f.status='PENDING' AND f.requested_by_customer) AS requested_at,
       (SELECT language FROM intent_events e WHERE e.conversation_id=c.id ORDER BY created_at DESC LIMIT 1) AS language
     FROM conversations c JOIN leads l ON l.id=c.lead_id AND l.organization_id=c.organization_id
     LEFT JOIN contacts ct ON ct.id=c.contact_id AND ct.organization_id=c.organization_id
     LEFT JOIN LATERAL (SELECT direction,created_at FROM conversation_messages x WHERE x.conversation_id=c.id AND x.direction IN ('INBOUND','OUTBOUND') ORDER BY created_at DESC LIMIT 1) m ON true
     WHERE c.status='OPEN' LIMIT 500`,
  );
  for (const row of candidates.rows) {
    const decision = planFollowUp({
      temperature: row.temperature, followUpStopped: row.follow_up_stopped, doNotContact: row.dnc, contactEligible: Boolean(row.contact_eligible),
      conversationOpen: row.status === "OPEN", lastDirection: row.last_direction, lastMessageAt: row.last_at, followUpsSinceLastInbound: Number(row.sent),
      customerRequestedAt: row.requested_at,
    });
    if (!decision.due) continue;
    const body = draftFollowUp(row.temperature, row.language ?? "EN", decision.attempt);
    if (!body) continue;
    await client.query("BEGIN");
    try {
      const draftId = await storeDraft(client, {
        organizationId: row.organization_id, conversationId: row.conversation_id, messageId: null, kind: "FOLLOW_UP",
        draft: { intent: "FOLLOW_UP_LATER", language: row.language ?? "EN", temperature: row.temperature, body, requiresHuman: true, autoSendEligible: false, escalationReasons: [], citations: { skus: [], features: [] }, nextActions: [] },
      });
      await client.query(
        `INSERT INTO follow_up_tasks(organization_id,lead_id,conversation_id,temperature,attempt,due_at,status,reason,draft_id)
         VALUES($1,$2,$3,$4,$5,$6,'DRAFTED',$7,$8) ON CONFLICT(conversation_id,temperature,attempt) DO NOTHING`,
        [row.organization_id,row.lead_id,row.conversation_id,row.temperature,decision.attempt,decision.dueAt,decision.reason,draftId],
      );
      await client.query("UPDATE follow_up_tasks SET status='DONE',updated_at=now() WHERE conversation_id=$1 AND status='PENDING' AND requested_by_customer AND due_at<=now()", [row.conversation_id]);
      await client.query("COMMIT");
      drafted++;
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  }
  console.log(`Follow-up drafts created for approval: ${drafted}`);
} finally { client.release(); await pool.end(); }
