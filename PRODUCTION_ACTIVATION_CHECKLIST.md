# Production activation checklist

These are the only remaining items, and all are external. Company identity, PAN-only tax status, poster pricing, the discount policy and the restaurant source designation are **confirmed** and already configured. Each item says where it goes and what turns on when it's done.

| # | External item | Where to enter it | What it unlocks |
|---:|---|---|---|
| 1 | **PAN number + PAN registration document** | Settings → Company & tax: enter the 9-digit PAN, upload the document, then "Mark verified" with evidence | PAN shown on quotations and in AI replies; production invoices (together with item 2) |
| 2 | **Full registered address, registered name, authorized signatory, legal email** | Same panel | `invoiceReadiness` → ready; legal/tax invoice printing in production |
| 3 | **Restaurant demo URL + synthetic login** (and retail/hotel/salon when ready) | `.env` (`AADHAR_RESTAURANT_DEMO_URL`, …, plus the host in `DEMO_ALLOWED_HOSTS`; username/password values under env names) → Settings → Demo applications: secret refs, selectors (`usernameSelector`, `passwordSelector`, `submitSelector`, optional `successSelector`), synthetic-data attestation | Health check → navigation verification → generated script → review → SCRIPT_TEST → VIDEO (MP4 + subtitles). AI replies start including the reviewed demo link. |
| 4 | **dimsum source access** — attach `sushantdkl/dimsum` to a session, or provide a local checkout | `npm run audit:source -- /path/to/dimsum`, then update each feature in Settings → Feature claims with source, test and demo evidence | AI and demo scripts can describe verified features instead of saying "let me confirm" |
| 5 | **WhatsApp Cloud API credentials**: phone number ID, WABA ID, access token, app secret, webhook verify token | Values in the server environment; names in Settings → WhatsApp; callback URL `https://<your-domain>/api/webhooks/whatsapp` in Meta | Real inbound capture and delivery of approved replies (status flips from NOT_CONFIGURED to CONFIGURED) |
| 6 | **Email provider credentials** (if email outreach is wanted) | Not yet wired; uses the same `OutboundProvider` interface | Email sending (stays NOT_CONFIGURED until then) |
| 7 | **Payment and bank production details** (account and QR to send customers) | Company panel → bank details; payment requests use MANUAL_BANK / MANUAL_QR / CASH | Staff can send official payment instructions; verification stays human |
| 8 | **Final legal / SLA wording approval** | Settings → Company & tax → "Record legal approval" with evidence | `legal_status=APPROVED`; agreements and support terms can be cited. Until then the AI never states SLA terms. |
| 9 | *(Optional)* **Anthropic API key** for Claude-worded drafts | `.env`: `AI_REPLY_PROVIDER=anthropic`, `ANTHROPIC_API_KEY` | More natural replies to unseen phrasing; same guardrails, human approval unchanged |
| 10 | *(Optional, owner decision)* **Discount limits** | Settings → Tax & sales limits (manager limit, default discount) + item floors in the catalogue | Managers can approve discounted quotes; AI autonomous discount stays 0 % unless explicitly changed |

## Go-live steps once items 1–5 are in

1. `npm run db:migrate && npm run db:apply-owner-config` on the production database (idempotent).
2. Set `APP_ORIGIN`, keep `ALLOW_TEST_WEBHOOKS=false` and `MESSAGING_TEST_PROVIDER=false`.
3. Schedule `npm run follow-up:worker` (hourly) and `npm run demo:worker` (every few minutes).
4. Send one WhatsApp message from a staff phone to the business number. Confirm the inbox shows it with a suggested reply. Queue the reply, approve it, and confirm delivery and read statuses.
5. Turn on Settings → Automation controls only as far as you're comfortable. Replies are drafted (ASSISTED) by default; nothing sends without manager approval.
