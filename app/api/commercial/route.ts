import { rows, transaction } from "@/lib/db";
import { commercialItemSchema } from "@/lib/automation-schemas";
import { jsonError, requireActor, requireSameOrigin } from "@/lib/session";

export async function GET() {
  try {
    const actor = await requireActor();
    const [items, sources, discrepancies] = await Promise.all([
      rows("SELECT * FROM commercial_items WHERE organization_id=$1 ORDER BY product_family,name,created_at DESC", [actor.organization_id]),
      rows("SELECT id,item_id,price_minor,source_name,evidence_reference,is_canonical,active FROM commercial_price_sources WHERE organization_id=$1 ORDER BY created_at DESC", [actor.organization_id]),
      rows("SELECT id,item_id,code,description,source_reference,status,resolution_evidence FROM commercial_discrepancies WHERE organization_id=$1 ORDER BY created_at DESC", [actor.organization_id]),
    ]);
    return Response.json({ items: items.map((item) => ({ ...item, price_sources: sources.filter((source) => source.item_id === item.id), discrepancies: discrepancies.filter((entry) => entry.item_id === item.id) })) });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER", "MANAGER"]);
    const input = commercialItemSchema.parse(await request.json());
    const result = await transaction(async (client) => {
      const item = await client.query<{ id: string }>(
        `INSERT INTO commercial_items(organization_id,product_family,kind,name,billing_type,billing_period,currency,approval_required,negotiable,effective_from,effective_to,source,notes)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
        [actor.organization_id,input.productFamily,input.kind,input.name,input.billingType,input.billingPeriod,input.currency,input.approvalRequired,input.negotiable,input.effectiveFrom ?? null,input.effectiveTo ?? null,input.source,input.notes ?? null],
      );
      const id = item.rows[0].id;
      await client.query(
        `INSERT INTO commercial_price_sources(organization_id,item_id,price_minor,source_name)
         VALUES($1,$2,$3,$4)`, [actor.organization_id,id,input.priceMinor,input.source],
      );
      await client.query(
        `INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value)
         VALUES($1,$2,'COMMERCIAL_DRAFT_CREATED','commercial_item',$3,$4)`, [actor.organization_id,actor.id,id,JSON.stringify(input)],
      );
      return { id, catalogStatus: "DRAFT", verificationStatus: "NEEDS_VERIFICATION" };
    });
    return Response.json(result, { status: 201 });
  } catch (error) { return jsonError(error); }
}
