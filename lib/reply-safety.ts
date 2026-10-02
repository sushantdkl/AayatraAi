import type { ReplyDraft } from "@/lib/ai-replies";

/**
 * Post-generation guardrails applied to every outgoing draft (template or LLM).
 * Returns the list of violations; any violation means the draft must not be sent as-is.
 */
export function replySafetyViolations(body: string | null, allowedPricesMinor: number[], options: { allowDiscountWords?: boolean } = {}): string[] {
  if (!body) return [];
  const violations: string[] = [];
  const allowed = new Set(allowedPricesMinor.map((minor) => Math.round(minor / 100)));
  for (const match of body.matchAll(/(?:NPR|Rs\.?|रु\.?)\s?([0-9][0-9,]*)/gi)) {
    const rupees = Number(match[1].replace(/,/g, ""));
    if (!allowed.has(rupees)) violations.push(`Unapproved amount ${match[0]}`);
  }
  if (/\b\d{1,2}\s?%/.test(body) && !options.allowDiscountWords) violations.push("Percentage figure (possible discount) in reply");
  if (/(is|are|it's|software is)\s+(ird|government)[- ]?(approved|certified)/i.test(body) && !/(can't|cannot|don't|do not)\s+describe/i.test(body)) violations.push("IRD/government certification claim");
  if (/\b(we (have )?received your payment|your payment (has been|is|was) (received|confirmed|verified)|payment received)\b/i.test(body)) violations.push("Payment receipt claimed by AI");
  if (/\b(supports?|includes?|has) multi-?branch\b/i.test(body)) violations.push("Multi-branch promise");
  if (/\b(24\/7|lifetime|guarantee(d)?|unlimited)\b/i.test(body)) violations.push("Unapproved absolute promise");
  if (/\bfree (trial|months?)\b/i.test(body) && !/try it is a live demo/i.test(body)) violations.push("Unapproved free offer");
  return violations;
}

export function draftViolations(draft: ReplyDraft, allowedPricesMinor: number[]): string[] {
  const violations = replySafetyViolations(draft.body, allowedPricesMinor);
  if (draft.intent === "DO_NOT_CONTACT" && draft.body) violations.push("Reply drafted after opt-out");
  if (draft.intent === "NEGOTIATION" && !draft.requiresHuman) violations.push("Negotiation without human");
  if (draft.intent === "PAYMENT_QUERY" && !draft.requiresHuman) violations.push("Payment step without human");
  if (draft.intent === "NOT_INTERESTED" && !draft.nextActions.includes("STOP_FOLLOW_UP")) violations.push("Not-interested without stopping follow-ups");
  return violations;
}
