import assert from "node:assert/strict";
import { config } from "dotenv";

config({ path: ".env.e2e.local" });

const base = process.env.APP_ORIGIN;
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
if (!base || !email || !password)
  throw new Error(
    "Set APP_ORIGIN, E2E_EMAIL and E2E_PASSWORD for the disposable test environment",
  );

async function request(path, { method = "GET", body, cookie, form } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Origin: base,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(form ? {} : { "Content-Type": "application/json" }),
    },
    body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const data = await response.json();
  return { response, data };
}

const unauthorized = await request("/api/leads");
assert.equal(unauthorized.response.status, 401);
const login = await request("/api/auth/login", {
  method: "POST",
  body: { email, password },
});
assert.equal(login.response.status, 200, JSON.stringify(login.data));
const cookie = login.response.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie, "Login must issue a session cookie");
const before = await request("/api/overview", { cookie });
assert.equal(before.response.status, 200, JSON.stringify(before.data));
const leadsBefore = Number(before.data.summary.leads);
const qualifiedBefore = Number(before.data.summary.qualified);

const suffix = Date.now().toString(36);
const lead = await request("/api/leads", {
  method: "POST",
  cookie,
  body: {
    name: `E2E Hotel ${suffix}`,
    industry: "HOTEL",
    city: "Pokhara",
    sourceType: "MANUAL",
    sourceReference: "e2e authorized fixture",
    contactName: "E2E Owner",
    contactEmail: `e2e-${suffix}@example.test`,
    contactSource: "e2e authorized fixture",
  },
});
assert.equal(lead.response.status, 201, JSON.stringify(lead.data));
const leadId = lead.data.id;
const leadDetail = await request(`/api/leads/${leadId}`, { cookie });
const contactId = leadDetail.data.contacts[0].id;
const eligible = await request(`/api/contacts/${contactId}/eligibility`, {
  method: "POST", cookie,
  body: { eligible: true, evidence: "Synthetic e2e consent fixture" },
});
assert.equal(eligible.response.status, 200, JSON.stringify(eligible.data));
const conversation = await request("/api/conversations", {
  method: "POST", cookie, body: { leadId, contactId, channel: "MANUAL" },
});
assert.equal(conversation.response.status, 201, JSON.stringify(conversation.data));
const firstInbound = await request(`/api/conversations/${conversation.data.id}/messages`, {
  method: "POST", cookie,
  body: { direction: "INBOUND", body: "Restaurant software price kati?" },
});
assert.equal(firstInbound.response.status, 201, JSON.stringify(firstInbound.data));
assert.equal(firstInbound.data.intent, "PRICE_QUERY");
const draft = await request("/api/outbound", {
  method: "POST", cookie,
  body: { leadId, contactId, conversationId: conversation.data.id, channel: "EMAIL", body: "Synthetic e2e draft only" },
});
assert.equal(draft.response.status, 201, JSON.stringify(draft.data));
const approvedDraft = await request(`/api/outbound/${draft.data.id}/approve`, {
  method: "POST", cookie, body: {},
});
assert.equal(approvedDraft.response.status, 200, JSON.stringify(approvedDraft.data));
assert.equal(approvedDraft.data.status, "BLOCKED_PROVIDER");
const optOut = await request(`/api/conversations/${conversation.data.id}/messages`, {
  method: "POST", cookie,
  body: { direction: "INBOUND", body: "Do not contact me again." },
});
assert.equal(optOut.response.status, 201, JSON.stringify(optOut.data));
assert.equal(optOut.data.intent, "DO_NOT_CONTACT");
const afterOptOut = await request("/api/outbound", { cookie });
assert.equal(afterOptOut.data.messages.find((message) => message.id === draft.data.id).status, "OPTED_OUT");

const campaign = await request("/api/campaigns", {
  method: "POST",
  cookie,
  body: {
    name: `E2E hotel cohort ${suffix}`,
    segment: "Pokhara hotels",
    hypothesis: "Hotels may need direct booking systems",
  },
});
assert.equal(campaign.response.status, 201, JSON.stringify(campaign.data));
const campaignId = campaign.data.id;
const qualify = await request(`/api/leads/${leadId}`, {
  method: "PATCH",
  cookie,
  body: { status: "QUALIFIED", campaignId, fitScore: 72 },
});
assert.equal(qualify.response.status, 200, JSON.stringify(qualify.data));

for (const [signalKey, observedValue] of [
  ["WEBSITE_EXISTS", false],
  ["DIRECT_BOOKING", false],
  ["RESTAURANT_ON_SITE", true],
]) {
  const observation = await request(`/api/leads/${leadId}/observations`, {
    method: "POST",
    cookie,
    body: {
      signalKey,
      observedValue,
      confidence: 0.9,
      note: "Fixture observation",
    },
  });
  assert.equal(
    observation.response.status,
    201,
    JSON.stringify(observation.data),
  );
}
const insights = await request(`/api/leads/${leadId}/insights`, { cookie });
assert.equal(insights.data.insights.fitScore, 69);
assert.equal(insights.data.insights.buyingIntentScore, null);
assert.equal(
  insights.data.insights.candidates[0].product,
  "HOTEL_RESTAURANT_COMBINED",
);

const opportunity = await request("/api/opportunities", {
  method: "POST",
  cookie,
  body: {
    leadId,
    title: "Hotel operations review",
    productFamily: "HOTEL_RESTAURANT_COMBINED",
    valueMinor: 35000000,
    nextAction: "Book discovery meeting",
  },
});
assert.equal(
  opportunity.response.status,
  201,
  JSON.stringify(opportunity.data),
);
const opportunityId = opportunity.data.id;
const stage = await request(`/api/opportunities/${opportunityId}/stage`, {
  method: "POST",
  cookie,
  body: { stage: "HOT", reason: "Owner asked for a detailed call" },
});
assert.equal(stage.response.status, 200, JSON.stringify(stage.data));
const forbiddenWin = await request(
  `/api/opportunities/${opportunityId}/stage`,
  {
    method: "POST",
    cookie,
    body: { stage: "WON", reason: "Interest alone is insufficient" },
  },
);
assert.equal(forbiddenWin.response.status, 409);
const history = await request(`/api/opportunities/${opportunityId}/stage`, {
  cookie,
});
assert.equal(history.data.history.length, 2);

const task = await request("/api/activities", {
  method: "POST",
  cookie,
  body: {
    leadId,
    opportunityId,
    kind: "TASK",
    detail: "Call hotel owner",
    dueAt: new Date(Date.now() + 3600000).toISOString(),
  },
});
assert.equal(task.response.status, 201, JSON.stringify(task.data));
const complete = await request(`/api/activities/${task.data.id}`, {
  method: "PATCH",
  cookie,
  body: {},
});
assert.equal(complete.response.status, 200, JSON.stringify(complete.data));

const capability = await request("/api/capabilities", {
  method: "POST",
  cookie,
  body: {
    productFamily: "HOTEL_SYSTEM",
    capabilityName: `E2E capability ${suffix}`,
  },
});
assert.equal(capability.response.status, 201, JSON.stringify(capability.data));
const invalidApproval = await request(
  `/api/capabilities/${capability.data.id}`,
  { method: "PATCH", cookie, body: { status: "VERIFIED" } },
);
assert.equal(invalidApproval.response.status, 400);
const approval = await request(`/api/capabilities/${capability.data.id}`, {
  method: "PATCH",
  cookie,
  body: {
    status: "VERIFIED",
    evidenceUrl: "https://example.com/product-evidence",
    approvedLanguage:
      "This specific capability is available in the tested edition.",
    productVersion: "fixture-1",
  },
});
assert.equal(approval.response.status, 200, JSON.stringify(approval.data));
const published = await request("/api/knowledge/published", { cookie });
assert.ok(published.data.facts.some((item) => item.id === capability.data.id));

const form = new FormData();
form.set("mode", "preview");
form.set("sourceNote", "Authorized e2e fixture list");
form.set(
  "file",
  new Blob([`name,industry,city\nE2E Retail ${suffix},RETAIL,Kathmandu`], {
    type: "text/csv",
  }),
  "fixture.csv",
);
const preview = await request("/api/imports/csv", {
  method: "POST",
  cookie,
  form,
});
assert.equal(preview.response.status, 200, JSON.stringify(preview.data));
assert.equal(preview.data.ready, 1);
form.set("mode", "commit");
const imported = await request("/api/imports/csv", {
  method: "POST",
  cookie,
  form,
});
assert.equal(imported.response.status, 201, JSON.stringify(imported.data));
assert.equal(imported.data.imported, 1);

const demoTarget = await request("/api/demo-targets", {
  method: "POST", cookie,
  body: { productFamily: "RETAIL_ERP", name: `E2E demo ${suffix}`, baseUrl: null, environment: "DEMO" },
});
assert.equal(demoTarget.response.status, 201, JSON.stringify(demoTarget.data));
assert.equal(demoTarget.data.status, "WAITING_FOR_DEMO_URL");
const blockedDemo = await request("/api/demo-jobs", {
  method: "POST", cookie, body: { targetId: demoTarget.data.id, jobType: "HEALTH_CHECK" },
});
assert.equal(blockedDemo.data.status, "BLOCKED");
const invalidDemo = await request(`/api/demo-targets/${demoTarget.data.id}`, {
  method: "PATCH", cookie,
  body: { productFamily: "RETAIL_ERP", name: `E2E demo ${suffix}`, baseUrl: "http://localhost:3000", environment: "DEMO" },
});
assert.equal(invalidDemo.response.status, 400);
const configuredDemo = await request(`/api/demo-targets/${demoTarget.data.id}`, {
  method: "PATCH", cookie,
  body: { productFamily: "RETAIL_ERP", name: `E2E demo ${suffix}`, baseUrl: "https://example.org", environment: "DEMO" },
});
assert.equal(configuredDemo.response.status, 200, JSON.stringify(configuredDemo.data));
const missingSyntheticProof = await request(`/api/demo-targets/${demoTarget.data.id}/review`, {
  method: "POST", cookie, body: {},
});
assert.equal(missingSyntheticProof.response.status, 400, JSON.stringify(missingSyntheticProof.data));
const attestedDemo = await request(`/api/demo-targets/${demoTarget.data.id}/review`, {
  method: "POST", cookie, body: { syntheticDataEvidence: "Synthetic e2e tenant fixture only; never visited" },
});
assert.equal(attestedDemo.response.status, 200, JSON.stringify(attestedDemo.data));
const changedDemo = await request(`/api/demo-targets/${demoTarget.data.id}`, {
  method: "PATCH", cookie,
  body: { productFamily: "RETAIL_ERP", name: `E2E demo revised ${suffix}`, baseUrl: "https://example.org", environment: "DEMO" },
});
assert.equal(changedDemo.response.status, 200, JSON.stringify(changedDemo.data));
const targetsAfterChange = await request("/api/demo-targets", { cookie });
assert.equal(targetsAfterChange.data.targets.find((target) => target.id === demoTarget.data.id).synthetic_data_evidence, null);

const item = await request("/api/commercial", {
  method: "POST", cookie,
  body: { productFamily: "RESTAURANT_SYSTEM", kind: "SOFTWARE", name: `E2E package ${suffix}`, billingType: "ONE_TIME", billingPeriod: null, source: "e2e approved fixture", priceMinor: 1000000 },
});
assert.equal(item.response.status, 201, JSON.stringify(item.data));
const secondPrice = await request(`/api/commercial/${item.data.id}`, {
  method: "PATCH", cookie, body: { action: "ADD_PRICE", price: { priceMinor: 1200000, sourceName: "e2e conflict fixture" } },
});
assert.equal(secondPrice.response.status, 200, JSON.stringify(secondPrice.data));
const verifiedItem = await request(`/api/commercial/${item.data.id}`, {
  method: "PATCH", cookie, body: { action: "VERIFY", evidenceReference: "Synthetic price verification fixture" },
});
assert.equal(verifiedItem.response.status, 200, JSON.stringify(verifiedItem.data));
const conflict = await request(`/api/commercial/${item.data.id}`, {
  method: "PATCH", cookie, body: { action: "ACTIVATE", approvalRequired: true },
});
assert.equal(conflict.response.status, 409);
const canonical = await request(`/api/commercial/${item.data.id}`, {
  method: "PATCH", cookie, body: { action: "ADD_PRICE", price: { priceMinor: 1000000, sourceName: "e2e canonical fixture", evidenceReference: "Synthetic approval fixture", isCanonical: true } },
});
assert.equal(canonical.response.status, 200, JSON.stringify(canonical.data));
const activated = await request(`/api/commercial/${item.data.id}`, {
  method: "PATCH", cookie, body: { action: "ACTIVATE", approvalRequired: true },
});
assert.equal(activated.response.status, 200, JSON.stringify(activated.data));
const floor = await request(`/api/commercial/${item.data.id}`, {
  method: "PATCH", cookie, body: { action: "SET_FLOOR", minPriceMinor: 900000, evidenceReference: "Synthetic e2e minimum price approval" },
});
assert.equal(floor.response.status, 200, JSON.stringify(floor.data));
const importedMarketing = await request("/api/commercial/seed-marketing", { method: "POST", cookie, body: {} });
assert.equal(importedMarketing.response.status, 200, JSON.stringify(importedMarketing.data));
const kitCatalog = await request("/api/commercial", { cookie });
const enterpriseDraft = kitCatalog.data.items.find((value) => value.name === "Enterprise yearly" && value.source === "Aayatra continuation prompt marketing snapshot 2026-10-01");
assert.ok(enterpriseDraft?.discrepancies.some((value) => value.code === "CLIENT_KIT_ENTERPRISE_YEARLY" && value.status === "OPEN"));
assert.ok(kitCatalog.data.items.find((value) => value.name === "Thermal printer")?.discrepancies.some((value) => value.code === "CLIENT_KIT_THERMAL_PRINTER" && value.status === "OPEN"));
if (enterpriseDraft.catalog_status === "DRAFT") {
  const verifiedEnterprise = await request(`/api/commercial/${enterpriseDraft.id}`, {
    method: "PATCH", cookie, body: { action: "VERIFY", evidenceReference: "Synthetic template comparison only" },
  });
  assert.equal(verifiedEnterprise.response.status, 200, JSON.stringify(verifiedEnterprise.data));
}
const blockedEnterprise = await request(`/api/commercial/${enterpriseDraft.id}`, {
  method: "PATCH", cookie, body: { action: "ACTIVATE", approvalRequired: true },
});
assert.equal(blockedEnterprise.response.status, 409);
const draftPolicy = await request("/api/commercial-policy", {
  method: "PATCH", cookie, body: { action: "SAVE_DRAFT", taxMode: "EXEMPT", taxRateBps: 0, taxLabel: "Synthetic e2e no-tax fixture", maxManualDiscountBps: 1000, maxAutoDiscountBps: 0, maxNegotiationRounds: 0, maxMessagesPerContactPerDay: 0 },
});
assert.equal(draftPolicy.response.status, 200, JSON.stringify(draftPolicy.data));
const draftQuote = await request("/api/quotations", {
  method: "POST", cookie,
  body: { opportunityId, items: [{ itemId: item.data.id, quantity: 1 }], validUntil: "2030-12-31", scope: "Synthetic e2e scope only", exclusions: "No external delivery" },
});
assert.equal(draftQuote.response.status, 201, JSON.stringify(draftQuote.data));
const unapprovedQuote = await request(`/api/quotations/${draftQuote.data.id}`, {
  method: "PATCH", cookie, body: { action: "APPROVE", evidence: "Synthetic policy gate evidence" },
});
assert.equal(unapprovedQuote.response.status, 409, JSON.stringify(unapprovedQuote.data));
const approvedPolicy = await request("/api/commercial-policy", {
  method: "PATCH", cookie, body: { action: "APPROVE", evidenceReference: "Synthetic e2e commercial policy only" },
});
assert.equal(approvedPolicy.response.status, 200, JSON.stringify(approvedPolicy.data));
const excessiveDiscount = await request("/api/quotations", {
  method: "POST", cookie, body: { opportunityId, items: [{ itemId: item.data.id, quantity: 1 }], validUntil: "2030-12-31", scope: "Synthetic e2e scope only", exclusions: "No external delivery", discountMinor: 110000 },
});
assert.equal(excessiveDiscount.response.status, 409, JSON.stringify(excessiveDiscount.data));
const quote = await request("/api/quotations", {
  method: "POST", cookie, body: { opportunityId, items: [{ itemId: item.data.id, quantity: 1 }], validUntil: "2030-12-31", scope: "Synthetic e2e scope only", exclusions: "No external delivery", discountMinor: 50000 },
});
assert.equal(quote.response.status, 201, JSON.stringify(quote.data));
assert.equal(quote.data.status, "REVIEW_REQUIRED");
assert.equal(quote.data.totalMinor, 950000);
const printable = await fetch(`${base}/api/quotations/${quote.data.id}/print`, { headers: { Cookie: cookie } });
assert.equal(printable.status, 200);
assert.match(await printable.text(), /Synthetic e2e scope only/);
for (const action of ["APPROVE", "MARK_SENT", "ACCEPT"]) {
  const changed = await request(`/api/quotations/${quote.data.id}`, {
    method: "PATCH", cookie, body: { action, evidence: `Synthetic e2e ${action} evidence` },
  });
  assert.equal(changed.response.status, 200, JSON.stringify(changed.data));
}
const payment = await request("/api/payments", {
  method: "POST", cookie,
  body: { opportunityId, quotationId: quote.data.id, amountMinor: quote.data.totalMinor, method: "MANUAL_BANK" },
});
assert.equal(payment.response.status, 201, JSON.stringify(payment.data));
for (const action of ["REQUEST", "SUBMIT_FOR_VERIFICATION"]) {
  const changed = await request(`/api/payments/${payment.data.id}`, {
    method: "PATCH", cookie, body: { action, evidence: `Synthetic e2e ${action} evidence` },
  });
  assert.equal(changed.response.status, 200, JSON.stringify(changed.data));
}
const toProposal = await request(`/api/opportunities/${opportunityId}/stage`, {
  method: "POST", cookie, body: { stage: "PROPOSAL", reason: "Synthetic accepted quotation" },
});
assert.equal(toProposal.response.status, 200, JSON.stringify(toProposal.data));
const toPayment = await request(`/api/opportunities/${opportunityId}/stage`, {
  method: "POST", cookie, body: { stage: "PAYMENT", reason: "Synthetic payment request" },
});
assert.equal(toPayment.response.status, 200, JSON.stringify(toPayment.data));
const prematureWin = await request(`/api/opportunities/${opportunityId}/stage`, {
  method: "POST", cookie, body: { stage: "WON", reason: "Verbal yes is insufficient" },
});
assert.equal(prematureWin.response.status, 409);
const unreviewedAgreement = await request("/api/agreements", {
  method: "POST", cookie,
  body: { opportunityId, quotationId: quote.data.id, templateReference: "Synthetic legal template fixture", versionReference: "fixture-1", acceptanceEvidence: "Synthetic signed document fixture", acceptedAt: new Date().toISOString() },
});
assert.equal(unreviewedAgreement.response.status, 400);
const agreement = await request("/api/agreements", {
  method: "POST", cookie,
  body: { opportunityId, quotationId: quote.data.id, templateReference: "Synthetic legal template fixture", versionReference: "fixture-1", legalReviewReference: "Synthetic legal review fixture", acceptanceEvidence: "Synthetic signed document fixture", acceptedAt: new Date().toISOString() },
});
assert.equal(agreement.response.status, 201, JSON.stringify(agreement.data));
const verifiedPayment = await request(`/api/payments/${payment.data.id}`, {
  method: "PATCH", cookie, body: { action: "VERIFY", evidence: "Synthetic independent bank verification fixture", reference: `E2E-BANK-${suffix}` },
});
assert.equal(verifiedPayment.response.status, 200, JSON.stringify(verifiedPayment.data));
const duplicatePayment = await request("/api/payments", {
  method: "POST", cookie,
  body: { opportunityId, quotationId: quote.data.id, amountMinor: quote.data.totalMinor, method: "MANUAL_BANK" },
});
assert.equal(duplicatePayment.response.status, 201, JSON.stringify(duplicatePayment.data));
for (const action of ["REQUEST", "SUBMIT_FOR_VERIFICATION"]) {
  const changed = await request(`/api/payments/${duplicatePayment.data.id}`, {
    method: "PATCH", cookie, body: { action, evidence: `Synthetic duplicate ${action} fixture` },
  });
  assert.equal(changed.response.status, 200, JSON.stringify(changed.data));
}
const duplicateReference = await request(`/api/payments/${duplicatePayment.data.id}`, {
  method: "PATCH", cookie,
  body: { action: "VERIFY", evidence: "Same synthetic bank proof", reference: `E2E-BANK-${suffix}` },
});
assert.equal(duplicateReference.response.status, 409);
const won = await request(`/api/opportunities/${opportunityId}/stage`, {
  method: "POST", cookie, body: { stage: "WON", reason: "Synthetic quotation, agreement and payment gates met" },
});
assert.equal(won.response.status, 200, JSON.stringify(won.data));
const projects = await request("/api/onboarding", { cookie });
const project = projects.data.projects.find((value) => value.opportunity_id === opportunityId);
assert.ok(project, "Closing must create an onboarding project");
const kitChecklist = await request(`/api/onboarding/${project.id}`, { cookie });
assert.equal(kitChecklist.response.status, 200);
assert.equal(kitChecklist.data.checklist.length, 18);
assert.equal(kitChecklist.data.checklist[0].step_key, "INVOICE_RECORD");
assert.equal(kitChecklist.data.checklist.at(-1).step_key, "RENEWAL");
assert.ok(kitChecklist.data.checklist.some((step) => step.step_key === "MIGRATION_SIGNOFF" && step.source_document === "06_Aadhar_POS_Implementation_GoLive_Checklist.docx"));
const blockedUat = await request(`/api/onboarding/${project.id}`, {
  method: "PATCH", cookie, body: { stepKey: "UAT", status: "PASS", evidenceReference: "Synthetic signature alone" },
});
assert.equal(blockedUat.response.status, 409);
const blockedGoLive = await request(`/api/onboarding/${project.id}`, {
  method: "PATCH", cookie, body: { stepKey: "GO_LIVE", status: "PASS", evidenceReference: "Synthetic app load only" },
});
assert.equal(blockedGoLive.response.status, 409);

const overview = await request("/api/overview", { cookie });
assert.equal(Number(overview.data.summary.leads), leadsBefore + 2);
assert.equal(Number(overview.data.summary.qualified), qualifiedBefore + 1);
console.log(
  "HTTP E2E passed: CRM, inbox/outreach safety, demo placeholder, price conflict, quote, payment, close/onboarding gates and dashboard",
);
