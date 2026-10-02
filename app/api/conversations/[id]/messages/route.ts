import { z } from "zod";
import { rows, transaction } from "@/lib/db";
import { ingestInbound } from "@/lib/conversation-ingest";
import { ApiError, jsonError, requireActor, requireSameOrigin } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };
const create = z.object({ body: z.string().trim().min(1).max(12000), direction: z.literal("INBOUND") });

export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const id = z.uuid().parse((await context.params).id);
    const messages = await rows("SELECT id,direction,body,provider,provider_message_id,created_at FROM conversation_messages WHERE conversation_id=$1 AND organization_id=$2 ORDER BY created_at LIMIT 300", [id,actor.organization_id]);
    return Response.json({ messages });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER","MANAGER","SALES"]);
    const id = z.uuid().parse((await context.params).id);
    const input = create.parse(await request.json());
    const result = await transaction(async (client) => ingestInbound(client, { organizationId: actor.organization_id, conversationId: id, body: input.body, actorId: actor.id, provider: "MANUAL" }));
    if (!result) throw new ApiError(404, "Conversation not found");
    return Response.json(result, { status: 201 });
  } catch (error) { return jsonError(error); }
}
