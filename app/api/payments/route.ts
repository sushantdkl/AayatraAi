import { z } from "zod";
import { rows, transaction } from "@/lib/db";
import { ApiError, jsonError, requireActor, requireSameOrigin } from "@/lib/session";

const create = z.object({ opportunityId: z.uuid(), quotationId: z.uuid(), amountMinor: z.number().int().positive().max(1000000000000), method: z.enum(["MANUAL_BANK","MANUAL_QR","CASH","PAYMENT_GATEWAY","FUTURE_PROVIDER"]) });
export async function GET() {
  try { const actor = await requireActor(); return Response.json({ payments: await rows("SELECT id,opportunity_id,quotation_id,amount_minor,currency,method,status,verified_at,created_at FROM payment_requests WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 200", [actor.organization_id]) }); }
  catch (error) { return jsonError(error); }
}
export async function POST(request: Request) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER","MANAGER"]);
    const input = create.parse(await request.json());
    if (["PAYMENT_GATEWAY","FUTURE_PROVIDER"].includes(input.method)) throw new ApiError(409, "Payment provider is not configured");
    const result = await transaction(async (client) => {
      const quote = await client.query("SELECT id FROM quotations WHERE id=$1 AND organization_id=$2 AND opportunity_id=$3 AND status='ACCEPTED'", [input.quotationId,actor.organization_id,input.opportunityId]);
      if (!quote.rowCount) throw new ApiError(409, "Accepted quotation required before payment request");
      const created = await client.query<{ id: string }>(
        `INSERT INTO payment_requests(organization_id,opportunity_id,quotation_id,amount_minor,method,created_by)
         VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
        [actor.organization_id,input.opportunityId,input.quotationId,input.amountMinor,input.method,actor.id],
      );
      await client.query("INSERT INTO payment_events(organization_id,payment_request_id,event_type,actor_id) VALUES($1,$2,'DRAFT_CREATED',$3)", [actor.organization_id,created.rows[0].id,actor.id]);
      return { id: created.rows[0].id, status: "DRAFT" };
    });
    return Response.json(result, { status: 201 });
  } catch (error) { return jsonError(error); }
}
