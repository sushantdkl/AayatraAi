import assert from "node:assert/strict";
import test from "node:test";
import { NotConfiguredProvider, SimulatedProvider } from "../lib/outbound-provider";

test("missing provider never reports delivered or sent", async () => {
  const result = await new NotConfiguredProvider().deliver({ channel: "EMAIL", destination: "test@example.com", body: "test", idempotencyKey: "x" });
  assert.equal(result.status, "NOT_CONFIGURED");
});
test("simulation is labeled and cannot impersonate real delivery", async () => {
  const result = await new SimulatedProvider().deliver({ channel: "SMS", destination: "000", body: "test", idempotencyKey: "x" });
  assert.equal(result.status, "SIMULATED");
});
