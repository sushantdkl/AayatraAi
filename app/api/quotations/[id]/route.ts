import { z } from "zod";
import { rows, transaction } from "@/lib/db";
import { recordTemperature } from "@/lib/temperature-store";
import { ApiError, jsonError, requireActor, requireSameOrigin } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };
const actionSchema = z.object({ action: z.enum(["APPROVE","MARK_SENT","ACCEPT","REJECT"]), evidence: z.string().trim().min(8).max(1000) });

export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const id = z.uuid().parse((await context.params).id);
    const quote = await rows("SELECT id,quotation_number,status,current_version,accepted_version,accepted_at,acceptance_evidence,created_at FROM quotations WHERE id=$1 AND organization_id=$2", [id,actor.organization_id]);
    if (!quote[0]) throw new ApiError(404, "Quotation not found");
    const versions = await rows("SELECT version,client_name,business_type,issued_at,valid_until,line_items,subtotal_minor,discount_minor,tax_minor,total_minor,currency,commercial_notes,scope,exclusions,payment_terms,commercial_policy_version,tax_mode,tax_rate_bps,company_snapshot,approval_reasons,created_at FROM quotation_versions WHERE quotation_id=$1 AND organization_id=$2 ORDER BY version DESC", [id,actor.organization_id]);
    return Response.json({ quotation: quote[0], versions });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER","MANAGER"]);
    const id = z.uuid().parse((await context.params).id);
    const input = actionSchema.parse(await request.json());
    const result = await transaction(async (client) => {
      const current = await client.query<{ status: string; current_version: number }>("SELECT status,current_version FROM quotations WHERE id=$1 AND organization_id=$2 FOR UPDATE", [id,actor.organization_id]);
      if (!current.rows[0]) throw new ApiError(404, "Quotation not found");
      const status = current.rows[0].status;
      const allowed = input.action === "APPROVE" ? ["DRAFT","REVIEW_REQUIRED"] : input.action === "MARK_SENT" ? ["APPROVED"] : input.action === "ACCEPT" ? ["SENT"] : ["DRAFT","REVIEW_REQUIRED","APPROVED","SENT"];
      if (!allowed.includes(status)) throw new ApiError(409, `Cannot ${input.action} a ${status} quotation`);
      if (["APPROVE", "MARK_SENT", "ACCEPT"].includes(input.action)) {
        const latestPolicy = await client.query<{ commercial_policy_version: number | null }>(
          "SELECT commercial_policy_version FROM quotation_versions WHERE quotation_id=$1 AND organization_id=$2 AND version=$3",
          [id,actor.organization_id,current.rows[0].current_version],
        );
        const activePolicy = await client.query<{ version: number }>(
          "SELECT version FROM commercial_policies WHERE organization_id=$1 AND status='APPROVED' FOR SHARE",
          [actor.organization_id],
        );
        if (!latestPolicy.rows[0]?.commercial_policy_version || latestPolicy.rows[0].commercial_policy_version !== activePolicy.rows[0]?.version)
          throw new ApiError(409, "Commercial or tax policy is unapproved or has changed; regenerate the quotation");
      }
      if (input.action === "ACCEPT") {
        const latest = await client.query<{ valid_until: string }>("SELECT valid_until FROM quotation_versions WHERE quotation_id=$1 AND organization_id=$2 AND version=$3", [id,actor.organization_id,current.rows[0].current_version]);
        if (latest.rows[0] && String(latest.rows[0].valid_until).slice(0,10) < new Date().toISOString().slice(0,10)) throw new ApiError(409, "Quotation validity has expired");
      }
      const next = input.action === "APPROVE" ? "APPROVED" : input.action === "MARK_SENT" ? "SENT" : input.action === "ACCEPT" ? "ACCEPTED" : "REJECTED";
      await client.query(
        `UPDATE quotations SET status=$3,approved_by=CASE WHEN $4 THEN $5 ELSE approved_by END,
         approved_at=CASE WHEN $4 THEN now() ELSE approved_at END,
         accepted_version=CASE WHEN $6 THEN current_version ELSE accepted_version END,
         accepted_at=CASE WHEN $6 THEN now() ELSE accepted_at END,
         acceptance_evidence=CASE WHEN $6 THEN $7 ELSE acceptance_evidence END,updated_at=now()
         WHERE id=$1 AND organization_id=$2`, [id,actor.organization_id,next,input.action === "APPROVE",actor.id,input.action === "ACCEPT",input.evidence],
      );
      if (input.action === "MARK_SENT") {
        const lead = await client.query<{ lead_id: string }>("SELECT o.lead_id FROM quotations q JOIN opportunities o ON o.id=q.opportunity_id AND o.organization_id=q.organization_id WHERE q.id=$1 AND q.organization_id=$2", [id,actor.organization_id]);
        if (lead.rows[0]) await recordTemperature(client, { organizationId: actor.organization_id, leadId: lead.rows[0].lead_id, signalled: "PROPOSAL_SENT", cause: "Quotation marked sent", actorId: actor.id, systemEvent: true });
      }
      await client.query(`INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value,reason) VALUES($1,$2,$3,'quotation',$4,$5,$6)`, [actor.organization_id,actor.id,`QUOTATION_${input.action}`,id,JSON.stringify({ status: next, version: current.rows[0].current_version }),input.evidence]);
      return { id, status: next, version: current.rows[0].current_version };
    });
    return Response.json(result);
  } catch (error) { return jsonError(error); }
}
