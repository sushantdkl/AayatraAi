import { z } from "zod";
import { one, transaction } from "@/lib/db";
import { ApiError, jsonError, requireActor, requireSameOrigin } from "@/lib/session";

const saveDraft = z.object({
  action: z.literal("SAVE_DRAFT"),
  taxMode: z.enum(["UNCONFIGURED", "EXEMPT", "EXCLUSIVE", "PAN_ONLY"]),
  taxRateBps: z.number().int().min(0).max(10000).nullable(),
  taxLabel: z.string().trim().max(80).nullable(),
  maxManualDiscountBps: z.number().int().min(0).max(10000),
  maxAutoDiscountBps: z.number().int().min(0).max(10000),
  defaultDiscountBps: z.number().int().min(0).max(10000).default(0),
  priceNegotiable: z.boolean().default(true),
  maxNegotiationRounds: z.number().int().min(0).max(20),
  maxMessagesPerContactPerDay: z.number().int().min(0).max(100),
}).superRefine((value, ctx) => {
  if (value.maxAutoDiscountBps > value.maxManualDiscountBps)
    ctx.addIssue({ code: "custom", message: "Automatic discount ceiling cannot exceed the manual ceiling", path: ["maxAutoDiscountBps"] });
  if (value.taxMode === "EXCLUSIVE" && (!value.taxRateBps || !value.taxLabel))
    ctx.addIssue({ code: "custom", message: "Exclusive tax needs a rate and label", path: ["taxMode"] });
  if (value.defaultDiscountBps > value.maxAutoDiscountBps)
    ctx.addIssue({ code: "custom", message: "Default discount cannot exceed the automatic discount limit", path: ["defaultDiscountBps"] });
  if ((value.taxMode === "EXEMPT" || value.taxMode === "PAN_ONLY") && value.taxRateBps !== 0)
    ctx.addIssue({ code: "custom", message: "Exempt policy has a zero rate", path: ["taxRateBps"] });
  if (value.taxMode === "UNCONFIGURED" && value.taxRateBps !== null)
    ctx.addIssue({ code: "custom", message: "Unconfigured tax cannot have a rate", path: ["taxRateBps"] });
});
const approve = z.object({ action: z.literal("APPROVE"), evidenceReference: z.string().trim().min(12).max(500) });
const schema = z.union([saveDraft, approve]);

export async function GET() {
  try {
    const actor = await requireActor();
    const policy = await one("SELECT organization_id,status,version,tax_mode,tax_rate_bps,tax_label,max_manual_discount_bps,max_auto_discount_bps,default_discount_bps,price_negotiable,max_negotiation_rounds,max_messages_per_contact_per_day,consent_required,evidence_reference,approved_at,updated_at FROM commercial_policies WHERE organization_id=$1", [actor.organization_id]);
    return Response.json({ policy: policy ?? {
      status: "DRAFT", version: 0, tax_mode: "UNCONFIGURED", tax_rate_bps: null, tax_label: null,
      max_manual_discount_bps: 0, max_auto_discount_bps: 0, default_discount_bps: 0, price_negotiable: true, max_negotiation_rounds: 0,
      max_messages_per_contact_per_day: 0, consent_required: true, evidence_reference: null, approved_at: null,
    } });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER"]);
    const input = schema.parse(await request.json());
    const result = await transaction(async (client) => {
      const before = await client.query("SELECT * FROM commercial_policies WHERE organization_id=$1 FOR UPDATE", [actor.organization_id]);
      if (input.action === "SAVE_DRAFT") {
        if (input.taxMode === "EXCLUSIVE") {
          const company = await client.query<{ tax_status: string }>("SELECT tax_status FROM company_profiles WHERE organization_id=$1", [actor.organization_id]);
          if (company.rows[0]?.tax_status !== "VAT_REGISTERED") throw new ApiError(409, "VAT can only be charged after VAT registration is verified in Company → Tax & Registration");
        }
        await client.query(
          `INSERT INTO commercial_policies(organization_id,tax_mode,tax_rate_bps,tax_label,max_manual_discount_bps,max_auto_discount_bps,max_negotiation_rounds,max_messages_per_contact_per_day,updated_by,default_discount_bps,price_negotiable)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT(organization_id) DO UPDATE SET status='DRAFT',tax_mode=$2,tax_rate_bps=$3,tax_label=$4,
             max_manual_discount_bps=$5,max_auto_discount_bps=$6,max_negotiation_rounds=$7,max_messages_per_contact_per_day=$8,default_discount_bps=$10,price_negotiable=$11,
             evidence_reference=NULL,approved_by=NULL,approved_at=NULL,updated_by=$9,updated_at=now()`,
          [actor.organization_id,input.taxMode,input.taxRateBps,input.taxLabel,input.maxManualDiscountBps,input.maxAutoDiscountBps,input.maxNegotiationRounds,input.maxMessagesPerContactPerDay,actor.id,input.defaultDiscountBps,input.priceNegotiable],
        );
      } else {
        if (!before.rows[0]) throw new ApiError(409, "Save a draft commercial policy first");
        if (before.rows[0].tax_mode === "UNCONFIGURED") throw new ApiError(409, "Tax treatment must be decided before approval");
        if (before.rows[0].tax_mode === "EXCLUSIVE") {
          const company = await client.query<{ tax_status: string }>("SELECT tax_status FROM company_profiles WHERE organization_id=$1", [actor.organization_id]);
          if (company.rows[0]?.tax_status !== "VAT_REGISTERED") throw new ApiError(409, "VAT cannot be approved while the company is PAN-only");
        }
        await client.query(
          `UPDATE commercial_policies SET status='APPROVED',version=version+1,evidence_reference=$2,approved_by=$3,approved_at=now(),updated_by=$3,updated_at=now()
           WHERE organization_id=$1`, [actor.organization_id,input.evidenceReference,actor.id],
        );
      }
      const after = await client.query("SELECT status,version,tax_mode,tax_rate_bps,tax_label,max_manual_discount_bps,max_auto_discount_bps,default_discount_bps,price_negotiable,max_negotiation_rounds,max_messages_per_contact_per_day,consent_required,evidence_reference FROM commercial_policies WHERE organization_id=$1", [actor.organization_id]);
      await client.query(
        `INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,before_value,after_value)
         VALUES($1,$2,$3,'commercial_policy',$1,$4,$5)`,
        [actor.organization_id,actor.id,`COMMERCIAL_POLICY_${input.action}`,before.rows[0] ? JSON.stringify(before.rows[0]) : null,JSON.stringify(after.rows[0])],
      );
      return after.rows[0];
    });
    return Response.json({ policy: result });
  } catch (error) { return jsonError(error); }
}
