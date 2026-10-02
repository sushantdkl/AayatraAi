import { rows } from "@/lib/db";
import { jsonError, requireActor } from "@/lib/session";

export async function GET() {
  try {
    const actor = await requireActor();
    const [summary, priority, followups] = await Promise.all([
      rows<{
        leads: string;
        qualified: string;
        opportunities: string;
        hot: string;
        ready: string;
        pipeline_minor: string;
      }>(
        `SELECT
          (SELECT count(*) FROM leads WHERE organization_id=$1) AS leads,
          (SELECT count(*) FROM leads WHERE organization_id=$1 AND status='QUALIFIED') AS qualified,
          (SELECT count(*) FROM opportunities WHERE organization_id=$1 AND stage NOT IN ('WON','LOST')) AS opportunities,
          (SELECT count(*) FROM opportunities WHERE organization_id=$1 AND stage='HOT') AS hot,
          (SELECT count(*) FROM opportunities WHERE organization_id=$1 AND stage='READY') AS ready,
          (SELECT coalesce(sum(value_minor),0) FROM opportunities WHERE organization_id=$1 AND stage NOT IN ('WON','LOST')) AS pipeline_minor`,
        [actor.organization_id],
      ),
      rows(
        `SELECT o.id,o.title,o.stage,o.product_family,o.next_action,o.next_action_at,o.value_minor,
                b.name AS business_name,b.industry,b.city,l.id AS lead_id
         FROM opportunities o JOIN leads l ON l.id=o.lead_id AND l.organization_id=o.organization_id
         JOIN businesses b ON b.id=l.business_id AND b.organization_id=l.organization_id
         WHERE o.organization_id=$1 AND o.stage NOT IN ('WON','LOST')
         ORDER BY CASE o.stage WHEN 'PAYMENT' THEN 0 WHEN 'READY' THEN 1 WHEN 'HOT' THEN 2 WHEN 'NEGOTIATING' THEN 3 WHEN 'PROPOSAL' THEN 4 ELSE 5 END,
                  o.next_action_at NULLS LAST,o.updated_at DESC LIMIT 12`,
        [actor.organization_id],
      ),
      rows(
        `SELECT a.id,a.kind,a.detail,a.due_at,b.name AS business_name,a.lead_id
         FROM activities a JOIN leads l ON l.id=a.lead_id AND l.organization_id=a.organization_id
         JOIN businesses b ON b.id=l.business_id AND b.organization_id=l.organization_id
         WHERE a.organization_id=$1 AND a.kind='TASK' AND a.completed_at IS NULL AND a.due_at <= now()+interval '1 day'
         ORDER BY a.due_at ASC LIMIT 10`,
        [actor.organization_id],
      ),
    ]);
    return Response.json({ summary: summary[0], priority, followups });
  } catch (error) {
    return jsonError(error);
  }
}
