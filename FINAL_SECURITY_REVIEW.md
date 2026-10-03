# Final security review — owner configuration addendum

**Scope:** changes on `claude/aayatra-sales-engine-config-mwqjy6` (migration 020, new APIs, webhook, AI pipeline, demo recorder, uploads). Earlier controls are unchanged: session cookies, same-origin checks on mutations, tenant-scoped foreign keys, append-only histories, DNC enforcement and the SSRF-safe demo host check.

## Findings and controls

| Area | Risk | Control in place | Residual |
|---|---|---|---|
| WhatsApp webhook | Spoofed inbound messages | `X-Hub-Signature-256` HMAC-SHA256 over the raw body with the per-tenant app secret and timing-safe compare. The payload is parsed only to find the tenant; nothing is acted on before verification. 1 MB limit. Unknown phone-number ID → 404. | Meta has no replay timestamp, so replays are deduplicated by `provider_message_id` (unique index). |
| Webhook verify handshake | Token guessing | Timing-safe compare against the env-resolved token; challenge restricted to `[\w-]{1,200}`. | — |
| Secrets | Token leakage via DB or UI | Only env-var **names** are stored (regex-validated); values live in the server environment. The UI warns never to paste tokens. Audit events store references only. | Rotate secrets through your secret manager. |
| Outbound messaging | Unauthorised or over-messaging | Owner/manager approval; contact eligibility; DNC per channel; optional per-contact daily limit; conversation must be OPEN; WhatsApp 24-hour window enforced (templates required outside it). The provider call happens outside the DB transaction and SENT is recorded only with a provider message ID. The simulated provider never marks delivery. | Template messages outside 24 h are not implemented. |
| Prompt injection (Claude layer) | Customer text steering prices, discounts or claims | Persona hard rules; customer text fenced in `<customer_message>` with tag characters neutralised; the server keeps intent, stage, next actions and human review; structured output; guardrails (amounts tied to SKUs, no %, no multi-branch, IRD or payment-receipt claims, no absolute promises); template fallback; LLM text never auto-sent. | Wording-level subtlety still needs a human, which is why approval is mandatory. |
| AI authority | Model mutating critical state | The LLM has no tools and no DB access. Drafts are stored as suggestions; humans queue and approve them. Quote, payment, WON and feature status changes require role-checked APIs. | — |
| Feature claims | Marketing upgraded to "verified" | API rejects poster/brochure/marketing evidence for verified statuses; DB constraints require verifier + approved wording; history is append-only. | Verifier honesty is an organisational control. |
| Tax | Wrongly charging or labelling VAT | DB check: VAT_REGISTERED needs VAT number + document + verifier. Policy API blocks EXCLUSIVE while PAN-only; tax-status change resets policy approval. PAN-only documents never say "Tax Invoice". Production invoices require verified registration data. | — |
| PAN document upload | Malicious file, path traversal, disclosure | Owner-only; same-origin; 5 MB cap; magic-byte check (PDF/PNG/JPEG); stored outside the web root under a content-hash name in a 0700 directory with 0600 files; served nowhere by the app. | Add virus scanning if documents ever come from customers. |
| Demo recorder | SSRF, data mutation, credential leakage | Exact-host allowlist + public-DNS-only check + pinned resolution. Same-origin only; POST allowed solely during synthetic login; mutating steps refused; synthetic-data attestation required before any job; credentials resolved from env refs at run time and never stored. | The recorder trusts the reviewed selectors; review scripts before approval. |
| Source audit tool | Executing untrusted repo code | Reads files only (no install, no build, no execution); skips `node_modules`/`.git`/build output; writes reports only. | — |
| Inbound lead creation | Junk or abusive leads | Created only after signature verification; source provenance recorded; dedupe on message ID. | Consider rate-limiting per sender at the edge. |
| Bank details | Exposure to low-privilege users | Bank details are masked for non-owner/manager roles in the company API; audit logs store "[set]" rather than the value. | — |
| Dependencies | Supply chain | One new runtime dependency: `@anthropic-ai/sdk` 0.131. `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities. | — |

## Recommendations before production

1. Run behind HTTPS, set `APP_ORIGIN` to the public origin, and keep `ALLOW_TEST_WEBHOOKS=false` and `MESSAGING_TEST_PROVIDER=false`.
2. Restrict `/api/webhooks/whatsapp` to Meta's published egress ranges at the reverse proxy, if your host supports it.
3. Back up `storage/documents` with the database, and encrypt the volume at rest.
4. Do a short paid red-team pass of the Claude layer (prompt-injection phrasing in Nepali and English) before enabling it for staff.
