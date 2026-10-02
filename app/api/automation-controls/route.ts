import { z } from "zod";
import { rows, transaction } from "@/lib/db";
import { allowedAutomationMode, automationFeatures } from "@/lib/automation-controls";
import { ApiError, jsonError, requireActor, requireSameOrigin } from "@/lib/session";

const schema = z.object({ feature: z.enum(automationFeatures), mode: z.enum(["OFF","ASSISTED","AUTOMATIC_WITH_RULES"]) });
export async function GET() {
  try {
    const actor = await requireActor();
    const values = await rows<{ feature: string; mode: string }>("SELECT feature,mode FROM automation_controls WHERE organization_id=$1", [actor.organization_id]);
    return Response.json({ controls: automationFeatures.map((feature) => ({ feature, mode: values.find((value) => value.feature === feature)?.mode ?? "OFF" })) });
  } catch (error) { return jsonError(error); }
}
export async function PATCH(request: Request) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER"]);
    const input = schema.parse(await request.json());
    if (!allowedAutomationMode(input.feature,input.mode)) throw new ApiError(409, "Automatic mode for this feature is blocked until provider, product and commercial policy gates are verified");
    const result = await transaction(async (client) => {
      await client.query(
        `INSERT INTO automation_controls(organization_id,feature,mode,updated_by) VALUES($1,$2,$3,$4)
         ON CONFLICT(organization_id,feature) DO UPDATE SET mode=$3,updated_by=$4,updated_at=now()`,
        [actor.organization_id,input.feature,input.mode,actor.id],
      );
      await client.query(`INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value) VALUES($1,$2,'AUTOMATION_CONTROL_CHANGED','organization',$1,$3)`, [actor.organization_id,actor.id,JSON.stringify(input)]);
      return input;
    });
    return Response.json(result);
  } catch (error) { return jsonError(error); }
}
