import { classifyIntent, detectLanguage, extractSignals, type Intent, type Language, type MessageSignals } from "@/lib/intent";
import { matchFeature, salesPolicy, type FeatureRecord } from "@/lib/feature-matrix";
import { formatNpr } from "@/lib/owner-config";
import { matchTopic, type PlaybookTopic } from "@/lib/sales-playbook";
import { nextTemperature, temperatureForIntent, type Temperature } from "@/lib/sales-temperature";

export const REPLY_GENERATOR_VERSION = "GROUNDED_TEMPLATES_V1";

/**
 * Grounded reply drafting. Every price comes from the active canonical catalogue (sku → minor units),
 * every feature statement from the feature-claim matrix, and every company fact from the company profile.
 * Nothing here can discount, verify a payment, promise multi-branch or claim IRD certification.
 */
export type ReplyContext = {
  company: { name: string; brand: string; whatsapp: string | null; taxStatus: "PAN_ONLY" | "VAT_REGISTERED"; panNumber: string | null; panVerified: boolean };
  prices: Record<string, number>;
  features: FeatureRecord[];
  /** Product family → healthy, owner-reviewed demo URL. Empty until a demo is configured. */
  demoLinks: Partial<Record<string, string>>;
  /** Product family inferred from the lead (industry) when the message does not say. */
  leadFamily: string | null;
  temperature: Temperature;
};

export type NextAction =
  | "NOTIFY_SALES" | "SCHEDULE_DEMO" | "SCHEDULE_MEETING" | "CREATE_QUOTE_DRAFT" | "MOVE_TO_NEGOTIATING"
  | "CREATE_PAYMENT_REQUEST" | "STOP_FOLLOW_UP" | "SCHEDULE_FOLLOW_UP" | "ESCALATE_FEATURE_VERIFICATION"
  | "ESCALATE_SUPPORT" | "RECORD_OPT_OUT";

export type ReplyDraft = {
  intent: Intent;
  language: Language;
  temperature: Temperature;
  /** null means: do not reply (e.g. opt-out). */
  body: string | null;
  requiresHuman: boolean;
  /** The text itself is safe to send without edits, if the owner enables automatic replies. */
  autoSendEligible: boolean;
  escalationReasons: string[];
  citations: { skus: string[]; features: string[] };
  nextActions: NextAction[];
};

type Text = Record<Language, string>;
const pick = (language: Language, text: Text) => text[language];

const AUTO_SEND_SAFE = new Set<Intent>(["GREETING", "PRICE_QUERY", "PACKAGE_QUERY", "HARDWARE_QUERY", "DEMO_REQUEST", "NOT_INTERESTED", "FOLLOW_UP_LATER", "OBJECTION_PRICE", "OBJECTION_EXISTING_SYSTEM"]);

function contactLine(language: Language, whatsapp: string | null): string {
  if (!whatsapp) return "";
  return pick(language, {
    EN: ` You can also reach us on WhatsApp at ${whatsapp}.`,
    NE: ` तपाईं हामीलाई ${whatsapp} मा WhatsApp पनि गर्न सक्नुहुन्छ।`,
    NE_ROMAN: ` Hami lai ${whatsapp} ma WhatsApp pani garna saknu huncha.`,
  });
}

function price(context: ReplyContext, sku: string, cited: string[]): string | null {
  const value = context.prices[sku];
  if (value === undefined) return null;
  cited.push(sku);
  return formatNpr(value);
}

function restaurantPrices(language: Language, context: ReplyContext, cited: string[]): string | null {
  const p = (sku: string) => price(context, sku, cited);
  const [sy, sm, gy, gm, ey, em] = ["STARTER_YEARLY", "STARTER_MONTHLY", "GROWTH_YEARLY", "GROWTH_MONTHLY", "ENTERPRISE_YEARLY", "ENTERPRISE_MONTHLY"].map((key) => p(`RESTAURANT_${key}`));
  if (!sy || !sm || !gy || !gm || !ey || !em) return null;
  return pick(language, {
    EN: `For restaurants, the current standard Aadhar POS plans are Starter at ${sy}/year (or ${sm}/month), Growth at ${gy}/year (or ${gm}/month), and Enterprise at ${ey}/year (or ${em}/month). The right package depends on the features and scale you need.`,
    NE: `रेस्टुरेन्टका लागि Aadhar POS का हालका मानक प्लानहरू: Starter ${sy}/वर्ष (वा ${sm}/महिना), Growth ${gy}/वर्ष (वा ${gm}/महिना) र Enterprise ${ey}/वर्ष (वा ${em}/महिना)। तपाईंलाई चाहिने सुविधा र व्यवसायको आकार अनुसार उपयुक्त प्याकेज छान्न सकिन्छ।`,
    NE_ROMAN: `Restaurant ko lagi Aadhar POS ko current standard plan haru: Starter ${sy}/year (wa ${sm}/month), Growth ${gy}/year (wa ${gm}/month), ra Enterprise ${ey}/year (wa ${em}/month). Tapai lai chahine feature ra business ko size anusar sahi package chhanna sakincha.`,
  });
}

function retailPrices(language: Language, context: ReplyContext, cited: string[]): string | null {
  const [monthly, yearly, setup] = ["RETAIL_MONTHLY", "RETAIL_YEARLY", "RETAIL_ONE_TIME_SETUP"].map((sku) => price(context, sku, cited));
  if (!monthly || !yearly || !setup) return null;
  return pick(language, {
    EN: `For retail/small businesses, the current options are ${monthly}/month, ${yearly}/year, or a ${setup} one-time setup option. Hardware is separate if required. Already have the equipment? You can take only our POS system at ${monthly}/month.`,
    NE: `रिटेल/साना व्यवसायका लागि हालका विकल्पहरू: ${monthly}/महिना, ${yearly}/वर्ष, वा ${setup} एक पटकको सेटअप। आवश्यक परे हार्डवेयर छुट्टै पर्छ। तपाईंसँग उपकरण पहिले नै छ भने ${monthly}/महिनामा POS सिस्टम मात्र लिन सक्नुहुन्छ।`,
    NE_ROMAN: `Retail/sano business ko lagi current option haru: ${monthly}/month, ${yearly}/year, wa ${setup} one-time setup. Hardware chahiye bhane chhuttai parcha. Equipment pahile dekhi nai cha bhane ${monthly}/month ma POS system matra lina saknu huncha.`,
  });
}

function hardwarePrices(language: Language, context: ReplyContext, cited: string[]): string | null {
  const [thermal, label, scanner] = ["HW_THERMAL_PRINTER", "HW_THERMAL_LABEL_PRINTER", "HW_BARCODE_SCANNER"].map((sku) => price(context, sku, cited));
  if (!thermal || !label || !scanner) return null;
  return pick(language, {
    EN: `Current hardware pricing is ${thermal} for a thermal printer, ${label} for a thermal + label printer, and ${scanner} for a barcode scanner. Pricing can be discussed depending on the complete setup.`,
    NE: `हालको हार्डवेयर मूल्य: थर्मल प्रिन्टर ${thermal}, थर्मल + लेबल प्रिन्टर ${label}, र बारकोड स्क्यानर ${scanner}। पूरा सेटअप अनुसार मूल्यबारे कुरा गर्न सकिन्छ।`,
    NE_ROMAN: `Current hardware price: thermal printer ${thermal}, thermal + label printer ${label}, ra barcode scanner ${scanner}. Pura setup anusar price ko barema kura garna sakincha.`,
  });
}

function packagePrice(language: Language, context: ReplyContext, packageCode: string, cited: string[]): string | null {
  const yearly = price(context, `RESTAURANT_${packageCode}_YEARLY`, cited);
  const monthly = price(context, `RESTAURANT_${packageCode}_MONTHLY`, cited);
  if (!yearly || !monthly) return null;
  const name = packageCode.charAt(0) + packageCode.slice(1).toLowerCase();
  return pick(language, {
    EN: `The standard price for the restaurant ${name} package is ${yearly}/year (or ${monthly}/month).`,
    NE: `रेस्टुरेन्ट ${name} प्याकेजको मानक मूल्य ${yearly}/वर्ष (वा ${monthly}/महिना) हो।`,
    NE_ROMAN: `Restaurant ${name} package ko standard price ${yearly}/year (wa ${monthly}/month) ho.`,
  });
}

const askBusinessType: Text = {
  EN: "What kind of business is it — restaurant/café, retail shop, hotel or salon? Then I can share the exact plan.",
  NE: "तपाईंको व्यवसाय कस्तो हो — रेस्टुरेन्ट/क्याफे, रिटेल पसल, होटल वा सैलुन? त्यसपछि म सही प्लान पठाउँछु।",
  NE_ROMAN: "Tapai ko business kasto ho — restaurant/cafe, retail pasal, hotel wa salon? Tespachi ma sahi plan pathauchu.",
};

const demoOffer: Text = {
  EN: " Would you like to see a demo?",
  NE: " के तपाईं डेमो हेर्न चाहनुहुन्छ?",
  NE_ROMAN: " Demo herna chahanu huncha?",
};

function familyFor(signals: MessageSignals, context: ReplyContext): string | null {
  return signals.productFamily ?? context.leadFamily;
}

function featureReply(language: Language, feature: FeatureRecord | null, topic: string, out: { reasons: string[]; features: string[]; actions: NextAction[] }): { text: string; human: boolean } {
  if (!feature) {
    out.reasons.push(`No verified feature record matches the question (${topic})`);
    out.actions.push("ESCALATE_FEATURE_VERIFICATION");
    return { human: true, text: pick(language, {
      EN: "Let me confirm that with our product team before I answer, so I give you accurate information. We'll get back to you shortly.",
      NE: "सही जानकारी दिन म यो कुरा हाम्रो प्रोडक्ट टिमसँग पक्का गरेर छिट्टै जवाफ दिन्छु।",
      NE_ROMAN: "Sahi information dina ma yo kura hamro product team sanga confirm garera chhito reply garchu.",
    }) };
  }
  out.features.push(feature.feature_key);
  const policy = salesPolicy[feature.implementation_status];
  const name = feature.name;
  if (feature.feature_key === "MULTI_BRANCH") {
    out.reasons.push("MULTI_BRANCH is NOT_SALES_SAFE in the current source; escalated for verification");
    out.actions.push("ESCALATE_FEATURE_VERIFICATION");
    return { human: true, text: pick(language, {
      EN: "Multi-branch capability needs to be confirmed against the current deployment/version before I include it in your package. I can escalate that requirement for verification.",
      NE: "मल्टि-ब्रान्च सुविधा तपाईंको प्याकेजमा समावेश गर्नुअघि हालको संस्करणमा पक्का गर्नुपर्छ। म यो आवश्यकता प्रमाणीकरणका लागि टिमलाई पठाउन सक्छु।",
      NE_ROMAN: "Multi-branch feature tapai ko package ma rakhnu bhanda pahile current version ma confirm garnu parcha. Ma yo requirement verification ko lagi team lai pathauna sakchu.",
    }) };
  }
  if (feature.feature_key === "IRD_CERTIFICATION") {
    out.reasons.push("IRD-certified software claim is not supported by any document");
    return { human: true, text: pick(language, {
      EN: "I can't describe the Aadhar POS software itself as IRD-certified or government-approved. Our team will share exactly which registration documents apply.",
      NE: "म Aadhar POS सफ्टवेयरलाई IRD-प्रमाणित वा सरकारबाट स्वीकृत भनेर भन्न सक्दिनँ। कुन दर्ता कागजात लागू हुन्छ भन्ने हाम्रो टिमले स्पष्ट रूपमा पठाउनेछ।",
      NE_ROMAN: "Ma Aadhar POS software lai IRD-certified wa government-approved bhanera bhanna sakdina. Kun registration document lagu huncha bhanne hamro team le clear pathaucha.",
    }) };
  }
  switch (policy.treatment) {
    case "SELL":
      return { human: false, text: pick(language, {
        EN: `Yes — ${feature.approved_language ?? name}.`,
        NE: `हो — ${feature.approved_language ?? name}।`,
        NE_ROMAN: `Ho — ${feature.approved_language ?? name}.`,
      }) };
    case "SELL_WITH_CONDITIONS":
      return { human: false, text: pick(language, {
        EN: `Yes, ${name} is available with setup: ${feature.conditions}.`,
        NE: `हो, ${name} सेटअपसहित उपलब्ध छ: ${feature.conditions}।`,
        NE_ROMAN: `Ho, ${name} setup sanga available cha: ${feature.conditions}.`,
      }) };
    case "DISCLOSE_AND_REVIEW":
      out.reasons.push(`${feature.feature_key} is PARTIAL; limitation must be disclosed`);
      return { human: true, text: pick(language, {
        EN: `${name} is partly supported${feature.limitations ? ` (${feature.limitations})` : ""}. Our team will confirm whether it fits your workflow.`,
        NE: `${name} आंशिक रूपमा उपलब्ध छ${feature.limitations ? ` (${feature.limitations})` : ""}। तपाईंको काममा मिल्छ कि मिल्दैन हाम्रो टिमले पक्का गर्नेछ।`,
        NE_ROMAN: `${name} partly available cha${feature.limitations ? ` (${feature.limitations})` : ""}. Tapai ko kaam ma milcha ki mildaina hamro team le confirm garcha.`,
      }) };
    case "NOT_STANDARD":
      out.reasons.push(`${feature.feature_key} is BETA; not a standard production feature`);
      return { human: true, text: pick(language, {
        EN: `${name} is still in testing and isn't part of our standard package yet. Our team can discuss it with you.`,
        NE: `${name} अझै परीक्षणमा छ र हाम्रो मानक प्याकेजमा समावेश छैन। यसबारे हाम्रो टिमले कुरा गर्नेछ।`,
        NE_ROMAN: `${name} ajhai testing ma cha ra standard package ma chaina. Yesko barema hamro team le kura garcha.`,
      }) };
    case "TECHNICAL_REVIEW":
      out.reasons.push(`${feature.feature_key} is CUSTOM_ONLY; technical/commercial review required`);
      out.actions.push("NOTIFY_SALES");
      return { human: true, text: pick(language, {
        EN: `${name} would be custom work. Our technical team will review your requirement and get back to you.`,
        NE: `${name} कस्टम काम हुन्छ। हाम्रो प्राविधिक टिमले तपाईंको आवश्यकता हेरेर जवाफ दिनेछ।`,
        NE_ROMAN: `${name} custom kaam huncha. Hamro technical team le tapai ko requirement herera reply garcha.`,
      }) };
    case "NOT_AVAILABLE_NOW":
    case "SAY_UNAVAILABLE":
      return { human: false, text: pick(language, {
        EN: `${name} isn't available in the current version.`,
        NE: `${name} हालको संस्करणमा उपलब्ध छैन।`,
        NE_ROMAN: `${name} current version ma available chaina.`,
      }) };
    default:
      out.reasons.push(`${feature.feature_key} availability is UNKNOWN; do not guess`);
      out.actions.push("ESCALATE_FEATURE_VERIFICATION");
      return { human: true, text: pick(language, {
        EN: `Let me confirm ${name} with our product team before I answer, so I give you accurate information. You'll also see it live in the demo.`,
        NE: `सही जानकारी दिन म ${name} बारे हाम्रो प्रोडक्ट टिमसँग पक्का गर्छु। डेमोमा पनि तपाईं प्रत्यक्ष हेर्न सक्नुहुन्छ।`,
        NE_ROMAN: `Sahi information dina ma ${name} barema hamro product team sanga confirm garchu. Demo ma pani live herna saknu huncha.`,
      }) };
  }
}

/** Intents where a playbook topic gives a better, still-grounded answer than the generic path. */
const TOPIC_INTENTS = new Set<Intent>(["GREETING", "GENERAL_QUESTION", "FEATURE_QUESTION", "UNKNOWN", "CUSTOM_REQUIREMENT", "IMPLEMENTATION_QUERY", "OBJECTION_PRICE", "OBJECTION_EXISTING_SYSTEM", "OBJECTION_TIMING", "SUPPORT_QUERY"]);
const PRICE_OVERRIDE_TOPICS = new Set(["HOTEL", "SALON", "WEBSITE_ECOMMERCE", "SOCIAL_COMMERCE", "AI_AUTOMATION"]);

function topicFor(intent: Intent, message: string): PlaybookTopic | null {
  const topic = matchTopic(message);
  if (!topic) return null;
  if (TOPIC_INTENTS.has(intent)) return topic;
  if ((intent === "PRICE_QUERY" || intent === "PACKAGE_QUERY") && PRICE_OVERRIDE_TOPICS.has(topic.key)) return topic;
  return null;
}

/** Replace {SKU} placeholders with canonical prices; drop the parenthetical if a price is missing. */
function fillPrices(text: string, prices: Record<string, number>, cited: string[]): string {
  return text.replace(/\s*\(([^()]*)\{([A-Z_]+)\}([^()]*)\)/g, (whole, before: string, sku: string, after: string) => {
    if (prices[sku] === undefined) return "";
    cited.push(sku);
    return ` (${before}${formatNpr(prices[sku])}${after})`;
  });
}

export function draftReply(message: string, context: ReplyContext, options: { language?: Language } = {}): ReplyDraft {
  const { intent, needsHuman } = classifyIntent(message);
  const language = options.language ?? detectLanguage(message);
  const signals = extractSignals(message);
  const temperature = nextTemperature(context.temperature, temperatureForIntent(intent));
  const skus: string[] = [];
  const out = { reasons: [] as string[], features: [] as string[], actions: [] as NextAction[] };
  let human = needsHuman;
  let body: string | null;
  const family = familyFor(signals, context);
  const contact = contactLine(language, context.company.whatsapp);

  const priceFor = (): string | null => {
    if (signals.mentionsHardware && !family) return hardwarePrices(language, context, skus);
    if (family === "RESTAURANT_SYSTEM" || family === "HOTEL_RESTAURANT_COMBINED") {
      const text = signals.packageCode ? packagePrice(language, context, signals.packageCode, skus) : restaurantPrices(language, context, skus);
      if (family === "HOTEL_RESTAURANT_COMBINED") out.reasons.push("Hotel module pricing is not in the canonical catalogue");
      return text;
    }
    if (family === "RETAIL_ERP") return retailPrices(language, context, skus);
    return null;
  };

  const topic = topicFor(intent, message);
  if (topic) {
    body = fillPrices(pick(language, topic.text), context.prices, skus);
    human = topic.requiresHuman;
    if (topic.escalation) out.reasons.push(topic.escalation);
    out.actions.push(...topic.actions);
    if (topic.featureKey) out.features.push(topic.featureKey);
  } else switch (intent) {
    case "GREETING":
      body = pick(language, {
        EN: `Namaste! Thank you for contacting ${context.company.name} (${context.company.brand}). We provide billing, inventory and reporting systems for restaurants, retail shops, hotels and salons. ${askBusinessType.EN}`,
        NE: `नमस्ते! ${context.company.name} (${context.company.brand}) मा सम्पर्क गर्नुभएकोमा धन्यवाद। हामी रेस्टुरेन्ट, रिटेल पसल, होटल र सैलुनका लागि बिलिङ, इन्भेन्टरी र रिपोर्टिङ सिस्टम उपलब्ध गराउँछौं। ${askBusinessType.NE}`,
        NE_ROMAN: `Namaste! ${context.company.name} (${context.company.brand}) ma contact garnu bhayeko ma dhanyabad. Hami restaurant, retail pasal, hotel ra salon ko lagi billing, inventory ra reporting system dinchhau. ${askBusinessType.NE_ROMAN}`,
      });
      break;

    case "PRICE_QUERY":
    case "PACKAGE_QUERY": {
      const text = priceFor();
      if (text) {
        const hardware = signals.mentionsHardware && family ? hardwarePrices(language, context, skus) : null;
        body = `${text}${hardware ? ` ${hardware}` : ""}${pick(language, demoOffer)}`;
      } else if (family === "HOTEL_SYSTEM" || family === "SALON_SYSTEM") {
        human = true;
        out.reasons.push(`${family} has no canonical price in the catalogue`);
        out.actions.push("NOTIFY_SALES");
        body = pick(language, {
          EN: "Thank you! Pricing for this system depends on your setup, so our sales team will share an exact quote shortly. Could you tell us roughly how many rooms/chairs and users you have?",
          NE: "धन्यवाद! यो सिस्टमको मूल्य तपाईंको सेटअपमा भर पर्छ, त्यसैले हाम्रो सेल्स टिमले छिट्टै सही कोटेशन पठाउनेछ। कति कोठा/कुर्सी र प्रयोगकर्ता छन्, बताइदिनुहुन्छ?",
          NE_ROMAN: "Dhanyabad! Yo system ko price tapai ko setup ma bhar parcha, tesaile hamro sales team le chhito exact quote pathaucha. Kati room/chair ra user chan, bhanidinu huncha?",
        });
      } else {
        const from = [context.prices.RESTAURANT_STARTER_MONTHLY, context.prices.RETAIL_MONTHLY];
        if (from[0] !== undefined && from[1] !== undefined) {
          skus.push("RESTAURANT_STARTER_MONTHLY", "RETAIL_MONTHLY");
          body = pick(language, {
            EN: `Restaurant plans start from ${formatNpr(from[0])}/month and retail POS from ${formatNpr(from[1])}/month. ${askBusinessType.EN}`,
            NE: `रेस्टुरेन्ट प्लान ${formatNpr(from[0])}/महिनादेखि र रिटेल POS ${formatNpr(from[1])}/महिनादेखि सुरु हुन्छ। ${askBusinessType.NE}`,
            NE_ROMAN: `Restaurant plan ${formatNpr(from[0])}/month dekhi ra retail POS ${formatNpr(from[1])}/month dekhi suru huncha. ${askBusinessType.NE_ROMAN}`,
          });
        } else {
          human = true;
          out.reasons.push("Canonical prices are not active in the catalogue");
          body = pick(language, askBusinessType);
        }
      }
      break;
    }

    case "HARDWARE_QUERY": {
      const text = hardwarePrices(language, context, skus);
      if (text) body = text;
      else { human = true; out.reasons.push("Hardware prices are not active"); body = pick(language, { EN: "Our team will confirm hardware pricing for you shortly.", NE: "हाम्रो टिमले हार्डवेयरको मूल्य छिट्टै पक्का गरेर पठाउनेछ।", NE_ROMAN: "Hamro team le hardware ko price chhito confirm garera pathaucha." }); }
      break;
    }

    case "NEGOTIATION": {
      human = true;
      out.actions.push("MOVE_TO_NEGOTIATING", "NOTIFY_SALES");
      out.reasons.push("Discount/final price needs human approval (AI autonomous discount = 0%)");
      const standard = signals.packageCode ? packagePrice(language, context, signals.packageCode, skus) : null;
      body = `${standard ? `${standard} ` : ""}${pick(language, {
        EN: "Pricing is negotiable depending on your complete setup. I'll ask our sales team to confirm the best final offer for you shortly. Which billing do you prefer — yearly or monthly — and do you need any hardware?",
        NE: "तपाईंको पूरा सेटअप अनुसार मूल्यमा कुरा गर्न सकिन्छ। उत्तम अन्तिम अफर हाम्रो सेल्स टिमले छिट्टै पक्का गर्नेछ। तपाईंलाई वार्षिक कि मासिक बिलिङ चाहिन्छ, र कुनै हार्डवेयर चाहिन्छ?",
        NE_ROMAN: "Tapai ko pura setup anusar price ma kura garna sakincha. Best final offer hamro sales team le chhito confirm garcha. Yearly ki monthly billing chahincha, ra kunai hardware chahincha?",
      })}`;
      break;
    }

    case "OBJECTION_PRICE": {
      const r = context.prices.RESTAURANT_STARTER_MONTHLY, t = context.prices.RETAIL_MONTHLY;
      if (r !== undefined && t !== undefined) {
        skus.push("RESTAURANT_STARTER_MONTHLY", "RETAIL_MONTHLY");
        body = pick(language, {
          EN: `I understand. Many businesses start with a monthly plan — restaurants from ${formatNpr(r)}/month and retail from ${formatNpr(t)}/month — so there's no large upfront cost. If you already have a computer or printer, you only need the software. Would that work for you?`,
          NE: `बुझें। धेरै व्यवसायहरू मासिक प्लानबाट सुरु गर्छन् — रेस्टुरेन्ट ${formatNpr(r)}/महिनादेखि र रिटेल ${formatNpr(t)}/महिनादेखि — त्यसैले सुरुमा ठूलो खर्च लाग्दैन। कम्प्युटर वा प्रिन्टर पहिले नै छ भने सफ्टवेयर मात्र लिए पुग्छ। यो मिल्छ?`,
          NE_ROMAN: `Bujhe. Dherai business monthly plan bata suru garchan — restaurant ${formatNpr(r)}/month dekhi ra retail ${formatNpr(t)}/month dekhi — tesaile suru ma thulo kharcha lagdaina. Computer wa printer pahile nai cha bhane software matra lida pugcha. Yo milcha?`,
        });
      } else { human = true; body = pick(language, { EN: "I understand. Our team will suggest the most affordable option for you.", NE: "बुझें। हाम्रो टिमले तपाईंका लागि सबैभन्दा किफायती विकल्प सुझाउनेछ।", NE_ROMAN: "Bujhe. Hamro team le tapai ko lagi sabai bhanda affordable option suggest garcha." }); }
      break;
    }

    case "OBJECTION_EXISTING_SYSTEM":
      body = pick(language, {
        EN: "That's great that you already use a system. If you ever want to compare, we can show you a short Aadhar POS demo — no commitment needed.",
        NE: "तपाईंले पहिले नै सिस्टम प्रयोग गर्नुभएको राम्रो कुरा हो। तुलना गर्न चाहनुभयो भने Aadhar POS को छोटो डेमो देखाउन सक्छौं — कुनै बाध्यता छैन।",
        NE_ROMAN: "Tapai le pahile nai system use garnu bhayeko ramro kura ho. Compare garna chahanu bhayo bhane Aadhar POS ko chhoto demo dekhauna sakchhau — kunai badhyata chaina.",
      });
      break;

    case "DEMO_REQUEST": {
      out.actions.push("SCHEDULE_DEMO");
      const link = family ? context.demoLinks[family] : undefined;
      body = link ? pick(language, {
        EN: `Sure! You can explore the demo here: ${link} — and our team can also walk you through it live. What time suits you?`,
        NE: `अवश्य! डेमो यहाँ हेर्न सक्नुहुन्छ: ${link} — हाम्रो टिमले प्रत्यक्ष रूपमा पनि देखाउन सक्छ। तपाईंलाई कुन समय मिल्छ?`,
        NE_ROMAN: `Pakka! Demo yaha herna saknu huncha: ${link} — hamro team le live pani dekhauna sakcha. Tapai lai kun time milcha?`,
      }) : pick(language, {
        EN: `We'd be happy to show you an Aadhar POS demo. Our team will arrange it — what day and time suits you?${family ? "" : ` ${askBusinessType.EN}`}`,
        NE: `Aadhar POS को डेमो देखाउन पाउँदा खुसी लाग्छ। हाम्रो टिमले मिलाउनेछ — तपाईंलाई कुन दिन र समय मिल्छ?${family ? "" : ` ${askBusinessType.NE}`}`,
        NE_ROMAN: `Aadhar POS ko demo dekhauna paunda khusi lagcha. Hamro team le milaucha — tapai lai kun din ra time milcha?${family ? "" : ` ${askBusinessType.NE_ROMAN}`}`,
      });
      break;
    }

    case "MEETING_REQUEST":
      out.actions.push("SCHEDULE_MEETING", "NOTIFY_SALES");
      body = `${pick(language, {
        EN: "Sure — what day and time suits you, and should we call or visit?",
        NE: "अवश्य — तपाईंलाई कुन दिन र समय मिल्छ, र कल गरौं कि भेट्न आऔं?",
        NE_ROMAN: "Pakka — tapai lai kun din ra time milcha, ani call garau ki visit garau?",
      })}${contact}`;
      break;

    case "PROPOSAL_REQUEST":
    case "PURCHASE_INTENT":
      out.actions.push("CREATE_QUOTE_DRAFT", "NOTIFY_SALES");
      out.reasons.push("Quotation must be generated from the catalogue and approved before sending");
      body = pick(language, {
        EN: "Thank you! I'll prepare a quotation for you. Please confirm: 1) business name, 2) package (Starter/Growth/Enterprise or retail plan), 3) yearly or monthly billing, and 4) any hardware needed. Our team will review and send it.",
        NE: "धन्यवाद! म तपाईंका लागि कोटेशन तयार गर्छु। कृपया पक्का गरिदिनुहोस्: १) व्यवसायको नाम, २) प्याकेज (Starter/Growth/Enterprise वा रिटेल प्लान), ३) वार्षिक वा मासिक बिलिङ, ४) चाहिने हार्डवेयर। हाम्रो टिमले जाँचेर पठाउनेछ।",
        NE_ROMAN: "Dhanyabad! Ma tapai ko lagi quotation tayar garchu. Please confirm garidinu: 1) business ko naam, 2) package (Starter/Growth/Enterprise wa retail plan), 3) yearly ki monthly billing, 4) chahine hardware. Hamro team le check garera pathaucha.",
      });
      break;

    case "PAYMENT_QUERY":
      out.actions.push("CREATE_PAYMENT_REQUEST", "NOTIFY_SALES");
      out.reasons.push("Official payment details and verification come from an authorized human");
      body = pick(language, {
        EN: "Thank you for choosing Aadhar POS! Our team will send you the official payment details (bank transfer or QR) for your confirmed quotation shortly. After paying, please share the receipt or transaction ID here — every payment is verified by our team before activation.",
        NE: "Aadhar POS रोज्नुभएकोमा धन्यवाद! पक्का भएको कोटेशनका लागि आधिकारिक भुक्तानी विवरण (बैंक ट्रान्सफर वा QR) हाम्रो टिमले छिट्टै पठाउनेछ। भुक्तानीपछि रसिद वा ट्रान्जेक्सन ID यहाँ पठाइदिनुहोस् — सक्रिय गर्नुअघि हरेक भुक्तानी हाम्रो टिमले जाँच्छ।",
        NE_ROMAN: "Aadhar POS chhannu bhayeko ma dhanyabad! Confirm bhayeko quotation ko official payment detail (bank transfer wa QR) hamro team le chhito pathaucha. Payment pachi receipt wa transaction ID yaha pathaidinu — activate garnu bhanda pahile harek payment hamro team le check garcha.",
      });
      break;

    case "TAX_REGISTRATION_QUERY": {
      const certificationAsked = /ird|government|sarkar|सरकार|आन्तरिक राजस्व/i.test(message) && /approv|certif|प्रमाणित|स्वीकृत/i.test(message);
      const registration = context.company.panVerified && context.company.panNumber
        ? pick(language, {
          EN: `${context.company.name} is PAN-registered with Nepal's Inland Revenue Department (PAN ${context.company.panNumber}).`,
          NE: `${context.company.name} नेपालको आन्तरिक राजस्व विभागमा PAN दर्ता भएको छ (PAN ${context.company.panNumber})।`,
          NE_ROMAN: `${context.company.name} Nepal ko Inland Revenue Department ma PAN registered cha (PAN ${context.company.panNumber}).`,
        })
        : pick(language, {
          EN: "Our team will share the company's registration details with you.",
          NE: "कम्पनीको दर्ता विवरण हाम्रो टिमले पठाउनेछ।",
          NE_ROMAN: "Company ko registration detail hamro team le pathaucha.",
        });
      const vat = context.company.taxStatus === "PAN_ONLY" ? pick(language, {
        EN: " VAT is not separately charged on our quotations under our current registration.",
        NE: " हालको दर्ता अनुसार हाम्रो कोटेशनमा भ्याट छुट्टै लगाइँदैन।",
        NE_ROMAN: " Current registration anusar hamro quotation ma VAT chhuttai lagaidaina.",
      }) : "";
      if (certificationAsked) {
        out.features.push("IRD_CERTIFICATION");
        out.reasons.push("Prospect asked about IRD/government software approval");
      }
      human = certificationAsked || !context.company.panVerified;
      body = `${registration}${vat}${certificationAsked ? ` ${pick(language, {
        EN: "Please note that we don't describe the Aadhar POS software itself as IRD-certified; our team can explain exactly which documentation applies.",
        NE: "कृपया ध्यान दिनुहोस्, हामी Aadhar POS सफ्टवेयरलाई नै IRD-प्रमाणित भनी दाबी गर्दैनौं; कुन कागजात लागू हुन्छ भन्ने हाम्रो टिमले बुझाउनेछ।",
        NE_ROMAN: "Please note, hami Aadhar POS software lai nai IRD-certified bhani claim gardainau; kun document lagu huncha bhanne hamro team le bujhaucha.",
      })}` : ""}`;
      break;
    }

    case "FEATURE_QUESTION":
    case "GENERAL_QUESTION": {
      const feature = matchFeature(message, context.features, family);
      const reply = featureReply(language, feature, message.slice(0, 80), out);
      human = reply.human;
      body = reply.text;
      break;
    }

    case "CUSTOM_REQUIREMENT":
      out.actions.push("NOTIFY_SALES");
      out.reasons.push("Custom development/integration requires technical and commercial review");
      body = pick(language, {
        EN: "Thanks for sharing that. Custom work and integrations are reviewed by our technical team, who will get back to you with what's possible, the timeline and cost.",
        NE: "जानकारीका लागि धन्यवाद। कस्टम काम र इन्टिग्रेसन हाम्रो प्राविधिक टिमले हेर्छ, र के सम्भव छ, समय र लागतबारे जवाफ दिनेछ।",
        NE_ROMAN: "Information ko lagi dhanyabad. Custom kaam ra integration hamro technical team le hercha, ani k sambhav cha, time ra cost barema reply garcha.",
      });
      break;

    case "IMPLEMENTATION_QUERY":
      out.actions.push("NOTIFY_SALES");
      body = pick(language, {
        EN: "Good question. Setup, data import and staff training are handled by our implementation team — they'll confirm the plan and timeline for your business.",
        NE: "राम्रो प्रश्न। सेटअप, डाटा इम्पोर्ट र स्टाफ तालिम हाम्रो इम्प्लिमेन्टेसन टिमले गर्छ — तपाईंको व्यवसायका लागि योजना र समय उहाँहरूले पक्का गर्नुहुनेछ।",
        NE_ROMAN: "Ramro prashna. Setup, data import ra staff training hamro implementation team le garcha — tapai ko business ko lagi plan ra time unihaharu le confirm garnu huncha.",
      });
      break;

    case "FOLLOW_UP_LATER":
    case "OBJECTION_TIMING":
      out.actions.push("SCHEDULE_FOLLOW_UP");
      body = pick(language, {
        EN: "Sure, no rush. When would be a good time for us to check back with you?",
        NE: "हुन्छ, कुनै हतार छैन। हामीले तपाईंलाई फेरि कहिले सम्पर्क गर्दा ठीक होला?",
        NE_ROMAN: "Huncha, kunai hatar chaina. Hami le tapai lai feri kahile contact garda thik hola?",
      });
      break;

    case "NOT_INTERESTED":
      out.actions.push("STOP_FOLLOW_UP");
      body = pick(language, {
        EN: `No problem, thank you for letting us know. We won't follow up further. If you ever need a billing or POS system, just message us${context.company.whatsapp ? ` at ${context.company.whatsapp}` : ""}.`,
        NE: `कुनै समस्या छैन, जानकारी दिनुभएकोमा धन्यवाद। हामी थप फलो-अप गर्ने छैनौं। भविष्यमा बिलिङ वा POS सिस्टम चाहिएमा${context.company.whatsapp ? ` ${context.company.whatsapp} मा` : ""} सम्पर्क गर्नुहोला।`,
        NE_ROMAN: `Kunai problem chaina, information dinu bhayeko ma dhanyabad. Hami thap follow-up garne chhainau. Bhabishya ma billing wa POS system chahiye${context.company.whatsapp ? ` ${context.company.whatsapp} ma` : ""} message garnu hola.`,
      });
      break;

    case "DO_NOT_CONTACT":
      out.actions.push("RECORD_OPT_OUT", "STOP_FOLLOW_UP");
      out.reasons.push("Opt-out: no further messages");
      human = false;
      body = null;
      break;

    case "COMPLAINT":
    case "SUPPORT_QUERY":
      out.actions.push("ESCALATE_SUPPORT");
      out.reasons.push("Service issue must be handled by a person");
      body = pick(language, {
        EN: "Sorry for the trouble. I've flagged this to our support team, and a team member will contact you personally as soon as possible.",
        NE: "असुविधाका लागि माफ गर्नुहोला। मैले यो कुरा हाम्रो सपोर्ट टिमलाई पठाएको छु, टिमको सदस्यले छिट्टै तपाईंलाई व्यक्तिगत रूपमा सम्पर्क गर्नुहुनेछ।",
        NE_ROMAN: "Asubidha ko lagi maaf garnu hola. Maile yo kura hamro support team lai pathaye ko chu, team ko member le chhito tapai lai personally contact garnu huncha.",
      });
      break;

    case "LEGAL_OR_CONTRACT":
    case "SECURITY_QUESTION":
      out.actions.push("NOTIFY_SALES");
      out.reasons.push("Legal/security answers need approved wording (legal_status = REVIEW_REQUIRED)");
      body = pick(language, {
        EN: "Thank you — that's an important question. I've passed it to our team, who will reply with the exact details.",
        NE: "धन्यवाद — यो महत्वपूर्ण प्रश्न हो। मैले हाम्रो टिमलाई पठाएको छु, उहाँहरूले सही विवरणसहित जवाफ दिनुहुनेछ।",
        NE_ROMAN: "Dhanyabad — yo important prashna ho. Maile hamro team lai pathaye ko chu, unihaharu le exact detail sanga reply garnu huncha.",
      });
      break;

    default:
      out.actions.push("NOTIFY_SALES");
      body = `${pick(language, {
        EN: "Thank you for your message. Our team will get back to you shortly.",
        NE: "सन्देशका लागि धन्यवाद। हाम्रो टिमले छिट्टै जवाफ दिनेछ।",
        NE_ROMAN: "Message ko lagi dhanyabad. Hamro team le chhito reply garcha.",
      })}${contact}`;
  }

  // A not-sales-safe claim (multi-branch, IRD certification) mentioned alongside another question is still guarded.
  if (body !== null && !["FEATURE_QUESTION", "GENERAL_QUESTION", "TAX_REGISTRATION_QUERY"].includes(intent)) {
    const unsafe = matchFeature(message, context.features.filter((feature) => feature.commercial_status === "NOT_SALES_SAFE"), family);
    if (unsafe && !out.features.includes(unsafe.feature_key)) {
      const guard = featureReply(language, unsafe, unsafe.name, out);
      body = `${body} ${guard.text}`;
      human ||= guard.human;
    }
  }

  if (human && !out.actions.includes("NOTIFY_SALES") && !out.actions.includes("ESCALATE_SUPPORT")) out.actions.push("NOTIFY_SALES");
  return {
    intent, language, temperature, body,
    requiresHuman: human,
    autoSendEligible: body !== null && !human && AUTO_SEND_SAFE.has(intent) && out.reasons.length === 0,
    escalationReasons: out.reasons,
    citations: { skus: [...new Set(skus)], features: out.features },
    nextActions: [...new Set(out.actions)],
  };
}

/** Follow-up nudges by temperature. Never mention discounts, never pressure. */
export function draftFollowUp(temperature: Temperature, language: Language, attempt: number): string | null {
  const texts: Partial<Record<Temperature, Text>> = {
    WARM: { EN: "Namaste! Just checking in — would you like details on Aadhar POS for your business?", NE: "नमस्ते! तपाईंको व्यवसायका लागि Aadhar POS बारे जानकारी चाहिन्छ कि भनेर सोध्न खोजेको।", NE_ROMAN: "Namaste! Tapai ko business ko lagi Aadhar POS barema information chahincha ki bhanera sodhna khojeko." },
    INTERESTED: { EN: "Namaste! Did you get a chance to look at the plans? I'm happy to answer any questions or arrange a short demo.", NE: "नमस्ते! प्लानहरू हेर्ने मौका पाउनुभयो? कुनै प्रश्न भए सोध्नुहोस्, वा छोटो डेमो मिलाउन सक्छु।", NE_ROMAN: "Namaste! Plan haru herne mauka paunu bhayo? Kunai prashna bhaye sodhnu, wa chhoto demo milauna sakchu." },
    HOT: { EN: "Namaste! Shall we fix a time for your Aadhar POS demo? Let me know a day and time that suits you.", NE: "नमस्ते! तपाईंको Aadhar POS डेमोका लागि समय मिलाऔं? तपाईंलाई मिल्ने दिन र समय बताउनुहोस्।", NE_ROMAN: "Namaste! Tapai ko Aadhar POS demo ko lagi time milau? Tapai lai milne din ra time bhannu." },
    READY_TO_BUY: { EN: "Namaste! To prepare your quotation, could you confirm the package, billing (yearly/monthly) and any hardware needed?", NE: "नमस्ते! कोटेशन तयार गर्न प्याकेज, बिलिङ (वार्षिक/मासिक) र चाहिने हार्डवेयर पक्का गरिदिनुहुन्छ?", NE_ROMAN: "Namaste! Quotation tayar garna package, billing (yearly/monthly) ra chahine hardware confirm garidinu huncha?" },
    NEGOTIATING: { EN: "Namaste! Our team is ready to finalise your offer. Is there anything else you'd like included in the setup?", NE: "नमस्ते! हाम्रो टिम तपाईंको अफर टुंगो लगाउन तयार छ। सेटअपमा अरू केही समावेश गर्न चाहनुहुन्छ?", NE_ROMAN: "Namaste! Hamro team tapai ko offer final garna tayar cha. Setup ma aru kehi rakhna chahanu huncha?" },
    PROPOSAL_SENT: { EN: "Namaste! Did you have a chance to review the quotation? Happy to clarify anything.", NE: "नमस्ते! कोटेशन हेर्ने मौका पाउनुभयो? केही बुझ्नुपर्ने भए भन्नुहोस्।", NE_ROMAN: "Namaste! Quotation herne mauka paunu bhayo? Kehi bujhnu parne bhaye bhannu." },
    PAYMENT_PENDING: { EN: "Namaste! Just a reminder: once payment is done, please share the receipt or transaction ID so our team can verify it and start your setup.", NE: "नमस्ते! सम्झनाका लागि: भुक्तानी भएपछि रसिद वा ट्रान्जेक्सन ID पठाइदिनुहोस्, ताकि हाम्रो टिमले जाँचेर सेटअप सुरु गर्न सकोस्।", NE_ROMAN: "Namaste! Remind garna khojeko: payment bhaye pachi receipt wa transaction ID pathaidinu, hamro team le check garera setup suru garcha." },
  };
  const text = texts[temperature];
  if (!text || attempt < 1) return null;
  return text[language];
}
