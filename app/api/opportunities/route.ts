import { rows, transaction } from "@/lib/db";
import { createOpportunitySchema } from "@/lib/schemas";
import {
  ApiError,
  jsonError,
  requireActor,
  requireSameOrigin,
} from "@/lib/session";

export async function GET() {
  try {
    const actor = await requireActor();
    const opportunities = await rows(
      `SELECT o.id,o.title,o.stage,o.product_family,o.value_minor,o.currency,o.next_action,o.next_action_at,
              o.updated_at,l.id AS lead_id,b.name AS business_name,b.industry
       FROM opportunities o JOIN leads l ON l.id=o.lead_id AND l.organization_id=o.organization_id
       JOIN businesses b ON b.id=l.business_id AND b.organization_id=l.organization_id
       WHERE o.organization_id=$1 ORDER BY o.updated_at DESC LIMIT 300`,
      [actor.organization_id],
    );
    return Response.json({ opportunities });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER", "MANAGER", "SALES"]);
    const input = createOpportunitySchema.parse(await request.json());
    const opportunity = await transaction(async (client) => {
      const lead = await client.query(
        "SELECT id FROM leads WHERE id=$1 AND organization_id=$2",
        [input.leadId, actor.organization_id],
      );
      if (!lead.rowCount) throw new ApiError(404, "Lead not found");
      const result = await client.query<{ id: string }>(
        `INSERT INTO opportunities(organization_id,lead_id,title,product_family,value_minor,owner_id,next_action,next_action_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [
          actor.organization_id,
          input.leadId,
          input.title,
          input.productFamily,
          input.valueMinor ?? null,
          actor.id,
          input.nextAction ?? null,
          input.nextActionAt ?? null,
        ],
      );
      const id = result.rows[0].id;
      await client.query(
        `INSERT INTO stage_history(organization_id,opportunity_id,from_stage,to_stage,reason,actor_id)
         VALUES($1,$2,NULL,'INTERESTED','Opportunity created',$3)`,
        [actor.organization_id, id, actor.id],
      );
      await client.query(
        `INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value)
         VALUES($1,$2,'OPPORTUNITY_CREATED','opportunity',$3,$4)`,
        [actor.organization_id, actor.id, id, JSON.stringify(input)],
      );
      return { id };
    });
    return Response.json(opportunity, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
