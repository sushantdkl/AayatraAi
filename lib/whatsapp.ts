import { createHmac, timingSafeEqual } from "node:crypto";
import { NotConfiguredProvider, SimulatedProvider, type DeliveryResult, type OutboundProvider } from "@/lib/outbound-provider";

export type WhatsAppSettings = {
  phone_number_id: string | null;
  waba_id: string | null;
  access_token_secret_ref: string | null;
  app_secret_ref: string | null;
  webhook_verify_token_secret_ref: string | null;
  api_version: string;
};
type Env = Record<string, string | undefined>;

export type WhatsAppStatus = { state: "NOT_CONFIGURED" | "CONFIGURED"; missing: string[] };

/** Production stays NOT_CONFIGURED until every ID and secret reference resolves. Secrets live only in the environment. */
export function whatsappStatus(settings: WhatsAppSettings | null, env: Env = process.env): WhatsAppStatus {
  const missing: string[] = [];
  if (!settings?.phone_number_id) missing.push("PHONE_NUMBER_ID");
  if (!settings?.waba_id) missing.push("WABA_ID");
  for (const [ref, label] of [[settings?.access_token_secret_ref, "ACCESS_TOKEN_SECRET_REF"], [settings?.app_secret_ref, "APP_SECRET_REF"], [settings?.webhook_verify_token_secret_ref, "WEBHOOK_VERIFY_TOKEN_SECRET_REF"]] as const) {
    if (!ref) missing.push(label);
    else if (!env[ref]) missing.push(`${label} (${ref} not set in environment)`);
  }
  return { state: missing.length ? "NOT_CONFIGURED" : "CONFIGURED", missing };
}

/** Nepal-first E.164 digits without "+": 9804573494 → 9779804573494. */
export function normalizeWhatsAppNumber(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (/^9[78]\d{8}$/.test(digits)) return `977${digits}`;
  if (/^0?9[78]\d{8}$/.test(digits)) return `977${digits.replace(/^0/, "")}`;
  if (/^\d{10,15}$/.test(digits)) return digits;
  return null;
}

/** Meta signs the raw body with the app secret: X-Hub-Signature-256: sha256=<hex>. */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !appSecret) return false;
  const match = /^sha256=([a-f0-9]{64})$/i.exec(header.trim());
  if (!match) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  const provided = Buffer.from(match[1], "hex");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export type InboundWhatsAppMessage = { phoneNumberId: string; from: string; id: string; timestamp: number; body: string; profileName: string | null };
export type WhatsAppStatusUpdate = { phoneNumberId: string; id: string; status: string; recipient: string | null };

type WebhookPayload = { object?: string; entry?: Array<{ changes?: Array<{ field?: string; value?: {
  metadata?: { phone_number_id?: string };
  contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
  messages?: Array<{ from?: string; id?: string; timestamp?: string; type?: string; text?: { body?: string }; button?: { text?: string }; interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } } }>;
  statuses?: Array<{ id?: string; status?: string; recipient_id?: string }>;
} }> }> };

export function parseWhatsAppWebhook(payload: unknown): { phoneNumberIds: string[]; messages: InboundWhatsAppMessage[]; statuses: WhatsAppStatusUpdate[] } {
  const data = payload as WebhookPayload;
  const messages: InboundWhatsAppMessage[] = [];
  const statuses: WhatsAppStatusUpdate[] = [];
  const ids = new Set<string>();
  if (data?.object !== "whatsapp_business_account") return { phoneNumberIds: [], messages, statuses };
  for (const entry of data.entry ?? []) for (const change of entry.changes ?? []) {
    const value = change.value;
    const phoneNumberId = value?.metadata?.phone_number_id;
    if (!phoneNumberId || change.field !== "messages") continue;
    ids.add(phoneNumberId);
    const names = new Map((value?.contacts ?? []).map((contact) => [contact.wa_id ?? "", contact.profile?.name ?? null]));
    for (const message of value?.messages ?? []) {
      if (!message.from || !message.id) continue;
      const text = message.text?.body ?? message.button?.text ?? message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title;
      const body = (text?.trim() || `[${message.type ?? "unsupported"} message]`).slice(0, 12000);
      messages.push({ phoneNumberId, from: message.from, id: message.id, timestamp: Number(message.timestamp ?? 0), body, profileName: names.get(message.from) ?? null });
    }
    for (const status of value?.statuses ?? []) if (status.id && status.status) statuses.push({ phoneNumberId, id: status.id, status: status.status, recipient: status.recipient_id ?? null });
  }
  return { phoneNumberIds: [...ids], messages, statuses };
}

/** Free-form replies are only allowed inside the 24h customer-service window; otherwise an approved template is required. */
export function withinServiceWindow(lastInboundAt: Date | null, now = new Date()): boolean {
  return Boolean(lastInboundAt && now.getTime() - lastInboundAt.getTime() < 24 * 3600 * 1000);
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export class WhatsAppCloudProvider implements OutboundProvider {
  readonly name = "WHATSAPP_CLOUD";
  constructor(private readonly config: { phoneNumberId: string; accessToken: string; apiVersion: string }, private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike) {}
  async deliver(input: Parameters<OutboundProvider["deliver"]>[0]): Promise<DeliveryResult> {
    if (input.channel !== "WHATSAPP") return { status: "FAILED", reason: "WhatsApp provider only sends WhatsApp messages" };
    const to = normalizeWhatsAppNumber(input.destination);
    if (!to) return { status: "FAILED", reason: "Destination is not a valid WhatsApp number" };
    try {
      const response = await this.fetchImpl(`https://graph.facebook.com/${this.config.apiVersion}/${this.config.phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.config.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body: input.body } }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json() as { messages?: Array<{ id?: string }>; error?: { message?: string; code?: number } };
      if (!response.ok || !data.messages?.[0]?.id) return { status: "FAILED", reason: `WhatsApp API ${response.status}: ${data.error?.message?.slice(0, 200) ?? "no message id"}` };
      return { status: "SENT", providerReference: data.messages[0].id };
    } catch (error) {
      return { status: "FAILED", reason: error instanceof Error ? error.message.slice(0, 200) : "WhatsApp request failed" };
    }
  }
}

/** Real provider when configured; the simulated test provider only when explicitly enabled; otherwise NOT_CONFIGURED. */
export function resolveWhatsAppProvider(settings: WhatsAppSettings | null, env: Env = process.env, fetchImpl?: FetchLike): OutboundProvider {
  if (whatsappStatus(settings, env).state === "CONFIGURED" && settings?.phone_number_id && settings.access_token_secret_ref)
    return new WhatsAppCloudProvider({ phoneNumberId: settings.phone_number_id, accessToken: env[settings.access_token_secret_ref] ?? "", apiVersion: settings.api_version }, fetchImpl);
  if (env.MESSAGING_TEST_PROVIDER === "true") return new SimulatedProvider();
  return new NotConfiguredProvider();
}
