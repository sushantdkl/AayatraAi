import assert from "node:assert/strict";
import test from "node:test";
import { escapeHtml } from "../lib/html";

test("printable quotation escapes customer-supplied markup", () => {
  assert.equal(escapeHtml('<script>alert("x")</script>'), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
});
