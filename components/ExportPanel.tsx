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
  href: "/api/exports/html" | "/api/exports/pdf" | "/api/exports/latex";
  icon: LucideIcon;
}> = [
  {
    id: "html",
    title: "Standalone HTML",
    description: "An interactive, self-contained research journey with its evidence and critique trail intact.",
    output: "research-report.html",
    href: "/api/exports/html",
    icon: FileCode2,
  },
  {
    id: "pdf",
    title: "Print-derived PDF",
    description: "A paginated rendering of the same report, with light print styling and readable source details.",
    output: "research-report.pdf",
    href: "/api/exports/pdf",
    icon: Printer,
  },
  {
    id: "latex",
    title: "LaTeX sources",
    description: "Editable main.tex and references.bib sources. The download may be a ZIP archive or main.tex.",
    output: "main.tex + references.bib",
    href: "/api/exports/latex",
    icon: FileText,
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
        <p>Start an investigation first. HTML, PDF, and LaTeX will be generated from committed project state—not from browser-only content.</p>
      </section>
    );
  }

  const evidence = project.nodes.filter((node) => node.type === "evidence");
  const verified = evidence.filter((node) => node.data.verified === true).length;
  const labs = project.nodes.filter((node) => node.type === "lab" && node.data.price);
  const currentExported = history.some((item) => item.revision === project.revision);

  return (
    <section className="exp-shell" aria-labelledby={titleId} aria-busy={busy}>
      <header className="exp-header">
        <div>
          <h2 id={titleId}>Faithful exports</h2>
          <p>Generate all three formats together from canonical revision {project.revision}. The server writes the files; this panel never fabricates a download.</p>
        </div>
        <button type="button" className="exp-generate" onClick={onExport} disabled={busy} aria-describedby={actionHintId}>
          {busy ? <LoaderCircle className="exp-spinner" size={17} aria-hidden="true" /> : <Download size={17} aria-hidden="true" />}
          {busy ? "Generating exports…" : `Export revision ${project.revision}`}
        </button>
      </header>
      <p id={actionHintId} className="exp-action-hint">
        {busy ? "Server generation is in progress. Existing downloads remain unchanged until completion." : "One action generates HTML, PDF, and LaTeX from the same revision."}
      </p>

      {error ? (
        <div className="exp-error" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <div><strong>Export could not be completed</strong><p>{error}</p></div>
        </div>
      ) : null}

      {!currentExported && history.length ? (
        <div className="exp-stale-note">
          <History size={17} aria-hidden="true" />
          <p>Revision {project.revision} has not been exported. Downloads below are from their recorded earlier revisions.</p>
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
                    <a className="exp-download" href={format.href} download aria-label={`Download ${format.title}, revision ${latest.revision}`}>
                      <Download size={15} aria-hidden="true" /> Download r{latest.revision}
                    </a>
                    {format.id === "latex" ? <a className="exp-download-secondary" href="/api/exports/bib" download>references.bib</a> : null}
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
          <div><h3 id={`${titleId}-integrity`}>Revision integrity</h3><p>Every format preserves evidence verification and lab-price provenance.</p></div>
        </div>
        <dl className="exp-evidence-summary">
          <div><dt>Canonical revision</dt><dd>{project.revision}</dd></div>
          <div><dt>Verified evidence</dt><dd>{verified} of {evidence.length}</dd></div>
          <div><dt>Unverified evidence</dt><dd>{evidence.length - verified}</dd></div>
        </dl>
        <div className="exp-price-labels" aria-label="Lab pricing labels retained in exports">
          {(Object.keys(PRICE_LABELS) as PriceKind[]).map((kind) => {
            const count = labs.filter((node) => node.data.price?.kind === kind).length;
            return <span className={`exp-price exp-price--${kind}`} key={kind}>{PRICE_LABELS[kind]} · {count}</span>;
          })}
        </div>
        <p className="exp-integrity-note"><CheckCircle2 size={14} aria-hidden="true" /> Model estimates remain labelled and are never presented as vendor quotes.</p>
      </section>

      <section className="exp-history" aria-labelledby={`${titleId}-history`}>
        <div className="exp-history-heading"><History size={18} aria-hidden="true" /><h3 id={`${titleId}-history`}>Export history</h3><span>{history.length} files</span></div>
        {history.length ? (
          <ol className="exp-history-list">
            {history.map((item) => (
              <li key={item.id}>
                <span className={`exp-history-format exp-history-format--${item.format}`}>{item.format === "latex" ? "TeX" : item.format.toUpperCase()}</span>
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
          <div className="exp-history-empty"><Archive size={18} aria-hidden="true" /><p>No files have been generated yet. Use “Export revision {project.revision}” to create the first manifest entries.</p></div>
        )}
      </section>
    </section>
  );
}
