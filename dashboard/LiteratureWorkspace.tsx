"use client";

import { useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  GitBranch,
  Plus,
  Search,
  Upload,
  X,
} from "lucide-react";
import type { CitationStyle, ReadingStatus, ResearchNode, ResearchProject } from "../packages/contracts";
import { MonoMeta, SectionHeader, StatusBadge } from "./ui";

export function LiteratureWorkspace({
  project,
  busy,
  onSelectNode,
  onAddPaperByDoi,
  onUpdateNode,
  onAddManualEvidence,
  onImportReferences,
  onSearchDirect,
  onAddSearchedPapers,
  onUploadPdf,
  onFetchOaPdf,
  onSnowballPaper,
}: {
  project: ResearchProject;
  busy: boolean;
  onSelectNode: (id: string) => void;
  onAddPaperByDoi: (doi: string) => void;
  onUpdateNode: (nodeId: string, patch: { title?: string; data?: Record<string, unknown> }) => void;
  onAddManualEvidence: (paperId: string, quote: string, title?: string, meta?: { sourceField?: "abstract" | "fullText"; page?: number }) => void;
  onImportReferences: (payload: Record<string, unknown>) => Promise<void>;
  onSearchDirect: (query: string) => Promise<Array<Record<string, unknown>>>;
  onAddSearchedPapers: (papers: Array<Record<string, unknown>>) => Promise<void>;
  onUploadPdf: (file: File, paperId?: string) => Promise<void>;
  onFetchOaPdf: (paperId: string) => Promise<void>;
  onSnowballPaper: (paperId: string, direction: "references" | "citations" | "both") => Promise<void>;
}) {
  const papers = project.nodes.filter((n) => n.type === "paper");
  const [doiInput, setDoiInput] = useState("");
  const [directQuery, setDirectQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<Record<string, unknown>>>([]);
  const [searching, setSearching] = useState(false);

  const [prismaFilter, setPrismaFilter] = useState<ReadingStatus | "all">("all");
  const [searchFilter, setSearchFilter] = useState("");

  const [showBibModal, setShowBibModal] = useState(false);
  const [bibText, setBibText] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualAuthors, setManualAuthors] = useState("");
  const [manualYear, setManualYear] = useState("2025");
  const [manualVenue, setManualVenue] = useState("");
  const [manualDoi, setManualDoi] = useState("");
  const [manualAbstract, setManualAbstract] = useState("");

  const [citeStyle, setCiteStyle] = useState<CitationStyle>("apa");
  const [formattedBib, setFormattedBib] = useState("");
  const [showCiteModal, setShowCiteModal] = useState(false);

  const [readerPaperId, setReaderPaperId] = useState<string | null>(null);
  const [readerPage, setReaderPage] = useState(1);
  const [readerSearch, setReaderSearch] = useState("");
  const [pdfQuote, setPdfQuote] = useState("");
  const [pdfQuoteTitle, setPdfQuoteTitle] = useState("");
  const pdfDialogRef = useRef<HTMLDialogElement>(null);

  const prismaCounts = useMemo(() => {
    const counts: Record<ReadingStatus, number> = { "to-read": 0, reading: 0, included: 0, excluded: 0 };
    for (const p of papers) {
      const s = (p.data.readingStatus as ReadingStatus) || "to-read";
      counts[s] = (counts[s] || 0) + 1;
    }
    return counts;
  }, [papers]);

  const filteredPapers = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    return papers.filter((p) => {
      const status = (p.data.readingStatus as ReadingStatus) || "to-read";
      if (prismaFilter !== "all" && status !== prismaFilter) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        (p.data.venue || "").toLowerCase().includes(q) ||
        (p.data.doi || "").toLowerCase().includes(q) ||
        (p.data.authors || []).join(" ").toLowerCase().includes(q)
      );
    });
  }, [papers, prismaFilter, searchFilter]);

  const readerPaper = papers.find((p) => p.id === readerPaperId);
  const readerPages = Array.isArray(readerPaper?.data.pages) && readerPaper.data.pages.length
    ? readerPaper.data.pages
    : readerPaper?.data.fullText
      ? [{ page: 1, text: readerPaper.data.fullText }]
      : [];
  const activePageObj = readerPages.find((pg) => pg.page === readerPage) || readerPages[0];

  const handleDirectSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!directQuery.trim()) return;
    setSearching(true);
    try {
      const hits = await onSearchDirect(directQuery.trim());
      setSearchResults(hits);
    } finally {
      setSearching(false);
    }
  };

  const handleAddDoi = (e: FormEvent) => {
    e.preventDefault();
    if (!doiInput.trim() || busy) return;
    onAddPaperByDoi(doiInput.trim());
    setDoiInput("");
  };

  const formatLibrary = async (style: CitationStyle) => {
    setCiteStyle(style);
    const res = await fetch("/api/papers/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.projectId, action: "format", style }),
    });
    const payload = await res.json();
    if (res.ok) setFormattedBib(payload.formatted || "");
    setShowCiteModal(true);
  };

  const handleBibFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBibText(await file.text());
    e.target.value = "";
  };

  const openPdfReader = (paper: ResearchNode) => {
    setReaderPaperId(paper.id);
    setReaderPage(1);
    setPdfQuote("");
    setPdfQuoteTitle("");
    pdfDialogRef.current?.showModal();
  };

  const capturePdfSelection = () => {
    const selected = window.getSelection()?.toString().trim();
    if (selected && readerPaper?.data.fullText?.includes(selected)) {
      setPdfQuote(selected);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <section className="ori-section-block">
        <SectionHeader
          eyebrow="Zotero-Class Source Library, PRISMA & PDF Reader"
          title="Peer-Reviewed Literature & Full-Text Screening"
          description="Search OpenAlex, Semantic Scholar & arXiv directly (no AI required), import .bib/.ris/PDFs, track PRISMA screening status, snowball citations, and anchor quotes."
          actions={
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="ori-btn ori-btn--secondary ori-btn--sm" onClick={() => setShowBibModal(true)}>
                <Plus size={13} /> Import .bib / .ris / Manual
              </button>
              <label className="ori-btn ori-btn--secondary ori-btn--sm" style={{ cursor: "pointer" }}>
                <Upload size={13} /> Upload PDF
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onUploadPdf(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <button type="button" className="ori-btn ori-btn--secondary ori-btn--sm" onClick={() => void formatLibrary(citeStyle)} disabled={!papers.length}>
                <BookOpen size={13} /> Format Bibliography (CSL)
              </button>
            </div>
          }
        />

        {/* Direct Literature Search + DOI Bar */}
        <div className="ori-grid-2">
          <form onSubmit={(e) => void handleDirectSearch(e)} style={{ display: "flex", gap: 8 }}>
            <input
              className="ori-input"
              placeholder="Direct index search (OpenAlex + Semantic Scholar + arXiv)..."
              value={directQuery}
              onChange={(e) => setDirectQuery(e.target.value)}
            />
            <button type="submit" className="ori-btn ori-btn--primary ori-btn--sm" disabled={searching || directQuery.trim().length < 2}>
              <Search size={14} /> {searching ? "Searching…" : "Search"}
            </button>
          </form>

          <form onSubmit={handleAddDoi} style={{ display: "flex", gap: 8 }}>
            <input
              className="ori-input"
              placeholder="Add paper by DOI (e.g. 10.1038/s41586-023-06221-2)"
              value={doiInput}
              onChange={(e) => setDoiInput(e.target.value)}
              disabled={busy}
            />
            <button type="submit" className="ori-btn ori-btn--secondary ori-btn--sm" disabled={busy || !doiInput.trim()}>
              <Plus size={14} /> Add DOI
            </button>
          </form>
        </div>

        {/* Direct Search Candidate Results */}
        {searchResults.length > 0 ? (
          <div className="ori-panel" style={{ background: "var(--accent-tint)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: 13.5 }}>Live Search Results ({searchResults.length})</strong>
              <button type="button" className="ori-btn ori-btn--ghost ori-btn--sm" onClick={() => setSearchResults([])}>Dismiss</button>
            </div>
            <ul style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {searchResults.map((p, idx) => (
                <li key={String(p.id || idx)} className="ori-inspector-card" style={{ padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                    <div>
                      <strong style={{ fontSize: 13.5 }}>{String(p.title)}</strong>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                        {Array.isArray(p.authors) ? p.authors.slice(0, 3).join(", ") : ""} · {String(p.venue || p.provider || "")} ({String(p.year || "n.d.")})
                        {typeof p.citationCount === "number" ? ` · ${p.citationCount} citations` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="ori-btn ori-btn--primary ori-btn--sm"
                      disabled={busy}
                      onClick={() => void onAddSearchedPapers([p])}
                    >
                      <Plus size={13} /> Add
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* PRISMA Screening Bar */}
        <div className="ori-prisma-bar" role="toolbar" aria-label="PRISMA screening filter">
          <button type="button" className={`ori-chip-btn${prismaFilter === "all" ? " ori-chip-btn--active" : ""}`} onClick={() => setPrismaFilter("all")}>
            All ({papers.length})
          </button>
          <button type="button" className={`ori-chip-btn${prismaFilter === "to-read" ? " ori-chip-btn--active" : ""}`} onClick={() => setPrismaFilter("to-read")}>
            To Read ({prismaCounts["to-read"]})
          </button>
          <button type="button" className={`ori-chip-btn${prismaFilter === "reading" ? " ori-chip-btn--active" : ""}`} onClick={() => setPrismaFilter("reading")}>
            Reading ({prismaCounts.reading})
          </button>
          <button type="button" className={`ori-chip-btn${prismaFilter === "included" ? " ori-chip-btn--active" : ""}`} onClick={() => setPrismaFilter("included")}>
            Included ({prismaCounts.included})
          </button>
          <button type="button" className={`ori-chip-btn${prismaFilter === "excluded" ? " ori-chip-btn--active" : ""}`} onClick={() => setPrismaFilter("excluded")}>
            Excluded ({prismaCounts.excluded})
          </button>
          <input
            className="ori-input"
            style={{ maxWidth: 240, marginLeft: "auto", padding: "5px 10px", fontSize: 12.5 }}
            placeholder="Filter library..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
        </div>

        {/* Paper Table */}
        {!filteredPapers.length ? (
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>No papers match the current PRISMA filter.</p>
        ) : (
          <div className="ori-table-wrap">
            <table className="ori-table">
              <thead>
                <tr>
                  <th>Publication &amp; CiteKey</th>
                  <th>Year / Cites</th>
                  <th>PRISMA Stage</th>
                  <th>Full Text &amp; Snowball</th>
                </tr>
              </thead>
              <tbody>
                {filteredPapers.map((paper) => {
                  const status = (paper.data.readingStatus as ReadingStatus) || "to-read";
                  const hasFullText = typeof paper.data.fullText === "string" && paper.data.fullText.length > 0;
                  return (
                    <tr key={paper.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <button type="button" className="ori-text-link" style={{ fontWeight: 600 }} onClick={() => onSelectNode(paper.id)}>
                            {paper.title}
                          </button>
                          {paper.data.isRetracted ? (
                            <StatusBadge tone="danger"><AlertTriangle size={11} /> RETRACTED</StatusBadge>
                          ) : null}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                          {paper.data.authors?.slice(0, 3).join(", ") || "Authors indexed"}
                          {paper.data.venue ? ` · ${paper.data.venue}` : ""}
                          {paper.data.citeKey ? ` · [@${paper.data.citeKey}]` : ""}
                        </div>
                        {paper.data.doi ? (
                          <a href={`https://doi.org/${paper.data.doi}`} target="_blank" rel="noreferrer" className="ori-text-link" style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", marginTop: 2 }}>
                            {paper.data.doi} <ExternalLink size={10} />
                          </a>
                        ) : null}
                      </td>
                      <td>
                        <MonoMeta>{paper.data.year ?? "—"}</MonoMeta>
                        {typeof paper.data.citationCount === "number" ? (
                          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{paper.data.citationCount} cites</div>
                        ) : null}
                      </td>
                      <td>
                        <select
                          aria-label={`Reading status for ${paper.title}`}
                          className="ori-select"
                          style={{ minWidth: 115, padding: "4px 8px", fontSize: 12.5 }}
                          value={status}
                          disabled={busy}
                          onChange={(e) => onUpdateNode(paper.id, { data: { readingStatus: e.target.value } })}
                        >
                          <option value="to-read">To Read</option>
                          <option value="reading">Reading</option>
                          <option value="included">Included</option>
                          <option value="excluded">Excluded</option>
                        </select>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {hasFullText ? (
                            <button type="button" className="ori-btn ori-btn--primary ori-btn--sm" onClick={() => openPdfReader(paper)}>
                              <FileText size={12} /> Read PDF ({paper.data.pageCount || 1}p)
                            </button>
                          ) : paper.data.openAccessUrl ? (
                            <button type="button" className="ori-btn ori-btn--secondary ori-btn--sm" disabled={busy} onClick={() => void onFetchOaPdf(paper.id)}>
                              <Download size={12} /> Fetch OA PDF
                            </button>
                          ) : null}
                          <label className="ori-btn ori-btn--ghost ori-btn--sm" style={{ cursor: "pointer" }} title="Attach local PDF">
                            <Upload size={12} /> PDF
                            <input
                              type="file"
                              accept="application/pdf,.pdf"
                              hidden
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) void onUploadPdf(f, paper.id);
                                e.target.value = "";
                              }}
                            />
                          </label>
                          {(paper.data.doi || paper.data.providerIds?.OpenAlex) ? (
                            <button
                              type="button"
                              className="ori-btn ori-btn--ghost ori-btn--sm"
                              disabled={busy}
                              title="Expand references and citing papers via OpenAlex"
                              onClick={() => void onSnowballPaper(paper.id, "both")}
                            >
                              <GitBranch size={12} /> Snowball
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Import .bib / .ris / Manual Reference Panel */}
      {showBibModal ? (
        <section className="ori-panel" aria-label="Import BibTeX, RIS, or manual paper">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ fontSize: 15 }}>Import References (.bib / .ris / Manual Entry)</strong>
            <button type="button" className="ori-icon-btn" aria-label="Close reference import" onClick={() => setShowBibModal(false)}>
              <X size={15} />
            </button>
          </div>
          <div className="ori-grid-2">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: 13 }}>Paste BibTeX, RIS, or CSL-JSON</strong>
                <label className="ori-btn ori-btn--ghost ori-btn--sm" style={{ cursor: "pointer" }}>
                  <Upload size={12} /> Load .bib / .ris file
                  <input type="file" accept=".bib,.ris,.json,.txt" hidden onChange={(e) => void handleBibFileUpload(e)} />
                </label>
              </div>
              <textarea
                className="ori-textarea"
                rows={7}
                placeholder={`@article{smith2025,\n  author = {Smith, Jane},\n  title = {Empirical Benchmark},\n  journal = {Science},\n  year = {2025},\n  doi = {10.1000/xyz}\n}`}
                value={bibText}
                onChange={(e) => setBibText(e.target.value)}
              />
              <button
                type="button"
                className="ori-btn ori-btn--primary ori-btn--sm"
                disabled={busy || bibText.trim().length < 10}
                onClick={async () => {
                  await onImportReferences({ action: "parse", text: bibText });
                  setBibText("");
                  setShowBibModal(false);
                }}
              >
                Import Parsed Records
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <strong style={{ fontSize: 13 }}>Or Add Manual Reference Record</strong>
              <input className="ori-input" placeholder="Title (required)" value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} />
              <div className="ori-grid-2">
                <input className="ori-input" placeholder="Authors (comma separated)" value={manualAuthors} onChange={(e) => setManualAuthors(e.target.value)} />
                <input className="ori-input" placeholder="Year (e.g. 2025)" value={manualYear} onChange={(e) => setManualYear(e.target.value)} />
              </div>
              <div className="ori-grid-2">
                <input className="ori-input" placeholder="Journal / Conference" value={manualVenue} onChange={(e) => setManualVenue(e.target.value)} />
                <input className="ori-input" placeholder="DOI (optional)" value={manualDoi} onChange={(e) => setManualDoi(e.target.value)} />
              </div>
              <textarea className="ori-textarea" rows={2} placeholder="Abstract snapshot (optional)" value={manualAbstract} onChange={(e) => setManualAbstract(e.target.value)} />
              <button
                type="button"
                className="ori-btn ori-btn--secondary ori-btn--sm"
                disabled={busy || manualTitle.trim().length < 3}
                onClick={async () => {
                  await onImportReferences({
                    action: "manual",
                    title: manualTitle,
                    authors: manualAuthors,
                    year: manualYear,
                    venue: manualVenue,
                    doi: manualDoi,
                    abstract: manualAbstract,
                  });
                  setManualTitle(""); setManualAuthors(""); setManualVenue(""); setManualDoi(""); setManualAbstract("");
                  setShowBibModal(false);
                }}
              >
                Save Manual Reference
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {/* CSL Bibliography Formatter Panel */}
      {showCiteModal ? (
        <section className="ori-panel" aria-label="Formatted Bibliography">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <strong style={{ fontSize: 15 }}>CSL Bibliography &amp; Export Formatter</strong>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["apa", "ieee", "vancouver", "harvard1", "bibtex", "ris"] as CitationStyle[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`ori-chip-btn${citeStyle === st ? " ori-chip-btn--active" : ""}`}
                  onClick={() => void formatLibrary(st)}
                >
                  {st.toUpperCase()}
                </button>
              ))}
              <button type="button" className="ori-icon-btn" aria-label="Close formatter" onClick={() => setShowCiteModal(false)}>
                <X size={15} />
              </button>
            </div>
          </div>
          <pre className="ori-terminal-out" style={{ background: "var(--bg-subtle)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)" }}>
            {formattedBib || "No formatted references."}
          </pre>
          <div>
            <button
              type="button"
              className="ori-btn ori-btn--secondary ori-btn--sm"
              onClick={() => void navigator.clipboard?.writeText(formattedBib)}
            >
              <Copy size={13} /> Copy Bibliography
            </button>
          </div>
        </section>
      ) : null}

      {/* Full-Text Paginated PDF Reader Modal */}
      <dialog ref={pdfDialogRef} className="ori-dialog ori-dialog--wide" aria-label="Full-Text PDF Reader and Evidence Anchoring">
        <div className="ori-dialog-head">
          <div>
            <h2>{readerPaper?.title || "Full-Text PDF Reader"}</h2>
            <MonoMeta>
              {readerPages.length} pages · SHA-256 {(readerPaper?.data.fullTextSha256 || "").slice(0, 16)}…
            </MonoMeta>
          </div>
          <button type="button" className="ori-icon-btn" aria-label="Close PDF reader" onClick={() => pdfDialogRef.current?.close()}>
            <X size={16} />
          </button>
        </div>
        <div className="ori-dialog-body">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <button type="button" className="ori-btn ori-btn--secondary ori-btn--sm" disabled={readerPage <= 1} onClick={() => setReaderPage((p) => Math.max(1, p - 1))}>
                Prev Page
              </button>
              <MonoMeta>Page {readerPage} of {readerPages.length}</MonoMeta>
              <button type="button" className="ori-btn ori-btn--secondary ori-btn--sm" disabled={readerPage >= readerPages.length} onClick={() => setReaderPage((p) => Math.min(readerPages.length, p + 1))}>
                Next Page
              </button>
            </div>
            <input
              className="ori-input"
              style={{ maxWidth: 260 }}
              placeholder="Find page containing phrase..."
              value={readerSearch}
              onChange={(e) => {
                const q = e.target.value;
                setReaderSearch(q);
                if (q.trim().length >= 3) {
                  const found = readerPages.find((pg) => pg.text.toLowerCase().includes(q.trim().toLowerCase()));
                  if (found) setReaderPage(found.page);
                }
              }}
            />
          </div>

          <div
            onMouseUp={capturePdfSelection}
            style={{ padding: 16, borderRadius: 10, background: "var(--bg-subtle)", fontSize: 13.5, lineHeight: 1.65, maxHeight: 310, overflowY: "auto", whiteSpace: "pre-wrap" }}
          >
            {activePageObj?.text || "No text extracted for this page."}
          </div>

          {readerPaper ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <strong style={{ fontSize: 13 }}>Highlight text above (or paste verbatim substring from Page {readerPage}) to SHA-256 anchor:</strong>
              <input className="ori-input" placeholder="Evidence claim label (optional)" value={pdfQuoteTitle} onChange={(e) => setPdfQuoteTitle(e.target.value)} />
              <textarea className="ori-textarea" rows={2} placeholder="Exact verbatim passage from PDF..." value={pdfQuote} onChange={(e) => setPdfQuote(e.target.value)} />
              <div>
                <button
                  type="button"
                  className="ori-btn ori-btn--primary ori-btn--sm"
                  disabled={busy || pdfQuote.trim().length < 8}
                  onClick={() => {
                    onAddManualEvidence(readerPaper.id, pdfQuote.trim(), pdfQuoteTitle.trim() || `Full-text p.${readerPage} evidence`, {
                      sourceField: "fullText",
                      page: readerPage,
                    });
                    setPdfQuote("");
                    setPdfQuoteTitle("");
                    pdfDialogRef.current?.close();
                  }}
                >
                  <CheckCircle2 size={13} /> Anchor &amp; Confirm Evidence (Page {readerPage})
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </dialog>
    </div>
  );
}
