"use client";

import { useId, useMemo } from "react";
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Download,
  FileCode2,
  FileText,
  History,
  LoaderCircle,
  Package,
  Printer,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PriceKind, ResearchExport, ResearchProject } from "../packages/contracts";

export interface ExportPanelProps {
  project: ResearchProject | null;
  onExport: () => void;
  busy: boolean;
  error?: string;
}

type ExportFormat = ResearchExport["format"];

const FORMATS: Array<{
  id: ExportFormat;
  title: string;
  description: string;
  output: string;
  endpoint: string;
  icon: LucideIcon;
}> = [
  {
    id: "html",
    title: "Interactive Research Dossier",
    description: "Standalone, CSP-safe HTML with embedded SVG knowledge graph, expected-vs-observed tables, manuscript, and timeline.",
    output: "research-report.html",
    endpoint: "/api/exports/html",
    icon: FileCode2,
  },
  {
    id: "pdf",
    title: "Print-Ready Report",
    description: "Paginated PDF generated with clean Apple-style print typography and deterministic timestamps.",
    output: "research-report.pdf",
    endpoint: "/api/exports/pdf",
    icon: Printer,
  },
  {
    id: "latex",
    title: "Academic Manuscript (LaTeX)",
    description: "Clean editable main.tex and references.bib using @article / @inproceedings entries without raw internal hashes.",
    output: "main.tex + references.bib",
    endpoint: "/api/exports/latex",
    icon: FileText,
  },
  {
    id: "zip",
    title: "Complete Archive (ZIP)",
    description: "One-click reproducible dossier bundling HTML, PDF, main.tex, references.bib, and canonical research-project.json.",
    output: "open-research-bundle.zip",
    endpoint: "/api/exports/zip",
    icon: Package,
  },
];

const PRICE_LABELS: Record<PriceKind, string> = {
  quoted: "Quoted",
  "model-estimated": "Model-estimated",
  unavailable: "Unavailable",
};

function compareExports(a: ResearchExport, b: ResearchExport): number {
  return b.createdAt.localeCompare(a.createdAt) || b.revision - a.revision || a.id.localeCompare(b.id);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date)} UTC`;
}

export function ExportPanel({ project, onExport, busy, error }: ExportPanelProps) {
  const titleId = useId();
  const actionHintId = useId();
  const history = useMemo(() => [...(project?.exports ?? [])].sort(compareExports), [project?.exports]);
  const latestByFormat = useMemo(() => {
    const latest = new Map<ExportFormat, ResearchExport>();
    for (const item of history) if (!latest.has(item.format)) latest.set(item.format, item);
    return latest;
  }, [history]);

  if (!project) {
    return (
      <section className="exp-shell exp-shell--empty" aria-label="Research exports">
        <Archive size={26} strokeWidth={1.5} aria-hidden="true" />
        <h2>No canonical revision to export</h2>
        <p>Start an investigation first. HTML, PDF, LaTeX, and ZIP archives are generated strictly from committed project state.</p>
      </section>
    );
  }

  const evidence = project.nodes.filter((node) => node.type === "evidence");
  const verified = evidence.filter((node) => node.data.verified === true).length;
  const labs = project.nodes.filter((node) => node.type === "lab" && node.data.price);
  const activeContentRev = project.contentRevision ?? project.revision;
  const currentExported = history.some((item) => (item.contentRevision ?? item.revision) === activeContentRev);
  const projectQuery = `?projectId=${encodeURIComponent(project.projectId)}`;

  return (
    <section className="exp-shell" aria-labelledby={titleId} aria-busy={busy}>
      <header className="exp-header">
        <div>
          <h2 id={titleId}>Publication & Export Studio</h2>
          <p>Generate HTML, PDF, Academic LaTeX/BibTeX, and a complete ZIP dossier from the same canonical revision.</p>
        </div>
        <button type="button" className="exp-generate" onClick={onExport} disabled={busy} aria-describedby={actionHintId}>
          {busy ? <LoaderCircle className="exp-spinner" size={17} aria-hidden="true" /> : <Download size={17} aria-hidden="true" />}
          {busy ? "Generating exports…" : `Export revision ${project.revision}`}
        </button>
      </header>
      <p id={actionHintId} className="exp-action-hint">
        {busy ? "Server generation is running. Existing downloads stay intact until completion." : "One action builds all four reproducible formats deterministically."}
      </p>

      {error ? (
        <div className="exp-error" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <div><strong>Export could not be completed</strong><p>{error}</p></div>
        </div>
      ) : null}

      {currentExported ? (
        <div className="exp-fresh-note">
          <CheckCircle2 size={17} aria-hidden="true" />
          <p>Exports are up to date with the latest research content (content revision {activeContentRev}).</p>
        </div>
      ) : history.length ? (
        <div className="exp-stale-note">
          <History size={17} aria-hidden="true" />
          <p>Research content changed since the last export. Click Export to refresh all four formats.</p>
        </div>
      ) : null}

      <div className="exp-formats">
        {FORMATS.map((format) => {
          const Icon = format.icon;
          const latest = latestByFormat.get(format.id);
          return (
            <article className="exp-format" key={format.id}>
              <div className="exp-format-heading">
                <Icon size={20} strokeWidth={1.6} aria-hidden="true" />
                <h3>{format.title}</h3>
              </div>
              <p>{format.description}</p>
              <code className="exp-output">{format.output}</code>
              <div className="exp-download-row">
                {latest ? (
                  <span className="exp-download-links">
                    <a className="exp-download" href={`${format.endpoint}${projectQuery}`} download aria-label={`Download ${format.title}, revision ${latest.revision}`}>
                      <Download size={15} aria-hidden="true" /> Download r{latest.revision}
                    </a>
                    {format.id === "latex" ? (
                      <a className="exp-download-secondary" href={`/api/exports/bib${projectQuery}`} download>references.bib</a>
                    ) : null}
                  </span>
                ) : (
                  <span className="exp-download-pending">Generate to enable download</span>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <section className="exp-integrity" aria-labelledby={`${titleId}-integrity`}>
        <div className="exp-integrity-heading">
          <ShieldCheck size={19} strokeWidth={1.7} aria-hidden="true" />
          <div><h3 id={`${titleId}-integrity`}>Revision integrity</h3><p>Every export retains evidence confirmation status, frozen predictions, and lab-price provenance.</p></div>
        </div>
        <dl className="exp-evidence-summary">
          <div><dt>Canonical revision</dt><dd>r{project.revision}</dd></div>
          <div><dt>Verified evidence</dt><dd>{verified} of {evidence.length}</dd></div>
          <div><dt>Unverified evidence</dt><dd>{evidence.length - verified}</dd></div>
        </dl>
        <div className="exp-price-labels" aria-label="Lab pricing labels retained in exports">
          {(Object.keys(PRICE_LABELS) as PriceKind[]).map((kind) => {
            const count = labs.filter((node) => node.data.price?.kind === kind).length;
            return <span className={`exp-price exp-price--${kind}`} key={kind}>{PRICE_LABELS[kind]} · {count}</span>;
          })}
        </div>
        <p className="exp-integrity-note"><CheckCircle2 size={14} aria-hidden="true" /> Model estimates remain clearly separated from written facility quotes.</p>
      </section>

      <section className="exp-history" aria-labelledby={`${titleId}-history`}>
        <div className="exp-history-heading"><History size={18} aria-hidden="true" /><h3 id={`${titleId}-history`}>Export manifest history</h3><span>{history.length} files</span></div>
        {history.length ? (
          <ol className="exp-history-list">
            {history.map((item) => (
              <li key={item.id}>
                <span className="exp-history-format">{item.format === "latex" ? "TeX" : item.format.toUpperCase()}</span>
                <div className="exp-history-copy">
                  <strong>Revision {item.revision}</strong>
                  <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                  <span className="exp-history-path">{item.path}</span>
                  <span className="exp-history-hash">SHA-256 <code>{item.sha256}</code></span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="exp-history-empty"><Archive size={18} aria-hidden="true" /><p>No export files generated yet. Click Export revision {project.revision} above.</p></div>
        )}
      </section>
    </section>
  );
}
