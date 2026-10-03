import { transaction } from "@/lib/db";
import { applyOwnerConfig } from "@/lib/owner-config-apply";
import { jsonError, requireActor, requireSameOrigin } from "@/lib/session";

export async function POST(request: Request) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER"]);
    const result = await transaction((client) => applyOwnerConfig(client, actor.organization_id, actor.id));
    return Response.json({ result });
  } catch (error) { return jsonError(error); }
}
