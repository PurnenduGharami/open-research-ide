"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { BarChart3, Calculator, Save, Upload } from "lucide-react";
import type { ResearchProject, WorkspaceFileEntry } from "../packages/contracts";
import { MonoMeta, SectionHeader, StatusBadge } from "./ui";

interface CsvSummaryRow {
  column: string;
  n: number;
  mean: number;
  sd: number;
  median: number;
  iqr: number;
  min: number;
  max: number;
}

function flattenCsvFiles(entries: WorkspaceFileEntry[]): string[] {
  const out: string[] = [];
  for (const e of entries) {
    if (e.kind === "file" && e.path.toLowerCase().endsWith(".csv")) out.push(e.path);
    if (e.children) out.push(...flattenCsvFiles(e.children));
  }
  return out;
}

export function StatsWorkbench({
  project,
  files,
  initialCsvPath,
  onSaveFigureComplete,
}: {
  project: ResearchProject;
  files: WorkspaceFileEntry[];
  initialCsvPath?: string;
  onSaveFigureComplete: (project: ResearchProject, savedPath: string) => Promise<void>;
}) {
  const csvFiles = useMemo(() => flattenCsvFiles(files), [files]);
  const [selectedCsv, setSelectedCsv] = useState(initialCsvPath || csvFiles[0] || "");
  const [tableData, setTableData] = useState<{
    columns: string[];
    rows: string[][];
    numericColumns: Record<string, number[]>;
    summaries: CsvSummaryRow[];
  } | null>(null);

  const [colA, setColA] = useState("");
  const [colB, setColB] = useState("");
  const [testResult, setTestResult] = useState<string>("");

  const [powerD, setPowerD] = useState("0.65");
  const [powerAlpha, setPowerAlpha] = useState("0.05");
  const [powerTarget, setPowerTarget] = useState("0.80");
  const [powerOut, setPowerOut] = useState("");

  const [chartKind, setChartKind] = useState<"bar" | "line" | "scatter">("line");
  const [chartTitle, setChartTitle] = useState("Experimental Comparison");
  const [chartSvg, setChartSvg] = useState("");
  const [figFilename, setFigFilename] = useState("validation-chart.svg");
  const [figStatus, setFigStatus] = useState("");

  const loadCsv = async (pathOrText: { filePath?: string; csvText?: string }) => {
    const res = await fetch("/api/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.projectId, action: "analyze-csv", ...pathOrText }),
    });
    const payload = await res.json();
    if (!res.ok) return;
    setTableData(payload);
    const numCols = Object.keys(payload.numericColumns || {});
    if (numCols.length >= 2) {
      setColA(numCols[numCols.length - 2]);
      setColB(numCols[numCols.length - 1]);
    } else if (numCols.length === 1) {
      setColA(numCols[0]);
      setColB(numCols[0]);
    }
  };

  useEffect(() => {
    if (initialCsvPath) setSelectedCsv(initialCsvPath);
  }, [initialCsvPath]);

  useEffect(() => {
    if (selectedCsv) void loadCsv({ filePath: selectedCsv });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCsv, project.projectId]);

  const handleUploadCsv = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const form = new FormData();
    form.set("projectId", project.projectId);
    form.set("folder", "data");
    form.set("file", file);
    const res = await fetch("/api/files", { method: "POST", body: form });
    if (res.ok) {
      const payload = await res.json();
      setSelectedCsv(payload.written.path);
    }
    await loadCsv({ csvText: text });
    e.target.value = "";
  };

  const runTTest = async () => {
    if (!tableData || !colA || !colB) return;
    const groupA = tableData.numericColumns[colA] || [];
    const groupB = tableData.numericColumns[colB] || [];
    const res = await fetch("/api/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "t-test", groupA, groupB }),
    });
    const payload = await res.json();
    if (res.ok) setTestResult(`${colA} vs. ${colB}: ${payload.summary} · 95% CI [${payload.ci95[0].toFixed(2)}, ${payload.ci95[1].toFixed(2)}]`);
    else setTestResult(payload.error || "Failed to run Welch t-test");
  };

  const runCorr = async () => {
    if (!tableData || !colA || !colB) return;
    const xs = tableData.numericColumns[colA] || [];
    const ys = tableData.numericColumns[colB] || [];
    const res = await fetch("/api/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "correlation", xs, ys }),
    });
    const payload = await res.json();
    if (res.ok) setTestResult(`${colA} ~ ${colB}: ${payload.summary}`);
    else setTestResult(payload.error || "Failed to compute correlation");
  };

  const runPower = async () => {
    const res = await fetch("/api/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "power",
        effectSizeD: Number(powerD),
        alpha: Number(powerAlpha),
        power: Number(powerTarget),
      }),
    });
    const payload = await res.json();
    if (res.ok) setPowerOut(`Required sample size: ${payload.perGroupN} per group (${payload.totalN} total) at α=${payload.alpha}, power=${payload.power}, d=${payload.effectSizeD}`);
    else setPowerOut(payload.error || "Power calculation error");
  };

  const buildChartPayload = () => {
    const numCols = Object.keys(tableData?.numericColumns || {});
    const primary = tableData?.numericColumns[colB] || tableData?.numericColumns[numCols[0]] || [];
    const secondary = (colA !== colB ? tableData?.numericColumns[colA] : undefined) || [];
    const labels = tableData?.rows.map((r, i) => r[0] || `${i + 1}`) || [];
    return {
      kind: chartKind,
      title: chartTitle,
      xLabel: tableData?.columns[0] || colA || "Condition",
      yLabel: colB || "Measurement",
      labels,
      values: primary,
      secondaryValues: chartKind === "scatter" ? [] : secondary,
      xValues: secondary.length ? secondary : primary.map((_, i) => i + 1),
      yValues: primary,
      primaryName: colB || "Series B",
      secondaryName: colA || "Series A",
    };
  };

  const previewChart = async () => {
    const res = await fetch("/api/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "render-chart", chart: buildChartPayload() }),
    });
    const payload = await res.json();
    if (res.ok) setChartSvg(payload.svg || "");
    else setFigStatus(payload.error || "Could not render chart");
  };

  const saveFigure = async () => {
    setFigStatus("");
    const res = await fetch("/api/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.projectId,
        action: "save-figure",
        filename: figFilename,
        chart: buildChartPayload(),
      }),
    });
    const payload = await res.json();
    if (!res.ok) {
      setFigStatus(payload.error || "Failed to save SVG figure");
      return;
    }
    setChartSvg(payload.svg || "");
    setFigStatus(`Saved ${payload.path} (SHA-256 ${String(payload.sha256).slice(0, 12)}…)`);
    if (payload.project) await onSaveFigureComplete(payload.project, payload.path);
  };

  const numKeys = Object.keys(tableData?.numericColumns || {});

  return (
    <section className="ori-panel" aria-label="Statistical and Figure Studio">
      <SectionHeader
        eyebrow="Statistical Analysis & Publication Figures"
        title="Statistical Workbench & SVG Chart Studio"
        description="Compute descriptive stats, Welch's two-sample t-test, Pearson correlation, sample-size power, and publication-grade SVG plots from any CSV dataset."
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {csvFiles.length > 0 ? (
              <select
                aria-label="Select workspace CSV dataset"
                className="ori-select"
                style={{ width: 210, padding: "5px 8px", fontSize: 12.5 }}
                value={selectedCsv}
                onChange={(e) => setSelectedCsv(e.target.value)}
              >
                <option value="">Choose CSV...</option>
                {csvFiles.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            ) : null}
            <label className="ori-btn ori-btn--secondary ori-btn--sm" style={{ cursor: "pointer" }}>
              <Upload size={13} /> Upload CSV to data/
              <input type="file" accept=".csv,text/csv" hidden onChange={(e) => void handleUploadCsv(e)} />
            </label>
          </div>
        }
      />

      {tableData && tableData.summaries.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="ori-table-wrap">
            <table className="ori-table">
              <thead>
                <tr><th>Column</th><th>N</th><th>Mean ± SD</th><th>Median (IQR)</th><th>Range</th></tr>
              </thead>
              <tbody>
                {tableData.summaries.map((s) => (
                  <tr key={s.column}>
                    <td><strong>{s.column}</strong></td>
                    <td><MonoMeta>{s.n}</MonoMeta></td>
                    <td><MonoMeta>{s.mean.toFixed(2)} ± {s.sd.toFixed(2)}</MonoMeta></td>
                    <td><MonoMeta>{s.median.toFixed(2)} ({s.iqr.toFixed(2)})</MonoMeta></td>
                    <td><MonoMeta>[{s.min}, {s.max}]</MonoMeta></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <MonoMeta>Compare:</MonoMeta>
            <select aria-label="Column A" className="ori-select" style={{ width: 170 }} value={colA} onChange={(e) => setColA(e.target.value)}>
              {numKeys.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <MonoMeta>vs.</MonoMeta>
            <select aria-label="Column B" className="ori-select" style={{ width: 170 }} value={colB} onChange={(e) => setColB(e.target.value)}>
              {numKeys.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <button type="button" className="ori-btn ori-btn--primary ori-btn--sm" onClick={() => void runTTest()}>
              <Calculator size={13} /> Run Welch t-test
            </button>
            <button type="button" className="ori-btn ori-btn--secondary ori-btn--sm" onClick={() => void runCorr()}>
              Pearson r &amp; Regression
            </button>
          </div>

          {testResult ? (
            <div className="ori-hypothesis-strip">
              <StatusBadge tone="accent">Statistical Output</StatusBadge>
              <MonoMeta>{testResult}</MonoMeta>
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", paddingTop: 10, borderTop: "1px solid var(--border-subtle)" }}>
            <select aria-label="Chart type" className="ori-select" style={{ width: 120 }} value={chartKind} onChange={(e) => setChartKind(e.target.value as "bar" | "line" | "scatter")}>
              <option value="line">Line Chart</option>
              <option value="bar">Bar Chart</option>
              <option value="scatter">Scatter + Fit</option>
            </select>
            <input className="ori-input" style={{ flex: 1, minWidth: 180 }} value={chartTitle} onChange={(e) => setChartTitle(e.target.value)} placeholder="Figure title..." />
            <input className="ori-input" style={{ width: 165 }} value={figFilename} onChange={(e) => setFigFilename(e.target.value)} placeholder="figure.svg" />
            <button type="button" className="ori-btn ori-btn--secondary ori-btn--sm" onClick={() => void previewChart()}>
              <BarChart3 size={13} /> Preview Plot
            </button>
            <button type="button" className="ori-btn ori-btn--primary ori-btn--sm" onClick={() => void saveFigure()}>
              <Save size={13} /> Save SVG to figures/
            </button>
          </div>

          {figStatus ? <MonoMeta>{figStatus}</MonoMeta> : null}

          {chartSvg ? (
            <div style={{ padding: 12, borderRadius: 10, border: "1px solid var(--border-subtle)", background: "#fff", overflowX: "auto" }}>
              <img src={`data:image/svg+xml;utf8,${encodeURIComponent(chartSvg)}`} alt={chartTitle} style={{ maxWidth: "100%", height: "auto" }} />
            </div>
          ) : null}
        </div>
      ) : (
        <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>
          Attach a CSV file above (or load the sample walkthrough with <code>data/arrhenius_eis.csv</code>) to analyze distributions and generate figures.
        </p>
      )}

      {/* A Priori Sample Size & Power Calculator */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
        <strong style={{ fontSize: 13 }}>Sample Size Power Calculator:</strong>
        <label style={{ fontSize: 12 }}>d <input className="ori-input" style={{ width: 72, padding: "4px 6px" }} value={powerD} onChange={(e) => setPowerD(e.target.value)} /></label>
        <label style={{ fontSize: 12 }}>α <input className="ori-input" style={{ width: 72, padding: "4px 6px" }} value={powerAlpha} onChange={(e) => setPowerAlpha(e.target.value)} /></label>
        <label style={{ fontSize: 12 }}>Power <input className="ori-input" style={{ width: 72, padding: "4px 6px" }} value={powerTarget} onChange={(e) => setPowerTarget(e.target.value)} /></label>
        <button type="button" className="ori-btn ori-btn--secondary ori-btn--sm" onClick={() => void runPower()}>Compute N</button>
        {powerOut ? <MonoMeta>{powerOut}</MonoMeta> : null}
      </div>
    </section>
  );
}
