import { z } from "zod";
import { transaction } from "@/lib/db";
import { ApiError, jsonError, requireActor, requireSameOrigin } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };
const schema = z.object({ eligible: z.boolean(), evidence: z.string().trim().min(8).max(500) });
export async function POST(request: Request, context: Context) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER","MANAGER"]);
    const id = z.uuid().parse((await context.params).id);
    const input = schema.parse(await request.json());
    const result = await transaction(async (client) => {
      const contact = await client.query("SELECT id FROM contacts WHERE id=$1 AND organization_id=$2 FOR UPDATE", [id,actor.organization_id]);
      if (!contact.rowCount) throw new ApiError(404, "Contact not found");
      await client.query("UPDATE contacts SET contact_eligible=$3 WHERE id=$1 AND organization_id=$2", [id,actor.organization_id,input.eligible]);
      await client.query(`INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value,reason) VALUES($1,$2,'CONTACT_ELIGIBILITY_REVIEWED','contact',$3,$4,$5)`, [actor.organization_id,actor.id,id,JSON.stringify({ eligible: input.eligible }),input.evidence]);
      return { id, eligible: input.eligible };
    });
    return Response.json(result);
  } catch (error) { return jsonError(error); }
}
