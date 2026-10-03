import type { Intent, Language } from "@/lib/intent";
import type { NextAction } from "@/lib/ai-replies";

/**
 * §37 objection engine and common-topic playbook. Each entry records approved facts only:
 * company capabilities confirmed by the owner, onboarding steps from the Aadhar client kit,
 * and nothing about specific product features (those come from the feature-claim matrix).
 */
export type PlaybookTopic = {
  key: string;
  /** Intent used when no stronger classifier rule matched. */
  intent: Intent;
  objectionType: string | null;
  latin?: RegExp;
  devanagari?: RegExp;
  strategy: string;
  prohibitedClaims: string[];
  requiresHuman: boolean;
  escalation: string | null;
  actions: NextAction[];
  /** A feature-matrix key whose status must also be disclosed, if any. */
  featureKey?: string;
  text: Record<Language, string>;
};

export const playbook: PlaybookTopic[] = [
  {
    key: "IDENTITY", intent: "GENERAL_QUESTION", objectionType: null,
    latin: /\b(are you (a )?(bot|robot|ai|human|real person)|who (are you|is this)|timi ko ho|tapai ko hunu|manche ho)\b/,
    devanagari: /(तपाईं को हो|तिमी को हो|मान्छे हो)/,
    strategy: "Be honest that this is an AI assistant; offer a human.",
    prohibitedClaims: ["claiming to be a human"], requiresHuman: false, escalation: null, actions: [],
    text: {
      EN: "I'm Aayatra's AI sales assistant. I can share plans, prices and arrange a demo — and a member of our team can join the chat any time you prefer.",
      NE: "म Aayatra को AI सेल्स सहायक हुँ। म प्लान, मूल्य र डेमोबारे जानकारी दिन सक्छु — तपाईं चाहनुहुन्छ भने हाम्रो टिमको सदस्य जुनसुकै बेला कुराकानीमा जोडिन सक्नुहुन्छ।",
      NE_ROMAN: "Ma Aayatra ko AI sales assistant hu. Ma plan, price ra demo ko barema info dina sakchu — tapai chahanu huncha bhane hamro team ko member jun sukai bela chat ma join huna saknu huncha.",
    },
  },
  {
    key: "LOCATION", intent: "GENERAL_QUESTION", objectionType: null,
    latin: /\b(where (is|are) (your|you)|office (kaha|where)|location|kaha cha|kaha ho|address)\b/,
    devanagari: /(कहाँ छ|ठेगाना|अफिस)/,
    strategy: "State the confirmed city only; never invent a street address.",
    prohibitedClaims: ["unverified street address"], requiresHuman: false, escalation: null, actions: [],
    text: {
      EN: "We're Aayatra Enterprises, based in Kathmandu, Nepal. Our team can arrange an online or in-person demo.",
      NE: "हामी Aayatra Enterprises, काठमाडौं, नेपालमा आधारित छौं। हाम्रो टिमले अनलाइन वा प्रत्यक्ष डेमो मिलाउन सक्छ।",
      NE_ROMAN: "Hami Aayatra Enterprises, Kathmandu, Nepal ma based chau. Hamro team le online wa in-person demo milauna sakcha.",
    },
  },
  {
    key: "THANKS", intent: "GREETING", objectionType: null,
    latin: /^(ok(ay)?|thanks?|thank you|dhanyabad|dhanyavad|ok thanks|hus|huss|hunchha|thik cha)[.! ]*$/,
    devanagari: /^(धन्यवाद|ठिक छ|हुन्छ)[।.! ]*$/,
    strategy: "Short acknowledgement, keep the door open.",
    prohibitedClaims: [], requiresHuman: false, escalation: null, actions: [],
    text: {
      EN: "You're welcome! Message us any time if you have questions or want to see a demo.",
      NE: "धन्यवाद! कुनै प्रश्न भए वा डेमो हेर्न चाहनुभयो भने जुनसुकै बेला सन्देश पठाउनुहोला।",
      NE_ROMAN: "Dhanyabad! Kunai prashna bhaye wa demo herna chahanu bhayo bhane jun sukai bela message garnu hola.",
    },
  },
  {
    key: "OFFLINE", intent: "FEATURE_QUESTION", objectionType: "need offline / internet is weak", featureKey: "OFFLINE_MODE",
    latin: /\b(offline|without internet|internet (chaina|bina|weak|slow|jancha|gayo)|net (jancha|gayo|chaina)|load ?shedding|bijuli jancha)\b/,
    devanagari: /(इन्टरनेट बिना|इन्टरनेट छैन|नेट जान्छ|बत्ती जान्छ|अफलाइन)/,
    strategy: "Acknowledge the concern; do not claim offline support until the feature matrix verifies it; show in demo.",
    prohibitedClaims: ["works fully offline", "never loses data"], requiresHuman: true,
    escalation: "Offline behaviour is UNKNOWN in the feature matrix", actions: ["ESCALATE_FEATURE_VERIFICATION"],
    text: {
      EN: "That's a very real concern in Nepal. Let me confirm exactly how the current version behaves when the internet drops before I promise anything — our team will explain it and show it in the demo.",
      NE: "नेपालमा यो साँच्चै महत्वपूर्ण कुरा हो। कुनै वाचा गर्नुअघि इन्टरनेट जाँदा हालको संस्करणले कसरी काम गर्छ भन्ने म पक्का गर्छु — हाम्रो टिमले बुझाउनेछ र डेमोमा देखाउनेछ।",
      NE_ROMAN: "Nepal ma yo sachchai important kura ho. Kunai promise garnu bhanda pahile internet jada current version le kasari kaam garcha bhanne ma confirm garchu — hamro team le bujhaucha ra demo ma dekhaucha.",
    },
  },
  {
    key: "MIGRATION", intent: "IMPLEMENTATION_QUERY", objectionType: "worried about migration",
    latin: /\b(migrat\w*|existing data|old data|purano data|data transfer|import (my|our) (data|menu|products)|excel bata|excel data)\b/,
    devanagari: /(पुरानो डाटा|डाटा सार्न)/,
    strategy: "Explain the client-kit import process (templates, validation, sign-off). No promise on timeline.",
    prohibitedClaims: ["instant migration", "fixed migration timeline"], requiresHuman: false, escalation: null, actions: [],
    text: {
      EN: "We help you move your existing data. Our team shares import templates for items/menu, stock, customers, suppliers and opening balances, checks them with you, and you sign off before go-live. The effort depends on how much data you have.",
      NE: "तपाईंको पुरानो डाटा सार्न हामी सहयोग गर्छौं। सामान/मेनु, स्टक, ग्राहक, आपूर्तिकर्ता र सुरुको ब्यालेन्सका लागि इम्पोर्ट टेम्प्लेट दिन्छौं, तपाईंसँगै जाँच्छौं, र गो-लाइभअघि तपाईंले स्वीकृति दिनुहुन्छ। डाटाको मात्रा अनुसार समय लाग्छ।",
      NE_ROMAN: "Tapai ko purano data sarna hami help garchau. Item/menu, stock, customer, supplier ra opening balance ko lagi import template dinchhau, tapai sangai check garchau, ani go-live bhanda pahile tapai le sign-off dinu huncha. Data kati cha tesma time bhar parcha.",
    },
  },
  {
    key: "TRAINING", intent: "IMPLEMENTATION_QUERY", objectionType: "need training",
    latin: /\b(training|train (my|our) staff|sikaunu|sikauchau|how to use|chalauna aaudaina)\b/,
    devanagari: /(तालिम|सिकाउनु|चलाउन आउँदैन)/,
    strategy: "Training is part of onboarding (client kit). No promise of unlimited sessions.",
    prohibitedClaims: ["unlimited training", "lifetime training"], requiresHuman: false, escalation: null, actions: [],
    text: {
      EN: "Yes — staff training is part of our onboarding. After setup and configuration, we train each role (billing, kitchen, manager) and check everything with you before go-live.",
      NE: "हो — स्टाफ तालिम हाम्रो अनबोर्डिङको भाग हो। सेटअप र कन्फिगरेसनपछि हामी हरेक भूमिका (बिलिङ, किचन, म्यानेजर) लाई तालिम दिन्छौं र गो-लाइभअघि तपाईंसँगै सबै जाँच्छौं।",
      NE_ROMAN: "Ho — staff training hamro onboarding ko part ho. Setup ra configuration pachi hami harek role (billing, kitchen, manager) lai training dinchhau ra go-live bhanda pahile tapai sangai sabai check garchau.",
    },
  },
  {
    key: "SUPPORT", intent: "IMPLEMENTATION_QUERY", objectionType: "need support",
    latin: /\b(after.?sales|support (kasto|kasari|kati)|support milcha|problem aayo bhane|who will help|maintenance)\b/,
    devanagari: /(सपोर्ट|समस्या आयो भने)/,
    strategy: "Support exists via the team; exact hours/SLA are contractual (legal_status REVIEW_REQUIRED) — never state response times.",
    prohibitedClaims: ["24/7 support", "guaranteed response time", "lifetime support"], requiresHuman: false, escalation: null, actions: [],
    text: {
      EN: "After go-live you'll have direct support from our team, including on WhatsApp. The exact support hours and terms are written into your service agreement, which we share with the quotation.",
      NE: "गो-लाइभपछि तपाईंले हाम्रो टिमबाट सिधै सपोर्ट पाउनुहुन्छ, WhatsApp मा पनि। सपोर्टको समय र सर्तहरू सेवा सम्झौतामा लेखिन्छ, जुन कोटेशनसँगै पठाइन्छ।",
      NE_ROMAN: "Go-live pachi tapai le hamro team bata sidhai support paunu huncha, WhatsApp ma pani. Support ko time ra terms service agreement ma lekhincha, jun quotation sangai pathaincha.",
    },
  },
  {
    key: "MULTI_USER", intent: "FEATURE_QUESTION", objectionType: "need multiple counters / users",
    latin: /\b(multiple (counter|counters|users|computers|devices)|(two|2|three|3|dui|tin) (counter|computer|device)s?|kati jana (le )?chalauna|many users)\b/,
    strategy: "Do not state user/device limits until verified per package.",
    prohibitedClaims: ["unlimited users", "unlimited devices"], requiresHuman: true,
    escalation: "User/device limits per package are not verified", actions: ["ESCALATE_FEATURE_VERIFICATION"],
    text: {
      EN: "Good question. The number of users and counters depends on the package and setup — let me confirm the exact limits for your case with our team before I promise anything.",
      NE: "राम्रो प्रश्न। प्रयोगकर्ता र काउन्टरको संख्या प्याकेज र सेटअपमा भर पर्छ — कुनै वाचा गर्नुअघि तपाईंको लागि सही सीमा हाम्रो टिमसँग पक्का गर्छु।",
      NE_ROMAN: "Ramro prashna. User ra counter ko sankhya package ra setup ma bhar parcha — kunai promise garnu bhanda pahile tapai ko lagi exact limit hamro team sanga confirm garchu.",
    },
  },
  {
    key: "HOTEL", intent: "FEATURE_QUESTION", objectionType: "need room booking / room service / banquet",
    latin: /\b(room booking|rooms?|check.?in|check.?out|housekeeping|room service|banquet|folio|hotels?|resort|homestay|lodge)\b/,
    devanagari: /(कोठा|होटल|बैंक्वेट)/,
    strategy: "Hotel and combined hotel+restaurant are company capabilities; features and prices need confirmation — escalate for a tailored demo/quote. High-value: always human.",
    prohibitedClaims: ["specific hotel features without verification", "hotel prices"], requiresHuman: true,
    escalation: "Hotel/combined offers have no verified feature matrix or canonical price", actions: ["SCHEDULE_DEMO", "NOTIFY_SALES"],
    text: {
      EN: "Yes, Aayatra works with hotels too — including hotels that also run a restaurant. Since every property is different, our team will understand your rooms, outlets and workflow first, then show you a tailored demo and quotation. How many rooms do you have, and do you also run a restaurant?",
      NE: "हो, Aayatra होटलसँग पनि काम गर्छ — रेस्टुरेन्ट पनि चलाउने होटलहरूसँग पनि। हरेक होटल फरक हुने भएकाले हाम्रो टिमले पहिला तपाईंका कोठा, आउटलेट र कामको तरिका बुझेर उपयुक्त डेमो र कोटेशन देखाउनेछ। तपाईंको होटलमा कति कोठा छन्, र रेस्टुरेन्ट पनि छ?",
      NE_ROMAN: "Ho, Aayatra hotel sanga pani kaam garcha — restaurant pani chalaune hotel haru sanga pani. Harek hotel pharak hune bhayekole hamro team le pahila tapai ko room, outlet ra workflow bujhera milne demo ra quotation dekhaucha. Tapai ko hotel ma kati room chan, ra restaurant pani cha?",
    },
  },
  {
    key: "SALON", intent: "FEATURE_QUESTION", objectionType: null,
    latin: /\b(salon|saloon|parlou?r|barber|haircut|spa|appointment booking)\b/,
    devanagari: /(सैलुन|पार्लर)/,
    strategy: "The Haircut salon platform is a company product; features/prices need confirmation.",
    prohibitedClaims: ["salon prices", "unverified salon features"], requiresHuman: true,
    escalation: "Salon offer has no canonical price or verified features", actions: ["SCHEDULE_DEMO", "NOTIFY_SALES"],
    text: {
      EN: "Yes — for salons we have The Haircut, our salon management platform. Our team will confirm the right setup and pricing for your salon and arrange a demo. How many chairs/staff do you have?",
      NE: "हो — सैलुनका लागि हामीसँग The Haircut सैलुन व्यवस्थापन प्लेटफर्म छ। तपाईंको सैलुनका लागि सही सेटअप र मूल्य हाम्रो टिमले पक्का गरेर डेमो मिलाउनेछ। कति कुर्सी/स्टाफ छन्?",
      NE_ROMAN: "Ho — salon ko lagi hamro The Haircut salon management platform cha. Tapai ko salon ko lagi sahi setup ra price hamro team le confirm garera demo milaucha. Kati chair/staff chan?",
    },
  },
  {
    key: "SOCIAL_COMMERCE", intent: "FEATURE_QUESTION", objectionType: null,
    devanagari: /(इन्स्टाग्राम|टिकटक|फेसबुक पेज)/,
    latin: /\b(instagram|insta|tiktok|facebook page|fb page|dm|dms|inbox (ma|bata)|online shop|online pasal|variants?|sizes? (ra|and) colou?rs?)\b/,
    strategy: "Social shops often struggle with stock, variants and DMs; Retail POS covers billing/stock pricing; ecommerce is scoped by the team.",
    prohibitedClaims: ["Instagram/TikTok integration", "automatic DM replies without review"], requiresHuman: true,
    escalation: "Social-commerce workflow and ecommerce scope need review", actions: ["NOTIFY_SALES", "SCHEDULE_DEMO"],
    text: {
      EN: "Many Instagram/TikTok shops reach a point where tracking stock, sizes/colours and orders from DMs gets hard. Our Retail POS helps with billing and stock (from {RETAIL_MONTHLY}/month), and if you also need an online store, our team can scope a website or ecommerce setup for you. Roughly how many products do you sell?",
      NE: "धेरै Instagram/TikTok पसलहरूलाई DM बाट आएका अर्डर, स्टक र साइज/रङ ट्र्याक गर्न गाह्रो हुन्छ। हाम्रो रिटेल POS ले बिलिङ र स्टक सम्हाल्न मद्दत गर्छ ({RETAIL_MONTHLY}/महिनादेखि), र अनलाइन स्टोर पनि चाहिए हाम्रो टिमले वेबसाइट वा इकमर्सको स्कोप तयार गर्छ। तपाईं लगभग कति प्रोडक्ट बेच्नुहुन्छ?",
      NE_ROMAN: "Dherai Instagram/TikTok pasal lai DM bata aayeko order, stock ra size/color track garna garo huncha. Hamro Retail POS le billing ra stock samhalna help garcha ({RETAIL_MONTHLY}/month dekhi), ra online store pani chahiye hamro team le website wa ecommerce ko scope tayar garcha. Tapai lagbhag kati product bechnu huncha?",
    },
  },
  {
    key: "WEBSITE_ECOMMERCE", intent: "CUSTOM_REQUIREMENT", objectionType: "need ecommerce",
    latin: /\b(website|web ?site|ecommerce|e-commerce|online store|webpage|domain|seo)\b/,
    devanagari: /(वेबसाइट|इकमर्स)/,
    strategy: "Websites/ecommerce are company services; scope and price are custom — collect requirements, escalate.",
    prohibitedClaims: ["fixed website price", "delivery date"], requiresHuman: true,
    escalation: "Website/ecommerce work is custom-scoped", actions: ["NOTIFY_SALES"],
    text: {
      EN: "Yes, Aayatra also builds business websites and ecommerce stores. Price and timeline depend on what you need — could you share your business type, the pages or features you want (e.g. catalogue, online ordering, booking, payments), and any website you like as a reference?",
      NE: "हो, Aayatra ले व्यवसायका लागि वेबसाइट र इकमर्स स्टोर पनि बनाउँछ। मूल्य र समय तपाईंको आवश्यकतामा भर पर्छ — व्यवसायको प्रकार, चाहिने पेज वा सुविधा (जस्तै क्याटलग, अनलाइन अर्डर, बुकिङ, भुक्तानी), र मन परेको कुनै वेबसाइट उदाहरणका रूपमा पठाइदिनुहुन्छ?",
      NE_ROMAN: "Ho, Aayatra le business ko lagi website ra ecommerce store pani banaucha. Price ra time tapai ko requirement ma bhar parcha — business ko type, chahine page wa feature (jastai catalogue, online order, booking, payment), ra man pareko kunai website reference ko rup ma pathaidinu huncha?",
    },
  },
  {
    key: "AI_AUTOMATION", intent: "CUSTOM_REQUIREMENT", objectionType: null,
    latin: /\b(ai|artificial intelligence|chatbot|automation|automate|auto reply|whatsapp bot)\b/,
    strategy: "AI/automation is a company service; always custom-reviewed.",
    prohibitedClaims: ["guaranteed results", "fully autonomous AI without oversight"], requiresHuman: true,
    escalation: "AI/automation projects are custom", actions: ["NOTIFY_SALES"],
    text: {
      EN: "Yes, Aayatra builds AI and automation solutions — for example WhatsApp assistants, automatic reports and workflow automation. Each one is designed around your process, so our technical team will review what you'd like to automate and suggest an approach.",
      NE: "हो, Aayatra ले AI र अटोमेसन समाधान पनि बनाउँछ — जस्तै WhatsApp सहायक, स्वचालित रिपोर्ट र कामको अटोमेसन। हरेक समाधान तपाईंको प्रक्रिया अनुसार बनाइन्छ, त्यसैले के अटोमेट गर्न चाहनुहुन्छ भन्ने हेरेर हाम्रो प्राविधिक टिमले सुझाव दिनेछ।",
      NE_ROMAN: "Ho, Aayatra le AI ra automation solution pani banaucha — jastai WhatsApp assistant, automatic report ra workflow automation. Harek solution tapai ko process anusar banaincha, tesaile k automate garna chahanu huncha bhanne herera hamro technical team le suggest garcha.",
    },
  },
  {
    key: "FREE_TRIAL", intent: "GENERAL_QUESTION", objectionType: null,
    latin: /\b(free trial|trial|free ma|try garna|test garna|free version)\b/,
    devanagari: /(निःशुल्क|फ्री)/,
    strategy: "No trial is approved; offer a demo instead.",
    prohibitedClaims: ["free trial", "free months"], requiresHuman: false, escalation: null, actions: ["SCHEDULE_DEMO"],
    text: {
      EN: "The best way to try it is a live demo, where you can see your own workflow — billing, stock and reports — before deciding. Shall I arrange one?",
      NE: "प्रयोग गरेर हेर्ने सबैभन्दा राम्रो तरिका प्रत्यक्ष डेमो हो, जहाँ निर्णय गर्नुअघि तपाईंको आफ्नै काम — बिलिङ, स्टक र रिपोर्ट — हेर्न सक्नुहुन्छ। डेमो मिलाऊँ?",
      NE_ROMAN: "Try garne sabai bhanda ramro tarika live demo ho, jaha decide garnu bhanda pahile tapai ko aafnai kaam — billing, stock ra report — herna saknu huncha. Demo milau?",
    },
  },
  {
    key: "COMPETITOR", intent: "OBJECTION_EXISTING_SYSTEM", objectionType: "current system is enough",
    latin: /\b(cheaper (elsewhere|than you)|other company|arko company|competitor|better than|compare)\b/,
    strategy: "Never disparage competitors; focus on fit, local support and a demo.",
    prohibitedClaims: ["competitor criticism", "we are the cheapest"], requiresHuman: false, escalation: null, actions: ["SCHEDULE_DEMO"],
    text: {
      EN: "It's smart to compare. We'd suggest looking at fit for your daily workflow, local support and total cost over a year. A short Aadhar POS demo will make it easy to compare side by side.",
      NE: "तुलना गर्नु राम्रो कुरा हो। आफ्नो दैनिक कामसँग मिल्ने, स्थानीय सपोर्ट र एक वर्षको कुल खर्च हेर्न सुझाव दिन्छौं। Aadhar POS को छोटो डेमोले तुलना गर्न सजिलो बनाउँछ।",
      NE_ROMAN: "Compare garnu ramro kura ho. Aafno daily kaam sanga milne, local support ra ek barsa ko total kharcha herna suggest garchau. Aadhar POS ko chhoto demo le compare garna sajilo banaucha.",
    },
  },
];

export function matchTopic(message: string): PlaybookTopic | null {
  const value = message.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
  for (const topic of playbook) if (topic.latin?.test(value) || topic.devanagari?.test(value)) return topic;
  return null;
}
