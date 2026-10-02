import { z } from "zod";
import { transaction } from "@/lib/db";
import { ApiError, jsonError, requireActor, requireSameOrigin } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };
const actionSchema = z.object({ action: z.enum(["REQUEST","SUBMIT_FOR_VERIFICATION","VERIFY","FAIL","CANCEL"]), evidence: z.string().trim().min(8).max(1000), reference: z.string().trim().min(8).max(200).optional() });
export async function PATCH(request: Request, context: Context) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER","MANAGER"]);
    const id = z.uuid().parse((await context.params).id);
    const input = actionSchema.parse(await request.json());
    if (input.action === "VERIFY" && actor.role !== "OWNER") throw new ApiError(403, "Only an owner may independently verify payment");
    if (input.action === "VERIFY" && !input.reference) throw new ApiError(400, "Verification requires a unique bank transaction or receipt reference");
    const result = await transaction(async (client) => {
      const payment = await client.query<{ status: string }>("SELECT status FROM payment_requests WHERE id=$1 AND organization_id=$2 FOR UPDATE", [id,actor.organization_id]);
      if (!payment.rows[0]) throw new ApiError(404, "Payment request not found");
      const allowed: Record<string,string[]> = { REQUEST: ["DRAFT"], SUBMIT_FOR_VERIFICATION: ["REQUESTED","PENDING"], VERIFY: ["SUBMITTED_FOR_VERIFICATION"], FAIL: ["REQUESTED","PENDING","SUBMITTED_FOR_VERIFICATION"], CANCEL: ["DRAFT","REQUESTED","PENDING"] };
      if (!allowed[input.action].includes(payment.rows[0].status)) throw new ApiError(409, `Cannot ${input.action} a ${payment.rows[0].status} payment`);
      const status = { REQUEST: "REQUESTED", SUBMIT_FOR_VERIFICATION: "SUBMITTED_FOR_VERIFICATION", VERIFY: "VERIFIED", FAIL: "FAILED", CANCEL: "CANCELLED" }[input.action];
      await client.query(
        `UPDATE payment_requests SET status=$3,verification_evidence=CASE WHEN $4 THEN $5 ELSE verification_evidence END,
         verification_reference=CASE WHEN $4 THEN $7 ELSE verification_reference END,
         verified_by=CASE WHEN $4 THEN $6 ELSE verified_by END,verified_at=CASE WHEN $4 THEN now() ELSE verified_at END,updated_at=now()
         WHERE id=$1 AND organization_id=$2`, [id,actor.organization_id,status,input.action === "VERIFY",input.evidence,actor.id,input.reference ?? null],
      );
      await client.query("INSERT INTO payment_events(organization_id,payment_request_id,event_type,detail,actor_id) VALUES($1,$2,$3,$4,$5)", [actor.organization_id,id,input.action,JSON.stringify({ evidence: input.evidence, reference: input.reference ?? null }),actor.id]);
      await client.query(`INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value) VALUES($1,$2,$3,'payment_request',$4,$5)`, [actor.organization_id,actor.id,`PAYMENT_${input.action}`,id,JSON.stringify({ status })]);
      return { id, status };
    });
    return Response.json(result);
  } catch (error) { return jsonError(error); }
}
