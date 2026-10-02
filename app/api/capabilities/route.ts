import { rows, transaction } from "@/lib/db";
import { createCapabilitySchema } from "@/lib/schemas";
import { jsonError, requireActor, requireSameOrigin } from "@/lib/session";

export async function GET() {
  try {
    const actor = await requireActor();
    const capabilities = await rows(
      `SELECT c.id,c.product_family,c.capability_name,c.status,c.approved_language,c.limitation,
              c.evidence_url,c.product_version,c.approved_at,c.updated_at,u.display_name AS approved_by_name
       FROM product_capabilities c LEFT JOIN users u ON u.id=c.approved_by AND u.organization_id=c.organization_id
       WHERE c.organization_id=$1 ORDER BY c.product_family,c.capability_name`,
      [actor.organization_id],
    );
    return Response.json({ capabilities });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER", "MANAGER", "PRODUCT_APPROVER"]);
    const input = createCapabilitySchema.parse(await request.json());
    const result = await transaction(async (client) => {
      const created = await client.query<{ id: string }>(
        `INSERT INTO product_capabilities(organization_id,product_family,capability_name,limitation)
         VALUES($1,$2,$3,$4) RETURNING id`,
        [
          actor.organization_id,
          input.productFamily,
          input.capabilityName,
          input.limitation ?? null,
        ],
      );
      await client.query(
        `INSERT INTO capability_versions(organization_id,capability_id,version,status,limitation,actor_id)
         VALUES($1,$2,1,'UNVERIFIED',$3,$4)`,
        [
          actor.organization_id,
          created.rows[0].id,
          input.limitation ?? null,
          actor.id,
        ],
      );
      await client.query(
        `INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value)
         VALUES($1,$2,'CAPABILITY_CREATED','capability',$3,$4)`,
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
