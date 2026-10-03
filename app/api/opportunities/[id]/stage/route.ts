import { z } from "zod";
import { rows, transaction } from "@/lib/db";
import { canTransition, type Stage } from "@/lib/domain";
import { canCloseWon, onboardingSteps } from "@/lib/closing";
import { updateStageSchema } from "@/lib/schemas";
import { recordTemperature } from "@/lib/temperature-store";
import {
  ApiError,
  jsonError,
  requireActor,
  requireSameOrigin,
} from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const id = z.uuid().parse((await context.params).id);
    const history = await rows(
      `SELECT h.id,h.from_stage,h.to_stage,h.reason,h.created_at,u.display_name AS actor_name
       FROM stage_history h JOIN users u ON u.id=h.actor_id AND u.organization_id=h.organization_id
       WHERE h.opportunity_id=$1 AND h.organization_id=$2 ORDER BY h.created_at DESC`,
      [id, actor.organization_id],
    );
    return Response.json({ history });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER", "MANAGER", "SALES"]);
    const id = z.uuid().parse((await context.params).id);
    const input = updateStageSchema.parse(await request.json());
    const result = await transaction(async (client) => {
      const current = await client.query<{ stage: Stage; lead_id: string }>(
        "SELECT stage,lead_id FROM opportunities WHERE id=$1 AND organization_id=$2 FOR UPDATE",
        [id, actor.organization_id],
      );
      if (!current.rows[0]) throw new ApiError(404, "Opportunity not found");
      const from = current.rows[0].stage;
      if (!canTransition(from, input.stage))
        throw new ApiError(409, `Cannot move from ${from} to ${input.stage}`);
      if (input.stage === "WON") {
        if (actor.role !== "OWNER") throw new ApiError(403, "Only an owner may close a deal as won");
        const quote = await client.query<{ id: string; total_minor: string }>(
          `SELECT q.id,v.total_minor FROM quotations q JOIN quotation_versions v ON v.quotation_id=q.id AND v.organization_id=q.organization_id AND v.version=q.accepted_version
           WHERE q.organization_id=$1 AND q.opportunity_id=$2 AND q.status='ACCEPTED' ORDER BY q.accepted_at DESC LIMIT 1`,
          [actor.organization_id,id],
        );
        const accepted = quote.rows[0];
        const agreement = accepted ? await client.query("SELECT id FROM service_agreements WHERE organization_id=$1 AND opportunity_id=$2 AND quotation_id=$3 AND legal_review_reference IS NOT NULL LIMIT 1", [actor.organization_id,id,accepted.id]) : null;
        const paid = accepted ? await client.query<{ paid_minor: string }>(
          `SELECT COALESCE(SUM(amount_minor),0) AS paid_minor FROM payment_requests
           WHERE organization_id=$1 AND opportunity_id=$2 AND quotation_id=$3 AND status='VERIFIED'`,
          [actor.organization_id,id,accepted.id],
        ) : null;
        if (!canCloseWon({ quotationAccepted: Boolean(accepted), agreementAccepted: Boolean(agreement?.rowCount), verifiedPaidMinor: Number(paid?.rows[0]?.paid_minor ?? 0), requiredPaidMinor: Number(accepted?.total_minor ?? 0) }))
          throw new ApiError(409, "WON requires an accepted quotation, signed agreement with legal-review reference, and independently verified payment covering the accepted total");
      }
      await client.query(
        "UPDATE opportunities SET stage=$3,updated_at=now() WHERE id=$1 AND organization_id=$2",
        [id, actor.organization_id, input.stage],
      );
      if (input.stage === "WON") await recordTemperature(client, { organizationId: actor.organization_id, leadId: current.rows[0].lead_id, signalled: "CLOSED_WON", cause: "Opportunity closed as WON", actorId: actor.id, systemEvent: true });
      await client.query(
        `INSERT INTO stage_history(organization_id,opportunity_id,from_stage,to_stage,reason,actor_id)
         VALUES($1,$2,$3,$4,$5,$6)`,
        [actor.organization_id, id, from, input.stage, input.reason, actor.id],
      );
      await client.query(
        `INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,before_value,after_value,reason)
         VALUES($1,$2,'STAGE_CHANGED','opportunity',$3,$4,$5,$6)`,
        [
          actor.organization_id,
          actor.id,
          id,
          JSON.stringify({ stage: from }),
          JSON.stringify({ stage: input.stage }),
          input.reason,
        ],
      );
      if (input.stage === "WON") {
        const created = await client.query<{ id: string }>(
          `INSERT INTO implementation_projects(organization_id,opportunity_id,lead_id,assigned_owner)
           VALUES($1,$2,$3,$4) ON CONFLICT(organization_id,opportunity_id) DO NOTHING RETURNING id`,
          [actor.organization_id,id,current.rows[0].lead_id,actor.id],
        );
        const projectId = created.rows[0]?.id ?? (await client.query<{ id: string }>("SELECT id FROM implementation_projects WHERE organization_id=$1 AND opportunity_id=$2", [actor.organization_id,id])).rows[0].id;
        for (const [index, [stepKey, title, sourceDocument]] of onboardingSteps.entries())
          await client.query(
            `INSERT INTO onboarding_checklist(organization_id,project_id,step_key,title,source_document,display_order)
             VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(project_id,step_key) DO NOTHING`,
            [actor.organization_id,projectId,stepKey,title,sourceDocument,index + 1],
          );
      }
      return { id, stage: input.stage };
    });
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
