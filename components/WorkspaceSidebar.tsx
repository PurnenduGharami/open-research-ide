"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  File,
  FilePlus2,
  Folder,
  FolderPlus,
  Trash2,
  X,
} from "lucide-react";
import type { DiagnosticItem, ResearchProject, ViewId, WorkspaceFileEntry } from "../packages/contracts";
import { computeProjectDiagnostics } from "../src/diagnostics";
import { MonoMeta, StatusBadge } from "../dashboard/ui";

export type SidebarTab = "explorer" | "search" | "problems" | "history";

const PANEL_TITLES: Record<SidebarTab, string> = {
  explorer: "Explorer",
  search: "Workspace Search",
  problems: "Integrity Problems",
  history: "Revision History",
};

export function WorkspaceSidebar({
  project,
  files,
  activeFilePath,
  tab,
  onClose,
  onOpenFile,
  onCreateNote,
  onCreateFolder,
  onDeleteFile,
  onSelectDiagnostic,
  onSelectNode,
}: {
  project: ResearchProject;
  files: WorkspaceFileEntry[];
  activeFilePath?: string;
  tab: SidebarTab;
  onClose: () => void;
  onOpenFile: (path: string) => void;
  onCreateNote: (path: string) => void;
  onCreateFolder: (path: string) => void;
  onDeleteFile: (path: string) => void;
  onSelectDiagnostic: (item: DiagnosticItem) => void;
  onSelectNode: (nodeId: string, view?: ViewId) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    notes: true,
    papers: true,
    data: true,
    scripts: true,
    figures: true,
    drafts: true,
  });
  const [newName, setNewName] = useState("");
  const [creatingKind, setCreatingKind] = useState<"note" | "folder" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<{
    fileMatches: Array<{ path: string; line: number; snippet: string }>;
    nodeMatches: Array<{ nodeId: string; type: string; title: string; snippet: string }>;
  } | null>(null);

  const diagnostics = computeProjectDiagnostics(project, files);

  const runSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.trim().length < 2) {
      setSearchResult(null);
      return;
    }
    const res = await fetch(`/api/search?projectId=${encodeURIComponent(project.projectId)}&q=${encodeURIComponent(q.trim())}`);
    if (res.ok) setSearchResult(await res.json());
  };

  const handleCreateSubmit = () => {
    const clean = newName.trim().replace(/^\/+/, "");
    if (!clean) return;
    if (creatingKind === "folder") {
      onCreateFolder(clean);
    } else {
      const target = clean.includes("/") ? clean : `notes/${clean.endsWith(".md") ? clean : `${clean}.md`}`;
      onCreateNote(target);
    }
    setNewName("");
    setCreatingKind(null);
  };

  const renderTree = (entries: WorkspaceFileEntry[], depth = 0) =>
    entries.map((entry) => {
      if (entry.kind === "folder") {
        const isOpen = expanded[entry.path] ?? false;
        const count = entry.children?.length ?? 0;
        return (
          <div key={entry.path}>
            <button
              type="button"
              className="ori-tree-row"
              style={{ paddingLeft: 8 + depth * 12 }}
              onClick={() => setExpanded((prev) => ({ ...prev, [entry.path]: !isOpen }))}
            >
              {isOpen ? <ChevronDown size={13} style={{ color: "var(--text-muted)" }} /> : <ChevronRight size={13} style={{ color: "var(--text-muted)" }} />}
              <Folder size={13} style={{ color: count > 0 ? "var(--accent)" : "var(--text-muted)" }} />
              <span className="ori-tree-name">{entry.name}</span>
              {count > 0 ? <MonoMeta>{count}</MonoMeta> : null}
            </button>
            {isOpen && entry.children ? renderTree(entry.children, depth + 1) : null}
          </div>
        );
      }
      const selected = activeFilePath === entry.path;
      return (
        <div key={entry.path} className={`ori-tree-file-row${selected ? " ori-tree-file-row--active" : ""}`}>
          <button
            type="button"
            className="ori-tree-row"
            style={{ paddingLeft: 18 + depth * 12, flex: 1 }}
            onClick={() => onOpenFile(entry.path)}
          >
            <File size={13} style={{ color: "var(--text-muted)" }} />
            <span className="ori-tree-name">{entry.name}</span>
          </button>
          <button
            type="button"
            className="ori-tree-del"
            aria-label={`Delete ${entry.path}`}
            onClick={() => onDeleteFile(entry.path)}
          >
            <Trash2 size={12} />
          </button>
        </div>
      );
    });

  return (
    <aside className="ori-workbench-sidebar" aria-label={PANEL_TITLES[tab]}>
      <div className="ori-sidebar-head">
        <span className="ori-sidebar-title">{PANEL_TITLES[tab]}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {tab === "explorer" ? (
            <>
              <button
                type="button"
                className="ori-rail-mini-btn"
                aria-label="New Markdown Note"
                title="New Markdown Note"
                onClick={() => setCreatingKind((k) => (k === "note" ? null : "note"))}
              >
                <FilePlus2 size={14} />
              </button>
              <button
                type="button"
                className="ori-rail-mini-btn"
                aria-label="New Folder"
                title="New Folder"
                onClick={() => setCreatingKind((k) => (k === "folder" ? null : "folder"))}
              >
                <FolderPlus size={14} />
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="ori-rail-mini-btn"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="ori-sidebar-body">
        {tab === "explorer" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {creatingKind ? (
              <div style={{ display: "flex", gap: 4 }}>
                <input
                  className="ori-input"
                  style={{ padding: "5px 8px", fontSize: 12.5 }}
                  placeholder={creatingKind === "folder" ? "folder/name" : "notes/observation.md"}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateSubmit();
                    if (e.key === "Escape") setCreatingKind(null);
                  }}
                />
                <button type="button" className="ori-btn ori-btn--primary ori-btn--sm" onClick={handleCreateSubmit}>Add</button>
              </div>
            ) : null}

            <div className="ori-file-tree">{renderTree(files)}</div>
          </div>
        ) : null}

        {tab === "search" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              className="ori-input"
              style={{ padding: "6px 10px", fontSize: 12.5 }}
              placeholder="Grep files, PDFs, papers..."
              value={searchQuery}
              onChange={(e) => void runSearch(e.target.value)}
            />
            {searchResult ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {searchResult.fileMatches.map((m, idx) => (
                  <button key={`${m.path}-${idx}`} type="button" className="ori-diag-row" onClick={() => onOpenFile(m.path)}>
                    <strong style={{ fontSize: 12 }}>{m.path}{m.line > 0 ? `:${m.line}` : ""}</strong>
                    <span style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{m.snippet}</span>
                  </button>
                ))}
                {searchResult.nodeMatches.map((m) => (
                  <button key={m.nodeId} type="button" className="ori-diag-row" onClick={() => onSelectNode(m.nodeId)}>
                    <strong style={{ fontSize: 12 }}>[{m.type}] {m.title}</strong>
                    <span style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{m.snippet}</span>
                  </button>
                ))}
                {!searchResult.fileMatches.length && !searchResult.nodeMatches.length ? (
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No matches found.</p>
                ) : null}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                Search across notes, CSV datasets, scripts, PDFs, and anchored claims.
              </p>
            )}
          </div>
        ) : null}

        {tab === "problems" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {diagnostics.length === 0 ? (
              <p style={{ fontSize: 12.5, color: "var(--status-ok)" }}>No integrity or provenance issues.</p>
            ) : (
              diagnostics.map((d) => (
                <button key={d.id} type="button" className="ori-diag-row" onClick={() => onSelectDiagnostic(d)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertTriangle size={12} style={{ color: d.severity === "error" ? "var(--status-danger)" : d.severity === "warning" ? "var(--status-warn)" : "var(--accent)" }} />
                    <StatusBadge tone={d.severity === "error" ? "danger" : d.severity === "warning" ? "warn" : "neutral"}>{d.code}</StatusBadge>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.45 }}>{d.message}</span>
                </button>
              ))
            )}
          </div>
        ) : null}

        {tab === "history" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[...(project.timeline || [])].reverse().slice(0, 30).map((ev) => (
              <div key={ev.id} className="ori-history-mini">
                <MonoMeta>{ev.kind} · {ev.at.slice(11, 16)} UTC</MonoMeta>
                <span style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.4 }}>{ev.message}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
