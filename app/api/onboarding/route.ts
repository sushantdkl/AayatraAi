import { rows } from "@/lib/db";
import { jsonError, requireActor } from "@/lib/session";

export async function GET() {
  try {
    const actor = await requireActor();
    const projects = await rows(
      `SELECT p.id,p.opportunity_id,p.lead_id,p.status,p.assigned_owner,p.target_go_live,p.uat_status,p.handover_status,p.created_at,
              o.title AS opportunity_title,b.name AS business_name
       FROM implementation_projects p JOIN opportunities o ON o.id=p.opportunity_id AND o.organization_id=p.organization_id
       JOIN leads l ON l.id=p.lead_id AND l.organization_id=p.organization_id
       JOIN businesses b ON b.id=l.business_id AND b.organization_id=l.organization_id
       WHERE p.organization_id=$1 ORDER BY p.created_at DESC LIMIT 200`, [actor.organization_id],
    );
    return Response.json({ projects });
  } catch (error) { return jsonError(error); }
}
