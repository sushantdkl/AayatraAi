# Final QA report

**Date:** 2026-10-03 · **Environment:** Linux container, Node 22.22, PostgreSQL 16 (local), Chromium (Playwright build 1194), FFmpeg.

## Results

| Check | Command | Result |
|---|---|---|
| Type check | `npm run typecheck` | Pass |
| Lint | `npm run lint` | Pass (0 problems) |
| Unit + DB integration + AI regression | `npm test` (with `DATABASE_URL`) | **82 passed, 0 failed, 0 skipped** |
| Production build | `npm run build` | Pass |
| HTTP E2E against the built app | `npm run start:e2e` + `npm run test:e2e` | Pass, run twice for repeatability |
| Browser smoke (desktop 1440 px + mobile 390 px) | `node tests/browser-smoke.mjs` | Pass; no horizontal overflow |
| AI evaluation | `npm run eval:ai`, `--holdout` | 140/140 and 32/32 (first untuned held-out run: 65.6 %; see AI report) |
| Dependency audit | `npm audit --omit=dev --audit-level=high` | 0 vulnerabilities |

## What the new tests cover

- **Tax and pricing**
  - PAN-only: Growth NPR 25,000 totals NPR 25,000.
  - VAT can't be charged, saved or approved while PAN-only.
  - The request can't inject tax.
  - A 0 % ceiling rejects any discount.
- **Owner config (DB)**
  - The 12 poster SKUs are active at exact prices.
  - Legacy drafts are SUPERSEDED (kept), and their discrepancies are resolved with evidence.
  - Policy is PAN_ONLY approved with AI discount 0.
  - Multi-branch is NOT_AVAILABLE; 5 demo targets wait for URLs.
  - Re-running changes nothing.
  - The DB refuses VAT_REGISTERED without VAT evidence.
- **Quote policy**
  - A standard poster quote is auto-approved.
  - Discount, multi-branch promise, custom SLA, non-standard hardware or an unapproved policy each require a human.
- **Intent and temperature:** all six §21 examples, Devanagari rules, forward-only temperature with revival, and language detection.
- **Replies**
  - Exact poster prices in all three languages.
  - Never invents a price when the catalogue is inactive.
  - Negotiation without a discount figure.
  - The owner's multi-branch wording, even when the message is a package question.
  - Unverified features are not guessed; verified features use approved wording.
  - PAN/VAT/IRD answers; payment replies never claim receipt.
  - Opt-out sends nothing; demo links only when reviewed.
- **Claude layer** (injected model responses): a grounded reply is used but never auto-sent. Invented or misattributed prices, discounts, multi-branch claims, payment claims, refusals and errors all fall back to the template.
- **WhatsApp**
  - Nepal E.164 normalisation; NOT_CONFIGURED until every secret resolves.
  - Test provider only on opt-in.
  - HMAC signature verification; payload parsing (text, buttons, media, statuses).
  - 24-hour window; Cloud API request shape; SENT only with a message ID.
- **Follow-ups:** cadence, max 3, stops (not interested, DNC, won, cold), customer spoke last, customer-requested date.
- **Demo**
  - Script includes only verified or partial features present in live navigation; never multi-branch; read-only steps.
  - Deterministic concat list and subtitles.
  - Real FFmpeg renders an MP4 with video and subtitle streams.
  - Real Chromium: synthetic login, route walk, frame capture; mutating steps refused.
- **Source audit:** routes + schema + tests → PARTIAL; routes only → UNKNOWN; multi-branch stays NOT_AVAILABLE; `node_modules` ignored; never proposes VERIFIED.
- **HTTP E2E addendum:** every item above end to end through the running app, including a signed WhatsApp webhook (forged signature → 401, redelivery deduplicated) and the priority-inbox order.

## Defects found and fixed during QA

1. **Inbound WhatsApp leads had no `source_record_id`.** The existing Leads page called `.replaceAll` on a null source type and crashed. The webhook now creates leads with source provenance, the E2E suite asserts it, and the shared `label()` helper tolerates null.
2. **`loadReplyContext` ran parallel queries on one pooled client.** pg deprecates this and pg@9 will remove it. The queries now run in sequence.
3. **A guardrail gap: "Growth NPR 20,000" passed** because NPR 20,000 is a real price (the label printer). LLM amounts must now belong to a declared or server-cited SKU.
4. **The multi-branch guard was bypassed** when "Enterprise" made the message a package question. A not-sales-safe claim is now guarded whatever the main intent.

## Not tested here (requires external input)

- Live WhatsApp Cloud API delivery (no credentials).
- Live Claude API calls (no key).
- A real Aadhar demo URL (none supplied).
- The dimsum source audit (repository not accessible in this session).
- Payment gateway (none; manual methods only).
