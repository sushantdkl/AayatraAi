import { z } from "zod";
import { rows, transaction } from "@/lib/db";
import { missingOnboardingPrerequisites, type OnboardingStepKey } from "@/lib/client-kit";
import { ApiError, jsonError, requireActor, requireSameOrigin } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };
const update = z.object({ stepKey: z.string().trim().min(2).max(100), status: z.enum(["PENDING","IN_PROGRESS","PASS","FAIL","NOT_APPLICABLE"]), evidenceReference: z.string().trim().min(8).max(1000).nullable().optional() });

export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const id = z.uuid().parse((await context.params).id);
    const project = await rows("SELECT id,opportunity_id,lead_id,status,target_go_live,uat_status,handover_status,setup_data FROM implementation_projects WHERE id=$1 AND organization_id=$2", [id,actor.organization_id]);
    if (!project[0]) throw new ApiError(404, "Implementation project not found");
    const checklist = await rows("SELECT id,step_key,title,source_document,status,evidence_reference,completed_at FROM onboarding_checklist WHERE project_id=$1 AND organization_id=$2 ORDER BY display_order NULLS LAST,created_at", [id,actor.organization_id]);
    return Response.json({ project: project[0], checklist });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER","MANAGER"]);
    const id = z.uuid().parse((await context.params).id);
    const input = update.parse(await request.json());
    if (["PASS","NOT_APPLICABLE"].includes(input.status) && !input.evidenceReference)
      throw new ApiError(400, "Completion requires an evidence reference");
    const result = await transaction(async (client) => {
      const project = await client.query("SELECT id FROM implementation_projects WHERE id=$1 AND organization_id=$2 FOR UPDATE", [id,actor.organization_id]);
      if (!project.rowCount) throw new ApiError(404, "Implementation project not found");
      const step = await client.query("SELECT step_key FROM onboarding_checklist WHERE project_id=$1 AND organization_id=$2 AND step_key=$3", [id,actor.organization_id,input.stepKey]);
      if (!step.rowCount) throw new ApiError(404, "Checklist step not found");
      if (input.status === "NOT_APPLICABLE" && !["FEEDBACK","RENEWAL"].includes(input.stepKey))
        throw new ApiError(409, "This client-kit control needs an explicit pass or failure; record a decision with evidence");
      if (input.status === "PASS") {
        const checklist = await client.query<{ step_key: string; status: string }>("SELECT step_key,status FROM onboarding_checklist WHERE project_id=$1 AND organization_id=$2", [id,actor.organization_id]);
        const statuses = Object.fromEntries(checklist.rows.map((row) => [row.step_key,row.status]));
        const missing = missingOnboardingPrerequisites(input.stepKey as OnboardingStepKey, statuses);
        if (missing.length) throw new ApiError(409, `Complete client-kit prerequisites first: ${missing.join(", ")}`);
      }
      await client.query(
        `UPDATE onboarding_checklist SET status=$4,evidence_reference=$5,completed_by=CASE WHEN $4 IN ('PASS','NOT_APPLICABLE') THEN $6 ELSE NULL END,
         completed_at=CASE WHEN $4 IN ('PASS','NOT_APPLICABLE') THEN now() ELSE NULL END
         WHERE project_id=$1 AND organization_id=$2 AND step_key=$3`,
        [id,actor.organization_id,input.stepKey,input.status,input.evidenceReference ?? null,actor.id],
      );
      if (input.stepKey === "UAT") await client.query("UPDATE implementation_projects SET uat_status=$3,updated_at=now() WHERE id=$1 AND organization_id=$2", [id,actor.organization_id,input.status === "PASS" ? "PASS" : input.status === "FAIL" ? "FAIL" : "IN_PROGRESS"]);
      if (input.stepKey === "HANDOVER") await client.query("UPDATE implementation_projects SET handover_status=$3,updated_at=now() WHERE id=$1 AND organization_id=$2", [id,actor.organization_id,input.status === "PASS" ? "COMPLETE" : "IN_PROGRESS"]);
      if (input.status === "PASS" && ["GO_LIVE","HANDOVER"].includes(input.stepKey)) await client.query("UPDATE implementation_projects SET status=$3,updated_at=now() WHERE id=$1 AND organization_id=$2", [id,actor.organization_id,input.stepKey]);
      await client.query(`INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value,reason) VALUES($1,$2,'ONBOARDING_STEP_UPDATED','implementation_project',$3,$4,$5)`, [actor.organization_id,actor.id,id,JSON.stringify({ stepKey: input.stepKey, status: input.status }),input.evidenceReference ?? null]);
      return { id, stepKey: input.stepKey, status: input.status };
    });
    return Response.json(result);
  } catch (error) { return jsonError(error); }
}
