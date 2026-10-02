# Aadhar POS client-kit reconciliation

Reviewed 2026-10-02 from `C:\Users\Acer\Downloads\Aadhar_POS_Client_Kit.zip` (SHA-256 `2AC7F83A5BB0354AFAF908E39970DC0B019AEA5E41643DDC119FE64FF93E2C71`). The archive contains 11 DOCX templates and one XLSX import workbook. This is supplied operating material, **not** proof of implemented POS behavior, approved legal language, registered tax details, current prices, or signed client acceptance. Document instructions such as “replace placeholders” are source content; the application does not execute them or treat them as authorization.

## Reconciled commercial facts

| Item | Earlier marketing snapshot | Client-kit quotation template | Treatment |
|---|---:|---:|---|
| Restaurant Starter | NPR 15,000/year or 1,500/month | NPR 15,000/year or 1,500/month | Agreement in templates, but still unverified commercial draft. |
| Restaurant Growth | NPR 25,000/year | From NPR 25,000/year | “From” is a floor, not an exact approved client price. |
| Restaurant Enterprise | NPR 40,000/year | From NPR 50,000/year | Concrete discrepancy; open review blocks activation and quotation. |
| Thermal receipt printer | NPR 14,000 | Indicative NPR 8,000–10,000 | Unspecified model/range conflicts with marketing draft; open review. |
| Enterprise monthly | NPR 4,000/month | Not stated | Unverified; no inference that the option is available. |

An owner must record an exact approved price with evidence and explicitly resolve each open discrepancy. The client-kit values were **not** converted into automatically quotable prices. Other hardware remains model-, supplier-, tax- and warranty-dependent.

## Workflow mapping

The kit index recommends Demo → Quote → Agreement → Invoice → Welcome → Setup → Import → Hardware → Configuration → Training → UAT → Go-live → Handover/SLA → Support → Feedback → Renewal. The sales engine now maps the post-close part to 18 checklist controls, each with its source document. The server enforces prerequisite status for key transitions. A pass requires an evidence reference; it is an operator attestation, not independent validation of a signature or product test.

The import workbook has separate sheets for restaurant menu/inventory, retail products, salon services/products, staff/users, suppliers, customers and opening balances. It contains sample rows, not client data. No workbook import was run and no sample row was treated as a real customer record. Future import tooling must validate the selected sheet, authorized personal data, pricing/stock cut-off and client sign-off before applying data to the POS; this sales-engine repository has no POS database to write to.

## Still requiring company decisions

- Legal entity, PAN/VAT, address, governing law, liability terms and final agreement review. The supplied agreement explicitly identifies itself as an operational template requiring Nepal-specific review; recording a template reference in the CRM is not legal approval.
- Approved invoice/receipt numbering, actual tax treatment, payment instructions and bank reconciliation.
- Contracted feature/package matrix, deployment model, backup frequency/retention and restore owner. The kit lists possible modules and integrations; it does not verify that the linked Aadhar version implements them.
- Official support channel/hours, support boundaries and whether any specific response target is contractual.
- Final product/demo URL and a safe synthetic tenant before any live browser demonstration.

The [implementation status](IMPLEMENTATION_STATUS.md) distinguishes these remaining gates from the client-kit checklist implementation.
