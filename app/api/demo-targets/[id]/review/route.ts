import { z } from "zod";
import { transaction } from "@/lib/db";
import { ApiError, jsonError, requireActor, requireSameOrigin } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };
const approval = z.object({ syntheticDataEvidence: z.string().trim().min(12).max(500) });

export async function POST(request: Request, context: Context) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER"]);
    const id = z.uuid().parse((await context.params).id);
    const input = approval.parse(await request.json());
    const result = await transaction(async (client) => {
      const target = await client.query<{ base_url: string | null; environment: string; allow_mutations: boolean; demo_tenant_reference: string | null }>(
        "SELECT base_url,environment,allow_mutations,demo_tenant_reference FROM demo_targets WHERE id=$1 AND organization_id=$2 FOR UPDATE", [id,actor.organization_id],
      );
      if (!target.rows[0]) throw new ApiError(404, "Demo target not found");
      if (!target.rows[0].base_url) throw new ApiError(409, "Add the demo URL first");
      if (target.rows[0].allow_mutations && (target.rows[0].environment !== "DEMO" || !target.rows[0].demo_tenant_reference))
        throw new ApiError(409, "Mutating demos require a named sandbox tenant");
      await client.query("UPDATE demo_targets SET status='READY_FOR_TEST',enabled=true,synthetic_data_evidence=$3,synthetic_data_approved_by=$4,synthetic_data_approved_at=now(),updated_at=now() WHERE id=$1 AND organization_id=$2", [id,actor.organization_id,input.syntheticDataEvidence,actor.id]);
      await client.query(`INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value) VALUES($1,$2,'DEMO_TARGET_APPROVED_FOR_TEST','demo_target',$3,$4)`, [actor.organization_id,actor.id,id,JSON.stringify({ syntheticDataEvidence: input.syntheticDataEvidence })]);
      return { id, status: "READY_FOR_TEST" };
    });
    return Response.json(result);
  } catch (error) { return jsonError(error); }
}
