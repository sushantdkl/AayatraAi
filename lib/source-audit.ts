import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { featureDefinitions, type FeatureDefinition, type ImplementationStatus } from "@/lib/feature-matrix";

const SKIP = new Set(["node_modules", ".git", ".next", "dist", "build", "coverage", "playwright-report", "test-results"]);

async function walk(root: string, dir = root, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(root, full, out);
    else if (entry.isFile()) out.push(relative(root, full).split(sep).join("/"));
  }
  return out;
}

export type FeatureEvidence = {
  featureKey: string; name: string; routes: string[]; pages: string[]; migrations: string[]; tests: string[];
  auditNotes: string[]; currentStatus: ImplementationStatus; proposedStatus: ImplementationStatus; rationale: string;
};

const segments = (path: string) => path.toLowerCase().split(/[/._\-[\]()]+/).filter(Boolean);

/**
 * Evidence-only audit of a product source tree (e.g. the dimsum Aadhar restaurant repo).
 * It proposes, never applies: route + migration + test evidence can justify PARTIAL; only a
 * live demo check and a human approver can make a feature VERIFIED_AVAILABLE.
 */
export async function auditSource(root: string, definitions: FeatureDefinition[] = featureDefinitions.filter((item) => item.productFamily === "RESTAURANT_SYSTEM")): Promise<{ root: string; files: number; audit: string | null; features: FeatureEvidence[] }> {
  if (!(await stat(root)).isDirectory()) throw new Error(`${root} is not a directory`);
  const files = await walk(root);
  const auditFile = files.find((file) => /AADHAR_RESTAURANT_PRODUCT_AUDIT\.md$/i.test(file)) ?? null;
  const auditText = auditFile ? await readFile(join(root, auditFile), "utf8") : "";
  const auditLines = auditText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const migrationFiles = files.filter((file) => /(^|\/)migrations?\//i.test(file) && file.endsWith(".sql"));
  const migrationText = new Map<string, string>();
  for (const file of migrationFiles) migrationText.set(file, (await readFile(join(root, file), "utf8")).toLowerCase());
  const routes = files.filter((file) => /^app\/.*route\.(t|j)sx?$/.test(file));
  const pages = files.filter((file) => /^app\/.*page\.(t|j)sx?$/.test(file));
  const tests = files.filter((file) => /(^|\/)(tests?|__tests__|e2e)\//.test(file) || /\.(test|spec)\.(t|j)sx?$/.test(file));

  const features = definitions.map((definition): FeatureEvidence => {
    const patterns = definition.sourcePatterns.map((pattern) => pattern.toLowerCase());
    const hit = (path: string) => segments(path).some((segment) => patterns.includes(segment));
    const tableHit = (sql: string) => {
      const tables = [...sql.matchAll(/create table (?:if not exists )?"?([\w.]+)"?/g)].map((match) => match[1].split(/[._]/));
      return patterns.some((pattern) => {
        const name = pattern.replace(/-/g, "_");
        return tables.some((parts) => parts.join("_") === name || parts.includes(name)) || new RegExp(`\\b${name}_id\\b`).test(sql);
      });
    };
    const evidence = {
      routes: routes.filter(hit), pages: pages.filter(hit), tests: tests.filter(hit),
      migrations: [...migrationText].filter(([, sql]) => tableHit(sql)).map(([file]) => file),
      auditNotes: auditLines.filter((line) => definition.keywords.concat(patterns).some((word) => /^[\x20-\x7e]+$/.test(word) && line.toLowerCase().includes(word.toLowerCase()))).slice(0, 5),
    };
    let proposed: ImplementationStatus = definition.seedStatus;
    let rationale: string;
    if (definition.key === "MULTI_BRANCH") {
      const branchModel = [...migrationText.values()].some((sql) => /\bbranch_id\b/.test(sql) && /create table[^;]*branches?\b/.test(sql));
      const futureWork = evidence.auditNotes.some((line) => /future|not (yet )?(supported|implemented)|no .*branch/i.test(line));
      proposed = branchModel && !futureWork ? "UNKNOWN" : "NOT_AVAILABLE";
      rationale = branchModel && !futureWork ? "A branch model now exists: re-verify end to end before selling" : "No complete branch_id domain model / audit marks multi-branch as future work";
    } else if (!definition.sourcePatterns.length) {
      rationale = "Not a source-code feature (needs a document, not code)";
    } else if (evidence.routes.length && evidence.tests.length && evidence.migrations.length) {
      proposed = "PARTIAL"; rationale = "API routes, schema and tests exist; validate on the live demo and record approved wording to reach VERIFIED_AVAILABLE";
    } else if (evidence.routes.length || evidence.pages.length) {
      proposed = "UNKNOWN"; rationale = "Routes/pages exist but test or schema evidence is missing; route existence alone is not proof";
    } else {
      proposed = "UNKNOWN"; rationale = "No implementation evidence found in the source tree";
    }
    return { featureKey: definition.key, name: definition.name, ...evidence, currentStatus: definition.seedStatus, proposedStatus: proposed, rationale };
  });
  return { root, files: files.length, audit: auditFile, features };
}

export function auditMarkdown(result: Awaited<ReturnType<typeof auditSource>>): string {
  const rows = result.features.map((f) => `| ${f.featureKey} | ${f.routes.length} | ${f.pages.length} | ${f.migrations.length} | ${f.tests.length} | ${f.proposedStatus} | ${f.rationale} |`);
  return [`# Source audit — ${result.root}`, "", `Files scanned: ${result.files}. Repository audit document: ${result.audit ?? "not found"}.`, "",
    "Proposals only. A feature becomes VERIFIED_AVAILABLE only after a live demo check and an owner/product-approver update in Settings → Feature claims.", "",
    "| Feature | Routes | Pages | Migrations | Tests | Proposed | Rationale |", "|---|---:|---:|---:|---:|---|---|", ...rows, ""].join("\n");
}
