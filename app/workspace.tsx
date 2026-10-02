"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Building2,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Database,
  FileText,
  Filter,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  ReceiptText,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import type { Actor } from "@/lib/session";
import { industries, productFamilies, stages, type Stage } from "@/lib/domain";
import ImportForm from "@/app/import-form";
import CampaignsView, { type Campaign } from "@/app/campaigns-view";
import ResearchPanel from "@/app/research-panel";
import AutomationSettings from "@/app/automation-settings";
import ConversationsView from "@/app/conversations-view";
import CommercialLifecycle from "@/app/commercial-lifecycle";

type View =
  "overview" | "leads" | "campaigns" | "pipeline" | "inbox" | "lifecycle" | "knowledge" | "demos" | "automation";
type Summary = {
  leads: string;
  qualified: string;
  opportunities: string;
  hot: string;
  ready: string;
  pipeline_minor: string;
};
type Lead = {
  id: string;
  status: string;
  fit_score: number | null;
  digital_maturity_score: number | null;
  name: string;
  industry: string;
  city: string;
  website: string | null;
  notes: string | null;
  source_type: string;
  source_reference: string | null;
  opportunity_count: string;
  created_at: string;
  campaign_id?: string | null;
};
type Opportunity = {
  id: string;
  title: string;
  stage: Stage;
  product_family: string;
  value_minor: string | null;
  currency: string;
  next_action: string | null;
  next_action_at: string | null;
  lead_id: string;
  business_name: string;
  industry: string;
  updated_at: string;
};
type ActivityItem = {
  id: string;
  kind: string;
  detail: string;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
};
type Contact = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  contact_source: string;
  contact_eligible: boolean;
};
type LeadDetail = {
  lead: Lead;
  contacts: Contact[];
  activities: ActivityItem[];
  opportunities: Opportunity[];
};
type Capability = {
  id: string;
  product_family: string;
  capability_name: string;
  status: string;
  approved_language: string | null;
  limitation: string | null;
  evidence_url: string | null;
  product_version: string | null;
  approved_by_name: string | null;
};
type Overview = {
  summary: Summary;
  priority: Opportunity[];
  followups: Array<{
    id: string;
    kind: string;
    detail: string;
    due_at: string;
    business_name: string;
    lead_id: string;
  }>;
};

const nav: Array<{ id: View; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "leads", label: "Leads", icon: Building2 },
  { id: "campaigns", label: "Campaigns", icon: CalendarRange },
  { id: "pipeline", label: "Pipeline", icon: SlidersHorizontal },
  { id: "inbox", label: "Priority inbox", icon: MessagesSquare },
  { id: "lifecycle", label: "Quotes & delivery", icon: ReceiptText },
  { id: "knowledge", label: "Product knowledge", icon: Database },
  { id: "demos", label: "Demos", icon: FileText },
  { id: "automation", label: "Sales automation", icon: Settings2 },
];

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
function money(minor: string | number | null): string {
  return minor == null
    ? "—"
    : new Intl.NumberFormat("en-NP", {
        style: "currency",
        currency: "NPR",
        maximumFractionDigits: 0,
      }).format(Number(minor) / 100);
}
function date(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("en-NP", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(value))
    : "—";
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Request failed");
  return result as T;
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <ClipboardList size={22} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
function SectionHead({
  title,
  count,
  action,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="section-head">
      <h2>
        {title}
        {count !== undefined && <span>{count}</span>}
      </h2>
      {action}
    </div>
  );
}

export default function Workspace({ actor }: { actor: Actor }) {
  const router = useRouter();
  const [view, setView] = useState<View>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadDetail | null>(null);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [showOpportunityForm, setShowOpportunityForm] = useState(false);
  const [showCapabilityForm, setShowCapabilityForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const canWrite = ["OWNER", "MANAGER", "SALES"].includes(actor.role);
  const canReview = ["OWNER", "PRODUCT_APPROVER"].includes(actor.role);

  const refresh = useCallback(async () => {
    try {
      const [
        nextOverview,
        nextLeads,
        nextCampaigns,
        nextOpportunities,
        nextCapabilities,
      ] = await Promise.all([
        api<Overview>("/api/overview"),
        api<{ leads: Lead[] }>("/api/leads"),
        api<{ campaigns: Campaign[] }>("/api/campaigns"),
        api<{ opportunities: Opportunity[] }>("/api/opportunities"),
        api<{ capabilities: Capability[] }>("/api/capabilities"),
      ]);
      setOverview(nextOverview);
      setLeads(nextLeads.leads);
      setCampaigns(nextCampaigns.campaigns);
      setOpportunities(nextOpportunities.opportunities);
      setCapabilities(nextCapabilities.capabilities);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load the workspace",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function openLead(id: string) {
    try {
      setSelectedLead(await api<LeadDetail>(`/api/leads/${id}`));
      setView("leads");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open lead");
    }
  }

  async function mutate(
    path: string,
    body: unknown,
    method = "POST",
    success = "Saved",
  ) {
    setError("");
    setNotice("");
    try {
      await api(path, { method, body: JSON.stringify(body) });
      await refresh();
      setNotice(success);
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save changes",
      );
      return false;
    }
  }

  const visibleLeads = useMemo(
    () =>
      leads.filter((lead) => {
        const matchesSearch = `${lead.name} ${lead.city} ${lead.industry}`
          .toLowerCase()
          .includes(search.toLowerCase());
        const matchesFilter =
          filter === "ALL" ||
          lead.status === filter ||
          lead.industry === filter;
        return matchesSearch && matchesFilter;
      }),
    [leads, search, filter],
  );

  const pageTitles: Record<View, [string, string]> = {
    overview: [
      "Who should I talk to right now?",
      "Your live sales priorities, grounded in the work your team has recorded.",
    ],
    leads: [
      "Businesses & leads",
      "Research, qualify and keep every source attached to the record.",
    ],
    campaigns: [
      "Campaigns",
      "Test one market hypothesis at a time and keep the lead cohort visible.",
    ],
    pipeline: [
      "Opportunity pipeline",
      "Move deals with a reason and keep the complete stage history.",
    ],
    inbox: [
      "Priority inbox",
      "Review real replies, explicit intent, and conversations needing a human.",
    ],
    lifecycle: [
      "Quotes & delivery",
      "Keep commercial approval, payment verification and onboarding in one traceable flow.",
    ],
    knowledge: [
      "Product knowledge",
      "Only reviewed capabilities can become customer-facing facts.",
    ],
    demos: [
      "Product demos",
      "Prepare focused walkthroughs from approved product knowledge.",
    ],
    automation: [
      "Sales automation settings",
      "Configure commercial truth and safe demo environments before automation runs.",
    ],
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand-mark">A</div>
          <div>
            <strong>Aayatra</strong>
            <span>SALES ENGINE</span>
          </div>
        </div>
        <div className="workspace-label">
          WORKSPACE <ChevronDown size={14} />
        </div>
        <div className="workspace-name">
          <div className="workspace-avatar">AE</div>
          <div>
            <strong>Aayatra Enterprises</strong>
            <small>Internal workspace</small>
          </div>
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          <p>SALES</p>
          {nav.filter((item) => item.id !== "automation" || ["OWNER", "MANAGER"].includes(actor.role)).map((item) => (
            <button
              key={item.id}
              aria-label={item.label}
              title={item.label}
              className={view === item.id ? "active" : ""}
              onClick={() => {
                setView(item.id);
                setSelectedLead(null);
                setError("");
              }}
            >
              <item.icon size={18} strokeWidth={1.8} />
              <span>{item.label}</span>
              {item.id === "leads" && leads.length > 0 && (
                <small>{leads.length}</small>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="mode-callout">
            <ShieldCheck size={18} />
            <div>
              <strong>Human-led mode</strong>
              <span>External sending is off</span>
            </div>
          </div>
          <button
            className="sidebar-help"
            type="button"
            onClick={() =>
              setNotice(
                "Start with a lead, record its source, then create an opportunity when a real need is identified.",
              )
            }
          >
            <CircleHelp size={17} /> How this works
          </button>
          <div className="account">
            <div className="account-avatar">
              {actor.display_name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <strong>{actor.display_name}</strong>
              <small>{label(actor.role)}</small>
            </div>
            <button
              aria-label="Sign out"
              title="Sign out"
              onClick={async () => {
                await api("/api/auth/logout", { method: "POST" });
                router.push("/login");
                router.refresh();
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} />{" "}
            <strong>{nav.find((item) => item.id === view)?.label}</strong>
          </div>
          <div className="topbar-right">
            <span className="system-status">
              <span /> System ready
            </span>
            <button
              className="icon-button"
              aria-label="Notifications"
              title="Notifications"
              onClick={() => setNotice("There are no new notifications.")}
            >
              <Bell size={18} />
            </button>
            <div className="topbar-avatar">
              {actor.display_name.slice(0, 2).toUpperCase()}
            </div>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <h1>{pageTitles[view][0]}</h1>
              <p>{pageTitles[view][1]}</p>
            </div>
            {view === "leads" && canWrite && (
              <div className="heading-actions">
                <button
                  className="button secondary"
                  onClick={() => setShowImportForm(true)}
                >
                  <Upload size={16} /> Import CSV
                </button>
                <button
                  className="button primary"
                  onClick={() => setShowLeadForm(true)}
                >
                  <Plus size={17} /> Add lead
                </button>
              </div>
            )}
            {view === "knowledge" && canReview && (
              <button
                className="button primary"
                onClick={() => setShowCapabilityForm(true)}
              >
                <Plus size={17} /> Add capability
              </button>
            )}
          </div>
          {error && (
            <div className="alert error" role="alert">
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="alert success" role="status">
              <span>{notice}</span>
              <button
                aria-label="Dismiss message"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading-stack">
              <div />
              <div />
              <div />
            </div>
          ) : (
            <>
              {view === "overview" && (
                <OverviewView
                  data={overview}
                  onOpenLead={openLead}
                  onViewLeads={() => setView("leads")}
                />
              )}
              {view === "leads" &&
                (selectedLead ? (
                  <LeadDetailView
                    data={selectedLead}
                    canWrite={canWrite}
                    onBack={() => setSelectedLead(null)}
                    onMutate={mutate}
                    campaigns={campaigns}
                    onRefresh={() => openLead(selectedLead.lead.id)}
                    onNewOpportunity={() => setShowOpportunityForm(true)}
                  />
                ) : (
                  <LeadsView
                    leads={visibleLeads}
                    search={search}
                    setSearch={setSearch}
                    filter={filter}
                    setFilter={setFilter}
                    onOpenLead={openLead}
                    onAdd={() => setShowLeadForm(true)}
                  />
                ))}
              {view === "pipeline" && (
                <PipelineView
                  opportunities={opportunities}
                  canWrite={canWrite}
                  onOpenLead={openLead}
                  onMutate={mutate}
                />
              )}
              {view === "inbox" && <ConversationsView leads={leads} canWrite={canWrite} />}
              {view === "lifecycle" && <CommercialLifecycle opportunities={opportunities} role={actor.role} />}
              {view === "campaigns" && (
                <CampaignsView
                  campaigns={campaigns}
                  canWrite={canWrite}
                  canManage={actor.role === "OWNER" || actor.role === "MANAGER"}
                  onMutate={mutate}
                />
              )}
              {view === "knowledge" && (
                <KnowledgeView
                  capabilities={capabilities}
                  canReview={canReview}
                  onMutate={mutate}
                />
              )}
              {view === "demos" && (
                <DemosView onViewKnowledge={() => setView("knowledge")} />
              )}
              {view === "automation" && ["OWNER", "MANAGER"].includes(actor.role) && (
                <AutomationSettings role={actor.role} />
              )}
            </>
          )}
        </div>
      </main>
      {showLeadForm && (
        <LeadForm
          onClose={() => setShowLeadForm(false)}
          onSubmit={async (value) => {
            const ok = await mutate(
              "/api/leads",
              value,
              "POST",
              "Lead added with source record",
            );
            if (ok) setShowLeadForm(false);
          }}
        />
      )}
      {showImportForm && (
        <ImportForm
          onClose={() => setShowImportForm(false)}
          onImported={async (count) => {
            setShowImportForm(false);
            await refresh();
            setNotice(`${count} leads imported with source records`);
          }}
        />
      )}
      {showOpportunityForm && selectedLead && (
        <OpportunityForm
          lead={selectedLead.lead}
          onClose={() => setShowOpportunityForm(false)}
          onSubmit={async (value) => {
            const ok = await mutate(
              "/api/opportunities",
              value,
              "POST",
              "Opportunity created",
            );
            if (ok) {
              setShowOpportunityForm(false);
              await openLead(selectedLead.lead.id);
            }
          }}
        />
      )}
      {showCapabilityForm && (
        <CapabilityForm
          onClose={() => setShowCapabilityForm(false)}
          onSubmit={async (value) => {
            const ok = await mutate(
              "/api/capabilities",
              value,
              "POST",
              "Capability added for review",
            );
            if (ok) setShowCapabilityForm(false);
          }}
        />
      )}
    </div>
  );
}

function OverviewView({
  data,
  onOpenLead,
  onViewLeads,
}: {
  data: Overview | null;
  onOpenLead: (id: string) => void;
  onViewLeads: () => void;
}) {
  if (!data) return null;
  const summary = data.summary;
  return (
    <>
      <div className="overview-status">
        <div>
          <Sparkles size={18} />
          <strong>Your sales desk is ready.</strong>
          <span>Priorities come from recorded opportunities and tasks.</span>
        </div>
        <span className="live-pill">
          <span /> LIVE DATA
        </span>
      </div>
      <div className="stat-strip">
        <div>
          <span>Ready to buy</span>
          <strong>{summary.ready}</strong>
          <small>
            Needs timely attention <ArrowUpRight size={13} />
          </small>
        </div>
        <div>
          <span>Hot opportunities</span>
          <strong>{summary.hot}</strong>
          <small>Active buying signals</small>
        </div>
        <div>
          <span>Qualified leads</span>
          <strong>{summary.qualified}</strong>
          <small>Of {summary.leads} businesses recorded</small>
        </div>
        <div>
          <span>Open pipeline</span>
          <strong>{money(summary.pipeline_minor)}</strong>
          <small>{summary.opportunities} active opportunities</small>
        </div>
      </div>
      <div className="overview-grid">
        <section className="panel priority-panel">
          <SectionHead
            title="Priority conversations"
            count={data.priority.length}
            action={
              <span className="subtle-label">ORDERED BY STAGE & TIMING</span>
            }
          />
          {data.priority.length ? (
            <div className="priority-list">
              {data.priority.map((item, index) => (
                <button key={item.id} onClick={() => onOpenLead(item.lead_id)}>
                  <span className="priority-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="priority-main">
                    <strong>{item.business_name}</strong>
                    <small>
                      {label(item.product_family)} ·{" "}
                      {item.next_action ?? "Review next action"}
                    </small>
                  </span>
                  <Badge
                    tone={
                      item.stage === "READY" || item.stage === "PAYMENT"
                        ? "urgent"
                        : item.stage === "HOT"
                          ? "warm"
                          : "neutral"
                    }
                  >
                    {label(item.stage)}
                  </Badge>
                  <ArrowUpRight size={17} className="row-arrow" />
                </button>
              ))}
            </div>
          ) : (
            <Empty
              title="No active opportunities yet"
              text="Add a business lead and create an opportunity when you identify a real need."
              action={
                <button className="button secondary" onClick={onViewLeads}>
                  View leads <ArrowRight size={16} />
                </button>
              }
            />
          )}
        </section>
        <section className="panel focus-panel">
          <SectionHead title="Follow up soon" count={data.followups.length} />
          {data.followups.length ? (
            <div className="followup-list">
              {data.followups.map((item) => (
                <button key={item.id} onClick={() => onOpenLead(item.lead_id)}>
                  <span className="followup-date">{date(item.due_at)}</span>
                  <strong>{item.business_name}</strong>
                  <small>{item.detail}</small>
                  <ArrowUpRight size={15} />
                </button>
              ))}
            </div>
          ) : (
            <div className="quiet-empty">
              <div className="quiet-icon">
                <Check size={20} />
              </div>
              <strong>All clear for now</strong>
              <p>Tasks due today or tomorrow will appear here.</p>
            </div>
          )}
          <div className="focus-footer">
            <Activity size={16} /> Follow-ups are shown from recorded tasks.
          </div>
        </section>
      </div>
      <div className="footer-insight">
        <ShieldCheck size={16} />
        <span>
          Sales claims are limited to approved product knowledge. No messages
          are sent automatically.
        </span>
      </div>
    </>
  );
}

function LeadsView({
  leads,
  search,
  setSearch,
  filter,
  setFilter,
  onOpenLead,
  onAdd,
}: {
  leads: Lead[];
  search: string;
  setSearch: (s: string) => void;
  filter: string;
  setFilter: (s: string) => void;
  onOpenLead: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <section className="panel table-panel">
      <div className="table-toolbar">
        <div className="table-title">
          <h2>All leads</h2>
          <span>{leads.length} shown</span>
        </div>
        <div className="toolbar-controls">
          <label className="search-box">
            <Search size={17} />
            <input
              aria-label="Search businesses"
              placeholder="Search businesses or city…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="filter-select">
            <Filter size={16} />
            <select
              aria-label="Filter leads"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="ALL">All leads</option>
              <option value="NEW">New</option>
              <option value="QUALIFIED">Qualified</option>
              <option value="UNQUALIFIED">Unqualified</option>
              {industries.map((item) => (
                <option key={item} value={item}>
                  {label(item)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {leads.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>BUSINESS</th>
                <th>SEGMENT</th>
                <th>STATUS</th>
                <th>FIT</th>
                <th>SOURCE</th>
                <th>OPPORTUNITIES</th>
                <th>ADDED</th>
                <th>
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} onClick={() => onOpenLead(lead.id)}>
                  <td>
                    <strong>{lead.name}</strong>
                    <small>{lead.city || "Location not recorded"}</small>
                  </td>
                  <td>{label(lead.industry)}</td>
                  <td>
                    <Badge
                      tone={
                        lead.status === "QUALIFIED" ? "positive" : "neutral"
                      }
                    >
                      {label(lead.status)}
                    </Badge>
                  </td>
                  <td>
                    {lead.fit_score == null ? (
                      <span className="muted">Not scored</span>
                    ) : (
                      `${lead.fit_score}/100`
                    )}
                  </td>
                  <td>{label(lead.source_type)}</td>
                  <td>{lead.opportunity_count}</td>
                  <td>{date(lead.created_at)}</td>
                  <td>
                    <button
                      className="row-open"
                      aria-label={`Open ${lead.name}`}
                    >
                      <ChevronRight size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title={
            search || filter !== "ALL"
              ? "No matching leads"
              : "Start with your first business"
          }
          text={
            search || filter !== "ALL"
              ? "Try a different search or filter."
              : "Record a business and where you found it. The rest of its sales history will stay connected."
          }
          action={
            !search &&
            filter === "ALL" && (
              <button className="button primary" onClick={onAdd}>
                <Plus size={16} /> Add lead
              </button>
            )
          }
        />
      )}
    </section>
  );
}

function LeadDetailView({
  data,
  canWrite,
  campaigns,
  onBack,
  onMutate,
  onRefresh,
  onNewOpportunity,
}: {
  data: LeadDetail;
  canWrite: boolean;
  campaigns: Campaign[];
  onBack: () => void;
  onMutate: (
    path: string,
    body: unknown,
    method?: string,
    success?: string,
  ) => Promise<boolean>;
  onRefresh: () => void;
  onNewOpportunity: () => void;
}) {
  const [kind, setKind] = useState("NOTE");
  const [detail, setDetail] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [status, setStatus] = useState(data.lead.status);
  const [fit, setFit] = useState(data.lead.fit_score?.toString() ?? "");
  const [campaignId, setCampaignId] = useState(data.lead.campaign_id ?? "");
  const lead = data.lead;
  async function saveLead() {
    if (
      await onMutate(
        `/api/leads/${lead.id}`,
        {
          status,
          fitScore: fit ? Number(fit) : null,
          campaignId: campaignId || null,
        },
        "PATCH",
        "Lead updated",
      )
    )
      onRefresh();
  }
  async function addActivity(event: FormEvent) {
    event.preventDefault();
    if (
      await onMutate(
        "/api/activities",
        {
          leadId: lead.id,
          kind,
          detail,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        },
        "POST",
        "Activity recorded",
      )
    ) {
      setDetail("");
      setDueAt("");
      onRefresh();
    }
  }
  return (
    <div className="detail-view">
      <button className="back-link" onClick={onBack}>
        <ArrowDownRight size={16} /> Back to leads
      </button>
      <div className="detail-header">
        <div>
          <div className="detail-title-row">
            <div className="business-avatar">
              {lead.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2>{lead.name}</h2>
              <p>
                {label(lead.industry)}
                {lead.city && ` · ${lead.city}`}
              </p>
            </div>
          </div>
        </div>
        {canWrite && (
          <button className="button primary" onClick={onNewOpportunity}>
            <Plus size={16} /> New opportunity
          </button>
        )}
      </div>
      <div className="detail-layout">
        <div className="detail-main">
          <section className="panel detail-panel">
            <SectionHead
              title="Opportunities"
              count={data.opportunities.length}
            />
            {data.opportunities.length ? (
              data.opportunities.map((item) => (
                <div className="detail-opportunity" key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <small>
                      {label(item.product_family)} · {money(item.value_minor)}
                    </small>
                  </div>
                  <Badge tone={item.stage === "READY" ? "urgent" : "neutral"}>
                    {label(item.stage)}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="detail-empty">
                No opportunity yet. Create one after you identify a real need.
              </p>
            )}
          </section>
          <ResearchPanel
            leadId={lead.id}
            canWrite={canWrite}
            onMutate={onMutate}
          />
          <section className="panel detail-panel">
            <SectionHead
              title="Activity timeline"
              count={data.activities.length}
            />
            {canWrite && (
              <form className="activity-form" onSubmit={addActivity}>
                <div className="activity-row">
                  <select
                    aria-label="Activity type"
                    value={kind}
                    onChange={(event) => setKind(event.target.value)}
                  >
                    <option>NOTE</option>
                    <option>CALL</option>
                    <option>EMAIL</option>
                    <option>MEETING</option>
                    <option>TASK</option>
                  </select>
                  {kind === "TASK" && (
                    <input
                      type="datetime-local"
                      aria-label="Task due date"
                      value={dueAt}
                      onChange={(event) => setDueAt(event.target.value)}
                    />
                  )}
                </div>
                <textarea
                  aria-label="Activity details"
                  required
                  minLength={2}
                  placeholder="Record what happened or what needs to happen…"
                  value={detail}
                  onChange={(event) => setDetail(event.target.value)}
                />
                <button className="button secondary" type="submit">
                  <Plus size={15} /> Record activity
                </button>
              </form>
            )}
            {data.activities.length ? (
              <div className="timeline">
                {data.activities.map((item) => (
                  <div key={item.id}>
                    <span className="timeline-dot" />
                    <div>
                      <strong>{label(item.kind)}</strong>
                      <small>
                        {date(item.created_at)}
                        {item.due_at && ` · Due ${date(item.due_at)}`}
                      </small>
                      <p>{item.detail}</p>
                      {item.kind === "TASK" &&
                        !item.completed_at &&
                        canWrite && (
                          <button
                            className="text-link"
                            onClick={async () => {
                              if (
                                await onMutate(
                                  `/api/activities/${item.id}`,
                                  {},
                                  "PATCH",
                                  "Task completed",
                                )
                              )
                                onRefresh();
                            }}
                          >
                            <Check size={14} /> Mark complete
                          </button>
                        )}
                      {item.completed_at && (
                        <small>Completed {date(item.completed_at)}</small>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="detail-empty">No activities recorded yet.</p>
            )}
          </section>
        </div>
        <aside className="detail-side">
          <section className="panel detail-panel">
            <SectionHead title="Qualification" />
            <label>
              Status
              <select
                disabled={!canWrite}
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="NEW">New</option>
                <option value="QUALIFIED">Qualified</option>
                <option value="UNQUALIFIED">Unqualified</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </label>
            <label>
              Lead fit score
              <input
                disabled={!canWrite}
                type="number"
                min="0"
                max="100"
                placeholder="Not scored"
                value={fit}
                onChange={(event) => setFit(event.target.value)}
              />
            </label>
            <label>
              Campaign
              <select
                disabled={!canWrite}
                value={campaignId}
                onChange={(event) => setCampaignId(event.target.value)}
              >
                <option value="">No campaign</option>
                {campaigns.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="field-help">
              Fit describes product suitability. It is not purchase probability.
            </p>
            {canWrite && (
              <button className="button secondary wide" onClick={saveLead}>
                Save qualification
              </button>
            )}
          </section>
          <section className="panel detail-panel">
            <SectionHead title="Business record" />
            <div className="facts">
              <div>
                <span>Source</span>
                <strong>{label(lead.source_type)}</strong>
              </div>
              <div>
                <span>Reference</span>
                <strong>{lead.source_reference || "Not provided"}</strong>
              </div>
              <div>
                <span>Website</span>
                <strong>
                  {lead.website ? (
                    <a href={lead.website} target="_blank" rel="noreferrer">
                      Open site <ArrowUpRight size={13} />
                    </a>
                  ) : (
                    "Not recorded"
                  )}
                </strong>
              </div>
              <div>
                <span>Digital maturity</span>
                <strong>
                  {lead.digital_maturity_score == null
                    ? "Not scored"
                    : `${lead.digital_maturity_score}/100`}
                </strong>
              </div>
            </div>
            {lead.notes && <p className="business-notes">{lead.notes}</p>}
          </section>
          <section className="panel detail-panel">
            <SectionHead title="Contacts" count={data.contacts.length} />
            {data.contacts.length ? (
              data.contacts.map((contact) => (
                <div className="contact-row" key={contact.id}>
                  <strong>{contact.full_name || "Business contact"}</strong>
                  <small>{contact.email || contact.phone}</small>
                  <span>Source: {contact.contact_source}</span>
                  <Badge
                    tone={contact.contact_eligible ? "positive" : "neutral"}
                  >
                    {contact.contact_eligible
                      ? "Eligible"
                      : "Contact unreviewed"}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="detail-empty">No contact added.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function PipelineView({
  opportunities,
  canWrite,
  onOpenLead,
  onMutate,
}: {
  opportunities: Opportunity[];
  canWrite: boolean;
  onOpenLead: (id: string) => void;
  onMutate: (
    path: string,
    body: unknown,
    method?: string,
    success?: string,
  ) => Promise<boolean>;
}) {
  const activeStages = stages.filter((stage) => stage !== "WON");
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [history, setHistory] = useState<
    Array<{
      id: string;
      from_stage: string | null;
      to_stage: string;
      reason: string;
      actor_name: string;
      created_at: string;
    }>
  >([]);
  const [nextStage, setNextStage] = useState<Stage>("INTERESTED");
  const [reason, setReason] = useState("");
  async function openOpportunity(item: Opportunity) {
    setSelected(item);
    setNextStage(item.stage);
    setReason("");
    try {
      const response = await api<{ history: typeof history }>(
        `/api/opportunities/${item.id}/stage`,
      );
      setHistory(response.history);
    } catch {
      setHistory([]);
    }
  }
  return (
    <>
      <div className="pipeline-summary">
        <span>
          <strong>
            {
              opportunities.filter(
                (item) => item.stage !== "LOST" && item.stage !== "WON",
              ).length
            }
          </strong>{" "}
          active opportunities
        </span>
        <span>
          <strong>
            {money(
              opportunities
                .filter((item) => item.stage !== "LOST" && item.stage !== "WON")
                .reduce((sum, item) => sum + Number(item.value_minor ?? 0), 0),
            )}
          </strong>{" "}
          open pipeline
        </span>
        <span>Every move records a reason and actor</span>
      </div>
      {opportunities.length ? (
        <div className="kanban">
          {activeStages.map((stage) => {
            const items = opportunities.filter((item) => item.stage === stage);
            return (
              <div className="kanban-column" key={stage}>
                <div className="kanban-head">
                  <strong>{label(stage)}</strong>
                  <span>{items.length}</span>
                </div>
                {items.map((item) => (
                  <button
                    className="kanban-card"
                    key={item.id}
                    onClick={() => void openOpportunity(item)}
                  >
                    <span>{item.business_name}</span>
                    <strong>{item.title}</strong>
                    <small>{label(item.product_family)}</small>
                    <div>
                      <span>{money(item.value_minor)}</span>
                      <ArrowUpRight size={15} />
                    </div>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <Empty
          title="No opportunities in the pipeline"
          text="Open a lead and create an opportunity when its needs and product fit are clear."
        />
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
            aria-label="Opportunity detail"
          >
            <div className="drawer-head">
              <span>OPPORTUNITY</span>
              <button aria-label="Close" onClick={() => setSelected(null)}>
                <X size={20} />
              </button>
            </div>
            <h2>{selected.title}</h2>
            <p>
              {selected.business_name} · {label(selected.product_family)}
            </p>
            <div className="drawer-divider" />
            <div className="facts">
              <div>
                <span>Current stage</span>
                <Badge>{label(selected.stage)}</Badge>
              </div>
              <div>
                <span>Value</span>
                <strong>{money(selected.value_minor)}</strong>
              </div>
              <div>
                <span>Next action</span>
                <strong>{selected.next_action || "Not recorded"}</strong>
              </div>
            </div>
            <div className="stage-history">
              <h3>Stage history</h3>
              {history.length ? (
                history.map((item) => (
                  <div key={item.id}>
                    <strong>
                      {item.from_stage ? `${label(item.from_stage)} → ` : ""}
                      {label(item.to_stage)}
                    </strong>
                    <small>
                      {item.reason} · {item.actor_name} ·{" "}
                      {date(item.created_at)}
                    </small>
                  </div>
                ))
              ) : (
                <p>No history available.</p>
              )}
            </div>
            {canWrite && (
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (
                    await onMutate(
                      `/api/opportunities/${selected.id}/stage`,
                      { stage: nextStage, reason },
                      "POST",
                      "Stage updated with history",
                    )
                  )
                    setSelected(null);
                }}
              >
                <label>
                  Move to
                  <select
                    value={nextStage}
                    onChange={(event) =>
                      setNextStage(event.target.value as Stage)
                    }
                  >
                    {activeStages.map((stage) => (
                      <option key={stage} value={stage}>
                        {label(stage)}
                      </option>
                    ))}
                    <option value="LOST">Lost</option>
                    {selected.stage === "PAYMENT" && <option value="WON">Won — verified gates only</option>}
                  </select>
                </label>
                <label>
                  Reason
                  <textarea
                    required
                    minLength={5}
                    placeholder="What changed?"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </label>
                <p className="field-help">
                  Won requires verified proposal acceptance and payment in a
                  later phase.
                </p>
                <button
                  className="button primary wide"
                  type="submit"
                  disabled={nextStage === selected.stage}
                >
                  Save stage change
                </button>
              </form>
            )}
            <button
              className="text-link"
              onClick={() => {
                setSelected(null);
                onOpenLead(selected.lead_id);
              }}
            >
              Open lead record <ArrowRight size={15} />
            </button>
          </section>
        </div>
      )}
    </>
  );
}

function KnowledgeView({
  capabilities,
  canReview,
  onMutate,
}: {
  capabilities: Capability[];
  canReview: boolean;
  onMutate: (
    path: string,
    body: unknown,
    method?: string,
    success?: string,
  ) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState<Capability | null>(null);
  const [status, setStatus] = useState("UNVERIFIED");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [approvedLanguage, setApprovedLanguage] = useState("");
  const [productVersion, setProductVersion] = useState("");
  const [limitation, setLimitation] = useState("");
  function edit(item: Capability) {
    setEditing(item);
    setStatus(item.status);
    setEvidenceUrl(item.evidence_url ?? "");
    setApprovedLanguage(item.approved_language ?? "");
    setProductVersion(item.product_version ?? "");
    setLimitation(item.limitation ?? "");
  }
  return (
    <>
      <div className="knowledge-note">
        <ShieldCheck size={19} />
        <div>
          <strong>Product truth comes first</strong>
          <p>
            Capabilities start unverified. A reviewer must attach evidence and
            approve the exact customer wording before a feature can be presented
            as available.
          </p>
        </div>
      </div>
      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="table-title">
            <h2>Capability register</h2>
            <span>{capabilities.length} entries</span>
          </div>
        </div>
        {capabilities.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>PRODUCT</th>
                  <th>CAPABILITY</th>
                  <th>STATUS</th>
                  <th>VERSION</th>
                  <th>EVIDENCE</th>
                  <th>REVIEWER</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {capabilities.map((item) => (
                  <tr key={item.id} onClick={() => canReview && edit(item)}>
                    <td>{label(item.product_family)}</td>
                    <td>
                      <strong>{item.capability_name}</strong>
                      {item.limitation && <small>{item.limitation}</small>}
                    </td>
                    <td>
                      <Badge
                        tone={
                          item.status === "VERIFIED"
                            ? "positive"
                            : item.status === "OPTIONAL"
                              ? "warm"
                              : "neutral"
                        }
                      >
                        {label(item.status)}
                      </Badge>
                    </td>
                    <td>{item.product_version || "—"}</td>
                    <td>
                      {item.evidence_url ? (
                        <a
                          href={item.evidence_url}
                          onClick={(event) => event.stopPropagation()}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View source <ArrowUpRight size={13} />
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{item.approved_by_name || "—"}</td>
                    <td>
                      {canReview && (
                        <button
                          className="row-open"
                          aria-label={`Review ${item.capability_name}`}
                        >
                          <ChevronRight size={17} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No capabilities recorded"
            text="Add a product capability and have an approver verify it with evidence before using it in sales."
          />
        )}
      </section>
      {editing && (
        <div
          className="drawer-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditing(null);
          }}
        >
          <form
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Review capability"
            onSubmit={async (event) => {
              event.preventDefault();
              if (
                await onMutate(
                  `/api/capabilities/${editing.id}`,
                  {
                    status,
                    evidenceUrl: evidenceUrl || null,
                    approvedLanguage: approvedLanguage || null,
                    productVersion: productVersion || null,
                    limitation: limitation || null,
                  },
                  "PATCH",
                  "Capability review saved",
                )
              )
                setEditing(null);
            }}
          >
            <div className="drawer-head">
              <span>PRODUCT REVIEW</span>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setEditing(null)}
              >
                <X size={20} />
              </button>
            </div>
            <h2>{editing.capability_name}</h2>
            <p>{label(editing.product_family)}</p>
            <label>
              Status
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                {[
                  "UNVERIFIED",
                  "VERIFIED",
                  "OPTIONAL",
                  "BETA",
                  "PLANNED",
                  "CUSTOM_REVIEW",
                  "UNSUPPORTED",
                ].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              Evidence URL
              <input
                type="url"
                placeholder="https://…"
                value={evidenceUrl}
                onChange={(event) => setEvidenceUrl(event.target.value)}
              />
            </label>
            <label>
              Product version
              <input
                value={productVersion}
                onChange={(event) => setProductVersion(event.target.value)}
                placeholder="Release or build"
              />
            </label>
            <label>
              Approved customer wording
              <textarea
                value={approvedLanguage}
                onChange={(event) => setApprovedLanguage(event.target.value)}
                placeholder="Exactly what sales may say"
              />
            </label>
            <label>
              Limitations
              <textarea
                value={limitation}
                onChange={(event) => setLimitation(event.target.value)}
                placeholder="Prerequisites and exclusions"
              />
            </label>
            <p className="field-help">
              Verified and optional status require an evidence URL and approved
              wording.
            </p>
            <button className="button primary wide" type="submit">
              Save review
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function DemosView({ onViewKnowledge }: { onViewKnowledge: () => void }) {
  return (
    <div className="demo-layout">
      <section className="panel demo-main">
        <div className="demo-illustration">
          <div className="demo-window">
            <div>
              <span />
              <span />
              <span />
            </div>
            <div className="demo-window-body">
              <span className="demo-bar short" />
              <span className="demo-bar" />
              <span className="demo-bar medium" />
              <div>
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        </div>
        <h2>Your product demo source is coming next</h2>
        <p>
          When you share the Aayatra website link, this area can point prospects
          to the ready-to-use ERP and prepare product-specific walkthroughs from
          that source.
        </p>
        <div className="demo-actions">
          <button className="button secondary" onClick={onViewKnowledge}>
            Review product knowledge <ArrowRight size={16} />
          </button>
        </div>
      </section>
      <aside className="panel demo-side">
        <h3>Before a demo goes out</h3>
        <div>
          <span>1</span>
          <p>Confirm the product and edition match the prospect’s needs.</p>
        </div>
        <div>
          <span>2</span>
          <p>Use only capabilities approved in the knowledge register.</p>
        </div>
        <div>
          <span>3</span>
          <p>Label personalized examples as concept demos.</p>
        </div>
        <div className="demo-side-foot">
          <ShieldCheck size={16} /> Human review is required for now.
        </div>
      </aside>
    </div>
  );
}

function FormShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="drawer-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="drawer-head">
          <span>NEW RECORD</span>
          <button type="button" aria-label="Close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
        {children}
      </section>
    </div>
  );
}

function LeadForm({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (value: unknown) => void;
}) {
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState<string>("HOTEL");
  const [city, setCity] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [sourceType, setSourceType] = useState("MANUAL");
  const [sourceReference, setSourceReference] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  return (
    <FormShell
      title="Add a business lead"
      subtitle="Start with a real business and keep its source attached."
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({
            name,
            industry,
            city,
            website: website || null,
            notes: notes || null,
            sourceType,
            sourceReference: sourceReference || null,
            contactName: contactName || null,
            contactEmail: contactEmail || null,
            contactPhone: contactPhone || null,
          });
        }}
      >
        <label>
          Business name
          <input
            required
            minLength={2}
            maxLength={160}
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Business name"
          />
        </label>
        <div className="form-grid">
          <label>
            Industry
            <select
              value={industry}
              onChange={(event) => setIndustry(event.target.value)}
            >
              {industries.map((item) => (
                <option key={item} value={item}>
                  {label(item)}
                </option>
              ))}
            </select>
          </label>
          <label>
            City
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="e.g. Pokhara"
            />
          </label>
        </div>
        <label>
          Website
          <input
            type="url"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            placeholder="https://…"
          />
        </label>
        <div className="form-divider">SOURCE & CONTACT</div>
        <div className="form-grid">
          <label>
            How you found it
            <select
              value={sourceType}
              onChange={(event) => setSourceType(event.target.value)}
            >
              <option value="MANUAL">Manual research</option>
              <option value="REFERRAL">Referral</option>
              <option value="INBOUND">Inbound enquiry</option>
              <option value="CSV">Authorized CSV</option>
              <option value="EXISTING_RELATIONSHIP">
                Existing relationship
              </option>
            </select>
          </label>
          <label>
            Source reference
            <input
              value={sourceReference}
              onChange={(event) => setSourceReference(event.target.value)}
              placeholder="URL or context"
            />
          </label>
        </div>
        <label>
          Contact name
          <input
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
            placeholder="If known"
          />
        </label>
        <div className="form-grid">
          <label>
            Email
            <input
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              placeholder="Business email"
            />
          </label>
          <label>
            Phone
            <input
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
              placeholder="Business phone"
            />
          </label>
        </div>
        <label>
          Notes
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Only what you have observed or learned"
          />
        </label>
        <p className="field-help">
          A recorded contact is not automatically eligible for outreach.
        </p>
        <button className="button primary wide" type="submit">
          Save lead <ArrowRight size={16} />
        </button>
      </form>
    </FormShell>
  );
}

function OpportunityForm({
  lead,
  onClose,
  onSubmit,
}: {
  lead: Lead;
  onClose: () => void;
  onSubmit: (value: unknown) => void;
}) {
  const [title, setTitle] = useState("");
  const [productFamily, setProductFamily] = useState<string>("WEBSITE");
  const [value, setValue] = useState("");
  const [nextAction, setNextAction] = useState("");
  return (
    <FormShell
      title="Create opportunity"
      subtitle={`For ${lead.name}. Record the offer and the next human action.`}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({
            leadId: lead.id,
            title,
            productFamily,
            valueMinor: value ? Math.round(Number(value) * 100) : null,
            nextAction: nextAction || null,
          });
        }}
      >
        <label>
          Opportunity title
          <input
            autoFocus
            required
            minLength={3}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Website and direct booking"
          />
        </label>
        <label>
          Product family
          <select
            value={productFamily}
            onChange={(event) => setProductFamily(event.target.value)}
          >
            {productFamilies.map((item) => (
              <option key={item} value={item}>
                {label(item)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Estimated value (NPR)
          <input
            type="number"
            min="0"
            step="1"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Optional"
          />
        </label>
        <label>
          Next action
          <textarea
            value={nextAction}
            onChange={(event) => setNextAction(event.target.value)}
            placeholder="What should happen next?"
          />
        </label>
        <p className="field-help">
          The product recommendation is an internal hypothesis until
          capabilities are approved.
        </p>
        <button className="button primary wide" type="submit">
          Create opportunity <ArrowRight size={16} />
        </button>
      </form>
    </FormShell>
  );
}

function CapabilityForm({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (value: unknown) => void;
}) {
  const [productFamily, setProductFamily] =
    useState<string>("RESTAURANT_SYSTEM");
  const [capabilityName, setCapabilityName] = useState("");
  const [limitation, setLimitation] = useState("");
  return (
    <FormShell
      title="Add capability for review"
      subtitle="It starts unverified and cannot be used as a sales claim."
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({
            productFamily,
            capabilityName,
            limitation: limitation || null,
          });
        }}
      >
        <label>
          Product family
          <select
            value={productFamily}
            onChange={(event) => setProductFamily(event.target.value)}
          >
            {productFamilies.map((item) => (
              <option key={item} value={item}>
                {label(item)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Capability name
          <input
            autoFocus
            required
            minLength={3}
            value={capabilityName}
            onChange={(event) => setCapabilityName(event.target.value)}
            placeholder="e.g. Room charges on guest folio"
          />
        </label>
        <label>
          Known limitations
          <textarea
            value={limitation}
            onChange={(event) => setLimitation(event.target.value)}
            placeholder="If known"
          />
        </label>
        <button className="button primary wide" type="submit">
          Add for review <ArrowRight size={16} />
        </button>
      </form>
    </FormShell>
  );
}
