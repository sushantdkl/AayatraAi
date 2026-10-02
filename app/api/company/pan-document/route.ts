import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { transaction } from "@/lib/db";
import { detectDocumentType } from "@/lib/company";
import { ApiError, jsonError, requireActor, requireSameOrigin } from "@/lib/session";

const MAX_BYTES = 5 * 1024 * 1024;

/** Owner-only upload of the PAN registration document. Stored outside the web root by content hash. */
export async function POST(request: Request) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER"]);
    if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES + 100000) throw new ApiError(413, "Document must be 5 MB or smaller");
    const form = await request.formData();
    const file = form.get("document");
    if (!(file instanceof File)) throw new ApiError(400, "Attach the PAN document as 'document'");
    if (file.size > MAX_BYTES) throw new ApiError(413, "Document must be 5 MB or smaller");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = detectDocumentType(bytes);
    if (!type) throw new ApiError(415, "Upload a PDF, PNG or JPEG document");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const directory = resolve(process.env.DOCUMENT_STORAGE_DIR ?? join(process.cwd(), "storage", "documents"), actor.organization_id);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const name = `pan-${sha256}.${type}`;
    await writeFile(join(directory, name), bytes, { mode: 0o600 });
    const reference = `document-store://${actor.organization_id}/${name}`;
    await transaction(async (client) => {
      const updated = await client.query(
        `UPDATE company_profiles SET pan_document_reference=$2,pan_document_sha256=$3,document_status='UPLOADED',verified_by=NULL,verified_at=NULL,updated_by=$4,updated_at=now()
         WHERE organization_id=$1 RETURNING organization_id`, [actor.organization_id,reference,sha256,actor.id],
      );
      if (!updated.rowCount) throw new ApiError(409, "Apply the owner configuration first");
      await client.query(`INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value) VALUES($1,$2,'COMPANY_PAN_DOCUMENT_UPLOADED','company_profile',$1,$3)`, [actor.organization_id,actor.id,JSON.stringify({ reference, sha256, bytes: bytes.length, type })]);
    });
    return Response.json({ reference, sha256, documentStatus: "UPLOADED" }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
