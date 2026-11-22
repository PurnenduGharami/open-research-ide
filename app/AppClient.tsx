"use client";

import { useCallback, useEffect, useState } from "react";
import { ExportPanel, KnowledgeGraph } from "../components";
import { ResearchDashboard } from "../dashboard/ResearchDashboard";
import type {
  ExperimentModality,
  InvestigationMode,
  ManuscriptDocument,
  MetricObservation,
  ResearchProject,
  ResearchProjectSummary,
  RunTelemetry,
  SetupStatus,
  StreamEvent,
  ViewId,
} from "../packages/contracts";

const idleTelemetry: RunTelemetry = { status: "idle", outputTpsLabel: "run-average output TPS" };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload as T;
}

export default function AppClient({
  initialProject,
  initialProjects,
}: {
  initialProject: ResearchProject | null;
  initialProjects: ResearchProjectSummary[];
}) {
  const [project, setProject] = useState<ResearchProject | null>(initialProject);
  const [projects, setProjects] = useState<ResearchProjectSummary[]>(initialProjects);
  const [showHome, setShowHome] = useState<boolean>(!initialProject);
  const [activeView, setActiveView] = useState<ViewId>("research");
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [telemetry, setTelemetry] = useState<RunTelemetry>(idleTelemetry);
  const [streamingDelta, setStreamingDelta] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [announcement, setAnnouncement] = useState("");

  const activeProjectId = project?.projectId;

  const refresh = useCallback(async (projectId?: string) => {
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    const payload = await api<{
      project: ResearchProject | null;
      projects: ResearchProjectSummary[];
      runs: RunTelemetry[];
    }>(`/api/project${query}`);
    setProject(payload.project);
    setProjects(payload.projects || []);
    const matchingRun = payload.runs?.find((r) => !payload.project || r.projectId === payload.project.projectId);
    if (matchingRun) setTelemetry(matchingRun);
  }, []);

  useEffect(() => {
    const query = activeProjectId ? `?projectId=${encodeURIComponent(activeProjectId)}` : "";
    const events = new EventSource(`/api/events${query}`);
    events.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as StreamEvent & { runs?: RunTelemetry[] };
        if (event.project !== undefined && event.project !== null) {
          setProject(event.project);
        }
        if (event.type === "delta" && event.delta) {
          setStreamingDelta((prev) => `${prev}${event.delta}`.slice(-8000));
        }
        if (event.type === "stage" && event.stage) {
          setTelemetry((current) => ({ ...current, stage: event.stage }));
        }
        if (event.telemetry) {
          setTelemetry(event.telemetry);
        } else if (event.runs?.[0]) {
          setTelemetry(event.runs[0]);
        } else if (event.type === "run") {
          setTelemetry((current) => ({
            ...current,
            status: event.status === "running" ? "running" : event.status === "error" ? "error" : "completed",
            runId: event.runId,
            ...(event.stage ? { stage: event.stage } : {}),
          }));
        }
        if (event.type === "run" && (event.status === "completed" || event.status === "error")) {
          setStreamingDelta("");
          void refresh(event.projectId || activeProjectId);
        }
        if (event.type === "error" && event.message) setError(event.message);
        if (event.type === "run" && event.status) setAnnouncement(`Research run ${event.status}`);
      } catch {
        setError("A live update could not be read. Refresh to resynchronize.");
      }
    };
    return () => events.close();
  }, [activeProjectId, refresh]);

  useEffect(() => {
    if (telemetry.status !== "running" || !telemetry.startedAt) return;
    const tick = () => setTelemetry((current) => ({
      ...current,
      elapsedMs: Math.max(0, Date.now() - new Date(current.startedAt || Date.now()).getTime()),
    }));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [telemetry.status, telemetry.startedAt]);

  const runAction = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }, []);

  const onStart = (curiosity: string, mode: InvestigationMode) => runAction(async () => {
    setStreamingDelta("");
    const started = await api<{ projectId: string; sessionKey: string; runId: string }>("/api/investigation", {
      method: "POST",
      body: JSON.stringify({ curiosity, mode }),
    });
    setShowHome(false);
    setActiveView("research");
    setTelemetry({ status: "connecting", projectId: started.projectId, runId: started.runId, stage: "Connecting to research runtime", startedAt: new Date().toISOString(), outputTpsLabel: "run-average output TPS" });
    await refresh(started.projectId);
  });

  const onContinue = (message: string) => runAction(async () => {
    if (!project) return;
    setStreamingDelta("");
    const started = await api<{ projectId: string; runId: string }>("/api/investigation/continue", {
      method: "POST",
      body: JSON.stringify({ projectId: project.projectId, message }),
    });
    setTelemetry({ status: "connecting", projectId: project.projectId, runId: started.runId, stage: "Continuing research dialogue", startedAt: new Date().toISOString(), outputTpsLabel: "run-average output TPS" });
  });

  const onTriggerReviewPanel = () => runAction(async () => {
    if (!project) return;
    setStreamingDelta("");
    const started = await api<{ runId: string }>("/api/investigation/review", {
      method: "POST",
      body: JSON.stringify({ projectId: project.projectId }),
    });
    setTelemetry({ status: "running", projectId: project.projectId, runId: started.runId, stage: "Running Independent Review Panel", startedAt: new Date().toISOString(), outputTpsLabel: "run-average output TPS" });
  });

  const onSynthesizeExperiment = (modality?: ExperimentModality) => runAction(async () => {
    if (!project) return;
    setStreamingDelta("");
    const started = await api<{ runId: string }>("/api/investigation/experiment", {
      method: "POST",
      body: JSON.stringify({ projectId: project.projectId, modality }),
    });
    setActiveView("experiments");
    setTelemetry({ status: "running", projectId: project.projectId, runId: started.runId, stage: "Synthesizing validation protocol", startedAt: new Date().toISOString(), outputTpsLabel: "run-average output TPS" });
  });

  const onStop = () => runAction(async () => {
    if (!project?.sessionKey) throw new Error("No active research session");
    await api("/api/investigation/stop", { method: "POST", body: JSON.stringify({ sessionKey: project.sessionKey, runId: telemetry.runId }) });
    await refresh(project.projectId);
  });

  const onSelectProject = (projectId: string) => runAction(async () => {
    const res = await api<{ project: ResearchProject; projects: ResearchProjectSummary[] }>("/api/project", {
      method: "POST",
      body: JSON.stringify({ action: "switch", projectId }),
    });
    setProject(res.project);
    setProjects(res.projects);
    setShowHome(false);
    setSelectedNodeId(undefined);
    setStreamingDelta("");
    setTelemetry(idleTelemetry);
  });

  const onDeleteProject = (projectId: string) => runAction(async () => {
    const res = await api<{ project: ResearchProject | null; projects: ResearchProjectSummary[] }>("/api/project", {
      method: "POST",
      body: JSON.stringify({ action: "delete", projectId }),
    });
    setProject(res.project);
    setProjects(res.projects);
    if (!res.project) setShowHome(true);
  });

  const onEvidenceAction = (nodeId: string, action: "confirm" | "unconfirm" | "reject") => runAction(async () => {
    const payload = await api<{ project: ResearchProject }>("/api/evidence/confirm", {
      method: "POST",
      body: JSON.stringify({ projectId: project?.projectId, nodeId, action }),
    });
    setProject(payload.project);
    setAnnouncement(`Evidence ${action}ed`);
  });

  const onAddManualEvidence = (paperId: string, quote: string, title?: string) => runAction(async () => {
    const payload = await api<{ project: ResearchProject; nodeId: string }>("/api/evidence/add", {
      method: "POST",
      body: JSON.stringify({ projectId: project?.projectId, paperId, quote, title }),
    });
    setProject(payload.project);
    setSelectedNodeId(payload.nodeId);
    setAnnouncement("Manual abstract evidence anchored and confirmed");
  });

  const onAddPaperByDoi = (doi: string) => runAction(async () => {
    const payload = await api<{ project: ResearchProject }>("/api/papers/add", {
      method: "POST",
      body: JSON.stringify({ projectId: project?.projectId, doi }),
    });
    setProject(payload.project);
    setAnnouncement("Paper added by DOI");
  });

  const onUpdateNode = (nodeId: string, patch: { title?: string; data?: Record<string, unknown> }) => runAction(async () => {
    const payload = await api<{ project: ResearchProject }>("/api/nodes", {
      method: "PATCH",
      body: JSON.stringify({ projectId: project?.projectId, nodeId, ...patch }),
    });
    setProject(payload.project);
  });

  const onDeleteNode = (nodeId: string) => runAction(async () => {
    const payload = await api<{ project: ResearchProject }>("/api/nodes", {
      method: "DELETE",
      body: JSON.stringify({ projectId: project?.projectId, nodeId }),
    });
    setProject(payload.project);
    setSelectedNodeId(undefined);
  });

  const onRunCode = (experimentId: string, code: string) => runAction(async () => {
    const payload = await api<{ project: ResearchProject }>("/api/validation", {
      method: "POST",
      body: JSON.stringify({ projectId: project?.projectId, experimentId, action: "run-code", code }),
    });
    setProject(payload.project);
  });

  const onDownloadValidation = (experimentId: string, action: "colab" | "survey-schema" | "survey-csv") => runAction(async () => {
    const response = await fetch("/api/validation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project?.projectId, experimentId, action }),
    });
    if (!response.ok) throw new Error(`Download failed (${response.status})`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = action === "colab" ? "open-research-experiment.ipynb" : action === "survey-schema" ? "survey-instrument.json" : "survey-responses-template.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  const onDiscoverLabs = () => runAction(async () => {
    const payload = await api<{ project: ResearchProject }>("/api/labs", {
      method: "POST",
      body: JSON.stringify({ projectId: project?.projectId, action: "discover" }),
    });
    setProject(payload.project);
    setAnnouncement("Real institutions discovered from OpenAlex authorships");
  });

  const onUpdateLab = (nodeId: string, patch: Record<string, unknown>) => runAction(async () => {
    const payload = await api<{ project: ResearchProject }>("/api/labs", {
      method: "POST",
      body: JSON.stringify({ projectId: project?.projectId, action: "update", nodeId, ...patch }),
    });
    setProject(payload.project);
  });

  const onImportResult = (payload: {
    experimentId: string;
    observations: string;
    metricResults: MetricObservation[];
    csvText?: string;
    datasetName?: string;
    sourceModality?: ExperimentModality;
  }) => runAction(async () => {
    const res = await api<{ project: ResearchProject }>("/api/results", {
      method: "POST",
      body: JSON.stringify({ projectId: project?.projectId, ...payload }),
    });
    setProject(res.project);
    setAnnouncement("Observed results imported; frozen expectations preserved");
  });

  const onManuscriptAction = (action: "draft" | "audit" | "humanize" | "save", manuscript?: ManuscriptDocument) => runAction(async () => {
    const res = await api<{ project: ResearchProject }>("/api/manuscript", {
      method: "POST",
      body: JSON.stringify({ projectId: project?.projectId, action, manuscript }),
    });
    setProject(res.project);
  });

  const onExport = () => runAction(async () => {
    const res = await api<{ project?: ResearchProject }>("/api/exports", {
      method: "POST",
      body: JSON.stringify({ projectId: project?.projectId }),
    });
    if (res.project) setProject(res.project);
    else await refresh(project?.projectId);
    setActiveView("published");
    setAnnouncement("HTML, PDF, LaTeX, and ZIP archive generated");
  });

  const preflight = useCallback(async (): Promise<SetupStatus> => {
    try { return await api<SetupStatus>("/api/setup"); }
    catch (cause) {
      return {
        ok: false,
        checks: [{ id: "setup", label: "Setup diagnostics", ok: false, detail: cause instanceof Error ? cause.message : String(cause) }],
        note: "No research session was created.",
      };
    }
  }, []);

  const saveConfig = useCallback(async (payload: Record<string, unknown>): Promise<SetupStatus> => {
    return api<SetupStatus>("/api/setup", { method: "POST", body: JSON.stringify(payload) });
  }, []);

  return (
    <>
      <ResearchDashboard
        project={project}
        projects={projects}
        showHome={showHome}
        telemetry={telemetry}
        streamingDelta={streamingDelta}
        activeView={activeView}
        onViewChange={setActiveView}
        onGoHome={() => { setShowHome(true); setError(undefined); }}
        onSelectProject={onSelectProject}
        onDeleteProject={onDeleteProject}
        onStart={onStart}
        onContinue={onContinue}
        onTriggerReviewPanel={onTriggerReviewPanel}
        onSynthesizeExperiment={onSynthesizeExperiment}
        onStop={onStop}
        onPreflight={preflight}
        onSaveConfig={saveConfig}
        onSelectNode={setSelectedNodeId}
        selectedNodeId={selectedNodeId}
        onEvidenceAction={onEvidenceAction}
        onAddManualEvidence={onAddManualEvidence}
        onAddPaperByDoi={onAddPaperByDoi}
        onUpdateNode={onUpdateNode}
        onDeleteNode={onDeleteNode}
        onRunCode={onRunCode}
        onDownloadValidation={onDownloadValidation}
        onDiscoverLabs={onDiscoverLabs}
        onUpdateLab={onUpdateLab}
        onImportResult={onImportResult}
        onManuscriptAction={onManuscriptAction}
        onExport={onExport}
        busy={busy}
        error={error}
        graph={<KnowledgeGraph project={project} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} />}
        exportPanel={<ExportPanel project={project} onExport={onExport} busy={busy} error={error} />}
      />
      <div className="ori-visually-hidden" role="status" aria-live="polite">{announcement}</div>
    </>
  );
}
