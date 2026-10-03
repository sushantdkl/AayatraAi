import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { ReplyContext, ReplyDraft } from "@/lib/ai-replies";
import { formatNpr, posterCatalogue } from "@/lib/owner-config";
import { replySafetyViolations } from "@/lib/reply-safety";
import { SALES_PERSONA } from "@/lib/sales-persona";

export const LLM_MODEL = process.env.AI_REPLY_MODEL || "claude-opus-5-5";

const llmReplySchema = z.object({
  reply: z.string(),
  language: z.enum(["EN", "NE", "NE_ROMAN"]),
  needs_human: z.boolean(),
  used_skus: z.array(z.string()),
  reason: z.string(),
});
export type LlmReply = z.infer<typeof llmReplySchema>;

export type HistoryMessage = { direction: "INBOUND" | "OUTBOUND"; body: string };

/** Injection point for tests; production uses the Anthropic SDK. */
export type ModelCall = (input: { system: string; facts: string; user: string }) => Promise<{ refused: boolean; output: LlmReply | null }>;

export function llmEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.AI_REPLY_PROVIDER === "anthropic" && Boolean(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN);
}

/** Grounding facts: the only prices, features and company facts the model may use. */
export function buildFacts(context: ReplyContext): string {
  const names = new Map(posterCatalogue.map((item) => [item.sku, item.name]));
  const prices = Object.entries(context.prices).sort(([a], [b]) => a.localeCompare(b))
    .map(([sku, minor]) => `- ${sku} (${names.get(sku) ?? sku}): ${formatNpr(minor)}${sku.endsWith("_MONTHLY") ? "/month" : sku.endsWith("_YEARLY") ? "/year" : ""}`);
  const features = [...context.features].sort((a, b) => `${a.product_family}${a.feature_key}`.localeCompare(`${b.product_family}${b.feature_key}`))
    .map((feature) => `- [${feature.product_family}] ${feature.name}: ${feature.implementation_status}${feature.approved_language ? ` — approved wording: "${feature.approved_language}"` : ""}${feature.limitations ? ` — limitation: ${feature.limitations}` : ""}${feature.conditions ? ` — conditions: ${feature.conditions}` : ""}`);
  const company = context.company;
  const demos = Object.entries(context.demoLinks).map(([family, url]) => `- ${family}: ${url}`);
  return [
    "FACTS (authoritative; nothing outside this list may be stated as fact)",
    `Company: ${company.name}, brand ${company.brand}, Kathmandu, Nepal. WhatsApp: ${company.whatsapp ?? "not configured"}.`,
    `Tax status: ${company.taxStatus}${company.taxStatus === "PAN_ONLY" ? " (VAT not separately charged)" : ""}. PAN: ${company.panVerified && company.panNumber ? company.panNumber : "not to be stated"}.`,
    "Approved current standard prices (negotiable only via a human):", ...(prices.length ? prices : ["- none active; the team will confirm pricing"]),
    "Retail offer: customers who already have equipment can take only the POS system at the retail monthly price.",
    "Feature claim register:", ...features,
    "Reviewed demo links:", ...(demos.length ? demos : ["- none yet; the team arranges demos"]),
  ].join("\n");
}

function escapeTag(text: string): string {
  return text.replace(/</g, "‹").replace(/>/g, "›");
}

export function buildUserTurn(message: string, history: HistoryMessage[], template: ReplyDraft): string {
  const transcript = history.slice(-12).map((item) => `${item.direction === "INBOUND" ? "Customer" : "Aayatra"}: ${escapeTag(item.body)}`).join("\n");
  return [
    `<conversation>\n${transcript || "(no earlier messages)"}\n</conversation>`,
    `<customer_message>\n${escapeTag(message)}\n</customer_message>`,
    `Server classification (authoritative): intent=${template.intent}; buying stage=${template.temperature}; must involve a human=${template.requiresHuman}; escalation reasons=${template.escalationReasons.join("; ") || "none"}.`,
    template.body ? `Safe reference reply you may improve for naturalness (keep every fact and amount identical): ${template.body}` : "The customer opted out: write no sales content.",
    "Write the next WhatsApp reply from Aayatra following all rules.",
  ].join("\n\n");
}

export const anthropicModelCall: ModelCall = async ({ system, facts, user }) => {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: LLM_MODEL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    // Persona and facts are stable across messages: cache them.
    system: [
      { type: "text", text: system },
      { type: "text", text: facts, cache_control: { type: "ephemeral" } },
    ],
    output_config: { effort: "low", format: betaZodOutputFormat(llmReplySchema) },
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") return { refused: true, output: null };
  return { refused: false, output: response.parsed_output ?? null };
};

/**
 * LLM drafting layered on the deterministic engine. The server keeps authority over intent,
 * temperature, next actions and human review; the model only words the reply. Any guardrail
 * violation, refusal or error falls back to the deterministic template.
 */
export async function draftWithLlm(input: { message: string; history: HistoryMessage[]; context: ReplyContext; template: ReplyDraft }, call: ModelCall = anthropicModelCall): Promise<ReplyDraft & { source: "LLM" | "TEMPLATE"; fallbackReason: string | null }> {
  const { template } = input;
  if (!template.body) return { ...template, source: "TEMPLATE", fallbackReason: "Opt-out: no reply" };
  try {
    const result = await call({ system: SALES_PERSONA, facts: buildFacts(input.context), user: buildUserTurn(input.message, input.history, template) });
    if (result.refused || !result.output) return { ...template, source: "TEMPLATE", fallbackReason: result.refused ? "Model refusal" : "Unparseable model output" };
    const reply = result.output.reply.trim();
    // Amounts must belong to SKUs the model declared or the server already cited, not just any catalogue price.
    const permitted = [...new Set([...result.output.used_skus, ...template.citations.skus])].map((sku) => input.context.prices[sku]).filter((value): value is number => value !== undefined);
    const violations = replySafetyViolations(reply, permitted);
    if (!reply || reply.length > 1500) violations.push("Empty or overlong reply");
    const unknownSku = result.output.used_skus.filter((sku) => input.context.prices[sku] === undefined);
    if (unknownSku.length) violations.push(`Unknown SKUs ${unknownSku.join(",")}`);
    if (violations.length) return { ...template, source: "TEMPLATE", fallbackReason: `Guardrail: ${violations.join("; ")}`, escalationReasons: [...template.escalationReasons, ...violations.map((v) => `LLM draft rejected: ${v}`)] };
    return {
      ...template,
      body: reply,
      language: result.output.language,
      requiresHuman: template.requiresHuman || result.output.needs_human,
      // Model-worded text is never auto-sent; a person approves it.
      autoSendEligible: false,
      citations: { ...template.citations, skus: [...new Set([...template.citations.skus, ...result.output.used_skus])] },
      source: "LLM",
      fallbackReason: null,
    };
  } catch (error) {
    const reason = error instanceof Anthropic.APIError ? `Anthropic API ${error.status ?? "error"}` : error instanceof Error ? error.message.slice(0, 200) : "LLM call failed";
    return { ...template, source: "TEMPLATE", fallbackReason: reason };
  }
}
