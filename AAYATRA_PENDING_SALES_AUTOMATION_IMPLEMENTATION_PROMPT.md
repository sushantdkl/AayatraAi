# AAYATRA AI SALES ENGINE — CONTINUATION IMPLEMENTATION PROMPT
## Outreach, Inbound Conversations, AI Sales Assistant, Automated Live Demos, Proposals, Payments, Closing & Onboarding

**Company:** Aayatra Enterprises  
**Primary initial product:** Aadhar POS / Aadhar Business Systems  
**Use together with:** `AAYATRA_AI_SALES_ENGINE_FINAL_MASTER_PROMPT.md`

---

# 0. YOUR ROLE

Act as the combined senior engineering, architecture, business-analysis, sales-operations, QA, security, DevOps, AI, CRM, and product team.

Operate with the judgment expected from a highly experienced senior team.

Do not behave like a prototype generator.

Do not create fake integrations, fake delivery states, fake customers, fake payment success, fake website visits, or fake AI confidence.

Do not repeatedly stop to ask for approval after every implementation phase.

The user has authorized continued implementation of the approved plan.

Proceed phase-by-phase and document what was completed.

Only stop or clearly mark a blocker when work genuinely requires something that is not currently available, such as:

- production credentials
- external provider access
- a real messaging account
- the final live demo URL
- payment gateway credentials
- an irreversible production operation
- an unverified legal/commercial decision

When blocked by one of these, **build the complete abstraction, UI, database, queue, validation, test adapter, and configuration point now** so the missing value can be inserted later without redesigning the system.

---

# 1. CURRENT STATE

Assume the Aayatra AI Sales Engine already has some partial implementation around:

- product knowledge
- lead discovery
- enrichment
- opportunity/product routing
- lead scoring
- analytics

These areas may still be incomplete and must be audited rather than assumed finished.

The major pending capabilities are:

1. outbound outreach
2. inbound conversations
3. intelligent intent classification
4. priority lead separation
5. AI sales assistant
6. controlled autonomous responses
7. automated personalized demos
8. live website/application demonstration
9. demo video generation
10. quotation generation
11. proposal generation
12. negotiation controls
13. payment request / confirmation
14. closing
15. client onboarding
16. implementation handoff
17. sales-to-support lifecycle

The goal is to implement these professionally while preserving and improving all existing work.

---

# 2. SOURCE-OF-TRUTH HIERARCHY

Use this order when deciding what the AI is allowed to claim or sell.

## Priority 1 — Verified Product Behavior

Actual implemented behavior observed in:

- repository
- migrations
- APIs
- tests
- current deployed application
- verified product documentation

This is the strongest source of truth.

## Priority 2 — Aadhar Client Kit

The supplied client kit provides the operating lifecycle and commercial-document structure.

Use it for:

- quotation flow
- service agreement flow
- onboarding
- client setup
- hardware readiness
- implementation
- training
- UAT
- go-live
- handover
- SLA/support
- invoicing/receipt
- customer feedback

## Priority 3 — Current Marketing Material

The provided Aadhar POS posters are temporary sales/marketing references.

They may be used to populate a **configurable draft commercial catalogue**, but they are not allowed to override verified product behavior.

## Priority 4 — Placeholder / Unknown

If a feature, price, URL, commercial term, integration, legal requirement, or deployment capability is not verified:

```text
status = NEEDS_VERIFICATION
```

Do not invent it.

---

# 3. CRITICAL COMMERCIAL RULE

Do not hardcode current poster pricing into application logic.

Create admin-manageable commercial configuration.

Every package / hardware item should support:

```text
id
product_family
name
billing_type
price
currency
billing_period
is_active
effective_from
effective_to
approval_required
negotiable
source
verification_status
notes
```

The UI should clearly support:

```text
DRAFT
VERIFIED
ACTIVE
RETIRED
```

Only ACTIVE + VERIFIED commercial records may be quoted automatically without human approval.

---

# 4. TEMPORARY MARKETING SNAPSHOT — RETAIL / SMALL BUSINESS

Use the following supplied poster information only as initial configurable marketing data.

## Aadhar POS — Retail & Small Businesses

Positioning:

> POS for Retail & Small Businesses

Current marketing messages include:

- affordable software and hardware options for shops in Nepal
- fast billing
- easy inventory
- retail-friendly
- affordable

Visible POS functions include:

- Dashboard
- Sales / New Sale
- Products
- Inventory
- Customers
- Reports
- Settings

Example poster sales screen demonstrates:

```text
Product
Qty
Price
Total
Subtotal
Discount
Total
```

## Temporary Retail Commercial Options

```text
One-Time Setup:
NPR 30,000

Yearly Plan:
NPR 10,000 / year

Monthly Plan:
NPR 1,000 / month
```

Poster also communicates:

> Already have the equipment? Get only the POS system at the lowest rate: NPR 1,000/month.

Treat this as a marketing snapshot, not an immutable rule.

---

# 5. TEMPORARY RETAIL HARDWARE SNAPSHOT

Current poster values:

```text
Thermal + Label Printer:
NPR 20,000

Thermal Printer:
NPR 14,000

Barcode Scanner Gun:
NPR 8,000
```

The poster states pricing is negotiable.

Important:

These values must be stored in configurable hardware-price records.

Do not hardcode them.

If separate client-kit or procurement records conflict, flag:

```text
COMMERCIAL_PRICE_REVIEW_REQUIRED
```

before allowing fully autonomous quotation.

---

# 6. TEMPORARY RESTAURANT MARKETING SNAPSHOT

Current Aadhar restaurant positioning includes:

> Run Your Business Faster, Smarter, Together

> A complete POS solution for billing, inventory, accounting, online ordering, staff management and more.

Current poster highlights capability areas such as:

- Billing & KOT
- Inventory & Purchasing
- Accounting & Reports
- Online Ordering & Website
- Staff Management
- Multi-Device & Cloud Backup

Treat these as marketing statements that must be mapped to verified product capabilities.

---

# 7. TEMPORARY RESTAURANT PACKAGE SNAPSHOT

## Starter

Poster price:

```text
NPR 15,000 / year
or
NPR 1,500 / month
```

Poster describes:

- complete POS billing
- dine-in
- takeaway
- pickup
- delivery
- table management
- KOT
- menu
- categories
- add-ons
- customer records
- basic reports
- up to 5 staff users
- up to 20 tables
- 1 branch
- website included

Before autonomous selling, verify each capability and package limit against the actual product.

---

## Growth

Poster price:

```text
NPR 25,000 / year
or
NPR 2,500 / month
```

Poster describes:

- everything in Starter
- inventory & purchasing
- recipe & food costing
- expense management
- reservations
- delivery management
- full accounting
- P&L
- balance sheet
- IRD/CRM-ready workflow
- up to 20 staff users
- up to 50 tables

Any IRD, accounting, CRM, or statutory claim must only be used exactly as verified.

Never imply government certification unless such certification actually exists and is documented.

---

## Enterprise

Poster price:

```text
NPR 40,000 / year
or
NPR 4,000 / month
```

Poster describes:

- everything in Growth
- multi-branch management
- HR
- attendance
- payroll
- advanced reporting
- advanced controls
- premium support
- future multi-branch entitlement

Important:

The client kit and other commercial references may contain different Enterprise pricing.

Therefore:

```text
Enterprise commercial data = NEEDS_REVIEW
```

Do not allow the autonomous sales agent to finalize Enterprise pricing until the administrator verifies the active price.

Also verify whether each Enterprise capability is already implemented before selling it.

---

# 8. RESTAURANT PAYMENT / HARDWARE MARKETING SNAPSHOT

Current poster references:

- cash
- card
- QR
- eSewa
- Khalti

and hardware such as:

- thermal receipt printer
- thermal + label printer
- barcode scanner

Treat payment methods as recording/support capabilities unless a real online gateway integration is verified.

Do not claim automated eSewa/Khalti settlement merely because the payment method exists in the POS.

---

# 9. CURRENT SALES CONTACT CONFIGURATION

Create admin settings for Aayatra sales contacts.

Suggested fields:

```text
primary_sales_phone
secondary_sales_phone
whatsapp_number
sales_email
support_email
website_url
company_address
business_hours
```

The poster currently shows example Call/WhatsApp contact numbers.

Do not embed numbers permanently in AI prompts.

Load active contact information from configuration.

---

# 10. PRODUCT KNOWLEDGE MODEL

Implement a real product knowledge store.

Every feature should include:

```text
product_id
module
feature_key
display_name
description
implementation_status
commercial_status
package_availability
requires_custom_scope
verified_by
verified_at
evidence
sales_notes
limitations
```

Recommended `implementation_status`:

```text
VERIFIED_AVAILABLE
AVAILABLE_WITH_CONFIGURATION
PARTIAL
BETA
PLANNED
CUSTOM_ONLY
NOT_AVAILABLE
UNKNOWN
```

The AI Sales Agent may only present features according to their allowed status.

---

# 11. LIVE DEMO URL CONFIGURATION — IMPORTANT

The user will provide live/staging demo links later.

Build the system NOW with a dedicated configuration page:

```text
Settings
→ Sales Automation
→ Demo Applications
```

Create configurable demo targets.

Example:

```text
AADHAR_RESTAURANT_DEMO_URL={{AADHAR_RESTAURANT_DEMO_URL}}

AADHAR_RETAIL_DEMO_URL={{AADHAR_RETAIL_DEMO_URL}}

AADHAR_HOTEL_DEMO_URL={{AADHAR_HOTEL_DEMO_URL}}

AADHAR_HOTEL_RESTAURANT_DEMO_URL={{AADHAR_HOTEL_RESTAURANT_DEMO_URL}}

THE_HAIRCUT_DEMO_URL={{THE_HAIRCUT_DEMO_URL}}

AAYATRA_WEBSITE_URL={{AAYATRA_WEBSITE_URL}}
```

These values may initially be empty.

The absence of a URL must NOT block implementation.

---

# 12. DEMO TARGET DATA MODEL

Create something equivalent to:

```text
demo_targets
------------
id
product_family
name
base_url
login_url
environment
enabled
requires_login
username_secret_ref
password_secret_ref
demo_tenant_reference
navigation_profile
allow_mutations
last_health_check
last_verified_at
status
```

Never store plaintext demo passwords in application source.

Use secret/environment references.

---

# 13. WHEN THE DEMO URL IS EMPTY

If the live/staging URL is not yet supplied:

- build the configuration
- build the demo-script model
- build the browser automation abstraction
- build the recording queue
- build the UI
- build test/demo adapters
- build validation
- create disabled demo jobs
- show status:

```text
WAITING_FOR_DEMO_URL
```

Do not pretend the live demo was visited.

Do not generate fake screenshots presented as live-system evidence.

Marketing images may be used only as temporary product/visual references.

---

# 14. WHEN THE USER LATER ADDS THE DEMO URL

The system should automatically perform:

```text
URL configured
    ↓
Health check
    ↓
Authentication check
    ↓
Demo-environment safety check
    ↓
Navigation discovery
    ↓
Feature route verification
    ↓
Demo script validation
    ↓
Screenshot test
    ↓
Demo recording eligibility
```

Use Playwright or the project's approved browser automation framework.

---

# 15. DEMO ENVIRONMENT SAFETY

Never run automated sales demonstrations against:

- a real client's production tenant
- real customer records
- real financial records
- real live payments
- real invoices
- irreversible stock changes
- real destructive actions

The recommended demo target is:

```text
STAGING
or
DEMO TENANT
```

Use synthetic demo data.

If the system requires mutations to demonstrate an order flow, use a resettable sandbox tenant.

---

# 16. AUTOMATIC NAVIGATION DISCOVERY

Once a demo URL exists, the system should be capable of learning or verifying the application navigation.

Possible process:

1. open base URL
2. authenticate if required
3. capture visible navigation
4. identify allowed routes
5. compare routes against configured demo script
6. verify selectors
7. save stable navigation steps
8. test script
9. record success/failure
10. require human review before using new/changed routes in production outreach

Do not rely only on brittle text selectors.

Prefer:

- semantic locators
- stable test IDs
- explicit route maps
- configured selectors

Add `data-testid` to Aadhar products where appropriate to make demo automation reliable.

---

# 17. DEMO SCRIPT MODEL

Create configurable scripts:

```text
demo_scripts
demo_script_steps
```

A step may contain:

```text
step_order
action
route
selector
expected_state
wait_condition
caption
voiceover_text
duration_hint
fallback_action
is_mutating
```

Actions may include:

```text
OPEN_ROUTE
CLICK
TYPE_DEMO_DATA
SELECT
WAIT
SCROLL
SHOW_TOOLTIP
CAPTURE
HIGHLIGHT
```

---

# 18. RESTAURANT AUTOMATED DEMO SCRIPT

Once a verified live/staging restaurant URL is supplied, support a script such as:

```text
1. Open Dashboard
2. Show business overview
3. Open POS / New Order
4. Select table or order type
5. Add sample menu items
6. Show KOT workflow
7. Show kitchen flow/KDS if verified
8. Show payment options
9. Show inventory
10. Show purchasing if verified
11. Show reservations if verified
12. Show accounting/reports if verified
13. Show website/online ordering if configured
14. Show final Aayatra CTA
```

Do not show a step if the feature is unverified.

---

# 19. RETAIL AUTOMATED DEMO SCRIPT

Using the supplied retail poster as the temporary product concept, the default script should support:

```text
1. Dashboard
2. New Sale
3. Search product
4. Add products
5. Quantity / price / totals
6. Complete sample sale in sandbox mode
7. Products
8. Product variants where verified
9. Barcodes
10. Inventory
11. Customers
12. Reports
13. Settings / permissions where relevant
14. Ecommerce/storefront where verified
15. Final Aayatra CTA
```

For cosmetics/accessories/kawaii stores, use appropriate synthetic products such as:

```text
Lip Tint — Shade 03
Hair Clip — Pink
Charm Bracelet — Silver
Cute Notebook — Bear
Perfume — 50ml
```

Never use misleading real customer data.

---

# 20. HOTEL / HOTEL + RESTAURANT DEMO PLACEHOLDERS

Prepare the same architecture now.

When those demo URLs are later supplied, support configurable scripts such as:

## Hotel

```text
Dashboard
Rooms
Availability
Reservation
Check-In
Guest Folio
Payment
Housekeeping
Reports
Website / Direct Booking
```

## Hotel + Restaurant

```text
Hotel Dashboard
Rooms
Guest Check-In
Restaurant POS
KOT
Room Service
Post Restaurant Charge to Room
Guest Folio
Checkout
Combined Reports
Website / Booking
```

Only enable verified features.

---

# 21. PERSONALIZED DEMO GENERATION

A demo should be generated only for sufficiently valuable leads.

The system should select:

```text
product
demo target
demo script
industry template
prospect name
prospect problem
features to emphasize
CTA
```

Do not rebuild the entire application per prospect.

Personalization should mainly affect:

- intro
- prospect/business name
- relevant modules
- annotations
- demo narration
- CTA
- optional branded concept website

---

# 22. AUTOMATED DEMO VIDEO

Implement a queue-based video pipeline:

```text
Qualified Lead
    ↓
Demo Job Created
    ↓
Playwright Browser Session
    ↓
Configured Demo Script
    ↓
Capture / Record
    ↓
FFmpeg Processing
    ↓
Add Intro / CTA
    ↓
Store in Object Storage
    ↓
Attach to Lead
```

Store:

```text
demo_video_status
demo_video_url
duration
script_version
demo_target_version
created_at
failure_reason
```

---

# 23. DEMO VIDEO SAFETY

A generated video must not expose:

- credentials
- private customer data
- API keys
- admin secrets
- production financial details
- unrelated customer names
- browser autofill
- hidden environment information

Run automated redaction/safety validation where practical.

---

# 24. OUTREACH ENGINE — IMPLEMENT NOW

Implement:

```text
campaign
    ↓
qualified lead
    ↓
message generation
    ↓
policy validation
    ↓
delivery queue
    ↓
provider
    ↓
delivery status
    ↓
reply / no reply
```

Start with:

```text
AI GENERATED
→ HUMAN APPROVAL
→ SEND
```

Then support higher autonomy levels later.

---

# 25. MISSING EXTERNAL MESSAGING CREDENTIALS

Do not block development.

If email/WhatsApp/SMS credentials are unavailable:

Implement:

- provider interface
- database
- queue
- delivery state machine
- webhook contract
- test provider
- simulated provider
- message preview
- approval UI
- retry/dead-letter handling

Mark real provider:

```text
NOT_CONFIGURED
```

Do not fake successful real-world delivery.

---

# 26. OUTBOUND MESSAGE STATES

Use states such as:

```text
DRAFT
AWAITING_APPROVAL
QUEUED
SENDING
SENT
DELIVERED
READ
REPLIED
FAILED
BOUNCED
CANCELLED
OPTED_OUT
```

Only use states supported by the provider.

---

# 27. INBOUND CONVERSATIONS — MUST IMPLEMENT

This is a core pending phase.

Build a unified conversation inbox.

Support provider adapters for future:

- email
- WhatsApp
- SMS
- website chat
- social messaging where permitted
- manual call notes

Every incoming message must:

1. verify provider webhook
2. deduplicate
3. identify contact
4. identify lead/opportunity
5. store raw provider reference
6. store normalized message
7. classify intent
8. update conversation summary
9. update buying-intent events
10. recommend next action
11. decide AI response vs human review
12. update priority inbox

---

# 28. CONVERSATION UI

Create a professional CRM conversation workspace.

Left:

```text
Priority conversations
Hot leads
Ready to buy
Needs human
Unread
All
```

Center:

```text
Conversation thread
```

Right:

```text
Business
Contact
Lead Fit
Buying Intent
Stage
Product Interest
Estimated Value
Requirements
Objections
Last Offer
Next Action
Tasks
Proposal
Payment Status
```

---

# 29. LANGUAGE HANDLING

A Nepal-focused sales assistant should be able to understand:

- English
- Nepali
- Romanized Nepali
- mixed Nepali/English business chat

Do not blindly translate everything.

Respond in the prospect's apparent preferred style when confidence is high.

Maintain professional tone.

Never mimic offensive or unprofessional language.

---

# 30. AI INTENT CLASSIFIER

Support intents including:

```text
GREETING
GENERAL_QUESTION
FEATURE_QUESTION
PRICE_QUERY
PACKAGE_QUERY
DEMO_REQUEST
MEETING_REQUEST
IMPLEMENTATION_QUERY
SUPPORT_QUERY
OBJECTION_PRICE
OBJECTION_EXISTING_SYSTEM
OBJECTION_TIMING
NEGOTIATION
PROPOSAL_REQUEST
PAYMENT_QUERY
PURCHASE_INTENT
NOT_INTERESTED
FOLLOW_UP_LATER
DO_NOT_CONTACT
CUSTOM_REQUIREMENT
LEGAL_OR_CONTRACT
SECURITY_QUESTION
COMPLAINT
UNKNOWN
```

---

# 31. PRIORITY LEAD CLASSIFICATION

Automatically maintain:

```text
COLD
WARM
INTERESTED
HOT
READY_TO_BUY
NEGOTIATING
PROPOSAL_SENT
PAYMENT_PENDING
CLOSED_WON
```

Create dedicated saved views.

The main operating screen must immediately show:

```text
🔥 HOT LEADS
💰 READY TO BUY
🤝 NEGOTIATING
📄 PROPOSAL SENT
💳 PAYMENT PENDING
⚠ NEEDS HUMAN
```

---

# 32. AI RESPONSE POLICY

The AI may autonomously answer low-risk, verified questions such as:

- verified features
- active package prices
- approved hardware pricing
- demo availability
- implementation process
- onboarding process
- standard support information
- meeting scheduling

The AI must escalate:

- unverified feature request
- custom development
- large discount
- Enterprise ambiguity
- legal terms
- contract changes
- security questionnaires
- data migration complexity
- unusual SLA requests
- statutory/IRD claims
- high-value deal
- low confidence

---

# 33. AI SALES ASSISTANT TOOLS

Implement controlled tools such as:

```text
getLead()
getBusiness()
getConversation()
getConversationSummary()

getProduct()
getVerifiedFeatures()
getPackage()
getActivePrice()
getHardwarePrice()
getCommercialPolicy()

getAllowedDiscount()
calculateQuote()

createTask()
scheduleMeeting()

createDemoJob()
getDemoStatus()
sendDemo()

createQuotation()
createProposal()
sendProposal()

createPaymentRequest()
getPaymentStatus()

markDoNotContact()
escalateToHuman()
```

The LLM never writes directly to critical tables.

---

# 34. SALES CONVERSATION EXAMPLE

Prospect:

> How much for restaurant software?

Agent:

1. identify restaurant opportunity
2. load ACTIVE + VERIFIED restaurant packages
3. explain only valid packages
4. ask one concise qualifying question if needed
5. log pricing interest
6. raise intent score

Prospect:

> Does Growth include inventory and accounting?

Agent:

1. verify package features
2. answer accurately
3. do not exaggerate IRD capability
4. log feature interest

Prospect:

> Okay send final price.

Agent:

1. classify HOT / READY_TO_BUY
2. calculate allowed quote
3. check discount policy
4. create/send quote or escalate if pricing status is unverified

---

# 35. QUALIFICATION

Capture progressively:

```text
business_type
locations
branches
number_of_users
number_of_tables
number_of_rooms
number_of_products
current_system
current_pain
required_modules
hardware
data_migration
budget_signal
timeline
decision_maker
implementation_deadline
```

Do not interrogate the customer with every question at once.

Use conversational qualification.

---

# 36. PROPOSAL / QUOTATION ENGINE — IMPLEMENT NOW

Use the supplied Aadhar client-kit structure.

Quotation should support:

```text
quotation_number
client
business_type
date
valid_until
selected_package
software_items
hardware_items
implementation
customization
discount
subtotal
tax
total
commercial_notes
scope
exclusions
acceptance
version
```

Generate a professional printable PDF/HTML representation.

Maintain versions.

Never silently overwrite an accepted quotation.

---

# 37. SERVICE AGREEMENT HANDOFF

The client kit already defines a service agreement structure covering areas such as:

- scope
- licence/subscription
- fees
- client responsibilities
- migration
- hardware
- support
- availability
- data
- confidentiality/security
- accounting/tax responsibilities
- customization
- termination/export
- liability

The AI Sales Engine should:

1. select the approved agreement template
2. merge verified commercial data
3. flag placeholders
4. never invent legal terms
5. require appropriate human/legal approval before first production use or material contract changes
6. record the exact signed version

---

# 38. PROPOSAL CONTENT

A proposal may include:

```text
Executive Summary
Observed Business Needs
Recommended Aayatra Solution
Included Modules
Implementation Approach
Hardware
Training
Support
Timeline
Commercials
Payment Terms
Assumptions
Exclusions
Validity
Next Steps
```

The proposal should be tailored to the prospect's actual needs.

Do not send a 10-page generic proposal to a tiny shop unless needed.

---

# 39. PAYMENT ENGINE — IMPLEMENT ABSTRACTION NOW

Missing payment-provider credentials must not block development.

Create:

```text
payment_requests
payment_attempts
payment_events
```

Support provider abstraction:

```text
MANUAL_BANK
MANUAL_QR
CASH
PAYMENT_GATEWAY
FUTURE_PROVIDER
```

Possible states:

```text
DRAFT
REQUESTED
PENDING
SUBMITTED_FOR_VERIFICATION
VERIFIED
FAILED
EXPIRED
CANCELLED
REFUNDED
```

Never mark verified based only on AI interpretation of a chat message.

---

# 40. CLOSING RULE

Do not mark:

```text
CLOSED_WON
```

just because a prospect says:

> Yes.

Use explicit configured closing conditions.

Recommended lifecycle:

```text
VERBAL_INTENT
    ↓
QUOTATION_ACCEPTED
    ↓
AGREEMENT_ACCEPTED
    ↓
PAYMENT_PENDING
    ↓
ADVANCE_OR_REQUIRED_PAYMENT_VERIFIED
    ↓
CLOSED_WON
```

Exact requirement should be configurable per product/package.

---

# 41. ONBOARDING — IMPLEMENT FROM CLIENT KIT

Once a deal is won, automatically create the onboarding workflow.

The supplied client kit defines:

```text
Demo
→ Quotation
→ Agreement
→ Invoice
→ Welcome
→ Setup Form
→ Data Import
→ Hardware Check
→ Configuration
→ Training
→ UAT
→ Go-Live
→ Handover / SLA
→ Support
→ Feedback
→ Renewal
```

Implement this as a real workflow.

---

# 42. ONBOARDING PROJECT

On close create:

```text
customer
implementation_project
onboarding_checklist
assigned_owner
target_go_live
data_requirements
hardware_requirements
training_plan
uat_status
handover_status
```

---

# 43. CLIENT SETUP DATA

The client kit provides a strong setup model.

Capture areas such as:

```text
legal_name
trading_name
business_type
PAN_VAT
address
phone
email
website
primary_contact

selected_package
billing_cycle
branch
POS_counters
users
planned_go_live
current_system
migration_requirements

VAT_tax
service_charge
rounding_rule
currency
payment_methods
discount_approval
refund_void_approval
```

Industry-specific fields must be conditional.

---

# 44. RESTAURANT ONBOARDING

Where relevant collect:

- floor/table layout
- menu import
- kitchen stations
- KOT routing
- recipe/BOM
- ingredient inventory
- order types
- reservations
- waitlist
- taxes
- service charge

---

# 45. RETAIL ONBOARDING

Where relevant collect:

- products
- SKUs
- barcodes
- variants
- opening stock
- suppliers
- reorder levels
- batch/expiry
- serial tracking
- loyalty
- promotions

For cosmetics/kawaii/accessories businesses support large variant imports.

Do not require manual one-by-one creation for hundreds of variants.

---

# 46. HARDWARE READINESS

Implement checklist support for:

- main POS computer
- local server if applicable
- browser/runtime
- disk space
- administrator access
- UPS/power protection
- primary internet
- backup internet
- router/LAN
- Wi-Fi coverage
- static local addressing
- thermal printer
- KOT printer
- label printer
- barcode scanner
- cash drawer
- kitchen display/tablet
- customer display

---

# 47. IMPLEMENTATION & GO-LIVE

Create a structured implementation gate.

Include:

- business configuration
- tax settings
- payments
- users
- roles
- business-day settings
- receipt/invoice
- modules
- data import
- stock
- customers/suppliers
- opening balances
- workflow tests
- devices
- backup
- approval

Go-live cannot be marked PASS only because the app loads.

---

# 48. UAT TEST COVERAGE

Support tests for:

- login/permissions
- normal sale/order
- discount approval
- cash
- QR/card/other payment
- split payment
- void/cancel
- refund/reversal
- reopen/add-to-bill when contracted
- printing
- KOT
- inventory deduction
- purchase/expense
- day close/reconciliation
- reports/exports

---

# 49. HANDOVER & SLA

After go-live track:

- production app
- production database
- branch configuration
- imported data
- opening stock/balances
- users
- devices
- training
- backup
- documentation
- support hours
- support channel
- priority channel
- remote support
- maintenance approach

Do not store passwords in handover documents.

---

# 50. SUPPORT SEVERITY

Support a configurable severity model similar to:

```text
P1 Critical
P2 Major
P3 Normal
P4 Request
```

Do not promise response times until commercial/SLA values are verified and active.

---

# 51. FEEDBACK / TESTIMONIAL

After enough real-world usage, support:

- ease-of-use rating
- reliability rating
- reports/controls rating
- onboarding/support rating
- recommendation
- qualitative feedback
- permission to use testimonial
- approved attribution fields

Never publish testimonials without recorded permission.

---

# 52. ANALYTICS — EXTEND CURRENT IMPLEMENTATION

Measure the complete funnel:

```text
Discovered
Qualified
Contacted
Delivered
Replied
Interested
Hot
Ready to Buy
Demo Sent
Demo Viewed
Meeting
Quote
Proposal
Negotiation
Payment Pending
Won
Lost
```

Calculate:

```text
Lead → Qualified
Qualified → Contact
Contact → Reply
Reply → Interested
Interested → Hot
Hot → Proposal
Proposal → Won
Contact → Won
Revenue / 100 leads
Revenue / 1,000 leads
Revenue / 1,000 qualified leads
Average deal size
Time to first reply
Time to close
AI cost / sale
Demo → proposal conversion
```

---

# 53. SEGMENT ANALYTICS

Break down by:

- restaurant
- hotel
- hotel + restaurant
- retail
- cosmetics
- kawaii/cute
- accessories/ornaments
- salon
- website
- ecommerce
- social commerce
- custom
- lead source
- city
- campaign
- product
- package
- sales channel

---

# 54. AUTOMATION CONTROL CENTER

Create admin controls:

```text
Research Automation
Lead Scoring
Message Drafting
Auto-Send
Inbound AI Replies
Demo Generation
Proposal Generation
Follow-Ups
Negotiation
Payment Requests
Closing
Onboarding
```

Each should have:

```text
OFF
ASSISTED
AUTOMATIC_WITH_RULES
```

High-risk features should default to ASSISTED.

---

# 55. HUMAN TAKEOVER

Every conversation must support:

```text
TAKE OVER
RETURN TO AI
PAUSE AUTOMATION
DO NOT CONTACT
ESCALATE
```

When a human takes over, AI must not continue sending messages unless explicitly configured.

---

# 56. SECURITY REQUIREMENTS

Treat all external content as untrusted.

Protect against:

- prompt injection
- malicious links
- SSRF
- unsafe file downloads
- malicious HTML
- credential leakage
- webhook spoofing
- unauthorized discounts
- unauthorized proposals
- fake payment confirmations
- cross-tenant access

All high-impact AI actions require server-side authorization.

---

# 57. QA REQUIREMENTS

Create tests for:

## Outreach

- approval
- provider failure
- retries
- opt-out
- dedupe
- rate limit

## Inbound

- webhook verification
- message dedupe
- intent classification
- hot-lead transition
- human takeover

## Demo

- missing URL
- invalid URL
- login failure
- selector change
- recording failure
- secret redaction
- sandbox reset

## Quote/Proposal

- correct package
- correct active price
- conflicting price blocked
- discount validation
- versioning

## Payment

- duplicate webhook
- failed payment
- manual verification
- no AI fake success
- state transition

## Closing

- verbal yes does not equal won
- required payment gates
- idempotent onboarding

## Onboarding

- correct checklist
- business type conditional fields
- UAT
- go-live
- handover

---

# 58. CRITICAL PRICE-CONFLICT TEST

Because current marketing material and client-kit references may differ, add a test:

```text
IF two ACTIVE price sources conflict
AND no source is marked canonical
THEN automatic quote generation MUST FAIL SAFELY
AND create:
COMMERCIAL_REVIEW_REQUIRED
```

This is mandatory.

---

# 59. IMPLEMENTATION ORDER

Continue in this order unless repository constraints require a justified change:

## Phase A
Audit existing partial work.

## Phase B
Normalize verified product knowledge + temporary marketing catalogue.

## Phase C
Build commercial configuration and price verification.

## Phase D
Build demo URL/configuration architecture.

## Phase E
Build demo browser abstraction and scripts.

## Phase F
Build outbound messaging abstraction and approval flow.

## Phase G
Build inbound conversation infrastructure.

## Phase H
Build intent classification + hot-lead separation.

## Phase I
Build AI Sales Assistant.

## Phase J
Build follow-up automation.

## Phase K
Build automated demo recording.

## Phase L
Build quote/proposal engine.

## Phase M
Build controlled negotiation.

## Phase N
Build payment abstraction.

## Phase O
Build closing rules.

## Phase P
Build onboarding workflow from supplied client kit.

## Phase Q
Build implementation/UAT/go-live/handover.

## Phase R
Complete analytics, QA, security, observability, and acceptance.

---

# 60. WHAT TO DO ABOUT THE MISSING LIVE LINK RIGHT NOW

Do NOT wait for it.

Implement:

```text
DEMO URL SETTINGS
DEMO TARGET MODEL
SECRET REFERENCE MODEL
PLAYWRIGHT ADAPTER
DEMO SCRIPT MODEL
JOB QUEUE
RECORDING PIPELINE
DEMO UI
TEST ADAPTER
HEALTH CHECK
SAFETY CHECK
```

For each missing product URL show:

```text
Demo Environment:
NOT CONFIGURED

Action:
Add Demo URL
```

When the user later enters the URL, the system should continue without code changes.

---

# 61. DESIRED DEMO URL ADMIN UX

Example:

```text
Aadhar Restaurant

Demo URL:
[________________________________]

Login URL:
[________________________________]

Environment:
[ Demo / Staging ]

Requires Login:
[ Yes ]

Username Secret:
[ AADHAR_RESTAURANT_DEMO_USER ]

Password Secret:
[ AADHAR_RESTAURANT_DEMO_PASSWORD ]

[ TEST CONNECTION ]

Status:
● Healthy

Last Verified:
2026-xx-xx xx:xx

[ DISCOVER NAVIGATION ]
[ TEST DEMO SCRIPT ]
[ GENERATE TEST VIDEO ]
```

Repeat for each Aayatra product.

---

# 62. FINAL USER EXPERIENCE

When the system is mature, a lead should be able to flow like this:

```text
Lead Discovered
    ↓
Lead Enriched
    ↓
Aadhar Product Selected
    ↓
Personalized Message Generated
    ↓
Message Sent
    ↓
Customer Replies
    ↓
AI Understands Intent
    ↓
Lead Becomes INTERESTED / HOT
    ↓
AI Answers Questions
    ↓
AI Sends Live Demo / Demo Video
    ↓
Customer Requests Price
    ↓
Verified Price Loaded
    ↓
Quote Generated
    ↓
Customer Negotiates
    ↓
AI Uses Approved Commercial Rules
    ↓
Proposal Sent
    ↓
Agreement
    ↓
Payment Request
    ↓
Payment Verified
    ↓
CLOSED WON
    ↓
Onboarding Automatically Created
    ↓
Setup
    ↓
Import
    ↓
Hardware
    ↓
Training
    ↓
UAT
    ↓
Go-Live
    ↓
Handover
    ↓
Support
    ↓
Feedback / Renewal
```

---

# 63. NON-NEGOTIABLE PRODUCT PRINCIPLES

1. Do not fake product capabilities.
2. Do not fake browser demonstrations.
3. Do not fake successful outreach.
4. Do not fake payment.
5. Do not let AI bypass pricing rules.
6. Do not confuse marketing statements with verified implementation.
7. Do not let important leads disappear in the general inbox.
8. Do not mark deals won too early.
9. Do not ask for approval after every normal development phase.
10. Do document genuine external blockers.
11. Do build placeholders/configuration for missing external values now.
12. Do maintain full auditability.
13. Do preserve human override.
14. Do prioritize actual revenue, not message volume.
15. Do use the existing Aadhar client-kit lifecycle after closing.

---

# 64. FIRST RESPONSE / ACTION REQUIRED FROM THE CODING AGENT

Do not simply say:

> "I can proceed."

Perform the audit and return:

## 1. Current implementation status

For each of:

```text
Product Knowledge
Discovery
Enrichment
Routing
Lead Fit
Analytics
Outreach
Inbound
Intent
AI Sales Assistant
Demo Configuration
Automated Demo
Proposal
Payment
Closing
Onboarding
```

Mark:

```text
NOT_STARTED
PARTIAL
IMPLEMENTED
IMPLEMENTED_BUT_UNVERIFIED
BLOCKED_EXTERNAL
```

## 2. Product evidence matrix

Map actual verified repository features against the marketing snapshot.

## 3. Commercial conflict report

Identify every conflicting or unverified price/package claim.

## 4. Demo architecture

Implement URL placeholders immediately.

## 5. Pending implementation plan

Break the pending phases into executable engineering tasks.

## 6. Database impact

List required migrations.

## 7. API impact

List required APIs/webhooks.

## 8. UI impact

List required screens/components.

## 9. Security review

Identify high-impact actions and safeguards.

## 10. QA acceptance gates

Define PASS/FAIL conditions.

Then proceed with implementation according to the approved phase order.

---

# 65. TARGET END STATE

The target is not a chatbot.

The target is an **Aayatra autonomous sales and customer-acquisition operating system** where:

- AI finds qualified opportunities
- AI researches them
- AI contacts them through approved channels
- AI handles inbound conversations
- AI identifies interested/hot/ready-to-buy prospects
- humans see important leads immediately
- AI can demonstrate the real Aadhar system once demo URLs are configured
- AI generates short personalized demo videos
- AI creates quotations and proposals using verified commercial data
- AI negotiates only inside approved limits
- payments are verified safely
- deals close only under explicit conditions
- won deals automatically enter Aadhar onboarding
- implementation, training, UAT, go-live, handover and support are tracked
- every important action is auditable
- every commercial claim is grounded in verified product data
- the system optimizes for **qualified opportunities → proposals → deposits → successful customers → recurring revenue**

Build this as production software, not as an AI demonstration.
