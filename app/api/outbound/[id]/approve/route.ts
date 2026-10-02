import { z } from "zod";
import { transaction } from "@/lib/db";
import { normalizeContact } from "@/lib/domain";
import { NotConfiguredProvider, type OutboundProvider } from "@/lib/outbound-provider";
import { resolveWhatsAppProvider, withinServiceWindow, type WhatsAppSettings } from "@/lib/whatsapp";
import { ApiError, jsonError, requireActor, requireSameOrigin } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER","MANAGER"]);
    const id = z.uuid().parse((await context.params).id);
    const prepared = await transaction(async (client) => {
      const message = await client.query<{ status: string; channel: "EMAIL" | "WHATSAPP" | "SMS"; contact_id: string; conversation_id: string | null; body: string }>(
        "SELECT status,channel,contact_id,conversation_id,body FROM outbound_messages WHERE id=$1 AND organization_id=$2 FOR UPDATE", [id,actor.organization_id],
      );
      const item = message.rows[0];
      if (!item) throw new ApiError(404, "Outbound draft not found");
      if (!["DRAFT","AWAITING_APPROVAL"].includes(item.status)) throw new ApiError(409, "Draft is no longer approvable");
      const contact = await client.query<{ email: string | null; phone: string | null; contact_eligible: boolean }>("SELECT email,phone,contact_eligible FROM contacts WHERE id=$1 AND organization_id=$2", [item.contact_id,actor.organization_id]);
      const destination = item.channel === "EMAIL" ? contact.rows[0]?.email : contact.rows[0]?.phone;
      if (!contact.rows[0]?.contact_eligible || !destination) throw new ApiError(409, "Contact eligibility and destination must be reviewed first");
      const dncChannel = item.channel === "EMAIL" ? "EMAIL" : item.channel === "WHATSAPP" ? "WHATSAPP" : "PHONE";
      const dnc = await client.query("SELECT 1 FROM do_not_contact WHERE organization_id=$1 AND channel=$2 AND normalized_value=$3", [actor.organization_id,dncChannel,normalizeContact(destination)]);
      if (dnc.rowCount) throw new ApiError(409, "Contact is on the do-not-contact list");
      if (item.conversation_id) {
        const conversation = await client.query<{ status: string }>("SELECT status FROM conversations WHERE id=$1 AND organization_id=$2", [item.conversation_id,actor.organization_id]);
        if (conversation.rows[0]?.status !== "OPEN") throw new ApiError(409, "Conversation is paused or closed");
      }
      const limit = await client.query<{ max_messages_per_contact_per_day: number }>("SELECT max_messages_per_contact_per_day FROM commercial_policies WHERE organization_id=$1", [actor.organization_id]);
      const perDay = limit.rows[0]?.max_messages_per_contact_per_day ?? 0;
      if (perDay > 0) {
        const today = await client.query<{ count: string }>("SELECT count(*) FROM outbound_messages WHERE organization_id=$1 AND contact_id=$2 AND status IN ('SENT','DELIVERED','READ') AND updated_at > now() - interval '1 day'", [actor.organization_id,item.contact_id]);
        if (Number(today.rows[0].count) >= perDay) throw new ApiError(409, "Daily message limit for this contact has been reached");
      }
      let provider: OutboundProvider = new NotConfiguredProvider();
      if (item.channel === "WHATSAPP") {
        const settings = await client.query<WhatsAppSettings>("SELECT phone_number_id,waba_id,access_token_secret_ref,app_secret_ref,webhook_verify_token_secret_ref,api_version FROM whatsapp_channel_settings WHERE organization_id=$1", [actor.organization_id]);
        provider = resolveWhatsAppProvider(settings.rows[0] ?? null);
        if (provider.name === "WHATSAPP_CLOUD") {
          const last = await client.query<{ at: Date | null }>("SELECT max(created_at) AS at FROM conversation_messages WHERE organization_id=$1 AND conversation_id=$2 AND direction='INBOUND'", [actor.organization_id,item.conversation_id]);
          if (!withinServiceWindow(last.rows[0]?.at ?? null)) throw new ApiError(409, "TEMPLATE_REQUIRED: the customer has not messaged in the last 24 hours; WhatsApp only allows approved templates outside that window");
        }
      }
      if (provider.name === "NOT_CONFIGURED") {
        await client.query("UPDATE outbound_messages SET status='BLOCKED_PROVIDER',approved_by=$3,approved_at=now(),failure_reason='NOT_CONFIGURED',updated_at=now() WHERE id=$1 AND organization_id=$2", [id,actor.organization_id,actor.id]);
        await client.query(`INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value) VALUES($1,$2,'OUTBOUND_APPROVED_PROVIDER_MISSING','outbound_message',$3,$4)`, [actor.organization_id,actor.id,id,JSON.stringify({ status: "BLOCKED_PROVIDER" })]);
        return { provider, done: { id, status: "BLOCKED_PROVIDER", provider: "NOT_CONFIGURED" } };
      }
      await client.query("UPDATE outbound_messages SET status='QUEUED',approved_by=$3,approved_at=now(),provider=$4,updated_at=now() WHERE id=$1 AND organization_id=$2", [id,actor.organization_id,actor.id,provider.name]);
      await client.query(`INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value) VALUES($1,$2,'OUTBOUND_APPROVED','outbound_message',$3,$4)`, [actor.organization_id,actor.id,id,JSON.stringify({ provider: provider.name })]);
      return { provider, done: null, item: { ...item, destination } };
    });
    if (prepared.done) return Response.json(prepared.done);
    const { item } = prepared as typeof prepared & { item: { channel: "EMAIL" | "WHATSAPP" | "SMS"; destination: string; body: string; conversation_id: string | null } };
    // External delivery happens after the approval commits, never inside the transaction.
    const delivery = await prepared.provider.deliver({ channel: item.channel, destination: item.destination, body: item.body, idempotencyKey: id });
    const final = await transaction(async (client) => {
      const attempt = await client.query<{ next: number }>("SELECT coalesce(max(attempt),0)+1 AS next FROM delivery_attempts WHERE outbound_message_id=$1", [id]);
      const result = delivery.status === "SENT" ? "SENT" : delivery.status === "SIMULATED" ? "SIMULATED" : delivery.status === "FAILED" ? "FAILED" : "BLOCKED";
      await client.query(
        "INSERT INTO delivery_attempts(organization_id,outbound_message_id,adapter,attempt,result,provider_reference,error_detail) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [actor.organization_id,id,prepared.provider.name,attempt.rows[0].next,result,delivery.status === "SENT" ? delivery.providerReference : null,delivery.status === "SENT" ? null : delivery.reason],
      );
      // A simulated or failed delivery is never represented as sent.
      const status = delivery.status === "SENT" ? "SENT" : delivery.status === "FAILED" ? "FAILED" : "BLOCKED_PROVIDER";
      await client.query("UPDATE outbound_messages SET status=$3,provider_message_id=$4,failure_reason=$5,updated_at=now() WHERE id=$1 AND organization_id=$2",
        [id,actor.organization_id,status,delivery.status === "SENT" ? delivery.providerReference : null,delivery.status === "SENT" ? null : delivery.status === "SIMULATED" ? `SIMULATED_TEST_PROVIDER: ${delivery.reason}` : delivery.reason]);
      if (delivery.status === "SENT" && item.conversation_id)
        await client.query("INSERT INTO conversation_messages(organization_id,conversation_id,direction,body,provider,provider_message_id,actor_id) VALUES($1,$2,'OUTBOUND',$3,$4,$5,$6)",
          [actor.organization_id,item.conversation_id,item.body,prepared.provider.name,delivery.providerReference,actor.id]);
      return { id, status, provider: prepared.provider.name };
    });
    return Response.json(final);
  } catch (error) { return jsonError(error); }
}
