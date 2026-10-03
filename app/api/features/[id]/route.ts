import { z } from "zod";
import { transaction } from "@/lib/db";
import { commercialStatuses, implementationStatuses, validateFeatureChange } from "@/lib/feature-matrix";
import { ApiError, jsonError, requireActor, requireSameOrigin } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };
const schema = z.object({
  implementationStatus: z.enum(implementationStatuses),
  commercialStatus: z.enum(commercialStatuses),
  evidence: z.string().trim().min(12).max(2000),
  approvedLanguage: z.string().trim().max(500).nullable().optional(),
  limitations: z.string().trim().max(1000).nullable().optional(),
  conditions: z.string().trim().max(1000).nullable().optional(),
  packages: z.array(z.enum(["STARTER","GROWTH","ENTERPRISE","RETAIL_MONTHLY","RETAIL_YEARLY","RETAIL_ONE_TIME_SETUP"])).max(6).optional(),
});

/** Only an owner or product approver may change a sellable claim; every change is appended to history. */
export async function PATCH(request: Request, context: Context) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER","PRODUCT_APPROVER"]);
    const id = z.uuid().parse((await context.params).id);
    const input = schema.parse(await request.json());
    const problem = validateFeatureChange({ status: input.implementationStatus, commercial: input.commercialStatus, evidence: input.evidence, approvedLanguage: input.approvedLanguage, conditions: input.conditions });
    if (problem) throw new ApiError(409, problem);
    const result = await transaction(async (client) => {
      const current = await client.query<{ feature_key: string }>("SELECT feature_key FROM product_features WHERE id=$1 AND organization_id=$2 FOR UPDATE", [id,actor.organization_id]);
      if (!current.rows[0]) throw new ApiError(404, "Feature not found");
      const verified = ["VERIFIED_AVAILABLE","AVAILABLE_WITH_CONFIGURATION"].includes(input.implementationStatus);
      await client.query(
        `UPDATE product_features SET implementation_status=$3,commercial_status=$4,evidence=$5,approved_language=$6,limitations=$7,conditions=$8,
           packages=COALESCE($9,packages),verified_by=CASE WHEN $10 THEN $11::uuid ELSE NULL END,verified_at=CASE WHEN $10 THEN now() ELSE NULL END,updated_at=now()
         WHERE id=$1 AND organization_id=$2`,
        [id,actor.organization_id,input.implementationStatus,input.commercialStatus,input.evidence,input.approvedLanguage ?? null,input.limitations ?? null,input.conditions ?? null,input.packages ?? null,verified,actor.id],
      );
      await client.query("INSERT INTO product_feature_history(organization_id,feature_id,implementation_status,commercial_status,evidence,actor_id) VALUES($1,$2,$3,$4,$5,$6)", [actor.organization_id,id,input.implementationStatus,input.commercialStatus,input.evidence,actor.id]);
      await client.query(`INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value,reason) VALUES($1,$2,'FEATURE_CLAIM_CHANGED','product_feature',$3,$4,$5)`, [actor.organization_id,actor.id,id,JSON.stringify(input),input.evidence]);
      return { id, featureKey: current.rows[0].feature_key, implementationStatus: input.implementationStatus };
    });
    return Response.json(result);
  } catch (error) { return jsonError(error); }
}
