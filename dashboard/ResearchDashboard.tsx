"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Columns2,
  Download,
  ExternalLink,
  FileText,
  FlaskConical,
  FolderOpen,
  FolderTree,
  Lightbulb,
  LoaderCircle,
  Microscope,
  Moon,
  Network,
  Package,
  PanelRight,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Square,
  Sun,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { CommandPalette, WorkspaceSidebar } from "../components";
import type { SidebarTab } from "../components";
import { NODE_LABELS } from "../packages/contracts";
import type {
  ContradictionResolution,
  DiagnosticItem,
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
  WorkspaceFileEntry,
} from "../packages/contracts";
import {
  CONTRADICTION_RESOLUTION_LABELS,
  abstractSnippet,
  resolveContradictionSides,
  splitAbstractAroundQuote,
} from "../src/contradictions";
import { computeProjectDiagnostics } from "../src/diagnostics";
import { FilesWorkspace } from "./FilesWorkspace";
import { LandingHome } from "./LandingHome";
import { LiteratureWorkspace } from "./LiteratureWorkspace";
import { ManuscriptStudio } from "./ManuscriptStudio";
import { CompetingHypothesesPanel, IdeationAndTasksPanel } from "./PlanningPanels";
import { SetupModal } from "./SetupModal";
import { TestingWorkspace } from "./TestingWorkspace";
import { MonoMeta, SectionHeader, StatusBadge } from "./ui";

export interface DashboardProps {
  project: ResearchProject | null;
  projects: ResearchProjectSummary[];
  files: WorkspaceFileEntry[];
  showHome: boolean;
  telemetry: RunTelemetry;
  streamingDelta: string;
  activeView: ViewId;
  onViewChange: (view: ViewId) => void;
  onGoHome: () => void;
  onSelectProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onStart: (curiosity: string, mode: InvestigationMode) => void;
  onLoadSample: () => void;
  onCreateBlank: () => void;
  onImportBundle: (file: File) => void;
  onRefreshFiles: (projectId?: string) => Promise<void>;
  onProjectSaved: (project: ResearchProject) => Promise<void>;
  onContinue: (message: string) => void;
  onTriggerReviewPanel: () => void;
  onSynthesizeExperiment: (modality?: ExperimentModality) => void;
  onStop: () => void;
  onPreflight: () => Promise<SetupStatus>;
  onSaveConfig: (payload: Record<string, unknown>) => Promise<SetupStatus>;
  onSelectNode: (id: string) => void;
  onJumpToPassage: (paperId: string, quote?: string) => void;
  selectedNodeId?: string;
  highlightedQuote?: string;
  onEvidenceAction: (id: string, action: "confirm" | "unconfirm" | "reject") => void;
  onAddManualEvidence: (paperId: string, quote: string, title?: string, meta?: { sourceField?: "abstract" | "fullText"; page?: number }) => void;
  onAddPaperByDoi: (doi: string) => void;
  onImportReferences: (payload: Record<string, unknown>) => Promise<void>;
  onSearchDirect: (query: string) => Promise<Array<Record<string, unknown>>>;
  onAddSearchedPapers: (papers: Array<Record<string, unknown>>) => Promise<void>;
  onUploadPdf: (file: File, paperId?: string) => Promise<void>;
  onFetchOaPdf: (paperId: string) => Promise<void>;
  onSnowballPaper: (paperId: string, direction: "references" | "citations" | "both") => Promise<void>;
  onPlanningAction: (payload: Record<string, unknown>) => Promise<void>;
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
  onManuscriptAction: (action: "draft" | "audit" | "humanize" | "save" | "ai-refine", manuscript?: ManuscriptDocument, extra?: { sectionId?: string }) => void;
  onExport: () => void;
  busy: boolean;
  error?: string;
  graph?: ReactNode;
  exportPanel?: ReactNode;
}

const NAV_ITEMS: Array<{ id: ViewId; label: string; icon: typeof Microscope }> = [
  { id: "research", label: "Research", icon: Microscope },
  { id: "workspace", label: "Files & Notes", icon: FolderOpen },
  { id: "literature", label: "Literature", icon: BookOpen },
  { id: "experiments", label: "Validation", icon: FlaskConical },
  { id: "graph", label: "Knowledge Graph", icon: Network },
  { id: "manuscript", label: "Manuscript", icon: FileText },
  { id: "published", label: "Published", icon: Package },
];

const TRIAGE_OPTIONS: ContradictionResolution[] = [
  "true-disagreement",
  "different-definitions",
  "different-conditions",
  "unresolved",
];

function formatElapsed(elapsedMs?: number): string {
  if (typeof elapsedMs !== "number" || !Number.isFinite(elapsedMs) || elapsedMs < 0) return "—";
  const sec = Math.floor(elapsedMs / 1000);
  const min = Math.floor(sec / 60);
  return `${min}:${String(sec % 60).padStart(2, "0")}`;
}

function countFlatFiles(entries: WorkspaceFileEntry[]): number {
  let total = 0;
  for (const e of entries) {
    if (e.kind === "file") total += 1;
    if (e.children) total += countFlatFiles(e.children);
  }
  return total;
}

export function ResearchDashboard(props: DashboardProps) {
  const {
    project,
    projects,
    files,
    showHome,
    telemetry,
    streamingDelta,
    activeView,
    onViewChange,
    onGoHome,
    onSelectProject,
    onDeleteProject,
    onStart,
    onLoadSample,
    onCreateBlank,
    onImportBundle,
    onRefreshFiles,
    onProjectSaved,
    onContinue,
    onTriggerReviewPanel,
    onSynthesizeExperiment,
    onStop,
    onPreflight,
    onSaveConfig,
    onSelectNode,
    onJumpToPassage,
    selectedNodeId,
    highlightedQuote,
    onEvidenceAction,
    onAddManualEvidence,
    onAddPaperByDoi,
    onImportReferences,
    onSearchDirect,
    onAddSearchedPapers,
    onUploadPdf,
    onFetchOaPdf,
    onSnowballPaper,
    onPlanningAction,
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

  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("explorer");
  const [inspectorVisible, setInspectorVisible] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteMode, setPaletteMode] = useState<"commands" | "search">("commands");
  const [requestedFilePath, setRequestedFilePath] = useState<string | undefined>();
  const [statsCsvPath, setStatsCsvPath] = useState<string | undefined>();
  const [researchSubTab, setResearchSubTab] = useState<"canvas" | "planning" | "matrix">("canvas");
  const [followUp, setFollowUp] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("ori-theme");
      if (saved === "dark" || saved === "light") {
        setTheme(saved);
        document.documentElement.dataset.theme = saved;
      }
    } catch { /* ignore storage restrictions */ }
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { window.localStorage.setItem("ori-theme", next); } catch { /* ignore */ }
  };

  useEffect(() => {
    if (selectedNodeId) setInspectorVisible(true);
  }, [selectedNodeId]);

  useEffect(() => {
    if (showHome || !project) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setPaletteMode("search");
        setPaletteOpen(true);
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteMode("commands");
        setPaletteOpen(true);
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setSidebarVisible((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showHome, project]);

  const active = telemetry.status === "running" || telemetry.status === "connecting";
  const selectedNode = project?.nodes.find((n) => n.id === selectedNodeId);
  const isLanding = showHome || !project;
  const totalFiles = countFlatFiles(files);
  const diagnostics = computeProjectDiagnostics(project, files);
  const problemCount = diagnostics.filter((d) => d.severity !== "info").length;

  const counts: Record<ViewId, number> = {
    research: project?.uiBlocks.length ?? 0,
    workspace: totalFiles,
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

  const handleOpenFile = (filePath: string) => {
    setRequestedFilePath(filePath);
    onViewChange("workspace");
  };

  const handleCreateNote = async (notePath: string) => {
    if (!project) return;
    await fetch("/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.projectId, action: "write", path: notePath, content: `# ${notePath}\n\n` }),
    });
    await onRefreshFiles(project.projectId);
    handleOpenFile(notePath);
  };

  const handleCreateFolder = async (folderPath: string) => {
    if (!project) return;
    await fetch("/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.projectId, action: "mkdir", path: folderPath }),
    });
    await onRefreshFiles(project.projectId);
  };

  const handleDeleteFile = async (relPath: string) => {
    if (!project) return;
    await fetch("/api/files", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.projectId, path: relPath }),
    });
    await onRefreshFiles(project.projectId);
  };

  const handleSelectDiagnostic = (item: DiagnosticItem) => {
    onViewChange(item.targetView);
    if (item.nodeId) {
      onSelectNode(item.nodeId);
      setInspectorVisible(true);
    }
    if (item.filePath) {
      handleOpenFile(item.filePath);
    }
  };

  const hasTps = typeof telemetry.outputTokens === "number" && telemetry.outputTokens > 0 && typeof telemetry.outputTps === "number";

  const workspaceClass = [
    "ori-workspace",
    sidebarVisible ? "ori-workspace--with-sidebar" : "",
    inspectorVisible ? "" : "ori-workspace--no-inspector",
  ].filter(Boolean).join(" ");

  const toggleRailTool = (tool: SidebarTab) => {
    if (sidebarVisible && sidebarTab === tool) {
      setSidebarVisible(false);
    } else {
      setSidebarTab(tool);
      setSidebarVisible(true);
    }
  };

  return (
    <div className="ori-app">
      <a className="ori-skip-link" href="#ori-main-content">Skip to main content</a>

      {/* Clean 46px Precision Titlebar — Zero top tabs, zero collisions */}
      <header className="ori-topbar">
        <div className="ori-topbar-left">
          <button type="button" className="ori-brand-btn" onClick={onGoHome}>
            <span className="ori-brand-mark" aria-hidden="true"><Microscope size={13} /></span>
            <span>Open Research</span>
          </button>
          {projects.length > 0 ? (
            <>
              <span className="ori-topbar-slash" aria-hidden="true">/</span>
              <select
                aria-label="Switch research project"
                className="ori-project-select"
                value={!isLanding && project ? project.projectId : ""}
                onChange={(e) => { if (e.target.value) onSelectProject(e.target.value); }}
              >
                <option value="" disabled>Projects ({projects.length})</option>
                {projects.map((p) => (
                  <option key={p.projectId} value={p.projectId}>{p.title.slice(0, 48)}</option>
                ))}
              </select>
            </>
          ) : null}
          <button type="button" className="ori-rail-mini-btn" onClick={onGoHome} aria-label="New research" title="New investigation / home">
            <Plus size={14} aria-hidden="true" />
          </button>
        </div>

        <div className="ori-topbar-center">
          {!isLanding && project ? (
            <button
              type="button"
              className="ori-cmd-trigger"
              onClick={() => {
                setPaletteMode("commands");
                setPaletteOpen(true);
              }}
              aria-label="Open command palette (Ctrl+K)"
            >
              <Search size={13} aria-hidden="true" />
              <span>Search papers, files, commands…</span>
              <kbd>⌘K</kbd>
            </button>
          ) : null}
        </div>

        <div className="ori-topbar-right">
          {!isLanding && project && active ? (
            <div className="ori-live-pill">
              <LoaderCircle size={12} className="ori-spin" />
              <span>{formatElapsed(telemetry.elapsedMs)}</span>
              {hasTps ? <span>· {telemetry.outputTps!.toFixed(1)} tps</span> : null}
              <button type="button" className="ori-pill-stop" onClick={onStop} disabled={busy} aria-label="Stop active run">
                <Square size={10} />
              </button>
            </div>
          ) : null}

          {!isLanding && project ? (
            <button
              type="button"
              className={`ori-btn ori-btn--ghost ori-btn--sm${inspectorVisible ? " ori-btn--tinted" : ""}`}
              onClick={() => setInspectorVisible((v) => !v)}
              aria-expanded={inspectorVisible}
              aria-label="Toggle inspector"
              title="Toggle Node Inspector"
            >
              <PanelRight size={14} />
              <span className="ori-hide-mobile">Inspector</span>
            </button>
          ) : null}

          <button
            type="button"
            className="ori-rail-mini-btn"
            onClick={toggleTheme}
            aria-label="Toggle color theme"
            title={theme === "light" ? "Switch to Obsidian Dark theme" : "Switch to Precision Light theme"}
          >
            {theme === "light" ? <Moon size={14} aria-hidden="true" /> : <Sun size={14} aria-hidden="true" />}
          </button>

          <SetupModal onPreflight={onPreflight} onSaveConfig={onSaveConfig} />

          {!isLanding && project ? (
            <button type="button" className="ori-btn ori-btn--primary ori-btn--sm" onClick={onExport} disabled={busy}>
              <Download size={13} aria-hidden="true" />
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
          onLoadSample={onLoadSample}
          onCreateBlank={onCreateBlank}
          onImportBundle={onImportBundle}
          onSelectProject={onSelectProject}
          onDeleteProject={onDeleteProject}
        />
      ) : (
        <>
          <div className={workspaceClass}>
            {/* Unified Left Activity Rail (Single Source of Navigation Truth) */}
            <nav className="ori-rail" aria-label="Research views">
              <div className="ori-rail-group">
                {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
                  const isActive = activeView === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`ori-rail-btn${isActive ? " ori-rail-btn--active" : ""}`}
                      onClick={() => onViewChange(id)}
                      aria-label={`${label} (${counts[id]})`}
                      aria-current={isActive ? "page" : undefined}
                      title={`${label} (${counts[id]})`}
                    >
                      <Icon size={17} strokeWidth={isActive ? 2 : 1.75} aria-hidden="true" />
                      <span className="ori-rail-mobile-label">{label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="ori-rail-bottom ori-hide-mobile">
                <button
                  type="button"
                  className={`ori-rail-btn${sidebarVisible && sidebarTab === "explorer" ? " ori-rail-btn--tool-active" : ""}`}
                  onClick={() => toggleRailTool("explorer")}
                  aria-label="Workspace Files Explorer"
                  title="Explorer (Ctrl+B)"
                >
                  <FolderTree size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={`ori-rail-btn${sidebarVisible && sidebarTab === "search" ? " ori-rail-btn--tool-active" : ""}`}
                  onClick={() => toggleRailTool("search")}
                  aria-label="Workspace Search"
                  title="Search (Ctrl+Shift+F)"
                >
                  <Search size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={`ori-rail-btn${sidebarVisible && sidebarTab === "problems" ? " ori-rail-btn--tool-active" : ""}`}
                  onClick={() => toggleRailTool("problems")}
                  aria-label={`Problems (${problemCount})`}
                  title={`Problems (${problemCount})`}
                >
                  <AlertTriangle size={16} aria-hidden="true" />
                  {problemCount > 0 ? <span className="ori-rail-badge">{problemCount}</span> : null}
                </button>
                <button
                  type="button"
                  className={`ori-rail-btn${sidebarVisible && sidebarTab === "history" ? " ori-rail-btn--tool-active" : ""}`}
                  onClick={() => toggleRailTool("history")}
                  aria-label="Revision History"
                  title="Revision History"
                >
                  <Clock size={16} aria-hidden="true" />
                </button>
              </div>
            </nav>

            {sidebarVisible ? (
              <WorkspaceSidebar
                project={project}
                files={files}
                activeFilePath={requestedFilePath}
                tab={sidebarTab}
                onClose={() => setSidebarVisible(false)}
                onOpenFile={handleOpenFile}
                onCreateNote={(p) => void handleCreateNote(p)}
                onCreateFolder={(p) => void handleCreateFolder(p)}
                onDeleteFile={(p) => void handleDeleteFile(p)}
                onSelectDiagnostic={handleSelectDiagnostic}
                onSelectNode={(nodeId, view) => {
                  onSelectNode(nodeId);
                  setInspectorVisible(true);
                  if (view) onViewChange(view);
                }}
              />
            ) : null}

            <main id="ori-main-content" className="ori-canvas" tabIndex={-1}>
              <div className="ori-canvas-scroll">
                <div className={`ori-canvas-body${activeView === "graph" || activeView === "workspace" || activeView === "manuscript" ? " ori-canvas-body--wide" : ""}`}>
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
                    <>
                      <header className="ori-doc-header">
                        <div className="ori-doc-header-top">
                          <div>
                            <h1 className="ori-doc-title">{project.title}</h1>
                            <div className="ori-doc-meta">
                              <MonoMeta>r{project.revision}</MonoMeta>
                              <span aria-hidden="true">·</span>
                              <span>{project.mode === "autonomous" ? "Autonomous" : "Guided"}</span>
                              <span aria-hidden="true">·</span>
                              <StatusBadge tone={project.status === "error" ? "danger" : project.status === "investigating" ? "accent" : "ok"}>
                                {project.status}
                              </StatusBadge>
                            </div>
                          </div>

                          <div className="ori-segmented" role="tablist" aria-label="Research view panels">
                            <button
                              type="button"
                              role="tab"
                              aria-selected={researchSubTab === "canvas"}
                              className={`ori-seg-btn${researchSubTab === "canvas" ? " ori-seg-btn--active" : ""}`}
                              onClick={() => setResearchSubTab("canvas")}
                            >
                              Canvas
                            </button>
                            <button
                              type="button"
                              role="tab"
                              aria-selected={researchSubTab === "planning"}
                              className={`ori-seg-btn${researchSubTab === "planning" ? " ori-seg-btn--active" : ""}`}
                              onClick={() => setResearchSubTab("planning")}
                            >
                              Ideation &amp; Tasks ({(project.ideas?.length ?? 0) + (project.tasks?.length ?? 0)})
                            </button>
                            <button
                              type="button"
                              role="tab"
                              aria-selected={researchSubTab === "matrix"}
                              className={`ori-seg-btn${researchSubTab === "matrix" ? " ori-seg-btn--active" : ""}`}
                              onClick={() => setResearchSubTab("matrix")}
                            >
                              Hypotheses ({project.nodes.filter((n) => n.type === "hypothesis").length})
                            </button>
                          </div>
                        </div>
                      </header>

                      {researchSubTab === "canvas" ? (
                        <ResearchCanvasView
                          project={project}
                          busy={busy}
                          onSelectNode={(id) => { onSelectNode(id); setInspectorVisible(true); }}
                          onJumpToPassage={(paperId, quote) => { onJumpToPassage(paperId, quote); setInspectorVisible(true); }}
                          onEvidenceAction={onEvidenceAction}
                          onUpdateNode={onUpdateNode}
                          onTriggerReviewPanel={onTriggerReviewPanel}
                          onGoToValidation={() => onViewChange("experiments")}
                        />
                      ) : researchSubTab === "planning" ? (
                        <IdeationAndTasksPanel project={project} busy={busy} onPlanningAction={onPlanningAction} />
                      ) : (
                        <CompetingHypothesesPanel
                          project={project}
                          busy={busy}
                          onPlanningAction={onPlanningAction}
                          onSelectNode={(id) => { onSelectNode(id); setInspectorVisible(true); }}
                        />
                      )}
                    </>
                  ) : null}

                  {activeView === "workspace" ? (
                    <FilesWorkspace
                      project={project}
                      files={files}
                      requestedFilePath={requestedFilePath}
                      busy={busy}
                      onRefreshFiles={async () => { await onRefreshFiles(project.projectId); }}
                      onSelectNode={(id) => { onSelectNode(id); setInspectorVisible(true); }}
                      onOpenInStats={(csvPath) => {
                        setStatsCsvPath(csvPath);
                        onViewChange("experiments");
                      }}
                    />
                  ) : null}

                  {activeView === "literature" ? (
                    <>
                      <SourceBanner project={project} />
                      <LiteratureWorkspace
                        project={project}
                        busy={busy}
                        onSelectNode={(id) => { onSelectNode(id); setInspectorVisible(true); }}
                        onAddPaperByDoi={onAddPaperByDoi}
                        onUpdateNode={onUpdateNode}
                        onAddManualEvidence={onAddManualEvidence}
                        onImportReferences={onImportReferences}
                        onSearchDirect={onSearchDirect}
                        onAddSearchedPapers={onAddSearchedPapers}
                        onUploadPdf={onUploadPdf}
                        onFetchOaPdf={onFetchOaPdf}
                        onSnowballPaper={onSnowballPaper}
                      />
                    </>
                  ) : null}

                  {activeView === "experiments" ? (
                    <TestingWorkspace
                      project={project}
                      files={files}
                      initialCsvPath={statsCsvPath}
                      busy={busy}
                      onSelectNode={(id) => { onSelectNode(id); setInspectorVisible(true); }}
                      onSynthesizeExperiment={(modality) => onSynthesizeExperiment(modality)}
                      onRunCode={onRunCode}
                      onDownloadValidation={onDownloadValidation}
                      onDiscoverLabs={onDiscoverLabs}
                      onUpdateLab={onUpdateLab}
                      onImportResult={onImportResult}
                      onProjectSaved={onProjectSaved}
                    />
                  ) : null}

                  {activeView === "graph" ? graph : null}

                  {activeView === "manuscript" ? (
                    <ManuscriptStudio
                      project={project}
                      busy={busy}
                      onAction={onManuscriptAction}
                      onSelectNode={(id) => { onSelectNode(id); setInspectorVisible(true); }}
                    />
                  ) : null}

                  {activeView === "published" ? exportPanel : null}
                </div>
              </div>

              {/* Floating Linear-Style Follow-up Composer Pill */}
              {activeView === "research" && researchSubTab === "canvas" ? (
                <div className="ori-composer-dock">
                  <form className="ori-composer-pill" onSubmit={handleFollowUp}>
                    <div className="ori-composer-row">
                      <label htmlFor="ori-followup-input" className="ori-visually-hidden">Follow-up question or pushback</label>
                      <input
                        id="ori-followup-input"
                        className="ori-composer-clean-input"
                        placeholder="Ask a follow-up, push back on a paper, or pivot the search..."
                        value={followUp}
                        onChange={(e) => setFollowUp(e.target.value)}
                        disabled={busy || active}
                      />
                      <button type="submit" className="ori-btn ori-btn--primary ori-btn--sm" disabled={busy || active || followUp.trim().length < 3}>
                        <Send size={13} /> Send
                      </button>
                    </div>
                    <div className="ori-composer-shortcuts">
                      <button type="button" className="ori-pill-action" disabled={busy || active} onClick={onTriggerReviewPanel}>
                        <ShieldCheck size={12} /> Run Independent Review Panel
                      </button>
                      <button type="button" className="ori-pill-action" disabled={busy || active} onClick={() => onSynthesizeExperiment()}>
                        <FlaskConical size={12} /> Design Validation Experiment
                      </button>
                      <button type="button" className="ori-pill-action" disabled={busy || active} onClick={() => onViewChange("manuscript")}>
                        <FileText size={12} /> Draft Manuscript
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
                  highlightedQuote={highlightedQuote}
                  busy={busy}
                  onClose={() => setInspectorVisible(false)}
                  onSelectNode={onSelectNode}
                  onJumpToPassage={onJumpToPassage}
                  onEvidenceAction={onEvidenceAction}
                  onAddManualEvidence={onAddManualEvidence}
                  onUpdateNode={onUpdateNode}
                  onDeleteNode={onDeleteNode}
                />
              </aside>
            ) : null}
          </div>

          <CommandPalette
            open={paletteOpen}
            initialMode={paletteMode}
            project={project}
            files={files}
            onClose={() => setPaletteOpen(false)}
            onSwitchView={onViewChange}
            onOpenFile={handleOpenFile}
            onSelectNode={(nodeId, view) => {
              onSelectNode(nodeId);
              setInspectorVisible(true);
              if (view) onViewChange(view);
            }}
            onCreateNewNote={() => void handleCreateNote(`notes/note-${Date.now().toString().slice(-4)}.md`)}
            onExport={onExport}
            onToggleSidebar={() => setSidebarVisible((v) => !v)}
            onTriggerReview={onTriggerReviewPanel}
          />
        </>
      )}

      {!isLanding && project ? (
        <div className="ori-statusbar" role="contentinfo">
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <MonoMeta>Revision r{project.revision}</MonoMeta>
            <button
              type="button"
              className="ori-text-link"
              style={{ fontSize: 12 }}
              onClick={() => {
                setSidebarVisible(true);
                setSidebarTab("problems");
              }}
            >
              <AlertTriangle size={12} /> {problemCount} {problemCount === 1 ? "Problem" : "Problems"}
            </button>
            <MonoMeta>{totalFiles} workspace files</MonoMeta>
          </div>
          <MonoMeta>SHA-256 anchored · Citation.js · CodeMirror + KaTeX · RO-Crate 1.1</MonoMeta>
        </div>
      ) : (
        <footer className="ori-footer">
          <div className="ori-footer-inner">
            <span>Open Research IDE · Open-source (MIT), local-first, Google Gemini &amp; Gemma scientific workspace.</span>
            <MonoMeta>Exact abstract SHA-256 anchoring · Zero-memory review panel · RO-Crate 1.1 reproducible bundles</MonoMeta>
          </div>
        </footer>
      )}
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

function HighlightedSnippet({ abstract, quote }: { abstract?: string; quote?: string }) {
  const snippet = abstractSnippet(abstract, quote, 120);
  if (snippet) {
    return (
      <p className="ori-contradiction-quote">
        {snippet.truncatedStart ? "…" : ""}
        {snippet.before}
        <mark className="ori-abstract-mark">{snippet.match}</mark>
        {snippet.after}
        {snippet.truncatedEnd ? "…" : ""}
      </p>
    );
  }
  if (quote) {
    return <p className="ori-contradiction-quote">&ldquo;{quote}&rdquo;</p>;
  }
  if (abstract) {
    return <p className="ori-contradiction-quote">{abstract.slice(0, 220)}{abstract.length > 220 ? "…" : ""}</p>;
  }
  return null;
}

function ResearchCanvasView({
  project,
  busy,
  onSelectNode,
  onJumpToPassage,
  onEvidenceAction,
  onUpdateNode,
  onTriggerReviewPanel,
  onGoToValidation,
}: {
  project: ResearchProject;
  busy: boolean;
  onSelectNode: (id: string) => void;
  onJumpToPassage: (paperId: string, quote?: string) => void;
  onEvidenceAction: (id: string, action: "confirm" | "unconfirm" | "reject") => void;
  onUpdateNode: (nodeId: string, patch: { title?: string; data?: Record<string, unknown> }) => void;
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
      <section className="ori-stage-inline" aria-label="Investigation stages">
        {steps.map((step) => (
          <div key={step.label} className={`ori-stage-pill${step.complete ? " ori-stage-pill--complete" : ""}`}>
            <span className="ori-stage-dot">{step.complete ? <Check size={10} /> : null}</span>
            <strong>{step.label}</strong>
            <MonoMeta>{step.detail}</MonoMeta>
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
                      if (node.type === "contradiction") {
                        const sides = resolveContradictionSides(project, node);
                        const resolution = (node.data.resolution as ContradictionResolution) || "unresolved";
                        const resMeta = CONTRADICTION_RESOLUTION_LABELS[resolution] ?? CONTRADICTION_RESOLUTION_LABELS.unresolved;
                        return (
                          <div key={node.id} className="ori-evidence-entry ori-evidence-entry--contradiction">
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                              <button type="button" className="ori-text-link" style={{ fontWeight: 600 }} onClick={() => onSelectNode(node.id)}>
                                {node.title}
                              </button>
                              <StatusBadge tone={resMeta.tone}>{resMeta.label}</StatusBadge>
                            </div>
                            {typeof node.data.description === "string" ? (
                              <p style={{ fontSize: 13.5, color: "var(--text-secondary)" }}>{node.data.description}</p>
                            ) : null}
                            {sides.length > 0 ? (
                              <div className="ori-contradiction-grid">
                                {sides.map((side) => (
                                  <div key={side.key} className="ori-contradiction-side">
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                      <MonoMeta>{side.sideLabel}</MonoMeta>
                                      {side.paper?.data.year ? <MonoMeta>{side.paper.data.year}</MonoMeta> : null}
                                    </div>
                                    {side.paper ? (
                                      <strong style={{ fontSize: 13, color: "var(--text-primary)" }}>{side.paper.title}</strong>
                                    ) : null}
                                    <HighlightedSnippet abstract={side.abstract} quote={side.quote} />
                                    {side.definitionNote ? (
                                      <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>{side.definitionNote}</p>
                                    ) : null}
                                    {side.paper ? (
                                      <button
                                        type="button"
                                        className="ori-text-link"
                                        style={{ fontSize: 12, alignSelf: "flex-start" }}
                                        onClick={() => onJumpToPassage(side.paper!.id, side.quote)}
                                      >
                                        Jump to passage in paper <ArrowUpRight size={12} />
                                      </button>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            <div className="ori-triage-row" role="group" aria-label="Classify contradiction">
                              <MonoMeta>Triage:</MonoMeta>
                              {TRIAGE_OPTIONS.map((option) => (
                                <button
                                  key={option}
                                  type="button"
                                  disabled={busy}
                                  className={`ori-chip-btn${resolution === option ? " ori-chip-btn--active" : ""}`}
                                  onClick={() => onUpdateNode(node.id, { data: { resolution: option } })}
                                >
                                  {CONTRADICTION_RESOLUTION_LABELS[option].shortLabel}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      }

                      const sourcePaper = node.data.paperId ? paperMap.get(node.data.paperId) : undefined;
                      const rejected = node.data.verificationStatus === "rejected";
                      const entryCls = node.data.verified ? "ori-evidence-entry ori-evidence-entry--verified" : "ori-evidence-entry";
                      return (
                        <div key={node.id} className={entryCls}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <button type="button" className="ori-text-link" style={{ fontWeight: 600 }} onClick={() => onSelectNode(node.id)}>
                              {node.title}
                            </button>
                            <StatusBadge tone={rejected ? "danger" : node.data.verified ? "ok" : "warn"}>
                              {rejected ? "Rejected" : node.data.verified ? "Confirmed" : "Unverified"}
                            </StatusBadge>
                          </div>
                          {node.data.quote ? <blockquote>&ldquo;{node.data.quote}&rdquo;</blockquote> : null}
                          <div className="ori-evidence-actions">
                            {sourcePaper ? (
                              <button
                                type="button"
                                className="ori-text-link"
                                style={{ fontSize: 12 }}
                                onClick={() => onJumpToPassage(sourcePaper.id, node.data.quote)}
                              >
                                Jump to passage: {sourcePaper.title} <ArrowUpRight size={12} />
                              </button>
                            ) : null}
                            {!node.data.verified ? (
                              <button type="button" className="ori-btn ori-btn--primary ori-btn--sm" disabled={busy} onClick={() => onEvidenceAction(node.id, "confirm")}>
                                <ClipboardCheck size={13} /> Confirm evidence
                              </button>
                            ) : null}
                            {node.data.verified ? (
                              <button type="button" className="ori-btn ori-btn--secondary ori-btn--sm" disabled={busy} onClick={() => onEvidenceAction(node.id, "unconfirm")}>
                                Unconfirm
                              </button>
                            ) : null}
                            {!rejected ? (
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
  highlightedQuote,
  busy,
  onClose,
  onSelectNode,
  onJumpToPassage,
  onEvidenceAction,
  onAddManualEvidence,
  onUpdateNode,
  onDeleteNode,
}: {
  project: ResearchProject;
  node?: ResearchNode;
  highlightedQuote?: string;
  busy: boolean;
  onClose: () => void;
  onSelectNode: (id: string) => void;
  onJumpToPassage: (paperId: string, quote?: string) => void;
  onEvidenceAction: (id: string, action: "confirm" | "unconfirm" | "reject") => void;
  onAddManualEvidence: (paperId: string, quote: string, title?: string) => void;
  onUpdateNode: (nodeId: string, patch: { title?: string; data?: Record<string, unknown> }) => void;
  onDeleteNode: (nodeId: string) => void;
}) {
  const [quoteText, setQuoteText] = useState("");
  const [quoteTitle, setQuoteTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const markRef = useRef<HTMLElement>(null);
  const compareDialogRef = useRef<HTMLDialogElement>(null);

  const paperAbstract = node?.type === "paper" && typeof node.data.abstract === "string" ? node.data.abstract : undefined;
  const fallbackPaperQuote = node?.type === "paper"
    ? project.nodes.find((n) => n.type === "evidence" && n.data.paperId === node.id && typeof n.data.quote === "string")?.data.quote
    : undefined;
  const activePaperQuote = highlightedQuote && splitAbstractAroundQuote(paperAbstract, highlightedQuote)
    ? highlightedQuote
    : fallbackPaperQuote;
  const highlightedAbstractSplit = splitAbstractAroundQuote(paperAbstract, activePaperQuote);

  useEffect(() => {
    if (node?.type === "paper" && markRef.current) {
      markRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [node?.id, node?.type, activePaperQuote]);

  if (!node) {
    const papers = project.nodes.filter((n) => n.type === "paper").length;
    const evTotal = project.nodes.filter((n) => n.type === "evidence").length;
    const evConfirmed = project.nodes.filter((n) => n.type === "evidence" && n.data.verified === true).length;
    const reviews = project.nodes.filter((n) => n.type === "review").length;
    const experiments = project.nodes.filter((n) => n.type === "experiment").length;
    return (
      <div className="ori-inspector-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ fontSize: 13.5 }}>Investigation Inspector</strong>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <MonoMeta>r{project.revision}</MonoMeta>
            <button type="button" className="ori-rail-mini-btn" onClick={onClose} aria-label="Close inspector">
              <X size={14} />
            </button>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Click any paper, contradiction, quote, hypothesis, review, or experiment to compare passages, check SHA-256 provenance, or verify claims.
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

  const contradictionSides = node.type === "contradiction" ? resolveContradictionSides(project, node) : [];
  const contradictionResolution = (node.data.resolution as ContradictionResolution) || "unresolved";
  const contradictionMeta = CONTRADICTION_RESOLUTION_LABELS[contradictionResolution] ?? CONTRADICTION_RESOLUTION_LABELS.unresolved;

  return (
    <>
      <div className="ori-inspector-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <StatusBadge tone="accent">{NODE_LABELS[node.type]}</StatusBadge>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <MonoMeta>r{project.revision}</MonoMeta>
            <button type="button" className="ori-rail-mini-btn" onClick={onClose} aria-label="Close inspector">
              <X size={14} />
            </button>
          </div>
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

      {node.type === "contradiction" ? (
        <div className="ori-inspector-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 13 }}>Compare Both Passages</strong>
            <StatusBadge tone={contradictionMeta.tone}>{contradictionMeta.shortLabel}</StatusBadge>
          </div>
          {typeof node.data.description === "string" ? (
            <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{node.data.description}</p>
          ) : null}
          {contradictionSides.length > 0 ? (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {contradictionSides.map((side) => (
                  <div key={side.key} className="ori-contradiction-side">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                      <MonoMeta>{side.sideLabel}</MonoMeta>
                      {side.paper?.data.year ? <MonoMeta>{side.paper.data.year}</MonoMeta> : null}
                    </div>
                    {side.paper ? <strong style={{ fontSize: 12.5 }}>{side.paper.title}</strong> : null}
                    <HighlightedSnippet abstract={side.abstract} quote={side.quote} />
                    {side.definitionNote ? (
                      <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>{side.definitionNote}</p>
                    ) : null}
                    {side.paper ? (
                      <button
                        type="button"
                        className="ori-btn ori-btn--secondary ori-btn--sm"
                        onClick={() => onJumpToPassage(side.paper!.id, side.quote)}
                      >
                        Jump to passage <ArrowUpRight size={12} />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="ori-btn ori-btn--secondary ori-btn--sm"
                onClick={() => compareDialogRef.current?.showModal()}
              >
                <Columns2 size={13} /> Wide Side-by-Side View
              </button>
            </>
          ) : (
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              No linked study passages recorded yet. Check Semantic Links below.
            </p>
          )}
          <div className="ori-triage-row" role="group" aria-label="Triage contradiction">
            {TRIAGE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                disabled={busy}
                className={`ori-chip-btn${contradictionResolution === option ? " ori-chip-btn--active" : ""}`}
                onClick={() => onUpdateNode(node.id, { data: { resolution: option } })}
              >
                {CONTRADICTION_RESOLUTION_LABELS[option].shortLabel}
              </button>
            ))}
          </div>

          <dialog ref={compareDialogRef} className="ori-dialog ori-dialog--wide" aria-label="Side-by-side contradiction comparison">
            <div className="ori-dialog-head">
              <div>
                <h2>{node.title}</h2>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                  Inspect both exact passages inside their full immutable abstracts to check definitions and conditions.
                </p>
              </div>
              <button type="button" className="ori-icon-btn" onClick={() => compareDialogRef.current?.close()} aria-label="Close comparison">
                <X size={16} />
              </button>
            </div>
            <div className="ori-dialog-body">
              <div className="ori-contradiction-grid">
                {contradictionSides.map((side) => {
                  const fullSplit = splitAbstractAroundQuote(side.abstract, side.quote);
                  return (
                    <div key={side.key} className="ori-contradiction-side">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <MonoMeta>{side.sideLabel}</MonoMeta>
                        {side.paper?.data.venue ? <MonoMeta>{side.paper.data.venue}</MonoMeta> : null}
                      </div>
                      {side.paper ? <strong style={{ fontSize: 15 }}>{side.paper.title}</strong> : null}
                      {fullSplit ? (
                        <p className="ori-contradiction-quote">
                          {fullSplit.before}
                          <mark className="ori-abstract-mark">{fullSplit.match}</mark>
                          {fullSplit.after}
                        </p>
                      ) : side.abstract ? (
                        <p className="ori-contradiction-quote">{side.abstract}</p>
                      ) : side.quote ? (
                        <p className="ori-contradiction-quote">&ldquo;{side.quote}&rdquo;</p>
                      ) : null}
                      {side.definitionNote ? (
                        <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}><strong>Protocol / definition:</strong> {side.definitionNote}</p>
                      ) : null}
                      {side.paper ? (
                        <button
                          type="button"
                          className="ori-btn ori-btn--secondary ori-btn--sm"
                          onClick={() => {
                            compareDialogRef.current?.close();
                            onJumpToPassage(side.paper!.id, side.quote);
                          }}
                        >
                          Jump to paper in inspector <ArrowUpRight size={12} />
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="ori-dialog-foot">
              <div className="ori-triage-row">
                <MonoMeta>Classification:</MonoMeta>
                {TRIAGE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    disabled={busy}
                    className={`ori-chip-btn${contradictionResolution === option ? " ori-chip-btn--active" : ""}`}
                    onClick={() => onUpdateNode(node.id, { data: { resolution: option } })}
                  >
                    {CONTRADICTION_RESOLUTION_LABELS[option].shortLabel}
                  </button>
                ))}
              </div>
              <button type="button" className="ori-btn ori-btn--primary ori-btn--sm" onClick={() => compareDialogRef.current?.close()}>Done</button>
            </div>
          </dialog>
        </div>
      ) : null}

      {node.type === "evidence" ? (
        <div className="ori-inspector-card">
          <strong style={{ fontSize: 13 }}>
            {node.data.verified ? "Human-confirmed evidence" : node.data.verificationStatus === "rejected" ? "Rejected evidence" : "Unverified evidence"}
          </strong>
          <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            SHA-256 verified against the immutable abstract snapshot.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {typeof node.data.paperId === "string" ? (
              <button
                type="button"
                className="ori-btn ori-btn--secondary ori-btn--sm"
                onClick={() => onJumpToPassage(node.data.paperId!, node.data.quote)}
              >
                Jump to passage <ArrowUpRight size={12} />
              </button>
            ) : null}
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

      {node.type === "paper" && paperAbstract && paperAbstract.trim() ? (
        <div className="ori-inspector-card">
          <strong style={{ fontSize: 13 }}>Immutable Abstract &amp; Evidence Anchoring</strong>
          <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {highlightedAbstractSplit
              ? "Highlighted passage shown below. Select any text to anchor a new verified quote."
              : "Select text inside the immutable abstract below to anchor a human-verified passage."}
          </p>
          <div
            onMouseUp={captureAbstractSelection}
            style={{ padding: 12, borderRadius: 10, background: "var(--bg-subtle)", fontSize: 13, lineHeight: 1.55, maxHeight: 220, overflowY: "auto" }}
          >
            {highlightedAbstractSplit ? (
              <>
                {highlightedAbstractSplit.before}
                <mark ref={markRef} className="ori-abstract-mark">{highlightedAbstractSplit.match}</mark>
                {highlightedAbstractSplit.after}
              </>
            ) : (
              paperAbstract
            )}
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
          {Object.entries(node.data)
            .filter(([k, v]) => v !== undefined && v !== null && v !== "" && k !== "pages")
            .map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>
                  {k === "fullText" && typeof v === "string"
                    ? `${v.slice(0, 320)}… (${v.length} chars)`
                    : typeof v === "object"
                      ? <pre>{JSON.stringify(v, null, 2)}</pre>
                      : String(v)}
                </dd>
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
