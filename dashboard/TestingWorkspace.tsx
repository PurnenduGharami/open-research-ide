"use client";

import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  Beaker,
  CheckCircle2,
  ClipboardCheck,
  Code2,
  Download,
  ExternalLink,
  FlaskConical,
  Mail,
  Play,
  Search,
  Upload,
  Users,
} from "lucide-react";
import type {
  ExperimentModality,
  MetricObservation,
  OutcomeVerdict,
  PriceKind,
  ResearchNode,
  ResearchProject,
} from "../packages/contracts";
import { MonoMeta, SectionHeader, StatusBadge } from "./ui";

function formatUtcDateTime(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date)} UTC`;
}

function safeExternalUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function TestingWorkspace({
  project,
  busy,
  onSelectNode,
  onSynthesizeExperiment,
  onRunCode,
  onDownloadValidation,
  onDiscoverLabs,
  onUpdateLab,
  onImportResult,
}: {
  project: ResearchProject;
  busy: boolean;
  onSelectNode: (id: string) => void;
  onSynthesizeExperiment: (modality: ExperimentModality) => void;
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
}) {
  const experiments = project.nodes.filter((n) => n.type === "experiment");
  const labs = project.nodes.filter((n) => n.type === "lab");
  const results = project.nodes.filter((n) => n.type === "result");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <section className="ori-section-block">
        <SectionHeader
          eyebrow="Multi-Modal Validation"
          title="Universal Validation & Testing Workspace"
          description="Select the validation path that fits your hypothesis: runnable code & Google Colab, human surveys, or real OpenAlex facilities & wet-labs."
        />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="ori-btn ori-btn--secondary" disabled={busy} onClick={() => onSynthesizeExperiment("computational")}>
            <Code2 size={15} /> Code / Colab Experiment
          </button>
          <button type="button" className="ori-btn ori-btn--secondary" disabled={busy} onClick={() => onSynthesizeExperiment("survey")}>
            <Users size={15} /> Human Survey Study
          </button>
          <button type="button" className="ori-btn ori-btn--secondary" disabled={busy} onClick={() => onSynthesizeExperiment("wet-lab")}>
            <Beaker size={15} /> Wet-Lab / Physical Protocol
          </button>
          <button type="button" className="ori-btn ori-btn--ghost" disabled={busy} onClick={onDiscoverLabs}>
            <Search size={15} /> Discover Real Labs via OpenAlex
          </button>
        </div>
      </section>

      {experiments.length === 0 ? (
        <section className="ori-panel">
          <strong style={{ fontSize: 15 }}>No validation protocol designed yet</strong>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            Choose a modality above to generate a structured protocol with frozen expected outcomes, or switch to Autonomous Investigation.
          </p>
        </section>
      ) : (
        experiments.map((experiment) => (
          <ExperimentCard
            key={experiment.id}
            experiment={experiment}
            labs={labs}
            busy={busy}
            onSelectNode={onSelectNode}
            onRunCode={onRunCode}
            onDownloadValidation={onDownloadValidation}
            onDiscoverLabs={onDiscoverLabs}
            onUpdateLab={onUpdateLab}
            onImportResult={onImportResult}
          />
        ))
      )}

      {results.length > 0 ? (
        <section className="ori-section-block">
          <SectionHeader
            eyebrow="Empirical Data"
            title="Imported Observed Results"
            actions={<StatusBadge tone="accent">Stored separately from frozen predictions</StatusBadge>}
          />
          {results.map((result) => (
            <div key={result.id} className="ori-panel">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <button type="button" className="ori-text-link" style={{ fontWeight: 600 }} onClick={() => onSelectNode(result.id)}>
                  {result.title}
                </button>
                <MonoMeta>Imported {formatUtcDateTime(result.data.importedAt)}</MonoMeta>
              </div>
              {Array.isArray(result.data.metricResults) && result.data.metricResults.length > 0 ? (
                <div className="ori-table-wrap">
                  <table className="ori-table">
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th>Frozen Expected</th>
                        <th>Observed</th>
                        <th>Verdict</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.data.metricResults.map((row, idx) => (
                        <tr key={`${row.metric}-${idx}`}>
                          <td><strong>{row.metric}</strong></td>
                          <td>{row.expected}</td>
                          <td>{row.observed}</td>
                          <td>
                            <StatusBadge tone={row.verdict === "supports" ? "ok" : row.verdict === "contradicts" ? "danger" : "warn"}>
                              {row.verdict}
                            </StatusBadge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              <p style={{ fontSize: 14, whiteSpace: "pre-wrap", color: "var(--text-secondary)" }}>{result.data.observations}</p>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function ExperimentCard({
  experiment,
  labs,
  busy,
  onSelectNode,
  onRunCode,
  onDownloadValidation,
  onDiscoverLabs,
  onUpdateLab,
  onImportResult,
}: {
  experiment: ResearchNode;
  labs: ResearchNode[];
  busy: boolean;
  onSelectNode: (id: string) => void;
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
}) {
  const data = experiment.data;
  const modality: ExperimentModality = data.modality || (data.codeExperiment ? "computational" : data.surveyDesign ? "survey" : "wet-lab");
  const [codeDraft, setCodeDraft] = useState(
    data.codeExperiment?.code ||
    `# Computational validation template for: ${experiment.title}\nimport statistics\n\nbaseline = [1.0, 1.1, 0.95]\ntreatment = [1.35, 1.42, 1.38]\nprint(f"Baseline mean: {statistics.mean(baseline):.3f}")\nprint(f"Treatment mean: {statistics.mean(treatment):.3f}")\n`,
  );
  const [observations, setObservations] = useState("");
  const [csvText, setCsvText] = useState("");
  const [datasetName, setDatasetName] = useState("");
  const [metricRows, setMetricRows] = useState<MetricObservation[]>(() =>
    (data.expectedOutcomes || []).map((o) => ({
      metric: o.metric,
      expected: o.prediction,
      observed: "",
      verdict: "inconclusive" as OutcomeVerdict,
    })),
  );
  const [copiedEmail, setCopiedEmail] = useState(false);

  const handleCsvUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setDatasetName(file.name);
    setCsvText(await file.text());
  };

  const handleSubmitResults = (event: FormEvent) => {
    event.preventDefault();
    if (!observations.trim() && !csvText.trim()) return;
    onImportResult({
      experimentId: experiment.id,
      observations: observations.trim(),
      metricResults: metricRows.filter((r) => r.observed.trim()),
      ...(csvText ? { csvText, datasetName } : {}),
      sourceModality: modality,
    });
    setObservations("");
    setCsvText("");
    setDatasetName("");
  };

  return (
    <section className="ori-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <button type="button" className="ori-text-link" style={{ fontSize: 18, fontWeight: 600 }} onClick={() => onSelectNode(experiment.id)}>
            {experiment.title}
          </button>
          {data.objective ? <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>{data.objective}</p> : null}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <StatusBadge tone="accent"><FlaskConical size={12} /> {modality}</StatusBadge>
          {data.expectedOutcomesFrozenAt ? <StatusBadge tone="neutral">Predictions frozen</StatusBadge> : null}
        </div>
      </div>

      {data.protocol?.length ? (
        <div>
          <strong style={{ fontSize: 13, color: "var(--text-secondary)" }}>Protocol Steps</strong>
          <ol style={{ listStyle: "decimal", paddingLeft: 20, marginTop: 6, display: "flex", flexDirection: "column", gap: 5, fontSize: 14 }}>
            {data.protocol.map((step, idx) => <li key={`${idx}-${step}`}>{step}</li>)}
          </ol>
        </div>
      ) : null}

      <div className="ori-hypothesis-strip">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <CheckCircle2 size={15} style={{ color: "var(--accent)" }} />
          <strong style={{ fontSize: 14 }}>Frozen Expected Outcomes</strong>
          <MonoMeta>{data.expectedOutcomesFrozenAt ? `Locked ${formatUtcDateTime(data.expectedOutcomesFrozenAt)}` : "Locked before testing"}</MonoMeta>
        </div>
        {(data.expectedOutcomes || []).map((o, idx) => (
          <div key={`${o.metric}-${idx}`} style={{ fontSize: 14 }}>
            <strong>{o.metric}:</strong> {o.prediction}
            {o.rationale ? <span style={{ color: "var(--text-secondary)" }}> — {o.rationale}</span> : null}
          </div>
        ))}
      </div>

      {(modality === "computational" || data.codeExperiment) ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 14 }}>Computational Experiment ({data.codeExperiment?.language || "python"})</strong>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="ori-btn ori-btn--primary ori-btn--sm" disabled={busy} onClick={() => onRunCode(experiment.id, codeDraft)}>
                <Play size={13} /> Run Locally
              </button>
              <button type="button" className="ori-btn ori-btn--secondary ori-btn--sm" disabled={busy} onClick={() => onDownloadValidation(experiment.id, "colab")}>
                <Download size={13} /> Export Google Colab (.ipynb)
              </button>
            </div>
          </div>
          <textarea className="ori-code-editor" value={codeDraft} onChange={(e) => setCodeDraft(e.target.value)} aria-label="Experiment source code" />
          {data.codeExperiment?.lastRunOutput ? (
            <div className="ori-terminal-out">
              {`Exit ${data.codeExperiment.lastRunOutput.exitCode} · ${data.codeExperiment.lastRunOutput.durationMs}ms · ${data.codeExperiment.lastRunOutput.ranAt}\n`}
              {data.codeExperiment.lastRunOutput.stdout}
              {data.codeExperiment.lastRunOutput.stderr ? `\n[stderr]\n${data.codeExperiment.lastRunOutput.stderr}` : ""}
            </div>
          ) : null}
        </div>
      ) : null}

      {(modality === "survey" || data.surveyDesign) ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 14 }}>Survey Instrument &amp; Distribution Plan</strong>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="ori-btn ori-btn--secondary ori-btn--sm" onClick={() => onDownloadValidation(experiment.id, "survey-schema")}>
                <Download size={13} /> Export Survey JSON
              </button>
              <button type="button" className="ori-btn ori-btn--secondary ori-btn--sm" onClick={() => onDownloadValidation(experiment.id, "survey-csv")}>
                <Download size={13} /> CSV Template
              </button>
            </div>
          </div>
          {data.surveyDesign ? (
            <>
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Population: <strong>{data.surveyDesign.targetPopulation}</strong> · Target N = <strong>{data.surveyDesign.targetSampleSize}</strong> · ~{data.surveyDesign.estimatedMinutes} min
              </p>
              {data.surveyDesign.questions?.length ? (
                <ol style={{ listStyle: "decimal", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 5, fontSize: 13 }}>
                  {data.surveyDesign.questions.map((q) => (
                    <li key={q.id}><MonoMeta>[{q.kind}]</MonoMeta> {q.prompt}</li>
                  ))}
                </ol>
              ) : null}
              {data.surveyDesign.distributionChannels?.length ? (
                <div className="ori-table-wrap">
                  <table className="ori-table">
                    <thead><tr><th>Channel</th><th>Tier</th><th>Cost Guidance</th><th>Notes</th></tr></thead>
                    <tbody>
                      {data.surveyDesign.distributionChannels.map((ch) => (
                        <tr key={ch.name}>
                          <td><strong>{ch.name}</strong></td>
                          <td><StatusBadge tone="neutral">{ch.tier}</StatusBadge></td>
                          <td>{ch.estimatedCost}</td>
                          <td style={{ color: "var(--text-secondary)" }}>{ch.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <strong style={{ fontSize: 14 }}>Real Facilities, University Cores &amp; Collaborators</strong>
          <button type="button" className="ori-btn ori-btn--secondary ori-btn--sm" disabled={busy} onClick={onDiscoverLabs}>
            <Search size={13} /> Discover via OpenAlex Authorships
          </button>
        </div>
        {labs.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            No facility candidates recorded yet. Use OpenAlex discovery above to surface real university departments from retrieved DOIs.
          </p>
        ) : (
          <div className="ori-grid-2">
            {labs.map((lab) => <LabTrackerCard key={lab.id} lab={lab} busy={busy} onSelectNode={onSelectNode} onUpdateLab={onUpdateLab} />)}
          </div>
        )}
      </div>

      {data.outreachDraft ? (
        <details style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border-subtle)", background: "var(--bg-canvas)" }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <Mail size={15} /> Outreach Email Draft (Never sent automatically)
          </summary>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            <strong style={{ fontSize: 13 }}>Subject: {data.outreachDraft.subject}</strong>
            <p style={{ fontSize: 13, whiteSpace: "pre-wrap", color: "var(--text-secondary)" }}>{data.outreachDraft.body}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="ori-btn ori-btn--secondary ori-btn--sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(`Subject: ${data.outreachDraft?.subject}\n\n${data.outreachDraft?.body}`);
                  setCopiedEmail(true);
                  setTimeout(() => setCopiedEmail(false), 2000);
                }}
              >
                {copiedEmail ? "Copied" : "Copy draft"}
              </button>
              <a
                className="ori-btn ori-btn--ghost ori-btn--sm"
                href={`mailto:?subject=${encodeURIComponent(data.outreachDraft.subject)}&body=${encodeURIComponent(data.outreachDraft.body)}`}
              >
                Open in Mail
              </a>
            </div>
          </div>
        </details>
      ) : null}

      <form onSubmit={handleSubmitResults} style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 14, borderTop: "1px solid var(--border-subtle)" }}>
        <div>
          <strong style={{ fontSize: 14 }}>Import Observed Results (Expected vs. Observed)</strong>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Observations record separately and never overwrite frozen predictions.
          </p>
        </div>

        {metricRows.length > 0 ? (
          <div className="ori-table-wrap">
            <table className="ori-table">
              <thead><tr><th>Metric</th><th>Frozen Prediction</th><th>Observed Value</th><th>Verdict</th></tr></thead>
              <tbody>
                {metricRows.map((row, idx) => (
                  <tr key={`${row.metric}-${idx}`}>
                    <td><strong>{row.metric}</strong></td>
                    <td>{row.expected}</td>
                    <td>
                      <input
                        className="ori-input"
                        placeholder="Measured result..."
                        value={row.observed}
                        onChange={(e) => setMetricRows((prev) => prev.map((item, i) => (i === idx ? { ...item, observed: e.target.value } : item)))}
                      />
                    </td>
                    <td>
                      <select
                        className="ori-select"
                        value={row.verdict}
                        onChange={(e) => setMetricRows((prev) => prev.map((item, i) => (i === idx ? { ...item, verdict: e.target.value as OutcomeVerdict } : item)))}
                      >
                        <option value="supports">Supports</option>
                        <option value="contradicts">Contradicts</option>
                        <option value="inconclusive">Inconclusive</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="ori-field">
          <label htmlFor={`obs-${experiment.id}`}>Observed measurements and outcomes</label>
          <textarea
            id={`obs-${experiment.id}`}
            className="ori-textarea"
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="Paste code output, survey summary, or lab measurements..."
            disabled={busy}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <label className="ori-btn ori-btn--secondary ori-btn--sm" style={{ cursor: "pointer" }}>
            <Upload size={13} /> {datasetName ? `CSV attached: ${datasetName}` : "Attach CSV dataset (optional)"}
            <input type="file" accept=".csv,text/csv" hidden onChange={(e) => void handleCsvUpload(e)} />
          </label>
          <button type="submit" className="ori-btn ori-btn--primary ori-btn--sm" disabled={busy || (!observations.trim() && !csvText.trim())}>
            <ClipboardCheck size={14} /> Import observed results
          </button>
        </div>
      </form>
    </section>
  );
}

function LabTrackerCard({
  lab,
  busy,
  onSelectNode,
  onUpdateLab,
}: {
  lab: ResearchNode;
  busy: boolean;
  onSelectNode: (id: string) => void;
  onUpdateLab: (nodeId: string, patch: Record<string, unknown>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [contacted, setContacted] = useState(Boolean(lab.data.contacted));
  const [priceKind, setPriceKind] = useState<PriceKind>(lab.data.price?.kind || "unavailable");
  const [amount, setAmount] = useState(lab.data.price?.amount !== undefined ? String(lab.data.price.amount) : "");
  const [currency, setCurrency] = useState(lab.data.price?.currency || "USD");
  const [note, setNote] = useState(lab.data.price?.note || "");
  const [notes, setNotes] = useState(lab.data.notes || "");
  const href = safeExternalUrl(lab.data.url || lab.data.rorUrl);

  const save = () => {
    onUpdateLab(lab.id, {
      contacted,
      notes,
      price: {
        kind: priceKind,
        ...(amount.trim() && Number.isFinite(Number(amount)) ? { amount: Number(amount), currency } : {}),
        note: note.trim() || (priceKind === "quoted" ? "Written quote recorded by researcher" : "No quote obtained"),
      },
    });
    setEditing(false);
  };

  return (
    <article className="ori-inspector-card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
        <button type="button" className="ori-text-link" style={{ fontWeight: 600 }} onClick={() => onSelectNode(lab.id)}>
          {lab.data.name || lab.title}
        </button>
        <StatusBadge tone={lab.data.contacted ? "ok" : "neutral"}>{lab.data.contacted ? "Contacted" : "Uncontacted"}</StatusBadge>
      </div>
      {lab.data.fit ? <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{lab.data.fit}</p> : null}
      {Array.isArray(lab.data.authors) && lab.data.authors.length ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Published authors: {lab.data.authors.join(", ")}</p>
      ) : null}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13 }}>
        <StatusBadge tone={lab.data.price?.kind === "quoted" ? "ok" : "warn"}>
          {lab.data.price?.kind === "quoted" ? "Quoted" : lab.data.price?.kind === "model-estimated" ? "Model-estimated" : "Pricing unavailable"}
        </StatusBadge>
        {lab.data.price?.amount !== undefined ? <MonoMeta>{lab.data.price.currency || "USD"} {lab.data.price.amount}</MonoMeta> : null}
      </div>
      {lab.data.notes ? <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Notes: {lab.data.notes}</p> : null}
      <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }}>
        {href ? <a href={href} target="_blank" rel="noreferrer" className="ori-text-link" style={{ fontSize: 12 }}>Facility / ROR <ExternalLink size={11} /></a> : <span />}
        <button type="button" className="ori-btn ori-btn--secondary ori-btn--sm" onClick={() => setEditing((v) => !v)} disabled={busy}>
          {editing ? "Cancel" : "Log outreach / quote"}
        </button>
      </div>
      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={contacted} onChange={(e) => setContacted(e.target.checked)} />
            Marked as contacted
          </label>
          <div className="ori-grid-2">
            <select className="ori-select" value={priceKind} onChange={(e) => setPriceKind(e.target.value as PriceKind)}>
              <option value="unavailable">Pricing unavailable</option>
              <option value="model-estimated">Model-estimated</option>
              <option value="quoted">Verified written quote</option>
            </select>
            <input className="ori-input" placeholder="Amount (optional)" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="ori-grid-2">
            <input className="ori-input" placeholder="Currency (USD)" value={currency} onChange={(e) => setCurrency(e.target.value)} />
            <input className="ori-input" placeholder="Price basis note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <input className="ori-input" placeholder="Outreach notes / contact / date..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button type="button" className="ori-btn ori-btn--primary ori-btn--sm" onClick={save} disabled={busy}>Save Facility Status</button>
        </div>
      ) : null}
    </article>
  );
}
