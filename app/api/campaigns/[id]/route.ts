import { z } from "zod";
import { transaction } from "@/lib/db";
import {
  ApiError,
  jsonError,
  requireActor,
  requireSameOrigin,
} from "@/lib/session";

type Context = { params: Promise<{ id: string }> };
const schema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "CLOSED"]),
  reason: z.string().trim().min(5).max(500),
});

export async function PATCH(request: Request, context: Context) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER", "MANAGER"]);
    const id = z.uuid().parse((await context.params).id);
    const input = schema.parse(await request.json());
    const result = await transaction(async (client) => {
      const before = await client.query<{ status: string }>(
        "SELECT status FROM campaigns WHERE id=$1 AND organization_id=$2 FOR UPDATE",
        [id, actor.organization_id],
      );
      if (!before.rows[0]) throw new ApiError(404, "Campaign not found");
      if (before.rows[0].status === input.status)
        throw new ApiError(409, "Campaign already has that status");
      await client.query(
        "UPDATE campaigns SET status=$3,updated_at=now() WHERE id=$1 AND organization_id=$2",
        [id, actor.organization_id, input.status],
      );
      await client.query(
        `INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,before_value,after_value,reason)
         VALUES($1,$2,'CAMPAIGN_STATUS_CHANGED','campaign',$3,$4,$5,$6)`,
        [
          actor.organization_id,
          actor.id,
          id,
          JSON.stringify(before.rows[0]),
          JSON.stringify({ status: input.status }),
          input.reason,
        ],
      );
      return { id, status: input.status };
    });
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
