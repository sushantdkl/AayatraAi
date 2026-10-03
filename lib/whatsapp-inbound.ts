import type { PoolClient } from "pg";
import { ingestInbound } from "@/lib/conversation-ingest";
import { normalizeBusinessName } from "@/lib/domain";
import type { InboundWhatsAppMessage, WhatsAppStatusUpdate } from "@/lib/whatsapp";

/**
 * Routes a verified inbound WhatsApp message to its lead/conversation, creating an inbound lead
 * for an unknown number. A customer-initiated message makes the number eligible for replies.
 */
export async function routeInboundWhatsApp(client: PoolClient, organizationId: string, message: InboundWhatsAppMessage) {
  const last10 = message.from.replace(/\D/g, "").slice(-10);
  const contact = await client.query<{ id: string; business_id: string }>(
    "SELECT id,business_id FROM contacts WHERE organization_id=$1 AND right(regexp_replace(coalesce(phone,''),'\\D','','g'),10)=$2 ORDER BY created_at LIMIT 1",
    [organizationId, last10],
  );
  let contactId = contact.rows[0]?.id;
  let businessId = contact.rows[0]?.business_id;
  let sourceRecordId: string | null = null;
  if (!contactId) {
    const name = `${message.profileName?.slice(0, 80) || "WhatsApp"} (+${message.from})`;
    const business = await client.query<{ id: string }>(
      `INSERT INTO businesses(organization_id,name,normalized_name,industry,notes) VALUES($1,$2,$3,'OTHER','Created from an inbound WhatsApp message')
       ON CONFLICT(organization_id,normalized_name,city) DO UPDATE SET updated_at=now() RETURNING id`,
      [organizationId, name, normalizeBusinessName(name)],
    );
    businessId = business.rows[0].id;
    const created = await client.query<{ id: string }>(
      "INSERT INTO contacts(organization_id,business_id,full_name,phone,contact_source,contact_eligible) VALUES($1,$2,$3,$4,'INBOUND_WHATSAPP',true) RETURNING id",
      [organizationId, businessId, message.profileName, `+${message.from}`],
    );
    contactId = created.rows[0].id;
    const source = await client.query<{ id: string }>("INSERT INTO source_records(organization_id,business_id,source_type,source_reference,terms_reference) VALUES($1,$2,'INBOUND_WHATSAPP',$3,'Customer-initiated WhatsApp message') RETURNING id", [organizationId, businessId, message.id]);
    sourceRecordId = source.rows[0].id;
  }
  let lead = await client.query<{ id: string }>("SELECT id FROM leads WHERE organization_id=$1 AND business_id=$2", [organizationId, businessId]);
  if (!lead.rows[0]) lead = await client.query<{ id: string }>("INSERT INTO leads(organization_id,business_id,source_record_id) VALUES($1,$2,$3) RETURNING id", [organizationId, businessId, sourceRecordId]);
  const leadId = lead.rows[0].id;
  let conversation = await client.query<{ id: string }>(
    "SELECT id FROM conversations WHERE organization_id=$1 AND lead_id=$2 AND contact_id=$3 AND channel='WHATSAPP' AND status<>'CLOSED' ORDER BY created_at DESC LIMIT 1",
    [organizationId, leadId, contactId],
  );
  if (!conversation.rows[0]) conversation = await client.query<{ id: string }>(
    "INSERT INTO conversations(organization_id,lead_id,contact_id,channel) VALUES($1,$2,$3,'WHATSAPP') RETURNING id", [organizationId, leadId, contactId],
  );
  return ingestInbound(client, { organizationId, conversationId: conversation.rows[0].id, body: message.body, provider: "WHATSAPP_CLOUD", providerMessageId: message.id });
}

export async function applyStatusUpdate(client: PoolClient, organizationId: string, update: WhatsAppStatusUpdate) {
  const status = { sent: "SENT", delivered: "DELIVERED", read: "READ", failed: "FAILED" }[update.status];
  if (!status) return;
  await client.query(
    `UPDATE outbound_messages SET status=$3,updated_at=now() WHERE organization_id=$1 AND provider_message_id=$2
       AND status NOT IN ('READ','REPLIED') AND NOT (status='DELIVERED' AND $3='SENT')`,
    [organizationId, update.id, status],
  );
}
