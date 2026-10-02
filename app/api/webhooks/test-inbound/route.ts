import { z } from "zod";
import { transaction } from "@/lib/db";
import { ingestInbound } from "@/lib/conversation-ingest";
import { validWebhookSignature } from "@/lib/webhook-signature";
import { ApiError, jsonError } from "@/lib/session";

const payload = z.object({
  organizationId: z.uuid(), conversationId: z.uuid(),
  providerMessageId: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(12000),
  rawReference: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    if (process.env.ALLOW_TEST_WEBHOOKS !== "true") throw new ApiError(404, "Test inbound adapter is disabled");
    const secret = process.env.INBOUND_TEST_WEBHOOK_SECRET ?? "";
    const raw = await request.text();
    if (raw.length > 20000) throw new ApiError(413, "Payload too large");
    if (!validWebhookSignature(raw, request.headers.get("x-aayatra-timestamp") ?? "", request.headers.get("x-aayatra-signature") ?? "", secret))
      throw new ApiError(401, "Invalid webhook signature or expired timestamp");
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw new ApiError(400, "Invalid JSON payload"); }
    const input = payload.parse(parsed);
    const result = await transaction(async (client) => ingestInbound(client, {
      organizationId: input.organizationId, conversationId: input.conversationId, body: input.body,
      provider: "SIGNED_TEST", providerMessageId: input.providerMessageId, rawReference: input.rawReference,
    }));
    if (!result) throw new ApiError(404, "Conversation not found");
    return Response.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) { return jsonError(error); }
}
