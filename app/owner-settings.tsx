"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { BadgeCheck, CircleAlert, FileUp, ShieldCheck } from "lucide-react";
import "@/app/owner-settings.css";

async function call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(path, { method, cache: "no-store", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Request failed");
  return result as T;
}
const label = (value: string | null | undefined) => value ? value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()) : "Not set";

type Profile = Record<string, string | null>;
type Readiness = { ready: boolean; missing: string[] };

function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); setNotice(success); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save"); return false; }
    finally { setBusy(false); }
  }
  const alerts = <>{error && <div className="alert error" role="alert">{error}</div>}{notice && <div className="alert success" role="status">{notice}</div>}</>;
  return { busy, run, alerts };
}

const companyFields: Array<[string, string, string]> = [
  ["legal_or_trading_name", "legalOrTradingName", "Legal / trading name"], ["brand", "brand", "Brand"],
  ["city", "city", "City"], ["country", "country", "Country"], ["primary_whatsapp", "primaryWhatsapp", "Primary WhatsApp"],
  ["pan_number", "panNumber", "PAN number (9 digits)"], ["registered_name", "registeredName", "Registered name"],
  ["registered_address", "registeredAddress", "Full registered address"], ["registration_date", "registrationDate", "Registration date"],
  ["authorized_signatory", "authorizedSignatory", "Authorized signatory"], ["legal_email", "legalEmail", "Legal email"], ["bank_details", "bankDetails", "Bank details (for payment instructions)"],
];

export function CompanyTaxPanel({ role }: { role: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<Profile>({});
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [evidence, setEvidence] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const { busy, run, alerts } = useAction();
  const load = useCallback(async () => {
    const data = await call<{ profile: Profile | null; readiness: Readiness }>("/api/company");
    setProfile(data.profile); setDraft(data.profile ?? {}); setReadiness(data.readiness);
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load().catch(() => undefined), 0); return () => window.clearTimeout(timer); }, [load]);
  const owner = role === "OWNER";
  if (!profile) return <div className="automation-panel"><p className="automation-empty">{owner ? "Company profile not created yet." : "Company profile not configured."}</p>
    {owner && <div className="owner-apply"><button className="button primary" disabled={busy} onClick={() => void run(async () => { await call("/api/owner-config", "POST", {}); await load(); }, "Owner-approved configuration applied")}>Apply owner-approved configuration</button></div>}{alerts}</div>;
  function save(event: FormEvent) {
    event.preventDefault();
    const body: Record<string, string | null> = { action: "UPDATE" };
    for (const [column, key] of companyFields) if ((draft[column] ?? "") !== (profile?.[column] ?? "")) body[key] = draft[column]?.trim() ? draft[column]!.trim() : null;
    void run(async () => { await call("/api/company", "PATCH", body); await load(); }, "Company details saved");
  }
  async function upload() {
    if (!file) return;
    const form = new FormData(); form.append("document", file);
    const response = await fetch("/api/company/pan-document", { method: "POST", body: form });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Upload failed");
    await load();
  }
  return <>
    <div className={`automation-intro ${readiness?.ready ? "" : "warning"}`}>{readiness?.ready ? <BadgeCheck size={19} /> : <CircleAlert size={19} />}<div>
      <strong>Tax status: {profile.tax_status === "PAN_ONLY" ? "PAN only — VAT is not added to Aayatra quotations" : "VAT registered"}</strong>
      <span>{readiness?.ready ? "Company data is verified for production invoices." : `Development continues normally. Before a production legal/tax invoice: ${readiness?.missing.map(label).join(", ")}.`} Aadhar POS is never described as IRD-certified; PAN registration is not product certification.</span>
    </div></div>
    {alerts}
    <div className="automation-layout">
      <section className="automation-panel automation-form-panel">
        <div className="automation-panel-head"><h2>Company → Tax &amp; Registration</h2><span>{label(profile.document_status)} · legal {label(profile.legal_status)}</span></div>
        <form className="automation-form" onSubmit={save}>
          <div className="automation-two">{companyFields.map(([column, , title]) => <label key={column}>{title}
            {column === "bank_details" || column === "registered_address"
              ? <textarea value={draft[column] ?? ""} disabled={!owner || busy} onChange={(event) => setDraft({ ...draft, [column]: event.target.value })} rows={2} />
              : <input type={column === "registration_date" ? "date" : column === "legal_email" ? "email" : "text"} value={(draft[column] ?? "").slice(0, column === "registration_date" ? 10 : undefined)} disabled={!owner || busy} onChange={(event) => setDraft({ ...draft, [column]: event.target.value })} />}
          </label>)}</div>
          {owner && <div className="automation-form-foot"><span>Changing PAN or registered name after verification sends the document back for review.</span><button className="button primary" disabled={busy}>Save company details</button></div>}
        </form>
      </section>
      <section className="automation-panel">
        <div className="automation-panel-head"><h2>PAN registration document</h2><span>{label(profile.document_status)}</span></div>
        <div className="automation-form">
          <p className="owner-meta">{profile.pan_document_reference ? <>Stored as <code>{profile.pan_document_reference}</code>{profile.verified_at ? ` · verified ${new Date(profile.verified_at).toLocaleDateString()}` : ""}</> : "Not uploaded yet (pending). Not required for local or test development."}</p>
          {owner && <>
            <label>Upload PDF, PNG or JPEG (≤ 5 MB)<input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
            <button className="button secondary" disabled={busy || !file} onClick={() => void run(upload, "PAN document uploaded; verify it against the original before use")}><FileUp size={15} /> Upload document</button>
            <label>Verification evidence<input value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Checked against original IRD certificate on …" /></label>
            <div className="owner-row">
              <button className="button primary" disabled={busy || evidence.trim().length < 12 || !profile.pan_document_reference || !profile.pan_number} onClick={() => void run(async () => { await call("/api/company", "PATCH", { action: "VERIFY_PAN_DOCUMENT", evidence: evidence.trim() }); await load(); }, "PAN registration verified")}><ShieldCheck size={15} /> Mark verified</button>
              <button className="button secondary" disabled={busy || evidence.trim().length < 12} onClick={() => void run(async () => { await call("/api/company", "PATCH", { action: "APPROVE_LEGAL", evidence: evidence.trim() }); await load(); }, "Legal/SLA wording recorded as approved")}>Record legal approval</button>
            </div>
            <p className="owner-meta">VAT registration needs its own verified document; it is never inferred from PAN. Recording it returns the tax policy to draft for re-approval.</p>
          </>}
        </div>
      </section>
    </div>
  </>;
}

type Feature = { id: string; product_family: string; feature_key: string; name: string; implementation_status: string; commercial_status: string; evidence: string; approved_language: string | null; limitations: string | null; conditions: string | null; sales_treatment: string };
const implementationStatuses = ["VERIFIED_AVAILABLE", "AVAILABLE_WITH_CONFIGURATION", "PARTIAL", "BETA", "PLANNED", "CUSTOM_ONLY", "NOT_AVAILABLE", "UNKNOWN"];
const commercialStatuses = ["SELLABLE", "SELL_WITH_DISCLOSURE", "REVIEW_REQUIRED", "NOT_SALES_SAFE"];

export function FeatureClaimsPanel({ role }: { role: string }) {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [editing, setEditing] = useState<Feature | null>(null);
  const { busy, run, alerts } = useAction();
  const load = useCallback(async () => setFeatures((await call<{ features: Feature[] }>("/api/features")).features), []);
  useEffect(() => { const timer = window.setTimeout(() => void load().catch(() => undefined), 0); return () => window.clearTimeout(timer); }, [load]);
  const canEdit = role === "OWNER" || role === "PRODUCT_APPROVER";
  return <>
    <div className="automation-intro warning"><CircleAlert size={19} /><div><strong>Poster prices are canonical; poster feature claims are not.</strong><span>The AI sells a feature only when it is VERIFIED_AVAILABLE or AVAILABLE_WITH_CONFIGURATION with approved wording. Cite source code, tests and a live demo check — never a poster. Multi-branch stays not sales-safe until the source is upgraded and re-verified.</span></div></div>
    {alerts}
    <div className="automation-panel">
      <div className="automation-panel-head"><h2>Feature claim register</h2><span>{features.filter((f) => f.commercial_status === "SELLABLE").length} sellable · {features.length} tracked</span></div>
      <div className="feature-claims">{features.map((feature) => <div className="feature-claim" key={feature.id}>
        <div><strong>{feature.name}</strong><small>{label(feature.product_family)} · {feature.feature_key}</small></div>
        <span className={`claim-status claim-${feature.implementation_status.toLowerCase()}`}>{label(feature.implementation_status)}</span>
        <span className="automation-status">{label(feature.commercial_status)}</span>
        {canEdit && <button className="button secondary" onClick={() => setEditing(feature)}>Update</button>}
        <small className="feature-evidence">{feature.evidence}</small>
        {editing?.id === feature.id && <form className="automation-form feature-edit" onSubmit={(event) => { event.preventDefault(); void run(async () => { await call(`/api/features/${feature.id}`, "PATCH", { implementationStatus: editing.implementation_status, commercialStatus: editing.commercial_status, evidence: editing.evidence, approvedLanguage: editing.approved_language || null, limitations: editing.limitations || null, conditions: editing.conditions || null }); setEditing(null); await load(); }, "Feature claim updated and recorded in history"); }}>
          <div className="automation-two">
            <label>Implementation status<select value={editing.implementation_status} onChange={(event) => setEditing({ ...editing, implementation_status: event.target.value })}>{implementationStatuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></label>
            <label>Commercial status<select value={editing.commercial_status} onChange={(event) => setEditing({ ...editing, commercial_status: event.target.value })}>{commercialStatuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></label>
          </div>
          <label>Evidence (source path, test, demo check)<input value={editing.evidence} onChange={(event) => setEditing({ ...editing, evidence: event.target.value })} minLength={12} required /></label>
          <label>Approved customer wording<input value={editing.approved_language ?? ""} onChange={(event) => setEditing({ ...editing, approved_language: event.target.value })} placeholder="e.g. orders print KOT tickets in the kitchen automatically" /></label>
          <div className="automation-two"><label>Limitations<input value={editing.limitations ?? ""} onChange={(event) => setEditing({ ...editing, limitations: event.target.value })} /></label><label>Configuration conditions<input value={editing.conditions ?? ""} onChange={(event) => setEditing({ ...editing, conditions: event.target.value })} /></label></div>
          <div className="automation-form-foot"><button type="button" className="button secondary" onClick={() => setEditing(null)}>Cancel</button><button className="button primary" disabled={busy}>Save claim</button></div>
        </form>}
      </div>)}</div>
    </div>
  </>;
}

type WhatsApp = { settings: Record<string, string | null> | null; status: { state: string; missing: string[] }; testProvider: boolean };
const waFields: Array<[string, string, string]> = [["phone_number_id", "phoneNumberId", "Phone number ID"], ["waba_id", "wabaId", "WhatsApp Business Account ID"], ["access_token_secret_ref", "accessTokenSecretRef", "Access token — env var name"], ["app_secret_ref", "appSecretRef", "App secret — env var name"], ["webhook_verify_token_secret_ref", "webhookVerifyTokenSecretRef", "Webhook verify token — env var name"], ["api_version", "apiVersion", "Graph API version"]];

export function WhatsAppPanel({ role }: { role: string }) {
  const [data, setData] = useState<WhatsApp | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const { busy, run, alerts } = useAction();
  const load = useCallback(async () => { const result = await call<WhatsApp>("/api/whatsapp-settings"); setData(result); setDraft(Object.fromEntries(Object.entries(result.settings ?? {}).map(([key, value]) => [key, value ?? ""]))); }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load().catch(() => undefined), 0); return () => window.clearTimeout(timer); }, [load]);
  if (!data) return <div className="automation-panel"><p className="automation-empty">Loading WhatsApp channel…</p></div>;
  return <>
    <div className={`automation-intro ${data.status.state === "CONFIGURED" ? "" : "warning"}`}><ShieldCheck size={19} /><div><strong>WhatsApp Cloud API: {label(data.status.state)}{data.testProvider ? " · test provider active (nothing is delivered)" : ""}</strong><span>{data.status.state === "CONFIGURED" ? "Approved replies are delivered within WhatsApp's 24-hour service window. Every send still needs human approval." : `Business number ${data.settings?.display_phone ?? "+977 9804573494"} can be shown in marketing, but automation stays off until: ${data.status.missing.join(", ")}. Store secrets in the server environment; enter only their variable names here.`}</span></div></div>
    {alerts}
    <section className="automation-panel automation-form-panel">
      <div className="automation-panel-head"><h2>WhatsApp channel</h2><span>Webhook: /api/webhooks/whatsapp</span></div>
      <form className="automation-form" onSubmit={(event) => { event.preventDefault(); void run(async () => { await call("/api/whatsapp-settings", "PATCH", Object.fromEntries(waFields.map(([column, key]) => [key, draft[column]?.trim() || (key === "apiVersion" ? undefined : null)]))); await load(); }, "WhatsApp settings saved"); }}>
        <div className="automation-two">{waFields.map(([column, , title]) => <label key={column}>{title}<input value={draft[column] ?? ""} disabled={role !== "OWNER" || busy} onChange={(event) => setDraft({ ...draft, [column]: event.target.value })} placeholder={column.endsWith("_ref") ? "WHATSAPP_ACCESS_TOKEN" : ""} /></label>)}</div>
        {role === "OWNER" && <div className="automation-form-foot"><span>Never paste a token here — only the environment variable name.</span><button className="button primary" disabled={busy}>Save channel</button></div>}
      </form>
    </section>
  </>;
}
