"use client";

import { useEffect, useState } from "react";

type Analytics = {
  funnel: Array<{ temperature: string; count: number }>;
  aiDrafts: Array<{ status: string; source: string; count: number }>;
  quotes: Array<{ status: string; count: number; value_minor: string }>;
  payments: { verified_minor: string; pending: number };
  followUps: Array<{ status: string; count: number }>;
};
const title = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
const npr = (minor: string | number) => `NPR ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(minor) / 100)}`;

/** Buying-temperature funnel and AI/quote/payment outcomes, from recorded state only. */
export default function FunnelPanel() {
  const [data, setData] = useState<Analytics | null>(null);
  useEffect(() => {
    let active = true;
    void fetch("/api/analytics", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((result) => { if (active) setData(result); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  if (!data) return null;
  const sum = (items: Array<{ count: number }>) => items.reduce((total, item) => total + item.count, 0);
  const queued = sum(data.aiDrafts.filter((item) => item.status === "QUEUED_FOR_APPROVAL"));
  const drafted = sum(data.aiDrafts);
  return <section className="funnel-panel" aria-label="Sales funnel">
    <div className="funnel-head"><h2>Buying-temperature funnel</h2><span>From lead messages and system events</span></div>
    <table className="funnel-table"><thead><tr><th scope="col">Stage</th><th scope="col">Leads</th></tr></thead>
      <tbody>{data.funnel.filter((row) => row.temperature !== "COLD" || row.count > 0).map((row) => <tr key={row.temperature}><th scope="row">{title(row.temperature)}</th><td>{row.count}</td></tr>)}</tbody></table>
    <div className="funnel-facts">
      <div><span>AI replies drafted</span><strong>{drafted}</strong><small>{queued} queued by a person</small></div>
      <div><span>Quotations</span><strong>{sum(data.quotes)}</strong><small>{data.quotes.map((row) => `${title(row.status)} ${row.count}`).join(" · ") || "None yet"}</small></div>
      <div><span>Verified payments</span><strong>{npr(data.payments?.verified_minor ?? 0)}</strong><small>{data.payments?.pending ?? 0} awaiting verification</small></div>
      <div><span>Follow-up drafts</span><strong>{sum(data.followUps.filter((row) => row.status === "DRAFTED"))}</strong><small>{sum(data.followUps.filter((row) => row.status === "CANCELLED"))} cancelled by a reply or opt-out</small></div>
    </div>
  </section>;
}
