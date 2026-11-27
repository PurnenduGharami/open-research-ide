"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, LoaderCircle, Settings2, X } from "lucide-react";
import type { ProviderType, SetupStatus } from "../packages/contracts";
import { StatusBadge } from "./ui";

const PROVIDERS: Array<{
  id: ProviderType;
  label: string;
  defaultModel: string;
  defaultBaseUrl: string;
  quickModels?: string[];
}> = [
  {
    id: "gemini",
    label: "Google Gemini API (Default)",
    defaultModel: "gemini-2.5-flash",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    quickModels: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite"],
  },
  {
    id: "vertex",
    label: "Google Cloud Vertex AI",
    defaultModel: "gemini-2.5-pro",
    defaultBaseUrl: "https://aiplatform.googleapis.com/v1/publishers/google",
    quickModels: ["gemini-2.5-pro", "gemini-2.5-flash"],
  },
  {
    id: "gemma-local",
    label: "Local Gemma (Ollama)",
    defaultModel: "gemma3:12b",
    defaultBaseUrl: "http://127.0.0.1:11434/v1",
    quickModels: ["gemma3:12b", "gemma3:27b", "gemma3:4b"],
  },
  {
    id: "custom",
    label: "Custom Compatible Endpoint",
    defaultModel: "gemini-2.5-flash",
    defaultBaseUrl: "http://127.0.0.1:8080/v1",
  },
];

export function SetupModal({
  openTriggerLabel = "Setup",
  onPreflight,
  onSaveConfig,
}: {
  openTriggerLabel?: string;
  onPreflight: () => Promise<SetupStatus>;
  onSaveConfig: (payload: Record<string, unknown>) => Promise<SetupStatus>;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const [orchProvider, setOrchProvider] = useState<ProviderType>("gemini");
  const [orchModel, setOrchModel] = useState("gemini-2.5-flash");
  const [orchBaseUrl, setOrchBaseUrl] = useState("https://generativelanguage.googleapis.com/v1beta");
  const [revProvider, setRevProvider] = useState<ProviderType>("gemini");
  const [revModel, setRevModel] = useState("gemini-2.5-flash");
  const [revBaseUrl, setRevBaseUrl] = useState("https://generativelanguage.googleapis.com/v1beta");
  const [vertexProject, setVertexProject] = useState("");
  const [vertexLocation, setVertexLocation] = useState("us-central1");

  const [orchKeyInput, setOrchKeyInput] = useState("");
  const [revKeyInput, setRevKeyInput] = useState("");
  const [s2Key, setS2Key] = useState("");
  const [openAlexMailto, setOpenAlexMailto] = useState("");

  const syncFromStatus = (result: SetupStatus) => {
    setStatus(result);
    if (result.config) {
      setOrchProvider(result.config.orchestrator.provider);
      setOrchModel(result.config.orchestrator.model);
      setOrchBaseUrl(result.config.orchestrator.baseUrl || "");
      setRevProvider(result.config.reviewers.provider);
      setRevModel(result.config.reviewers.model);
      setRevBaseUrl(result.config.reviewers.baseUrl || "");
      setVertexProject(result.config.vertexProject || "");
      setVertexLocation(result.config.vertexLocation || "us-central1");
    }
  };

  const runCheck = async () => {
    setLoading(true);
    setError(undefined);
    try {
      syncFromStatus(await onPreflight());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  };

  const open = () => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    void runCheck();
  };

  const close = () => dialogRef.current?.close();

  const handleSave = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const secrets: Record<string, string> = {};
      if (orchKeyInput.trim()) secrets[orchProvider] = orchKeyInput.trim();
      if (revProvider !== orchProvider && revKeyInput.trim()) secrets[revProvider] = revKeyInput.trim();
      if (s2Key.trim()) secrets.semanticScholarApiKey = s2Key.trim();
      if (openAlexMailto.trim()) secrets.openAlexMailto = openAlexMailto.trim();
      const result = await onSaveConfig({
        harness: "standalone",
        vertexProject,
        vertexLocation,
        orchestrator: { provider: orchProvider, model: orchModel, baseUrl: orchBaseUrl },
        reviewers: { provider: revProvider, model: revModel, baseUrl: revBaseUrl },
        secrets,
      });
      setOrchKeyInput("");
      setRevKeyInput("");
      setS2Key("");
      syncFromStatus(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const spec = PROVIDERS.find((p) => p.id === orchProvider);
    if (spec && !orchModel) setOrchModel(spec.defaultModel);
  }, [orchProvider, orchModel]);

  const orchSpec = PROVIDERS.find((p) => p.id === orchProvider);
  const revSpec = PROVIDERS.find((p) => p.id === revProvider);
  const usesVertex = orchProvider === "vertex" || revProvider === "vertex";

  return (
    <>
      <button type="button" className="ori-btn ori-btn--ghost ori-btn--sm" onClick={open} aria-label="Check setup">
        <Settings2 size={14} aria-hidden="true" />
        <span className="ori-hide-mobile">{openTriggerLabel}</span>
      </button>

      <dialog ref={dialogRef} className="ori-dialog" aria-labelledby={titleId}>
        <div className="ori-dialog-head">
          <div>
            <h2 id={titleId}>Google Gemini &amp; Runtime Setup</h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
              Direct Standalone Runtime — zero external daemon required. Credentials stay server-side (`0600`).
            </p>
          </div>
          <button type="button" className="ori-icon-btn" onClick={close} aria-label="Close setup">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="ori-dialog-body">
          <div className="ori-banner">
            <CheckCircle2 size={16} style={{ color: "var(--accent)", flexShrink: 0 }} aria-hidden="true" />
            <div>
              <strong>Google-Native Standalone Runtime</strong> · Works locally with a{" "}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                Google AI Studio API key <ExternalLink size={11} style={{ verticalAlign: "-1px" }} />
              </a>
              , Google Cloud Vertex AI, or local Gemma 3 via Ollama.
            </div>
          </div>

          <div className="ori-grid-2">
            <div className="ori-field">
              <label htmlFor="ori-orch-provider">Research Orchestrator Provider</label>
              <select
                id="ori-orch-provider"
                className="ori-select"
                value={orchProvider}
                onChange={(e) => {
                  const next = e.target.value as ProviderType;
                  const spec = PROVIDERS.find((p) => p.id === next);
                  setOrchProvider(next);
                  if (spec) { setOrchModel(spec.defaultModel); setOrchBaseUrl(spec.defaultBaseUrl); }
                }}
              >
                {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div className="ori-field">
              <label htmlFor="ori-orch-model">Orchestrator Model ID</label>
              <input id="ori-orch-model" className="ori-input" value={orchModel} onChange={(e) => setOrchModel(e.target.value)} />
              {orchSpec?.quickModels ? (
                <div className="ori-triage-row">
                  {orchSpec.quickModels.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`ori-chip-btn${orchModel === m ? " ori-chip-btn--active" : ""}`}
                      onClick={() => setOrchModel(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="ori-field">
              <label htmlFor="ori-rev-provider">Independent Review Panel Provider</label>
              <select
                id="ori-rev-provider"
                className="ori-select"
                value={revProvider}
                onChange={(e) => {
                  const next = e.target.value as ProviderType;
                  const spec = PROVIDERS.find((p) => p.id === next);
                  setRevProvider(next);
                  if (spec) { setRevModel(spec.defaultModel); setRevBaseUrl(spec.defaultBaseUrl); }
                }}
              >
                {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div className="ori-field">
              <label htmlFor="ori-rev-model">Review Panel Model ID</label>
              <input id="ori-rev-model" className="ori-input" value={revModel} onChange={(e) => setRevModel(e.target.value)} />
              {revSpec?.quickModels ? (
                <div className="ori-triage-row">
                  {revSpec.quickModels.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`ori-chip-btn${revModel === m ? " ori-chip-btn--active" : ""}`}
                      onClick={() => setRevModel(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {usesVertex ? (
            <div className="ori-grid-2">
              <div className="ori-field">
                <label htmlFor="ori-vertex-project">Google Cloud Project ID (optional for Express)</label>
                <input
                  id="ori-vertex-project"
                  className="ori-input"
                  placeholder="my-gcp-research-project"
                  value={vertexProject}
                  onChange={(e) => setVertexProject(e.target.value)}
                />
              </div>
              <div className="ori-field">
                <label htmlFor="ori-vertex-location">Vertex AI Region</label>
                <input
                  id="ori-vertex-location"
                  className="ori-input"
                  placeholder="us-central1"
                  value={vertexLocation}
                  onChange={(e) => setVertexLocation(e.target.value)}
                />
              </div>
            </div>
          ) : null}

          <div className="ori-grid-2">
            <div className="ori-field">
              <label htmlFor="ori-api-key">API Key for {orchSpec?.label}</label>
              <input
                id="ori-api-key"
                type="password"
                className="ori-input"
                placeholder={orchProvider === "gemma-local" ? "Not required for local Ollama" : status?.config?.providersConfigured?.[orchProvider] ? "Configured (leave blank to keep)" : "Paste key (saved locally 0600)"}
                value={orchKeyInput}
                onChange={(e) => setOrchKeyInput(e.target.value)}
                disabled={orchProvider === "gemma-local"}
              />
            </div>
            <div className="ori-field">
              <label htmlFor="ori-base-url">Endpoint Base URL</label>
              <input id="ori-base-url" className="ori-input" value={orchBaseUrl} onChange={(e) => setOrchBaseUrl(e.target.value)} />
            </div>
          </div>

          {revProvider !== orchProvider && revProvider !== "gemma-local" ? (
            <div className="ori-field">
              <label htmlFor="ori-rev-api-key">API Key for {revSpec?.label}</label>
              <input
                id="ori-rev-api-key"
                type="password"
                className="ori-input"
                placeholder={status?.config?.providersConfigured?.[revProvider] ? "Configured (leave blank to keep)" : "Paste reviewer provider key"}
                value={revKeyInput}
                onChange={(e) => setRevKeyInput(e.target.value)}
              />
            </div>
          ) : null}

          <div className="ori-grid-2">
            <div className="ori-field">
              <label htmlFor="ori-oa-mailto">OpenAlex Polite Pool Email (optional)</label>
              <input
                id="ori-oa-mailto"
                className="ori-input"
                placeholder={status?.config?.hasOpenAlexMailto ? "Configured" : "you@university.edu"}
                value={openAlexMailto}
                onChange={(e) => setOpenAlexMailto(e.target.value)}
              />
            </div>
            <div className="ori-field">
              <label htmlFor="ori-s2-key">Semantic Scholar API Key (optional)</label>
              <input
                id="ori-s2-key"
                type="password"
                className="ori-input"
                placeholder={status?.config?.hasSemanticScholarKey ? "Configured" : "Avoids public 429 limits"}
                value={s2Key}
                onChange={(e) => setS2Key(e.target.value)}
              />
            </div>
          </div>

          {error ? (
            <div className="ori-banner ori-banner--danger" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          {status ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className={`ori-banner${status.ok ? "" : " ori-banner--warn"}`}>
                {status.ok ? <CheckCircle2 size={16} style={{ color: "var(--accent)" }} /> : <AlertCircle size={16} />}
                <strong>{status.ok ? "Configuration checks passed" : "Configuration needs attention"}</strong>
              </div>
              <ul style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {status.checks.map((check) => (
                  <li key={check.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 10, background: "var(--bg-subtle)", fontSize: 13 }}>
                    <div>
                      <strong>{check.label}</strong>
                      <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>{check.detail}</p>
                    </div>
                    <StatusBadge tone={check.ok ? "ok" : "danger"}>{check.ok ? "Passed" : "Failed"}</StatusBadge>
                  </li>
                ))}
              </ul>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{status.note}</p>
            </div>
          ) : null}
        </div>

        <div className="ori-dialog-foot">
          <button type="button" className="ori-btn ori-btn--secondary ori-btn--sm" onClick={() => void runCheck()} disabled={loading}>
            {loading ? <LoaderCircle size={14} className="ori-spin" /> : <Settings2 size={14} />}
            Re-check Health
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="ori-btn ori-btn--ghost ori-btn--sm" onClick={close}>Close</button>
            <button type="button" className="ori-btn ori-btn--primary ori-btn--sm" onClick={() => void handleSave()} disabled={loading}>
              Save &amp; Verify
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
