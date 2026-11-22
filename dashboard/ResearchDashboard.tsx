"use client";

import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  AlertCircle,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  ExternalLink,
  FileText,
  FlaskConical,
  Lightbulb,
  LoaderCircle,
  Microscope,
  Network,
  PanelRight,
  Plus,
  Send,
  ShieldCheck,
  Square,
  Trash2,
  XCircle,
} from "lucide-react";
import { NODE_LABELS } from "../packages/contracts";
import type {
  ExperimentModality,
  InvestigationMode,
  ManuscriptDocument,
  MetricObservation,
  ResearchNode,
  ResearchProject,
  ResearchProjectSummary,
  RunTelemetry,
  SetupStatus,
  ViewId,
} from "../packages/contracts";
import { LandingHome } from "./LandingHome";
import { ManuscriptStudio } from "./ManuscriptStudio";
import { SetupModal } from "./SetupModal";
import { TestingWorkspace } from "./TestingWorkspace";
import { MonoMeta, SectionHeader, StatusBadge } from "./ui";

export interface DashboardProps {
  project: ResearchProject | null;
  projects: ResearchProjectSummary[];
  showHome: boolean;
  telemetry: RunTelemetry;
  streamingDelta: string;
  activeView: ViewId;
  onViewChange: (view: ViewId) => void;
  onGoHome: () => void;
  onSelectProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onStart: (curiosity: string, mode: InvestigationMode) => void;
  onContinue: (message: string) => void;
  onTriggerReviewPanel: () => void;
  onSynthesizeExperiment: (modality?: ExperimentModality) => void;
  onStop: () => void;
  onPreflight: () => Promise<SetupStatus>;
  onSaveConfig: (payload: Record<string, unknown>) => Promise<SetupStatus>;
  onSelectNode: (id: string) => void;
  selectedNodeId?: string;
  onEvidenceAction: (id: string, action: "confirm" | "unconfirm" | "reject") => void;
  onAddManualEvidence: (paperId: string, quote: string, title?: string) => void;
  onAddPaperByDoi: (doi: string) => void;
  onUpdateNode: (nodeId: string, patch: { title?: string; data?: Record<string, unknown> }) => void;
  onDeleteNode: (nodeId: string) => void;
  onRunCode: (experimentId: string, code: string) => void;
  onDownloadValidation: (experimentId: string, action: "colab" | "survey-schema" | "survey-csv") => void;
  onDiscoverLabs: () => void;
  onUpdateLab: (nodeId: string, patch: Record<string, unknown>) => void;
  onImportResult: (payload: {
    experimentId: string;
    observations: string;
    metricResults: MetricObservation[];
    csvText?: string;
    datasetName?: string;
    sourceModality?: ExperimentModality;
  }) => void;
  onManuscriptAction: (action: "draft" | "audit" | "humanize" | "save", manuscript?: ManuscriptDocument) => void;
  onExport: () => void;
  busy: boolean;
  error?: string;
  graph?: ReactNode;
  exportPanel?: ReactNode;
}

const NAV_ITEMS: Array<{ id: ViewId; label: string; icon: typeof Microscope }> = [
  { id: "research", label: "Research", icon: Microscope },
  { id: "literature", label: "Literature", icon: BookOpen },
  { id: "experiments", label: "Validation", icon: FlaskConical },
  { id: "graph", label: "Knowledge Graph", icon: Network },
  { id: "manuscript", label: "Manuscript", icon: FileText },
  { id: "published", label: "Published", icon: Download },
];

function formatElapsed(elapsedMs?: number): string {
  if (typeof elapsedMs !== "number" || !Number.isFinite(elapsedMs) || elapsedMs < 0) return "—";
  const sec = Math.floor(elapsedMs / 1000);
  const min = Math.floor(sec / 60);
  return `${min}:${String(sec % 60).padStart(2, "0")}`;
}

export function ResearchDashboard(props: DashboardProps) {
  const {
    project,
    projects,
    showHome,
    telemetry,
    streamingDelta,
    activeView,
    onViewChange,
    onGoHome,
    onSelectProject,
    onDeleteProject,
    onStart,
    onContinue,
    onTriggerReviewPanel,
    onSynthesizeExperiment,
    onStop,
    onPreflight,
    onSaveConfig,
    onSelectNode,
    selectedNodeId,
    onEvidenceAction,
    onAddManualEvidence,
    onAddPaperByDoi,
    onUpdateNode,
    onDeleteNode,
    onRunCode,
    onDownloadValidation,
    onDiscoverLabs,
    onUpdateLab,
    onImportResult,
    onManuscriptAction,
    onExport,
    busy,
    error,
    graph,
    exportPanel,
  } = props;

  const [inspectorVisible, setInspectorVisible] = useState(true);
  const [followUp, setFollowUp] = useState("");
  const [doiInput, setDoiInput] = useState("");

  const active = telemetry.status === "running" || telemetry.status === "connecting";
  const selectedNode = project?.nodes.find((n) => n.id === selectedNodeId);
  const isLanding = showHome || !project;

  const counts: Record<ViewId, number> = {
    research: project?.uiBlocks.length ?? 0,
    literature: project?.nodes.filter((n) => n.type === "paper").length ?? 0,
    experiments: project?.nodes.filter((n) => n.type === "experiment").length ?? 0,
    graph: project?.nodes.length ?? 0,
    manuscript: project?.manuscript ? project.manuscript.sections.length : 0,
    published: project?.exports.length ?? 0,
  };

  const handleFollowUp = (event: FormEvent) => {
    event.preventDefault();
    if (!followUp.trim() || busy || active) return;
    onContinue(followUp.trim());
    setFollowUp("");
  };

  const handleAddDoi = (event: FormEvent) => {
    event.preventDefault();
    if (!doiInput.trim() || busy) return;
    onAddPaperByDoi(doiInput.trim());
    setDoiInput("");
  };

  const hasTps = typeof telemetry.outputTokens === "number" && telemetry.outputTokens > 0 && typeof telemetry.outputTps === "number";

  return (
    <div className="ori-app">
      <a className="ori-skip-link" href="#ori-main-content">Skip to main content</a>

      {/* Unified Precision Light Header */}
      <header className="ori-topbar">
        <div className="ori-topbar-left">
          <button type="button" className="ori-brand-btn" onClick={onGoHome}>
            <span className="ori-brand-mark" aria-hidden="true"><Microscope size={14} /></span>
            <span>Open Research IDE</span>
          </button>
          <span className="ori-topbar-divider" aria-hidden="true" />
          <button type="button" className="ori-btn ori-btn--ghost ori-btn--sm" onClick={onGoHome} aria-label="New research">
            <Plus size={14} aria-hidden="true" />
            <span>New</span>
          </button>
          {projects.length > 0 ? (
            <select
              aria-label="Switch research project"
              className="ori-project-select"
              value={!isLanding && project ? project.projectId : ""}
              onChange={(e) => { if (e.target.value) onSelectProject(e.target.value); }}
            >
              <option value="" disabled>Projects ({projects.length})</option>
              {projects.map((p) => (
                <option key={p.projectId} value={p.projectId}>{p.title.slice(0, 44)}</option>
              ))}
            </select>
          ) : null}
        </div>

        {!isLanding && project ? (
          <nav className="ori-topbar-nav" aria-label="Research views">
            {NAV_ITEMS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={`ori-nav-tab${activeView === id ? " ori-nav-tab--active" : ""}`}
                onClick={() => onViewChange(id)}
                aria-current={activeView === id ? "page" : undefined}
              >
                <span>{label}</span>
                <span className="ori-nav-count">{counts[id]}</span>
              </button>
            ))}
          </nav>
        ) : <div />}

        <div className="ori-topbar-right">
          <SetupModal onPreflight={onPreflight} onSaveConfig={onSaveConfig} />
          {!isLanding && project ? (
            <button type="button" className="ori-btn ori-btn--primary ori-btn--sm" onClick={onExport} disabled={busy}>
              <Download size={14} aria-hidden="true" />
              <span>Export</span>
            </button>
          ) : null}
        </div>
      </header>

      {isLanding ? (
        <LandingHome
          projects={projects}
          busy={busy}
          error={error}
          onStart={onStart}
          onSelectProject={onSelectProject}
          onDeleteProject={onDeleteProject}
        />
      ) : (
        <>
          {/* Context & Telemetry Strip */}
          <div className="ori-context-bar">
            <div className="ori-context-title">
              <h1>{project.title}</h1>
              <MonoMeta>r{project.revision}</MonoMeta>
              <StatusBadge tone="neutral">{project.mode === "autonomous" ? "Autonomous" : "Guided"}</StatusBadge>
              <StatusBadge tone={project.status === "error" ? "danger" : project.status === "investigating" ? "accent" : "ok"}>
                {project.status}
              </StatusBadge>
            </div>
            <div className="ori-context-meta">
              <div className="ori-telemetry" aria-label="Run telemetry">
                <span><Clock size={12} style={{ verticalAlign: "-2px" }} /> <span className="ori-telemetry-val">{formatElapsed(telemetry.elapsedMs)}</span></span>
                <span>{telemetry.outputTpsLabel}: <span className="ori-telemetry-val">{hasTps ? telemetry.outputTps!.toFixed(1) : "—"}</span></span>
              </div>
              {active ? (
                <button type="button" className="ori-btn ori-btn--danger ori-btn--sm" onClick={onStop} disabled={busy}>
                  <Square size={12} /> Stop
                </button>
              ) : null}
              <button
                type="button"
                className="ori-btn ori-btn--secondary ori-btn--sm"
                onClick={() => setInspectorVisible((v) => !v)}
                aria-expanded={inspectorVisible}
                aria-label="Toggle inspector"
              >
                <PanelRight size={14} /> Inspector
              </button>
            </div>
          </div>

          <div className={`ori-workspace${inspectorVisible ? "" : " ori-workspace--no-inspector"}`}>
            <main id="ori-main-content" className="ori-canvas" tabIndex={-1}>
              <div className="ori-canvas-scroll">
                <div className={`ori-canvas-body${activeView === "graph" ? " ori-canvas-body--wide" : ""}`}>
                  {error ? (
                    <div className="ori-banner ori-banner--danger" role="alert">
                      <AlertCircle size={17} aria-hidden="true" />
                      <div><strong>Action error:</strong> {error}</div>
                    </div>
                  ) : null}

                  {(active || streamingDelta) ? (
                    <section className="ori-live-stream" aria-live="polite">
                      <div className="ori-live-stage">
                        {active ? <LoaderCircle size={15} className="ori-spin" /> : <CheckCircle2 size={15} />}
                        <span>{telemetry.stage || (active ? "Investigating peer-reviewed literature…" : "Latest stream output")}</span>
                      </div>
                      {streamingDelta ? <div className="ori-live-delta">{streamingDelta}</div> : null}
                    </section>
                  ) : null}

                  {activeView === "research" ? (
                    <ResearchCanvasView
                      project={project}
                      busy={busy}
                      onSelectNode={(id) => { onSelectNode(id); setInspectorVisible(true); }}
                      onEvidenceAction={onEvidenceAction}
                      onTriggerReviewPanel={onTriggerReviewPanel}
                      onGoToValidation={() => onViewChange("experiments")}
                    />
                  ) : null}

                  {activeView === "literature" ? (
                    <section className="ori-section-block">
                      <SectionHeader
                        eyebrow="Source Registry"
                        title="Peer-Reviewed Literature"
                        description="Click any publication to open its immutable abstract in the inspector and anchor verified passages."
                      />
                      <form onSubmit={handleAddDoi} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <input
                          className="ori-input"
                          style={{ maxWidth: 380 }}
                          placeholder="Add paper by DOI (e.g., 10.1038/s41586-023-06221-2)"
                          value={doiInput}
                          onChange={(e) => setDoiInput(e.target.value)}
                          disabled={busy}
                        />
                        <button type="submit" className="ori-btn ori-btn--secondary" disabled={busy || !doiInput.trim()}>
                          <Plus size={14} /> Add Paper by DOI
                        </button>
                      </form>
                      <SourceBanner project={project} />
                      <PaperTable papers={project.nodes.filter((n) => n.type === "paper")} onSelectNode={(id) => { onSelectNode(id); setInspectorVisible(true); }} />
                    </section>
                  ) : null}

                  {activeView === "experiments" ? (
                    <TestingWorkspace
                      project={project}
                      busy={busy}
                      onSelectNode={(id) => { onSelectNode(id); setInspectorVisible(true); }}
                      onSynthesizeExperiment={(modality) => onSynthesizeExperiment(modality)}
                      onRunCode={onRunCode}
                      onDownloadValidation={onDownloadValidation}
                      onDiscoverLabs={onDiscoverLabs}
                      onUpdateLab={onUpdateLab}
                      onImportResult={onImportResult}
                    />
                  ) : null}

                  {activeView === "graph" ? graph : null}

                  {activeView === "manuscript" ? (
                    <ManuscriptStudio project={project} busy={busy} onAction={onManuscriptAction} />
                  ) : null}

                  {activeView === "published" ? exportPanel : null}
                </div>
              </div>

              {/* Non-overlapping Docked Follow-up Bar */}
              {activeView === "research" ? (
                <div className="ori-composer-dock">
                  <form className="ori-composer-dock-inner" onSubmit={handleFollowUp}>
                    <div className="ori-composer-row">
                      <label htmlFor="ori-followup-input" className="ori-visually-hidden">Follow-up question or pushback</label>
                      <input
                        id="ori-followup-input"
                        className="ori-input"
                        placeholder="Ask a follow-up, push back on a paper, or pivot the search..."
                        value={followUp}
                        onChange={(e) => setFollowUp(e.target.value)}
                        disabled={busy || active}
                      />
                      <button type="submit" className="ori-btn ori-btn--primary" disabled={busy || active || followUp.trim().length < 3}>
                        <Send size={14} /> Send
                      </button>
                    </div>
                    <div className="ori-composer-shortcuts">
                      <button type="button" className="ori-btn ori-btn--secondary ori-btn--sm" disabled={busy || active} onClick={onTriggerReviewPanel}>
                        <ShieldCheck size={14} /> Run Independent Review Panel
                      </button>
                      <button type="button" className="ori-btn ori-btn--secondary ori-btn--sm" disabled={busy || active} onClick={() => onSynthesizeExperiment()}>
                        <FlaskConical size={14} /> Design Validation Experiment
                      </button>
                      <button type="button" className="ori-btn ori-btn--ghost ori-btn--sm" disabled={busy || active} onClick={() => onViewChange("manuscript")}>
                        <FileText size={14} /> Draft Manuscript
                      </button>
                    </div>
                  </form>
                </div>
              ) : null}
            </main>

            {inspectorVisible ? (
              <aside className="ori-inspector-rail" aria-label="Research node inspector">
                <NodeInspectorPanel
                  project={project}
                  node={selectedNode}
                  busy={busy}
                  onSelectNode={onSelectNode}
                  onEvidenceAction={onEvidenceAction}
                  onAddManualEvidence={onAddManualEvidence}
                  onUpdateNode={onUpdateNode}
                  onDeleteNode={onDeleteNode}
                />
              </aside>
            ) : null}
          </div>
        </>
      )}

      <footer className="ori-footer">
        <div className="ori-footer-inner">
          <span>Open Research IDE · Open-source (MIT), local-first, harness- &amp; model-agnostic scientific workspace.</span>
          <MonoMeta>Exact abstract SHA-256 anchoring · Zero-memory review panel · Frozen expected outcomes</MonoMeta>
        </div>
      </footer>
    </div>
  );
}

function SourceBanner({ project }: { project: ResearchProject }) {
  const failures = project.sources.filter((s) => s.status !== "ok" || s.error);
  if (!failures.length) return null;
  return (
    <div className="ori-banner ori-banner--warn">
      <AlertCircle size={16} aria-hidden="true" />
      <div>
        <strong>Source transparency:</strong>{" "}
        {failures.map((s) => `${s.provider} (${s.error || s.status})`).join(" · ")}. No substitute citations were fabricated.
      </div>
    </div>
  );
}

function PaperTable({ papers, onSelectNode }: { papers: ResearchNode[]; onSelectNode: (id: string) => void }) {
  if (!papers.length) return <p style={{ fontSize: 14, color: "var(--text-muted)" }}>No papers retrieved yet.</p>;
  return (
    <div className="ori-table-wrap">
      <table className="ori-table">
        <thead>
          <tr><th>Publication</th><th>Year</th><th>Venue</th><th>DOI</th><th>Snapshot</th></tr>
        </thead>
        <tbody>
          {papers.map((paper) => (
            <tr key={paper.id}>
              <td>
                <button type="button" className="ori-text-link" style={{ fontWeight: 600 }} onClick={() => onSelectNode(paper.id)}>
                  {paper.title}
                </button>
                {Array.isArray(paper.data.authors) && paper.data.authors.length ? (
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{paper.data.authors.slice(0, 3).join(", ")}</div>
                ) : null}
              </td>
              <td><MonoMeta>{paper.data.year ?? "—"}</MonoMeta></td>
              <td style={{ color: "var(--text-secondary)" }}>{paper.data.venue || "—"}</td>
              <td>
                {paper.data.doi ? (
                  <a href={`https://doi.org/${paper.data.doi}`} target="_blank" rel="noreferrer" className="ori-text-link" style={{ fontSize: 12, fontFamily: "var(--font-mono)" }}>
                    {paper.data.doi} <ExternalLink size={11} />
                  </a>
                ) : "—"}
              </td>
              <td><StatusBadge tone={paper.data.abstract ? "accent" : "neutral"}>{paper.data.abstract ? "Immutable" : "Unavailable"}</StatusBadge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatUtcTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(date)} UTC`;
}

function ResearchCanvasView({
  project,
  busy,
  onSelectNode,
  onEvidenceAction,
  onTriggerReviewPanel,
  onGoToValidation,
}: {
  project: ResearchProject;
  busy: boolean;
  onSelectNode: (id: string) => void;
  onEvidenceAction: (id: string, action: "confirm" | "unconfirm" | "reject") => void;
  onTriggerReviewPanel: () => void;
  onGoToValidation: () => void;
}) {
  const papers = project.nodes.filter((n) => n.type === "paper");
  const evidence = project.nodes.filter((n) => n.type === "evidence");
  const hypotheses = project.nodes.filter((n) => n.type === "hypothesis");
  const reviews = project.nodes.filter((n) => n.type === "review");
  const experiments = project.nodes.filter((n) => n.type === "experiment");
  const results = project.nodes.filter((n) => n.type === "result");
  const paperMap = new Map(papers.map((p) => [p.id, p]));
  const nodeMap = new Map(project.nodes.map((n) => [n.id, n]));

  const steps = [
    { label: "Literature", complete: papers.length > 0, detail: `${papers.length} papers` },
    { label: "Hypotheses", complete: hypotheses.length > 0, detail: `${hypotheses.length} committed` },
    { label: "Review Panel", complete: reviews.length >= 3, detail: `${reviews.length} reviews` },
    { label: "Validation", complete: experiments.length > 0, detail: results.length ? `${results.length} results` : `${experiments.length} plans` },
    { label: "Manuscript", complete: Boolean(project.manuscript), detail: project.exports.length ? "Exported" : "Draft ready" },
  ];

  return (
    <>
      <section className="ori-stage-rail" aria-label="Investigation stages">
        {steps.map((step, i) => (
          <div key={step.label} className={`ori-stage-item${step.complete ? " ori-stage-item--complete" : ""}`}>
            <span className="ori-stage-num">{step.complete ? <Check size={12} /> : i + 1}</span>
            <span>
              <span className="ori-stage-label">{step.label}</span>
              <span className="ori-stage-detail">{step.detail}</span>
            </span>
          </div>
        ))}
      </section>

      <SourceBanner project={project} />

      {project.messages?.length ? (
        <section className="ori-conversation" aria-label="Research dialogue">
          {project.messages.map((msg) => (
            <article key={msg.id} className={`ori-msg${msg.role === "user" ? " ori-msg--user" : ""}`}>
              <div className="ori-msg-meta">
                <span>{msg.role === "user" ? "Researcher" : "Research Orchestrator"}</span>
                <MonoMeta>{msg.stage || msg.role} · {formatUtcTime(msg.createdAt)}</MonoMeta>
              </div>
              <div className="ori-msg-body">{msg.content}</div>
            </article>
          ))}
        </section>
      ) : null}

      {project.uiBlocks.map((block) => {
        const nodes = block.nodeIds.map((id) => nodeMap.get(id)).filter((n): n is ResearchNode => Boolean(n));
        if (!nodes.length) return null;
        return (
          <section key={block.id} className="ori-section-block">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <h2>{block.title}</h2>
              <StatusBadge tone="neutral">{block.kind}</StatusBadge>
            </div>

            {block.kind === "literature" ? (
              <PaperTable papers={nodes.filter((n) => n.type === "paper")} onSelectNode={onSelectNode} />
            ) : null}

            {block.kind === "analysis" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {nodes.filter((n) => n.type === "evidence" || n.type === "contradiction").length > 0 ? (
                  <div className="ori-evidence-list">
                    {nodes.filter((n) => n.type === "evidence" || n.type === "contradiction").map((node) => {
                      const sourcePaper = node.data.paperId ? paperMap.get(node.data.paperId) : undefined;
                      const rejected = node.data.verificationStatus === "rejected";
                      const entryCls = node.type === "contradiction"
                        ? "ori-evidence-entry ori-evidence-entry--contradiction"
                        : node.data.verified
                          ? "ori-evidence-entry ori-evidence-entry--verified"
                          : "ori-evidence-entry";
                      return (
                        <div key={node.id} className={entryCls}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <button type="button" className="ori-text-link" style={{ fontWeight: 600 }} onClick={() => onSelectNode(node.id)}>
                              {node.title}
                            </button>
                            <StatusBadge tone={node.type === "contradiction" || rejected ? "danger" : node.data.verified ? "ok" : "warn"}>
                              {node.type === "contradiction" ? "Contradiction" : rejected ? "Rejected" : node.data.verified ? "Confirmed" : "Unverified"}
                            </StatusBadge>
                          </div>
                          {node.data.quote ? <blockquote>&ldquo;{node.data.quote}&rdquo;</blockquote> : null}
                          <div className="ori-evidence-actions">
                            {sourcePaper ? (
                              <button type="button" className="ori-text-link" style={{ fontSize: 12 }} onClick={() => onSelectNode(sourcePaper.id)}>
                                Source: {sourcePaper.title}
                              </button>
                            ) : null}
                            {node.type === "evidence" && !node.data.verified ? (
                              <button type="button" className="ori-btn ori-btn--primary ori-btn--sm" disabled={busy} onClick={() => onEvidenceAction(node.id, "confirm")}>
                                <ClipboardCheck size={13} /> Confirm evidence
                              </button>
                            ) : null}
                            {node.type === "evidence" && node.data.verified ? (
                              <button type="button" className="ori-btn ori-btn--secondary ori-btn--sm" disabled={busy} onClick={() => onEvidenceAction(node.id, "unconfirm")}>
                                Unconfirm
                              </button>
                            ) : null}
                            {node.type === "evidence" && !rejected ? (
                              <button type="button" className="ori-btn ori-btn--ghost ori-btn--sm" disabled={busy} onClick={() => onEvidenceAction(node.id, "reject")}>
                                <XCircle size={13} /> Reject
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {nodes.filter((n) => n.type === "gap").map((gap) => (
                  <div key={gap.id} className="ori-evidence-entry ori-evidence-entry--gap">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <StatusBadge tone="warn">Research gap</StatusBadge>
                      <button type="button" className="ori-text-link" style={{ fontWeight: 600 }} onClick={() => onSelectNode(gap.id)}>{gap.title}</button>
                    </div>
                    {typeof gap.data.description === "string" ? <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>{gap.data.description}</p> : null}
                  </div>
                ))}

                {nodes.filter((n) => n.type === "hypothesis").map((hyp) => (
                  <div key={hyp.id} className="ori-hypothesis-strip">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <StatusBadge tone="accent"><Lightbulb size={12} /> Hypothesis</StatusBadge>
                      <button type="button" className="ori-btn ori-btn--secondary ori-btn--sm" disabled={busy} onClick={onTriggerReviewPanel}>
                        <ShieldCheck size={13} /> Audit with Independent Review Panel
                      </button>
                    </div>
                    <button type="button" className="ori-text-link" style={{ fontWeight: 600, fontSize: 16 }} onClick={() => onSelectNode(hyp.id)}>{hyp.title}</button>
                    {typeof hyp.data.statement === "string" ? <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>{hyp.data.statement}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}

            {block.kind === "review" ? (
              <div className="ori-review-grid">
                {(["auditor", "critic", "feasibility"] as const).map((role) => {
                  const review = nodes.find((n) => n.data.reviewer?.toLowerCase() === role);
                  const roleTitle = role === "auditor" ? "Evidence Auditor" : role === "critic" ? "Methodology Critic" : "Feasibility Reviewer";
                  return (
                    <article key={role} className="ori-review-card">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong style={{ fontSize: 14 }}>{roleTitle}</strong>
                        <StatusBadge tone="neutral">Zero-memory</StatusBadge>
                      </div>
                      {review ? (
                        <>
                          <button type="button" className="ori-text-link" style={{ fontSize: 12 }} onClick={() => onSelectNode(review.id)}>Inspect provenance</button>
                          {review.data.verdict ? <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{review.data.verdict}</p> : null}
                          {review.data.parseError ? <p style={{ fontSize: 12, color: "var(--status-danger)" }}>{review.data.parseError}</p> : null}
                          {(review.data.findings || []).map((f, idx) => (
                            <div key={idx} className="ori-finding-item">
                              <StatusBadge tone={f.severity === "high" ? "danger" : f.severity === "medium" ? "warn" : "neutral"}>
                                {f.severity || "medium"}
                              </StatusBadge>
                              <strong>{f.claim || f.finding}</strong>
                              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{f.rationale}</span>
                            </div>
                          ))}
                        </>
                      ) : <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Not run yet.</p>}
                    </article>
                  );
                })}
              </div>
            ) : null}

            {block.kind === "experiment" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {nodes.filter((n) => n.type === "experiment").map((exp) => (
                  <div key={exp.id} className="ori-panel">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <button type="button" className="ori-text-link" style={{ fontWeight: 600, fontSize: 16 }} onClick={() => onSelectNode(exp.id)}>{exp.title}</button>
                      <button type="button" className="ori-btn ori-btn--primary ori-btn--sm" onClick={onGoToValidation}>
                        Open Validation Workspace
                      </button>
                    </div>
                    <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                      Modality: <strong>{exp.data.modality || "general"}</strong> · {(exp.data.protocol || []).length} steps · {(exp.data.expectedOutcomes || []).length} frozen expectations
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {block.kind === "result" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {nodes.filter((n) => n.type === "result").map((res) => (
                  <div key={res.id} className="ori-panel">
                    <button type="button" className="ori-text-link" style={{ fontWeight: 600 }} onClick={() => onSelectNode(res.id)}>{res.title}</button>
                    <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>{res.data.observations}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}

      {evidence.length > 0 && project.uiBlocks.every((b) => b.kind !== "analysis") ? (
        <section className="ori-section-block">
          <h2>Anchored Evidence ({evidence.length})</h2>
          <div className="ori-evidence-list">
            {evidence.map((ev) => (
              <div key={ev.id} className="ori-evidence-entry">
                <button type="button" className="ori-text-link" onClick={() => onSelectNode(ev.id)}>{ev.title}</button>
                {ev.data.quote ? <blockquote>{ev.data.quote}</blockquote> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function NodeInspectorPanel({
  project,
  node,
  busy,
  onSelectNode,
  onEvidenceAction,
  onAddManualEvidence,
  onUpdateNode,
  onDeleteNode,
}: {
  project: ResearchProject;
  node?: ResearchNode;
  busy: boolean;
  onSelectNode: (id: string) => void;
  onEvidenceAction: (id: string, action: "confirm" | "unconfirm" | "reject") => void;
  onAddManualEvidence: (paperId: string, quote: string, title?: string) => void;
  onUpdateNode: (nodeId: string, patch: { title?: string; data?: Record<string, unknown> }) => void;
  onDeleteNode: (nodeId: string) => void;
}) {
  const [quoteText, setQuoteText] = useState("");
  const [quoteTitle, setQuoteTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  if (!node) {
    const papers = project.nodes.filter((n) => n.type === "paper").length;
    const evTotal = project.nodes.filter((n) => n.type === "evidence").length;
    const evConfirmed = project.nodes.filter((n) => n.type === "evidence" && n.data.verified === true).length;
    const reviews = project.nodes.filter((n) => n.type === "review").length;
    const experiments = project.nodes.filter((n) => n.type === "experiment").length;
    return (
      <div className="ori-inspector-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ fontSize: 14 }}>Investigation Inspector</strong>
          <MonoMeta>r{project.revision}</MonoMeta>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Click any paper, quote, hypothesis, review, or experiment to inspect its SHA-256 provenance, verify passages, or edit titles.
        </p>
        <dl className="ori-dl" style={{ paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><dt>Literature</dt><dd><MonoMeta>{papers} papers</MonoMeta></dd></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><dt>Evidence</dt><dd><MonoMeta>{evConfirmed}/{evTotal} confirmed</MonoMeta></dd></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><dt>Reviews</dt><dd><MonoMeta>{reviews} / 3 panel</MonoMeta></dd></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><dt>Validation</dt><dd><MonoMeta>{experiments} protocols</MonoMeta></dd></div>
        </dl>
      </div>
    );
  }

  const edges = project.edges.filter((e) => e.source === node.id || e.target === node.id);
  const nodeMap = new Map(project.nodes.map((n) => [n.id, n]));
  const editable = ["hypothesis", "gap", "contradiction"].includes(node.type);

  const captureAbstractSelection = () => {
    const selected = window.getSelection()?.toString().trim();
    if (selected && typeof node.data.abstract === "string" && node.data.abstract.includes(selected)) {
      setQuoteText(selected);
    }
  };

  return (
    <>
      <div className="ori-inspector-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <StatusBadge tone="accent">{NODE_LABELS[node.type]}</StatusBadge>
          <MonoMeta>r{project.revision}</MonoMeta>
        </div>
        {isEditing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input className="ori-input" value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="ori-btn ori-btn--primary ori-btn--sm"
                disabled={busy || !editingTitle.trim()}
                onClick={() => { onUpdateNode(node.id, { title: editingTitle.trim() }); setIsEditing(false); }}
              >
                Save
              </button>
              <button type="button" className="ori-btn ori-btn--secondary ori-btn--sm" onClick={() => setIsEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <h2 style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.32 }}>{node.title}</h2>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {editable && !isEditing ? (
            <button type="button" className="ori-btn ori-btn--secondary ori-btn--sm" onClick={() => { setEditingTitle(node.title); setIsEditing(true); }}>
              Edit title
            </button>
          ) : null}
          {node.type !== "paper" ? (
            <button type="button" className="ori-btn ori-btn--ghost ori-btn--sm" disabled={busy} onClick={() => onDeleteNode(node.id)}>
              <Trash2 size={13} /> Delete
            </button>
          ) : null}
        </div>
      </div>

      {node.type === "evidence" ? (
        <div className="ori-inspector-card">
          <strong style={{ fontSize: 13 }}>
            {node.data.verified ? "Human-confirmed evidence" : node.data.verificationStatus === "rejected" ? "Rejected evidence" : "Unverified evidence"}
          </strong>
          <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            SHA-256 verified against the immutable abstract snapshot.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {!node.data.verified ? (
              <button type="button" className="ori-btn ori-btn--primary ori-btn--sm" disabled={busy} onClick={() => onEvidenceAction(node.id, "confirm")}>
                <CheckCircle2 size={13} /> Confirm
              </button>
            ) : (
              <button type="button" className="ori-btn ori-btn--secondary ori-btn--sm" disabled={busy} onClick={() => onEvidenceAction(node.id, "unconfirm")}>
                Unconfirm
              </button>
            )}
            <button type="button" className="ori-btn ori-btn--ghost ori-btn--sm" disabled={busy} onClick={() => onEvidenceAction(node.id, "reject")}>
              Reject
            </button>
          </div>
        </div>
      ) : null}

      {node.type === "paper" && typeof node.data.abstract === "string" && node.data.abstract.trim() ? (
        <div className="ori-inspector-card">
          <strong style={{ fontSize: 13 }}>Highlight &amp; Anchor Evidence</strong>
          <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Select text inside the immutable abstract below to anchor a human-verified passage.
          </p>
          <div
            onMouseUp={captureAbstractSelection}
            style={{ padding: 12, borderRadius: 10, background: "var(--bg-subtle)", fontSize: 13, lineHeight: 1.5, maxHeight: 200, overflowY: "auto" }}
          >
            {node.data.abstract}
          </div>
          <input
            className="ori-input"
            placeholder="Label (optional)"
            value={quoteTitle}
            onChange={(e) => setQuoteTitle(e.target.value)}
          />
          <textarea
            className="ori-textarea"
            style={{ minHeight: 68 }}
            placeholder="Exact passage from abstract..."
            value={quoteText}
            onChange={(e) => setQuoteText(e.target.value)}
          />
          <button
            type="button"
            className="ori-btn ori-btn--primary ori-btn--sm"
            disabled={busy || quoteText.trim().length < 8}
            onClick={() => {
              onAddManualEvidence(node.id, quoteText.trim(), quoteTitle.trim() || undefined);
              setQuoteText("");
              setQuoteTitle("");
            }}
          >
            <CheckCircle2 size={13} /> Anchor &amp; Confirm Passage
          </button>
        </div>
      ) : null}

      <div className="ori-inspector-card">
        <strong style={{ fontSize: 13 }}>Canonical Data</strong>
        <dl className="ori-dl">
          <div><dt>Node ID</dt><dd><MonoMeta>{node.id}</MonoMeta></dd></div>
          {Object.entries(node.data).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{typeof v === "object" ? <pre>{JSON.stringify(v, null, 2)}</pre> : String(v)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="ori-inspector-card">
        <strong style={{ fontSize: 13 }}>Semantic Links ({edges.length})</strong>
        {edges.length ? (
          <ul style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {edges.map((edge) => {
              const otherId = edge.source === node.id ? edge.target : edge.source;
              const other = nodeMap.get(otherId);
              return (
                <li key={edge.id} style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 3 }}>
                  <StatusBadge tone={edge.type === "contradicts" ? "danger" : "neutral"}>{edge.type}</StatusBadge>
                  {other ? (
                    <button type="button" className="ori-text-link" style={{ fontSize: 13 }} onClick={() => onSelectNode(other.id)}>{other.title}</button>
                  ) : <MonoMeta>{otherId}</MonoMeta>}
                </li>
              );
            })}
          </ul>
        ) : <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No connected edges.</p>}
      </div>
    </>
  );
}
