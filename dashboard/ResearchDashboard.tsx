"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode, RefObject } from "react";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  FlaskConical,
  LoaderCircle,
  Microscope,
  Network,
  PanelRight,
  Play,
  Settings2,
  Square,
  X,
} from "lucide-react";
import { NODE_LABELS } from "../packages/contracts";
import type {
  ResearchNode,
  ResearchProject,
  RunTelemetry,
  SetupStatus,
  ViewId,
} from "../packages/contracts";
import {
  AnalysisBlock,
  DashboardEmptyState,
  ExperimentBlock,
  LiteratureTable,
  ResultBlock,
  ReviewBlock,
  SourceFailures,
  StepTracker,
  TimelineBlock,
  formatDateTime,
} from "./blocks";

export interface DashboardProps {
  project: ResearchProject | null;
  telemetry: RunTelemetry;
  activeView: ViewId;
  onViewChange: (view: ViewId) => void;
  onStart: (curiosity: string) => void;
  onStop: () => void;
  onOpenSetup?: () => void;
  onPreflight: () => Promise<SetupStatus>;
  onSelectNode: (id: string) => void;
  selectedNodeId?: string;
  onConfirmEvidence: (id: string) => void;
  onImportResult: (experimentId: string, observations: string) => void;
  onExport: () => void;
  busy: boolean;
  error?: string;
  graph?: ReactNode;
  exportPanel?: ReactNode;
}

const NAV_ITEMS = [
  { id: "research", label: "Research", icon: Microscope },
  { id: "literature", label: "Literature", icon: BookOpen },
  { id: "experiments", label: "Experiments", icon: FlaskConical },
  { id: "graph", label: "Knowledge graph", icon: Network },
  { id: "published", label: "Published", icon: FileText },
] as const;

const VIEW_COPY: Record<ViewId, { title: string; description: string }> = {
  research: { title: "Research canvas", description: "A continuous, inspectable record of the live investigation." },
  literature: { title: "Literature", description: "Normalized provider records, exact abstract availability, and source issues." },
  experiments: { title: "Experiments", description: "Frozen predictions, lab options, and separately imported observations." },
  graph: { title: "Knowledge graph", description: "Semantic nodes and relationships from the same canonical revision." },
  published: { title: "Published", description: "Export files generated from the live research state." },
};

function formatElapsed(elapsedMs?: number): string | undefined {
  if (typeof elapsedMs !== "number" || !Number.isFinite(elapsedMs) || elapsedMs < 0) return undefined;
  const seconds = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function Telemetry({ telemetry }: { telemetry: RunTelemetry }) {
  const elapsed = formatElapsed(telemetry.elapsedMs);
  const hasRealUsage = typeof telemetry.outputTokens === "number" && Number.isFinite(telemetry.outputTokens) && telemetry.outputTokens > 0;
  const hasTps = hasRealUsage && typeof telemetry.outputTps === "number" && Number.isFinite(telemetry.outputTps) && telemetry.outputTps >= 0;

  return (
    <div className="ori-telemetry" aria-label="Run telemetry">
      <span className={`ori-run-status ori-run-status--${telemetry.status}`}>
        {telemetry.status === "running" || telemetry.status === "connecting" ? <LoaderCircle size={13} aria-hidden="true" /> : <span className="ori-status-dot" aria-hidden="true" />}
        {telemetry.status}
      </span>
      <div className="ori-telemetry-item">
        <Clock size={14} aria-hidden="true" />
        <span className="ori-telemetry-label">Elapsed</span>
        {elapsed ? <span className="ori-telemetry-value">{elapsed}</span> : <><span aria-hidden="true" className="ori-telemetry-value">—</span><span className="ori-visually-hidden">Elapsed time unavailable</span></>}
      </div>
      <div className="ori-telemetry-item ori-telemetry-tps">
        <span className="ori-telemetry-label">{telemetry.outputTpsLabel}</span>
        {hasTps ? <span className="ori-telemetry-value">{telemetry.outputTps!.toFixed(1)}</span> : <><span aria-hidden="true" className="ori-telemetry-value">—</span><span className="ori-visually-hidden">Run-average output TPS unavailable without provider usage</span></>}
      </div>
    </div>
  );
}

type SetupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; result: SetupStatus }
  | { status: "error"; message: string };

function SetupDialog({
  onOpenSetup,
  onPreflight,
}: {
  onOpenSetup?: () => void;
  onPreflight: () => Promise<SetupStatus>;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const requestRef = useRef(0);
  const [state, setState] = useState<SetupState>({ status: "idle" });

  const checkStatus = async () => {
    const requestId = ++requestRef.current;
    setState({ status: "loading" });
    try {
      const result = await onPreflight();
      if (requestId === requestRef.current) setState({ status: "ready", result });
    } catch (cause) {
      if (requestId === requestRef.current) {
        setState({ status: "error", message: cause instanceof Error ? cause.message : String(cause) });
      }
    }
  };

  const open = () => {
    onOpenSetup?.();
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    void checkStatus();
  };

  return (
    <>
      <button type="button" className="ori-button ori-button--secondary ori-topbar-action" onClick={open} aria-label="Check setup">
        <Settings2 size={16} aria-hidden="true" /><span className="ori-action-label">Setup</span>
      </button>
      <dialog
        ref={dialogRef}
        className="ori-setup-dialog"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className="ori-dialog-header">
          <div>
            <h2 id={titleId}>Server setup</h2>
            <p id={descriptionId}>Validate Cerebras and Gateway configuration without creating a research session.</p>
          </div>
          <form method="dialog">
            <button type="submit" className="ori-icon-button" aria-label="Close setup" autoFocus><X size={19} aria-hidden="true" /></button>
          </form>
        </div>
        <div className="ori-setup-body" aria-busy={state.status === "loading"}>
          {state.status === "loading" ? (
            <div className="ori-setup-loading"><LoaderCircle size={20} aria-hidden="true" /><p>Checking server configuration. This does not start research.</p></div>
          ) : null}
          {state.status === "error" ? (
            <div className="ori-setup-error" role="alert"><AlertCircle size={18} aria-hidden="true" /><div><strong>Setup check failed</strong><p>{state.message}</p></div></div>
          ) : null}
          {state.status === "ready" ? (
            <div className="ori-setup-result">
              <div className={`ori-setup-summary ${state.result.ok ? "ori-setup-summary--ok" : "ori-setup-summary--error"}`}>
                {state.result.ok ? <CheckCircle2 size={19} aria-hidden="true" /> : <AlertCircle size={19} aria-hidden="true" />}
                <strong>{state.result.ok ? "Configuration checks passed" : "Configuration needs attention"}</strong>
              </div>
              <ul className="ori-setup-checks">
                {state.result.checks.map((check) => (
                  <li key={check.id}>
                    <span className={check.ok ? "ori-check-icon ori-check-icon--ok" : "ori-check-icon ori-check-icon--error"} aria-hidden="true">{check.ok ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}</span>
                    <div><strong>{check.label}</strong><p>{check.detail}</p></div>
                    <span className="ori-pill">{check.ok ? "Passed" : "Failed"}</span>
                  </li>
                ))}
              </ul>
              <p className="ori-setup-note">{state.result.note}</p>
            </div>
          ) : null}
        </div>
        <div className="ori-dialog-footer">
          <p>No credentials are displayed. No research run is started.</p>
          <button type="button" className="ori-button ori-button--secondary" onClick={() => void checkStatus()} disabled={state.status === "loading"}>
            <Settings2 size={15} aria-hidden="true" />Refresh status
          </button>
        </div>
      </dialog>
    </>
  );
}

function CuriosityComposer({ busy, active, onStart }: { busy: boolean; active: boolean; onStart: (curiosity: string) => void }) {
  const id = useId();
  const [curiosity, setCuriosity] = useState("");
  const disabled = busy || active;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = curiosity.trim();
    if (!value || disabled) return;
    onStart(value);
    setCuriosity("");
  };

  return (
    <form className="ori-curiosity-composer" onSubmit={submit}>
      <div className="ori-composer-inner">
        <label htmlFor={`${id}-curiosity`}>Research curiosity</label>
        <p id={`${id}-hint`}>{active ? "Stop the active run before starting another curiosity." : "Submit a question to start a dedicated research session. Setup checks never start research."}</p>
        <div className="ori-composer-controls">
          <textarea
            id={`${id}-curiosity`}
            value={curiosity}
            onChange={(event) => setCuriosity(event.target.value)}
            aria-describedby={`${id}-hint`}
            placeholder="What unresolved question do you want to investigate?"
            rows={2}
            required
            disabled={disabled}
          />
          <button type="submit" className="ori-button ori-button--primary ori-start-button" disabled={disabled || !curiosity.trim()}>
            <Play size={16} aria-hidden="true" />Start research
          </button>
        </div>
      </div>
    </form>
  );
}

function relatedLabs(project: ResearchProject, experimentId: string, blockNodeIds?: string[]): ResearchNode[] {
  const attached = new Set(blockNodeIds ?? []);
  const connected = new Set<string>();
  for (const edge of project.edges) {
    if (edge.type !== "conducted-at") continue;
    if (edge.source === experimentId) connected.add(edge.target);
    if (edge.target === experimentId) connected.add(edge.source);
  }
  const labs = project.nodes.filter((node) => node.type === "lab");
  const related = labs.filter((lab) => attached.has(lab.id) || connected.has(lab.id));
  const experimentCount = project.nodes.filter((node) => node.type === "experiment").length;
  return related.length || experimentCount !== 1 ? related : labs;
}

function ResearchBlock({
  project,
  blockId,
  kind,
  title,
  nodeIds,
  busy,
  onSelectNode,
  onConfirmEvidence,
  onImportResult,
}: {
  project: ResearchProject;
  blockId: string;
  kind: "literature" | "analysis" | "review" | "experiment" | "result";
  title: string;
  nodeIds: string[];
  busy: boolean;
  onSelectNode: (id: string) => void;
  onConfirmEvidence: (id: string) => void;
  onImportResult: (experimentId: string, observations: string) => void;
}) {
  const nodeById = new Map(project.nodes.map((node) => [node.id, node]));
  const nodes = nodeIds.map((id) => nodeById.get(id)).filter((node): node is ResearchNode => Boolean(node));
  return (
    <section className={`ori-block ori-block--${kind}`} aria-labelledby={`${blockId}-title`}>
      <div className="ori-block-header"><h2 id={`${blockId}-title`}>{title}</h2><span className="ori-revision-label">Revision {project.revision}</span></div>
      {kind === "literature" ? <>
        <LiteratureTable papers={nodes.filter((node) => node.type === "paper")} onSelectNode={onSelectNode} />
        {nodes.some((node) => node.type === "evidence" || node.type === "contradiction") ? <AnalysisBlock project={project} nodeIds={nodes.filter((node) => node.type === "evidence" || node.type === "contradiction").map((node) => node.id)} busy={busy} onSelectNode={onSelectNode} onConfirmEvidence={onConfirmEvidence} /> : null}
      </> : null}
      {kind === "analysis" ? <AnalysisBlock project={project} nodeIds={nodeIds} busy={busy} onSelectNode={onSelectNode} onConfirmEvidence={onConfirmEvidence} /> : null}
      {kind === "review" ? <ReviewBlock project={project} nodeIds={nodeIds} onSelectNode={onSelectNode} /> : null}
      {kind === "experiment" ? nodes.filter((node) => node.type === "experiment").map((experiment) => (
        <ExperimentBlock key={experiment.id} experiment={experiment} labs={relatedLabs(project, experiment.id, nodeIds)} busy={busy} onSelectNode={onSelectNode} onImportResult={onImportResult} />
      )) : null}
      {kind === "result" ? <ResultBlock project={project} nodeIds={nodeIds} onSelectNode={onSelectNode} /> : null}
    </section>
  );
}

function readableKey(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

function InspectorValue({ value }: { value: unknown }) {
  if (typeof value === "string") return <span>{value}</span>;
  if (typeof value === "number" || typeof value === "boolean") return <span className="ori-numeric">{String(value)}</span>;
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
}

function NodeInspector({
  project,
  node,
  busy,
  onSelectNode,
  onConfirmEvidence,
}: {
  project: ResearchProject | null;
  node?: ResearchNode;
  busy: boolean;
  onSelectNode: (id: string) => void;
  onConfirmEvidence: (id: string) => void;
}) {
  if (!project) {
    return <DashboardEmptyState title="No research node selected"><p>The inspector will show canonical node details after an investigation begins.</p></DashboardEmptyState>;
  }
  if (!node) {
    return <DashboardEmptyState title="Select a research node"><p>Choose a paper, evidence passage, review, experiment, or other artifact to inspect its exact revision data.</p></DashboardEmptyState>;
  }

  const dataEntries = Object.entries(node.data).filter(([, value]) => value !== undefined && value !== null && value !== "");
  const edges = project.edges.filter((edge) => edge.source === node.id || edge.target === node.id);
  const nodeById = new Map(project.nodes.map((item) => [item.id, item]));

  return (
    <div className="ori-node-inspector">
      <div className="ori-inspector-node-heading">
        <span className="ori-pill">{NODE_LABELS[node.type]}</span>
        <h2>{node.title}</h2>
        <p>Updated {formatDateTime(node.updatedAt)} · Revision {project.revision}</p>
      </div>
      {node.type === "evidence" ? (
        <div className="ori-inspector-confirmation">
          <strong>{node.data.verified ? "Evidence confirmed" : "Evidence unverified"}</strong>
          <p>{node.data.verified ? node.data.verificationMethod || "A verification method was not recorded." : "Confirm the exact passage with the deterministic check. No model is used."}</p>
          {!node.data.verified ? <button type="button" className="ori-button ori-button--primary" disabled={busy} onClick={() => onConfirmEvidence(node.id)}><CheckCircle2 size={16} aria-hidden="true" />Confirm evidence</button> : null}
        </div>
      ) : null}
      <section aria-labelledby="ori-inspector-data">
        <h3 id="ori-inspector-data">Canonical data</h3>
        {dataEntries.length ? <dl className="ori-inspector-data-list">{dataEntries.map(([key, value]) => <div key={key}><dt>{readableKey(key)}</dt><dd><InspectorValue value={value} /></dd></div>)}</dl> : <p className="ori-inline-empty">This node has no additional typed data.</p>}
      </section>
      <section aria-labelledby="ori-inspector-provenance">
        <h3 id="ori-inspector-provenance">Provenance</h3>
        <dl className="ori-inspector-meta-list">
          <div><dt>Node ID</dt><dd>{node.id}</dd></div>
          <div><dt>Created</dt><dd>{formatDateTime(node.createdAt)}</dd></div>
        </dl>
        {node.sourceRefs.length ? <ul className="ori-source-ref-list">{node.sourceRefs.map((ref) => <li key={ref}>{ref}</li>)}</ul> : <p className="ori-inline-empty">No source references were supplied.</p>}
      </section>
      <section aria-labelledby="ori-inspector-edges">
        <h3 id="ori-inspector-edges">Semantic relationships</h3>
        {edges.length ? <ul className="ori-edge-list">{edges.map((edge) => {
          const otherId = edge.source === node.id ? edge.target : edge.source;
          const other = nodeById.get(otherId);
          return (
            <li key={edge.id} className={edge.type === "contradicts" ? "ori-edge--contradiction" : undefined}>
              <span className="ori-pill">{edge.type}</span>
              <strong>{edge.label}</strong>
              {other ? <button type="button" className="ori-text-button" onClick={() => onSelectNode(other.id)}>{other.title}</button> : <span>{otherId}</span>}
            </li>
          );
        })}</ul> : <p className="ori-inline-empty">No semantic edges connect to this node.</p>}
      </section>
    </div>
  );
}

function ExportFallback({ project, busy, onExport }: { project: ResearchProject | null; busy: boolean; onExport: () => void }) {
  if (!project) {
    return <DashboardEmptyState icon={<FileText size={24} />} title="No research to export"><p>Start an investigation before generating publication files.</p></DashboardEmptyState>;
  }
  return (
    <section className="ori-block" aria-labelledby="ori-export-fallback-title">
      <div className="ori-block-header"><h2 id="ori-export-fallback-title">Revision exports</h2><button type="button" className="ori-button ori-button--primary" disabled={busy} onClick={onExport}><Download size={15} aria-hidden="true" />Export revision {project.revision}</button></div>
      {project.exports.length ? <ul className="ori-export-list">{project.exports.map((file) => <li key={file.id}><FileText size={18} aria-hidden="true" /><div><strong>{file.format.toUpperCase()}</strong><p>{file.path}</p><span>Revision {file.revision} · {formatDateTime(file.createdAt)} · SHA-256 {file.sha256}</span></div></li>)}</ul> : <p className="ori-inline-empty">No export files have been generated for this project.</p>}
    </section>
  );
}

export function ResearchDashboard({
  project,
  telemetry,
  activeView,
  onViewChange,
  onStart,
  onStop,
  onOpenSetup,
  onPreflight,
  onSelectNode,
  selectedNodeId,
  onConfirmEvidence,
  onImportResult,
  onExport,
  busy,
  error,
  graph,
  exportPanel,
}: DashboardProps) {
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorModal, setInspectorModal] = useState<boolean | null>(null);
  const inspectorRef = useRef<HTMLDialogElement>(null);
  const inspectorToggleRef = useRef<HTMLButtonElement>(null);
  const selectedNode = project?.nodes.find((node) => node.id === selectedNodeId);
  const active = telemetry.status === "running" || telemetry.status === "connecting";
  const counts: Record<ViewId, number> = {
    research: project?.uiBlocks.length ?? 0,
    literature: project?.nodes.filter((node) => node.type === "paper").length ?? 0,
    experiments: project?.nodes.filter((node) => node.type === "experiment").length ?? 0,
    graph: project?.nodes.length ?? 0,
    published: project?.exports.length ?? 0,
  };

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1179px)");
    const update = () => setInspectorModal(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const dialog = inspectorRef.current;
    if (!dialog || inspectorModal === null) return;
    const shouldOpen = inspectorModal ? inspectorOpen : true;
    const wasModal = dialog.dataset.modal === "true";
    if (dialog.open && (wasModal !== inspectorModal || !shouldOpen)) dialog.close();
    if (shouldOpen && !dialog.open) {
      dialog.dataset.modal = String(inspectorModal);
      if (inspectorModal) dialog.showModal();
      else dialog.show();
    }
  }, [inspectorModal, inspectorOpen]);

  useEffect(() => {
    if (selectedNodeId) setInspectorOpen(true);
  }, [selectedNodeId]);

  const selectNode = (id: string) => {
    onSelectNode(id);
    setInspectorOpen(true);
  };
  const closeInspector = () => inspectorRef.current?.close();
  const changeView = (view: ViewId) => {
    onViewChange(view);
    setInspectorOpen(false);
  };
  const viewCopy = activeView === "research" && project
    ? { title: project.title, description: project.curiosity || VIEW_COPY.research.description }
    : VIEW_COPY[activeView];

  return (
    <div className={`ori-shell ori-shell--${activeView}`}>
      <a className="ori-skip-link" href="#ori-main-content">Skip to research canvas</a>
      <header className="ori-topbar">
        <div className="ori-brand"><span className="ori-brand-mark" aria-hidden="true"><Microscope size={20} /></span><span>Open Research IDE</span></div>
        <div className="ori-project-context">
          {project ? <><strong>{project.title}</strong><span className="ori-pill">Revision {project.revision}</span><span className="ori-local-label">{project.privacy}</span></> : <span>Local-first scientific research</span>}
        </div>
        <Telemetry telemetry={telemetry} />
        <div className="ori-topbar-actions">
          {active ? <button type="button" className="ori-button ori-button--stop ori-topbar-action" onClick={onStop} disabled={busy} aria-label="Stop research"><Square size={14} aria-hidden="true" /><span className="ori-action-label">Stop</span></button> : null}
          <SetupDialog onOpenSetup={onOpenSetup} onPreflight={onPreflight} />
          <button type="button" className="ori-button ori-button--secondary ori-topbar-action" onClick={onExport} disabled={!project || busy} aria-label="Export research"><Download size={16} aria-hidden="true" /><span className="ori-action-label">Export</span></button>
          <button
            ref={inspectorToggleRef}
            type="button"
            className="ori-icon-button ori-inspector-toggle"
            onClick={() => setInspectorOpen((open) => !open)}
            aria-label={inspectorOpen ? "Close inspector" : "Open inspector"}
            aria-expanded={inspectorOpen}
          ><PanelRight size={19} aria-hidden="true" /></button>
        </div>
      </header>

      <nav className="ori-navigation" aria-label="Research views">
        <ul>
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button type="button" className={`ori-nav-button${activeView === id ? " ori-nav-button--active" : ""}`} onClick={() => changeView(id)} aria-current={activeView === id ? "page" : undefined}>
                <Icon size={19} aria-hidden="true" /><span>{label}</span><span className="ori-nav-count" aria-label={`${counts[id]} items`}>{counts[id]}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <main id="ori-main-content" className="ori-canvas" tabIndex={-1}>
        <div className="ori-canvas-scroll">
          <div className="ori-document">
            <header className="ori-view-header">
              <div><h1>{viewCopy.title}</h1><p>{viewCopy.description}</p></div>
              {project ? <span className={`ori-project-status ori-project-status--${project.status}`}>{project.status}</span> : null}
            </header>
            {busy ? <div className="ori-global-status" role="status"><LoaderCircle size={16} aria-hidden="true" />Applying the requested research action…</div> : null}
            {error ? <div className="ori-global-error" role="alert"><AlertCircle size={18} aria-hidden="true" /><div><strong>Research action failed</strong><p>{error}</p></div></div> : null}

            <div className="ori-revision" key={`${activeView}-${project?.projectId ?? "empty"}-${project?.revision ?? 0}`}>
              {activeView === "research" ? (
                <>
                  <StepTracker project={project} />
                  {project ? (
                    <>
                      <SourceFailures sources={project.sources} />
                      {project.uiBlocks.length ? project.uiBlocks.map((block) => (
                        <ResearchBlock
                          key={block.id}
                          project={project}
                          blockId={block.id}
                          kind={block.kind}
                          title={block.title}
                          nodeIds={block.nodeIds}
                          busy={busy}
                          onSelectNode={selectNode}
                          onConfirmEvidence={onConfirmEvidence}
                          onImportResult={onImportResult}
                        />
                      )) : (
                        <section className="ori-block ori-pending-block" aria-labelledby="ori-pending-title">
                          <h2 id="ori-pending-title">No committed artifact blocks yet</h2>
                          <p>{active ? "The run is active. Persistent blocks will appear after canonical mutations are committed." : "This project revision contains no ordered artifact blocks."}</p>
                        </section>
                      )}
                      <TimelineBlock project={project} onSelectNode={selectNode} />
                    </>
                  ) : active ? (
                    <DashboardEmptyState icon={<Microscope size={28} />} title="Connecting the research run">
                      <p>Waiting for the first canonical project snapshot. No research artifacts are available yet.</p>
                    </DashboardEmptyState>
                  ) : (
                    <DashboardEmptyState icon={<Microscope size={28} />} title="Begin with a real question">
                      <p>Your curiosity starts the investigation. Literature, critiques, experiments, and exports will be built only from committed research state.</p>
                    </DashboardEmptyState>
                  )}
                </>
              ) : null}

              {activeView === "literature" ? (
                project ? <section className="ori-block" aria-labelledby="ori-literature-view-title"><div className="ori-block-header"><h2 id="ori-literature-view-title">Retrieved papers</h2><span className="ori-revision-label">{pluralNodes(project, "paper")}</span></div><LiteratureTable papers={project.nodes.filter((node) => node.type === "paper")} sources={project.sources} onSelectNode={selectNode} /></section> : <NoProject view="literature" />
              ) : null}

              {activeView === "experiments" ? (
                project ? <ExperimentsView project={project} busy={busy} onSelectNode={selectNode} onImportResult={onImportResult} /> : <NoProject view="experiments" />
              ) : null}

              {activeView === "graph" ? (
                project ? graph ? <div className="ori-graph-slot">{graph}</div> : <DashboardEmptyState icon={<Network size={24} />} title="Knowledge graph unavailable"><p>The graph view has not been provided for this revision.</p></DashboardEmptyState> : <NoProject view="knowledge graph" />
              ) : null}

              {activeView === "published" ? exportPanel ?? <ExportFallback project={project} busy={busy} onExport={onExport} /> : null}
            </div>
          </div>
        </div>
        {activeView === "research" ? <CuriosityComposer busy={busy} active={active} onStart={onStart} /> : null}
      </main>

      <dialog
        ref={inspectorRef}
        className="ori-inspector"
        aria-label="Research node inspector"
        onClose={() => setInspectorOpen(false)}
      >
        <div className="ori-inspector-header">
          <h2>Inspector</h2>
          <button type="button" className="ori-icon-button ori-inspector-close" onClick={closeInspector} aria-label="Close inspector" autoFocus><X size={19} aria-hidden="true" /></button>
        </div>
        <div className="ori-inspector-scroll">
          {selectedNodeId && project && !selectedNode ? <div className="ori-global-error"><AlertCircle size={17} aria-hidden="true" /><p>The selected node is not present in revision {project.revision}.</p></div> : null}
          <NodeInspector project={project} node={selectedNode} busy={busy} onSelectNode={selectNode} onConfirmEvidence={onConfirmEvidence} />
        </div>
      </dialog>
    </div>
  );
}

function pluralNodes(project: ResearchProject, type: "paper" | "experiment"): string {
  const count = project.nodes.filter((node) => node.type === type).length;
  return `${count} ${count === 1 ? type : `${type}s`}`;
}

function NoProject({ view }: { view: string }) {
  return <DashboardEmptyState title={`No ${view} yet`}><p>Start a research curiosity from the Research canvas before opening this view.</p></DashboardEmptyState>;
}

function ExperimentsView({
  project,
  busy,
  onSelectNode,
  onImportResult,
}: {
  project: ResearchProject;
  busy: boolean;
  onSelectNode: (id: string) => void;
  onImportResult: (experimentId: string, observations: string) => void;
}) {
  const experiments = project.nodes.filter((node) => node.type === "experiment");
  const results = project.nodes.filter((node) => node.type === "result");
  if (!experiments.length && !results.length) {
    return <DashboardEmptyState icon={<FlaskConical size={24} />} title="No experiments in this revision"><p>Protocols and frozen expected outcomes appear after Elephant commits an experiment.</p></DashboardEmptyState>;
  }
  return (
    <>
      {experiments.map((experiment) => (
        <section className="ori-block" key={experiment.id} aria-labelledby={`${experiment.id}-view-title`}>
          <div className="ori-block-header"><h2 id={`${experiment.id}-view-title`}>Experiment plan</h2><span className="ori-revision-label">Revision {project.revision}</span></div>
          <ExperimentBlock experiment={experiment} labs={relatedLabs(project, experiment.id)} busy={busy} onSelectNode={onSelectNode} onImportResult={onImportResult} />
        </section>
      ))}
      {results.length ? (
        <section className="ori-block" aria-labelledby="ori-observed-results-title">
          <div className="ori-block-header"><h2 id="ori-observed-results-title">Observed results</h2><span className="ori-revision-label">Imported separately from predictions</span></div>
          <ResultBlock project={project} nodeIds={results.map((result) => result.id)} onSelectNode={onSelectNode} />
        </section>
      ) : null}
    </>
  );
}
