import { mkdir, writeFile } from "node:fs/promises";
import { auditMarkdown, auditSource } from "../lib/source-audit";

const root = process.argv[2];
if (!root) { console.error("Usage: npm run audit:source -- /path/to/dimsum"); process.exit(2); }
const result = await auditSource(root);
await mkdir("reports", { recursive: true });
await writeFile("reports/source-audit.json", JSON.stringify(result, null, 2));
await writeFile("reports/SOURCE_AUDIT.md", auditMarkdown(result));
console.log(auditMarkdown(result));
