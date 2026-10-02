import type { PoolClient } from "pg";
import { CLASSIFIER_VERSION } from "@/lib/intent";
import { normalizeContact } from "@/lib/domain";
import { analyzeMessage } from "@/lib/message-analysis";
import { loadReplyContext, memorySummary, mergeMemory, storeDraft, templateDraft, type ConversationMemory } from "@/lib/reply-pipeline";
import { recordTemperature } from "@/lib/temperature-store";

export async function ingestInbound(
  client: PoolClient,
  input: { organizationId: string; conversationId: string; body: string; actorId?: string; provider?: string; providerMessageId?: string; rawReference?: string },
) {
  const conversation = await client.query<{ id: string; contact_id: string | null; lead_id: string; status: string; memory: ConversationMemory; business_name: string; industry: string }>(
    `SELECT c.id,c.contact_id,c.lead_id,c.status,c.memory,b.name AS business_name,b.industry
     FROM conversations c JOIN leads l ON l.id=c.lead_id AND l.organization_id=c.organization_id
     JOIN businesses b ON b.id=l.business_id AND b.organization_id=l.organization_id
     WHERE c.id=$1 AND c.organization_id=$2 FOR UPDATE OF c`,
    [input.conversationId,input.organizationId],
  );
  const thread = conversation.rows[0];
  if (!thread) return null;
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO conversation_messages(organization_id,conversation_id,direction,body,provider,provider_message_id,raw_reference,actor_id)
     VALUES($1,$2,'INBOUND',$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING id`,
    [input.organizationId,input.conversationId,input.body,input.provider ?? null,input.providerMessageId ?? null,input.rawReference ?? null,input.actorId ?? null],
  );
  if (!inserted.rows[0]) return { duplicate: true, intent: null, messageId: null };
  const messageId = inserted.rows[0].id;
  const analysis = analyzeMessage(input.body);

  // Opt-out is handled before anything else and never produces a sales reply.
  if (analysis.intent === "DO_NOT_CONTACT") await recordOptOut(client, input.organizationId, thread.contact_id, thread.lead_id, input.actorId ?? null);

  const temperature = await recordTemperature(client, {
    organizationId: input.organizationId, leadId: thread.lead_id, signalled: analysis.pipeline_stage,
    cause: `Inbound message classified ${analysis.intent}`, messageId, actorId: input.actorId ?? null,
  });
  // The customer replied: pending follow-ups for this thread are no longer due.
  await client.query("UPDATE follow_up_tasks SET status='CANCELLED',updated_at=now() WHERE organization_id=$1 AND conversation_id=$2 AND status='PENDING'", [input.organizationId,input.conversationId]);

  const mode = await client.query<{ mode: string }>("SELECT mode FROM automation_controls WHERE organization_id=$1 AND feature='INBOUND_AI_REPLIES'", [input.organizationId]);
  const draftingOn = (mode.rows[0]?.mode ?? "OFF") !== "OFF" && thread.status === "OPEN";
  const context = await loadReplyContext(client, input.organizationId, thread.lead_id);
  const draft = templateDraft(input.body, context);
  const draftId = draftingOn ? await storeDraft(client, { organizationId: input.organizationId, conversationId: input.conversationId, messageId, kind: "REPLY", draft, analysis }) : null;

  await client.query(
    `INSERT INTO intent_events(organization_id,conversation_id,message_id,intent,confidence,classifier_version,needs_human,language,temperature)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [input.organizationId,input.conversationId,messageId,analysis.intent,analysis.confidence,CLASSIFIER_VERSION,analysis.needs_human_review || draft.requiresHuman,draft.language,temperature],
  );
  const memory = mergeMemory(thread.memory ?? {}, { business: thread.business_name, industry: thread.industry, body: input.body, analysis, draft });
  await client.query(
    `UPDATE conversations SET unread_count=unread_count+1,needs_human=needs_human OR $3,summary=$4,memory=$5,last_message_at=now(),updated_at=now()
     WHERE id=$1 AND organization_id=$2`,
    [input.conversationId,input.organizationId,analysis.needs_human_review || draft.requiresHuman,memorySummary(memory),JSON.stringify(memory)],
  );
  return { duplicate: false, intent: analysis.intent, needsHuman: analysis.needs_human_review || draft.requiresHuman, messageId, temperature, draftId, language: draft.language };
}

async function recordOptOut(client: PoolClient, organizationId: string, contactId: string | null, leadId: string, actorId: string | null) {
  const contact = contactId ? await client.query<{ email: string | null; phone: string | null }>(
    "SELECT email,phone FROM contacts WHERE id=$1 AND organization_id=$2", [contactId,organizationId],
  ) : null;
  if (contact?.rows[0]) {
    for (const [channel, value] of [["EMAIL", contact.rows[0].email], ["PHONE", contact.rows[0].phone], ["WHATSAPP", contact.rows[0].phone]] as const) {
      if (value) await client.query(
        `INSERT INTO do_not_contact(organization_id,channel,normalized_value,reason,created_by)
         VALUES($1,$2,$3,'Prospect requested no contact',$4) ON CONFLICT(organization_id,channel,normalized_value) DO NOTHING`,
        [organizationId,channel,normalizeContact(value),actorId],
      );
    }
    await client.query("UPDATE contacts SET contact_eligible=false WHERE id=$1 AND organization_id=$2", [contactId,organizationId]);
  }
  await client.query("UPDATE outbound_messages SET status='OPTED_OUT',updated_at=now() WHERE organization_id=$1 AND lead_id=$2 AND status IN ('DRAFT','AWAITING_APPROVAL','APPROVED','BLOCKED_PROVIDER','QUEUED')", [organizationId,leadId]);
  await client.query("UPDATE ai_reply_drafts SET status='DISCARDED' WHERE organization_id=$1 AND status='DRAFTED' AND conversation_id IN (SELECT id FROM conversations WHERE organization_id=$1 AND lead_id=$2)", [organizationId,leadId]);
}
