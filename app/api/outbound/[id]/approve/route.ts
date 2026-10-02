import { z } from "zod";
import { transaction } from "@/lib/db";
import { normalizeContact } from "@/lib/domain";
import { ApiError, jsonError, requireActor, requireSameOrigin } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER","MANAGER"]);
    const id = z.uuid().parse((await context.params).id);
    const result = await transaction(async (client) => {
      const message = await client.query<{ status: string; channel: string; contact_id: string; conversation_id: string | null }>(
        "SELECT status,channel,contact_id,conversation_id FROM outbound_messages WHERE id=$1 AND organization_id=$2 FOR UPDATE", [id,actor.organization_id],
      );
      const item = message.rows[0];
      if (!item) throw new ApiError(404, "Outbound draft not found");
      if (!item || !["DRAFT","AWAITING_APPROVAL"].includes(item.status)) throw new ApiError(409, "Draft is no longer approvable");
      const contact = await client.query<{ email: string | null; phone: string | null; contact_eligible: boolean }>("SELECT email,phone,contact_eligible FROM contacts WHERE id=$1 AND organization_id=$2", [item.contact_id,actor.organization_id]);
      const value = item.channel === "EMAIL" ? contact.rows[0]?.email : contact.rows[0]?.phone;
      if (!contact.rows[0]?.contact_eligible || !value) throw new ApiError(409, "Contact eligibility and destination must be reviewed first");
      const dncChannel = item.channel === "EMAIL" ? "EMAIL" : item.channel === "WHATSAPP" ? "WHATSAPP" : "PHONE";
      const dnc = await client.query("SELECT 1 FROM do_not_contact WHERE organization_id=$1 AND channel=$2 AND normalized_value=$3", [actor.organization_id,dncChannel,normalizeContact(value)]);
      if (dnc.rowCount) throw new ApiError(409, "Contact is on the do-not-contact list");
      if (item.conversation_id) {
        const conversation = await client.query<{ status: string; control_mode: string }>("SELECT status,control_mode FROM conversations WHERE id=$1 AND organization_id=$2", [item.conversation_id,actor.organization_id]);
        if (conversation.rows[0]?.status !== "OPEN") throw new ApiError(409, "Conversation is paused or closed");
      }
      await client.query("UPDATE outbound_messages SET status='BLOCKED_PROVIDER',approved_by=$3,approved_at=now(),failure_reason='NOT_CONFIGURED',updated_at=now() WHERE id=$1 AND organization_id=$2", [id,actor.organization_id,actor.id]);
      await client.query(`INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value) VALUES($1,$2,'OUTBOUND_APPROVED_PROVIDER_MISSING','outbound_message',$3,$4)`, [actor.organization_id,actor.id,id,JSON.stringify({ status: "BLOCKED_PROVIDER" })]);
      return { id, status: "BLOCKED_PROVIDER", provider: "NOT_CONFIGURED" };
    });
    return Response.json(result);
  } catch (error) { return jsonError(error); }
}
