"use client";

import { useEffect, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  FilePlus2,
  FlaskConical,
  FolderOpen,
  LoaderCircle,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import type { InvestigationMode, RecentPaperCard, ResearchProjectSummary } from "../packages/contracts";
import { MonoMeta, SectionHeader, StatusBadge } from "./ui";

const TOPICS = [
  { id: "all", label: "All Fields" },
  { id: "ai", label: "AI & ML" },
  { id: "chemistry", label: "Chemistry & Materials" },
  { id: "biology", label: "Biology & Health" },
  { id: "systems", label: "Software & Systems" },
  { id: "psychology", label: "Psychology & Economics" },
];

export function LandingHome({
  projects,
  busy,
  error,
  onStart,
  onLoadSample,
  onCreateBlank,
  onImportBundle,
  onSelectProject,
  onDeleteProject,
}: {
  projects: ResearchProjectSummary[];
  busy: boolean;
  error?: string;
  onStart: (curiosity: string, mode: InvestigationMode) => void;
  onLoadSample: () => void;
  onCreateBlank: () => void;
  onImportBundle: (file: File) => void;
  onSelectProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
}) {
  const [curiosity, setCuriosity] = useState("");
  const [mode, setMode] = useState<InvestigationMode>("guided");
  const [topic, setTopic] = useState("all");
  const [papers, setPapers] = useState<RecentPaperCard[]>([]);
  const [loadingPapers, setLoadingPapers] = useState(true);
  const [feedError, setFeedError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setLoadingPapers(true);
    setFeedError(undefined);
    fetch(`/api/papers/recent?topic=${encodeURIComponent(topic)}&limit=6`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data.papers)) setPapers(data.papers);
        else setFeedError(data.error || "Recent papers could not be loaded right now.");
      })
      .catch((cause) => {
        if (!cancelled) setFeedError(cause instanceof Error ? cause.message : "Could not reach literature APIs.");
      })
      .finally(() => {
        if (!cancelled) setLoadingPapers(false);
      });
    return () => { cancelled = true; };
  }, [topic]);

  const submitQuery = () => {
    const trimmed = curiosity.trim();
    if (trimmed.length < 10 || busy) return;
    onStart(trimmed, mode);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submitQuery();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitQuery();
    }
  };

  const sparkFromPaper = (paper: RecentPaperCard) => {
    const prompt = `Investigate "${paper.title}"${paper.doi ? ` (DOI: ${paper.doi})` : ""}: what are its core claims, limitations, contradictions with prior work, and a testable follow-up hypothesis?`;
    onStart(prompt, mode);
  };

  const trimmedLen = curiosity.trim().length;

  return (
    <main id="ori-main-content" className="ori-discovery-page">
      {/* 1. Editorial Hero + Central Research Input + Compact Mode Cards */}
      <section className="ori-hero-section">
        <div className="ori-hero-inner">
          <h1 className="ori-hero-title">What are you curious about?</h1>
          <p className="ori-hero-subtitle">
            Investigate any question from peer-reviewed literature through independent critique and real-world validation.
          </p>

          <ul className="ori-capabilities" aria-label="Core capabilities">
            <li><BookOpen size={14} aria-hidden="true" /> <span>Literature discovery</span></li>
            <li aria-hidden="true" className="ori-cap-sep" />
            <li><ShieldCheck size={14} aria-hidden="true" /> <span>Evidence analysis</span></li>
            <li aria-hidden="true" className="ori-cap-sep" />
            <li><FlaskConical size={14} aria-hidden="true" /> <span>Real-world validation</span></li>
          </ul>

          <form className="ori-hero-form" onSubmit={handleSubmit}>
            <div className="ori-research-composer">
              <div className="ori-composer-input-row">
                <Search size={17} className="ori-composer-icon" aria-hidden="true" />
                <label htmlFor="ori-landing-curiosity" className="ori-visually-hidden">Research curiosity</label>
                <textarea
                  id="ori-landing-curiosity"
                  rows={2}
                  value={curiosity}
                  onChange={(e) => setCuriosity(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a scientific question, hypothesis, or mechanism to investigate (e.g., Why aren't sodium-ion cathodes replacing LFP in grid storage yet?)"
                  minLength={10}
                  maxLength={4000}
                  required
                  disabled={busy}
                />
              </div>
              <div className="ori-composer-footer">
                <span className="ori-composer-hint">
                  {trimmedLen > 0 && trimmedLen < 10
                    ? `${10 - trimmedLen} more characters to start`
                    : "Grounded in OpenAlex, Semantic Scholar & arXiv · Press Enter to begin"}
                </span>
                <button
                  type="submit"
                  className="ori-btn ori-btn--primary"
                  disabled={busy || trimmedLen < 10}
                >
                  {busy ? <LoaderCircle size={15} className="ori-spin" /> : null}
                  <span>Start research</span>
                  {!busy ? <ArrowRight size={15} aria-hidden="true" /> : null}
                </button>
              </div>
            </div>

            <div className="ori-mode-cards" role="radiogroup" aria-label="Investigation mode">
              <button
                type="button"
                role="radio"
                aria-checked={mode === "guided"}
                className={`ori-mode-card${mode === "guided" ? " ori-mode-card--selected" : ""}`}
                onClick={() => setMode("guided")}
              >
                <span className="ori-mode-radio" aria-hidden="true" />
                <span className="ori-mode-copy">
                  <strong>Guided Research</strong>
                  <span>The user controls the investigation and reviews individual stages.</span>
                </span>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={mode === "autonomous"}
                className={`ori-mode-card${mode === "autonomous" ? " ori-mode-card--selected" : ""}`}
                onClick={() => setMode("autonomous")}
              >
                <span className="ori-mode-radio" aria-hidden="true" />
                <span className="ori-mode-copy">
                  <strong>Autonomous Investigation</strong>
                  <span>Agents independently investigate, review literature and prepare validation plans.</span>
                </span>
              </button>
            </div>

            {error ? (
              <div className="ori-banner ori-banner--danger" role="alert">
                <span>{error}</span>
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className="ori-btn ori-btn--secondary ori-btn--sm"
                onClick={onLoadSample}
                disabled={busy}
              >
                <FlaskConical size={14} aria-hidden="true" />
                <span>Explore Sample Investigation (No API key needed)</span>
              </button>
              <button
                type="button"
                className="ori-btn ori-btn--ghost ori-btn--sm"
                onClick={onCreateBlank}
                disabled={busy}
              >
                <FilePlus2 size={14} aria-hidden="true" />
                <span>New Blank Workspace</span>
              </button>
              <label className="ori-btn ori-btn--ghost ori-btn--sm" style={{ cursor: "pointer" }}>
                <Upload size={14} aria-hidden="true" />
                <span>Import Research Bundle (.zip / .json)</span>
                <input
                  type="file"
                  accept=".zip,.json,application/zip,application/json"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onImportBundle(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </form>
        </div>

        <a href="#recent-literature" className="ori-scroll-cue">
          <span>Explore recent peer-reviewed literature</span>
          <ArrowDown size={14} aria-hidden="true" />
        </a>
      </section>

      {/* 2. Scientific Literature Discovery Platform */}
      <section id="recent-literature" className="ori-discovery-section" aria-labelledby="ori-recent-papers-title">
        <div className="ori-container">
          <div className="ori-feed-header">
            <div>
              <h2 id="ori-recent-papers-title" className="ori-feed-title">Recent Peer-Reviewed Literature</h2>
              <p className="ori-feed-sub">Select a paper to inspect its claims, surface contradictions, and design follow-up tests.</p>
            </div>
            <MonoMeta>Live index · OpenAlex &amp; arXiv</MonoMeta>
          </div>

          <div className="ori-tab-strip" role="toolbar" aria-label="Filter recent papers by category">
            {TOPICS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`ori-tab-btn${topic === item.id ? " ori-tab-btn--active" : ""}`}
                onClick={() => setTopic(item.id)}
                aria-pressed={topic === item.id}
              >
                {item.label}
              </button>
            ))}
          </div>

          {loadingPapers ? (
            <div className="ori-feed-loading">
              <LoaderCircle size={16} className="ori-spin" />
              <span>Retrieving recent peer-reviewed publications…</span>
            </div>
          ) : feedError && papers.length === 0 ? (
            <div className="ori-banner ori-banner--warn">
              <span>Live paper feed temporarily unavailable ({feedError}). You can still submit any question above.</span>
            </div>
          ) : (
            <ul className="ori-paper-feed">
              {papers.map((paper) => (
                <li className="ori-paper-row" key={paper.id}>
                  <div className="ori-paper-row-meta">
                    <span className="ori-paper-date">{paper.publishedDate || paper.year || "Recent"}</span>
                    <div className="ori-paper-tags">
                      <StatusBadge tone="neutral">{paper.provider}</StatusBadge>
                      <span className="ori-paper-cat">{paper.topic}</span>
                    </div>
                    {paper.doi ? <MonoMeta>{paper.doi}</MonoMeta> : null}
                  </div>

                  <div className="ori-paper-row-main">
                    <h3>
                      <button
                        type="button"
                        className="ori-paper-title-btn"
                        onClick={() => sparkFromPaper(paper)}
                        disabled={busy}
                      >
                        {paper.title}
                      </button>
                    </h3>
                    <p className="ori-paper-byline">
                      {paper.authors.length ? paper.authors.join(", ") : "Authors indexed in source"}
                      {paper.venue ? ` · ${paper.venue}` : ""}
                    </p>
                    <p className="ori-paper-excerpt">{paper.abstract}</p>
                  </div>

                  <div className="ori-paper-row-actions">
                    <button
                      type="button"
                      className="ori-btn ori-btn--secondary ori-btn--sm"
                      onClick={() => sparkFromPaper(paper)}
                      disabled={busy}
                    >
                      <span>Investigate</span>
                      <ArrowRight size={13} aria-hidden="true" />
                    </button>
                    {paper.url ? (
                      <a href={paper.url} target="_blank" rel="noreferrer" className="ori-inline-source-link">
                        <span>Source</span>
                        <ArrowUpRight size={13} aria-hidden="true" />
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 3. Saved Investigations (Clean Divider Section — Only Shown When Projects Exist) */}
      {projects.length > 0 ? (
        <section className="ori-discovery-section ori-discovery-section--saved" aria-labelledby="ori-saved-title">
          <div className="ori-container">
            <SectionHeader
              eyebrow="Local Workspace"
              title="Saved Investigations"
              description="Persistent research workspaces with revisioned evidence, reviews, and exports."
            />

            <ul className="ori-saved-list">
              {projects.map((item) => (
                <li className="ori-saved-row" key={item.projectId}>
                  <div className="ori-saved-main">
                    <div className="ori-saved-title-row">
                      <button type="button" className="ori-saved-link" onClick={() => onSelectProject(item.projectId)}>
                        {item.title}
                      </button>
                      <MonoMeta>r{item.revision}</MonoMeta>
                      <StatusBadge tone={item.status === "error" ? "danger" : item.status === "investigating" ? "accent" : "neutral"}>
                        {item.status}
                      </StatusBadge>
                      <StatusBadge tone="neutral">{item.mode === "autonomous" ? "Autonomous" : "Guided"}</StatusBadge>
                    </div>
                    <p className="ori-saved-stats">
                      {item.paperCount} papers · {item.verifiedEvidenceCount}/{item.evidenceCount} verified evidence · {item.experimentCount} experiments · {item.resultCount} results
                    </p>
                  </div>
                  <div className="ori-saved-actions">
                    <button type="button" className="ori-btn ori-btn--secondary ori-btn--sm" onClick={() => onSelectProject(item.projectId)}>
                      <FolderOpen size={14} aria-hidden="true" />
                      <span>Open</span>
                    </button>
                    <button
                      type="button"
                      className="ori-icon-btn"
                      aria-label={`Delete ${item.title}`}
                      onClick={() => onDeleteProject(item.projectId)}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </main>
  );
}
