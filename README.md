# Aayatra AI Sales Engine

An internal sales workspace for Aayatra Enterprises. The current release supports manual CRM and lead research, a versioned product register, guarded commercial/demo configuration, a priority inbox, outbound drafts, quotations, manual payment verification, and gated closing/onboarding. It does not send live messages, run a real demo, or autonomously close sales.

The [master prompt](AAYATRA_AI_SALES_ENGINE_FINAL_MASTER_PROMPT.md) is the product brief. The [audit](CURRENT_STATE_AUDIT.md), [architecture plan](ARCHITECTURE_PLAN.md), [capability matrix](VERIFIED_PRODUCT_CAPABILITIES.md), [market research](MARKET_RESEARCH.md), [source research](LEAD_SOURCE_RESEARCH.md), and [risk register](RISK_REGISTER.md) document what was known when implementation began.

See [implementation status](IMPLEMENTATION_STATUS.md) for the Phase A–R acceptance boundary, and [client-kit reconciliation](CLIENT_KIT_RECONCILIATION.md) for the supplied template's pricing conflicts and onboarding mapping.

## Run locally

Requires Node.js 22+, npm, and Docker.

1. Copy `.env.example` to `.env` and choose a strong `BOOTSTRAP_PASSWORD`. The example database password is only for local development.
2. Run `docker compose up -d db`.
3. Run `npm ci` and `npm run db:migrate`.
4. Run `npm run db:bootstrap` once to create the owner account.
5. Run `npm run dev` and open `http://localhost:3000`.

The local database is exposed only on `127.0.0.1:55432`. The Docker volume persists between app restarts. Do not use the example credentials in a deployed environment.

## Verify

```text
npm run typecheck
npm run lint
npm test
npm run build
```

`npm test` includes PostgreSQL integration checks when `DATABASE_URL` is set. For HTTP and browser E2E tests, use a separate disposable database, apply migrations and bootstrap a test owner there, then create an ignored `.env.e2e.local` with `DATABASE_URL`, `APP_ORIGIN=http://localhost:3001`, `E2E_EMAIL`, and `E2E_PASSWORD`. Run `npm run start:e2e` in one terminal and `npm run test:e2e` plus `node tests/browser-smoke.mjs` in another. The tests create clearly named fixture records. Never aim them at production data.

## Current behavior

- Leads can be created manually or imported from a CSV preview. An import fails as a whole if any row is invalid or duplicated.
- Contact details are recorded as **unreviewed for outreach**. No outbound messages are sent.
- Campaigns track hypotheses and lead cohorts. Activating a campaign does not send anything.
- Operators record observations with source, confidence, actor, and time. Fit and digital maturity are provisional computations. Buying intent remains unknown until prospect interactions exist.
- Offer candidates are internal suggestions. They do not authorize a sales claim.
- Product capabilities start unverified. Owner/product approver review creates an append-only version. The published-facts API returns only the current verified/optional versions that include evidence and approved wording.
- `WON` is gated by an accepted quotation, recorded signed agreement, and owner-verified sufficient payment with a unique evidence reference. This is an internal verification workflow, not a payment gateway.
- The demo settings accept the Aayatra website/demo link the owner will supply later. Health checks are read-only and require explicit approval and host allowlisting. No live site has been visited.
- Commercial prices imported from the marketing snapshot remain drafts until separately verified and activated. Conflicting prices without a canonical source cannot be quoted.
- The priority inbox accepts manually recorded inbound messages and a signed test webhook. Outbound approval never implies actual delivery while the provider is unconfigured.

## Next gates

The product owner must provide live product evidence, approved commercial/legal terms, consent policy, demo URL and channel credentials before customer-facing automation can be activated. The Aadhar client kit has been reviewed and mapped to an evidence-linked onboarding checklist; it is not proof of product features or final legal/tax terms. AI assistant replies, automatic follow-ups, demo recording, live integrations, and full-funnel analytics are not implemented. See the phase table for exact status.
