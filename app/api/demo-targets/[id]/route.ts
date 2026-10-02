import { z } from "zod";
import { transaction } from "@/lib/db";
import { demoTargetSchema } from "@/lib/automation-schemas";
import { ApiError, jsonError, requireActor, requireSameOrigin } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER", "MANAGER"]);
    const id = z.uuid().parse((await context.params).id);
    const input = demoTargetSchema.parse(await request.json());
    if (input.loginUrl && input.baseUrl && new URL(input.loginUrl).hostname !== new URL(input.baseUrl).hostname)
      throw new ApiError(400, "Login and base URL must share the same host");
    const result = await transaction(async (client) => {
      const old = await client.query("SELECT id,base_url FROM demo_targets WHERE id=$1 AND organization_id=$2 FOR UPDATE", [id,actor.organization_id]);
      if (!old.rowCount) throw new ApiError(404, "Demo target not found");
      const status = input.baseUrl ? "PENDING_REVIEW" : "WAITING_FOR_DEMO_URL";
      await client.query(
        `UPDATE demo_targets SET product_family=$3,name=$4,base_url=$5,login_url=$6,environment=$7,enabled=$8,requires_login=$9,username_secret_ref=$10,password_secret_ref=$11,demo_tenant_reference=$12,allow_mutations=$13,status=$14,last_verified_at=NULL,synthetic_data_evidence=NULL,synthetic_data_approved_by=NULL,synthetic_data_approved_at=NULL,updated_at=now()
         WHERE id=$1 AND organization_id=$2`,
        [id,actor.organization_id,input.productFamily,input.name,input.baseUrl,input.loginUrl ?? null,input.environment,input.enabled,input.requiresLogin,input.usernameSecretRef ?? null,input.passwordSecretRef ?? null,input.demoTenantReference ?? null,input.allowMutations,status],
      );
      await client.query(
        `INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,before_value,after_value)
         VALUES($1,$2,'DEMO_TARGET_UPDATED','demo_target',$3,$4,$5)`,
        [actor.organization_id,actor.id,id,JSON.stringify({ baseUrl: old.rows[0].base_url }),JSON.stringify({ baseUrl: input.baseUrl, status })],
      );
      return { id, status };
    });
    return Response.json(result);
  } catch (error) { return jsonError(error); }
}
