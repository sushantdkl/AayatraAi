import { z } from "zod";
import { rows, transaction } from "@/lib/db";
import { ApiError, jsonError, requireActor, requireSameOrigin } from "@/lib/session";

const create = z.object({
  leadId: z.uuid(), contactId: z.uuid(), conversationId: z.uuid().nullable().optional(),
  campaignId: z.uuid().nullable().optional(), channel: z.enum(["EMAIL","WHATSAPP","SMS"]),
  body: z.string().trim().min(3).max(12000),
});

export async function GET() {
  try {
    const actor = await requireActor();
    const messages = await rows(
      `SELECT o.id,o.lead_id,o.contact_id,o.conversation_id,o.channel,o.body,o.status,o.source_kind,o.approved_at,o.provider,o.failure_reason,o.created_at,
              b.name AS business_name,ct.full_name AS contact_name
       FROM outbound_messages o JOIN leads l ON l.id=o.lead_id AND l.organization_id=o.organization_id
       JOIN businesses b ON b.id=l.business_id AND b.organization_id=l.organization_id
       JOIN contacts ct ON ct.id=o.contact_id AND ct.organization_id=o.organization_id
       WHERE o.organization_id=$1 ORDER BY o.created_at DESC LIMIT 200`, [actor.organization_id],
    );
    return Response.json({ messages });
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
      const contact = await client.query("SELECT id FROM contacts WHERE id=$1 AND organization_id=$2 AND business_id=$3", [input.contactId,actor.organization_id,lead.rows[0].business_id]);
      if (!contact.rowCount) throw new ApiError(409, "Contact does not belong to the lead");
      if (input.conversationId) {
        const conversation = await client.query("SELECT id FROM conversations WHERE id=$1 AND organization_id=$2 AND lead_id=$3", [input.conversationId,actor.organization_id,input.leadId]);
        if (!conversation.rowCount) throw new ApiError(409, "Conversation does not belong to the lead");
      }
      if (input.campaignId) {
        const campaign = await client.query("SELECT id FROM campaigns WHERE id=$1 AND organization_id=$2", [input.campaignId,actor.organization_id]);
        if (!campaign.rowCount) throw new ApiError(404, "Campaign not found");
      }
      const created = await client.query<{ id: string }>(
        `INSERT INTO outbound_messages(organization_id,lead_id,contact_id,conversation_id,campaign_id,channel,body,source_kind,created_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,'HUMAN',$8) RETURNING id`,
        [actor.organization_id,input.leadId,input.contactId,input.conversationId ?? null,input.campaignId ?? null,input.channel,input.body,actor.id],
      );
      await client.query(`INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value) VALUES($1,$2,'OUTBOUND_DRAFT_CREATED','outbound_message',$3,$4)`, [actor.organization_id,actor.id,created.rows[0].id,JSON.stringify({ channel: input.channel, leadId: input.leadId })]);
      return { id: created.rows[0].id, status: "DRAFT" };
    });
    return Response.json(result, { status: 201 });
  } catch (error) { return jsonError(error); }
}
