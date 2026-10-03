# Aayatra commercial catalogue

**Source:** `OWNER_APPROVED_POSTER_2026` (owner configuration addendum, 2026-10-03) · **Currency:** NPR · **Negotiable:** yes, by a human only · **Seeded by:** `lib/owner-config.ts` → `applyOwnerConfig()`. It runs on bootstrap, from `npm run db:apply-owner-config`, or via Settings → Company & tax → "Apply owner-approved configuration".

Each record is `catalog_status=ACTIVE`, `verification_status=VERIFIED`, `approval_required=false`, `negotiable=true`, with one active canonical price source. Prices remain editable later through the admin catalogue.

## Restaurant — Aadhar POS

| SKU | Package | Price |
|---|---|---:|
| RESTAURANT_STARTER_YEARLY | Starter | NPR 15,000 / year |
| RESTAURANT_STARTER_MONTHLY | Starter | NPR 1,500 / month |
| RESTAURANT_GROWTH_YEARLY | Growth | NPR 25,000 / year |
| RESTAURANT_GROWTH_MONTHLY | Growth | NPR 2,500 / month |
| RESTAURANT_ENTERPRISE_YEARLY | Enterprise | NPR 40,000 / year |
| RESTAURANT_ENTERPRISE_MONTHLY | Enterprise | NPR 4,000 / month |

The price is approved; the feature list is subject to code verification (see `VERIFIED_PRODUCT_CAPABILITIES.md`). In particular, multi-branch is **not** included until it is re-verified.

## Retail / small business — Aadhar POS

| SKU | Option | Price |
|---|---|---:|
| RETAIL_ONE_TIME_SETUP | One-time setup | NPR 30,000 |
| RETAIL_YEARLY | Yearly plan | NPR 10,000 / year |
| RETAIL_MONTHLY | Monthly plan | NPR 1,000 / month |

Approved offer wording: *"Already have the equipment? Get only our POS system at NPR 1,000/month."*

## Hardware

| SKU | Item | Price |
|---|---|---:|
| HW_THERMAL_PRINTER | Thermal printer | NPR 14,000 |
| HW_THERMAL_LABEL_PRINTER | Thermal + label printer | NPR 20,000 |
| HW_BARCODE_SCANNER | Barcode scanner gun | NPR 8,000 |

## Conflict resolution (§10)

- Older draft prices are kept for audit and marked `SUPERSEDED`, with `superseded_by` pointing to the poster record. They come from the 2026-10-01 marketing snapshot, including the client-kit Enterprise "from NPR 50,000" and the "NPR 8,000–10,000" printer range.
- Their open `COMMERCIAL_PRICE_REVIEW_REQUIRED` discrepancies are resolved with evidence `OWNER_APPROVED_CONFIG_2026-10-03`. An older draft that differs no longer blocks quotation.
- Nothing is deleted. Superseded and retired items cannot be edited.

## Tax (§2, §3, §18)

`AAYATRA_TAX_STATUS = PAN_ONLY`, so the commercial policy is `tax_mode=PAN_ONLY` with rate 0. It is approved as version 1 with evidence `OWNER_APPROVED_CONFIG_2026-10-03`.

Example: Aadhar POS Growth, NPR 25,000. VAT is not separately charged under the current PAN-only company configuration. Grand total: NPR 25,000.

- The quote engine refuses to add VAT unless the company record is `VAT_REGISTERED`. That status requires its own VAT number and a verified VAT document, and it is never inferred from PAN.
- Switching tax status returns the policy to draft for re-approval.
- A PAN-only document is titled "Quotation" or "Invoice", never "Tax Invoice".

## Discount policy (§11)

| Setting | Value |
|---|---|
| PRICE_NEGOTIABLE | true |
| AI_AUTONOMOUS_DISCOUNT | 0 % (`max_auto_discount_bps=0`) |
| default_discount | 0 % |
| manager_discount_limit | 0 % until the owner sets it |
| absolute_price_floor | per item `min_price_minor`, set with evidence |

The AI can say pricing is negotiable, detect a discount request, move the lead to NEGOTIATING and recommend a response. It cannot produce a discounted figure. Every discounted quote needs a manager or owner, an item floor and the approved limit.

## Automatic quotation (§20)

A quote made only of `OWNER_APPROVED_POSTER_2026` items with no discount, under an approved policy, is created as `APPROVED`. It is audited as `QUOTATION_AUTO_APPROVED_STANDARD_PRICE` and snapshots the company identity.

These always need human approval: discount, custom development, special integration, non-standard hardware, custom SLA, Enterprise feature exception, and any multi-branch promise.
