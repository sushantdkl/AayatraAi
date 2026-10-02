import { rows, transaction } from "@/lib/db";
import { normalizeContact } from "@/lib/domain";
import { jsonError, requireActor, requireSameOrigin } from "@/lib/session";
import { z } from "zod";

const schema = z.object({
  channel: z.enum(["EMAIL", "PHONE", "WHATSAPP"]),
  value: z.string().trim().min(3).max(320),
  reason: z.string().trim().min(3).max(500),
});

export async function GET() {
  try {
    const actor = await requireActor(["OWNER", "MANAGER", "SALES"]);
    const entries = await rows(
      "SELECT id,channel,normalized_value,reason,created_at FROM do_not_contact WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 200",
      [actor.organization_id],
    );
    return Response.json({ entries });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER", "MANAGER", "SALES"]);
    const input = schema.parse(await request.json());
    const normalized = normalizeContact(input.value);
    const result = await transaction(async (client) => {
      const saved = await client.query<{ id: string }>(
        `INSERT INTO do_not_contact(organization_id,channel,normalized_value,reason,created_by)
         VALUES($1,$2,$3,$4,$5) ON CONFLICT(organization_id,channel,normalized_value)
         DO UPDATE SET reason=excluded.reason RETURNING id`,
        [
          actor.organization_id,
          input.channel,
          normalized,
          input.reason,
          actor.id,
        ],
      );
      await client.query(
        `INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value,reason)
         VALUES($1,$2,'DO_NOT_CONTACT_SET','do_not_contact',$3,$4,$5)`,
        [
          actor.organization_id,
          actor.id,
          saved.rows[0].id,
          JSON.stringify({ channel: input.channel, value: normalized }),
          input.reason,
        ],
      );
      return { id: saved.rows[0].id };
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
