"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ClipboardCheck, Plus } from "lucide-react";
import { signalKeys, type Insight } from "@/lib/insights";

type ObservationRow = {
  id: string;
  signal_key: string;
  observed_value: boolean;
  confidence: number;
  source_url: string | null;
  note: string | null;
  observed_at: string;
  actor_name: string;
};
type Mutate = (
  path: string,
  body: unknown,
  method?: string,
  success?: string,
) => Promise<boolean>;
const pretty = (value: string) =>
  value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export default function ResearchPanel({
  leadId,
  canWrite,
  onMutate,
}: {
  leadId: string;
  canWrite: boolean;
  onMutate: Mutate;
}) {
  const [observations, setObservations] = useState<ObservationRow[]>([]);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [signalKey, setSignalKey] = useState<string>("WEBSITE_EXISTS");
  const [observedValue, setObservedValue] = useState("false");
  const [sourceUrl, setSourceUrl] = useState("");
  const [note, setNote] = useState("");
  const [confidence, setConfidence] = useState("0.8");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const [observed, derived] = await Promise.all([
        fetch(`/api/leads/${leadId}/observations`, { cache: "no-store" }).then(
          (response) => response.json(),
        ),
        fetch(`/api/leads/${leadId}/insights`, { cache: "no-store" }).then(
          (response) => response.json(),
        ),
      ]);
      if (observed.error || derived.error)
        throw new Error(observed.error || derived.error);
      setObservations(observed.observations);
      setInsight(derived.insights);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load research",
      );
    }
  }, [leadId]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const ok = await onMutate(
      `/api/leads/${leadId}/observations`,
      {
        signalKey,
        observedValue: observedValue === "true",
        sourceUrl: sourceUrl || null,
        note: note || null,
        confidence: Number(confidence),
      },
      "POST",
      "Observation recorded",
    );
    if (ok) {
      setNote("");
      setSourceUrl("");
      await load();
    }
  }
  return (
    <section className="panel research-panel">
      <div className="section-head">
        <h2>
          Research signals<span>{observations.length}</span>
        </h2>
        <span className="subtle-label">EVIDENCE LED</span>
      </div>
      {insight && (
        <div className="research-summary">
          <div>
            <span>Lead fit</span>
            <strong>
              {insight.fitScore == null ? "—" : `${insight.fitScore}/100`}
            </strong>
            <small>{insight.fitLabel}</small>
          </div>
          <div>
            <span>Digital maturity</span>
            <strong>
              {insight.digitalMaturityScore == null
                ? "—"
                : `${insight.digitalMaturityScore}/100`}
            </strong>
            <small>{insight.digitalCoverage}</small>
          </div>
          <div>
            <span>Buying intent</span>
            <strong>—</strong>
            <small>Only prospect actions can inform intent</small>
          </div>
        </div>
      )}
      {insight && insight.candidates.length > 0 && (
        <div className="research-candidates">
          <strong>Offer candidates</strong>
          <p>
            Internal suggestions from segment and recorded signals. Verify
            capabilities before presenting an offer.
          </p>
          <div>
            {insight.candidates.map((item) => (
              <span key={item.product} title={item.reason}>
                {pretty(item.product)}{" "}
                <small>
                  {item.confidence === "OBSERVED" ? "signal" : "segment"}
                </small>
              </span>
            ))}
          </div>
        </div>
      )}
      {canWrite && (
        <form className="research-form" onSubmit={submit}>
          <div className="research-form-head">
            <ClipboardCheck size={16} />
            <strong>Record an observation</strong>
          </div>
          <div className="form-grid">
            <label>
              Signal
              <select
                value={signalKey}
                onChange={(event) => setSignalKey(event.target.value)}
              >
                {signalKeys.map((key) => (
                  <option key={key} value={key}>
                    {pretty(key)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Observed value
              <select
                value={observedValue}
                onChange={(event) => setObservedValue(event.target.value)}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
          </div>
          <div className="form-grid">
            <label>
              Evidence URL
              <input
                type="url"
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="https://…"
              />
            </label>
            <label>
              Confidence
              <select
                value={confidence}
                onChange={(event) => setConfidence(event.target.value)}
              >
                <option value="1">High · 100%</option>
                <option value="0.8">Good · 80%</option>
                <option value="0.6">Tentative · 60%</option>
              </select>
            </label>
          </div>
          <label>
            Note
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What exactly did you observe?"
            />
          </label>
          <button className="button secondary" type="submit">
            <Plus size={15} /> Save observation
          </button>
        </form>
      )}
      {error && (
        <p className="research-error" role="alert">
          {error}
        </p>
      )}
      {observations.length ? (
        <div className="observations-list">
          {observations.map((item) => (
            <div key={item.id}>
              <span className="observation-answer">
                {item.observed_value ? "YES" : "NO"}
              </span>
              <div>
                <strong>{pretty(item.signal_key)}</strong>
                <small>
                  {item.note || "No note"} · {item.actor_name} ·{" "}
                  {Math.round(item.confidence * 100)}% confidence
                </small>
                {item.source_url && (
                  <a href={item.source_url} target="_blank" rel="noreferrer">
                    View source
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="research-empty">
          No observations yet. Record what you can verify; unknown signals stay
          unknown.
        </p>
      )}
    </section>
  );
}
