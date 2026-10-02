# Aayatra AI Sales Engine — Risk Register

**Reviewed:** 2026-10-01  
**Scale:** Likelihood (L) and Impact (I) from 1–5; inherent score = L × I. Residual risk must be reassessed after controls are tested.

## N. Risk Register

| ID | Risk | L | I | Score | Required controls | Owner | Release gate / indicator |
|---|---|---:|---:|---:|---|---|---|
| R01 | AI hallucinates product, price, timeline, integration, or legal claim | 4 | 5 | 20 | Published capability-only retrieval; evidence citations; schema validation; prohibited-claim evals; human approval | Product + AI | Zero unsupported claims in critical eval set before customer drafts |
| R02 | Bad outreach harms Aayatra's brand | 4 | 5 | 20 | Human-approved pilot; verified observations only; template QA; frequency cap; tone/segment review; kill switch | Sales | Complaint/negative-reply thresholds defined and monitored |
| R03 | Spam reputation or sender blocking | 4 | 5 | 20 | Separate sender domain/stream; SPF/DKIM/DMARC; list hygiene; bounce/complaint suppression; ramp limits; postmaster monitoring | Growth Ops | Authentication passes; stop automatically on threshold breach |
| R04 | Platform/API terms violated by scraping or repurposing data | 4 | 5 | 20 | Connector approval record; official/licensed access; terms snapshots; no browser/session scraping; disable on expiry/change | Legal + Data | Written approval before connector enablement |
| R05 | Privacy violation or unauthorized personal-data use | 4 | 5 | 20 | Data minimization; purpose/source/retention; notice and rights workflow; access/export controls; DNC; counsel review | Privacy owner | DPIA/legal review and deletion test complete |
| R06 | Cross-tenant exposure or privilege escalation | 3 | 5 | 15 | Server-derived tenant; object authorization; RBAC; database defense in depth; IDOR tests; export approval | Security | Authorization matrix and cross-tenant suite pass |
| R07 | Prompt injection causes data disclosure or unsafe action | 4 | 5 | 20 | Untrusted-content isolation; no secrets in prompts; typed tools; independent authorization/policy; injection evals | AI + Security | No critical bypass in adversarial suite |
| R08 | Credentials leak through code, frontend, logs, prompts, or exports | 3 | 5 | 15 | Managed secrets; secret scanning; redaction; scoped/rotated tokens; browser/server boundary; incident runbook | Platform | Secret scan clean and rotation drill passed |
| R09 | Wrong lead/intent classification hides or mistreats prospects | 4 | 4 | 16 | Separate fit/intent; confidence/evidence; per-class evals; correction UI; human review; drift monitoring | Sales Ops + AI | Thresholds and correction SLA approved |
| R10 | AI grants excessive discount or commercial commitment | 3 | 5 | 15 | Server-side price floor; immutable price version; approval workflow; separation of duties; boundary tests | Commercial | Cannot bypass price policy in API/E2E tests |
| R11 | Deal marked won without valid acceptance/payment | 3 | 5 | 15 | Explicit state machine; proposal acceptance evidence; verified append-only payment events; finance reconciliation | Finance | Close invariant enforced at DB/service layer |
| R12 | Payment webhook spoof/replay or reconciliation error | 3 | 5 | 15 | Raw-body signature/time verification; unique event ID; idempotency; provider reconciliation; manual exception queue | Finance + Security | Replay/spoof/partial-failure tests pass |
| R13 | Source data is stale, duplicated, incorrect, or misattributed | 5 | 3 | 15 | Provider IDs; normalized identity; merge review; observed/expiry times; confidence; revalidation; correction provenance | Data | Quality dashboard and sample audit meet thresholds |
| R14 | Social engagement is mistaken for buying intent or budget | 4 | 4 | 16 | Engagement informs fit only; intent comes from prospect actions; wording labels inference; cohort validation | Sales Ops | No public signal directly increments buying intent |
| R15 | Social/platform data access changes or disappears | 4 | 4 | 16 | Adapter boundary; multi-source strategy; connector flags; graceful degradation; manual import path; terms review cadence | Data Platform | Removal of one provider does not break CRM |
| R16 | Vendor dependency, outage, quota, or price change | 4 | 4 | 16 | Provider abstraction; quotas/budgets; circuit breaker; fallback/manual path; exportability; vendor exit plan | Platform | Provider outage drill and cost alerts pass |
| R17 | LLM/provider cost becomes uneconomic | 4 | 3 | 12 | Deterministic-first processing; tiered models; caching where lawful; per-job/tenant budget; cost ledger; demo threshold | Product + Finance | Cost per qualified lead/proposal visible before scaling |
| R18 | Website audit enables SSRF, malware, or resource exhaustion | 3 | 5 | 15 | Isolated workers; DNS/IP checks; private-network block; redirect/byte/time caps; sandboxed browser; egress policy | Security | SSRF corpus and resource-limit tests pass |
| R19 | Webhook/queue duplication sends duplicate messages or actions | 4 | 4 | 16 | Transactional outbox; unique idempotency keys; receipt dedupe; state re-check; bounded retries; dead-letter review | Platform | Duplicate/reorder/worker-crash tests pass |
| R20 | Imported CSV/file triggers formula injection, XSS, or malware | 3 | 4 | 12 | Type/size scan; parsing limits; neutralize formula cells on export; encode display; reject active content | Security | Malicious fixture suite passes |
| R21 | Product capability evidence becomes outdated | 4 | 4 | 16 | Owner and expiry per fact; immutable published versions; scheduled review; automatic withdrawal on expiry | Product | Expired facts unavailable to generation |
| R22 | Sales demand exceeds implementation/support capacity | 3 | 5 | 15 | Capacity-aware package availability; delivery approval for large/custom deals; onboarding WIP limits | Operations | No proposal date beyond approved capacity |
| R23 | Custom scope is sold as standard, causing delivery/margin failure | 4 | 5 | 20 | `CUSTOM_REVIEW`; scope checklist; architecture/commercial approval; explicit proposal assumptions/exclusions | Delivery + Commercial | Custom dependency always creates escalation |
| R24 | Data deletion conflicts with audit, legal hold, or provider terms | 3 | 4 | 12 | Data classification; retention matrix; tombstone/anonymization design; legal holds; source cascade map | Privacy + Legal | Deletion rehearsal produces auditable report |
| R25 | Business metrics are misleading due to attribution or stage gaming | 4 | 3 | 12 | Authoritative event definitions; immutable stage history; dedupe; finance-reconciled revenue; metric contracts | Analytics | Dashboard reconciles to sampled source events |
| R26 | Insufficient backups or unsafe migration causes data loss | 3 | 5 | 15 | Encrypted backups; point-in-time recovery; restore drills; expand/contract migrations; rollback/roll-forward plans | Platform | Staging restore and migration rehearsal pass |
| R27 | Autonomous behavior expands without evidence or oversight | 3 | 5 | 15 | Explicit autonomy level per action; feature flags; approval ledger; canary; quality SLO; kill switches | Executive owner | Promotion record signed; rollback tested |
| R28 | Multilingual messages are misunderstood or culturally inappropriate | 3 | 4 | 12 | Nepali/English/romanized test set; human review; language confidence; avoid machine-translated legal/commercial terms | Sales + AI | Language-slice thresholds and review path pass |
| R29 | Security incident or angry prospect is mishandled by AI | 3 | 5 | 15 | Intent triggers immediate human escalation; no argumentative automation; incident/takeover SLA; full transcript audit | Support + Security | Escalation E2E tests pass |
| R30 | No commercially useful market fit despite technically correct system | 3 | 5 | 15 | Small cohorts; manual CRM first; revenue funnel and cost measurement; stop criteria; avoid premature connector/demo work | Product | Phase funding tied to validated funnel evidence |

## Risk treatment rules

- Any open risk with impact 5 requires a named accountable owner before related functionality enters production.
- Scores 16–25 require tested preventive controls and a live detection/kill mechanism.
- Legal review cannot be replaced by an LLM or this document.
- A risk is not closed because a design mentions a control; attach a test, runbook, approval, or operational metric.
- Reassess after every provider, model, prompt, price-book, autonomy-level, or material legal/terms change.

## Initial release blockers

The first production CRM is blocked by R05, R06, R08, R19, R20, R24, and R26 until their Phase 1 controls pass. External lead discovery is additionally blocked by R04, R13, R15, and R18. Outbound sending is additionally blocked by R02, R03, and channel-specific approval. AI customer-facing drafts are additionally blocked by R01, R07, R09, R21, and R28. Proposal/payment/close is blocked by R10–R12 and R23.

## Review cadence

- Weekly during implementation and pilots.
- Before each phase exit and production release.
- Within one business day of a provider-policy change, security incident, complaint spike, incorrect commercial commitment, payment discrepancy, or critical AI-evaluation regression.
- Quarterly after stable production, while keeping incident-triggered reviews.
