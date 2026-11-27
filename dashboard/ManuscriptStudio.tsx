"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BookMarked,
  CheckCircle2,
  Columns2,
  Download,
  Eye,
  FileText,
  Pencil,
  Quote,
  Save,
  Sparkles,
  Wand2,
} from "lucide-react";
import { CodeEditor, MarkdownMathPreview } from "../components";
import type { CitationStyle, LatexTemplate, ManuscriptDocument, ResearchProject } from "../packages/contracts";
import { auditManuscriptClaims } from "../src/diagnostics";
import { MonoMeta, SectionHeader, StatusBadge } from "./ui";

export function ManuscriptStudio({
  project,
  busy,
  onAction,
  onSelectNode,
}: {
  project: ResearchProject;
  busy: boolean;
  onAction: (action: "draft" | "audit" | "humanize" | "save" | "ai-refine", manuscript?: ManuscriptDocument, extra?: { sectionId?: string }) => void;
  onSelectNode?: (nodeId: string) => void;
}) {
  const [draft, setDraft] = useState<ManuscriptDocument | undefined>(project.manuscript);
  const [paneMode, setPaneMode] = useState<"edit" | "split" | "preview">("split");
  const [activeSecId, setActiveSecId] = useState<string>(project.manuscript?.sections[0]?.id || "introduction");
  const [bibStyle, setBibStyle] = useState<CitationStyle>("apa");
  const [formattedRefs, setFormattedRefs] = useState("");
  const [latexTemplate, setLatexTemplate] = useState<LatexTemplate>("article");

  useEffect(() => {
    setDraft(project.manuscript);
    if (project.manuscript?.sections?.length && !project.manuscript.sections.some((s) => s.id === activeSecId)) {
      setActiveSecId(project.manuscript.sections[0].id);
    }
  }, [project.manuscript, activeSecId]);

  const papers = useMemo(() => project.nodes.filter((n) => n.type === "paper"), [project.nodes]);
  const verifiedEvidence = useMemo(() => project.nodes.filter((n) => n.type === "evidence" && n.data.verified === true), [project.nodes]);
  const claimAudit = useMemo(() => auditManuscriptClaims(draft, project), [draft, project]);

  useEffect(() => {
    if (!papers.length) {
      setFormattedRefs("");
      return;
    }
    let cancelled = false;
    fetch("/api/papers/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.projectId, action: "format", style: bibStyle }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && typeof data.formatted === "string") setFormattedRefs(data.formatted);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [papers.length, project.projectId, bibStyle]);

  const audit = draft?.proseAudit;
  const activeSection = draft?.sections.find((s) => s.id === activeSecId) || draft?.sections[0];

  const insertIntoActiveSection = (snippet: string) => {
    if (!draft || !activeSection) return;
    setDraft({
      ...draft,
      sections: draft.sections.map((s) =>
        s.id === activeSection.id
          ? { ...s, content: `${s.content}${s.content.endsWith("\n") || !s.content ? "" : " "}${snippet}` }
          : s,
      ),
    });
  };

  const fullPreviewMarkdown = useMemo(() => {
    if (!draft) return "";
    return [
      `# ${draft.title}`,
      "",
      `> **Abstract.** ${draft.abstract}`,
      "",
      ...draft.sections.flatMap((s) => [`## ${s.heading}`, "", s.content, ""]),
      formattedRefs ? `## References (${bibStyle.toUpperCase()})\n\n${formattedRefs}` : "",
    ].join("\n");
  }, [draft, formattedRefs, bibStyle]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <section className="ori-section-block">
        <SectionHeader
          eyebrow="Overleaf-Class Synthesis, CSL Citations & Provenance Linter"
          title="Manuscript & Human-Quality Prose Studio"
          description="Compose in CodeMirror Markdown+LaTeX with live KaTeX preview, CSL bibliography formatting, claim-level citation checks, and venue LaTeX export."
          actions={
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="ori-btn ori-btn--primary ori-btn--sm" disabled={busy} onClick={() => onAction("draft")}>
                <FileText size={14} /> {draft ? "Regenerate Draft" : "Draft Manuscript"}
              </button>
              {draft ? (
                <>
                  <button type="button" className="ori-btn ori-btn--secondary ori-btn--sm" disabled={busy} onClick={() => onAction("audit", draft)}>
                    <Sparkles size={14} /> Audit Prose
                  </button>
                  <button type="button" className="ori-btn ori-btn--secondary ori-btn--sm" disabled={busy} onClick={() => onAction("humanize", draft)}>
                    <Wand2 size={14} /> Humanize Pass
                  </button>
                  <button type="button" className="ori-btn ori-btn--ghost ori-btn--sm" disabled={busy} onClick={() => onAction("save", draft)}>
                    <Save size={14} /> Save
                  </button>
                </>
              ) : null}
            </div>
          }
        />

        {audit ? (
          <div className="ori-panel" style={{ background: audit.score >= 85 ? "var(--accent-tint)" : "var(--status-warn-bg)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {audit.score >= 85 ? <CheckCircle2 size={17} style={{ color: "var(--accent)" }} /> : <AlertCircle size={17} style={{ color: "var(--status-warn)" }} />}
                <strong>Prose Quality Score: {audit.score}/100</strong>
                <StatusBadge tone="neutral">{audit.engine === "vale+builtin" ? "Vale + Built-in Rules" : "Built-in Academic Rules"}</StatusBadge>
                <StatusBadge tone={claimAudit.unbackedClaims.length ? "warn" : "ok"}>
                  Citations: {claimAudit.citedSentences}/{claimAudit.totalSentences} sentences · {claimAudit.unbackedClaims.length} unbacked numeric claims
                </StatusBadge>
              </div>
              <MonoMeta>{audit.wordCount} words · {audit.issueCount} flags</MonoMeta>
            </div>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>{audit.summary}</p>
            {claimAudit.unbackedClaims.length > 0 ? (
              <div className="ori-banner ori-banner--warn">
                <AlertCircle size={15} />
                <div>
                  <strong>Unbacked quantitative claims detected:</strong>{" "}
                  {claimAudit.unbackedClaims.slice(0, 3).map((c) => `${c.heading}: "${c.sentence.slice(0, 75)}…"`).join(" | ")}
                </div>
              </div>
            ) : null}
            {audit.issues.length > 0 ? (
              <ul style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {audit.issues.slice(0, 12).map((issue, idx) => (
                  <li key={`${issue.rule}-${idx}`} className="ori-finding-item">
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <StatusBadge tone={issue.severity === "error" ? "danger" : issue.severity === "warning" ? "warn" : "neutral"}>{issue.rule}</StatusBadge>
                      <MonoMeta>{issue.sectionId}</MonoMeta>
                    </div>
                    <p style={{ fontSize: 13 }}>{issue.message}</p>
                    <MonoMeta>&ldquo;{issue.excerpt}&rdquo;</MonoMeta>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      {!draft ? (
        <section className="ori-panel">
          <strong style={{ fontSize: 15 }}>No manuscript drafted yet</strong>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            Click &ldquo;Draft Manuscript&rdquo; above to assemble a structured paper strictly from your canonical state. Once drafted, it is automatically included in HTML, PDF, and venue LaTeX exports.
          </p>
        </section>
      ) : (
        <section className="ori-panel">
          {/* Studio Toolbar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", paddingBottom: 10, borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button type="button" className={`ori-chip-btn${paneMode === "edit" ? " ori-chip-btn--active" : ""}`} onClick={() => setPaneMode("edit")}>
                <Pencil size={12} /> Edit
              </button>
              <button type="button" className={`ori-chip-btn${paneMode === "split" ? " ori-chip-btn--active" : ""}`} onClick={() => setPaneMode("split")}>
                <Columns2 size={12} /> Split
              </button>
              <button type="button" className={`ori-chip-btn${paneMode === "preview" ? " ori-chip-btn--active" : ""}`} onClick={() => setPaneMode("preview")}>
                <Eye size={12} /> Live Typeset Preview
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select
                aria-label="CSL bibliography style"
                className="ori-select"
                style={{ width: 130, padding: "4px 8px", fontSize: 12.5 }}
                value={bibStyle}
                onChange={(e) => setBibStyle(e.target.value as CitationStyle)}
              >
                <option value="apa">CSL: APA</option>
                <option value="ieee">CSL: IEEE</option>
                <option value="vancouver">CSL: Vancouver</option>
                <option value="harvard1">CSL: Harvard</option>
              </select>
              <select
                aria-label="LaTeX venue template"
                className="ori-select"
                style={{ width: 155, padding: "4px 8px", fontSize: 12.5 }}
                value={latexTemplate}
                onChange={(e) => setLatexTemplate(e.target.value as LatexTemplate)}
              >
                <option value="article">LaTeX: Standard</option>
                <option value="ieee">LaTeX: IEEEtran</option>
                <option value="neurips">LaTeX: NeurIPS</option>
                <option value="nature">LaTeX: Nature</option>
              </select>
              <a
                className="ori-btn ori-btn--secondary ori-btn--sm"
                href={`/api/exports/latex?projectId=${encodeURIComponent(project.projectId)}&template=${encodeURIComponent(latexTemplate)}`}
                download={`main-${latexTemplate}.tex`}
              >
                <Download size={13} /> Download .tex
              </a>
            </div>
          </div>

          <div className={paneMode === "split" ? "ori-split-workbench" : ""}>
            {paneMode !== "preview" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="ori-field">
                  <label htmlFor="ms-title">Manuscript Title</label>
                  <input
                    id="ms-title"
                    className="ori-input"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />
                </div>
                <div className="ori-field">
                  <label htmlFor="ms-abstract">Abstract</label>
                  <textarea
                    id="ms-abstract"
                    className="ori-textarea"
                    rows={3}
                    value={draft.abstract}
                    onChange={(e) => setDraft({ ...draft, abstract: e.target.value })}
                  />
                </div>

                {/* Section Tabs + Quick Insert Chips */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {draft.sections.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`ori-chip-btn${s.id === activeSection?.id ? " ori-chip-btn--active" : ""}`}
                      onClick={() => setActiveSecId(s.id)}
                    >
                      {s.heading}
                    </button>
                  ))}
                </div>

                {activeSection ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <strong style={{ fontSize: 13.5 }}>{activeSection.heading}</strong>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {papers.length > 0 ? (
                          <button
                            type="button"
                            className="ori-chip-btn"
                            onClick={() => insertIntoActiveSection(`[@${papers[0].data.citeKey || papers[0].id}]`)}
                          >
                            <BookMarked size={12} /> + Cite ({papers[0].data.citeKey || "paper"})
                          </button>
                        ) : null}
                        {verifiedEvidence.length > 0 ? (
                          <button
                            type="button"
                            className="ori-chip-btn"
                            onClick={() => insertIntoActiveSection(`"${verifiedEvidence[0].data.quote}" [${verifiedEvidence[0].id}]`)}
                          >
                            <Quote size={12} /> + Confirmed Quote
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="ori-btn ori-btn--secondary ori-btn--sm"
                          disabled={busy}
                          onClick={() => onAction("ai-refine", draft, { sectionId: activeSection.id })}
                          title="Requires configured Gemini/Vertex/Gemma key; strictly grounded in verified nodes"
                        >
                          <Sparkles size={12} /> Gemini Polish Section
                        </button>
                      </div>
                    </div>
                    <CodeEditor
                      language="markdown"
                      value={activeSection.content}
                      minHeight={280}
                      ariaLabel={`Edit section ${activeSection.heading}`}
                      onChange={(next) =>
                        setDraft({
                          ...draft,
                          sections: draft.sections.map((s) => (s.id === activeSection.id ? { ...s, content: next } : s)),
                        })
                      }
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {paneMode !== "edit" ? (
              <div className="ori-preview-pane">
                <MarkdownMathPreview
                  markdown={fullPreviewMarkdown}
                  projectId={project.projectId}
                  onOpenCitation={(citeKey) => {
                    const p = papers.find((item) => item.data.citeKey === citeKey || item.id === citeKey);
                    if (p && onSelectNode) onSelectNode(p.id);
                  }}
                />
              </div>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}
