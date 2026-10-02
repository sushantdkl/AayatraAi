import { z } from "zod";
import { one, rows, transaction } from "@/lib/db";
import { updateLeadSchema } from "@/lib/schemas";
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
    const lead = await one(
      `SELECT l.*,b.name,b.industry,b.city,b.website,b.notes,sr.source_type,sr.source_reference,sr.terms_reference
       FROM leads l JOIN businesses b ON b.id=l.business_id AND b.organization_id=l.organization_id
       LEFT JOIN source_records sr ON sr.id=l.source_record_id AND sr.organization_id=l.organization_id
       WHERE l.id=$1 AND l.organization_id=$2`,
      [id, actor.organization_id],
    );
    if (!lead) throw new ApiError(404, "Lead not found");
    const [contacts, activities, opportunities] = await Promise.all([
      rows(
        "SELECT id,full_name,email,phone,role_title,contact_source,contact_eligible FROM contacts WHERE business_id=$1 AND organization_id=$2 ORDER BY created_at",
        [lead.business_id, actor.organization_id],
      ),
      rows(
        "SELECT id,kind,detail,due_at,completed_at,created_at FROM activities WHERE lead_id=$1 AND organization_id=$2 ORDER BY created_at DESC LIMIT 100",
        [id, actor.organization_id],
      ),
      rows(
        "SELECT id,title,stage,product_family,value_minor,currency,next_action,next_action_at,updated_at FROM opportunities WHERE lead_id=$1 AND organization_id=$2 ORDER BY created_at DESC",
        [id, actor.organization_id],
      ),
    ]);
    return Response.json({ lead, contacts, activities, opportunities });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER", "MANAGER", "SALES"]);
    const id = z.uuid().parse((await context.params).id);
    const input = updateLeadSchema.parse(await request.json());
    if (Object.keys(input).length === 0)
      throw new ApiError(400, "No changes provided");
    const result = await transaction(async (client) => {
      const before = await client.query<{
        status: string;
        fit_score: number | null;
        digital_maturity_score: number | null;
        business_id: string;
        campaign_id: string | null;
      }>(
        "SELECT status,fit_score,digital_maturity_score,business_id,campaign_id FROM leads WHERE id=$1 AND organization_id=$2 FOR UPDATE",
        [id, actor.organization_id],
      );
      if (!before.rows[0]) throw new ApiError(404, "Lead not found");
      if (input.campaignId) {
        const campaign = await client.query(
          "SELECT id FROM campaigns WHERE id=$1 AND organization_id=$2",
          [input.campaignId, actor.organization_id],
        );
        if (!campaign.rowCount) throw new ApiError(404, "Campaign not found");
      }
      await client.query(
        `UPDATE leads SET status=coalesce($3,status),fit_score=$4,digital_maturity_score=$5,
         campaign_id=$6,updated_at=now()
         WHERE id=$1 AND organization_id=$2`,
        [
          id,
          actor.organization_id,
          input.status ?? null,
          input.fitScore === undefined
            ? before.rows[0].fit_score
            : input.fitScore,
          input.digitalMaturityScore === undefined
            ? before.rows[0].digital_maturity_score
            : input.digitalMaturityScore,
          input.campaignId === undefined
            ? before.rows[0].campaign_id
            : input.campaignId,
        ],
      );
      if (input.notes !== undefined)
        await client.query(
          "UPDATE businesses SET notes=$3,updated_at=now() WHERE id=$1 AND organization_id=$2",
          [before.rows[0].business_id, actor.organization_id, input.notes],
        );
      await client.query(
        `INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,before_value,after_value)
         VALUES($1,$2,'LEAD_UPDATED','lead',$3,$4,$5)`,
        [
          actor.organization_id,
          actor.id,
          id,
          JSON.stringify(before.rows[0]),
          JSON.stringify(input),
        ],
      );
      return { ok: true };
    });
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
