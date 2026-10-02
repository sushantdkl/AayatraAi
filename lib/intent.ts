import { matchTopic } from "@/lib/sales-playbook";

export const intents = [
  "GREETING", "GENERAL_QUESTION", "FEATURE_QUESTION", "PRICE_QUERY", "PACKAGE_QUERY",
  "DEMO_REQUEST", "MEETING_REQUEST", "IMPLEMENTATION_QUERY", "SUPPORT_QUERY",
  "OBJECTION_PRICE", "OBJECTION_EXISTING_SYSTEM", "OBJECTION_TIMING", "NEGOTIATION",
  "PROPOSAL_REQUEST", "PAYMENT_QUERY", "PURCHASE_INTENT", "NOT_INTERESTED",
  "FOLLOW_UP_LATER", "DO_NOT_CONTACT", "CUSTOM_REQUIREMENT", "LEGAL_OR_CONTRACT",
  "SECURITY_QUESTION", "COMPLAINT", "TAX_REGISTRATION_QUERY", "HARDWARE_QUERY", "UNKNOWN",
] as const;
export type Intent = (typeof intents)[number];
export type IntentResult = { intent: Intent; needsHuman: boolean; reason: string };
export type Language = "EN" | "NE" | "NE_ROMAN";

export const CLASSIFIER_VERSION = "RULES_V2";

/** Devanagari text has no \b word boundaries in JS regex, so it gets its own substring patterns. */
type Rule = { intent: Intent; needsHuman: boolean; reason: string; latin?: RegExp; devanagari?: RegExp };

const rules: Rule[] = [
  { intent: "DO_NOT_CONTACT", needsHuman: true, reason: "Explicit opt-out language",
    latin: /\b(stop|unsubscribe|do not contact|don't contact|no more messages|message nagarnu|samparka nagarnu|message napathaunu)\b/,
    devanagari: /(सम्पर्क नगर्नु|म्यासेज नपठाउनु|सन्देश नपठाउनु)/ },
  { intent: "LEGAL_OR_CONTRACT", needsHuman: true, reason: "Legal or contractual terms",
    latin: /\b(contract|agreement|legal|liability|privacy policy|data protection|sla|terms and conditions)\b/,
    devanagari: /(सम्झौता|कानुनी)/ },
  { intent: "TAX_REGISTRATION_QUERY", needsHuman: true, reason: "Tax/registration claims need the configured company record",
    latin: /\b(vat|pan( number| no)?|ird|tax invoice|tax bill|government (approved|certified)|sarkar(i)? (approved|certified))\b/,
    devanagari: /(भ्याट|प्यान|कर बिल|आन्तरिक राजस्व)/ },
  { intent: "COMPLAINT", needsHuman: true, reason: "Complaint or service issue",
    latin: /\b(refund|fraud|broken|complaint|not working|angry|issue with support|chaldaina|bigriyo)\b/,
    devanagari: /(चल्दैन|बिग्रियो|गुनासो)/ },
  { intent: "SECURITY_QUESTION", needsHuman: true, reason: "Security review",
    latin: /\b(security|encrypt\w*|penetration test|data residency|audit report|hack\w*|data safe)\b/ },
  { intent: "NOT_INTERESTED", needsHuman: false, reason: "Negative response",
    latin: /\b(not interested|no thanks|no thank you|no need|not needed|chahidaina|chaidaina|chahindaina|pardaina|interest chaina|interested chaina|chainna)\b/,
    devanagari: /(चाहिँदैन|चाहिदैन|पर्दैन|रुचि छैन)/ },
  { intent: "PAYMENT_QUERY", needsHuman: true, reason: "Payment step needs official details and human verification",
    latin: /\b(qr|payment|pay garnu|pay garchu|bank details|account number|esewa|khalti|fonepay|proceed garam|proceed garaun|paisa pathau|transfer garchu|advance|send (the )?money|where (do|should|can) (i|we) pay|gardiye|gareko chu|payment gare|already paid|i have paid)\b/,
    devanagari: /(भुक्तानी|पेमेन्ट|क्यूआर|खाता नम्बर|पैसा पठाउ)/ },
  { intent: "PROPOSAL_REQUEST", needsHuman: true, reason: "Document request",
    latin: /\b((send|share) (me )?(a |the |your )?(final )?(quote|quotation|proposal|price list|price|pricing)|final price patha\w*|proposal patha\w*|quotation patha\w*|quote patha\w*)\b/,
    devanagari: /(प्रस्ताव पठाउ|कोटेशन पठाउ)/ },
  { intent: "NEGOTIATION", needsHuman: true, reason: "Commercial negotiation",
    latin: /\b(discount|negotiate|best price|final price|last price|final kati|final rate|last kati|rate ghata\w*|sasto garna|kam garna milcha|kam garnu|chhut|chut)\b/,
    devanagari: /(छुट|अन्तिम मूल्य|सस्तो गर्न|घटाउन)/ },
  { intent: "PURCHASE_INTENT", needsHuman: true, reason: "Explicit buying language",
    latin: /\b(ready to (buy|purchase|start)|go ahead|let'?s go|proceed with|we'?ll take|we will take|we will buy|i want to buy|purchase order|kinna chahanchu|kinchu|line chu|linchhu|start garam|confirm garchu)\b/,
    devanagari: /(किन्छु|लिन्छु|किन्न चाहन्छु)/ },
  { intent: "FOLLOW_UP_LATER", needsHuman: false, reason: "Requested later timing",
    latin: /\b(next month|next week|later|after (dashain|tihar)|follow up later|pachi kura gar\w*|pachi garaula|aile haina)\b/,
    devanagari: /(पछि कुरा|अर्को महिना|दशैं पछि|तिहार पछि)/ },
  { intent: "DEMO_REQUEST", needsHuman: false, reason: "Demo request",
    latin: /\b(demo|demonstration|show me|show (us )?(the|your) (software|system|app)|herna chahanchu|dekhaunu)\b/,
    devanagari: /(डेमो|देखाउनु|हेर्न चाहन्छु)/ },
  { intent: "MEETING_REQUEST", needsHuman: true, reason: "Meeting request",
    latin: /\b(meeting|schedule a call|book a call|bhetnu|call garnu|visit garnu)\b/,
    devanagari: /(भेट्नु|कल गर्नु|भेटघाट)/ },
  { intent: "FEATURE_QUESTION", needsHuman: true, reason: "Capability question needs verified product facts",
    latin: /\b(does (it|the \w+|\w+) (support|include|have|handle)|can it|multi.?branch|branches|offline|internet (gayo|jancha|chaina)|counters?|chalcha|does it print|print\w* (kitchen|kot|bill)|on (my )?phone|outlets?|can one system|handle both)\b/ },
  { intent: "OBJECTION_PRICE", needsHuman: false, reason: "Price objection",
    latin: /\b(too expensive|expensive|mahango|budget chaina|costly|cheaper (plan|option)|sasto (plan|option|cha))\b/,
    devanagari: /(महँगो|महंगो)/ },
  { intent: "OBJECTION_EXISTING_SYSTEM", needsHuman: false, reason: "Already uses another system",
    latin: /\b(already (have|use|using)|existing (system|software)|aru software|arko software|current (pos|system|software)|happy with (our|the))\b/ },
  { intent: "HARDWARE_QUERY", needsHuman: false, reason: "Hardware question",
    latin: /\b(printers?|scanners?|barcode gun|label printers?|hardware)\b/,
    devanagari: /(प्रिन्टर|स्क्यानर)/ },
  { intent: "PRICE_QUERY", needsHuman: false, reason: "Pricing question answered from canonical catalogue",
    latin: /\b(price|pricing|cost|how much|kati|rate|charge|paisa)\b/,
    devanagari: /(कति|मूल्य|दाम|शुल्क)/ },
  { intent: "PACKAGE_QUERY", needsHuman: false, reason: "Package question",
    latin: /\b(package|plan|subscription|starter|growth|enterprise)\b/,
    devanagari: /(प्याकेज|योजना)/ },
  { intent: "CUSTOM_REQUIREMENT", needsHuman: true, reason: "Custom development/integration needs technical review",
    latin: /\b(custom|customi[sz]e|integration|integrate|api|special requirement|websites?|ecommerce|e-commerce|chatbot|automation|online store)\b/ },
  { intent: "IMPLEMENTATION_QUERY", needsHuman: true, reason: "Implementation/training question",
    latin: /\b(install|installation|setup|training|implementation|data import|import|excel|migrate|migration|train (my|our) \w+)\b/,
    devanagari: /(जडान|तालिम)/ },
  { intent: "GENERAL_QUESTION", needsHuman: false, reason: "General product question",
    latin: /\b(what is (your|the)|what do you (do|offer|sell)|tell me about|k ho|ke ho|ke ke cha|k k cha)\b/,
    devanagari: /(के हो|के के छ)/ },
  { intent: "FEATURE_QUESTION", needsHuman: true, reason: "Feature question needs verified product facts",
    latin: /\b(feature|function|include|support|can it|milcha|cha ki|xa ki|hunchha|huncha|garna milcha|branch|kot|inventory|stock|report)\b/,
    devanagari: /(मिल्छ|छ कि|हुन्छ|सुविधा)/ },
  { intent: "GREETING", needsHuman: false, reason: "Greeting only",
    latin: /\b(hello|hi|hey|namaste|namaskar|hajur)\b/,
    devanagari: /(नमस्ते|नमस्कार)/ },
];

export function normalizeMessage(body: string): string {
  return body.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

export function classifyIntent(body: string): IntentResult {
  const value = normalizeMessage(body);
  for (const rule of rules) {
    if (rule.latin?.test(value) || rule.devanagari?.test(value))
      return { intent: rule.intent, needsHuman: rule.needsHuman, reason: rule.reason };
  }
  const topic = matchTopic(body);
  if (topic) return { intent: topic.intent, needsHuman: topic.requiresHuman, reason: `Playbook topic ${topic.key}` };
  return { intent: "UNKNOWN", needsHuman: true, reason: "No high-confidence deterministic rule" };
}

const romanMarkers = /\b(ho|cha|chha|xa|chaina|kati|garnu|garna|garam|garchu|pathaunu|pathau|malai|hajur|ramro|kasari|k|ke|hunchha|huncha|milcha|ma|tapai|hamro|bhayo|chahiyo|chahincha|dinu|lagi|kura|aile|pachi|sanga|ni|la|hai|ko|ra|aba|bhane|haru|namaste|namaskar|dhanyabad|\w+(?:nu|chhau|chau|ncha|dina|aula|idinu|aucha|aaucha|cha|chha|chu|iye|iyo|aina|daina))\b/g;

export function detectLanguage(body: string): Language {
  if (/[ऀ-ॿ]/.test(body)) return "NE";
  const value = normalizeMessage(body);
  const hits = value.match(romanMarkers)?.length ?? 0;
  const words = value.split(/\s+/).filter(Boolean).length;
  return hits >= 1 && (hits >= 2 || words <= 4) ? "NE_ROMAN" : "EN";
}

export type MessageSignals = {
  productFamily: "RESTAURANT_SYSTEM" | "RETAIL_ERP" | "HOTEL_SYSTEM" | "HOTEL_RESTAURANT_COMBINED" | "SALON_SYSTEM" | null;
  packageCode: "STARTER" | "GROWTH" | "ENTERPRISE" | null;
  billing: "MONTH" | "YEAR" | null;
  mentionsHardware: boolean;
  hasEquipment: boolean;
};

export function extractSignals(body: string): MessageSignals {
  const value = normalizeMessage(body);
  const has = (pattern: RegExp) => pattern.test(value);
  const hotel = has(/\b(hotel|resort|lodge|homestay|rooms?)\b|होटल/);
  const restaurant = has(/\b(restaurant|resturant|cafe|café|restro|bar|dining|kitchen|momo|khaja ghar|bhojanalaya|hotel ?and ?restaurant)\b|रेस्टुरेन्ट|क्याफे|भोजनालय/);
  const productFamily: MessageSignals["productFamily"] =
    hotel && restaurant ? "HOTEL_RESTAURANT_COMBINED" :
    hotel ? "HOTEL_SYSTEM" :
    restaurant ? "RESTAURANT_SYSTEM" :
    has(/\b(retail|shop|store|pasal|mart|grocery|kirana|boutique|cosmetic|pharmacy|supermarket)\b|पसल|स्टोर/) ? "RETAIL_ERP" :
    has(/\b(salon|saloon|parlour|parlor|barber|haircut|spa)\b|सैलुन|पार्लर/) ? "SALON_SYSTEM" : null;
  const packageCode = has(/\bstarter\b|स्टार्टर/) ? "STARTER" : has(/\bgrowth\b|ग्रोथ/) ? "GROWTH" : has(/\benterprise\b|इन्टरप्राइज/) ? "ENTERPRISE" : null;
  const billing = has(/\b(month|monthly|mahina|masik)\b|महिना|मासिक/) ? "MONTH" : has(/\b(year|yearly|annual|barsa|barshik)\b|वर्ष|वार्षिक/) ? "YEAR" : null;
  return {
    productFamily, packageCode, billing,
    mentionsHardware: has(/\b(printer|scanner|barcode|hardware|label)\b|प्रिन्टर|स्क्यानर/),
    hasEquipment: has(/\b(already have|have (a |the )?(computer|printer|equipment|laptop)|equipment cha|computer cha|printer cha)\b/),
  };
}
