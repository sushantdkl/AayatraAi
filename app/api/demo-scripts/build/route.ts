import { z } from "zod";
import { transaction } from "@/lib/db";
import type { DemoInspection } from "@/lib/demo-browser";
import { buildDemoScript } from "@/lib/demo-script-builder";
import type { FeatureRecord } from "@/lib/feature-matrix";
import { ApiError, jsonError, requireActor, requireSameOrigin } from "@/lib/session";

const schema = z.object({ targetId: z.uuid() });

/** Builds a DRAFT demo script from the latest reviewed health check's live navigation and the feature-claim matrix. */
export async function POST(request: Request) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER","MANAGER","PRODUCT_APPROVER"]);
    const input = schema.parse(await request.json());
    const result = await transaction(async (client) => {
      const target = await client.query<{ product_family: string; name: string }>("SELECT product_family,name FROM demo_targets WHERE id=$1 AND organization_id=$2", [input.targetId,actor.organization_id]);
      if (!target.rows[0]) throw new ApiError(404, "Demo target not found");
      const health = await client.query<{ output_reference: string }>(
        "SELECT output_reference FROM demo_jobs WHERE target_id=$1 AND organization_id=$2 AND job_type='HEALTH_CHECK' AND status IN ('AWAITING_REVIEW','COMPLETE') AND output_reference IS NOT NULL ORDER BY updated_at DESC LIMIT 1",
        [input.targetId,actor.organization_id],
      );
      if (!health.rows[0]) throw new ApiError(409, "Run a health check on the live demo first (navigation verification)");
      const inspection = JSON.parse(health.rows[0].output_reference) as DemoInspection;
      const features = await client.query<FeatureRecord>("SELECT product_family,feature_key,name,implementation_status,commercial_status,approved_language,limitations,conditions,keywords FROM product_features WHERE organization_id=$1", [actor.organization_id]);
      const built = buildDemoScript(inspection, features.rows, target.rows[0].product_family);
      const name = `${target.rows[0].name} — generated`;
      const version = await client.query<{ next: number }>("SELECT coalesce(max(version),0)+1 AS next FROM demo_scripts WHERE organization_id=$1 AND product_family=$2 AND name=$3", [actor.organization_id,target.rows[0].product_family,name]);
      const script = await client.query<{ id: string }>("INSERT INTO demo_scripts(organization_id,product_family,name,version) VALUES($1,$2,$3,$4) RETURNING id", [actor.organization_id,target.rows[0].product_family,name,version.rows[0].next]);
      for (const [index, step] of built.steps.entries())
        await client.query("INSERT INTO demo_script_steps(organization_id,script_id,step_order,action,route,caption,is_mutating,duration_hint_ms) VALUES($1,$2,$3,$4,$5,$6,false,$7)",
          [actor.organization_id,script.rows[0].id,index + 1,step.action,step.route,step.caption,step.action === "CAPTURE" ? 3500 : null]);
      await client.query(`INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value) VALUES($1,$2,'DEMO_SCRIPT_GENERATED','demo_script',$3,$4)`, [actor.organization_id,actor.id,script.rows[0].id,JSON.stringify({ covered: built.covered, skipped: built.skipped })]);
      return { id: script.rows[0].id, status: "DRAFT", covered: built.covered, skipped: built.skipped };
    });
    return Response.json(result, { status: 201 });
  } catch (error) { return jsonError(error); }
}
