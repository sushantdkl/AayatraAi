# Aayatra verified product capability matrix

**As of:** 2026-10-03 (owner configuration addendum)
**Live register:** Settings → Feature claims (`product_features` table, append-only history in `product_feature_history`). This file describes the seeded state and the rules; the database is authoritative.

## What changed with the addendum

- Company identity, PAN-only tax status and poster **prices** are confirmed by the owner.
- Poster **feature claims are not**. Each sellable feature still needs source, test and live-demo evidence.
- The actual restaurant source is the `dimsum` repository (Next.js 16, React 19, Node 22, PostgreSQL). The archive could not be uploaded (30 MB limit) and this session was not permitted to attach `sushantdkl/dimsum`, so **it has not been inspected here**. The source-audit tool below is ready to run on it.

## Status vocabulary and AI policy (§16)

| Implementation status | Seller / AI behaviour | Default commercial status |
|---|---|---|
| `VERIFIED_AVAILABLE` | Sell normally using the approved wording | SELLABLE |
| `AVAILABLE_WITH_CONFIGURATION` | Sell and explain the conditions | SELLABLE |
| `PARTIAL` | Disclose the limitation; human review | SELL_WITH_DISCLOSURE |
| `BETA` | Never promise as a standard production feature; human | REVIEW_REQUIRED |
| `PLANNED` | Never represent as available now | NOT_SALES_SAFE |
| `CUSTOM_ONLY` | Technical/commercial review | REVIEW_REQUIRED |
| `NOT_AVAILABLE` | Say it is unavailable | NOT_SALES_SAFE |
| `UNKNOWN` | Do not guess: "let me confirm with the product team" | REVIEW_REQUIRED |

Database guards: `VERIFIED_AVAILABLE`/`AVAILABLE_WITH_CONFIGURATION` require `verified_by`, `verified_at` and approved wording; `SELLABLE` requires one of those two statuses. The API rejects any evidence that cites a poster, brochure or marketing material as verification.

## Seeded restaurant matrix (dimsum: Aadhar Restaurant POS/ERP)

| Feature | Seeded status | Evidence recorded |
|---|---|---|
| POS, orders, billing, KOT, tables, reservations, online orders | UNKNOWN | Owner reports code evidence in dimsum; not audited in this environment |
| Inventory, inventory movements, purchases, suppliers/AP, customers/AR, expenses | UNKNOWN | Same |
| Cash book, business days, cash drawer, bank/reconciliation, accounting/GL | UNKNOWN | Same |
| Reports/analytics, employees/HR, payroll, public website/menu/reviews | UNKNOWN | Same |
| Offline mode, eSewa/Khalti/FonePay, mobile app | UNKNOWN | No evidence supplied |
| **Multi-branch operation** | **NOT_AVAILABLE · NOT_SALES_SAFE** | Repository audit: no complete multi-tenant / `branch_id` model; future work. The Enterprise poster does not override this. |
| **"IRD-approved / certified software" claim** | **NOT_AVAILABLE · NOT_SALES_SAFE** | No official software approval document. Company PAN registration is not product certification. |

Retail (billing, barcode, inventory, customers, reports): UNKNOWN, no source supplied. Hotel, combined hotel + restaurant, The Haircut, websites, ecommerce, AI and custom work are company capabilities. The AI describes them only in general terms and always routes scope and price to a person.

## How a feature becomes sellable

1. Run the source audit on the dimsum checkout: `npm run audit:source -- /path/to/dimsum`. It scans `app/**/route.ts`, pages, `migrations/*.sql`, tests and `AADHAR_RESTAURANT_PRODUCT_AUDIT.md`. It writes `reports/SOURCE_AUDIT.md` and `reports/source-audit.json`.
   - A feature with routes, schema and tests gets a **PARTIAL proposal**. Routes alone stay UNKNOWN, because route existence is not proof.
   - Multi-branch is re-proposed only if a real branch model appears and the audit no longer calls it future work.
   - The tool never writes to the database.
2. Configure the live demo URL. Run the health check (navigation verification), then build a script from that navigation (Demos → generated script). The script builder only includes verified, conditional or partial features that actually appear in the live navigation.
3. An owner or product approver records evidence such as source path, test name and demo job ID, plus approved customer wording, in Settings → Feature claims. Every change is appended to history.
4. From that moment the AI reply engine, the demo script builder and the LLM grounding facts use the new status automatically.
