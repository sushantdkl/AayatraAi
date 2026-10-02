"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, CircleAlert, ClipboardCheck, CreditCard, FileCheck2 } from "lucide-react";
import "@/app/commercial-lifecycle.css";

type Opportunity = { id: string; title: string; business_name: string; stage: string };
type CommercialItem = { id: string; name: string; product_family: string; catalog_status: string; verification_status: string; approval_required: boolean; price_sources: Array<{ price_minor: string }> };
type Quote = { id: string; opportunity_id: string; quotation_number: string; status: string; current_version: number; client_name: string; opportunity_title: string; total_minor: string; currency: string; valid_until: string; created_at: string };
type Payment = { id: string; opportunity_id: string; quotation_id: string; amount_minor: string; method: string; status: string; verified_at: string | null };
type Project = { id: string; opportunity_id: string; status: string; business_name: string; opportunity_title: string; uat_status: string; handover_status: string };
type Step = { id: string; step_key: string; title: string; source_document: string | null; status: string; evidence_reference: string | null };
type Tab = "quotes" | "payments" | "onboarding";
const money = (minor: string | number) => new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 }).format(Number(minor) / 100);
const human = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
async function call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(path, { method, cache: "no-store", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Request failed");
  return result as T;
}

export default function CommercialLifecycle({ opportunities, role }: { opportunities: Opportunity[]; role: string }) {
  const [tab, setTab] = useState<Tab>("quotes");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [items, setItems] = useState<CommercialItem[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [opportunityId, setOpportunityId] = useState("");
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [scope, setScope] = useState("");
  const [exclusions, setExclusions] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [evidence, setEvidence] = useState("");
  const [agreementQuoteId, setAgreementQuoteId] = useState("");
  const [templateReference, setTemplateReference] = useState("");
  const [versionReference, setVersionReference] = useState("");
  const [legalReviewReference, setLegalReviewReference] = useState("");
  const [paymentQuoteId, setPaymentQuoteId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("MANUAL_BANK");
  const [paymentReference, setPaymentReference] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const canWrite = ["OWNER","MANAGER","SALES"].includes(role);
  const canApprove = ["OWNER","MANAGER"].includes(role);
  const refresh = useCallback(async () => {
    const [q, p, o, c] = await Promise.all([
      call<{ quotations: Quote[] }>("/api/quotations"),
      call<{ payments: Payment[] }>("/api/payments"),
      call<{ projects: Project[] }>("/api/onboarding"),
      call<{ items: CommercialItem[] }>("/api/commercial"),
    ]);
    setQuotes(q.quotations); setPayments(p.payments); setProjects(o.projects); setItems(c.items);
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load commercial workflow")), 0); return () => window.clearTimeout(timer); }, [refresh]);
  useEffect(() => {
    if (!selectedProject) return;
    const timer = window.setTimeout(() => void call<{ checklist: Step[] }>(`/api/onboarding/${selectedProject}`).then((result) => setSteps(result.checklist)).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load checklist")), 0);
    return () => window.clearTimeout(timer);
  }, [selectedProject]);
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); await refresh(); if (selectedProject) setSteps((await call<{ checklist: Step[] }>(`/api/onboarding/${selectedProject}`)).checklist); setNotice(success); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Action failed"); }
    finally { setBusy(false); }
  }
  function quoteAction(id: string, action: string) {
    void run(() => call(`/api/quotations/${id}`, "PATCH", { action, evidence }), `Quotation ${human(action).toLowerCase()} with evidence recorded`);
  }
  function paymentAction(id: string, action: string) {
    void run(() => call(`/api/payments/${id}`, "PATCH", { action, evidence, ...(action === "VERIFY" ? { reference: paymentReference } : {}) }), `Payment ${human(action).toLowerCase()} with evidence recorded`);
  }
  async function createQuote(event: FormEvent) {
    event.preventDefault();
    await run(() => call("/api/quotations", "POST", { opportunityId, items: [{ itemId, quantity }], validUntil, scope, exclusions }), "Versioned quotation draft created for review");
  }
  const acceptedQuotes = quotes.filter((quote) => quote.status === "ACCEPTED");
  const selectedPaymentQuote = acceptedQuotes.find((quote) => quote.id === paymentQuoteId);
  return <div className="lifecycle-workspace">
    <div className="lifecycle-tabs" role="tablist" aria-label="Commercial lifecycle">
      <button role="tab" aria-selected={tab === "quotes"} className={tab === "quotes" ? "active" : ""} onClick={() => setTab("quotes")}>Quotations <span>{quotes.length}</span></button>
      <button role="tab" aria-selected={tab === "payments"} className={tab === "payments" ? "active" : ""} onClick={() => setTab("payments")}>Payments <span>{payments.length}</span></button>
      <button role="tab" aria-selected={tab === "onboarding"} className={tab === "onboarding" ? "active" : ""} onClick={() => setTab("onboarding")}>Onboarding <span>{projects.length}</span></button>
    </div>
    {error && <div className="alert error" role="alert">{error}</div>}{notice && <div className="alert success" role="status">{notice}</div>}
    {tab === "quotes" && <div className="lifecycle-layout">
      <section className="lifecycle-panel"><div className="lifecycle-panel-head"><FileCheck2 size={17} /><h2>Versioned quotations</h2></div>
        {quotes.length ? <div className="lifecycle-list">{quotes.map((quote) => <div className="lifecycle-record" key={quote.id}><div className="lifecycle-record-head"><strong>{quote.quotation_number}</strong><span>{human(quote.status)}</span></div><p>{quote.client_name} · {quote.opportunity_title}</p><div className="lifecycle-record-foot"><strong>{money(quote.total_minor)}</strong><small>Version {quote.current_version} · valid to {String(quote.valid_until).slice(0,10)}</small></div>
          <div className="lifecycle-actions"><a className="button secondary" href={`/api/quotations/${quote.id}/print`} target="_blank" rel="noopener noreferrer">Print / save PDF</a>{canApprove && ["DRAFT","REVIEW_REQUIRED"].includes(quote.status) && <button className="button secondary" disabled={busy || evidence.trim().length < 8} onClick={() => quoteAction(quote.id,"APPROVE")}>Approve</button>}{canApprove && quote.status === "APPROVED" && <button className="button secondary" disabled={busy || evidence.trim().length < 8} onClick={() => quoteAction(quote.id,"MARK_SENT")}>Record actual sending</button>}{canApprove && quote.status === "SENT" && <button className="button secondary" disabled={busy || evidence.trim().length < 8} onClick={() => quoteAction(quote.id,"ACCEPT")}>Record acceptance</button>}</div>
        </div>)}</div> : <p className="lifecycle-empty">No quotations yet. An active, verified commercial item is required before a draft can be calculated.</p>}
      </section>
      <aside className="lifecycle-side">{canWrite && <section className="lifecycle-panel"><div className="lifecycle-panel-head"><h2>Prepare a quotation</h2></div><form className="lifecycle-form" onSubmit={createQuote}>
        <label>Opportunity<select value={opportunityId} onChange={(event) => setOpportunityId(event.target.value)} required><option value="">Select opportunity</option>{opportunities.map((item) => <option key={item.id} value={item.id}>{item.business_name} · {item.title}</option>)}</select></label>
        <label>Verified active item<select value={itemId} onChange={(event) => setItemId(event.target.value)} required><option value="">Select item</option>{items.filter((item) => item.catalog_status === "ACTIVE" && item.verification_status === "VERIFIED").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <div className="lifecycle-two"><label>Quantity<input type="number" min="1" max="1000" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} required /></label><label>Valid until<input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} required /></label></div>
        <label>Confirmed scope<textarea value={scope} onChange={(event) => setScope(event.target.value)} minLength={10} required placeholder="Only the agreed, verified scope" /></label>
        <label>Exclusions<textarea value={exclusions} onChange={(event) => setExclusions(event.target.value)} minLength={3} required placeholder="What is not included" /></label>
        <button className="button primary" disabled={busy || !items.some((item) => item.catalog_status === "ACTIVE")}>Create review draft</button></form></section>}
        {canApprove && <section className="lifecycle-panel"><div className="lifecycle-panel-head"><ClipboardCheck size={17} /><h2>Evidence for manual actions</h2></div><div className="lifecycle-form"><label>Evidence reference<textarea value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Document ID, signed copy reference, or independently checked bank reference" /></label><small>Typing a note is not proof by itself. Verify the underlying document or bank record before recording an action.</small></div></section>}
      </aside>
    </div>}
    {tab === "payments" && <div className="lifecycle-layout"><section className="lifecycle-panel"><div className="lifecycle-panel-head"><CreditCard size={17} /><h2>Payment requests</h2></div>{payments.length ? <div className="lifecycle-list">{payments.map((payment) => <div className="lifecycle-record" key={payment.id}><div className="lifecycle-record-head"><strong>{money(payment.amount_minor)}</strong><span>{human(payment.status)}</span></div><p>{human(payment.method)} · quotation {quotes.find((quote) => quote.id === payment.quotation_id)?.quotation_number ?? payment.quotation_id}</p>{canApprove && <div className="lifecycle-actions">{payment.status === "DRAFT" && <button className="button secondary" disabled={busy || evidence.trim().length < 8} onClick={() => paymentAction(payment.id,"REQUEST")}>Record request</button>}{payment.status === "REQUESTED" && <button className="button secondary" disabled={busy || evidence.trim().length < 8} onClick={() => paymentAction(payment.id,"SUBMIT_FOR_VERIFICATION")}>Submit evidence</button>}{payment.status === "SUBMITTED_FOR_VERIFICATION" && role === "OWNER" && <button className="button secondary" disabled={busy || evidence.trim().length < 8} onClick={() => paymentAction(payment.id,"VERIFY")}>Verify independently</button>}</div>}</div>)}</div> : <p className="lifecycle-empty">No payment requests. An accepted quotation is required first.</p>}</section>
      <aside className="lifecycle-side">{canApprove && <section className="lifecycle-panel"><div className="lifecycle-panel-head"><h2>Request manual payment</h2></div><form className="lifecycle-form" onSubmit={(event) => { event.preventDefault(); if (!selectedPaymentQuote) return; void run(() => call("/api/payments", "POST", { opportunityId: selectedPaymentQuote.opportunity_id, quotationId: selectedPaymentQuote.id, amountMinor: Math.round(Number(paymentAmount) * 100), method: paymentMethod }), "Draft manual payment request created"); }}>
        <label>Accepted quotation<select value={paymentQuoteId} onChange={(event) => { setPaymentQuoteId(event.target.value); const value = acceptedQuotes.find((quote) => quote.id === event.target.value); setPaymentAmount(value ? String(Number(value.total_minor) / 100) : ""); }} required><option value="">Select accepted quotation</option>{acceptedQuotes.map((quote) => <option key={quote.id} value={quote.id}>{quote.quotation_number} · {quote.client_name}</option>)}</select></label>
        <label>Amount in NPR<input type="number" min="1" step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} required /></label>
        <label>Method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="MANUAL_BANK">Manual bank</option><option value="MANUAL_QR">Manual QR</option><option value="CASH">Cash</option></select></label>
        <button className="button primary" disabled={busy || !acceptedQuotes.length}>Create payment draft</button>
      </form></section>}
      {role === "OWNER" && <section className="lifecycle-panel"><div className="lifecycle-panel-head"><h2>Signed agreement record</h2></div><form className="lifecycle-form" onSubmit={(event) => { event.preventDefault(); const quote = acceptedQuotes.find((item) => item.id === agreementQuoteId); if (!quote) return; void run(() => call("/api/agreements", "POST", { opportunityId: quote.opportunity_id, quotationId: quote.id, templateReference, versionReference, legalReviewReference, acceptanceEvidence: evidence, acceptedAt: new Date().toISOString() }), "Accepted agreement version recorded"); }}>
        <label>Accepted quotation<select value={agreementQuoteId} onChange={(event) => setAgreementQuoteId(event.target.value)} required><option value="">Select accepted quotation</option>{acceptedQuotes.map((quote) => <option key={quote.id} value={quote.id}>{quote.quotation_number}</option>)}</select></label>
        <label>Approved template reference<input value={templateReference} onChange={(event) => setTemplateReference(event.target.value)} required /></label>
        <label>Exact signed version<input value={versionReference} onChange={(event) => setVersionReference(event.target.value)} required /></label>
        <label>Legal review / approval record<input value={legalReviewReference} onChange={(event) => setLegalReviewReference(event.target.value)} minLength={8} placeholder="Reference to the actual reviewed final agreement" required /></label>
        <button className="button secondary" disabled={busy || evidence.trim().length < 8}>Record signed agreement</button>
      </form></section>}
      {canApprove && <section className="lifecycle-panel"><div className="lifecycle-panel-head"><h2>Independent evidence</h2></div><div className="lifecycle-form"><label>Evidence description<textarea value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Signed agreement or checked bank transaction evidence" /></label><label>Unique payment transaction / receipt reference<input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Required when verifying payment" minLength={8} /></label></div></section>}
      </aside></div>}
    {tab === "onboarding" && <div className="lifecycle-layout"><section className="lifecycle-panel"><div className="lifecycle-panel-head"><h2>Implementation projects</h2></div>{projects.length ? <div className="lifecycle-list">{projects.map((project) => <button className={`lifecycle-project ${selectedProject === project.id ? "selected" : ""}`} key={project.id} onClick={() => setSelectedProject(project.id)}><strong>{project.business_name}</strong><span>{human(project.status)} · {project.opportunity_title}</span><ArrowUpRight size={15} /></button>)}</div> : <p className="lifecycle-empty">Projects are created only after a deal meets all closing gates.</p>}</section><section className="lifecycle-panel"><div className="lifecycle-panel-head"><h2>Client-kit readiness checklist</h2></div>{selectedProject ? <div className="lifecycle-list">{steps.map((step) => <div className="lifecycle-step" key={step.id}><div><strong>{step.title}</strong><span>{human(step.status)}</span>{step.source_document && <small>Source: {step.source_document}</small>}</div>{canApprove && <div className="lifecycle-actions"><button className="button secondary" disabled={busy || evidence.trim().length < 8 || step.status === "PASS"} onClick={() => void run(() => call(`/api/onboarding/${selectedProject}`, "PATCH", { stepKey: step.step_key, status: "PASS", evidenceReference: evidence }), `${step.title} recorded as passed`)}>Record pass</button></div>}</div>)}</div> : <p className="lifecycle-empty">Select a project to see its evidence gates.</p>}</section>{canApprove && <aside className="lifecycle-side"><section className="lifecycle-panel"><div className="lifecycle-panel-head"><CircleAlert size={17} /><h2>Evidence required</h2></div><div className="lifecycle-form"><label>Test or approval reference<textarea value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Signed UAT, migration reconciliation, backup record, or handover document" /></label><small>Go-live requires UAT, backup and signed approval; handover requires go-live and agreed support terms.</small></div></section></aside>}</div>}
    <p className="lifecycle-disclaimer">Commercial and legal values require human verification. Payment is never inferred from chat; only an owner can mark independently checked payment as verified.</p>
  </div>;
}
