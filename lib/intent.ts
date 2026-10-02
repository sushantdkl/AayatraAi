export const intents = [
  "GREETING", "GENERAL_QUESTION", "FEATURE_QUESTION", "PRICE_QUERY", "PACKAGE_QUERY",
  "DEMO_REQUEST", "MEETING_REQUEST", "IMPLEMENTATION_QUERY", "SUPPORT_QUERY",
  "OBJECTION_PRICE", "OBJECTION_EXISTING_SYSTEM", "OBJECTION_TIMING", "NEGOTIATION",
  "PROPOSAL_REQUEST", "PAYMENT_QUERY", "PURCHASE_INTENT", "NOT_INTERESTED",
  "FOLLOW_UP_LATER", "DO_NOT_CONTACT", "CUSTOM_REQUIREMENT", "LEGAL_OR_CONTRACT",
  "SECURITY_QUESTION", "COMPLAINT", "UNKNOWN",
] as const;
export type Intent = (typeof intents)[number];
export type IntentResult = { intent: Intent; needsHuman: boolean; reason: string };

export function classifyIntent(body: string): IntentResult {
  const value = body.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
  const found = (pattern: RegExp) => pattern.test(value);
  if (found(/\b(stop|unsubscribe|do not contact|don't contact|no more messages|message nagarnu|samparka nagarnu)\b/))
    return { intent: "DO_NOT_CONTACT", needsHuman: true, reason: "Explicit opt-out language" };
  if (found(/\b(contract|agreement|legal|liability|privacy policy|data protection|sla|ird certification|government certified)\b/))
    return { intent: "LEGAL_OR_CONTRACT", needsHuman: true, reason: "Legal or statutory terms" };
  if (found(/\b(refund|fraud|broken|complaint|not working|angry|issue with support)\b/))
    return { intent: "COMPLAINT", needsHuman: true, reason: "Complaint or service issue" };
  if (found(/\b(security|encryption|penetration test|data residency|audit report)\b/))
    return { intent: "SECURITY_QUESTION", needsHuman: true, reason: "Security review" };
  if (found(/\b(discount|negotiate|best price|final price|rate ghata|sasto garna)\b/))
    return { intent: "NEGOTIATION", needsHuman: true, reason: "Commercial negotiation" };
  if (found(/\b(send (me )?(a |the )?(quote|quotation|proposal)|proposal patha|quotation patha)\b/))
    return { intent: "PROPOSAL_REQUEST", needsHuman: true, reason: "Document request" };
  if (found(/\b(ready to (buy|purchase|start)|we will buy|i want to buy|purchase order|kinna chahanchu)\b/))
    return { intent: "PURCHASE_INTENT", needsHuman: true, reason: "Explicit buying language" };
  if (found(/\b(not interested|no thanks|chaina|chahidaina)\b/))
    return { intent: "NOT_INTERESTED", needsHuman: true, reason: "Negative response" };
  if (found(/\b(next month|later|after (dashain|tihar)|follow up later|pachi kura gar)\b/))
    return { intent: "FOLLOW_UP_LATER", needsHuman: true, reason: "Requested later timing" };
  if (found(/\b(demo|demonstration|show me|herna chahanchu)\b/))
    return { intent: "DEMO_REQUEST", needsHuman: true, reason: "Demo request" };
  if (found(/\b(meeting|schedule a call|book a call|bhetnu|call garnu)\b/))
    return { intent: "MEETING_REQUEST", needsHuman: true, reason: "Meeting request" };
  if (found(/\b(price|pricing|cost|how much|kati|rate)\b/))
    return { intent: "PRICE_QUERY", needsHuman: true, reason: "Pricing question needs verified commercial record" };
  if (found(/\b(package|plan|subscription)\b/))
    return { intent: "PACKAGE_QUERY", needsHuman: true, reason: "Package question needs verified entitlement" };
  if (found(/\b(feature|function|include|support|can it|milcha|cha ki)\b/))
    return { intent: "FEATURE_QUESTION", needsHuman: true, reason: "Feature question needs approved product facts" };
  if (found(/\b(hello|hi|namaste|namaskar)\b/))
    return { intent: "GREETING", needsHuman: false, reason: "Greeting only" };
  return { intent: "UNKNOWN", needsHuman: true, reason: "No high-confidence deterministic rule" };
}
