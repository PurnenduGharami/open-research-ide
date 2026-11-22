"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, Settings2, X } from "lucide-react";
import type { HarnessType, ProviderType, SetupStatus } from "../packages/contracts";
import { StatusBadge } from "./ui";

const PROVIDERS: Array<{ id: ProviderType; label: string; defaultModel: string; defaultBaseUrl: string }> = [
  { id: "cerebras", label: "Cerebras (Default)", defaultModel: "cerebras/moonshotai-kimi-k3.1-pro-trial", defaultBaseUrl: "https://api.cerebras.ai/v1" },
  { id: "openai-compatible", label: "OpenAI / Compatible", defaultModel: "gpt-4.1-mini", defaultBaseUrl: "https://api.openai.com/v1" },
  { id: "anthropic", label: "Anthropic Claude", defaultModel: "claude-sonnet-4-5", defaultBaseUrl: "https://api.anthropic.com/v1" },
  { id: "gemini", label: "Google Gemini", defaultModel: "gemini-2.5-flash", defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta" },
  { id: "openrouter", label: "OpenRouter", defaultModel: "moonshotai/kimi-k2", defaultBaseUrl: "https://openrouter.ai/api/v1" },
  { id: "ollama", label: "Local Ollama", defaultModel: "qwen2.5:14b", defaultBaseUrl: "http://127.0.0.1:11434/v1" },
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

  const [harness, setHarness] = useState<HarnessType>("openclaw");
  const [orchProvider, setOrchProvider] = useState<ProviderType>("cerebras");
  const [orchModel, setOrchModel] = useState("cerebras/moonshotai-kimi-k3.1-pro-trial");
  const [orchBaseUrl, setOrchBaseUrl] = useState("https://api.cerebras.ai/v1");
  const [revProvider, setRevProvider] = useState<ProviderType>("cerebras");
  const [revModel, setRevModel] = useState("cerebras/moonshotai-kimi-k3.1-pro-trial");
  const [revBaseUrl, setRevBaseUrl] = useState("https://api.cerebras.ai/v1");
  const [gatewayUrl, setGatewayUrl] = useState("ws://127.0.0.1:18789");

  const [apiKeyInput, setApiKeyInput] = useState("");
  const [s2Key, setS2Key] = useState("");
  const [openAlexMailto, setOpenAlexMailto] = useState("");

  const syncFromStatus = (result: SetupStatus) => {
    setStatus(result);
    if (result.config) {
      setHarness(result.config.harness);
      setOrchProvider(result.config.orchestrator.provider);
      setOrchModel(result.config.orchestrator.model);
      setOrchBaseUrl(result.config.orchestrator.baseUrl || "");
      setRevProvider(result.config.reviewers.provider);
      setRevModel(result.config.reviewers.model);
      setRevBaseUrl(result.config.reviewers.baseUrl || "");
      setGatewayUrl(result.config.openclawGatewayUrl);
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
      if (apiKeyInput.trim()) secrets[orchProvider] = apiKeyInput.trim();
      if (s2Key.trim()) secrets.semanticScholarApiKey = s2Key.trim();
      if (openAlexMailto.trim()) secrets.openAlexMailto = openAlexMailto.trim();
      const result = await onSaveConfig({
        harness,
        openclawGatewayUrl: gatewayUrl,
        orchestrator: { provider: orchProvider, model: orchModel, baseUrl: orchBaseUrl },
        reviewers: { provider: revProvider, model: revModel, baseUrl: revBaseUrl },
        secrets,
      });
      setApiKeyInput("");
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

  return (
    <>
      <button type="button" className="ori-btn ori-btn--secondary ori-btn--sm" onClick={open} aria-label="Check setup">
        <Settings2 size={14} aria-hidden="true" />
        <span>{openTriggerLabel}</span>
      </button>

      <dialog ref={dialogRef} className="ori-dialog" aria-labelledby={titleId}>
        <div className="ori-dialog-head">
          <div>
            <h2 id={titleId}>Runtime &amp; Provider Setup</h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
              Isolated server-side configuration. Credentials never enter the browser or research context.
            </p>
          </div>
          <button type="button" className="ori-icon-btn" onClick={close} aria-label="Close setup">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="ori-dialog-body">
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Execution Harness</p>
            <div className="ori-mode-cards">
              <button
                type="button"
                className={`ori-mode-card${harness === "openclaw" ? " ori-mode-card--selected" : ""}`}
                onClick={() => setHarness("openclaw")}
              >
                <span className="ori-mode-radio" aria-hidden="true" />
                <span className="ori-mode-copy">
                  <strong>OpenClaw Gateway (Default)</strong>
                  <span>Uses local OpenClaw daemon &amp; plugin isolation.</span>
                </span>
              </button>
              <button
                type="button"
                className={`ori-mode-card${harness === "standalone" ? " ori-mode-card--selected" : ""}`}
                onClick={() => setHarness("standalone")}
              >
                <span className="ori-mode-radio" aria-hidden="true" />
                <span className="ori-mode-copy">
                  <strong>Direct Standalone Runtime</strong>
                  <span>Connects directly to any configured provider API.</span>
                </span>
              </button>
            </div>
          </div>

          {harness === "openclaw" ? (
            <div className="ori-field">
              <label htmlFor="ori-gw-url">OpenClaw Gateway WebSocket URL</label>
              <input id="ori-gw-url" className="ori-input" value={gatewayUrl} onChange={(e) => setGatewayUrl(e.target.value)} />
            </div>
          ) : null}

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
            </div>
          </div>

          <div className="ori-grid-2">
            <div className="ori-field">
              <label htmlFor="ori-api-key">API Key for {PROVIDERS.find((p) => p.id === orchProvider)?.label}</label>
              <input
                id="ori-api-key"
                type="password"
                className="ori-input"
                placeholder={status?.config?.providersConfigured?.[orchProvider] ? "Configured (leave blank to keep)" : "Paste key (saved locally 0600)"}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
              />
            </div>
            <div className="ori-field">
              <label htmlFor="ori-base-url">Custom Base URL (OpenAI-compatible / Ollama)</label>
              <input id="ori-base-url" className="ori-input" value={orchBaseUrl} onChange={(e) => setOrchBaseUrl(e.target.value)} />
            </div>
          </div>

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
