import type { EvalCase } from "./ai-eval-dataset";

/** Held-out cases written after rule tuning; first-run score is recorded in AI_EVALUATION_REPORT.md. */
const raw = `
hello, I run a small bakery in Lalitpur | GREETING | WARM | EN
yo system kati ko ho? | PRICE_QUERY | INTERESTED | NE_ROMAN
How much would it be per month for my grocery store? | PRICE_QUERY | INTERESTED | EN
Is there a cheaper plan? | OBJECTION_PRICE | INTERESTED | EN
k discount dina milcha? | NEGOTIATION | NEGOTIATING | NE_ROMAN
Can you come tomorrow to show the software? | DEMO_REQUEST | HOT | EN
I'd like to book a demo for my cafe | DEMO_REQUEST | HOT | EN
demo kahile dekhaunu huncha? | DEMO_REQUEST | HOT | NE_ROMAN
Please share the quotation for Enterprise yearly | PROPOSAL_REQUEST | READY_TO_BUY | EN
hamilai growth package chahiyo, quotation pathaunu | PROPOSAL_REQUEST | READY_TO_BUY | NE_ROMAN
Ok let's go ahead with Starter | PURCHASE_INTENT | READY_TO_BUY | EN
Where do I send the money? | PAYMENT_QUERY | PAYMENT_PENDING | EN
fonepay garna milcha? | PAYMENT_QUERY | PAYMENT_PENDING | NE_ROMAN
Payment gardiye, receipt pathauchu | PAYMENT_QUERY | PAYMENT_PENDING | NE_ROMAN
Does it print kitchen tickets? | FEATURE_QUESTION | INTERESTED | EN
Can I see daily sales reports on my phone? | FEATURE_QUESTION | INTERESTED | EN
table booking milcha? | FEATURE_QUESTION | INTERESTED | NE_ROMAN
We have two outlets, can one system handle both? | FEATURE_QUESTION | INTERESTED | EN
Is the bill IRD compliant? | TAX_REGISTRATION_QUERY | INTERESTED | EN
Do you charge VAT on top? | TAX_REGISTRATION_QUERY | INTERESTED | EN
we are happy with our current POS | OBJECTION_EXISTING_SYSTEM | INTERESTED | EN
call me after Tihar | FOLLOW_UP_LATER | WARM | EN
busy chu, pachi garaula | FOLLOW_UP_LATER | WARM | NE_ROMAN
no need, thank you | NOT_INTERESTED | NOT_INTERESTED | EN
please don't contact me | DO_NOT_CONTACT | NOT_INTERESTED | EN
my billing screen is broken | COMPLAINT | - | EN
Can you make an online store for my clothing brand? | CUSTOM_REQUIREMENT | INTERESTED | EN
Will you train my waiters? | IMPLEMENTATION_QUERY | INTERESTED | EN
What are the terms and conditions? | LEGAL_OR_CONTRACT | - | EN
मलाई डेमो चाहियो | DEMO_REQUEST | HOT | NE
होटलको लागि कति पर्छ? | PRICE_QUERY | INTERESTED | NE
भुक्तानी गरें | PAYMENT_QUERY | PAYMENT_PENDING | NE
`;
export const holdoutDataset: EvalCase[] = raw.trim().split("\n").map((line) => {
  const [message, intent, temperature, language] = line.split(" | ").map((part) => part.trim());
  return { message, intent, temperature: temperature === "-" ? null : temperature, language: language as EvalCase["language"] };
});
