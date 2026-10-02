import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { normalizeWhatsAppNumber, parseWhatsAppWebhook, resolveWhatsAppProvider, verifyMetaSignature, whatsappStatus, withinServiceWindow, WhatsAppCloudProvider } from "../lib/whatsapp";

const settings = { phone_number_id: "123456789012", waba_id: "987654321098", access_token_secret_ref: "WA_TOKEN", app_secret_ref: "WA_APP_SECRET", webhook_verify_token_secret_ref: "WA_VERIFY", api_version: "v26.0" };
const env = { WA_TOKEN: "token", WA_APP_SECRET: "secret", WA_VERIFY: "verify" };

test("Nepal numbers normalise to WhatsApp E.164 digits", () => {
  assert.equal(normalizeWhatsAppNumber("+977 9804573494"), "9779804573494");
  assert.equal(normalizeWhatsAppNumber("9804573494"), "9779804573494");
  assert.equal(normalizeWhatsAppNumber("abc"), null);
});
test("production stays NOT_CONFIGURED until every ID and secret resolves; test provider only on opt-in", () => {
  assert.equal(whatsappStatus(null).state, "NOT_CONFIGURED");
  assert.equal(whatsappStatus(settings, {}).state, "NOT_CONFIGURED");
  assert.equal(whatsappStatus(settings, env).state, "CONFIGURED");
  assert.equal(resolveWhatsAppProvider(null, {}).name, "NOT_CONFIGURED");
  assert.equal(resolveWhatsAppProvider(null, { MESSAGING_TEST_PROVIDER: "true" }).name, "SIMULATED_TEST");
  assert.equal(resolveWhatsAppProvider(settings, env).name, "WHATSAPP_CLOUD");
});
test("Meta signatures are verified over the raw body", () => {
  const raw = '{"object":"whatsapp_business_account"}';
  const signature = `sha256=${createHmac("sha256", "secret").update(raw).digest("hex")}`;
  assert.equal(verifyMetaSignature(raw, signature, "secret"), true);
  assert.equal(verifyMetaSignature(raw + " ", signature, "secret"), false);
  assert.equal(verifyMetaSignature(raw, signature, ""), false);
  assert.equal(verifyMetaSignature(raw, null, "secret"), false);
});
test("webhook payload parsing extracts text, buttons, media placeholders and statuses", () => {
  const parsed = parseWhatsAppWebhook({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: {
    metadata: { phone_number_id: "123456789012" }, contacts: [{ wa_id: "9779800000000", profile: { name: "Momo House" } }],
    messages: [{ from: "9779800000000", id: "wamid.1", timestamp: "1760000000", type: "text", text: { body: "price kati ho?" } }, { from: "9779800000000", id: "wamid.2", type: "image" }],
    statuses: [{ id: "wamid.out", status: "delivered", recipient_id: "9779800000000" }],
  } }] }] });
  assert.deepEqual(parsed.phoneNumberIds, ["123456789012"]);
  assert.equal(parsed.messages[0].body, "price kati ho?");
  assert.equal(parsed.messages[0].profileName, "Momo House");
  assert.equal(parsed.messages[1].body, "[image message]");
  assert.equal(parsed.statuses[0].status, "delivered");
  assert.deepEqual(parseWhatsAppWebhook({ object: "page" }).messages, []);
});
test("24h customer-service window", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  assert.equal(withinServiceWindow(new Date("2026-10-10T00:00:00Z"), now), true);
  assert.equal(withinServiceWindow(new Date("2026-10-09T11:00:00Z"), now), false);
  assert.equal(withinServiceWindow(null, now), false);
});
test("Cloud provider posts a text message and only reports SENT with a message id", async () => {
  const calls: Array<{ url: string; body: string; auth: string }> = [];
  const ok = new WhatsAppCloudProvider({ phoneNumberId: "123456789012", accessToken: "token", apiVersion: "v26.0" }, async (url, init) => {
    calls.push({ url, body: init.body, auth: init.headers.Authorization });
    return { ok: true, status: 200, json: async () => ({ messages: [{ id: "wamid.sent" }] }) };
  });
  assert.deepEqual(await ok.deliver({ channel: "WHATSAPP", destination: "9804573494", body: "Namaste", idempotencyKey: "k" }), { status: "SENT", providerReference: "wamid.sent" });
  assert.equal(calls[0].url, "https://graph.facebook.com/v26.0/123456789012/messages");
  assert.equal(JSON.parse(calls[0].body).to, "9779804573494");
  assert.equal(calls[0].auth, "Bearer token");
  const failing = new WhatsAppCloudProvider({ phoneNumberId: "1", accessToken: "t", apiVersion: "v26.0" }, async () => ({ ok: false, status: 401, json: async () => ({ error: { message: "Invalid OAuth token" } }) }));
  assert.equal((await failing.deliver({ channel: "WHATSAPP", destination: "9804573494", body: "x", idempotencyKey: "k" })).status, "FAILED");
});
