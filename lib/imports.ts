import { parse } from "csv-parse/sync";
import { createLeadSchema } from "./schemas";
import { normalizeBusinessName } from "./domain";

export type ImportRow = {
  number: number;
  name: string;
  industry: string;
  city: string;
  website: string | null;
  notes: string | null;
  sourceType: "CSV";
  sourceReference: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
};
export type ImportIssue = { row: number; name: string; reason: string };

export function parseLeadCsv(
  content: string,
  sourceNote: string,
): { valid: ImportRow[]; issues: ImportIssue[] } {
  if (content.length > 2_000_000)
    throw new Error("CSV is too large (2 MB maximum)");
  const records = parse(content, {
    columns: (headers: string[]) =>
      headers.map((header) => header.trim().toLowerCase()),
    bom: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: false,
    skip_records_with_error: false,
  }) as Record<string, string>[];
  if (records.length === 0) throw new Error("CSV has no data rows");
  if (records.length > 500) throw new Error("CSV has more than 500 data rows");
  const header = Object.keys(records[0]);
  if (!header.includes("name") || !header.includes("industry"))
    throw new Error("CSV needs name and industry columns");
  const valid: ImportRow[] = [];
  const issues: ImportIssue[] = [];
  const seen = new Set<string>();
  records.forEach((raw, index) => {
    const number = index + 2;
    const input = createLeadSchema.safeParse({
      name: raw.name,
      industry: raw.industry?.toUpperCase().replaceAll(" ", "_"),
      city: raw.city || "",
      website: raw.website || null,
      notes: raw.notes || null,
      sourceType: "CSV",
      sourceReference: raw.source_reference || sourceNote,
      contactName: raw.contact_name || null,
      contactEmail: raw.contact_email || null,
      contactPhone: raw.contact_phone || null,
    });
    if (!input.success) {
      issues.push({
        row: number,
        name: raw.name ?? "",
        reason: input.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; "),
      });
      return;
    }
    const key = `${normalizeBusinessName(input.data.name)}|${input.data.city.toLocaleLowerCase("en")}`;
    if (seen.has(key)) {
      issues.push({
        row: number,
        name: input.data.name,
        reason: "Duplicate business in this CSV",
      });
      return;
    }
    seen.add(key);
    valid.push({
      number,
      name: input.data.name,
      industry: input.data.industry,
      city: input.data.city,
      website: input.data.website ?? null,
      notes: input.data.notes ?? null,
      sourceType: "CSV",
      sourceReference: input.data.sourceReference ?? null,
      contactName: input.data.contactName ?? null,
      contactEmail: input.data.contactEmail ?? null,
      contactPhone: input.data.contactPhone ?? null,
    });
  });
  return { valid, issues };
}
