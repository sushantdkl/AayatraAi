import { z } from "zod";
import { one, rows } from "@/lib/db";
import { deriveInsights, type Observation } from "@/lib/insights";
import type { Industry } from "@/lib/types";
import { ApiError, jsonError, requireActor } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const id = z.uuid().parse((await context.params).id);
    const lead = await one<{ industry: Industry }>(
      `SELECT b.industry FROM leads l JOIN businesses b ON b.id=l.business_id AND b.organization_id=l.organization_id
       WHERE l.id=$1 AND l.organization_id=$2`,
      [id, actor.organization_id],
    );
    if (!lead) throw new ApiError(404, "Lead not found");
    const history = await rows<Observation>(
      "SELECT signal_key,observed_value,confidence::float AS confidence,observed_at::text AS observed_at FROM business_observations WHERE lead_id=$1 AND organization_id=$2 ORDER BY observed_at DESC",
      [id, actor.organization_id],
    );
    return Response.json({ insights: deriveInsights(lead.industry, history) });
  } catch (error) {
    return jsonError(error);
  }
}
