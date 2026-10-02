import { rows } from "@/lib/db";
import { jsonError, requireActor } from "@/lib/session";

export async function GET() {
  try {
    const actor = await requireActor();
    const facts = await rows(
      `SELECT c.id,c.product_family,c.capability_name,v.version,v.status,v.approved_language,
              v.limitation,v.evidence_url,v.product_version,v.created_at AS approved_at
       FROM product_capabilities c JOIN LATERAL (
         SELECT version,status,approved_language,limitation,evidence_url,product_version,created_at
         FROM capability_versions WHERE capability_id=c.id AND organization_id=c.organization_id
         ORDER BY version DESC LIMIT 1
       ) v ON true
       WHERE c.organization_id=$1 AND v.status IN ('VERIFIED','OPTIONAL')
         AND v.evidence_url IS NOT NULL AND v.approved_language IS NOT NULL
       ORDER BY c.product_family,c.capability_name`,
      [actor.organization_id],
    );
    return Response.json({ facts });
  } catch (error) {
    return jsonError(error);
  }
}
