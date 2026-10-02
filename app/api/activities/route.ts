import { transaction } from "@/lib/db";
import { createActivitySchema } from "@/lib/schemas";
import {
  ApiError,
  jsonError,
  requireActor,
  requireSameOrigin,
} from "@/lib/session";

export async function POST(request: Request) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER", "MANAGER", "SALES"]);
    const input = createActivitySchema.parse(await request.json());
    const result = await transaction(async (client) => {
      const lead = await client.query(
        "SELECT id FROM leads WHERE id=$1 AND organization_id=$2",
        [input.leadId, actor.organization_id],
      );
      if (!lead.rowCount) throw new ApiError(404, "Lead not found");
      if (input.opportunityId) {
        const opportunity = await client.query(
          "SELECT id FROM opportunities WHERE id=$1 AND lead_id=$2 AND organization_id=$3",
          [input.opportunityId, input.leadId, actor.organization_id],
        );
        if (!opportunity.rowCount)
          throw new ApiError(404, "Opportunity not found for this lead");
      }
      const created = await client.query<{ id: string }>(
        `INSERT INTO activities(organization_id,lead_id,opportunity_id,kind,detail,due_at,actor_id)
         VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [
          actor.organization_id,
          input.leadId,
          input.opportunityId ?? null,
          input.kind,
          input.detail,
          input.dueAt ?? null,
          actor.id,
        ],
      );
      await client.query(
        `INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value)
         VALUES($1,$2,'ACTIVITY_CREATED','activity',$3,$4)`,
        [
          actor.organization_id,
          actor.id,
          created.rows[0].id,
          JSON.stringify(input),
        ],
      );
      return { id: created.rows[0].id };
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
