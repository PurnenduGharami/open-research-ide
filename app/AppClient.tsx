"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ResearchDashboard } from "../dashboard/ResearchDashboard";
import { ExportPanel, KnowledgeGraph } from "../components";
import type { ResearchProject, RunTelemetry, SetupStatus, StreamEvent, ViewId } from "../packages/contracts";

const idleTelemetry: RunTelemetry = { status: "idle", outputTpsLabel: "run-average output TPS" };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload as T;
}

export default function AppClient({ initialProject }: { initialProject: ResearchProject | null }) {
  const [project, setProject] = useState(initialProject);
  const [activeView, setActiveView] = useState<ViewId>("research");
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [telemetry, setTelemetry] = useState<RunTelemetry>(idleTelemetry);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const events = new EventSource("/api/events");
    events.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as StreamEvent & { runs?: RunTelemetry[] };
        if (event.project !== undefined) setProject(event.project);
        if (event.telemetry) setTelemetry(event.telemetry);
        else if (event.runs?.[0]) setTelemetry(event.runs[0]);
        else if (event.type === "run") {
          setTelemetry((current) => ({ ...current, status: event.status === "running" ? "running" : event.status === "error" ? "error" : "completed", runId: event.runId }));
        }
        if (event.type === "error" && event.message) setError(event.message);
        if (event.type === "run" && event.status) setAnnouncement(`Research run ${event.status}`);
      } catch { setError("A live update could not be read. Refresh to resynchronize."); }
    };
    events.onerror = () => setAnnouncement("Live connection interrupted; browser reconnect is active");
    return () => events.close();
  }, []);

  useEffect(() => {
    if (telemetry.status !== "running" || !telemetry.startedAt) return;
    const tick = () => setTelemetry((current) => ({ ...current, elapsedMs: Math.max(0, Date.now() - new Date(current.startedAt || Date.now()).getTime()) }));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [telemetry.status, telemetry.startedAt]);

  useEffect(() => {
    if (telemetry.status !== "idle" || !project) return;
    const latest = project.runs.at(-1);
    if (latest) setTelemetry({ status: latest.status === "running" ? "running" : latest.status === "error" ? "error" : "completed", runId: latest.id, startedAt: latest.startedAt, elapsedMs: latest.durationMs, outputTps: latest.outputTps, inputTokens: latest.inputTokens, outputTokens: latest.outputTokens, outputTpsLabel: "run-average output TPS" });
  }, [project, telemetry.status]);

  const runAction = useCallback(async (action: () => Promise<void>) => {
    setBusy(true); setError(undefined);
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }, []);

  const refresh = useCallback(async () => {
    const payload = await api<{ project: ResearchProject | null; runs: RunTelemetry[] }>("/api/project");
    setProject(payload.project);
    if (payload.runs[0]) setTelemetry(payload.runs[0]);
  }, []);

  const callbacks = useMemo(() => ({
    onStart: (curiosity: string) => runAction(async () => {
      await api("/api/investigation", { method: "POST", body: JSON.stringify({ curiosity }) });
      setTelemetry({ status: "connecting", startedAt: new Date().toISOString(), outputTpsLabel: "run-average output TPS" });
    }),
    onStop: () => runAction(async () => {
      if (!project?.sessionKey) throw new Error("No active research session");
      await api("/api/investigation/stop", { method: "POST", body: JSON.stringify({ sessionKey: project.sessionKey, runId: telemetry.runId }) });
      await refresh();
    }),
    onConfirmEvidence: (nodeId: string) => runAction(async () => {
      const payload = await api<{ project: ResearchProject }>("/api/evidence/confirm", { method: "POST", body: JSON.stringify({ nodeId }) });
      setProject(payload.project);
      setAnnouncement("Evidence passage confirmed");
    }),
    onImportResult: (experimentId: string, observations: string) => runAction(async () => {
      const payload = await api<{ project: ResearchProject }>("/api/results", { method: "POST", body: JSON.stringify({ experimentId, observations }) });
      setProject(payload.project);
      setAnnouncement("Observed results imported; frozen expectations preserved");
    }),
    onExport: () => runAction(async () => {
      await api("/api/exports", { method: "POST", body: "{}" });
      await refresh();
      setAnnouncement("HTML, PDF, and LaTeX exports generated");
    }),
  }), [project?.sessionKey, telemetry.runId, refresh, runAction]);

  const preflight = useCallback(async (): Promise<SetupStatus> => {
    try { return await api<SetupStatus>("/api/setup"); }
    catch (cause) { return { ok: false, checks: [{ id: "setup", label: "Setup diagnostics", ok: false, detail: cause instanceof Error ? cause.message : String(cause) }], note: "No research session was created." }; }
  }, []);

  return <>
    <ResearchDashboard
      project={project} telemetry={telemetry} activeView={activeView} onViewChange={setActiveView}
      onStart={callbacks.onStart} onStop={callbacks.onStop} onPreflight={preflight}
      onSelectNode={setSelectedNodeId} selectedNodeId={selectedNodeId}
      onConfirmEvidence={callbacks.onConfirmEvidence} onImportResult={callbacks.onImportResult}
      onExport={callbacks.onExport} busy={busy} error={error}
      graph={<KnowledgeGraph project={project} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} />}
      exportPanel={<ExportPanel project={project} onExport={callbacks.onExport} busy={busy} error={error} />}
    />
    <div className="ori-visually-hidden" role="status" aria-live="polite">{announcement}</div>
  </>;
}
