import { z } from "zod";
import { rows, transaction } from "@/lib/db";
import { ApiError, jsonError, requireActor, requireSameOrigin } from "@/lib/session";

const createJob = z.object({ targetId: z.uuid(), jobType: z.enum(["HEALTH_CHECK", "SCRIPT_TEST", "VIDEO"]), scriptId: z.uuid().nullable().optional(), leadId: z.uuid().nullable().optional() });

export async function GET() {
  try {
    const actor = await requireActor();
    const jobs = await rows("SELECT id,target_id,script_id,lead_id,job_type,status,failure_reason,output_reference,duration_ms,created_at,updated_at FROM demo_jobs WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100", [actor.organization_id]);
    return Response.json({ jobs });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER", "MANAGER"]);
    const input = createJob.parse(await request.json());
    const result = await transaction(async (client) => {
      const target = await client.query<{ base_url: string | null; status: string; enabled: boolean }>(
        "SELECT base_url,status,enabled FROM demo_targets WHERE id=$1 AND organization_id=$2", [input.targetId,actor.organization_id],
      );
      if (!target.rows[0]) throw new ApiError(404, "Demo target not found");
      if (input.scriptId) {
        const script = await client.query("SELECT id FROM demo_scripts WHERE id=$1 AND organization_id=$2 AND status='REVIEWED'", [input.scriptId,actor.organization_id]);
        if (!script.rowCount) throw new ApiError(409, "Demo script must be reviewed");
      }
      if (input.leadId) {
        const lead = await client.query("SELECT id FROM leads WHERE id=$1 AND organization_id=$2", [input.leadId,actor.organization_id]);
        if (!lead.rowCount) throw new ApiError(404, "Lead not found");
      }
      const ready = Boolean(target.rows[0].base_url && target.rows[0].enabled && ["READY_FOR_TEST", "HEALTHY"].includes(target.rows[0].status));
      const needsScript = input.jobType !== "HEALTH_CHECK" && !input.scriptId;
      const executable = ready && !needsScript;
      const failureReason = !ready ? "WAITING_FOR_DEMO_URL_OR_REVIEW" : needsScript ? "REVIEWED_SCRIPT_REQUIRED" : null;
      const created = await client.query<{ id: string }>(
        `INSERT INTO demo_jobs(organization_id,lead_id,target_id,script_id,status,job_type,failure_reason,created_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [actor.organization_id,input.leadId ?? null,input.targetId,input.scriptId ?? null,executable ? "QUEUED" : "BLOCKED",input.jobType,failureReason,actor.id],
      );
      return { id: created.rows[0].id, status: executable ? "QUEUED" : "BLOCKED", reason: failureReason };
    });
    return Response.json(result, { status: 201 });
  } catch (error) { return jsonError(error); }
}
