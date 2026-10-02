"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, CircleAlert, ExternalLink, Plus, ShieldCheck } from "lucide-react";
import { productFamilies } from "@/lib/domain";
import { allowedAutomationMode, automationFeatures, type AutomationFeature, type AutomationMode } from "@/lib/automation-controls";
import CommercialPolicyEditor from "@/app/commercial-policy-editor";
import { CompanyTaxPanel, FeatureClaimsPanel, WhatsAppPanel } from "@/app/owner-settings";
import "@/app/automation-settings.css";
import "@/app/automation-actions.css";
import "@/app/automation-controls.css";
import "@/app/commercial-discrepancy.css";
import "@/app/commercial-policy-editor.css";

type Target = {
  id: string;
  product_family: string;
  name: string;
  base_url: string | null;
  login_url: string | null;
  environment: "DEMO" | "STAGING";
  enabled: boolean;
  requires_login: boolean;
  username_secret_ref: string | null;
  password_secret_ref: string | null;
  demo_tenant_reference: string | null;
  allow_mutations: boolean;
  status: string;
  last_verified_at: string | null;
  synthetic_data_evidence: string | null;
};
type PriceSource = { id: string; price_minor: string; source_name: string; is_canonical: boolean; active: boolean };
type Item = {
  id: string;
  product_family: string;
  name: string;
  kind: string;
  billing_period: string | null;
  catalog_status: string;
  verification_status: string;
  approval_required: boolean;
  notes: string | null;
  min_price_minor: string | null;
  price_sources: PriceSource[];
  discrepancies: Array<{ id: string; description: string; source_reference: string; status: string }>;
};
type Settings = Record<string, string | null>;
type Control = { feature: AutomationFeature; mode: AutomationMode };
const salesFields: Array<[string, string]> = [
  ["primary_sales_phone", "Primary sales phone"],
  ["secondary_sales_phone", "Secondary sales phone"],
  ["whatsapp_number", "WhatsApp number"],
  ["sales_email", "Sales email"],
  ["support_email", "Support email"],
  ["website_url", "Website URL"],
  ["company_address", "Company address"],
  ["business_hours", "Business hours"],
];
const fieldApi: Record<string, string> = {
  primary_sales_phone: "primarySalesPhone", secondary_sales_phone: "secondarySalesPhone",
  whatsapp_number: "whatsappNumber", sales_email: "salesEmail", support_email: "supportEmail",
  website_url: "websiteUrl", company_address: "companyAddress", business_hours: "businessHours",
};
const familyName = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
const money = (minor: string | number) => new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 }).format(Number(minor) / 100);

async function call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method, cache: "no-store", headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Request failed");
  return result as T;
}

export default function AutomationSettings({ role }: { role: string }) {
  const [tab, setTab] = useState<"company" | "features" | "whatsapp" | "demo" | "commercial" | "policy" | "contacts" | "controls">("company");
  const [targets, setTargets] = useState<Target[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [controls, setControls] = useState<Control[]>([]);
  const [editing, setEditing] = useState<Target | null>(null);
  const [family, setFamily] = useState<string>(productFamilies[0]);
  const [name, setName] = useState("Primary demo");
  const [baseUrl, setBaseUrl] = useState("");
  const [loginUrl, setLoginUrl] = useState("");
  const [environment, setEnvironment] = useState<"DEMO" | "STAGING">("DEMO");
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [usernameRef, setUsernameRef] = useState("");
  const [passwordRef, setPasswordRef] = useState("");
  const [syntheticEvidence, setSyntheticEvidence] = useState("");
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const [canonicalPrice, setCanonicalPrice] = useState<Record<string, string>>({});
  const [floorPrice, setFloorPrice] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    const [demo, catalog, contacts, automation] = await Promise.all([
      call<{ targets: Target[] }>("/api/demo-targets"),
      call<{ items: Item[] }>("/api/commercial"),
      call<{ settings: Settings | null }>("/api/sales-settings"),
      call<{ controls: Control[] }>("/api/automation-controls"),
    ]);
    setTargets(demo.targets);
    setItems(catalog.items);
    setSettings(contacts.settings ?? {});
    setControls(automation.controls);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load settings"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); await refresh(); setNotice(success); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save"); }
    finally { setBusy(false); }
  }
  function edit(target: Target) {
    setEditing(target); setFamily(target.product_family); setName(target.name); setBaseUrl(target.base_url ?? "");
    setLoginUrl(target.login_url ?? ""); setEnvironment(target.environment); setRequiresLogin(target.requires_login);
    setUsernameRef(target.username_secret_ref ?? ""); setPasswordRef(target.password_secret_ref ?? "");
    setSyntheticEvidence(target.synthetic_data_evidence ?? "");
  }
  function fresh(productFamily: string) {
    setEditing(null); setFamily(productFamily); setName("Primary demo"); setBaseUrl(""); setLoginUrl("");
    setEnvironment("DEMO"); setRequiresLogin(false); setUsernameRef(""); setPasswordRef("");
    setSyntheticEvidence("");
  }
  async function saveDemo(event: FormEvent) {
    event.preventDefault();
    const body = {
      productFamily: family, name, baseUrl: baseUrl.trim() || null, loginUrl: loginUrl.trim() || null,
      environment, enabled: false, requiresLogin,
      usernameSecretRef: usernameRef.trim() || null, passwordSecretRef: passwordRef.trim() || null,
      demoTenantReference: editing?.demo_tenant_reference ?? null, allowMutations: false,
    };
    await run(() => call(editing ? `/api/demo-targets/${editing.id}` : "/api/demo-targets", editing ? "PATCH" : "POST", body), "Demo configuration saved for review");
  }

  return <div className="automation-settings">
    <div className="automation-tabs" role="tablist" aria-label="Sales automation settings">
      <button role="tab" aria-selected={tab === "company"} className={tab === "company" ? "active" : ""} onClick={() => setTab("company")}>Company &amp; tax</button>
      <button role="tab" aria-selected={tab === "features"} className={tab === "features" ? "active" : ""} onClick={() => setTab("features")}>Feature claims</button>
      <button role="tab" aria-selected={tab === "whatsapp"} className={tab === "whatsapp" ? "active" : ""} onClick={() => setTab("whatsapp")}>WhatsApp</button>
      <button role="tab" aria-selected={tab === "demo"} className={tab === "demo" ? "active" : ""} onClick={() => setTab("demo")}>Demo applications</button>
      <button role="tab" aria-selected={tab === "commercial"} className={tab === "commercial" ? "active" : ""} onClick={() => setTab("commercial")}>Commercial catalogue</button>
      <button role="tab" aria-selected={tab === "policy"} className={tab === "policy" ? "active" : ""} onClick={() => setTab("policy")}>Tax &amp; sales limits</button>
      <button role="tab" aria-selected={tab === "contacts"} className={tab === "contacts" ? "active" : ""} onClick={() => setTab("contacts")}>Sales contacts</button>
      <button role="tab" aria-selected={tab === "controls"} className={tab === "controls" ? "active" : ""} onClick={() => setTab("controls")}>Automation controls</button>
    </div>
    {error && <div className="alert error" role="alert">{error}</div>}
    {notice && <div className="alert success" role="status">{notice}</div>}

    {tab === "company" && <CompanyTaxPanel role={role} />}
    {tab === "features" && <FeatureClaimsPanel role={role} />}
    {tab === "whatsapp" && <WhatsAppPanel role={role} />}
    {tab === "demo" && <>
      <div className="automation-intro"><ShieldCheck size={19} /><div><strong>No live demo will run until a target is checked and approved.</strong><span>Only demo or staging environments with synthetic data should be configured. Passwords remain in secret storage; enter environment-variable names here.</span></div></div>
      <div className="automation-layout">
        <section className="automation-panel">
          <div className="automation-panel-head"><h2>Demo applications</h2><span>{targets.filter((target) => target.base_url).length} configured</span></div>
          <div className="demo-target-list">{productFamilies.map((productFamily) => {
            const target = targets.find((entry) => entry.product_family === productFamily);
            return <button key={productFamily} className={family === productFamily ? "selected" : ""} onClick={() => target ? edit(target) : fresh(productFamily)}>
              <span><strong>{familyName(productFamily)}</strong><small>{target?.base_url ? target.status.replaceAll("_", " ") : "NOT CONFIGURED"}</small></span>
              {target?.base_url ? <CircleAlert size={17} /> : <Plus size={17} />}
            </button>;
          })}</div>
        </section>
        <section className="automation-panel automation-form-panel">
          <div className="automation-panel-head"><h2>{familyName(family)}</h2><span>{editing?.status.replaceAll("_", " ") ?? "WAITING FOR DEMO URL"}</span></div>
          <form onSubmit={saveDemo} className="automation-form">
            <label>Target name<input value={name} onChange={(event) => setName(event.target.value)} minLength={3} maxLength={120} required /></label>
            <label>Demo URL<input type="url" placeholder="https://demo.example.com" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} /></label>
            <label>Login URL, if different path<input type="url" placeholder="https://demo.example.com/login" value={loginUrl} onChange={(event) => setLoginUrl(event.target.value)} /></label>
            <label>Environment<select value={environment} onChange={(event) => setEnvironment(event.target.value as "DEMO" | "STAGING")}><option value="DEMO">Demo tenant</option><option value="STAGING">Staging</option></select></label>
            <label className="automation-check"><input type="checkbox" checked={requiresLogin} onChange={(event) => setRequiresLogin(event.target.checked)} /> Requires login</label>
            {requiresLogin && <div className="automation-two"><label>Username secret reference<input placeholder="AADHAR_DEMO_USER" value={usernameRef} onChange={(event) => setUsernameRef(event.target.value)} /></label><label>Password secret reference<input placeholder="AADHAR_DEMO_PASSWORD" value={passwordRef} onChange={(event) => setPasswordRef(event.target.value)} /></label></div>}
            {editing?.base_url && <p className="automation-save-warning">Saving any change disables testing and resets approval. Review and approve the target again before another health check.</p>}
            <div className="automation-form-foot"><span>{editing?.last_verified_at ? `Last verified ${new Date(editing.last_verified_at).toLocaleDateString()}` : "Not verified yet"}</span><button className="button primary" disabled={busy}>Save configuration</button></div>
          </form>
          {editing?.base_url && role === "OWNER" && <div className="automation-demo-actions">
            <label className="synthetic-attestation">Synthetic-data verification evidence<input value={syntheticEvidence} onChange={(event) => setSyntheticEvidence(event.target.value)} placeholder="Reference to verified, synthetic-only demo tenant" minLength={12} maxLength={500} /></label>
            <button className="button secondary" disabled={busy || syntheticEvidence.trim().length < 12} onClick={() => void run(() => call(`/api/demo-targets/${editing.id}/review`, "POST", { syntheticDataEvidence: syntheticEvidence.trim() }), "Synthetic-only tenant attested; read-only health check approved")}>Approve read-only test</button>
            <button className="button secondary" disabled={busy || !["READY_FOR_TEST", "HEALTHY"].includes(targets.find((target) => target.id === editing.id)?.status ?? "")} onClick={() => void run(() => call("/api/demo-jobs", "POST", { targetId: editing.id, jobType: "HEALTH_CHECK" }), "Health check queued; run the demo worker to inspect it")}>Queue health check</button>
          </div>}
        </section>
      </div>
    </>}

    {tab === "commercial" && <>
      <div className="automation-intro"><CheckCircle2 size={19} /><div><strong>Owner-approved poster prices (OWNER_APPROVED_POSTER_2026) are canonical and quotable.</strong><span>Standard, undiscounted quotes are approved automatically. Discounts, custom work, non-standard hardware and any multi-branch promise need a person. Older draft prices stay below as superseded history.</span></div></div>
      <div className="automation-panel">
        <div className="automation-panel-head"><h2>Price and package register</h2>{role === "OWNER" && !items.length && <button className="button secondary" disabled={busy} onClick={() => void run(() => call("/api/commercial/seed-marketing", "POST", {}), "Marketing snapshot imported as drafts")}>Import marketing snapshot</button>}</div>
        {items.length ? <div className="commercial-list">{items.map((item) => <div className="commercial-row" key={item.id}>
          <div><strong>{item.name}</strong><small>{familyName(item.product_family)} · {item.kind.toLowerCase()} {item.billing_period ? `· per ${item.billing_period.toLowerCase()}` : "· one time"}</small></div>
          <strong>{(item.price_sources.find((source) => source.is_canonical && source.active) ?? item.price_sources[0]) ? money((item.price_sources.find((source) => source.is_canonical && source.active) ?? item.price_sources[0]).price_minor) : "No price"}</strong>
          <span className="automation-status">{item.catalog_status}</span>
          {role === "OWNER" && item.catalog_status === "DRAFT" && <div className="commercial-action"><input aria-label={`Evidence for ${item.name}`} placeholder="Product/price evidence reference" value={evidence[item.id] ?? ""} onChange={(event) => setEvidence({ ...evidence, [item.id]: event.target.value })} /><button className="button secondary" disabled={busy || (evidence[item.id] ?? "").trim().length < 8} onClick={() => void run(() => call(`/api/commercial/${item.id}`, "PATCH", { action: "VERIFY", evidenceReference: evidence[item.id] }), "Item verified; activation remains separate")}>Verify</button></div>}
          {role === "OWNER" && item.catalog_status === "VERIFIED" && <button className="button secondary" disabled={busy || item.discrepancies.some((entry) => entry.status === "OPEN")} onClick={() => void run(() => call(`/api/commercial/${item.id}`, "PATCH", { action: "ACTIVATE", approvalRequired: true }), "Item active with human quote approval required")}>Activate</button>}
          {role === "OWNER" && item.catalog_status === "ACTIVE" && <div className="commercial-action"><label>Minimum selling price (NPR)<input type="number" min="0" step="0.01" value={floorPrice[item.id] ?? (item.min_price_minor === null ? "" : String(Number(item.min_price_minor) / 100))} onChange={(event) => setFloorPrice({ ...floorPrice, [item.id]: event.target.value })} /></label><label>Approval evidence<input value={evidence[item.id] ?? ""} onChange={(event) => setEvidence({ ...evidence, [item.id]: event.target.value })} placeholder="Approved price-floor record" /></label><button className="button secondary" disabled={busy || !Number.isFinite(Number(floorPrice[item.id])) || floorPrice[item.id] === undefined || (evidence[item.id] ?? "").trim().length < 12} onClick={() => void run(() => call(`/api/commercial/${item.id}`, "PATCH", { action: "SET_FLOOR", minPriceMinor: Math.round(Number(floorPrice[item.id]) * 100), evidenceReference: evidence[item.id] }), "Minimum selling price recorded")}>Save floor</button></div>}
          <small>{item.notes}</small>
          {item.discrepancies.filter((entry) => entry.status === "OPEN").map((entry) => <div className="commercial-discrepancy" key={entry.id}>
            <strong>Price review required</strong><p>{entry.description}</p><small>Source: {entry.source_reference}. A starting price or indicative hardware range is not an exact approved quote.</small>
            {role === "OWNER" && <div className="commercial-reconcile"><label>Approved exact price (NPR)<input type="number" min="1" step="0.01" value={canonicalPrice[item.id] ?? ""} onChange={(event) => setCanonicalPrice({ ...canonicalPrice, [item.id]: event.target.value })} /></label><label>Approval evidence reference<input value={evidence[item.id] ?? ""} onChange={(event) => setEvidence({ ...evidence, [item.id]: event.target.value })} placeholder="Signed price sheet or approved decision" /></label><button className="button secondary" disabled={busy || !Number.isFinite(Number(canonicalPrice[item.id])) || Number(canonicalPrice[item.id]) <= 0 || (evidence[item.id] ?? "").trim().length < 12} onClick={() => void run(async () => { await call(`/api/commercial/${item.id}`, "PATCH", { action: "ADD_PRICE", price: { priceMinor: Math.round(Number(canonicalPrice[item.id]) * 100), sourceName: "Owner-approved reconciled price", evidenceReference: evidence[item.id], isCanonical: true } }); await call(`/api/commercial/${item.id}`, "PATCH", { action: "RESOLVE_DISCREPANCY", discrepancyId: entry.id, evidenceReference: evidence[item.id] }); }, "Canonical price recorded and discrepancy resolved; activation still requires separate approval")}>Record reconciled price</button></div>}
          </div>)}
        </div>)}</div> : <p className="automation-empty">No commercial records yet. Import the supplied marketing snapshot as unverified drafts, then review each item against real evidence.</p>}
      </div>
    </>}

    {tab === "policy" && <CommercialPolicyEditor role={role} />}

    {tab === "contacts" && <div className="automation-panel automation-form-panel">
      <div className="automation-panel-head"><h2>Active sales contact details</h2><CheckCircle2 size={18} /></div>
      <form className="automation-form" onSubmit={(event) => { event.preventDefault(); const body = Object.fromEntries(salesFields.map(([key]) => [fieldApi[key], settings[key]?.trim() || null])); void run(() => call("/api/sales-settings", "PATCH", body), "Sales contact details saved"); }}>
        <div className="automation-two">{salesFields.map(([key, title]) => <label key={key}>{title}<input type={key.endsWith("email") ? "email" : key === "website_url" ? "url" : "text"} value={settings[key] ?? ""} onChange={(event) => setSettings({ ...settings, [key]: event.target.value })} /></label>)}</div>
        <div className="automation-form-foot"><span>Empty values are never filled with poster examples.</span><button className="button primary" disabled={busy}>Save contacts</button></div>
      </form>
    </div>}
    {tab === "controls" && <>
      <div className="automation-intro warning"><ShieldCheck size={19} /><div><strong>High-risk automation stays human-controlled.</strong><span>Automatic sending, AI replies, demos, proposals, payment requests, closing, and onboarding are unavailable until their external evidence and provider gates are verified.</span></div></div>
      <div className="automation-panel">
        <div className="automation-panel-head"><h2>Feature modes</h2><span>{controls.filter((control) => control.mode !== "OFF").length} enabled</span></div>
        <div className="automation-control-list">{automationFeatures.map((feature) => {
          const mode = controls.find((control) => control.feature === feature)?.mode ?? "OFF";
          return <div className="automation-control-row" key={feature}>
            <div><strong>{feature.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())}</strong><small>{feature === "LEAD_SCORING" ? "Rules-based scoring may run automatically; it does not contact anyone." : "Assisted mode prepares work for a human to review."}</small></div>
            <select aria-label={`${feature.replaceAll("_", " ")} mode`} value={mode} disabled={busy || role !== "OWNER"} onChange={(event) => void run(() => call("/api/automation-controls", "PATCH", { feature, mode: event.target.value }), "Automation mode saved")}>
              {(["OFF", "ASSISTED", "AUTOMATIC_WITH_RULES"] as AutomationMode[]).filter((option) => allowedAutomationMode(feature, option)).map((option) => <option key={option} value={option}>{option.replaceAll("_", " ").toLowerCase()}</option>)}
            </select>
          </div>;
        })}</div>
      </div>
    </>}
    <p className="automation-footer"><ExternalLink size={14} /> Configuration here does not send messages, visit an external demo, or publish a price on its own.</p>
  </div>;
}
