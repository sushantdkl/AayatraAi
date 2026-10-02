import { rows, transaction } from "@/lib/db";
import { normalizeBusinessName } from "@/lib/domain";
import { createLeadSchema } from "@/lib/schemas";
import { jsonError, requireActor, requireSameOrigin } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const url = new URL(request.url);
    const search = (url.searchParams.get("search") ?? "").trim().slice(0, 100);
    const status = url.searchParams.get("status") ?? "";
    const industry = url.searchParams.get("industry") ?? "";
    const leads = await rows(
      `SELECT l.id,l.status,l.fit_score,l.digital_maturity_score,l.created_at,
              b.id AS business_id,b.name,b.industry,b.city,b.website,b.notes,
              sr.source_type,sr.source_reference,
              (SELECT count(*) FROM opportunities o WHERE o.lead_id=l.id AND o.organization_id=l.organization_id) AS opportunity_count
       FROM leads l JOIN businesses b ON b.id=l.business_id AND b.organization_id=l.organization_id
       LEFT JOIN source_records sr ON sr.id=l.source_record_id AND sr.organization_id=l.organization_id
       WHERE l.organization_id=$1 AND ($2='' OR b.name ILIKE '%'||$2||'%' OR b.city ILIKE '%'||$2||'%')
         AND ($3='' OR l.status=$3) AND ($4='' OR b.industry=$4)
       ORDER BY l.created_at DESC LIMIT 200`,
      [actor.organization_id, search, status, industry],
    );
    return Response.json({ leads });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER", "MANAGER", "SALES"]);
    const input = createLeadSchema.parse(await request.json());
    const lead = await transaction(async (client) => {
      const businessResult = await client.query<{ id: string }>(
        `INSERT INTO businesses(organization_id,name,normalized_name,industry,city,website,notes)
         VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [
          actor.organization_id,
          input.name,
          normalizeBusinessName(input.name),
          input.industry,
          input.city,
          input.website ?? null,
          input.notes ?? null,
        ],
      );
      const businessId = businessResult.rows[0].id;
      const sourceResult = await client.query<{ id: string }>(
        `INSERT INTO source_records(organization_id,business_id,source_type,source_reference,terms_reference,created_by)
         VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
        [
          actor.organization_id,
          businessId,
          input.sourceType,
          input.sourceReference ?? null,
          input.termsReference ?? null,
          actor.id,
        ],
      );
      if (input.contactEmail || input.contactPhone) {
        await client.query(
          `INSERT INTO contacts(organization_id,business_id,full_name,email,phone,contact_source)
           VALUES($1,$2,$3,$4,$5,$6)`,
          [
            actor.organization_id,
            businessId,
            input.contactName ?? null,
            input.contactEmail ?? null,
            input.contactPhone ?? null,
            input.contactSource || input.sourceType,
          ],
        );
      }
      const leadResult = await client.query<{ id: string }>(
        `INSERT INTO leads(organization_id,business_id,source_record_id,assigned_to)
         VALUES($1,$2,$3,$4) RETURNING id`,
        [actor.organization_id, businessId, sourceResult.rows[0].id, actor.id],
      );
      const leadId = leadResult.rows[0].id;
      await client.query(
        `INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value)
         VALUES($1,$2,'LEAD_CREATED','lead',$3,$4)`,
        [
          actor.organization_id,
          actor.id,
          leadId,
          JSON.stringify({ business: input.name, source: input.sourceType }),
        ],
      );
      return { id: leadId, businessId };
    });
    return Response.json(lead, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
