# Aayatra AI Sales Engine

An internal sales workspace for Aayatra Enterprises (brand: Aadhar POS, Kathmandu). It covers:

- CRM and lead research.
- Owner-approved canonical pricing with PAN-only tax.
- A verified feature-claim register.
- A priority inbox in which every incoming message is classified (English, Nepali, Romanized Nepali), staged by buying temperature and answered with a grounded suggested reply. Claude wording is optional.
- Follow-up drafting, the WhatsApp Cloud API channel, demo navigation/recording/video, quotations, manual payment verification, and gated closing/onboarding.

Nothing is sent without manager approval and a configured provider.

**Start here:** [Final implementation report](FINAL_IMPLEMENTATION_REPORT.md) · [Production activation checklist](PRODUCTION_ACTIVATION_CHECKLIST.md) · [AI reply library](AI_REPLY_LIBRARY.md) · [AI evaluation](AI_EVALUATION_REPORT.md) · [Commercial catalogue](COMMERCIAL_CATALOGUE.md) · [Verified capabilities](VERIFIED_PRODUCT_CAPABILITIES.md) · [QA](FINAL_QA_REPORT.md) · [Security](FINAL_SECURITY_REVIEW.md)

The [master prompt](AAYATRA_AI_SALES_ENGINE_FINAL_MASTER_PROMPT.md) is the product brief. The [audit](CURRENT_STATE_AUDIT.md), [architecture plan](ARCHITECTURE_PLAN.md), [capability matrix](VERIFIED_PRODUCT_CAPABILITIES.md), [market research](MARKET_RESEARCH.md), [source research](LEAD_SOURCE_RESEARCH.md), and [risk register](RISK_REGISTER.md) document what was known when implementation began.

See [implementation status](IMPLEMENTATION_STATUS.md) for the Phase A–R acceptance boundary, and [client-kit reconciliation](CLIENT_KIT_RECONCILIATION.md) for the supplied template's pricing conflicts and onboarding mapping.

## Run locally

Requires Node.js 22+, npm, and Docker.

1. Copy `.env.example` to `.env` and choose a strong `BOOTSTRAP_PASSWORD`. The example database password is only for local development.
2. Run `docker compose up -d db`.
3. Run `npm ci` and `npm run db:migrate`.
4. Run `npm run db:bootstrap` once to create the owner account. Bootstrap also applies the owner-approved configuration. For an existing database, run `npm run db:apply-owner-config`, which is idempotent.
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

See the [final implementation report](FINAL_IMPLEMENTATION_REPORT.md) for the phase-by-phase status. In short:

- **Prices:** the 12 owner-approved poster SKUs are canonical. A standard, undiscounted quote is approved automatically. Discounts, custom work, non-standard hardware and multi-branch promises need a person. Older draft prices are kept as SUPERSEDED.
- **Tax:** PAN-only, so VAT is never added. VAT needs separately verified registration. Aadhar POS is never called IRD-certified.
- **Features:** sold only when the feature register says VERIFIED_AVAILABLE or AVAILABLE_WITH_CONFIGURATION. Multi-branch is not sales-safe. Restaurant features stay UNKNOWN until the dimsum source and live demo are verified.
- **Inbound messages:** each one is classified, updates the lead temperature and conversation memory, and gets a grounded suggested reply in the customer's language. AI discount authority is 0 %. Payments are verified only by people.
- **WhatsApp:** stays NOT_CONFIGURED until Cloud API credentials exist. The signed webhook, 24-hour window and delivery statuses are implemented.
- **Demos:** stay WAITING_FOR_DEMO_URL until a URL is supplied. After that: health check → generated script → recorded MP4.
