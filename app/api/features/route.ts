import { rows } from "@/lib/db";
import { salesPolicy, type ImplementationStatus } from "@/lib/feature-matrix";
import { jsonError, requireActor } from "@/lib/session";

export async function GET() {
  try {
    const actor = await requireActor();
    const features = await rows<{ implementation_status: ImplementationStatus }>(
      `SELECT f.id,f.product_family,f.feature_key,f.name,f.implementation_status,f.commercial_status,f.evidence,f.limitations,f.conditions,f.approved_language,f.packages,f.keywords,f.verified_at,f.updated_at,u.display_name AS verified_by_name
       FROM product_features f LEFT JOIN users u ON u.id=f.verified_by AND u.organization_id=f.organization_id
       WHERE f.organization_id=$1 ORDER BY f.product_family,f.name`, [actor.organization_id],
    );
    return Response.json({ features: features.map((feature) => ({ ...feature, sales_treatment: salesPolicy[feature.implementation_status].treatment })) });
  } catch (error) { return jsonError(error); }
}
