import { z } from "zod";
import { rows, transaction } from "@/lib/db";
import { normalizeBusinessName } from "@/lib/domain";
import { parseLeadCsv, type ImportIssue } from "@/lib/imports";
import {
  ApiError,
  jsonError,
  requireActor,
  requireSameOrigin,
} from "@/lib/session";

export async function POST(request: Request) {
  try {
    await requireSameOrigin(request);
    const actor = await requireActor(["OWNER", "MANAGER", "SALES"]);
    const form = await request.formData();
    const file = form.get("file");
    const mode = z.enum(["preview", "commit"]).parse(form.get("mode"));
    const sourceNote = z
      .string()
      .trim()
      .min(5)
      .max(500)
      .parse(form.get("sourceNote"));
    if (
      !(file instanceof File) ||
      !file.name.toLowerCase().endsWith(".csv") ||
      file.size > 2_000_000
    ) {
      throw new ApiError(400, "Choose a CSV file up to 2 MB");
    }
    let parsed;
    try {
      parsed = parseLeadCsv(await file.text(), sourceNote);
    } catch (error) {
      throw new ApiError(
        400,
        error instanceof Error ? error.message : "Could not read CSV",
      );
    }
    const existing = await rows<{ normalized_name: string; city: string }>(
      "SELECT normalized_name,lower(city) AS city FROM businesses WHERE organization_id=$1",
      [actor.organization_id],
    );
    const keys = new Set(
      existing.map((row) => `${row.normalized_name}|${row.city}`),
    );
    const issues: ImportIssue[] = [...parsed.issues];
    const candidates = parsed.valid.filter((row) => {
      const key = `${normalizeBusinessName(row.name)}|${row.city.toLocaleLowerCase("en")}`;
      if (keys.has(key)) {
        issues.push({
          row: row.number,
          name: row.name,
          reason: "Business already exists in this workspace",
        });
        return false;
      }
      return true;
    });
    if (mode === "preview")
      return Response.json({
        total: parsed.valid.length + parsed.issues.length,
        ready: candidates.length,
        issues,
        preview: candidates.slice(0, 12).map((row) => ({
          row: row.number,
          name: row.name,
          industry: row.industry,
          city: row.city,
        })),
      });
    if (issues.length)
      return Response.json(
        { error: "Resolve all CSV issues before importing", issues },
        { status: 400 },
      );
    if (!candidates.length) throw new ApiError(400, "No new leads to import");
    const result = await transaction(async (client) => {
      const batch = await client.query<{ id: string }>(
        "INSERT INTO import_batches(organization_id,file_name,source_note,row_count,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id",
        [
          actor.organization_id,
          file.name.slice(0, 255),
          sourceNote,
          candidates.length,
          actor.id,
        ],
      );
      for (const row of candidates) {
        const business = await client.query<{ id: string }>(
          `INSERT INTO businesses(organization_id,name,normalized_name,industry,city,website,notes)
           VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [
            actor.organization_id,
            row.name,
            normalizeBusinessName(row.name),
            row.industry,
            row.city,
            row.website,
            row.notes,
          ],
        );
        const source = await client.query<{ id: string }>(
          `INSERT INTO source_records(organization_id,business_id,source_type,source_reference,terms_reference,created_by,import_batch_id)
           VALUES($1,$2,'CSV',$3,$4,$5,$6) RETURNING id`,
          [
            actor.organization_id,
            business.rows[0].id,
            row.sourceReference,
            sourceNote,
            actor.id,
            batch.rows[0].id,
          ],
        );
        if (row.contactEmail || row.contactPhone)
          await client.query(
            "INSERT INTO contacts(organization_id,business_id,full_name,email,phone,contact_source) VALUES($1,$2,$3,$4,$5,$6)",
            [
              actor.organization_id,
              business.rows[0].id,
              row.contactName,
              row.contactEmail,
              row.contactPhone,
              sourceNote,
            ],
          );
        await client.query(
          "INSERT INTO leads(organization_id,business_id,source_record_id,assigned_to) VALUES($1,$2,$3,$4)",
          [
            actor.organization_id,
            business.rows[0].id,
            source.rows[0].id,
            actor.id,
          ],
        );
      }
      await client.query(
        `INSERT INTO audit_events(organization_id,actor_id,action,entity_type,entity_id,after_value)
         VALUES($1,$2,'CSV_IMPORTED','import_batch',$3,$4)`,
        [
          actor.organization_id,
          actor.id,
          batch.rows[0].id,
          JSON.stringify({
            file: file.name,
            rows: candidates.length,
            sourceNote,
          }),
        ],
      );
      return { batchId: batch.rows[0].id, imported: candidates.length };
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
