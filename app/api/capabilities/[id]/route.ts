import { z } from "zod";
import { transaction } from "@/lib/db";
import { canPublishCapability } from "@/lib/domain";
import { approveCapabilitySchema } from "@/lib/schemas";
import {
  ApiError,
  jsonError,
  requireActor,
  requireSameOrigin,
} from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER", "PRODUCT_APPROVER"]);
    const id = z.uuid().parse((await context.params).id);
    const input = approveCapabilitySchema.parse(await request.json());
    if (
      (input.status === "VERIFIED" || input.status === "OPTIONAL") &&
      !canPublishCapability(
        input.status,
        input.evidenceUrl ?? null,
        input.approvedLanguage ?? null,
      )
    ) {
      throw new ApiError(
        400,
        "Verified or optional capabilities need evidence and approved customer wording",
      );
    }
    const result = await transaction(async (client) => {
      const before = await client.query(
        "SELECT * FROM product_capabilities WHERE id=$1 AND organization_id=$2 FOR UPDATE",
        [id, actor.organization_id],
      );
      if (!before.rows[0]) throw new ApiError(404, "Capability not found");
      await client.query(
        `UPDATE product_capabilities SET status=$3,evidence_url=$4,approved_language=$5,product_version=$6,
            limitation=$7,approved_by=$8,approved_at=CASE WHEN $3 IN ('VERIFIED','OPTIONAL') THEN now() ELSE NULL END,
            updated_at=now() WHERE id=$1 AND organization_id=$2`,
        [
          id,
          actor.organization_id,
          input.status,
          input.evidenceUrl ?? null,
          input.approvedLanguage ?? null,
          input.productVersion ?? null,
          input.limitation ?? null,
          actor.id,
        ],
      );
      await client.query(
        `INSERT INTO capability_versions(organization_id,capability_id,version,status,evidence_url,approved_language,
                                        product_version,limitation,actor_id)
         SELECT $1,$2,coalesce(max(version),0)+1,$3,$4,$5,$6,$7,$8
         FROM capability_versions WHERE capability_id=$2 AND organization_id=$1`,
        [
          actor.organization_id,
          id,
          input.status,
          input.evidenceUrl ?? null,
          input.approvedLanguage ?? null,
          input.productVersion ?? null,
          input.limitation ?? null,
          actor.id,
        ],
      );
      await client.query(
        `INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,before_value,after_value)
         VALUES($1,$2,'CAPABILITY_REVIEWED','capability',$3,$4,$5)`,
        [
          actor.organization_id,
          actor.id,
          id,
          JSON.stringify(before.rows[0]),
          JSON.stringify(input),
        ],
      );
      return { id, status: input.status };
    });
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
