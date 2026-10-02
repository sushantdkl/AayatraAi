import { z } from "zod";
import { rows, transaction } from "@/lib/db";
import { signalKeys } from "@/lib/insights";
import {
  ApiError,
  jsonError,
  requireActor,
  requireSameOrigin,
} from "@/lib/session";

type Context = { params: Promise<{ id: string }> };
const schema = z.object({
  signalKey: z.enum(signalKeys),
  observedValue: z.boolean(),
  confidence: z.number().min(0).max(1),
  sourceUrl: z
    .url()
    .refine((value) => ["http:", "https:"].includes(new URL(value).protocol))
    .nullable()
    .optional(),
  note: z.string().trim().max(1000).nullable().optional(),
});

export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const id = z.uuid().parse((await context.params).id);
    const observations = await rows(
      `SELECT o.id,o.signal_key,o.observed_value,o.confidence,o.source_url,o.note,o.observed_at,u.display_name AS actor_name
       FROM business_observations o JOIN users u ON u.id=o.actor_id AND u.organization_id=o.organization_id
       WHERE o.lead_id=$1 AND o.organization_id=$2 ORDER BY o.observed_at DESC LIMIT 100`,
      [id, actor.organization_id],
    );
    return Response.json({ observations });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER", "MANAGER", "SALES"]);
    const id = z.uuid().parse((await context.params).id);
    const input = schema.parse(await request.json());
    const result = await transaction(async (client) => {
      const lead = await client.query(
        "SELECT id FROM leads WHERE id=$1 AND organization_id=$2",
        [id, actor.organization_id],
      );
      if (!lead.rowCount) throw new ApiError(404, "Lead not found");
      const saved = await client.query<{ id: string }>(
        `INSERT INTO business_observations(organization_id,lead_id,signal_key,observed_value,confidence,source_url,note,actor_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [
          actor.organization_id,
          id,
          input.signalKey,
          input.observedValue,
          input.confidence,
          input.sourceUrl ?? null,
          input.note ?? null,
          actor.id,
        ],
      );
      await client.query(
        `INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value)
         VALUES($1,$2,'OBSERVATION_RECORDED','business_observation',$3,$4)`,
        [
          actor.organization_id,
          actor.id,
          saved.rows[0].id,
          JSON.stringify(input),
        ],
      );
      return { id: saved.rows[0].id };
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
