import { z } from "zod";
import { transaction } from "@/lib/db";
import {
  ApiError,
  jsonError,
  requireActor,
  requireSameOrigin,
} from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER", "MANAGER", "SALES"]);
    const id = z.uuid().parse((await context.params).id);
    const result = await transaction(async (client) => {
      const item = await client.query<{
        kind: string;
        completed_at: string | null;
      }>(
        "SELECT kind,completed_at FROM activities WHERE id=$1 AND organization_id=$2 FOR UPDATE",
        [id, actor.organization_id],
      );
      if (!item.rows[0]) throw new ApiError(404, "Activity not found");
      if (item.rows[0].kind !== "TASK")
        throw new ApiError(409, "Only tasks can be completed");
      if (item.rows[0].completed_at)
        throw new ApiError(409, "Task is already complete");
      await client.query(
        "UPDATE activities SET completed_at=now() WHERE id=$1 AND organization_id=$2",
        [id, actor.organization_id],
      );
      await client.query(
        `INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id)
         VALUES($1,$2,'TASK_COMPLETED','activity',$3)`,
        [actor.organization_id, actor.id, id],
      );
      return { id, completed: true };
    });
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
