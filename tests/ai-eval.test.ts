import assert from "node:assert/strict";
import test from "node:test";
import { runEvaluation } from "../lib/eval-ai";
import { evalDataset } from "./fixtures/ai-eval-dataset";
import { holdoutDataset } from "./fixtures/ai-eval-holdout";
import { analyzeMessage, messageAnalysisSchema } from "../lib/message-analysis";

for (const [name, cases] of [["main", evalDataset], ["holdout", holdoutDataset]] as const) {
  test(`AI evaluation (${name}): intent/temperature/language regression and zero safety violations`, () => {
    const result = runEvaluation(cases);
    const misses = result.rows.filter((row) => !row.intentOk || !row.temperatureOk || !row.languageOk).map((row) => `${row.message} → ${row.gotIntent}/${row.gotTemperature}/${row.gotLanguage}`);
    assert.deepEqual(misses, []);
    assert.equal(result.safetyViolations, 0, JSON.stringify(result.rows.filter((row) => row.violations.length).map((row) => [row.message, row.violations])));
  });
}

test("§24 structured analysis validates and flags low confidence for human review", () => {
  const analysis = analyzeMessage("We sell 500+ products through Instagram. Can you handle variants and stock?");
  assert.ok(messageAnalysisSchema.safeParse(analysis).success);
  assert.ok(analysis.product_interest.includes("AADHAR_RETAIL_ERP"));
  const unknown = analyzeMessage("hmm");
  assert.equal(unknown.needs_human_review, true);
  assert.ok(unknown.confidence < 0.5);
});
