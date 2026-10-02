/**
 * Labelled AI evaluation dataset (§62). Format: message | expected intent | expected temperature from COLD | language.
 * "-" for temperature means the message carries no buying signal (stays COLD).
 * Add real, anonymised prospect messages over time; run `npm run eval:ai` after any rule/prompt change.
 */
const raw = `
Not interested. | NOT_INTERESTED | NOT_INTERESTED | EN
not interested | NOT_INTERESTED | NOT_INTERESTED | EN
No thanks, we are fine. | NOT_INTERESTED | NOT_INTERESTED | EN
malai chahidaina | NOT_INTERESTED | NOT_INTERESTED | NE_ROMAN
aile pardaina hai | NOT_INTERESTED | NOT_INTERESTED | NE_ROMAN
हामीलाई चाहिँदैन | NOT_INTERESTED | NOT_INTERESTED | NE
रुचि छैन | NOT_INTERESTED | NOT_INTERESTED | NE
Stop messaging me | DO_NOT_CONTACT | NOT_INTERESTED | EN
Please unsubscribe me | DO_NOT_CONTACT | NOT_INTERESTED | EN
do not contact this number again | DO_NOT_CONTACT | NOT_INTERESTED | EN
message nagarnu aba | DO_NOT_CONTACT | NOT_INTERESTED | NE_ROMAN
फेरि सम्पर्क नगर्नु | DO_NOT_CONTACT | NOT_INTERESTED | NE
What is your hotel system? | GENERAL_QUESTION | WARM | EN
What do you offer for small businesses? | GENERAL_QUESTION | WARM | EN
Aadhar POS k ho? | GENERAL_QUESTION | WARM | NE_ROMAN
तपाईंको सफ्टवेयर के हो? | GENERAL_QUESTION | WARM | NE
hello | GREETING | WARM | EN
Hi there | GREETING | WARM | EN
namaste | GREETING | WARM | NE_ROMAN
namaskar hajur | GREETING | WARM | NE_ROMAN
नमस्ते | GREETING | WARM | NE
नमस्कार | GREETING | WARM | NE
price kati ho? | PRICE_QUERY | INTERESTED | NE_ROMAN
restaurant ko lagi price kati ho? | PRICE_QUERY | INTERESTED | NE_ROMAN
How much does Aadhar POS cost? | PRICE_QUERY | INTERESTED | EN
What is the pricing for a cafe? | PRICE_QUERY | INTERESTED | EN
How much for hotel + restaurant? | PRICE_QUERY | INTERESTED | EN
retail pasal ko lagi kati parcha? | PRICE_QUERY | INTERESTED | NE_ROMAN
software ko rate kati? | PRICE_QUERY | INTERESTED | NE_ROMAN
monthly kati lagcha? | PRICE_QUERY | INTERESTED | NE_ROMAN
मूल्य कति हो? | PRICE_QUERY | INTERESTED | NE
रेस्टुरेन्टको लागि कति पर्छ? | PRICE_QUERY | INTERESTED | NE
मासिक शुल्क कति हो? | PRICE_QUERY | INTERESTED | NE
What's the cost of the yearly plan? | PRICE_QUERY | INTERESTED | EN
Which plan is best for a small momo shop? | PACKAGE_QUERY | INTERESTED | EN
starter ma k k aaucha? | PACKAGE_QUERY | INTERESTED | NE_ROMAN
Tell me about the Enterprise package | PACKAGE_QUERY | INTERESTED | EN
Do you have a subscription option? | PACKAGE_QUERY | INTERESTED | EN
प्याकेज कस्तो छ? | PACKAGE_QUERY | INTERESTED | NE
printer ko price? | HARDWARE_QUERY | INTERESTED | NE_ROMAN
Do you sell barcode scanners? | HARDWARE_QUERY | INTERESTED | EN
I need a label printer too | HARDWARE_QUERY | INTERESTED | EN
thermal printer milcha? | HARDWARE_QUERY | INTERESTED | NE_ROMAN
प्रिन्टर पनि दिनुहुन्छ? | HARDWARE_QUERY | INTERESTED | NE
demo pathaunu | DEMO_REQUEST | HOT | NE_ROMAN
Can I see a demo? | DEMO_REQUEST | HOT | EN
Please show me how it works | DEMO_REQUEST | HOT | EN
demo herna milcha? | DEMO_REQUEST | HOT | NE_ROMAN
malai demo dekhaunu na | DEMO_REQUEST | HOT | NE_ROMAN
डेमो देखाउनुहोस् | DEMO_REQUEST | HOT | NE
Can we schedule a call tomorrow? | MEETING_REQUEST | HOT | EN
Let's have a meeting this week | MEETING_REQUEST | HOT | EN
office ma bhetnu milcha? | MEETING_REQUEST | HOT | NE_ROMAN
भेट्नु मिल्छ? | MEETING_REQUEST | HOT | NE
Growth package final kati? | NEGOTIATION | NEGOTIATING | NE_ROMAN
Can you give a discount? | NEGOTIATION | NEGOTIATING | EN
What is your best price for Enterprise? | NEGOTIATION | NEGOTIATING | EN
last price kati ho? | NEGOTIATION | NEGOTIATING | NE_ROMAN
rate ghatauna milcha? | NEGOTIATION | NEGOTIATING | NE_ROMAN
alik kam garnu na | NEGOTIATION | NEGOTIATING | NE_ROMAN
छुट पाइन्छ? | NEGOTIATION | NEGOTIATING | NE
अन्तिम मूल्य कति? | NEGOTIATION | NEGOTIATING | NE
proposal pathaunu | PROPOSAL_REQUEST | READY_TO_BUY | NE_ROMAN
Please send me a quotation | PROPOSAL_REQUEST | READY_TO_BUY | EN
Send the proposal for the Growth plan | PROPOSAL_REQUEST | READY_TO_BUY | EN
We want website + ERP. Send final price. | PROPOSAL_REQUEST | READY_TO_BUY | EN
quotation pathaidinu | PROPOSAL_REQUEST | READY_TO_BUY | NE_ROMAN
प्रस्ताव पठाउनुहोस् | PROPOSAL_REQUEST | READY_TO_BUY | NE
कोटेशन पठाउनु | PROPOSAL_REQUEST | READY_TO_BUY | NE
We are ready to buy | PURCHASE_INTENT | READY_TO_BUY | EN
I want to buy the Starter plan | PURCHASE_INTENT | READY_TO_BUY | EN
ok linchhu, start garam | PURCHASE_INTENT | READY_TO_BUY | NE_ROMAN
ma kinchu | PURCHASE_INTENT | READY_TO_BUY | NE_ROMAN
म लिन्छु | PURCHASE_INTENT | READY_TO_BUY | NE
QR send garnu, proceed garam | PAYMENT_QUERY | PAYMENT_PENDING | NE_ROMAN
Okay send payment details. | PAYMENT_QUERY | PAYMENT_PENDING | EN
Can I pay with eSewa? | PAYMENT_QUERY | PAYMENT_PENDING | EN
khalti bata pay garna milcha? | PAYMENT_QUERY | PAYMENT_PENDING | NE_ROMAN
bank account number pathaunu | PAYMENT_QUERY | PAYMENT_PENDING | NE_ROMAN
advance kati tirnu parcha? | PAYMENT_QUERY | PAYMENT_PENDING | NE_ROMAN
भुक्तानी कसरी गर्ने? | PAYMENT_QUERY | PAYMENT_PENDING | NE
Does it support KOT printing? | FEATURE_QUESTION | INTERESTED | EN
inventory track garna milcha? | FEATURE_QUESTION | INTERESTED | NE_ROMAN
Can it manage rooms and restaurant bills together? | FEATURE_QUESTION | INTERESTED | EN
Does Enterprise support multi branch? | FEATURE_QUESTION | INTERESTED | EN
branch haru ko report milcha? | FEATURE_QUESTION | INTERESTED | NE_ROMAN
Does it include accounting? | FEATURE_QUESTION | INTERESTED | EN
staff attendance cha ki? | FEATURE_QUESTION | INTERESTED | NE_ROMAN
स्टक हेर्न मिल्छ? | FEATURE_QUESTION | INTERESTED | NE
We sell 500+ products through Instagram. Can you handle variants and stock? | FEATURE_QUESTION | INTERESTED | EN
Can it work offline? | FEATURE_QUESTION | INTERESTED | EN
internet gayo bhane chalcha? | FEATURE_QUESTION | INTERESTED | NE_ROMAN
Can 3 counters use it at once? | FEATURE_QUESTION | INTERESTED | EN
Is VAT included in the price? | TAX_REGISTRATION_QUERY | INTERESTED | EN
Is your software IRD approved? | TAX_REGISTRATION_QUERY | INTERESTED | EN
PAN number k ho tapai ko? | TAX_REGISTRATION_QUERY | INTERESTED | NE_ROMAN
bill ma VAT lagcha? | TAX_REGISTRATION_QUERY | INTERESTED | NE_ROMAN
भ्याट लाग्छ? | TAX_REGISTRATION_QUERY | INTERESTED | NE
It's too expensive for us | OBJECTION_PRICE | INTERESTED | EN
mahango bhayo | OBJECTION_PRICE | INTERESTED | NE_ROMAN
budget chaina ahile | OBJECTION_PRICE | INTERESTED | NE_ROMAN
धेरै महँगो भयो | OBJECTION_PRICE | INTERESTED | NE
We already use another software | OBJECTION_EXISTING_SYSTEM | INTERESTED | EN
arko software chalairachhau | OBJECTION_EXISTING_SYSTEM | INTERESTED | NE_ROMAN
Maybe next month | FOLLOW_UP_LATER | WARM | EN
Talk to me after Dashain | FOLLOW_UP_LATER | WARM | EN
pachi kura garaula | FOLLOW_UP_LATER | WARM | NE_ROMAN
aile haina, next week | FOLLOW_UP_LATER | WARM | NE_ROMAN
दशैं पछि कुरा गरौं | FOLLOW_UP_LATER | WARM | NE
अर्को महिना | FOLLOW_UP_LATER | WARM | NE
Can you integrate with our existing app? | CUSTOM_REQUIREMENT | INTERESTED | EN
custom feature banauna milcha? | CUSTOM_REQUIREMENT | INTERESTED | NE_ROMAN
Do you build websites? | CUSTOM_REQUIREMENT | INTERESTED | EN
We need a chatbot for our WhatsApp | CUSTOM_REQUIREMENT | INTERESTED | EN
How long does installation take? | IMPLEMENTATION_QUERY | INTERESTED | EN
training dinu huncha? | IMPLEMENTATION_QUERY | INTERESTED | NE_ROMAN
Can you import our old Excel data? | IMPLEMENTATION_QUERY | INTERESTED | EN
setup kasari garne? | IMPLEMENTATION_QUERY | INTERESTED | NE_ROMAN
तालिम दिनुहुन्छ? | IMPLEMENTATION_QUERY | INTERESTED | NE
The system is not working since morning | COMPLAINT | - | EN
billing chaldaina, help garnu | COMPLAINT | - | NE_ROMAN
I want a refund | COMPLAINT | - | EN
सफ्टवेयर चल्दैन | COMPLAINT | - | NE
Send me your contract terms | LEGAL_OR_CONTRACT | - | EN
What is the SLA? | LEGAL_OR_CONTRACT | - | EN
agreement ma k k cha? | LEGAL_OR_CONTRACT | - | NE_ROMAN
Is our data encrypted? | SECURITY_QUESTION | - | EN
Has the system been through a penetration test? | SECURITY_QUESTION | - | EN
tyo kura heram | UNKNOWN | - | NE_ROMAN
Do you have a hotel system with room booking? | FEATURE_QUESTION | INTERESTED | EN
hotel ko lagi system cha? | FEATURE_QUESTION | INTERESTED | NE_ROMAN
इन्स्टाग्राममा बेच्छौं, स्टक मिलाउन गाह्रो | FEATURE_QUESTION | INTERESTED | NE
इन्टरनेट बिना चल्छ? | FEATURE_QUESTION | INTERESTED | NE
समस्या आयो भने सपोर्ट छ? | IMPLEMENTATION_QUERY | INTERESTED | NE
printer ra scanner ko price? | HARDWARE_QUERY | INTERESTED | NE_ROMAN
billing chaldaina | COMPLAINT | - | NE_ROMAN
where is your office? | GENERAL_QUESTION | WARM | EN
??? | UNKNOWN | - | EN
Ram ram | UNKNOWN | - | EN
Are you a bot? | GENERAL_QUESTION | WARM | EN
`;

export type EvalCase = { message: string; intent: string; temperature: string | null; language: "EN" | "NE" | "NE_ROMAN" };

export const evalDataset: EvalCase[] = raw.trim().split("\n").map((line) => {
  const [message, intent, temperature, language] = line.split(" | ").map((part) => part.trim());
  return { message, intent, temperature: temperature === "-" ? null : temperature, language: language as EvalCase["language"] };
});
