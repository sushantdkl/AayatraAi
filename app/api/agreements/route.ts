import { z } from "zod";
import { rows, transaction } from "@/lib/db";
import { ApiError, jsonError, requireActor, requireSameOrigin } from "@/lib/session";

const create = z.object({
  opportunityId: z.uuid(), quotationId: z.uuid(), templateReference: z.string().trim().min(8).max(500),
  versionReference: z.string().trim().min(3).max(200), acceptanceEvidence: z.string().trim().min(8).max(1000),
  legalReviewReference: z.string().trim().min(8).max(500),
  acceptedAt: z.iso.datetime({ offset: true }),
});
export async function GET() {
  try { const actor = await requireActor(); return Response.json({ agreements: await rows("SELECT id,opportunity_id,quotation_id,template_reference,version_reference,legal_review_reference,accepted_at,created_at FROM service_agreements WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100", [actor.organization_id]) }); }
  catch (error) { return jsonError(error); }
}
export async function POST(request: Request) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER"]);
    const input = create.parse(await request.json());
    const result = await transaction(async (client) => {
      const quote = await client.query("SELECT id FROM quotations WHERE id=$1 AND organization_id=$2 AND opportunity_id=$3 AND status='ACCEPTED'", [input.quotationId,actor.organization_id,input.opportunityId]);
      if (!quote.rowCount) throw new ApiError(409, "An accepted quotation is required");
      const created = await client.query<{ id: string }>(
        `INSERT INTO service_agreements(organization_id,opportunity_id,quotation_id,template_reference,version_reference,recorded_approval_by,legal_review_reference,acceptance_evidence,accepted_at,recorded_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [actor.organization_id,input.opportunityId,input.quotationId,input.templateReference,input.versionReference,actor.id,input.legalReviewReference,input.acceptanceEvidence,input.acceptedAt,actor.id],
      );
      await client.query(`INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value) VALUES($1,$2,'AGREEMENT_ACCEPTANCE_RECORDED','service_agreement',$3,$4)`, [actor.organization_id,actor.id,created.rows[0].id,JSON.stringify({ templateReference: input.templateReference, versionReference: input.versionReference, legalReviewReference: input.legalReviewReference })]);
      return { id: created.rows[0].id };
    });
    return Response.json(result, { status: 201 });
  } catch (error) { return jsonError(error); }
}
