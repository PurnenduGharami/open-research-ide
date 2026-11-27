"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Command, FileText, Network, Search, X } from "lucide-react";
import type { ResearchProject, ViewId, WorkspaceFileEntry } from "../packages/contracts";

interface PaletteItem {
  id: string;
  group: "Command" | "File" | "Artifact";
  title: string;
  subtitle: string;
  run: () => void;
}

function flattenFiles(entries: WorkspaceFileEntry[]): WorkspaceFileEntry[] {
  const out: WorkspaceFileEntry[] = [];
  for (const e of entries) {
    if (e.kind === "file") out.push(e);
    if (e.children) out.push(...flattenFiles(e.children));
  }
  return out;
}

export function CommandPalette({
  open,
  initialMode = "commands",
  project,
  files,
  onClose,
  onSwitchView,
  onOpenFile,
  onSelectNode,
  onCreateNewNote,
  onExport,
  onToggleSidebar,
  onTriggerReview,
}: {
  open: boolean;
  initialMode?: "commands" | "search";
  project: ResearchProject | null;
  files: WorkspaceFileEntry[];
  onClose: () => void;
  onSwitchView: (view: ViewId) => void;
  onOpenFile: (path: string) => void;
  onSelectNode: (nodeId: string, view?: ViewId) => void;
  onCreateNewNote: () => void;
  onExport: () => void;
  onToggleSidebar: () => void;
  onTriggerReview: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"commands" | "search">(initialMode);
  const [searchResults, setSearchResults] = useState<{
    fileMatches: Array<{ path: string; line: number; snippet: string }>;
    nodeMatches: Array<{ nodeId: string; type: string; title: string; snippet: string }>;
    manuscriptMatches: Array<{ sectionId: string; heading: string; snippet: string }>;
  } | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode, open]);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open) {
      if (!dlg.open) dlg.showModal();
      setTimeout(() => inputRef.current?.focus(), 20);
    } else if (dlg.open) {
      dlg.close();
      setQuery("");
      setSearchResults(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || mode !== "search" || !project || query.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?projectId=${encodeURIComponent(project.projectId)}&q=${encodeURIComponent(query.trim())}`);
        if (res.ok) setSearchResults(await res.json());
      } finally {
        setSearching(false);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [open, mode, project, query]);

  const items = useMemo<PaletteItem[]>(() => {
    const commands: PaletteItem[] = [
      { id: "cmd:view:research", group: "Command", title: "View: Investigation Canvas & Planning", subtitle: "Open main canvas, tasks, and hypothesis matrix", run: () => onSwitchView("research") },
      { id: "cmd:view:workspace", group: "Command", title: "View: Files & Notes Workbench", subtitle: "Markdown + KaTeX notebooks, CSV, scripts, figures", run: () => onSwitchView("workspace") },
      { id: "cmd:view:literature", group: "Command", title: "View: Literature, PRISMA & PDF Library", subtitle: "Search papers, import BibTeX/RIS, read PDFs, snowball citations", run: () => onSwitchView("literature") },
      { id: "cmd:view:experiments", group: "Command", title: "View: Validation & Statistical Lab", subtitle: "CodeMirror runner, Welch t-test, correlation, SVG charts", run: () => onSwitchView("experiments") },
      { id: "cmd:view:graph", group: "Command", title: "View: Knowledge Graph", subtitle: "Visual evidence and citation network", run: () => onSwitchView("graph") },
      { id: "cmd:view:manuscript", group: "Command", title: "View: Manuscript & LaTeX Studio", subtitle: "Split-pane Markdown/KaTeX/CSL drafting & prose lint", run: () => onSwitchView("manuscript") },
      { id: "cmd:view:published", group: "Command", title: "View: Published & RO-Crate Archive", subtitle: "Export HTML, PDF, LaTeX templates & ZIP bundle", run: () => onSwitchView("published") },
      { id: "cmd:new-note", group: "Command", title: "File: Create New Lab Note", subtitle: "Create a Markdown + KaTeX note inside notes/", run: onCreateNewNote },
      { id: "cmd:toggle-sidebar", group: "Command", title: "Workbench: Toggle Left Explorer Sidebar", subtitle: "Ctrl+B", run: onToggleSidebar },
      { id: "cmd:review", group: "Command", title: "Review: Run Zero-Memory Review Panel", subtitle: "Evaluate latest hypothesis with 3 independent reviewers", run: onTriggerReview },
      { id: "cmd:export", group: "Command", title: "Export: Generate RO-Crate ZIP & Reports", subtitle: "Build HTML, PDF, LaTeX, BibTeX & RO-Crate archive", run: onExport },
    ];

    const fileItems: PaletteItem[] = flattenFiles(files).map((f) => ({
      id: `file:${f.path}`,
      group: "File",
      title: f.path,
      subtitle: `${f.category} · ${(f.size / 1024).toFixed(1)} KB`,
      run: () => {
        onOpenFile(f.path);
        onSwitchView("workspace");
      },
    }));

    const nodeItems: PaletteItem[] = (project?.nodes || []).map((n) => ({
      id: `node:${n.id}`,
      group: "Artifact",
      title: n.title,
      subtitle: `${n.type} · ${n.id}`,
      run: () => onSelectNode(n.id),
    }));

    const all = [...commands, ...fileItems, ...nodeItems];
    const q = query.trim().toLowerCase();
    if (!q) return all.slice(0, 18);
    return all.filter((item) => item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q)).slice(0, 24);
  }, [files, project?.nodes, query, onSwitchView, onCreateNewNote, onToggleSidebar, onTriggerReview, onExport, onOpenFile, onSelectNode]);

  return (
    <dialog
      ref={dialogRef}
      className="ori-dialog"
      aria-label="Research IDE Command Palette"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="ori-palette-head">
        <Search size={16} style={{ color: "var(--text-muted)" }} aria-hidden="true" />
        <input
          ref={inputRef}
          className="ori-palette-input"
          placeholder={mode === "commands" ? "Jump to files, nodes, or IDE commands (Ctrl+K)..." : "Search full text inside all notes, PDFs, papers & manuscript..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div style={{ display: "flex", gap: 4 }}>
          <button
            type="button"
            className={`ori-chip-btn${mode === "commands" ? " ori-chip-btn--active" : ""}`}
            onClick={() => setMode("commands")}
          >
            <Command size={12} /> Quick Open
          </button>
          <button
            type="button"
            className={`ori-chip-btn${mode === "search" ? " ori-chip-btn--active" : ""}`}
            onClick={() => setMode("search")}
          >
            <Search size={12} /> Full-Text Search
          </button>
          <button type="button" className="ori-icon-btn" aria-label="Close palette" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="ori-palette-body">
        {mode === "commands" ? (
          items.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)", padding: 12 }}>No matching commands, files, or research artifacts.</p>
          ) : (
            <ul className="ori-palette-list">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="ori-palette-row"
                    onClick={() => {
                      item.run();
                      onClose();
                    }}
                  >
                    <span className="ori-badge">{item.group}</span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <strong style={{ display: "block", fontSize: 13.5 }}>{item.title}</strong>
                      <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)" }}>{item.subtitle}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {searching ? <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Searching workspace files and PDFs…</p> : null}
            {!searching && !searchResults ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Type at least 2 characters to grep across notes, CSVs, scripts, PDFs, papers, and manuscript.</p>
            ) : null}
            {searchResults ? (
              <>
                {searchResults.fileMatches.map((m, idx) => (
                  <button
                    key={`${m.path}-${m.line}-${idx}`}
                    type="button"
                    className="ori-palette-row"
                    onClick={() => {
                      onOpenFile(m.path);
                      onSwitchView("workspace");
                      onClose();
                    }}
                  >
                    <FileText size={14} style={{ color: "var(--accent)" }} />
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <strong style={{ fontSize: 13 }}>{m.path}{m.line > 0 ? `:${m.line}` : ""}</strong>
                      <span style={{ display: "block", fontSize: 12, color: "var(--text-secondary)" }}>{m.snippet}</span>
                    </span>
                  </button>
                ))}
                {searchResults.nodeMatches.map((m) => (
                  <button
                    key={m.nodeId}
                    type="button"
                    className="ori-palette-row"
                    onClick={() => {
                      onSelectNode(m.nodeId);
                      onClose();
                    }}
                  >
                    <Network size={14} style={{ color: "var(--accent)" }} />
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <strong style={{ fontSize: 13 }}>[{m.type}] {m.title}</strong>
                      <span style={{ display: "block", fontSize: 12, color: "var(--text-secondary)" }}>{m.snippet}</span>
                    </span>
                  </button>
                ))}
                {searchResults.manuscriptMatches.map((m, idx) => (
                  <button
                    key={`${m.sectionId}-${idx}`}
                    type="button"
                    className="ori-palette-row"
                    onClick={() => {
                      onSwitchView("manuscript");
                      onClose();
                    }}
                  >
                    <span className="ori-badge">Manuscript</span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <strong style={{ fontSize: 13 }}>{m.heading}</strong>
                      <span style={{ display: "block", fontSize: 12, color: "var(--text-secondary)" }}>{m.snippet}</span>
                    </span>
                  </button>
                ))}
                {!searchResults.fileMatches.length && !searchResults.nodeMatches.length && !searchResults.manuscriptMatches.length ? (
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No matches found for &ldquo;{query}&rdquo;.</p>
                ) : null}
              </>
            ) : null}
          </div>
        )}
      </div>
    </dialog>
  );
}
