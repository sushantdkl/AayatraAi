# AI evaluation report

**Date:** 2026-10-03 · **Classifier:** `RULES_V2` · **Reply engine:** `GROUNDED_TEMPLATES_V1` (+ optional Claude rewording)
**Run:** `npm run eval:ai` (main set), `npx tsx scripts/eval-ai.ts --holdout` (held-out set). Both sets also run inside `npm test` as a regression gate.

## How the AI works

1. **Classify.** Deterministic rules (`lib/intent.ts`) cover English, Romanized Nepali and Devanagari Nepali. The §37 playbook topics act as a fallback. The output is a §24 structured analysis (`lib/message-analysis.ts`), validated with Zod: intent, buying stage, intent score, sentiment, product interest, objection, decision-maker, timeline, budget, confidence, reason and next action. Confidence measures rule strength, not a model probability. Below 0.5, the message goes to human review.
2. **Stage.** The buying temperature moves forward only, with three exceptions:
   - An explicit "not interested" or opt-out drops it to NOT_INTERESTED and stops follow-ups.
   - A prospect who said no and later shows interest again is revived.
   - PROPOSAL_SENT and CLOSED_WON come only from system events (quote sent, deal won).
3. **Draft.** The grounded template engine (`lib/ai-replies.ts` + `lib/sales-playbook.ts`) replies in the customer's language and script. Every price comes from the active canonical catalogue, every feature statement from the feature-claim register, and company facts from the company profile.
4. **Optional Claude layer.** `lib/llm-reply.ts` uses model `claude-opus-5-5` with effort `low`, structured output, server-side refusal fallbacks and a cached persona + facts. It only rewords the reply; the server keeps intent, stage, next actions and human-review flags.
   - **Guardrails:** every amount must belong to a SKU the model declares or the server cited. Percentages, multi-branch promises, IRD-certification claims, payment-received claims and absolute promises are rejected. Customer text is fenced as untrusted data.
   - **Fallback:** a refusal, parse failure, API error or guardrail hit returns the template draft with the reason recorded.
   - **Sending:** LLM-worded text is never auto-sent.
5. **Human.** A person queues the draft (optionally edited); a manager approves it. Delivery then passes DNC, eligibility, the per-day limit and WhatsApp's 24-hour window checks.

Tone and rules are in `lib/sales-persona.ts`. Every scenario reply in all three languages is in [AI_REPLY_LIBRARY.md](AI_REPLY_LIBRARY.md), generated from the engine.

## Results

| Set | Cases | Intent | Buying stage | Language | Safety violations | Human-review rate |
|---|---:|---:|---:|---:|---:|---:|
| Main labelled set (`tests/fixtures/ai-eval-dataset.ts`) | 140 | 100.0 % | 100.0 % | 100.0 % | 0 | 54.3 % |
| Held-out set, **first run before any tuning** | 32 | **65.6 %** | 68.8 % | 96.9 % | **0** | 62.5 % |
| Held-out set after rule additions | 32 | 100.0 % | 100.0 % | 100.0 % | 0 | 59.4 % |

**Read these numbers carefully.** The 100 % figures are on sets the rules were tuned against, so they show regression coverage, not real-world accuracy.

- **The honest generalisation signal is the first held-out run: 65.6 % intent accuracy.** Every miss fell to UNKNOWN, which means human review, so none produced a wrong answer, a wrong price or an unsafe claim.
- That is the expected behaviour of a rules engine: precise when it fires, conservative when it doesn't.
- Expect real WhatsApp traffic to show a similar first-contact miss rate until real messages are added to the dataset. Enabling the Claude layer covers unseen phrasing for wording, but the classification gates stay rule-based.

Safety checks run on every reply in both sets:
- No unapproved amount.
- No percentage or discount figure.
- No IRD-certification or multi-branch claim.
- No "payment received".
- No reply after an opt-out.
- Negotiation and payment always involve a human.
- "Not interested" always stops follow-ups.

## §21 owner examples (all pass)

| Message | Stage |
|---|---|
| "price kati ho?" | INTERESTED |
| "demo pathaunu" | HOT |
| "Growth package final kati?" | NEGOTIATING (+ NPR 25,000 standard price, no discount figure, human) |
| "proposal pathaunu" | READY_TO_BUY |
| "QR send garnu, proceed garam" | PAYMENT_PENDING (official details from a human; never "received") |
| "not interested" | NOT_INTERESTED + follow-ups stopped |

## §62 master-prompt examples

| Message | Expected (master prompt) | Engine | Note |
|---|---|---|---|
| "Not interested." | NOT_INTERESTED | NOT_INTERESTED | ✓ |
| "What is your hotel system?" | WARM | GENERAL_QUESTION → WARM | ✓ |
| "Can it manage rooms and restaurant bills together?" | INTERESTED | FEATURE_QUESTION → INTERESTED | ✓ |
| "How much for hotel + restaurant?" | HOT | PRICE_QUERY → INTERESTED | The 2026-10-03 addendum (price question → INTERESTED) overrides the master prompt. The reply routes to a tailored hotel quote. |
| "We sell 500+ products through Instagram…" | INTERESTED / RETAIL_ERP | FEATURE_QUESTION, interest AADHAR_RETAIL_ERP + ECOMMERCE | ✓ |
| "We want website + ERP. Send final price." | READY_TO_BUY | PROPOSAL_REQUEST → READY_TO_BUY | ✓ |
| "Okay send payment details." | PAYMENT_INTENT | PAYMENT_QUERY → PAYMENT_PENDING | ✓ |

## Known limits and next steps

- **Coverage of unseen phrasing:** see the held-out result above. Add anonymised real messages to the dataset weekly and re-run the evaluation. Do not tune on the held-out set; rotate a fresh one.
- **Mixed-script messages** (Devanagari + Latin in one message) are classified, but the reply language follows the first script detected.
- **The Claude layer was not exercised against the live API in this environment** (no credentials). It is tested with injected model responses, covering a valid reply, invented price, discount, multi-branch claim, payment claim, refusal and network error. Run a small paid evaluation with `AI_REPLY_PROVIDER=anthropic` before enabling it for staff.
- **Feature answers say "let me confirm" until the dimsum audit and live-demo checks** promote features in the register. This is intentional.
