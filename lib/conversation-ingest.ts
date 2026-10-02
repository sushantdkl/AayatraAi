import type { PoolClient } from "pg";
import { classifyIntent } from "@/lib/intent";
import { normalizeContact } from "@/lib/domain";

export async function ingestInbound(
  client: PoolClient,
  input: { organizationId: string; conversationId: string; body: string; actorId?: string; provider?: string; providerMessageId?: string; rawReference?: string },
) {
  const conversation = await client.query<{ id: string; contact_id: string | null; lead_id: string }>(
    "SELECT id,contact_id,lead_id FROM conversations WHERE id=$1 AND organization_id=$2 FOR UPDATE",
    [input.conversationId,input.organizationId],
  );
  if (!conversation.rows[0]) return null;
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO conversation_messages(organization_id,conversation_id,direction,body,provider,provider_message_id,raw_reference,actor_id)
     VALUES($1,$2,'INBOUND',$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING id`,
    [input.organizationId,input.conversationId,input.body,input.provider ?? null,input.providerMessageId ?? null,input.rawReference ?? null,input.actorId ?? null],
  );
  if (!inserted.rows[0]) return { duplicate: true, intent: null, messageId: null };
  const result = classifyIntent(input.body);
  await client.query(
    `INSERT INTO intent_events(organization_id,conversation_id,message_id,intent,classifier_version,needs_human)
     VALUES($1,$2,$3,$4,'RULES_V1',$5)`,
    [input.organizationId,input.conversationId,inserted.rows[0].id,result.intent,result.needsHuman],
  );
  await client.query(
    `UPDATE conversations SET unread_count=unread_count+1,needs_human=needs_human OR $3,summary=$4,last_message_at=now(),updated_at=now()
     WHERE id=$1 AND organization_id=$2`,
    [input.conversationId,input.organizationId,result.needsHuman,`Latest incoming message (${result.intent}); review thread for exact wording.`],
  );
  if (result.intent === "DO_NOT_CONTACT") {
    const contact = conversation.rows[0].contact_id ? await client.query<{ email: string | null; phone: string | null }>(
      "SELECT email,phone FROM contacts WHERE id=$1 AND organization_id=$2",
      [conversation.rows[0].contact_id,input.organizationId],
    ) : null;
    if (contact?.rows[0]) {
      for (const [channel, value] of [["EMAIL", contact.rows[0].email], ["PHONE", contact.rows[0].phone], ["WHATSAPP", contact.rows[0].phone]] as const) {
        if (value) await client.query(
          `INSERT INTO do_not_contact(organization_id,channel,normalized_value,reason,created_by)
           VALUES($1,$2,$3,'Prospect requested no contact',$4) ON CONFLICT(organization_id,channel,normalized_value) DO NOTHING`,
          [input.organizationId,channel,normalizeContact(value),input.actorId ?? null],
        );
      }
      await client.query("UPDATE contacts SET contact_eligible=false WHERE id=$1 AND organization_id=$2", [conversation.rows[0].contact_id,input.organizationId]);
    }
    await client.query("UPDATE outbound_messages SET status='OPTED_OUT',updated_at=now() WHERE organization_id=$1 AND lead_id=$2 AND status IN ('DRAFT','AWAITING_APPROVAL','APPROVED','BLOCKED_PROVIDER','QUEUED')", [input.organizationId,conversation.rows[0].lead_id]);
  }
  return { duplicate: false, intent: result.intent, needsHuman: result.needsHuman, messageId: inserted.rows[0].id };
}
