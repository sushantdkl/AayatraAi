import { z } from "zod";
import { transaction } from "@/lib/db";
import { replySafetyViolations } from "@/lib/reply-safety";
import { ApiError, jsonError, requireActor, requireSameOrigin } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("QUEUE_FOR_APPROVAL"), body: z.string().trim().min(1).max(4000).optional() }),
  z.object({ action: z.literal("DISCARD") }),
]);

/** A person turns an AI suggestion into an outbound draft (which still goes through approval, DNC and provider checks). */
export async function PATCH(request: Request, context: Context) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER","MANAGER","SALES"]);
    const id = z.uuid().parse((await context.params).id);
    const input = schema.parse(await request.json());
    const result = await transaction(async (client) => {
      const draft = await client.query<{ status: string; body: string; conversation_id: string; lead_id: string; contact_id: string | null; channel: string; contact_phone: string | null; contact_email: string | null }>(
        `SELECT d.status,d.body,d.conversation_id,c.lead_id,c.contact_id,c.channel,ct.phone AS contact_phone,ct.email AS contact_email
         FROM ai_reply_drafts d JOIN conversations c ON c.id=d.conversation_id AND c.organization_id=d.organization_id
         LEFT JOIN contacts ct ON ct.id=c.contact_id AND ct.organization_id=c.organization_id
         WHERE d.id=$1 AND d.organization_id=$2 FOR UPDATE OF d`, [id,actor.organization_id],
      );
      const row = draft.rows[0];
      if (!row) throw new ApiError(404, "Draft not found");
      if (row.status !== "DRAFTED") throw new ApiError(409, "Draft was already handled");
      if (input.action === "DISCARD") {
        await client.query("UPDATE ai_reply_drafts SET status='DISCARDED',reviewed_by=$3,reviewed_at=now() WHERE id=$1 AND organization_id=$2", [id,actor.organization_id,actor.id]);
        await client.query(`INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'AI_DRAFT_DISCARDED','ai_reply_draft',$3)`, [actor.organization_id,actor.id,id]);
        return { id, status: "DISCARDED" };
      }
      if (!row.contact_id) throw new ApiError(409, "Link a contact to this conversation before queuing a reply");
      const channel = row.channel === "EMAIL" ? "EMAIL" : row.channel === "SMS" ? "SMS" : "WHATSAPP";
      if (channel === "EMAIL" ? !row.contact_email : !row.contact_phone) throw new ApiError(409, "Contact has no destination for this channel");
      const body = input.body ?? row.body;
      const warnings = input.body ? replySafetyViolations(body, []).filter((warning) => !warning.startsWith("Unapproved amount")) : [];
      if (warnings.length) throw new ApiError(409, `Edited reply needs review: ${warnings.join("; ")}`);
      const outbound = await client.query<{ id: string }>(
        `INSERT INTO outbound_messages(organization_id,lead_id,contact_id,conversation_id,channel,body,status,source_kind,created_by)
         VALUES($1,$2,$3,$4,$5,$6,'AWAITING_APPROVAL','AI_DRAFT',$7) RETURNING id`,
        [actor.organization_id,row.lead_id,row.contact_id,row.conversation_id,channel,body,actor.id],
      );
      await client.query("UPDATE ai_reply_drafts SET status='QUEUED_FOR_APPROVAL',outbound_message_id=$3,reviewed_by=$4,reviewed_at=now() WHERE id=$1 AND organization_id=$2", [id,actor.organization_id,outbound.rows[0].id,actor.id]);
      await client.query(`INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value) VALUES($1,$2,'AI_DRAFT_QUEUED','ai_reply_draft',$3,$4)`, [actor.organization_id,actor.id,id,JSON.stringify({ outboundMessageId: outbound.rows[0].id, edited: Boolean(input.body) })]);
      return { id, status: "QUEUED_FOR_APPROVAL", outboundMessageId: outbound.rows[0].id };
    });
    return Response.json(result);
  } catch (error) { return jsonError(error); }
}
