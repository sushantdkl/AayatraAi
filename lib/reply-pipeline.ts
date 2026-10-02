import type { PoolClient } from "pg";
import { draftReply, REPLY_GENERATOR_VERSION, type ReplyContext, type ReplyDraft } from "@/lib/ai-replies";
import type { FeatureRecord } from "@/lib/feature-matrix";
import { extractSignals, type Language } from "@/lib/intent";
import type { MessageAnalysis } from "@/lib/message-analysis";
import type { Temperature } from "@/lib/sales-temperature";

const industryFamily: Record<string, string> = {
  RESTAURANT: "RESTAURANT_SYSTEM", HOTEL: "HOTEL_SYSTEM", HOTEL_RESTAURANT: "HOTEL_RESTAURANT_COMBINED",
  RETAIL: "RETAIL_ERP", COSMETICS: "RETAIL_ERP", KAWAII_ACCESSORIES: "RETAIL_ERP", SOCIAL_COMMERCE: "RETAIL_ERP", SALON: "SALON_SYSTEM",
};

/** Loads only verified, active, server-side facts for grounding a reply. */
export async function loadReplyContext(client: PoolClient, organizationId: string, leadId: string): Promise<ReplyContext> {
  // One pooled client cannot run queries concurrently, so these run in sequence.
  const company = await client.query<{ legal_or_trading_name: string; brand: string; primary_whatsapp: string | null; tax_status: "PAN_ONLY" | "VAT_REGISTERED"; pan_number: string | null; document_status: string }>(
      "SELECT legal_or_trading_name,brand,primary_whatsapp,tax_status,pan_number,document_status FROM company_profiles WHERE organization_id=$1", [organizationId]);
  const prices = await client.query<{ sku: string; price_minor: string }>(
      `SELECT i.sku,s.price_minor FROM commercial_items i JOIN commercial_price_sources s ON s.item_id=i.id AND s.organization_id=i.organization_id
       WHERE i.organization_id=$1 AND i.sku IS NOT NULL AND i.catalog_status='ACTIVE' AND i.is_active AND i.verification_status='VERIFIED'
         AND s.active AND s.is_canonical AND (i.effective_from IS NULL OR i.effective_from<=CURRENT_DATE) AND (i.effective_to IS NULL OR i.effective_to>=CURRENT_DATE)`, [organizationId]);
  const features = await client.query<FeatureRecord>("SELECT product_family,feature_key,name,implementation_status,commercial_status,approved_language,limitations,conditions,keywords FROM product_features WHERE organization_id=$1", [organizationId]);
  const demos = await client.query<{ product_family: string; base_url: string }>("SELECT product_family,base_url FROM demo_targets WHERE organization_id=$1 AND status='HEALTHY' AND base_url IS NOT NULL AND synthetic_data_approved_at IS NOT NULL", [organizationId]);
  const lead = await client.query<{ industry: string; sales_temperature: Temperature }>("SELECT b.industry,l.sales_temperature FROM leads l JOIN businesses b ON b.id=l.business_id AND b.organization_id=l.organization_id WHERE l.id=$1 AND l.organization_id=$2", [leadId, organizationId]);
  const profile = company.rows[0];
  return {
    company: {
      name: profile?.legal_or_trading_name ?? "Aayatra Enterprises", brand: profile?.brand ?? "Aadhar POS",
      whatsapp: profile?.primary_whatsapp ?? null, taxStatus: profile?.tax_status ?? "PAN_ONLY",
      panNumber: profile?.pan_number ?? null, panVerified: profile?.document_status === "VERIFIED",
    },
    prices: Object.fromEntries(prices.rows.map((row) => [row.sku, Number(row.price_minor)])),
    features: features.rows,
    demoLinks: Object.fromEntries(demos.rows.map((row) => [row.product_family, row.base_url])),
    leadFamily: industryFamily[lead.rows[0]?.industry ?? ""] ?? null,
    temperature: lead.rows[0]?.sales_temperature ?? "COLD",
  };
}

export type ConversationMemory = {
  business?: string; type?: string; interest?: string[]; package?: string | null; billing?: string | null;
  objections?: string[]; temperature?: Temperature; language?: Language; lastMessage?: string; nextAction?: string; updatedAt?: string;
};

/** §41 structured memory, merged deterministically from each analysed message. */
export function mergeMemory(previous: ConversationMemory, input: { business: string; industry: string; body: string; analysis: MessageAnalysis; draft: ReplyDraft }): ConversationMemory {
  const signals = extractSignals(input.body);
  const interest = new Set([...(previous.interest ?? []), ...input.analysis.product_interest]);
  const objections = new Set(previous.objections ?? []);
  if (input.analysis.objection) objections.add(input.analysis.objection);
  return {
    business: input.business,
    type: input.industry,
    interest: [...interest],
    package: signals.packageCode ?? previous.package ?? null,
    billing: signals.billing ?? previous.billing ?? null,
    objections: [...objections],
    temperature: input.draft.temperature,
    language: input.draft.language,
    lastMessage: input.body.slice(0, 280),
    nextAction: input.draft.nextActions[0] ?? input.analysis.recommended_next_action,
    updatedAt: new Date().toISOString(),
  };
}

const readable = (code: string) => code.replaceAll("_", " ").toLowerCase().replace(/^\w/, (char) => char.toUpperCase());

export function memorySummary(memory: ConversationMemory): string {
  return [
    memory.interest?.length ? `Interest: ${memory.interest.map(readable).join(", ")}` : null,
    memory.package ? `Package: ${readable(memory.package)}${memory.billing ? ` (${memory.billing === "MONTH" ? "monthly" : "yearly"})` : ""}` : null,
    memory.objections?.length ? `Objections: ${memory.objections.join(", ")}` : null,
    `Stage: ${readable(memory.temperature ?? "COLD")}`,
    memory.nextAction ? `Next: ${readable(memory.nextAction)}` : null,
  ].filter(Boolean).join(" · ");
}

export async function storeDraft(client: PoolClient, input: {
  organizationId: string; conversationId: string; messageId: string | null; kind: "REPLY" | "FOLLOW_UP";
  draft: ReplyDraft; analysis?: MessageAnalysis | null; source?: "TEMPLATE" | "LLM"; fallbackReason?: string | null;
}): Promise<string | null> {
  if (!input.draft.body) return null;
  if (input.messageId) await client.query(
    "UPDATE ai_reply_drafts SET status='SUPERSEDED' WHERE organization_id=$1 AND message_id=$2 AND status='DRAFTED'",
    [input.organizationId, input.messageId],
  );
  const stored = await client.query<{ id: string }>(
    `INSERT INTO ai_reply_drafts(organization_id,conversation_id,message_id,kind,intent,language,temperature,body,requires_human,auto_send_eligible,escalation_reasons,citations,next_actions,generator_version,source,fallback_reason,analysis)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
    [input.organizationId, input.conversationId, input.messageId, input.kind, input.draft.intent, input.draft.language, input.draft.temperature, input.draft.body,
      input.draft.requiresHuman, input.draft.autoSendEligible, JSON.stringify(input.draft.escalationReasons), JSON.stringify(input.draft.citations),
      JSON.stringify(input.draft.nextActions), REPLY_GENERATOR_VERSION, input.source ?? "TEMPLATE", input.fallbackReason ?? null, input.analysis ? JSON.stringify(input.analysis) : null],
  );
  return stored.rows[0].id;
}

export function templateDraft(body: string, context: ReplyContext): ReplyDraft {
  return draftReply(body, context);
}
