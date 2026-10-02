import { transaction } from "@/lib/db";
import { marketingSnapshot } from "@/lib/marketing-snapshot";
import { marketingDiscrepancies } from "@/lib/client-kit";
import { ApiError, jsonError, requireActor, requireSameOrigin } from "@/lib/session";

export async function POST(request: Request) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER"]);
    const count = await transaction(async (client) => {
      const existing = await client.query(
        "SELECT 1 FROM commercial_items WHERE organization_id=$1 AND source=$2 LIMIT 1",
        [actor.organization_id, "Aayatra continuation prompt marketing snapshot 2026-10-01"],
      );
      if (existing.rowCount) return 0;
      const poster = await client.query("SELECT 1 FROM commercial_items WHERE organization_id=$1 AND commercial_source='OWNER_APPROVED_POSTER_2026' LIMIT 1", [actor.organization_id]);
      if (poster.rowCount) throw new ApiError(409, "Owner-approved poster prices are canonical; the older draft snapshot is not re-imported");
      for (const item of marketingSnapshot) {
        const created = await client.query<{ id: string }>(
          `INSERT INTO commercial_items(organization_id,product_family,kind,name,billing_type,billing_period,currency,source,notes,negotiable)
           VALUES($1,$2,$3,$4,$5,$6,'NPR',$7,$8,$9) RETURNING id`,
          [actor.organization_id,item.productFamily,item.kind,item.name,item.billingType,item.billingPeriod,"Aayatra continuation prompt marketing snapshot 2026-10-01",item.notes,item.negotiable],
        );
        await client.query(
          `INSERT INTO commercial_price_sources(organization_id,item_id,price_minor,source_name)
           VALUES($1,$2,$3,$4)`, [actor.organization_id,created.rows[0].id,item.priceMinor,"Prompt marketing snapshot"],
        );
        const discrepancy = marketingDiscrepancies[item.name];
        if (discrepancy) await client.query(
          `INSERT INTO commercial_discrepancies(organization_id,item_id,code,description,source_reference)
           VALUES($1,$2,$3,$4,$5)`,
          [actor.organization_id,created.rows[0].id,discrepancy.code,discrepancy.description,discrepancy.sourceReference],
        );
      }
      await client.query(
        `INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value)
         VALUES($1,$2,'MARKETING_SNAPSHOT_IMPORTED','organization',$1,$3)`,
        [actor.organization_id,actor.id,JSON.stringify({ count: marketingSnapshot.length, status: "DRAFT" })],
      );
      return marketingSnapshot.length;
    });
    return Response.json({ imported: count, status: "DRAFT", verificationStatus: "NEEDS_VERIFICATION" });
  } catch (error) { return jsonError(error); }
}
