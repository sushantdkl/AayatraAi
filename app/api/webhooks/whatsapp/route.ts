import { timingSafeEqual } from "node:crypto";
import { rows, transaction } from "@/lib/db";
import { parseWhatsAppWebhook, verifyMetaSignature, type WhatsAppSettings } from "@/lib/whatsapp";
import { applyStatusUpdate, routeInboundWhatsApp } from "@/lib/whatsapp-inbound";
import { ApiError, jsonError } from "@/lib/session";

type Row = WhatsAppSettings & { organization_id: string };
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Meta webhook verification handshake. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("hub.verify_token") ?? "";
    const challenge = url.searchParams.get("hub.challenge") ?? "";
    if (url.searchParams.get("hub.mode") !== "subscribe" || !token || !/^[\w-]{1,200}$/.test(challenge)) throw new ApiError(403, "Verification failed");
    const settings = await rows<{ webhook_verify_token_secret_ref: string | null }>("SELECT webhook_verify_token_secret_ref FROM whatsapp_channel_settings WHERE webhook_verify_token_secret_ref IS NOT NULL");
    const ok = settings.some((row) => { const expected = process.env[row.webhook_verify_token_secret_ref ?? ""]; return Boolean(expected) && same(token, expected!); });
    if (!ok) throw new ApiError(403, "Verification failed");
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length > 1_000_000) throw new ApiError(413, "Payload too large");
    let payload: unknown;
    try { payload = JSON.parse(raw); } catch { throw new ApiError(400, "Invalid JSON"); }
    // Parsing only locates the tenant; nothing is trusted until the signature verifies.
    const parsed = parseWhatsAppWebhook(payload);
    if (!parsed.phoneNumberIds.length) return Response.json({ received: true });
    const settings = await rows<Row>("SELECT organization_id,phone_number_id,waba_id,access_token_secret_ref,app_secret_ref,webhook_verify_token_secret_ref,api_version FROM whatsapp_channel_settings WHERE phone_number_id = ANY($1)", [parsed.phoneNumberIds]);
    if (settings.length !== parsed.phoneNumberIds.length) throw new ApiError(404, "Unknown WhatsApp phone number");
    for (const row of settings) {
      const secret = row.app_secret_ref ? process.env[row.app_secret_ref] ?? "" : "";
      if (!verifyMetaSignature(raw, request.headers.get("x-hub-signature-256"), secret)) throw new ApiError(401, "Invalid signature");
    }
    const byPhone = new Map(settings.map((row) => [row.phone_number_id, row.organization_id]));
    const results = [];
    for (const message of parsed.messages) {
      const organizationId = byPhone.get(message.phoneNumberId)!;
      const result = await transaction((client) => routeInboundWhatsApp(client, organizationId, message));
      results.push({ id: message.id, duplicate: result?.duplicate ?? false, intent: result?.intent ?? null });
    }
    for (const update of parsed.statuses) await transaction((client) => applyStatusUpdate(client, byPhone.get(update.phoneNumberId)!, update));
    return Response.json({ received: true, messages: results });
  } catch (error) { return jsonError(error); }
}
