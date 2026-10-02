import { z } from "zod";
import { transaction } from "@/lib/db";
import { ApiError, jsonError, requireActor, requireSameOrigin } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };
const control = z.object({ action: z.enum(["TAKE_OVER","PAUSE","RETURN_TO_DRAFT","MARK_READ","CLOSE"]) });
export async function POST(request: Request, context: Context) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER","MANAGER","SALES"]);
    const id = z.uuid().parse((await context.params).id);
    const input = control.parse(await request.json());
    const result = await transaction(async (client) => {
      const existing = await client.query("SELECT id FROM conversations WHERE id=$1 AND organization_id=$2 FOR UPDATE", [id,actor.organization_id]);
      if (!existing.rowCount) throw new ApiError(404, "Conversation not found");
      const mode = input.action === "RETURN_TO_DRAFT" ? "AI_DRAFT" : "HUMAN";
      const status = input.action === "PAUSE" ? "PAUSED" : input.action === "CLOSE" ? "CLOSED" : "OPEN";
      await client.query(
        `UPDATE conversations SET control_mode=$3,status=$4,needs_human=$5,unread_count=CASE WHEN $6 THEN 0 ELSE unread_count END,updated_at=now()
         WHERE id=$1 AND organization_id=$2`,
        [id,actor.organization_id,mode,status,input.action !== "MARK_READ",input.action === "MARK_READ"],
      );
      await client.query(`INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,$3,'conversation',$4)`, [actor.organization_id,actor.id,`CONVERSATION_${input.action}`,id]);
      return { id, action: input.action, controlMode: mode, status };
    });
    return Response.json(result);
  } catch (error) { return jsonError(error); }
}
