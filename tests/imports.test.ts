import assert from "node:assert/strict";
import test from "node:test";
import { parseLeadCsv } from "../lib/imports";

test("CSV parser validates the required business fields and catches in-file duplicates", () => {
  const csv =
    "name,industry,city,website,contact_email\nPokhara Inn,HOTEL,Pokhara,https://example.com,hello@example.com\n pokhara  inn ,HOTEL,Pokhara,,\nX,Retail,Kathmandu,,";
  const parsed = parseLeadCsv(csv, "Owner supplied list for review");
  assert.equal(parsed.valid.length, 1);
  assert.equal(parsed.valid[0].name, "Pokhara Inn");
  assert.equal(parsed.issues.length, 2);
  assert.match(parsed.issues[0].reason, /Duplicate business/);
  assert.match(parsed.issues[1].reason, /name/);
});

test("CSV parser rejects missing columns, excessive rows, and unsafe URLs", () => {
  assert.throws(
    () => parseLeadCsv("business,industry\nExample,HOTEL", "source note"),
    /name and industry/,
  );
  const bad = parseLeadCsv(
    "name,industry,website\nExample Hotel,HOTEL,javascript:alert(1)",
    "source note",
  );
  assert.equal(bad.valid.length, 0);
  assert.match(bad.issues[0].reason, /website/);
  const tooMany =
    "name,industry\n" +
    Array.from({ length: 501 }, (_, i) => `Hotel ${i},HOTEL`).join("\n");
  assert.throws(() => parseLeadCsv(tooMany, "source note"), /more than 500/);
});
