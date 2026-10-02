import { rows, transaction } from "@/lib/db";
import { demoTargetSchema } from "@/lib/automation-schemas";
import { ApiError, jsonError, requireActor, requireSameOrigin } from "@/lib/session";

export async function GET() {
  try {
    const actor = await requireActor();
    const targets = await rows(
      `SELECT id,product_family,name,base_url,login_url,environment,enabled,requires_login,username_secret_ref,password_secret_ref,demo_tenant_reference,allow_mutations,synthetic_data_evidence,synthetic_data_approved_at,last_health_check,last_verified_at,status,updated_at
       FROM demo_targets WHERE organization_id=$1 ORDER BY product_family,name`, [actor.organization_id],
    );
    return Response.json({ targets });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER", "MANAGER"]);
    const input = demoTargetSchema.parse(await request.json());
    if (input.loginUrl && input.baseUrl && new URL(input.loginUrl).hostname !== new URL(input.baseUrl).hostname)
      throw new ApiError(400, "Login and base URL must share the same host");
    const result = await transaction(async (client) => {
      const created = await client.query<{ id: string }>(
        `INSERT INTO demo_targets(organization_id,product_family,name,base_url,login_url,environment,enabled,requires_login,username_secret_ref,password_secret_ref,demo_tenant_reference,allow_mutations,status)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
        [actor.organization_id,input.productFamily,input.name,input.baseUrl,input.loginUrl ?? null,input.environment,input.enabled,input.requiresLogin,input.usernameSecretRef ?? null,input.passwordSecretRef ?? null,input.demoTenantReference ?? null,input.allowMutations,input.baseUrl ? "PENDING_REVIEW" : "WAITING_FOR_DEMO_URL"],
      );
      await client.query(
        `INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value)
         VALUES($1,$2,'DEMO_TARGET_CREATED','demo_target',$3,$4)`,
        [actor.organization_id,actor.id,created.rows[0].id,JSON.stringify({ productFamily: input.productFamily, name: input.name, baseUrl: input.baseUrl, environment: input.environment })],
      );
      return { id: created.rows[0].id, status: input.baseUrl ? "PENDING_REVIEW" : "WAITING_FOR_DEMO_URL" };
    });
    return Response.json(result, { status: 201 });
  } catch (error) { return jsonError(error); }
}
