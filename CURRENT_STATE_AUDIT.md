# Aayatra AI Sales Engine — Current State Audit

**Audit date:** 2026-10-01  
**Scope:** `C:\Users\Acer\Desktop\AayatraAi`  
**Status:** Phase 0 / pre-implementation

## Executive conclusion

The repository is a greenfield planning workspace, not an existing application. It contains one requirements document, `AAYATRA_AI_SALES_ENGINE_FINAL_MASTER_PROMPT.md`, and no source code, package manifest, database schema, migrations, tests, deployment configuration, product manuals, pricing sheets, customer evidence, or credentials.

Major implementation should not begin until Aayatra supplies and approves the product and commercial facts listed below. Safe engineering can begin with the CRM foundation and the product-knowledge approval workflow because neither requires unverified sales claims or external outreach.

## A. Current architecture

| Area | Observed state | Evidence | Readiness |
|---|---|---|---|
| Application | No application code | Workspace file inventory | Not started |
| Frontend | No Next.js/React project | No `package.json` or source tree | Not started |
| Backend/API | No services or routes | No source tree | Not started |
| Authentication/RBAC | Absent | No auth configuration or schema | Not started |
| Database | Absent | No schema, ORM, migrations, or connection config | Not started |
| Jobs/queues | Absent | No Redis/BullMQ configuration | Not started |
| AI layer | Requirements only | Master prompt | Not started |
| Integrations | Requirements only | Master prompt | Not started |
| Tests | Absent | No test configuration | Not started |
| CI/CD | Absent | No workflow or deployment files | Not started |
| Observability | Absent | No logging, metrics, or tracing config | Not started |
| Product knowledge | Unverified possibilities only | Master prompt repeatedly says “potential,” “where applicable,” and “where implemented” | Blocked on product evidence |
| Commercial rules | Absent | No approved price book, discount rules, terms, or close criteria | Blocked on business approval |

The preferred stack in the prompt—Next.js, TypeScript, React, shadcn/ui, Tailwind, Node.js, PostgreSQL, Redis, BullMQ, Playwright, Lighthouse, FFmpeg, object storage, and an LLM-provider abstraction—is a direction, not an installed architecture.

## B. Verified product capability matrix

The verified result is currently zero capabilities because the workspace contains no product evidence. The full status taxonomy, portfolio matrix, evidence requirements, and verification test packs are in `VERIFIED_PRODUCT_CAPABILITIES.md`.

### Audit boundaries

This audit verifies repository facts only. It does not treat the master prompt as proof that a feature is implemented, supported, priced, compliant, or available in production. Market statements remain hypotheses unless backed by a cited source or campaign data. Legal observations are engineering risk controls, not legal advice.

## C. Gap analysis

### P0 — blocks truthful selling or safe operation

- Approved product inventory with version, deployment mode, evidence owner, and last verification date.
- Approved packages, prices, taxes, discount floors, implementation timelines, support terms, and exclusions.
- A legal/compliance decision for every acquisition and outreach channel.
- Tenant, user, role, permission, audit, retention, deletion, and do-not-contact policies.
- Defined stage-transition and `CLOSED_WON` rules.
- Approved message templates, sender identities, opt-out language, rate limits, and complaint thresholds.
- Environments, secrets management, backups, recovery objectives, and incident ownership.

### P1 — required for the manual CRM milestone

- Repository scaffold and engineering conventions.
- Organization-scoped authentication and RBAC.
- Businesses, contacts, leads, sources, campaigns, activities, opportunities, tasks, notes, and stage history.
- Manual import with validation, dry run, deduplication, provenance, and error reports.
- Search, filters, saved views, lead detail, opportunity pipeline, and audit history.
- Unit, integration, E2E, migration, accessibility, and authorization tests.

### P2 — required before AI-assisted selling

- Versioned and approved product knowledge base.
- Evidence-backed lead observations and deterministic scoring.
- Prompt registry, structured outputs, evaluation dataset, model/cost telemetry, and human review queues.
- Provider abstractions for discovery and messaging.
- Webhook verification, idempotency, replay protection, and delivery-state reconciliation.

### P3 — required before controlled autonomy

- Proven sender reputation and opt-out operations.
- Policy engine for pricing, discounts, promises, escalation, and channel eligibility.
- Proposal versioning and acceptance records.
- Payment verification with separation of duties.
- Automation kill switches, per-action budgets, anomaly alerts, and rollback/runbooks.

## Required decisions and evidence

| Owner | Required input | Why it is needed |
|---|---|---|
| Product owner | Live demos, release notes, manuals, deployment list, limitations | Verify sellable features |
| Commercial owner | Price book, bundles, taxes, discounts, validity, payment terms | Prevent invented offers |
| Sales owner | Current pipeline stages, qualification rules, SLAs, loss reasons | Model the actual process |
| Legal/privacy adviser | Lawful basis, privacy notice, retention, deletion, cold outreach/channel policy | Approve acquisition and contact |
| Operations | Onboarding checklist, implementation capacity, training/support commitments | Prevent delivery overcommitment |
| Engineering | Existing product repositories/APIs, hosting, identity, integration constraints | Establish reuse and integration plan |
| Finance | Invoice/deposit verification, refund and reconciliation rules | Define reliable close conditions |

## Recommended first executable slice

Build a single-tenant-capable, organization-scoped manual CRM as a modular Next.js application, while product owners populate and approve the product capability register. The first release must have no crawler and no autonomous sender. CSV/manual entry, deterministic deduplication, complete provenance, RBAC, audit logs, and stage history are enough to validate the domain safely.

## Phase 0 exit criteria

Phase 0 is complete only when:

1. Every sellable feature has an evidence link, status, owner, version, and review date.
2. Prices, discount authority, proposal terms, and close rules are approved.
3. Each planned lead source has a signed source review covering license, storage, contact use, retention, and deletion.
4. The schema, stage machine, RBAC matrix, threat model, and architecture decisions are approved.
5. At least 50 representative leads and 100 labeled conversation examples are available for test fixtures, with sensitive data removed or authorized.
6. Phase 1 acceptance tests and production non-functional targets are agreed.

## Deliverable map

- Product truth and verification backlog: `VERIFIED_PRODUCT_CAPABILITIES.md`
- Target design, data model, AI/security/QA/DevOps and phases: `ARCHITECTURE_PLAN.md`
- Market and ICP hypotheses: `MARKET_RESEARCH.md`
- Permitted-source assessment: `LEAD_SOURCE_RESEARCH.md`
- Prioritized delivery risks: `RISK_REGISTER.md`
