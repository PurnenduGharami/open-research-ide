"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import {
  BookMarked,
  Columns2,
  Download,
  Eye,
  FilePlus2,
  FlaskConical,
  Link2,
  Pencil,
  Save,
  Sigma,
  Upload,
  X,
} from "lucide-react";
import { CodeEditor, MarkdownMathPreview } from "../components";
import type { EditorLanguage } from "../components";
import type { ResearchProject, WorkspaceFileEntry } from "../packages/contracts";
import { MonoMeta, SectionHeader, StatusBadge } from "./ui";

interface OpenFileTab {
  path: string;
  name: string;
  category: WorkspaceFileEntry["category"];
  mimeType: string;
  isText: boolean;
  size: number;
  sha256: string;
  content: string;
  dirty: boolean;
  backlinks: Array<{ from: string; excerpt: string }>;
}

function flattenFiles(entries: WorkspaceFileEntry[]): WorkspaceFileEntry[] {
  const out: WorkspaceFileEntry[] = [];
  for (const e of entries) {
    if (e.kind === "file") out.push(e);
    if (e.children) out.push(...flattenFiles(e.children));
  }
  return out;
}

function editorLangForPath(filePath: string): EditorLanguage {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".ts")) return "javascript";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".md") || lower.endsWith(".tex")) return "markdown";
  return "text";
}

function parseQuickCsvPreview(csv: string): { cols: string[]; rows: string[][] } {
  const lines = String(csv || "").split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return { cols: [], rows: [] };
  const split = (r: string) => r.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
  return {
    cols: split(lines[0]),
    rows: lines.slice(1, 31).map(split),
  };
}

export function FilesWorkspace({
  project,
  files,
  requestedFilePath,
  busy,
  onRefreshFiles,
  onSelectNode,
  onOpenInStats,
}: {
  project: ResearchProject;
  files: WorkspaceFileEntry[];
  requestedFilePath?: string;
  busy: boolean;
  onRefreshFiles: () => Promise<void>;
  onSelectNode: (nodeId: string) => void;
  onOpenInStats: (csvPath: string) => void;
}) {
  const [tabs, setTabs] = useState<OpenFileTab[]>([]);
  const [activePath, setActivePath] = useState<string>("");
  const [paneMode, setPaneMode] = useState<"split" | "edit" | "preview">("split");
  const [newNoteName, setNewNoteName] = useState("");
  const [uploadFolder, setUploadFolder] = useState("data");
  const [statusMsg, setStatusMsg] = useState<string>();
  const [saving, setSaving] = useState(false);

  const flat = useMemo(() => flattenFiles(files), [files]);
  const papers = useMemo(() => project.nodes.filter((n) => n.type === "paper"), [project.nodes]);

  const openFile = async (relPath: string) => {
    const existing = tabs.find((t) => t.path === relPath);
    if (existing) {
      setActivePath(relPath);
      return;
    }
    const res = await fetch(`/api/files?projectId=${encodeURIComponent(project.projectId)}&path=${encodeURIComponent(relPath)}`);
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || "Could not open file");
    const f = payload.file;
    const tab: OpenFileTab = {
      path: f.path,
      name: f.name,
      category: f.category,
      mimeType: f.mimeType,
      isText: Boolean(f.isText),
      size: f.size,
      sha256: f.sha256,
      content: typeof f.text === "string" ? f.text : "",
      dirty: false,
      backlinks: payload.backlinks || [],
    };
    setTabs((prev) => [...prev.filter((t) => t.path !== relPath), tab]);
    setActivePath(relPath);
  };

  useEffect(() => {
    if (requestedFilePath) {
      void openFile(requestedFilePath).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedFilePath, project.projectId]);

  useEffect(() => {
    if (!activePath && flat.length > 0 && tabs.length === 0) {
      const preferred = flat.find((f) => f.path === "notes/lab-notebook.md") || flat.find((f) => f.path.endsWith(".md")) || flat[0];
      if (preferred) void openFile(preferred.path).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flat, project.projectId]);

  const activeTab = tabs.find((t) => t.path === activePath);

  const saveTab = async (tab: OpenFileTab) => {
    setSaving(true);
    setStatusMsg(undefined);
    try {
      const res = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.projectId, action: "write", path: tab.path, content: tab.content }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Save failed");
      setTabs((prev) => prev.map((t) => (t.path === tab.path ? { ...t, dirty: false, sha256: payload.written.sha256 } : t)));
      setStatusMsg(`Saved ${tab.path} (${payload.written.size} B)`);
      await onRefreshFiles();
    } finally {
      setSaving(false);
    }
  };

  const createNote = async () => {
    const clean = newNoteName.trim().replace(/^\/+/, "");
    if (!clean) return;
    const target = clean.includes("/") ? clean : `notes/${clean.endsWith(".md") ? clean : `${clean}.md`}`;
    const starter = `# ${clean.replace(/\.md$/i, "").replace(/[-_]+/g, " ")}\n\n- Linked investigation: \`${project.title}\`\n\n$$E = mc^2$$\n`;
    await fetch("/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.projectId, action: "write", path: target, content: starter }),
    });
    setNewNoteName("");
    await onRefreshFiles();
    await openFile(target);
  };

  const handleUploadFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.set("projectId", project.projectId);
    form.set("folder", uploadFolder);
    form.set("file", file);
    const res = await fetch("/api/files", { method: "POST", body: form });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || "Upload failed");
    setStatusMsg(`Uploaded ${payload.written.path}`);
    await onRefreshFiles();
    await openFile(payload.written.path);
    e.target.value = "";
  };

  const insertSnippet = (snippet: string) => {
    if (!activeTab) return;
    setTabs((prev) =>
      prev.map((t) =>
        t.path === activeTab.path ? { ...t, content: `${t.content}${t.content.endsWith("\n") || !t.content ? "" : "\n"}${snippet}`, dirty: true } : t,
      ),
    );
  };

  const closeTab = (pathToClose: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.path !== pathToClose);
      if (activePath === pathToClose) setActivePath(next[0]?.path || "");
      return next;
    });
  };

  const isMarkdown = activeTab?.path.toLowerCase().endsWith(".md");
  const isCsv = activeTab?.path.toLowerCase().endsWith(".csv");
  const isImage = activeTab ? /\.(svg|png|jpg|jpeg)$/i.test(activeTab.path) : false;
  const isPdf = activeTab?.path.toLowerCase().endsWith(".pdf");

  const handleWikilink = (target: string) => {
    const matchingNode = project.nodes.find((n) => n.id === target || n.title.toLowerCase() === target.toLowerCase());
    if (matchingNode) {
      onSelectNode(matchingNode.id);
      return;
    }
    const matchingFile = flat.find((f) => f.path === target || f.name === target || `notes/${target}` === f.path);
    if (matchingFile) void openFile(matchingFile.path);
  };

  const handleCiteClick = (citeKey: string) => {
    const paper = papers.find((p) => p.data.citeKey === citeKey || p.id === citeKey);
    if (paper) onSelectNode(paper.id);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <section className="ori-section-block">
        <SectionHeader
          eyebrow="VS Code-Class Research Workbench"
          title="Files, Lab Notebooks & KaTeX Studio"
          description="Organize Markdown+KaTeX notes, scripts, CSV datasets, figures, and PDFs inside real project folders—always bundled in RO-Crate ZIP exports."
          actions={
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select
                aria-label="Target upload folder"
                className="ori-select"
                style={{ width: 120, padding: "5px 8px", fontSize: 12.5 }}
                value={uploadFolder}
                onChange={(e) => setUploadFolder(e.target.value)}
              >
                <option value="notes">notes/</option>
                <option value="data">data/</option>
                <option value="scripts">scripts/</option>
                <option value="figures">figures/</option>
                <option value="drafts">drafts/</option>
              </select>
              <label className="ori-btn ori-btn--secondary ori-btn--sm" style={{ cursor: "pointer" }}>
                <Upload size={13} /> Upload File
                <input type="file" hidden onChange={(e) => void handleUploadFile(e)} />
              </label>
            </div>
          }
        />

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="ori-input"
            style={{ maxWidth: 280 }}
            placeholder="New note (e.g. experiment-log.md)"
            value={newNoteName}
            onChange={(e) => setNewNoteName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void createNote(); }}
          />
          <button type="button" className="ori-btn ori-btn--secondary ori-btn--sm" disabled={busy || !newNoteName.trim()} onClick={() => void createNote()}>
            <FilePlus2 size={14} /> Create Note
          </button>
          <select
            aria-label="Quick open workspace file"
            className="ori-select"
            style={{ maxWidth: 260 }}
            value={activePath}
            onChange={(e) => { if (e.target.value) void openFile(e.target.value); }}
          >
            <option value="">Open file ({flat.length})...</option>
            {flat.map((f) => <option key={f.path} value={f.path}>{f.path}</option>)}
          </select>
          {statusMsg ? <MonoMeta>{statusMsg}</MonoMeta> : null}
        </div>
      </section>

      {/* Multi-Tab Bar */}
      {tabs.length > 0 ? (
        <div className="ori-tab-strip" role="tablist" aria-label="Open workspace tabs">
          {tabs.map((tab) => (
            <div key={tab.path} className={`ori-file-tab${tab.path === activePath ? " ori-file-tab--active" : ""}`}>
              <button type="button" className="ori-file-tab-btn" onClick={() => setActivePath(tab.path)}>
                <span>{tab.name}{tab.dirty ? " ●" : ""}</span>
              </button>
              <button type="button" className="ori-file-tab-close" aria-label={`Close ${tab.name}`} onClick={() => closeTab(tab.path)}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {!activeTab ? (
        <section className="ori-panel">
          <strong style={{ fontSize: 15 }}>No file selected</strong>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            Select any file from the left Explorer sidebar or create a new Markdown + KaTeX lab notebook above.
          </p>
        </section>
      ) : (
        <section className="ori-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 14.5 }}>{activeTab.path}</strong>
              <StatusBadge tone="neutral">{activeTab.category}</StatusBadge>
              <MonoMeta>{(activeTab.size / 1024).toFixed(1)} KB</MonoMeta>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {isMarkdown ? (
                <>
                  <button type="button" className={`ori-chip-btn${paneMode === "edit" ? " ori-chip-btn--active" : ""}`} onClick={() => setPaneMode("edit")}>
                    <Pencil size={12} /> Edit
                  </button>
                  <button type="button" className={`ori-chip-btn${paneMode === "split" ? " ori-chip-btn--active" : ""}`} onClick={() => setPaneMode("split")}>
                    <Columns2 size={12} /> Split
                  </button>
                  <button type="button" className={`ori-chip-btn${paneMode === "preview" ? " ori-chip-btn--active" : ""}`} onClick={() => setPaneMode("preview")}>
                    <Eye size={12} /> Preview
                  </button>
                  <button type="button" className="ori-chip-btn" onClick={() => insertSnippet("$$\\Delta G = \\Delta H - T\\Delta S$$")}>
                    <Sigma size={12} /> + Math
                  </button>
                  {papers[0] ? (
                    <button
                      type="button"
                      className="ori-chip-btn"
                      onClick={() => insertSnippet(`[@${papers[0].data.citeKey || papers[0].id}]`)}
                    >
                      <BookMarked size={12} /> + Cite
                    </button>
                  ) : null}
                  {papers[0] ? (
                    <button type="button" className="ori-chip-btn" onClick={() => insertSnippet(`[[${papers[0].id}]]`)}>
                      <Link2 size={12} /> + Wikilink
                    </button>
                  ) : null}
                </>
              ) : null}
              {isCsv ? (
                <button type="button" className="ori-btn ori-btn--secondary ori-btn--sm" onClick={() => onOpenInStats(activeTab.path)}>
                  <FlaskConical size={13} /> Open in Statistical Lab
                </button>
              ) : null}
              {activeTab.isText ? (
                <button
                  type="button"
                  className="ori-btn ori-btn--primary ori-btn--sm"
                  disabled={saving || !activeTab.dirty}
                  onClick={() => void saveTab(activeTab)}
                >
                  <Save size={13} /> {saving ? "Saving…" : "Save"}
                </button>
              ) : null}
              <a
                className="ori-btn ori-btn--ghost ori-btn--sm"
                href={`/api/files?projectId=${encodeURIComponent(project.projectId)}&path=${encodeURIComponent(activeTab.path)}&raw=1`}
                download={activeTab.name}
              >
                <Download size={13} /> Download
              </a>
            </div>
          </div>

          {isImage ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
              <div style={{ padding: 16, borderRadius: 10, border: "1px solid var(--border-subtle)", background: "#fff", width: "100%", overflowX: "auto" }}>
                <img
                  src={`/api/files?projectId=${encodeURIComponent(project.projectId)}&path=${encodeURIComponent(activeTab.path)}&raw=1`}
                  alt={activeTab.name}
                  style={{ maxWidth: "100%", height: "auto" }}
                />
              </div>
              <MonoMeta>Markdown embed: ![{activeTab.name}]({activeTab.path})</MonoMeta>
            </div>
          ) : isPdf ? (
            <div style={{ padding: 14, borderRadius: 10, background: "var(--bg-subtle)", fontSize: 13 }}>
              Binary PDF saved at <code>{activeTab.path}</code> (SHA-256 <code>{activeTab.sha256.slice(0, 16)}…</code>).
              Use <strong>Literature → Full-Text PDF Reader</strong> to read extracted pages and anchor verbatim quotes.
            </div>
          ) : isMarkdown ? (
            <div className={paneMode === "split" ? "ori-split-workbench" : ""}>
              {paneMode !== "preview" ? (
                <CodeEditor
                  language="markdown"
                  value={activeTab.content}
                  minHeight={340}
                  ariaLabel={`Editing ${activeTab.path}`}
                  onChange={(next) =>
                    setTabs((prev) => prev.map((t) => (t.path === activeTab.path ? { ...t, content: next, dirty: true } : t)))
                  }
                />
              ) : null}
              {paneMode !== "edit" ? (
                <div className="ori-preview-pane">
                  <MarkdownMathPreview
                    markdown={activeTab.content}
                    projectId={project.projectId}
                    onOpenWikilink={handleWikilink}
                    onOpenCitation={handleCiteClick}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <CodeEditor
                language={editorLangForPath(activeTab.path)}
                value={activeTab.content}
                minHeight={300}
                ariaLabel={`Editing ${activeTab.path}`}
                onChange={(next) =>
                  setTabs((prev) => prev.map((t) => (t.path === activeTab.path ? { ...t, content: next, dirty: true } : t)))
                }
              />
              {isCsv ? (() => {
                const table = parseQuickCsvPreview(activeTab.content);
                if (!table.cols.length) return null;
                return (
                  <div className="ori-table-wrap">
                    <table className="ori-table">
                      <thead><tr>{table.cols.map((c, idx) => <th key={`${c}-${idx}`}>{c}</th>)}</tr></thead>
                      <tbody>
                        {table.rows.map((row, rIdx) => (
                          <tr key={rIdx}>{row.map((cell, cIdx) => <td key={cIdx}><MonoMeta>{cell}</MonoMeta></td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })() : null}
            </div>
          )}

          {activeTab.backlinks.length > 0 ? (
            <div style={{ paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
              <MonoMeta>BACKLINKS ({activeTab.backlinks.length})</MonoMeta>
              <ul style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                {activeTab.backlinks.map((b, idx) => (
                  <li key={`${b.from}-${idx}`} style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                    <strong>{b.from}:</strong> {b.excerpt}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
