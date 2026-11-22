"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, FileText, Save, Sparkles, Wand2 } from "lucide-react";
import type { ManuscriptDocument, ResearchProject } from "../packages/contracts";
import { MonoMeta, SectionHeader, StatusBadge } from "./ui";

export function ManuscriptStudio({
  project,
  busy,
  onAction,
}: {
  project: ResearchProject;
  busy: boolean;
  onAction: (action: "draft" | "audit" | "humanize" | "save", manuscript?: ManuscriptDocument) => void;
}) {
  const [draft, setDraft] = useState<ManuscriptDocument | undefined>(project.manuscript);

  useEffect(() => {
    setDraft(project.manuscript);
  }, [project.manuscript]);

  const audit = draft?.proseAudit;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <section className="ori-section-block">
        <SectionHeader
          eyebrow="Synthesis & Prose Linting"
          title="Manuscript & Human-Quality Prose Studio"
          description="Synthesizes verified literature, reviews, frozen expectations, and results—then audits prose with Vale, avoid-ai-writing, and humanizer rules."
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
          <div className="ori-panel" style={{ background: audit.score >= 85 ? "#f7f9fe" : "var(--status-warn-bg)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {audit.score >= 85 ? <CheckCircle2 size={17} style={{ color: "var(--accent)" }} /> : <AlertCircle size={17} style={{ color: "var(--status-warn)" }} />}
                <strong>Prose Quality Score: {audit.score}/100</strong>
                <StatusBadge tone="neutral">{audit.engine === "vale+builtin" ? "Vale + Built-in Rules" : "Built-in Academic Rules"}</StatusBadge>
              </div>
              <MonoMeta>{audit.wordCount} words · {audit.issueCount} flags</MonoMeta>
            </div>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>{audit.summary}</p>
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
            Click &ldquo;Draft Manuscript&rdquo; above to assemble a structured paper strictly from your canonical state. Once drafted, it is automatically included in HTML, PDF, and LaTeX exports.
          </p>
        </section>
      ) : (
        <section className="ori-panel">
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
              rows={4}
              value={draft.abstract}
              onChange={(e) => setDraft({ ...draft, abstract: e.target.value })}
            />
          </div>
          {draft.sections.map((section, idx) => (
            <div className="ori-field" key={section.id}>
              <label htmlFor={`ms-sec-${section.id}`}>{section.heading}</label>
              <textarea
                id={`ms-sec-${section.id}`}
                className="ori-textarea"
                rows={6}
                value={section.content}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    sections: draft.sections.map((s, i) => (i === idx ? { ...s, content: e.target.value } : s)),
                  })
                }
              />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
