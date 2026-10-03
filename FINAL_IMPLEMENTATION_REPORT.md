# Final implementation report — owner configuration addendum

**Date:** 2026-10-03 · **Branch:** `claude/aayatra-sales-engine-config-mwqjy6`
**Inputs applied:** company identity, PAN-only tax status, canonical poster prices (`OWNER_APPROVED_POSTER_2026`), discount policy, WhatsApp number, demo-URL placeholders and legal `REVIEW_REQUIRED`.
**Not available to this session:** the `dimsum` source. The 30 MB upload limit blocked the zip, and attaching `sushantdkl/dimsum` from GitHub was not permitted here. Feature claims therefore stay unverified and the audit tool is ready to run.

Legend: **Done** = implemented and tested here. **Done, external gate** = built and tested, waiting only on an external input listed in [PRODUCTION_ACTIVATION_CHECKLIST.md](PRODUCTION_ACTIVATION_CHECKLIST.md). **Partial** = useful but incomplete; the gap is stated.

| # | Phase | Status | What exists |
|---:|---|---|---|
| 1 | Source-code audit | Done, external gate | `lib/source-audit.ts`, `npm run audit:source -- <dimsum>`: evidence matrix from routes, pages, migrations, tests and the repo's own audit doc; proposals only. Not yet run on dimsum. |
| 2 | Verified capability matrix | Done | `product_features` + append-only history, §16 policy, API and UI (Settings → Feature claims). Multi-branch and IRD claims seeded NOT_SALES_SAFE. |
| 3 | Product knowledge completion | Partial | Feature register and playbook facts. Real feature statuses await the dimsum audit and a live demo. |
| 4 | Commercial catalogue | Done | 12 poster SKUs ACTIVE/VERIFIED/canonical. Old drafts SUPERSEDED, never deleted. See `COMMERCIAL_CATALOGUE.md`. |
| 5 | Pricing engine | Done | Canonical-price resolution, floors, discount limits, policy versions, standard-quote auto-approval and exception list. |
| 6 | PAN-only tax configuration | Done | `company_profiles`, `tax_mode=PAN_ONLY`, VAT blocked unless verified VAT registration, PAN document upload and verification, invoice readiness gate. |
| 7 | Lead discovery | Partial | Manual entry, CSV import, and inbound WhatsApp auto-creates leads with provenance. No external scraping connector (compliance-sensitive). |
| 8 | Enrichment | Partial | Manual observations and scoring as before. No automated website/social crawler. |
| 9 | Routing | Partial | Offer suggestions plus product-family detection from messages and industry. |
| 10 | Lead fit | Partial | Existing evidence-derived score. Not calibrated on labelled outcomes. |
| 11 | Social-commerce lead support | Done (rules) | Instagram/TikTok/DM playbook, product-interest extraction (Retail ERP + ecommerce), inbound capture. |
| 12 | Outreach provider abstraction | Done | `OutboundProvider`: NotConfigured, Simulated (opt-in, never "sent") and WhatsApp Cloud. |
| 13 | Inbound conversations | Done, external gate | Manual record, signed test webhook, and a production WhatsApp webhook (Meta verify handshake, HMAC-SHA256, dedupe, status updates). Needs Meta credentials. |
| 14 | AI reply system | Done | Grounded drafting on every inbound message, redraft API, queue/discard, guardrails, optional Claude layer. |
| 15 | English / Nepali / Romanized Nepali | Done | Language detection and full reply sets in all three; see `AI_REPLY_LIBRARY.md`. |
| 16 | Buying-intent classification | Done | `RULES_V2` + §24 structured analysis + §21 temperatures. Evaluation in `AI_EVALUATION_REPORT.md`. |
| 17 | Hot / ready lead views | Done | Inbox filters: Priority, Ready to buy, Hot, Negotiating, Needs human, Unread. |
| 18 | Priority inbox | Done | Server-side ordering: payment → ready → negotiating → proposal → hot → others. Shows the AI suggestion, memory and temperature. |
| 19 | Follow-ups | Done | §40 planner (≤ 3 per stage, cadence by temperature, customer-requested dates, stops on reply/opt-out/won/DNC) and `npm run follow-up:worker` (drafts only). |
| 20 | Demo target settings | Done, external gate | 5 configurable targets from `AADHAR_*_DEMO_URL` / `THE_HAIRCUT_DEMO_URL`; WAITING_FOR_DEMO_URL until set. |
| 21 | Playwright navigation | Done, external gate | Allow-listed, SSRF-safe health check, synthetic login (POST only during login, same origin), read-only route walk. Tested in real Chromium against a local server. |
| 22 | Automated demo scripts | Done, external gate | `buildDemoScript` from live navigation × feature register (verified/partial only) → DRAFT script via `POST /api/demo-scripts/build`. |
| 23 | FFmpeg / video pipeline | Done, external gate | Frames → H.264 MP4 with a subtitle track; worker handles SCRIPT_TEST and VIDEO jobs. Tested with real FFmpeg. |
| 24 | Quote generator | Done | Immutable versions, company snapshot, PAN-only VAT line, auto-approval for standard prices. |
| 25 | Proposal generator | Partial | Printable quotation (HTML → browser PDF) with scope and exclusions. No separate long-form proposal template; legal wording REVIEW_REQUIRED. |
| 26 | Negotiation controls | Done | NEGOTIATING stage, AI discount 0 %, manager limit, item floors, exception approval, negotiation rounds stored. |
| 27 | Payment requests | Done | MANUAL_BANK, MANUAL_QR, CASH. Verification needs an authorized human with a unique reference. `verification_basis` column added. AI never verifies money. |
| 28 | Closing conditions | Done | WON needs accepted quote, signed agreement with legal-review reference and verified payment. Lead becomes CLOSED_WON. |
| 29–39 | Onboarding → renewal (import, hardware, configuration, training, UAT, go-live, handover, support, feedback, renewal) | Done (workflow) | 18-step client-kit checklist with prerequisites and evidence. Actual POS delivery is manual by nature. |
| 40 | End-to-end analytics | Done | `/api/analytics` + overview panel: temperature funnel, AI draft outcomes, quotes, verified revenue, follow-ups, intents and languages. All from recorded state. |
| 41 | Security | Done | See `FINAL_SECURITY_REVIEW.md`. |
| 42 | QA | Done | See `FINAL_QA_REPORT.md`: 82 unit/integration tests, HTTP E2E, browser smoke and AI evaluation. |
| 43 | Production activation checklist | Done | `PRODUCTION_ACTIVATION_CHECKLIST.md`: only genuinely external items remain. |

## Main code added

- **Schema:** `db/020_owner_config_2026.sql` — company profile, PAN_ONLY tax mode, SKUs and supersession, feature register, temperatures, AI drafts, follow-ups, WhatsApp settings, conversation memory.
- **Configuration:** `lib/owner-config.ts`, `lib/owner-config-apply.ts`, `scripts/apply-owner-config.ts`.
- **Intent and replies:** `lib/intent.ts`, `lib/message-analysis.ts`, `lib/sales-temperature.ts`, `lib/temperature-store.ts`, `lib/ai-replies.ts`, `lib/sales-playbook.ts`, `lib/sales-persona.ts`, `lib/reply-safety.ts`, `lib/llm-reply.ts`, `lib/reply-pipeline.ts`, `lib/conversation-ingest.ts`, `lib/follow-ups.ts`.
- **WhatsApp:** `lib/whatsapp.ts`, `lib/whatsapp-inbound.ts`, `app/api/webhooks/whatsapp`, `app/api/whatsapp-settings`.
- **Company, tax and quotes:** `lib/company.ts`, `lib/quote-policy.ts`, `app/api/company/*`, quotation/print changes.
- **Demos and audit:** `lib/demo-script-builder.ts`, `lib/demo-video.ts`, `lib/demo-browser.ts` (capture), `scripts/demo-worker.ts`, `lib/source-audit.ts`.
- **UI:** `app/owner-settings.tsx` (Company & tax, Feature claims, WhatsApp), inbox AI panel, funnel panel, policy editor (PAN-only, default discount).

## Operating the new pieces

```text
npm run db:migrate && npm run db:apply-owner-config   # existing database
npm run follow-up:worker                              # schedule (e.g. hourly) — drafts only
npm run demo:worker                                   # schedule when a demo URL is configured
npm run audit:source -- /path/to/dimsum               # when the source is available
npm run eval:ai                                        # after any rule/prompt change
npx tsx scripts/generate-reply-library.ts             # refresh AI_REPLY_LIBRARY.md
```
