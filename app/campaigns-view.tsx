"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, FlaskConical, Plus, X } from "lucide-react";

export type Campaign = {
  id: string;
  name: string;
  segment: string;
  hypothesis: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "CLOSED";
  lead_count: number;
  created_at: string;
};

type Mutate = (
  path: string,
  body: unknown,
  method?: string,
  success?: string,
) => Promise<boolean>;

export default function CampaignsView({
  campaigns,
  canWrite,
  canManage,
  onMutate,
}: {
  campaigns: Campaign[];
  canWrite: boolean;
  canManage: boolean;
  onMutate: Mutate;
}) {
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [name, setName] = useState("");
  const [segment, setSegment] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [nextStatus, setNextStatus] = useState<Campaign["status"]>("DRAFT");
  const [reason, setReason] = useState("");

  async function create(event: FormEvent) {
    event.preventDefault();
    if (
      await onMutate(
        "/api/campaigns",
        { name, segment, hypothesis },
        "POST",
        "Campaign created",
      )
    ) {
      setCreating(false);
      setName("");
      setSegment("");
      setHypothesis("");
    }
  }

  async function changeStatus(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    if (
      await onMutate(
        `/api/campaigns/${selected.id}`,
        { status: nextStatus, reason },
        "PATCH",
        "Campaign status updated",
      )
    )
      setSelected(null);
  }

  return (
    <>
      <div className="campaigns-bar">
        <div>
          <FlaskConical size={18} />
          <span>
            Campaigns track an ICP hypothesis and a group of leads. They do not
            send messages.
          </span>
        </div>
        {canWrite && (
          <button className="button primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> New campaign
          </button>
        )}
      </div>
      {campaigns.length ? (
        <div className="campaign-grid">
          {campaigns.map((item) => (
            <button
              className="campaign-card"
              key={item.id}
              onClick={() => {
                setSelected(item);
                setNextStatus(item.status);
                setReason("");
              }}
            >
              <div>
                <span
                  className={`campaign-status ${item.status.toLowerCase()}`}
                >
                  {item.status}
                </span>
                <span className="campaign-count">{item.lead_count} leads</span>
              </div>
              <h2>{item.name}</h2>
              <p className="campaign-segment">{item.segment}</p>
              <p className="campaign-hypothesis">{item.hypothesis}</p>
              <span className="campaign-open">
                View campaign <ArrowRight size={15} />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="panel campaign-empty">
          <div className="empty-icon">
            <FlaskConical size={22} />
          </div>
          <h2>Test your first market hypothesis</h2>
          <p>
            Define a segment and what you expect to learn. You can assign leads
            from each business record.
          </p>
          {canWrite && (
            <button
              className="button primary"
              onClick={() => setCreating(true)}
            >
              <Plus size={16} /> New campaign
            </button>
          )}
        </div>
      )}
      {creating && (
        <div
          className="drawer-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCreating(false);
          }}
        >
          <form
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="New campaign"
            onSubmit={create}
          >
            <div className="drawer-head">
              <span>MARKET TEST</span>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setCreating(false)}
              >
                <X size={20} />
              </button>
            </div>
            <h2>New campaign</h2>
            <p>Start in draft. Add leads to the cohort from their records.</p>
            <label>
              Campaign name
              <input
                required
                minLength={3}
                maxLength={160}
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Pokhara hotels with direct booking gaps"
              />
            </label>
            <label>
              Segment
              <input
                required
                minLength={3}
                maxLength={160}
                value={segment}
                onChange={(event) => setSegment(event.target.value)}
                placeholder="e.g. Boutique hotels in Pokhara"
              />
            </label>
            <label>
              Hypothesis
              <textarea
                required
                minLength={10}
                maxLength={1500}
                value={hypothesis}
                onChange={(event) => setHypothesis(event.target.value)}
                placeholder="What problem and offer will this cohort test?"
              />
            </label>
            <button className="button primary wide" type="submit">
              Create draft campaign
            </button>
          </form>
        </div>
      )}
      {selected && (
        <div
          className="drawer-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <section
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Campaign detail"
          >
            <div className="drawer-head">
              <span>CAMPAIGN</span>
              <button aria-label="Close" onClick={() => setSelected(null)}>
                <X size={20} />
              </button>
            </div>
            <h2>{selected.name}</h2>
            <p>{selected.segment}</p>
            <div className="campaign-detail-hypothesis">
              <strong>Hypothesis</strong>
              <p>{selected.hypothesis}</p>
            </div>
            <div className="facts">
              <div>
                <span>Status</span>
                <strong>{selected.status}</strong>
              </div>
              <div>
                <span>Leads</span>
                <strong>{selected.lead_count}</strong>
              </div>
            </div>
            <p className="field-help">
              Assign leads to this campaign in the qualification panel of each
              lead.
            </p>
            {canManage && (
              <form onSubmit={changeStatus}>
                <label>
                  Status
                  <select
                    value={nextStatus}
                    onChange={(event) =>
                      setNextStatus(event.target.value as Campaign["status"])
                    }
                  >
                    <option>DRAFT</option>
                    <option>ACTIVE</option>
                    <option>PAUSED</option>
                    <option>CLOSED</option>
                  </select>
                </label>
                <label>
                  Reason
                  <textarea
                    required
                    minLength={5}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Why is the status changing?"
                  />
                </label>
                <button
                  type="submit"
                  disabled={nextStatus === selected.status}
                  className="button primary wide"
                >
                  Save status
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
