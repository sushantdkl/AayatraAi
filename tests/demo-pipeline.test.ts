import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildDemoScript } from "../lib/demo-script-builder";
import { buildConcatList, buildSubtitles, renderDemoVideo } from "../lib/demo-video";
import type { FeatureRecord } from "../lib/feature-matrix";

const feature = (key: string, status: FeatureRecord["implementation_status"], keywords: string[], extra: Partial<FeatureRecord> = {}): FeatureRecord =>
  ({ product_family: "RESTAURANT_SYSTEM", feature_key: key, name: key, implementation_status: status, commercial_status: "SELLABLE", approved_language: null, limitations: null, conditions: null, keywords, ...extra });

test("demo script only shows verified/disclosable features that exist in live navigation", () => {
  const inspection = { finalUrl: "https://demo.example.com/dashboard", title: "Aadhar POS", capturedAt: "", navigation: [
    { text: "KOT", href: "https://demo.example.com/kot" }, { text: "Inventory", href: "https://demo.example.com/inventory" },
    { text: "Branches", href: "https://demo.example.com/branches" }, { text: "External", href: "https://evil.example.org/kot" },
  ] };
  const script = buildDemoScript(inspection, [
    feature("KOT", "VERIFIED_AVAILABLE", ["kot"], { approved_language: "Kitchen tickets print automatically" }),
    feature("INVENTORY", "PARTIAL", ["inventory"], { limitations: "single store" }),
    feature("MULTI_BRANCH", "NOT_AVAILABLE", ["branches"]),
    feature("PAYROLL", "UNKNOWN", ["payroll"]),
  ], "RESTAURANT_SYSTEM");
  assert.deepEqual(script.covered, ["KOT", "INVENTORY"]);
  assert.ok(script.steps.some((step) => step.route === "/kot" && step.caption === "Kitchen tickets print automatically"));
  assert.ok(script.steps.some((step) => step.caption === "INVENTORY (single store)"));
  assert.ok(!script.steps.some((step) => step.route === "/branches"));
  assert.ok(script.steps.every((step) => !step.isMutating));
  assert.match(script.skipped.find((item) => item.featureKey === "MULTI_BRANCH")?.reason ?? "", /NOT_AVAILABLE/);
});
test("concat list and subtitles are deterministic", () => {
  const frames = [{ path: "/tmp/a.png", durationMs: 2500, caption: "Overview" }, { path: "/tmp/b's.png", durationMs: 1000, caption: "KOT" }];
  assert.equal(buildConcatList(frames), "ffconcat version 1.0\nfile '/tmp/a.png'\nduration 2.500\nfile '/tmp/b'\\''s.png'\nduration 1.000\nfile '/tmp/b'\\''s.png'\n");
  assert.equal(buildSubtitles(frames), "1\n00:00:00,000 --> 00:00:02,500\nOverview\n\n2\n00:00:02,500 --> 00:00:03,500\nKOT\n");
});
const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;
test("FFmpeg renders an MP4 with a subtitle track from captured frames", { skip: !hasFfmpeg }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "demo-video-"));
  for (const [name, color] of [["one.png", "white"], ["two.png", "teal"]]) execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", `color=c=${color}:s=640x360`, "-frames:v", "1", join(dir, name)]);
  const out = join(dir, "demo.mp4");
  const result = await renderDemoVideo([{ path: join(dir, "one.png"), durationMs: 1000, caption: "Overview" }, { path: join(dir, "two.png"), durationMs: 1000, caption: "KOT" }], dir, out);
  assert.ok(statSync(out).size > 1000);
  assert.equal(result.durationMs, 2000);
  const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", out], { encoding: "utf8" });
  assert.match(probe.stdout, /video/);
  assert.match(probe.stdout, /subtitle/);
});
