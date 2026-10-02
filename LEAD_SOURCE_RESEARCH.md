# Aayatra AI Sales Engine — Lead and Social Source Strategy

**Research date:** 2026-10-01  
**Decision:** No source is production-approved by this document alone. Each connector requires legal/commercial review and a source record before activation.

## E. Lead source strategy

### Recommended launch order

1. Existing Aayatra contacts with documented purpose and current contact eligibility.
2. Inbound enquiries, referrals, events, and user-entered/manual research.
3. Customer-supplied CSV with provenance, authority, dry run, dedupe, and deletion support.
4. Public registries/directories for targeted verification under their interface/terms—not automated extraction unless explicitly authorized.
5. Licensed B2B or industry data after contract, provenance, accuracy, use, retention, suppression, and deletion review.
6. Official APIs only for documented approved use cases.

### Source assessment

| Source | Feasibility | Initial use | Key constraint |
|---|---|---|---|
| Inbound/referral/manual | High | Primary | Record provenance and contact preference |
| Existing CRM/customer lists | High with review | Primary | Purpose compatibility, freshness, DNC reconciliation |
| CSV import | High | Primary | Authority, schema validation, formula injection, duplicates, provenance |
| OCR public portal | Manual/targeted | Company verification | CAPTCHA/interface signals no assumed bulk API permission; registration ≠ active lead |
| IRD PAN search | Manual/targeted | Verification when justified | Do not automate or repurpose tax data without authority |
| Google Places API | Technically viable | Geographic/category discovery and on-demand details | Most content has caching/storage and attribution restrictions; field costs and quotas |
| OpenStreetMap | Viable with license design | Seed geography/categories | ODbL attribution and share-alike/database obligations; incomplete/variable data |
| Public business websites | Conditional | Evidence-based audit/enrichment | Site terms, robots, rate limits, copyright, privacy, SSRF and accuracy |
| Tourism/trade associations | Conditional | Sector seed lists | Obtain license/permission and refresh/deletion terms |
| Licensed data provider | Conditional | Scaled discovery | Contract must allow CRM storage and outreach use in Nepal |

Google's [Places API overview](https://developers.google.com/maps/documentation/places/web-service/overview) supports text/nearby search and details. Its [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies) prohibit general prefetch/caching/storage beyond exceptions and impose attribution requirements; [place IDs](https://developers.google.com/maps/documentation/places/web-service/place-id) are a notable storable exception and should be refreshed when stale. Design the adapter to store internal observations only when the terms permit them, retain the provider reference and retrieval time, and re-fetch display data when required.

For OpenStreetMap, review the current [copyright and ODbL attribution requirements](https://www.openstreetmap.org/copyright) with counsel before combining data into a proprietary lead database.

## F. Social source strategy

| Platform | Official-access reality | Discovery decision |
|---|---|---|
| Instagram | Meta's Instagram API manages professional Business/Creator presence; it does not access consumer accounts. Business Discovery is username-based and permission/app-review dependent, not a general unrestricted category crawler. | No scraping. Consider narrowly after Meta app review and a documented permitted use; manual public URL research meanwhile. |
| Facebook | Public Page content access requires appropriate permissions/features and app review; access and fields can change. | No scraping or session automation. Use approved Page/API access, licensed provider, or manual research. |
| TikTok | The official [Research API](https://developers.tiktok.com/products/research-api/) is for eligible public-interest researchers in listed regions and excludes commercial use; its [FAQ](https://developers.tiktok.com/docs/en/research-api-faq) says commercial users are ineligible. Display/content APIs concern authorized accounts/content, not broad sales discovery. | Not an automated commercial discovery source. Accept user-supplied profile URLs and manual observations; revisit only if TikTok offers an applicable approved commercial product. |
| YouTube | Data API can search public resources but quotas and developer policies apply; comments/engagement are weak business-contact evidence. | Optional research signal after policy review; never harvest personal commenters as leads. |
| Pinterest | API access is oriented toward authorized accounts/content and business integrations, not assumed general merchant harvesting. | Manual URL evidence or licensed/approved access only. |
| Kwai | No verified official commercial business-discovery API or acceptable license was established in this audit. | Disabled by default; manual evidence only until written approval. |
| Link-in-bio pages | Public page may expose business links but terms and privacy still apply. | Targeted manual/low-rate audit after terms review; store only necessary business observations. |

Meta's published [Instagram API collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api) states that the API is for Instagram professionals and cannot access consumer accounts. Meta has also stated that Page Public Content Access requires [feature permissions obtained through app review](https://about.fb.com/news/2018/07/a-platform-update/). These boundaries make social platforms enrichment targets only when access is clearly authorized, not the system's foundational lead source.

## Messaging channels are separate from discovery

Finding a public business profile or phone/email does not automatically authorize outreach. Maintain separate records for source permission, contact provenance, channel eligibility/consent, purpose, last verification, opt-out, and DNC.

### Email

Start with low-volume, human-approved, relevant B2B outreach after legal review. Authenticate the sending domain with SPF/DKIM/DMARC, segregate marketing and transactional traffic, include a clear identity and easy opt-out, suppress immediately, and monitor delivery, bounce, complaint, reply, and opt-out rates. Google's Postmaster compliance model includes SPF/DKIM/DMARC, spam-rate, one-click unsubscribe, and unsubscribe-honoring checks; see the [Postmaster compliance reference](https://developers.google.com/workspace/gmail/postmaster/reference/rest/v2/domains/getComplianceStatus). Yahoo documents authentication, low complaint rates, and bulk-sender unsubscribe requirements in its [sender best practices](https://senders.yahooinc.com/best-practices/).

### WhatsApp, SMS and social DMs

Disable cold automation by default. Enable only through an approved provider/use case after counsel confirms consent and local requirements, templates/accounts pass provider approval, opt-out and frequency policies are implemented, and a human-reviewed pilot succeeds. A public number is not treated as consent. Do not automate browser sessions or personal accounts.

### Calls

Use as a manual activity initially. Record business purpose, outcome, requested follow-up, time-zone/quiet-hour rules, and DNC immediately.

## Connector approval record

Every connector must have:

```text
provider and version
business owner + technical owner
contract/terms URLs and review date
permitted purpose and geography
allowed fields, storage, derivation and display
retention, refresh and deletion rules
contact/outreach limitations
rate/quota/cost limits
required attribution
credentials/scopes
data-subject and provider deletion process
quality expectations
failure/disable procedure
approval status and expiry date
```

The worker refuses to run an expired or unapproved connector.

## Source adapter contract

An adapter returns normalized candidates plus provenance; it never creates sendable contacts by itself. Required fields include provider, provider reference, acquired/observed times, terms version, license/retention class, raw-content hash, field-level evidence, confidence, and expiration. Import then performs validation, dedupe, contact-policy evaluation, and human review.

## Production launch gates

- Written source approval and documented terms snapshot.
- Privacy notice, deletion/rectification workflow, retention job, and DNC suppression tested.
- No private content, private messages, sensitive traits, or personal commenters used as lead data.
- Quota, cost, attribution, data-aging, and provider-disable controls implemented.
- Seed sample audited for accuracy, duplicates, active-business rate, and contact appropriateness.
- Outreach is independently approved for the intended channel; discovery approval alone is insufficient.
