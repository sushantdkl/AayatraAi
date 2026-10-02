import { z } from "zod";
import { transaction } from "@/lib/db";
import { commercialActionSchema } from "@/lib/automation-schemas";
import { ApiError, jsonError, requireActor, requireSameOrigin } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER"]);
    const id = z.uuid().parse((await context.params).id);
    const input = commercialActionSchema.parse(await request.json());
    const result = await transaction(async (client) => {
      const existing = await client.query<{ catalog_status: string; verification_status: string }>(
        "SELECT catalog_status,verification_status FROM commercial_items WHERE id=$1 AND organization_id=$2 FOR UPDATE", [id,actor.organization_id],
      );
      const item = existing.rows[0];
      if (!item) throw new ApiError(404, "Commercial item not found");
      if (item.catalog_status === "RETIRED") throw new ApiError(409, "Retired items cannot be changed");
      if (input.action === "ADD_PRICE") {
        await client.query(
          `INSERT INTO commercial_price_sources(organization_id,item_id,price_minor,source_name,evidence_reference,is_canonical)
           VALUES($1,$2,$3,$4,$5,$6)`, [actor.organization_id,id,input.price.priceMinor,input.price.sourceName,input.price.evidenceReference ?? null,input.price.isCanonical],
        );
      } else if (input.action === "SET_FLOOR") {
        if (item.catalog_status !== "ACTIVE") throw new ApiError(409, "Activate and verify the item before setting a minimum price");
        const sources = await client.query<{ price_minor: string; is_canonical: boolean }>(
          "SELECT price_minor,is_canonical FROM commercial_price_sources WHERE item_id=$1 AND organization_id=$2 AND active=true",
          [id,actor.organization_id],
        );
        const canonical = sources.rows.find((source) => source.is_canonical);
        const distinct = new Set(sources.rows.map((source) => source.price_minor));
        if (!sources.rowCount || (distinct.size > 1 && !canonical)) throw new ApiError(409, "Resolve the exact active price before setting a floor");
        const activePrice = Number((canonical ?? sources.rows[0]).price_minor);
        if (input.minPriceMinor > activePrice) throw new ApiError(409, "Minimum selling price cannot exceed the active approved price");
        await client.query(
          "UPDATE commercial_items SET min_price_minor=$3,min_price_evidence=$4,min_price_approved_by=$5,updated_at=now() WHERE id=$1 AND organization_id=$2",
          [id,actor.organization_id,input.minPriceMinor,input.evidenceReference,actor.id],
        );
      } else if (input.action === "RESOLVE_DISCREPANCY") {
        const canonical = await client.query(
          "SELECT id FROM commercial_price_sources WHERE item_id=$1 AND organization_id=$2 AND active=true AND is_canonical=true AND length(coalesce(evidence_reference,''))>=8 LIMIT 1",
          [id,actor.organization_id],
        );
        if (!canonical.rowCount) throw new ApiError(409, "Resolve a discrepancy only after adding an evidence-backed canonical exact price");
        const resolved = await client.query(
          `UPDATE commercial_discrepancies SET status='RESOLVED',resolution_evidence=$4,resolved_by=$5,resolved_at=now()
           WHERE id=$1 AND item_id=$2 AND organization_id=$3 AND status='OPEN' RETURNING id`,
          [input.discrepancyId,id,actor.organization_id,input.evidenceReference,actor.id],
        );
        if (!resolved.rowCount) throw new ApiError(404, "Open discrepancy not found");
      } else if (input.action === "VERIFY") {
        if (item.catalog_status !== "DRAFT") throw new ApiError(409, "Only drafts can be verified");
        await client.query(
          `UPDATE commercial_items SET catalog_status='VERIFIED',verification_status='VERIFIED',verification_evidence=$3,verified_by=$4,verified_at=now(),updated_at=now()
           WHERE id=$1 AND organization_id=$2`, [id,actor.organization_id,input.evidenceReference,actor.id],
        );
      } else if (input.action === "ACTIVATE") {
        if (item.catalog_status !== "VERIFIED" || item.verification_status !== "VERIFIED")
          throw new ApiError(409, "Verify the commercial item before activation");
        const discrepancy = await client.query("SELECT id FROM commercial_discrepancies WHERE item_id=$1 AND organization_id=$2 AND status='OPEN' LIMIT 1", [id,actor.organization_id]);
        if (discrepancy.rowCount) throw new ApiError(409, "COMMERCIAL_PRICE_REVIEW_REQUIRED: resolve client-kit pricing discrepancies before activation");
        const sources = await client.query<{ price_minor: string; is_canonical: boolean }>(
          "SELECT price_minor,is_canonical FROM commercial_price_sources WHERE item_id=$1 AND organization_id=$2 AND active=true", [id,actor.organization_id],
        );
        if (!sources.rowCount) throw new ApiError(409, "Add a price source first");
        const distinct = new Set(sources.rows.map((source) => source.price_minor));
        if (distinct.size > 1 && !sources.rows.some((source) => source.is_canonical))
          throw new ApiError(409, "COMMERCIAL_PRICE_REVIEW_REQUIRED: conflicting active prices have no canonical source");
        await client.query(
          "UPDATE commercial_items SET catalog_status='ACTIVE',is_active=true,approval_required=$3,updated_at=now() WHERE id=$1 AND organization_id=$2",
          [id,actor.organization_id,input.approvalRequired],
        );
      } else {
        await client.query(
          "UPDATE commercial_items SET catalog_status='RETIRED',is_active=false,updated_at=now() WHERE id=$1 AND organization_id=$2",
          [id,actor.organization_id],
        );
      }
      await client.query(
        `INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value)
         VALUES($1,$2,$3,'commercial_item',$4,$5)`,
        [actor.organization_id,actor.id,`COMMERCIAL_${input.action}`,id,JSON.stringify(input)],
      );
      return { id, action: input.action };
    });
    return Response.json(result);
  } catch (error) { return jsonError(error); }
}
