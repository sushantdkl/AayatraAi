# Sales automation continuation audit

Initial audit: 2026-10-01. Sources then inspected: repository code/migrations/tests, both Aayatra prompts, and the marketing snapshot embedded in the continuation prompt. The client kit was supplied later, on 2026-10-02; its reconciliation and updated evidence boundary are in [CLIENT_KIT_RECONCILIATION.md](CLIENT_KIT_RECONCILIATION.md). No separate Aadhar product repository, deployed application access, marketing poster files, provider account, or demo URL is available.

## Baseline before continuation (2026-10-01)

| Domain | Status | Evidence / gap |
|---|---|---|
| Product knowledge | PARTIAL | Versioned approval register and published-facts filter exist; no real product behavior is verified. |
| Discovery | PARTIAL | Manual and CSV import with source provenance; no external connector. |
| Enrichment | PARTIAL | Manual observations, not automated website/social audits. |
| Routing | PARTIAL | Deterministic internal suggestions from observations; no verified offer entitlement. |
| Lead fit | PARTIAL | Evidence-derived score; no labeled-data calibration. |
| Analytics | PARTIAL | Dashboard counts/pipeline; no full-funnel or cost metrics. |
| Outreach | NOT_STARTED | No provider/approval/queue before this continuation. |
| Inbound | NOT_STARTED | No webhook or conversation store before this continuation. |
| Intent | NOT_STARTED | No interaction-derived classifier before this continuation. |
| AI Sales Assistant | NOT_STARTED | No model provider or controlled tool executor. |
| Demo configuration | NOT_STARTED | Existing demos screen is a placeholder. |
| Automated demo | BLOCKED_EXTERNAL | No target URL, credentials, or safe demo tenant. |
| Proposal | NOT_STARTED | No verified price, approved legal template, or quote versioning. |
| Payment | NOT_STARTED | No gateway/manual verification workflow. |
| Closing | PARTIAL | `WON` is intentionally blocked; acceptance/payment gate not yet implemented. |
| Onboarding | NOT_STARTED | Client-kit lifecycle described in prompt, but the kit itself is not supplied. |

## Product evidence versus marketing

| Marketing claim | Repository verification | Sales treatment |
|---|---|---|
| Retail POS dashboard, sale, products, inventory, customers, reports, settings | None: sales-engine repository is not the POS product | Marketing draft only; needs product test/release evidence. |
| Restaurant billing/KOT, inventory/purchasing, accounting/reports, online ordering, staff, multi-device/backup | None | Do not publish as verified capabilities or include in autonomous answer. |
| Starter/Growth/Enterprise limits and included modules | None | Package descriptions need product and commercial approval. |
| eSewa/Khalti/QR/card support | None | Do not imply gateway integration or settlement. |
| Hotel, combined hotel/restaurant, salon, website/ecommerce demo workflows | None | Configurable placeholders only. |

## Commercial conflict and uncertainty report

- Retail software snapshot: NPR 30,000 one-time; NPR 10,000/year; NPR 1,000/month. Source is the prompt's marketing description, not a verified price sheet.
- Hardware snapshot: NPR 20,000 thermal+label printer; NPR 14,000 thermal printer; NPR 8,000 scanner. Procurement cost, tax, model, warranty, and validity are unknown; negotiation is mentioned but bounds are not approved.
- Restaurant Starter: NPR 15,000/year or NPR 1,500/month; Growth: NPR 25,000/year or NPR 2,500/month; Enterprise: NPR 40,000/year or NPR 4,000/month. All are unverified marketing snapshots.
- Superseded by the supplied client kit on 2026-10-02: the Enterprise quotation template says **from NPR 50,000/year**, versus the marketing draft NPR 40,000/year. The thermal receipt printer also differs (marketing NPR 14,000; kit indicative NPR 8,000–10,000). These are open `COMMERCIAL_PRICE_REVIEW_REQUIRED` records. An evidence-backed exact canonical price and explicit owner resolution are required before activation or quotation.
- No sales phone, WhatsApp, email, website URL, tax treatment, discount authority, support SLA, or legal terms are verified.

## Implementation map

1. Commercial catalogue and source records: organization-scoped, versioned state, explicit verification, price-conflict gate, audit log. No snapshot automatically becomes an active quote price.
2. Demo settings: organization-scoped URLs, environment classification, secret references, script/step model, safe queued checks, and `WAITING_FOR_DEMO_URL` state. Any real browser visit requires a configured, allowlisted demo/staging target and a human review gate.
3. Outreach and conversations: draft/approval and provider interfaces; inbox and verified webhooks; no real delivery without channel configuration and consent policy.
4. Intent and AI: deterministic safety triage first, model drafts only from published facts and active prices, human takeover and action authorization. No invented confidence.
5. Quotes, payments, closing, onboarding: versioned documents; payment events requiring independent verification; `WON` only after gates; idempotent project creation.
6. Full-funnel reporting and operational QA: counts only from real state events, no fabricated conversion or revenue.

## Database/API/UI impact and acceptance gates

- Database: commercial items/price sources, sales contacts, demo targets/scripts/jobs, outbound messages/delivery attempts, conversations/messages/intent events, quotes/versions, payment requests/events, onboarding projects/checklists; organization-scoped foreign keys, append-only event histories, uniqueness for idempotency.
- APIs: admin commercial/settings/demo management; demo check/job worker endpoints; message draft/approve/send provider boundary; signed inbound webhooks; conversation actions; quote calculation/versioning; payment request/verification; close/onboard; analytics. Every mutation checks role and origin or a signed provider request.
- UI: Sales Automation settings, demo targets/scripts/job status, commercial catalogue with verification states, conversation priority inbox, quote review, payment verification, onboarding tracker.
- Security: external URLs are SSRF-sensitive; no request to private, loopback, link-local, metadata, or production client hosts. Demo credentials are secret references only. Provider webhooks require signatures and replay limits. Every outbound action checks DNC/consent. No LLM writes critical tables. Quotes must resolve one active verified canonical price per line; conflicting sources fail closed. Payment success must come from verified gateway evidence or authorized manual verification. No verbal-intent `WON`.
- PASS/FAIL: typecheck/lint/build; migration on empty and existing DB; tenant isolation; inactive/unverified price rejection; conflicting active-source rejection; missing-demo-URL status; invalid URL rejection; duplicate webhook no-op; delivery failure not `SENT`; human takeover blocks AI sending; verbal agreement cannot win; payment verification gate; idempotent onboarding. Missing external inputs remain explicitly `BLOCKED_EXTERNAL`, never simulated as completed.
