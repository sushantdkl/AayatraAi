import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { validWebhookSignature } from "../lib/webhook-signature";

test("signed test webhook rejects spoofed and stale payloads", () => {
  const now = Date.now();
  const timestamp = String(Math.floor(now / 1000));
  const raw = '{"body":"hello"}';
  const signature = createHmac("sha256", "test-secret").update(`${timestamp}.${raw}`).digest("hex");
  assert.equal(validWebhookSignature(raw, timestamp, signature, "test-secret", now), true);
  assert.equal(validWebhookSignature(raw + "x", timestamp, signature, "test-secret", now), false);
  assert.equal(validWebhookSignature(raw, String(Number(timestamp) - 600), signature, "test-secret", now), false);
});
