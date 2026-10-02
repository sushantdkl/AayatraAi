import { createHmac, timingSafeEqual } from "node:crypto";

export function validWebhookSignature(rawBody: string, timestamp: string, signature: string, secret: string, now = Date.now()): boolean {
  const time = Number(timestamp);
  if (!Number.isSafeInteger(time) || Math.abs(now - time * 1000) > 300000 || !/^[a-f0-9]{64}$/i.test(signature) || !secret)
    return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest();
  const provided = Buffer.from(signature, "hex");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
