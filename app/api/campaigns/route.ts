import { rows, transaction } from "@/lib/db";
import { createCampaignSchema } from "@/lib/schemas";
import { jsonError, requireActor, requireSameOrigin } from "@/lib/session";

export async function GET() {
  try {
    const actor = await requireActor();
    const campaigns = await rows(
      `SELECT c.id,c.name,c.segment,c.hypothesis,c.status,c.created_at,c.updated_at,
              count(l.id)::int AS lead_count
       FROM campaigns c LEFT JOIN leads l ON l.campaign_id=c.id AND l.organization_id=c.organization_id
       WHERE c.organization_id=$1 GROUP BY c.id ORDER BY c.created_at DESC`,
      [actor.organization_id],
    );
    return Response.json({ campaigns });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER", "MANAGER", "SALES"]);
    const input = createCampaignSchema.parse(await request.json());
    const result = await transaction(async (client) => {
      const created = await client.query<{ id: string }>(
        `INSERT INTO campaigns(organization_id,name,segment,hypothesis,owner_id)
         VALUES($1,$2,$3,$4,$5) RETURNING id`,
        [
          actor.organization_id,
          input.name,
          input.segment,
          input.hypothesis,
          actor.id,
        ],
      );
      await client.query(
        `INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value)
         VALUES($1,$2,'CAMPAIGN_CREATED','campaign',$3,$4)`,
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
