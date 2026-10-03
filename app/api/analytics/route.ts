import { rows } from "@/lib/db";
import { temperatures } from "@/lib/sales-temperature";
import { jsonError, requireActor } from "@/lib/session";

/** Full-funnel counts computed only from recorded state; nothing is estimated. */
export async function GET() {
  try {
    const actor = await requireActor();
    const org = [actor.organization_id];
    const [temps, drafts, quotes, payments, followUps, intents, languages] = await Promise.all([
      rows<{ temperature: string; count: number }>("SELECT sales_temperature AS temperature,count(*)::int AS count FROM leads WHERE organization_id=$1 GROUP BY 1", org),
      rows<{ status: string; source: string; count: number }>("SELECT status,source,count(*)::int AS count FROM ai_reply_drafts WHERE organization_id=$1 GROUP BY 1,2", org),
      rows<{ status: string; count: number; value_minor: string }>(`SELECT q.status,count(*)::int AS count,coalesce(sum(v.total_minor),0)::text AS value_minor FROM quotations q
        JOIN quotation_versions v ON v.quotation_id=q.id AND v.organization_id=q.organization_id AND v.version=q.current_version WHERE q.organization_id=$1 GROUP BY 1`, org),
      rows<{ verified_minor: string; pending: number }>("SELECT coalesce(sum(amount_minor) FILTER (WHERE status='VERIFIED'),0)::text AS verified_minor,count(*) FILTER (WHERE status IN ('REQUESTED','PENDING','SUBMITTED_FOR_VERIFICATION'))::int AS pending FROM payment_requests WHERE organization_id=$1", org),
      rows<{ status: string; count: number }>("SELECT status,count(*)::int AS count FROM follow_up_tasks WHERE organization_id=$1 GROUP BY 1", org),
      rows<{ intent: string; count: number }>("SELECT intent,count(*)::int AS count FROM intent_events WHERE organization_id=$1 AND created_at > now()-interval '30 days' GROUP BY 1 ORDER BY 2 DESC LIMIT 12", org),
      rows<{ language: string; count: number }>("SELECT coalesce(language,'UNKNOWN') AS language,count(*)::int AS count FROM intent_events WHERE organization_id=$1 GROUP BY 1", org),
    ]);
    return Response.json({
      funnel: temperatures.map((temperature) => ({ temperature, count: temps.find((row) => row.temperature === temperature)?.count ?? 0 })),
      aiDrafts: drafts, quotes, payments: payments[0], followUps, intents30d: intents, languages,
    });
  } catch (error) { return jsonError(error); }
}
