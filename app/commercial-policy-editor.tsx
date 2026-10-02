"use client";

import { useEffect, useState, type FormEvent } from "react";

type Policy = {
  status: "DRAFT" | "APPROVED"; version: number;
  tax_mode: "UNCONFIGURED" | "EXEMPT" | "EXCLUSIVE";
  tax_rate_bps: number | null; tax_label: string | null;
  max_manual_discount_bps: number; max_auto_discount_bps: number;
  max_negotiation_rounds: number; max_messages_per_contact_per_day: number;
  evidence_reference: string | null;
};

export default function CommercialPolicyEditor({ role }: { role: string }) {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [draft, setDraft] = useState<Policy | null>(null);
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void fetch("/api/commercial-policy", { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load commercial policy");
      if (active) { setPolicy(data.policy); setDraft(data.policy); }
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load commercial policy"); });
    return () => { active = false; };
  }, []);
  async function change(body: unknown) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/commercial-policy", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save commercial policy");
      setPolicy(data.policy); setDraft(data.policy);
      setMessage(body && typeof body === "object" && "action" in body && body.action === "APPROVE" ? "Policy approved. New quotations may use this version." : "Draft saved. Quotations remain blocked from approval until the policy is approved.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save commercial policy"); }
    finally { setBusy(false); }
  }
  function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    void change({ action: "SAVE_DRAFT", taxMode: draft.tax_mode, taxRateBps: draft.tax_mode === "UNCONFIGURED" ? null : draft.tax_mode === "EXEMPT" ? 0 : draft.tax_rate_bps,
      taxLabel: draft.tax_label?.trim() || null, maxManualDiscountBps: draft.max_manual_discount_bps,
      maxAutoDiscountBps: draft.max_auto_discount_bps, maxNegotiationRounds: draft.max_negotiation_rounds,
      maxMessagesPerContactPerDay: draft.max_messages_per_contact_per_day });
  }
  if (!draft) return <div className="automation-panel"><p className="automation-empty">{error || "Loading commercial policy…"}</p></div>;
  return <>
    <div className="automation-intro warning"><div><strong>Commercial approval is required before a quotation can be sent.</strong><span>Tax treatment, discount ceilings, negotiation limits and contact frequency need documented approval. Saving an edit returns the policy to draft; existing quotes must be regenerated after a policy change.</span></div></div>
    <section className="automation-panel automation-form-panel">
      <div className="automation-panel-head"><h2>Tax and sales limits</h2><span>{policy?.status} · version {policy?.version}</span></div>
      {error && <div className="alert error" role="alert">{error}</div>}
      {message && <div className="alert success" role="status">{message}</div>}
      <form className="automation-form" onSubmit={save}>
        <div className="automation-two"><label>Tax treatment<select value={draft.tax_mode} disabled={busy || role !== "OWNER"} onChange={(event) => { const tax_mode = event.target.value as Policy["tax_mode"]; setDraft({ ...draft, tax_mode, tax_rate_bps: tax_mode === "EXCLUSIVE" ? draft.tax_rate_bps : tax_mode === "EXEMPT" ? 0 : null }); }}><option value="UNCONFIGURED">Not approved</option><option value="EXEMPT">No tax charged (requires approval)</option><option value="EXCLUSIVE">Tax added to net price</option></select></label><label>Tax label<input value={draft.tax_label ?? ""} disabled={busy || role !== "OWNER"} onChange={(event) => setDraft({ ...draft, tax_label: event.target.value })} placeholder="Approved tax label" /></label></div>
        {draft.tax_mode === "EXCLUSIVE" && <label>Tax rate (%)<input type="number" min="0.01" max="100" step="0.01" value={draft.tax_rate_bps === null ? "" : draft.tax_rate_bps / 100} disabled={busy || role !== "OWNER"} onChange={(event) => setDraft({ ...draft, tax_rate_bps: Math.round(Number(event.target.value) * 100) })} /></label>}
        <div className="automation-two"><label>Maximum manual discount (%)<input type="number" min="0" max="100" step="0.01" value={draft.max_manual_discount_bps / 100} disabled={busy || role !== "OWNER"} onChange={(event) => setDraft({ ...draft, max_manual_discount_bps: Math.round(Number(event.target.value) * 100) })} /></label><label>Maximum automatic discount (%)<input type="number" min="0" max="100" step="0.01" value={draft.max_auto_discount_bps / 100} disabled={busy || role !== "OWNER"} onChange={(event) => setDraft({ ...draft, max_auto_discount_bps: Math.round(Number(event.target.value) * 100) })} /></label></div>
        <div className="automation-two"><label>Maximum negotiation rounds<input type="number" min="0" max="20" step="1" value={draft.max_negotiation_rounds} disabled={busy || role !== "OWNER"} onChange={(event) => setDraft({ ...draft, max_negotiation_rounds: Number(event.target.value) })} /></label><label>Messages per contact per day<input type="number" min="0" max="100" step="1" value={draft.max_messages_per_contact_per_day} disabled={busy || role !== "OWNER"} onChange={(event) => setDraft({ ...draft, max_messages_per_contact_per_day: Number(event.target.value) })} /></label></div>
        <p className="automation-save-warning">Limits are stored for review. Automatic discounts and outbound messages remain disabled until their workflows enforce every limit.</p>
        {role === "OWNER" && <div className="automation-form-foot"><span>Changes need a new approval.</span><button className="button secondary" disabled={busy}>Save draft</button></div>}
      </form>
      {role === "OWNER" && policy?.status === "DRAFT" && <div className="commercial-policy-approval"><label>Approval evidence reference<input value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Approved tax and sales policy document" minLength={12} maxLength={500} /></label><button className="button primary" disabled={busy || policy.tax_mode === "UNCONFIGURED" || evidence.trim().length < 12} onClick={() => void change({ action: "APPROVE", evidenceReference: evidence.trim() })}>Approve policy</button></div>}
    </section>
  </>;
}
