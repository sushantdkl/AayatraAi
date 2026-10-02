import { randomUUID } from "node:crypto";
import { z } from "zod";
import { rows, transaction } from "@/lib/db";
import { resolveActivePrice, CommercialReviewRequired } from "@/lib/commercial";
import { calculateQuoteAmounts, type CommercialPolicySnapshot } from "@/lib/commercial-policy";
import { ApiError, jsonError, requireActor, requireSameOrigin } from "@/lib/session";

const create = z.object({
  opportunityId: z.uuid(), quotationId: z.uuid().nullable().optional(),
  items: z.array(z.object({ itemId: z.uuid(), quantity: z.number().int().min(1).max(1000) })).min(1).max(40),
  validUntil: z.iso.date(), scope: z.string().trim().min(10).max(5000),
  exclusions: z.string().trim().min(3).max(3000), commercialNotes: z.string().trim().max(3000).nullable().optional(),
  paymentTerms: z.string().trim().max(2000).nullable().optional(),
  discountMinor: z.number().int().min(0).max(1000000000000).default(0),
  taxMinor: z.number().int().min(0).max(1000000000000).default(0),
});

export async function GET() {
  try {
    const actor = await requireActor();
    const quotations = await rows(
      `SELECT q.id,q.opportunity_id,q.quotation_number,q.status,q.current_version,q.accepted_version,q.created_at,o.title AS opportunity_title,b.name AS client_name,
              v.total_minor,v.currency,v.valid_until
       FROM quotations q JOIN opportunities o ON o.id=q.opportunity_id AND o.organization_id=q.organization_id
       JOIN leads l ON l.id=o.lead_id AND l.organization_id=o.organization_id
       JOIN businesses b ON b.id=l.business_id AND b.organization_id=l.organization_id
       JOIN quotation_versions v ON v.quotation_id=q.id AND v.organization_id=q.organization_id AND v.version=q.current_version
       WHERE q.organization_id=$1 ORDER BY q.created_at DESC LIMIT 200`, [actor.organization_id],
    );
    return Response.json({ quotations });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER","MANAGER","SALES"]);
    const input = create.parse(await request.json());
    if (input.validUntil < new Date().toISOString().slice(0, 10)) throw new ApiError(400, "Validity date must be in the future");
    const result = await transaction(async (client) => {
      const opportunity = await client.query<{ business_name: string; industry: string }>(
        `SELECT b.name AS business_name,b.industry FROM opportunities o
         JOIN leads l ON l.id=o.lead_id AND l.organization_id=o.organization_id
         JOIN businesses b ON b.id=l.business_id AND b.organization_id=l.organization_id
         WHERE o.id=$1 AND o.organization_id=$2`, [input.opportunityId,actor.organization_id],
      );
      if (!opportunity.rows[0]) throw new ApiError(404, "Opportunity not found");
      const policyResult = await client.query<CommercialPolicySnapshot>(
        "SELECT status,version,tax_mode,tax_rate_bps,max_manual_discount_bps FROM commercial_policies WHERE organization_id=$1 FOR SHARE",
        [actor.organization_id],
      );
      const policy = policyResult.rows[0] ?? null;
      if (input.discountMinor > 0 && actor.role === "SALES") throw new ApiError(403, "Only an owner or manager may prepare a discounted quotation");
      let subtotal = 0;
      let needsReview = input.discountMinor > 0;
      let floorTotal: number | null = 0;
      const lineFloors: Array<{ lineTotalMinor: number; floorMinor: number }> = [];
      const lines: Array<{ itemId: string; name: string; quantity: number; unitPriceMinor: number; totalMinor: number; sourceId: string }> = [];
      for (const line of input.items) {
        const item = await client.query<{ id: string; name: string; catalog_status: string; verification_status: string; is_active: boolean; approval_required: boolean; effective_from: string | null; effective_to: string | null; min_price_minor: string | null }>(
          "SELECT id,name,catalog_status,verification_status,is_active,approval_required,effective_from,effective_to,min_price_minor FROM commercial_items WHERE id=$1 AND organization_id=$2 FOR SHARE",
          [line.itemId,actor.organization_id],
        );
        if (!item.rows[0]) throw new ApiError(404, "Commercial item not found");
        const unresolved = await client.query("SELECT id FROM commercial_discrepancies WHERE item_id=$1 AND organization_id=$2 AND status='OPEN' LIMIT 1", [line.itemId,actor.organization_id]);
        if (unresolved.rowCount) throw new ApiError(409, "COMMERCIAL_PRICE_REVIEW_REQUIRED: resolve client-kit pricing discrepancy before quotation");
        const sources = await client.query<{ id: string; price_minor: string; is_canonical: boolean; active: boolean }>(
          "SELECT id,price_minor,is_canonical,active FROM commercial_price_sources WHERE item_id=$1 AND organization_id=$2", [line.itemId,actor.organization_id],
        );
        let unit: number;
        try { unit = resolveActivePrice({ ...item.rows[0], approval_required: false }, sources.rows); }
        catch (error) { if (error instanceof CommercialReviewRequired) throw new ApiError(409, error.code + ": " + error.message); throw error; }
        const chosen = sources.rows.find((source) => source.active && source.is_canonical) ?? sources.rows.find((source) => source.active && Number(source.price_minor) === unit);
        if (!chosen) throw new ApiError(409, "No resolved price source");
        if (item.rows[0].min_price_minor !== null && Number(item.rows[0].min_price_minor) > unit)
          throw new ApiError(409, "COMMERCIAL_PRICE_REVIEW_REQUIRED: approved minimum exceeds active price");
        const total = unit * line.quantity;
        if (!Number.isSafeInteger(total) || !Number.isSafeInteger(subtotal + total)) throw new ApiError(400, "Quote amount is too large");
        subtotal += total; needsReview ||= item.rows[0].approval_required;
        if (item.rows[0].min_price_minor === null) floorTotal = null;
        else if (floorTotal !== null) {
          const floorMinor = Number(item.rows[0].min_price_minor) * line.quantity;
          lineFloors.push({ lineTotalMinor: total, floorMinor });
          floorTotal += floorMinor;
          if (!Number.isSafeInteger(floorTotal)) throw new ApiError(400, "Minimum selling total is too large");
        }
        lines.push({ itemId: line.itemId, name: item.rows[0].name, quantity: line.quantity, unitPriceMinor: unit, totalMinor: total, sourceId: chosen.id });
      }
      let amounts: ReturnType<typeof calculateQuoteAmounts>;
      try { amounts = calculateQuoteAmounts({ subtotalMinor: subtotal, discountMinor: input.discountMinor, submittedTaxMinor: input.taxMinor, floorTotalMinor: floorTotal, lineFloors, policy }); }
      catch (error) { if (error instanceof CommercialReviewRequired) throw new ApiError(409, error.code + ": " + error.message); throw error; }
      const total = amounts.totalMinor;
      needsReview ||= amounts.needsPolicyReview;
      let id = input.quotationId ?? null;
      let version = 1;
      if (id) {
        const quote = await client.query<{ current_version: number; status: string; opportunity_id: string }>("SELECT current_version,status,opportunity_id FROM quotations WHERE id=$1 AND organization_id=$2 FOR UPDATE", [id,actor.organization_id]);
        if (!quote.rows[0] || quote.rows[0].opportunity_id !== input.opportunityId) throw new ApiError(404, "Quotation not found for opportunity");
        if (quote.rows[0].status === "ACCEPTED") throw new ApiError(409, "Accepted quotations are immutable; create a new quotation instead");
        version = quote.rows[0].current_version + 1;
        await client.query("UPDATE quotations SET current_version=$3,status=$4,approved_by=NULL,approved_at=NULL,updated_at=now() WHERE id=$1 AND organization_id=$2", [id,actor.organization_id,version,needsReview ? "REVIEW_REQUIRED" : "DRAFT"]);
      } else {
        const quotationNumber = `QT-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
        const created = await client.query<{ id: string }>(
          "INSERT INTO quotations(organization_id,opportunity_id,quotation_number,status,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id",
          [actor.organization_id,input.opportunityId,quotationNumber,needsReview ? "REVIEW_REQUIRED" : "DRAFT",actor.id],
        );
        id = created.rows[0].id;
      }
      await client.query(
        `INSERT INTO quotation_versions(organization_id,quotation_id,version,client_name,business_type,valid_until,line_items,subtotal_minor,discount_minor,tax_minor,total_minor,commercial_notes,scope,exclusions,payment_terms,created_by,commercial_policy_version,tax_mode,tax_rate_bps)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [actor.organization_id,id,version,opportunity.rows[0].business_name,opportunity.rows[0].industry,input.validUntil,JSON.stringify(lines),subtotal,input.discountMinor,amounts.taxMinor,total,input.commercialNotes ?? null,input.scope,input.exclusions,input.paymentTerms ?? null,actor.id,amounts.policyVersion,policy?.tax_mode ?? null,policy?.tax_rate_bps ?? null],
      );
      await client.query(`INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value) VALUES($1,$2,'QUOTATION_VERSION_CREATED','quotation',$3,$4)`, [actor.organization_id,actor.id,id,JSON.stringify({ version, totalMinor: total, needsReview })]);
      return { id, version, totalMinor: total, status: needsReview ? "REVIEW_REQUIRED" : "DRAFT" };
    });
    return Response.json(result, { status: 201 });
  } catch (error) { return jsonError(error); }
}
