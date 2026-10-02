# Aayatra Verified Product Capability Matrix

**As of:** 2026-10-01  
**Verification result:** No capability is currently verified from repository evidence.

## Status vocabulary

| Status | Meaning | May AI sell it? |
|---|---|---|
| `VERIFIED` | Demonstrated in the named released version and approved by a product owner | Yes, within recorded limitations |
| `OPTIONAL` | Available through an approved module or package with known price/requirements | Only as an option |
| `BETA` | Implemented but not generally committed | Only with explicit human approval |
| `PLANNED` | Roadmap item, not implemented | No |
| `CUSTOM_REVIEW` | Feasibility, price, and schedule require review | No promise; escalate |
| `UNSUPPORTED` | Explicitly unavailable | No |
| `UNVERIFIED` | Mentioned without implementation evidence | No |

`UNVERIFIED` is deliberately different from `UNSUPPORTED`. It protects the company from false claims while product discovery is incomplete.

## Portfolio-level result

| Product family | Prompt-stated capability areas | Verified today | Sales rule |
|---|---|---:|---|
| Aadhar Restaurant Management | POS, KOT/kitchen, tables, payments, reservations, inventory, purchasing, accounting, reporting, permissions, local/offline options, website/ordering | 0 | Discovery only; do not claim individual features |
| Hotel Management | Rooms, reservations, check-in/out, folios, housekeeping, reporting, website/direct booking, restaurant/banquet links | 0 | Discovery only |
| Combined Hotel + Restaurant | Unified guest/restaurant workflows, room posting, inventory/accounting/reporting, booking, room service, banquet | 0 | Treat as an offer hypothesis, not a released integration |
| Aadhar Retail ERP | POS, catalogue/variants/barcodes, pricing, stock, purchasing, suppliers, receivables, accounting, ecommerce, CRM | 0 | Discovery only |
| The Haircut | Billing, queue, customers, appointments, stock, expenses, reporting, loyalty, membership, booking, HR | 0 | Discovery only |
| Business Websites | Design/redesign, mobile, SEO basics, catalogue, booking, ordering, integrations | 0 | Scope and quote require review |
| Ecommerce | Storefront, catalogue, inventory, customer workspace, payments/courier integrations | 0 | Scope and quote require review |
| AI & Automation | Assistants, workflow/reporting automation, integrations, agents | 0 | Custom review mandatory |
| Custom Software | Bespoke software and integrations | 0 standardized | Architecture, delivery, and commercial review mandatory |

## Verification register template

Each row must be completed for every capability before it becomes available to the sales agent.

| Field | Required content |
|---|---|
| Product / capability ID | Stable machine-readable identifiers |
| Customer-facing name | Approved wording |
| Status | One controlled value above |
| Product version | Exact release/build or hosted release date |
| Deployment modes | Cloud, on-premises, local network, offline behavior |
| Preconditions | Hardware, licenses, connectivity, integrations, configuration |
| Limitations | Scale, workflow, geography, browser/device, unsupported cases |
| Evidence | Test case, demo URL, release note, manual, or production proof |
| Evidence owner | Accountable product/engineering owner |
| Commercial package | Package/SKU and approved price reference |
| Support commitment | SLA/support/training/migration terms |
| Approved language | What sales may say |
| Prohibited language | Claims sales must not make |
| Last verified / expires | Review dates |

## Minimum verification test packs

### Restaurant

Verify end-to-end: order → KOT/kitchen → bill → split/settlement → business-day close; table transfer/merge; stock movement and costing; purchase/payable flow; audit/permissions; offline/local behavior and recovery; accounting journal behavior; supported reports; reservation/QR/online-ordering boundaries.

### Hotel

Verify: availability → reservation → check-in → folio charges → payment → check-out; room status/housekeeping; guest history and permissions; direct booking behavior; cancellation/no-show/overbooking controls; accounting/reporting; multi-property status; restaurant, room-service, and banquet boundaries.

### Combined hotel + restaurant

Verify: restaurant charge posted to the correct occupied room/folio; void/reversal; tax/service-charge behavior; guest identity; shared vs separate inventory; consolidated close and reporting; failure/retry behavior; permissions across departments.

### Retail ERP

Verify: product/variant/barcode → purchase/receipt → valuation → sale/return → stock and journals; promotions and multiple prices; credit/collection; batch/serial/quarantine boundaries; ecommerce stock synchronization; multi-store status; reports and permissions.

### Salon

Verify: booking/queue → service assignment → bill/payment → loyalty/package consumption; cancellation/no-show; staff commissions if claimed; stock/expense/day close; online booking; CRM consent and messaging; memberships/subscriptions and expiry.

### Websites, ecommerce, AI, automation, and custom work

Verify using a scope-specific acceptance checklist. Never convert a previous custom delivery into a reusable product claim without product-owner approval.

## Runtime sales guardrail

Only an immutable, published product-knowledge version may be used to draft customer-facing text. Retrieval must filter to `VERIFIED` and eligible `OPTIONAL` facts. `BETA`, `PLANNED`, `CUSTOM_REVIEW`, `UNSUPPORTED`, and `UNVERIFIED` facts must either be excluded or trigger an explicit human escalation. A product owner—not an LLM—publishes knowledge versions.

## Immediate product-owner checklist

1. Name the current production version of each product.
2. Attach manuals, release notes, test environments, and known-issue lists.
3. Demonstrate the minimum test packs above.
4. Record supported deployment, hardware, migration, training, and support options.
5. Approve packages, add-ons, prices, taxes, timelines, and prohibited claims.
6. Sign and publish capability register version 1 before outbound sales begins.

