import { rows, transaction } from "@/lib/db";
import { demoScriptSchema } from "@/lib/automation-schemas";
import { ApiError, jsonError, requireActor, requireSameOrigin } from "@/lib/session";

export async function GET() {
  try {
    const actor = await requireActor();
    const scripts = await rows("SELECT id,product_family,name,version,status,created_at FROM demo_scripts WHERE organization_id=$1 ORDER BY product_family,name,version DESC", [actor.organization_id]);
    const steps = await rows("SELECT id,script_id,step_order,action,route,selector,expected_state,caption,is_mutating,required_capability_id FROM demo_script_steps WHERE organization_id=$1 ORDER BY step_order", [actor.organization_id]);
    return Response.json({ scripts: scripts.map((script) => ({ ...script, steps: steps.filter((step) => step.script_id === script.id) })) });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER", "MANAGER", "PRODUCT_APPROVER"]);
    const input = demoScriptSchema.parse(await request.json());
    const result = await transaction(async (client) => {
      const capabilityIds = input.steps.map((step) => step.requiredCapabilityId).filter(Boolean);
      if (capabilityIds.length) {
        const found = await client.query<{ id: string }>(
          `SELECT id FROM product_capabilities WHERE organization_id=$1 AND id=ANY($2::uuid[]) AND status IN ('VERIFIED','OPTIONAL')`,
          [actor.organization_id,capabilityIds],
        );
        if (found.rowCount !== new Set(capabilityIds).size) throw new ApiError(409, "Script references unverified product capabilities");
      }
      const versionRow = await client.query<{ next_version: number }>(
        "SELECT COALESCE(MAX(version),0)+1 AS next_version FROM demo_scripts WHERE organization_id=$1 AND product_family=$2 AND name=$3",
        [actor.organization_id,input.productFamily,input.name],
      );
      const script = await client.query<{ id: string }>(
        `INSERT INTO demo_scripts(organization_id,product_family,name,version) VALUES($1,$2,$3,$4) RETURNING id`,
        [actor.organization_id,input.productFamily,input.name,versionRow.rows[0].next_version],
      );
      for (const [index, step] of input.steps.entries()) {
        await client.query(
          `INSERT INTO demo_script_steps(organization_id,script_id,step_order,action,route,selector,expected_state,caption,is_mutating,required_capability_id)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [actor.organization_id,script.rows[0].id,index + 1,step.action,step.route ?? null,step.selector ?? null,step.expectedState ?? null,step.caption ?? null,step.isMutating,step.requiredCapabilityId ?? null],
        );
      }
      await client.query(`INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value) VALUES($1,$2,'DEMO_SCRIPT_CREATED','demo_script',$3,$4)`, [actor.organization_id,actor.id,script.rows[0].id,JSON.stringify({ name: input.name, version: versionRow.rows[0].next_version })]);
      return { id: script.rows[0].id, version: versionRow.rows[0].next_version, status: "DRAFT" };
    });
    return Response.json(result, { status: 201 });
  } catch (error) { return jsonError(error); }
}
