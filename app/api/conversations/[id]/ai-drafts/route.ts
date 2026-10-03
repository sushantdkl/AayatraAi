import { z } from "zod";
import { db, rows, transaction } from "@/lib/db";
import { draftWithLlm, llmEnabled, type HistoryMessage } from "@/lib/llm-reply";
import { analyzeMessage } from "@/lib/message-analysis";
import { loadReplyContext, storeDraft, templateDraft } from "@/lib/reply-pipeline";
import { ApiError, jsonError, requireActor, requireSameOrigin } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const id = z.uuid().parse((await context.params).id);
    const [drafts, conversation] = await Promise.all([
      rows(`SELECT id,message_id,kind,intent,language,temperature,body,requires_human,auto_send_eligible,escalation_reasons,citations,next_actions,status,source,fallback_reason,analysis,outbound_message_id,created_at
            FROM ai_reply_drafts WHERE conversation_id=$1 AND organization_id=$2 ORDER BY created_at DESC LIMIT 20`, [id,actor.organization_id]),
      rows("SELECT memory,(SELECT sales_temperature FROM leads l WHERE l.id=c.lead_id) AS temperature FROM conversations c WHERE id=$1 AND organization_id=$2", [id,actor.organization_id]),
    ]);
    if (!conversation[0]) throw new ApiError(404, "Conversation not found");
    return Response.json({ drafts, memory: conversation[0].memory, temperature: conversation[0].temperature, llmEnabled: llmEnabled() });
  } catch (error) { return jsonError(error); }
}

/** Regenerate a suggested reply for the latest inbound message; uses Claude when enabled, else templates. */
export async function POST(request: Request, context: Context) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER","MANAGER","SALES"]);
    const id = z.uuid().parse((await context.params).id);
    const client = await db().connect();
    let prepared;
    try {
      const thread = await client.query<{ lead_id: string; status: string }>("SELECT lead_id,status FROM conversations WHERE id=$1 AND organization_id=$2", [id,actor.organization_id]);
      if (!thread.rows[0]) throw new ApiError(404, "Conversation not found");
      if (thread.rows[0].status !== "OPEN") throw new ApiError(409, "Conversation is paused or closed");
      const messages = await client.query<{ id: string; direction: "INBOUND" | "OUTBOUND"; body: string }>(
        "SELECT id,direction,body FROM conversation_messages WHERE conversation_id=$1 AND organization_id=$2 AND direction IN ('INBOUND','OUTBOUND') ORDER BY created_at DESC LIMIT 20", [id,actor.organization_id],
      );
      const latest = messages.rows.find((message) => message.direction === "INBOUND");
      if (!latest) throw new ApiError(409, "No incoming message to reply to");
      const replyContext = await loadReplyContext(client, actor.organization_id, thread.rows[0].lead_id);
      const history: HistoryMessage[] = messages.rows.slice().reverse().filter((message) => message.id !== latest.id).map(({ direction, body }) => ({ direction, body }));
      prepared = { latest, replyContext, history };
    } finally { client.release(); }
    // The model call happens outside any database transaction.
    const template = templateDraft(prepared.latest.body, prepared.replyContext);
    const result = llmEnabled()
      ? await draftWithLlm({ message: prepared.latest.body, history: prepared.history, context: prepared.replyContext, template })
      : { ...template, source: "TEMPLATE" as const, fallbackReason: "LLM not configured" };
    const draftId = await transaction((tx) => storeDraft(tx, {
      organizationId: actor.organization_id, conversationId: id, messageId: prepared.latest.id, kind: "REPLY",
      draft: result, analysis: analyzeMessage(prepared.latest.body), source: result.source, fallbackReason: result.fallbackReason,
    }));
    return Response.json({ id: draftId, source: result.source, fallbackReason: result.fallbackReason, body: result.body, requiresHuman: result.requiresHuman }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
