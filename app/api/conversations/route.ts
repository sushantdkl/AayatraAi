import { z } from "zod";
import { rows, transaction } from "@/lib/db";
import { inboxPriority, type Temperature } from "@/lib/sales-temperature";
import { ApiError, jsonError, requireActor, requireSameOrigin } from "@/lib/session";

const create = z.object({ leadId: z.uuid(), contactId: z.uuid().nullable().optional(), channel: z.enum(["EMAIL","WHATSAPP","SMS","WEB_CHAT","SOCIAL","MANUAL"]) });

export async function GET() {
  try {
    const actor = await requireActor();
    const conversations = await rows<{ temperature: Temperature; needs_human: boolean; unread_count: number }>(
      `SELECT c.id,c.lead_id,c.contact_id,c.channel,c.status,c.control_mode,c.needs_human,c.unread_count,c.summary,c.last_message_at,
              b.name AS business_name,b.industry,l.fit_score,l.status AS lead_status,l.sales_temperature AS temperature,l.follow_up_stopped,c.memory,
              (SELECT count(*) FROM ai_reply_drafts d WHERE d.conversation_id=c.id AND d.organization_id=c.organization_id AND d.status='DRAFTED')::int AS pending_drafts,ct.full_name AS contact_name,ct.email AS contact_email,ct.phone AS contact_phone,
              (SELECT o.stage FROM opportunities o WHERE o.lead_id=c.lead_id AND o.organization_id=c.organization_id ORDER BY o.updated_at DESC LIMIT 1) AS opportunity_stage,
              (SELECT o.value_minor FROM opportunities o WHERE o.lead_id=c.lead_id AND o.organization_id=c.organization_id ORDER BY o.updated_at DESC LIMIT 1) AS opportunity_value_minor,
              (SELECT ie.intent FROM intent_events ie WHERE ie.conversation_id=c.id AND ie.organization_id=c.organization_id ORDER BY ie.created_at DESC LIMIT 1) AS latest_intent
       FROM conversations c JOIN leads l ON l.id=c.lead_id AND l.organization_id=c.organization_id
       JOIN businesses b ON b.id=l.business_id AND b.organization_id=l.organization_id
       LEFT JOIN contacts ct ON ct.id=c.contact_id AND ct.organization_id=c.organization_id
       WHERE c.organization_id=$1 ORDER BY c.needs_human DESC,c.last_message_at DESC NULLS LAST LIMIT 200`, [actor.organization_id],
    );
    // Priority inbox: payment/ready/negotiating first, then hot, then human-needed and unread.
    conversations.sort((a, b) => inboxPriority({ temperature: a.temperature, needsHuman: a.needs_human, unread: a.unread_count }) - inboxPriority({ temperature: b.temperature, needsHuman: b.needs_human, unread: b.unread_count }));
    return Response.json({ conversations });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER","MANAGER","SALES"]);
    const input = create.parse(await request.json());
    const result = await transaction(async (client) => {
      const lead = await client.query<{ business_id: string }>("SELECT business_id FROM leads WHERE id=$1 AND organization_id=$2", [input.leadId,actor.organization_id]);
      if (!lead.rows[0]) throw new ApiError(404, "Lead not found");
      if (input.contactId) {
        const contact = await client.query("SELECT id FROM contacts WHERE id=$1 AND organization_id=$2 AND business_id=$3", [input.contactId,actor.organization_id,lead.rows[0].business_id]);
        if (!contact.rowCount) throw new ApiError(409, "Contact does not belong to this lead");
      }
      const created = await client.query<{ id: string }>(
        "INSERT INTO conversations(organization_id,lead_id,contact_id,channel) VALUES($1,$2,$3,$4) RETURNING id",
        [actor.organization_id,input.leadId,input.contactId ?? null,input.channel],
      );
      await client.query(`INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value) VALUES($1,$2,'CONVERSATION_CREATED','conversation',$3,$4)`, [actor.organization_id,actor.id,created.rows[0].id,JSON.stringify(input)]);
      return { id: created.rows[0].id };
    });
    return Response.json(result, { status: 201 });
  } catch (error) { return jsonError(error); }
}
