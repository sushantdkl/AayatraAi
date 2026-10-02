"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowRight, MessageCircle, PauseCircle, ShieldCheck, UserRoundCheck } from "lucide-react";
import "@/app/conversations.css";
import "@/app/conversations-mobile-fix.css";

type Conversation = {
  id: string; lead_id: string; channel: string; status: string; control_mode: string;
  needs_human: boolean; unread_count: number; summary: string | null;
  last_message_at: string | null; business_name: string; industry: string;
  fit_score: number | null; lead_status: string; contact_name: string | null;
  contact_email: string | null; contact_phone: string | null;
  opportunity_stage: string | null; opportunity_value_minor: string | null;
  latest_intent: string | null;
};
type Message = { id: string; direction: string; body: string; created_at: string; provider: string | null };
type LeadOption = { id: string; name: string };
type Filter = "NEEDS_HUMAN" | "HOT" | "READY" | "UNREAD" | "ALL";
const filters: Array<[Filter, string]> = [["NEEDS_HUMAN", "Needs human"], ["HOT", "Hot"], ["READY", "Ready to buy"], ["UNREAD", "Unread"], ["ALL", "All"]];
const display = (value: string | null) => value ? value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()) : "Not recorded";
const time = (value: string | null) => value ? new Date(value).toLocaleString("en-NP", { dateStyle: "medium", timeStyle: "short" }) : "No messages";

async function call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(path, { method, cache: "no-store", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Request failed");
  return result as T;
}

export default function ConversationsView({ leads, canWrite }: { leads: LeadOption[]; canWrite: boolean }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<Filter>("NEEDS_HUMAN");
  const [newLeadId, setNewLeadId] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    const result = await call<{ conversations: Conversation[] }>("/api/conversations");
    setConversations(result.conversations);
    setSelectedId((current) => current ?? result.conversations[0]?.id ?? null);
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load inbox")), 0); return () => window.clearTimeout(timer); }, [refresh]);
  useEffect(() => {
    if (!selectedId) return;
    const timer = window.setTimeout(() => void call<{ messages: Message[] }>(`/api/conversations/${selectedId}/messages`).then((result) => setMessages(result.messages)).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load thread")), 0);
    return () => window.clearTimeout(timer);
  }, [selectedId]);
  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? null;
  const visible = useMemo(() => conversations.filter((conversation) => {
    if (filter === "NEEDS_HUMAN") return conversation.needs_human;
    if (filter === "HOT") return conversation.opportunity_stage === "HOT";
    if (filter === "READY") return conversation.opportunity_stage === "READY" || conversation.latest_intent === "PURCHASE_INTENT";
    if (filter === "UNREAD") return conversation.unread_count > 0;
    return true;
  }), [conversations, filter]);
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      await action(); await refresh();
      if (selectedId) setMessages((await call<{ messages: Message[] }>(`/api/conversations/${selectedId}/messages`)).messages);
      setNotice(success);
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Action failed"); return false; }
    finally { setBusy(false); }
  }
  async function record(event: FormEvent) {
    event.preventDefault();
    if (!selectedId) return;
    if (await run(() => call(`/api/conversations/${selectedId}/messages`, "POST", { direction: "INBOUND", body }), "Incoming message recorded and triaged")) setBody("");
  }
  return <div className="inbox-workspace">
    <div className="inbox-toolbar">
      <div className="inbox-filters" role="group" aria-label="Conversation filters">{filters.map(([key, title]) => <button key={key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{title}<span>{conversations.filter((conversation) => key === "ALL" || key === "NEEDS_HUMAN" && conversation.needs_human || key === "HOT" && conversation.opportunity_stage === "HOT" || key === "READY" && (conversation.opportunity_stage === "READY" || conversation.latest_intent === "PURCHASE_INTENT") || key === "UNREAD" && conversation.unread_count > 0).length}</span></button>)}</div>
      {canWrite && <div className="inbox-create"><label className="sr-only" htmlFor="inbox-lead">Lead</label><select id="inbox-lead" value={newLeadId} onChange={(event) => setNewLeadId(event.target.value)}><option value="">Select lead for manual thread</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}</select><button className="button secondary" disabled={busy || !newLeadId} onClick={() => void run(async () => { const result = await call<{ id: string }>("/api/conversations", "POST", { leadId: newLeadId, channel: "MANUAL" }); setSelectedId(result.id); }, "Manual conversation created")}>New thread</button></div>}
    </div>
    {error && <div className="alert error" role="alert">{error}</div>}{notice && <div className="alert success" role="status">{notice}</div>}
    <div className="inbox-grid">
      <section className="inbox-list" aria-label="Conversations"><div className="inbox-pane-head"><h2>{filters.find(([key]) => key === filter)?.[1]}</h2><span>{visible.length}</span></div>
        {visible.length ? visible.map((conversation) => <button key={conversation.id} className={`inbox-list-row ${selectedId === conversation.id ? "selected" : ""}`} onClick={() => setSelectedId(conversation.id)}>
          <span className="inbox-list-top"><strong>{conversation.business_name}</strong>{conversation.unread_count > 0 && <em>{conversation.unread_count}</em>}</span>
          <span>{display(conversation.latest_intent)} · {conversation.channel}</span>
          <small>{conversation.summary ?? "No messages yet"}</small>
        </button>) : <div className="inbox-empty"><MessageCircle size={22} /><strong>No conversations in this view</strong><span>Recorded incoming messages will appear here.</span></div>}
      </section>
      <section className="inbox-thread" aria-label="Conversation thread">
        {selected ? <><div className="inbox-pane-head"><div><h2>{selected.business_name}</h2><span>{display(selected.channel)} · {time(selected.last_message_at)}</span></div><span className="inbox-mode">{display(selected.control_mode)}</span></div>
          {canWrite && <div className="inbox-controls"><button className="button secondary" disabled={busy} onClick={() => void run(() => call(`/api/conversations/${selected.id}/control`, "POST", { action: "TAKE_OVER" }), "Human takeover recorded")}><UserRoundCheck size={15} /> Take over</button><button className="button secondary" disabled={busy} onClick={() => void run(() => call(`/api/conversations/${selected.id}/control`, "POST", { action: "PAUSE" }), "Conversation automation paused")}><PauseCircle size={15} /> Pause</button><button className="button secondary" disabled={busy} onClick={() => void run(() => call(`/api/conversations/${selected.id}/control`, "POST", { action: "MARK_READ" }), "Marked read")}>Mark read</button></div>}
          <div className="inbox-messages">{messages.length ? messages.map((message) => <div className={`inbox-message ${message.direction.toLowerCase()}`} key={message.id}><span>{display(message.direction)} · {time(message.created_at)}</span><p>{message.body}</p></div>) : <div className="inbox-empty"><MessageCircle size={22} /><strong>No messages recorded</strong><span>Use this thread for real contact, not simulated replies.</span></div>}</div>
          {canWrite && <form className="inbox-compose" onSubmit={record}><label htmlFor="inbox-incoming">Record a real incoming message</label><textarea id="inbox-incoming" value={body} onChange={(event) => setBody(event.target.value)} minLength={1} maxLength={12000} placeholder="Paste or transcribe the prospect's actual words. Nothing is sent from here." required /><button className="button primary" disabled={busy || !body.trim()}>Record and triage <ArrowRight size={15} /></button></form>}
        </> : <div className="inbox-empty inbox-main-empty"><MessageCircle size={26} /><strong>Select a conversation</strong><span>Review the exact message and decide the next human action.</span></div>}
      </section>
      <aside className="inbox-context" aria-label="Lead context">{selected ? <><div className="inbox-pane-head"><h2>Lead context</h2></div><div className="inbox-context-body"><div><span>Business</span><strong>{selected.business_name}</strong></div><div><span>Contact</span><strong>{selected.contact_name ?? selected.contact_email ?? selected.contact_phone ?? "Not linked"}</strong></div><div><span>Industry</span><strong>{display(selected.industry)}</strong></div><div><span>Lead fit</span><strong>{selected.fit_score == null ? "Unknown" : `${selected.fit_score}/100`}</strong></div><div><span>Pipeline stage</span><strong>{display(selected.opportunity_stage)}</strong></div><div><span>Latest intent</span><strong>{display(selected.latest_intent)}</strong></div><div><span>Human attention</span><strong>{selected.needs_human ? "Required" : "Not flagged"}</strong></div></div>
        </> : <div className="inbox-empty"><ShieldCheck size={23} /><strong>Evidence first</strong><span>Lead and intent details appear when you open a thread.</span></div>}</aside>
    </div>
    <p className="inbox-disclaimer">Intent triage is rule-based and provisional. No AI reply, outbound message, or delivery is triggered by recording an inbound message.</p>
  </div>;
}
