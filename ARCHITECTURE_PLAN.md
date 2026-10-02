# Aayatra AI Sales Engine — Architecture Plan

**Plan date:** 2026-10-01  
**Architecture posture:** modular monolith first; event-driven workers where latency or isolation requires them; PostgreSQL as the source of truth.

## G. Proposed architecture

### Principles

- Keep one deployable web/API application until scale or isolation data proves a service split is useful.
- Put tenant scoping, authorization, policy, pricing, stage transitions, and audit on the server.
- Treat external content and model output as untrusted data.
- Store facts with source, observation time, confidence, terms snapshot, and retention class.
- Use an outbox and idempotent workers for every external side effect.
- Start at autonomy Level 0/1. Promotion requires measured quality and an explicit approval.

### Components

| Component | Responsibility |
|---|---|
| Next.js web application | Server-rendered CRM UI, route handlers, authenticated API/BFF |
| Domain modules | Identity, CRM, pipeline, product knowledge, discovery, messaging, proposals, payments, onboarding, analytics |
| PostgreSQL | Authoritative relational state, row-level tenant boundaries, audit/outbox records |
| Redis + BullMQ | Delayed/retryable work, scheduled follow-ups, enrichment, audits, document/demo jobs |
| Worker process | Claims jobs, calls adapters, records result/evidence, emits domain events |
| Object storage | Versioned proposal PDFs, authorized attachments, demo assets, evidence snapshots subject to retention |
| Provider adapters | Lead sources, email, WhatsApp/SMS, calendar, LLM, storage, payment; no provider types leak into domain rules |
| Policy engine | Channel eligibility, consent/DNC, action authority, price/discount boundaries, stage transitions, escalation |
| Observability | Structured logs, traces, metrics, error reporting, job/provider dashboards and cost ledger |

### Request and side-effect flow

1. UI/API authenticates the actor and establishes `organization_id` server-side.
2. Application service validates input, authorization, state transition, and policy.
3. One database transaction changes domain state, appends audit data, and writes an outbox event.
4. A dispatcher creates an idempotent BullMQ job.
5. A worker calls the external provider with a stable idempotency key.
6. Provider result/webhook is verified, deduplicated, reconciled, and audited.

No request should both commit business state and make an unrecoverable network side effect without this pattern.

### Initial repository shape

```text
apps/
  web/                 Next.js UI and server API
  worker/              BullMQ consumers
packages/
  db/                  schema, migrations, repositories
  domain/              entities, policies, state machines
  contracts/           schemas and provider interfaces
  ui/                  accessible design-system components
  observability/       logs, metrics, tracing
  config/              typed environment configuration
tests/
  e2e/
  fixtures/
docs/
  adr/
  runbooks/
```

This can be a pnpm workspace with strict TypeScript. Choose an ORM/query layer only after a short spike validates migrations, transactions, PostgreSQL constraints, and organization scoping. Do not let the ORM replace database constraints.

## H. Data model

All mutable domain tables use UUID primary keys, `organization_id`, timestamps, optimistic versioning where concurrent edits matter, and actor metadata. Money uses integer minor units plus ISO currency. Times are stored in UTC with the originating zone retained for meetings/follow-ups.

### Core relationships

| Aggregate | Important relationships and invariants |
|---|---|
| Organization | Has users, memberships, roles, settings, retention policies; tenant ID never comes from an untrusted client alone |
| Business | Has locations, contacts, social profiles, observations, leads; normalized identity plus aliases and merge history |
| Contact | Belongs to a business where known; channel values, provenance, consent/eligibility, verification, DNC status |
| Lead | References business, campaign/source, assignee, fit snapshot; may produce opportunities but is not itself a deal |
| Source record | Provider/reference/license snapshot, acquired/observed times, raw hash, retention class; supports provenance and deletion |
| Observation | Typed value, source record, confidence, observed/expiry dates; never overwrites contradictory evidence silently |
| Opportunity | Business, stage, owner, value/currency, primary product; has stage history and product recommendations |
| Conversation | Contact/channel identity; has ordered immutable messages and versioned structured summaries |
| Product knowledge | Product → package → capability/limitation/price rule; draft and immutable published versions with approver |
| Proposal | Opportunity plus immutable versions, line items, assumptions, approval/acceptance evidence |
| Payment | Expected amount and method; append-only provider events; verified status controls close rule |
| Agent run | Model/prompt/tool versions, structured input/output, token/cost, confidence, evidence, decision, reviewer |
| Audit event | Append-only actor/action/reason/before/after/correlation; sensitive values redacted or separately protected |

### Tables by domain

```text
identity: organizations, users, memberships, roles, permissions, role_permissions
crm: businesses, business_aliases, locations, contacts, contact_channels,
     leads, lead_assignments, activities, tasks, meetings, tags
sources: source_connectors, source_records, source_evidence, observations,
         import_batches, import_rows, merge_candidates
campaigns: campaigns, campaign_segments, campaign_members, channel_policies
pipeline: opportunities, opportunity_products, stage_history, score_snapshots,
          intent_events, escalations
conversations: conversations, messages, message_deliveries, summaries,
               followups, consent_events, do_not_contact_entries
catalog: products, packages, capabilities, limitations, knowledge_versions,
         prices, pricing_rules, discount_rules, objection_policies
commercial: quotes, quote_versions, proposals, proposal_versions,
            proposal_acceptances, payment_requests, payments, payment_events
delivery: customers, implementation_projects, onboarding_items
automation: prompts, prompt_versions, agent_runs, agent_actions, approvals,
            jobs, outbox_events, webhook_receipts, provider_accounts, model_usage
governance: audit_events, retention_policies, deletion_requests, legal_holds
```

### Database-enforced invariants

- Unique normalized contact channel per organization where appropriate.
- Unique provider/source reference per organization and connector.
- Allowed stage transition enforced through one transaction-safe service; history is mandatory.
- Published knowledge and accepted proposal versions are immutable.
- `CLOSED_WON` requires configured acceptance plus verified payment/deposit evidence.
- DNC check precedes every outbound message in the same decision path.
- Payment events and audit events are append-only.
- Webhook provider event IDs and outbound idempotency keys are unique.

## I. AI architecture

### Decision pipeline

```text
authorized data retrieval
→ content normalization and size/type limits
→ explicit untrusted-content boundary
→ deterministic extraction where possible
→ LLM structured extraction/classification
→ JSON Schema validation
→ evidence and confidence checks
→ deterministic policy evaluation
→ draft, approval task, or authorized tool command
→ transaction-safe execution and audit
```

### AI roles

| Role | Output | Authority |
|---|---|---|
| Enrichment extractor | Candidate observations with exact evidence | Write candidate facts only |
| Product router | Ranked product IDs and reasons | Recommendation only |
| Intent classifier | Intent, score suggestion, evidence, confidence | Append event; no critical stage mutation |
| Drafting assistant | Outreach/reply/proposal narrative | Draft only initially |
| Conversation summarizer | Structured summary with source message IDs | Non-authoritative memory |
| Sales copilot | Recommended next action | No direct send/price/close permission |

### Controls

- Provider-neutral `ModelGateway` with allowlisted models, timeouts, retry classification, budgets, and redaction.
- Version every prompt, schema, model choice, knowledge snapshot, and evaluation result.
- Retrieval uses only the current organization and a published product-knowledge version.
- Require evidence references for material claims; unsupported fields remain `UNKNOWN`.
- Ignore instructions found in websites, messages, files, and social content; they are data, not system instructions.
- Tools accept typed IDs, re-fetch authoritative state, authorize independently, and enforce business rules.
- Low confidence, conflicting evidence, custom scope, large deal, legal/security question, anger, discount exception, or irreversible action routes to human review.
- Never label intent as purchase probability until a suitable calibrated historical dataset exists.

### Evaluation gates

Maintain separate, versioned test sets for intent, product routing, evidence faithfulness, unsupported-claim detection, prompt injection, multilingual Nepali/English and romanized Nepali, pricing refusal, DNC handling, and escalation. Promotion requires approved thresholds per class, not only aggregate accuracy. Start with at least 100 curated conversations; expand from reviewed production failures without leaking personal data.

## J. Security plan

### Identity and authorization

- OIDC-compatible authentication, secure `HttpOnly`/`Secure`/`SameSite` sessions, rotation and short-lived privileged sessions.
- Organization-scoped RBAC with roles such as owner, admin, sales manager, sales rep, product approver, finance verifier, auditor, and service account.
- Object-level authorization on every read/write; add PostgreSQL row-level security as defense in depth after testing operational implications.
- Step-up authentication and separation of duties for discounts, proposal approval, payment verification, exports, and destructive actions.

### Application and data controls

- Validate at every trust boundary; parameterized SQL; contextual output encoding; CSRF defense; restrictive CSP and security headers.
- Encrypt in transit and at rest; keep provider tokens in a managed secret store; no secret or privileged provider call in browser bundles.
- SSRF-safe fetcher with allowed schemes, DNS/IP re-check, private/link-local/metadata network blocking, redirect limits, byte/time limits, and isolated browser workers.
- Malware/type/size scanning for uploads; signed short-lived object URLs; separate public demo assets from confidential files.
- Minimize contact data, apply field-level protection where needed, redact logs, and implement retention/deletion workflows by source and purpose.
- Rate limits at user, organization, IP, connector, campaign, contact, and provider levels.

### Webhooks and external actions

- Verify provider signature against raw body, timestamp/freshness, and expected account.
- Persist the receipt before processing; enforce event-ID uniqueness and replay safety.
- Reconcile delivery/payment state with provider APIs for critical events.
- Outbound actions require channel eligibility, DNC, campaign state, sender state, rate/budget checks, and idempotency.
- Global and per-campaign kill switches must work without a deployment.

### Threat-model priorities

Prompt injection, cross-tenant access, account takeover, CSV formula injection, spreadsheet/HTML/PDF injection, SSRF from website auditing, poisoned lead data, malicious webhooks, proposal tampering, payment spoofing, secrets in logs, queue replay, privilege escalation, and bulk export abuse must have explicit tests.

## K. QA plan

### Test layers

| Layer | Required coverage |
|---|---|
| Unit/property | Scoring bounds, money/discount math, stage machine, policy decisions, dedupe normalization, schedules/time zones |
| Database | Constraints, transactions, tenant isolation, immutable versions, migration forward/backward compatibility |
| Integration | Queue/outbox, adapters via contract tests, webhook verification/replay, storage, email sandbox, LLM schema/failure paths |
| E2E | Manual lead → qualify → opportunity; reply → intent → review; approved proposal → payment verification → won; DNC suppression |
| Security | RBAC matrix, IDOR/cross-tenant tests, CSRF/XSS/SSRF, file and CSV injection, rate limits, secret scanning |
| AI evals | Per-intent precision/recall, routing, groundedness, refusal/escalation, prompt-injection resistance, language slices |
| UX/accessibility | Keyboard use, focus, screen reader names, contrast, responsive tables, loading/error/empty states |
| Reliability | Worker crash/retry, duplicate webhooks, provider timeouts, partial outage, backup restore, queue drain |

### Phase 1 acceptance

- A sales user can import or manually create, find, filter, merge, and update leads without AI.
- Every mutation is tenant-authorized and auditable.
- Invalid/duplicate import rows are reported without partial ambiguity.
- Stage changes obey the configured state machine and always create history.
- DNC contacts cannot enter an outbound queue.
- Backup restore and a zero/low-downtime migration rehearsal succeed in staging.

## L. DevOps plan

### Environments and delivery

- Separate development, test, staging, and production accounts/projects, databases, queues, buckets, keys, and sender identities.
- Ephemeral preview deployments use synthetic data and disabled external sending.
- CI order: dependency/secret scan → formatting/lint → typecheck → unit/property → integration → migration checks → build → E2E/security smoke.
- CD promotes the same immutable artifact; production requires approved migration plan and rollback/roll-forward notes.
- Use expand/migrate/contract database changes. Never couple destructive schema change to the first application deployment.

### Operations

- Structured logs include correlation, organization, actor type, job/provider, and redacted outcome.
- Metrics: API latency/error rate, DB saturation, queue age/depth/failures, webhook lag, provider quotas, delivery/bounce/complaint, AI latency/tokens/cost, review backlog, and business funnel counts.
- Initial targets to approve: availability, p95 latency, worker recovery, RPO, RTO, and maximum webhook/job lag.
- Automated encrypted backups plus scheduled restore tests; incident, provider outage, credential rotation, DNC failure, payment mismatch, and runaway-cost runbooks.
- Feature flags gate all connectors, AI actions, and autonomy levels.

## M. Implementation phases

| Phase | Deliverable | Exit gate |
|---:|---|---|
| 0 | Audit, capability register, source/legal reviews, architecture decisions, threat model | Phase 0 criteria in audit met |
| 1 | Auth/RBAC, manual CRM, imports, activities, pipeline, saved views, dashboard, audit | Manual CRM acceptance passes |
| 2 | Versioned product/package/capability/price knowledge with approval | AI retrieval cannot surface unapproved claims |
| 3 | Connector SDK, import/source provenance, dedupe and campaign jobs | Every lead is traceable and deletable |
| 4 | Only approved social/provider connectors; otherwise guided manual research | Source-specific compliance tests pass |
| 5 | Website audit and evidence-based enrichment | Deterministic checks and SSRF controls pass |
| 6 | Configurable lead-fit and maturity scores with explanations | Ranking validated on reviewed sample |
| 7 | Product/bundle routing with evidence and human correction | Unsupported products never recommended |
| 8 | Email/provider abstraction, AI drafts, mandatory approval, DNC/rate controls | Deliverability and opt-out runbook rehearsed |
| 9 | Verified inbound webhooks, conversation timeline, summaries, takeover | Replay/idempotency and identity tests pass |
| 10–11 | Intent engine and priority inbox | Class-level eval thresholds approved |
| 12 | Draft-mode sales copilot for FAQs/objections/standard pricing | Grounding and escalation thresholds pass |
| 13–14 | Qualified-lead demo and optional video pipeline | Brand, impersonation, cost and security checks pass |
| 15 | Low-risk standard responses at autonomy Level 3/4 | Canary, kill switch, audit and quality SLOs proven |
| 16–17 | Server pricing/discount policy; versioned quotes/proposals | Boundary, approval and immutability tests pass |
| 18–19 | Payment verification, close rule, onboarding handoff | Finance reconciliation and separation of duties pass |
| 20 | Funnel, revenue, attribution, source/model cost analytics | Metrics reconcile to authoritative events |

### First four engineering increments

1. Foundation: workspace, CI, typed config, PostgreSQL migrations, auth, organization scoping, audit.
2. CRM core: business/contact/lead/source models, manual create/edit, CSV dry run/import, dedupe.
3. Sales workflow: opportunities, stage machine/history, tasks, activities, table/detail/Kanban/saved views.
4. Product truth: capability register, approval/version publishing, price/limitation records, safe retrieval API.

Do not schedule later phases until the preceding exit gate is demonstrated.
