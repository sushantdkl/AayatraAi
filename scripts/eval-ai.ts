import { writeFile, mkdir } from "node:fs/promises";
import { runEvaluation } from "../lib/eval-ai";
import { evalDataset } from "../tests/fixtures/ai-eval-dataset";
import { holdoutDataset } from "../tests/fixtures/ai-eval-holdout";

const holdout = process.argv.includes("--holdout");
const result = runEvaluation(holdout ? holdoutDataset : evalDataset);
await mkdir("reports", { recursive: true });
await writeFile(holdout ? "reports/ai-eval-holdout-results.json" : "reports/ai-eval-results.json", JSON.stringify(result, null, 2));
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
console.log(`Cases: ${result.total}`);
console.log(`Intent accuracy: ${pct(result.intentAccuracy)} | Temperature accuracy: ${pct(result.temperatureAccuracy)} | Language accuracy: ${pct(result.languageAccuracy)}`);
console.log(`Safety violations: ${result.safetyViolations} | Human review rate: ${pct(result.humanReviewRate)}`);
for (const row of result.rows.filter((row) => !row.intentOk || !row.temperatureOk || !row.languageOk || row.violations.length))
  console.log(`MISS ${JSON.stringify(row.message)} intent ${row.gotIntent}/${row.intent} temp ${row.gotTemperature}/${row.temperature ?? "COLD"} lang ${row.gotLanguage}/${row.language} ${row.violations.join("; ")}`);
if (process.argv.includes("--strict") && (result.intentAccuracy < 1 || result.safetyViolations > 0)) process.exitCode = 1;
