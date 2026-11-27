import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { projectFilesDir } from "../plugins/research-engine/engine.mjs";

export const WORKSPACE_FOLDERS = ["notes", "papers", "data", "scripts", "figures", "drafts"];

const MAX_TEXT_BYTES = 4 * 1024 * 1024;
const MAX_BINARY_BYTES = 15 * 1024 * 1024;

const MIME_BY_EXT = {
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".tsv": "text/tab-separated-values; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".py": "text/x-python; charset=utf-8",
  ".js": "text/plain; charset=utf-8",
  ".mjs": "text/plain; charset=utf-8",
  ".ts": "text/plain; charset=utf-8",
  ".tex": "application/x-tex; charset=utf-8",
  ".bib": "text/plain; charset=utf-8",
  ".ris": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf",
};

const TEXT_EXTENSIONS = new Set([".md", ".txt", ".csv", ".tsv", ".json", ".py", ".js", ".mjs", ".ts", ".tex", ".bib", ".ris", ".svg", ".yml", ".yaml"]);

export function classifyFileCategory(relPath) {
  const lower = relPath.toLowerCase();
  const ext = path.extname(lower);
  if (lower.startsWith("notes/") || ext === ".md" || ext === ".txt") return "note";
  if (lower.startsWith("papers/") || ext === ".pdf") return "paper";
  if (lower.startsWith("data/") || ext === ".csv" || ext === ".tsv" || ext === ".json") return "data";
  if (lower.startsWith("scripts/") || [".py", ".js", ".mjs", ".ts", ".r"].includes(ext)) return "script";
  if (lower.startsWith("figures/") || [".svg", ".png", ".jpg", ".jpeg"].includes(ext)) return "figure";
  if ([".bib", ".ris", ".tex"].includes(ext)) return "reference";
  return "other";
}

export function mimeTypeForPath(relPath) {
  const ext = path.extname(relPath).toLowerCase();
  return MIME_BY_EXT[ext] || "application/octet-stream";
}

export function isTextExtension(relPath) {
  const ext = path.extname(relPath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext) || !ext;
}

export function resolveWorkspacePath(root, projectId, relPath = "") {
  const base = path.resolve(projectFilesDir(root, projectId));
  const raw = String(relPath || "").replace(/\\/g, "/").trim();
  if (!raw || raw === ".") {
    return { base, relPath: "", absPath: base };
  }
  if (raw.includes("\0") || raw.startsWith("/") || /^[a-zA-Z]:/.test(raw)) {
    throw new Error("Invalid workspace relative path");
  }
  const segments = raw.split("/").filter(Boolean);
  if (!segments.length) return { base, relPath: "", absPath: base };
  for (const seg of segments) {
    if (seg === "." || seg === ".." || seg.startsWith(".")) {
      throw new Error(`Unsafe workspace path segment: ${seg}`);
    }
  }
  const cleanRel = segments.join("/");
  const absPath = path.resolve(base, ...segments);
  if (!absPath.startsWith(`${base}${path.sep}`)) {
    throw new Error("Workspace path escapes project directory");
  }
  return { base, relPath: cleanRel, absPath };
}

export async function ensureWorkspaceScaffold(root, projectId, project = null) {
  const base = projectFilesDir(root, projectId);
  await mkdir(/* turbopackIgnore: true */ base, { recursive: true });
  for (const folder of WORKSPACE_FOLDERS) {
    await mkdir(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ base, folder), { recursive: true });
  }
  const notebookPath = path.join(/* turbopackIgnore: true */ base, "notes", "lab-notebook.md");
  try {
    await stat(notebookPath);
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
    const title = project?.title || "Research Notebook";
    const curiosity = project?.curiosity || "Document hypotheses, equations, protocols, and citations here.";
    const content = [
      `# ${title}`,
      "",
      `> **Investigation:** ${curiosity}`,
      "",
      "## Working Hypotheses & Models",
      "",
      "Record mathematical formulations with LaTeX, e.g. Arrhenius scaling:",
      "",
      "$$k(T) = A \\exp\\left(-\\frac{E_a}{RT}\\right)$$",
      "",
      "## Linked Artifacts & Citations",
      "",
      "- Link any paper, evidence, or note with wikilinks such as `[[notes/research-plan.md]]`.",
      "- Insert BibTeX/Library cite keys with `[@citeKey]` to trace claims back to sources.",
      "",
      "## Observations Log",
      "",
      "- Initial workspace scaffold created.",
      "",
    ].join("\n");
    await writeFile(notebookPath, content, "utf8");
  }

  const planPath = path.join(base, "notes", "research-plan.md");
  try {
    await stat(planPath);
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
    const planContent = [
      "# Research Plan & Screening Protocol",
      "",
      "1. **Literature Sweep:** Search OpenAlex, Semantic Scholar, arXiv, or import `.bib`/`.ris` and PDFs.",
      "2. **Exact Anchoring:** Highlight verbatim quotes (abstract or PDF page text) and confirm `SHA-256` hashes.",
      "3. **Contradiction Triage:** Inspect conflicting findings side-by-side before forming hypotheses.",
      "4. **Validation & Stats:** Pre-register frozen predictions, execute code or Welch t-tests, save SVG figures.",
      "5. **Manuscript & RO-Crate:** Cite verified records and export publication LaTeX + reproducible ZIP.",
      "",
    ].join("\n");
    await writeFile(planPath, planContent, "utf8");
  }
}

async function walkDir(baseDir, currentDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  const out = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(currentDir, entry.name);
    const rel = path.relative(baseDir, full).replace(/\\/g, "/");
    const info = await stat(full);
    if (entry.isDirectory()) {
      const children = await walkDir(baseDir, full);
      out.push({
        path: rel,
        name: entry.name,
        kind: "folder",
        category: classifyFileCategory(`${rel}/`),
        size: 0,
        mimeType: "inode/directory",
        updatedAt: info.mtime.toISOString(),
        children,
      });
    } else if (entry.isFile()) {
      let hash;
      if (info.size <= 10 * 1024 * 1024) {
        const buf = await readFile(full);
        hash = createHash("sha256").update(buf).digest("hex");
      }
      out.push({
        path: rel,
        name: entry.name,
        kind: "file",
        category: classifyFileCategory(rel),
        size: info.size,
        mimeType: mimeTypeForPath(rel),
        updatedAt: info.mtime.toISOString(),
        ...(hash ? { sha256: hash } : {}),
      });
    }
  }
  return out;
}

export async function listWorkspaceFiles(root, projectId) {
  const base = projectFilesDir(root, projectId);
  try {
    return await walkDir(base, base);
  } catch (err) {
    if (err?.code === "ENOENT") return [];
    throw err;
  }
}

export async function collectAllWorkspaceFilesFlat(root, projectId) {
  const tree = await listWorkspaceFiles(root, projectId);
  const base = projectFilesDir(root, projectId);
  const flat = [];
  const visit = (items) => {
    for (const item of items) {
      if (item.kind === "folder" && item.children) visit(item.children);
      else if (item.kind === "file") {
        flat.push({
          relPath: item.path,
          absPath: path.join(base, ...item.path.split("/")),
          size: item.size,
          mimeType: item.mimeType,
          category: item.category,
          updatedAt: item.updatedAt,
          sha256: item.sha256 || "",
        });
      }
    }
  };
  visit(tree);
  flat.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return flat;
}

export async function readWorkspaceFile(root, projectId, relPath) {
  const { relPath: cleanRel, absPath } = resolveWorkspacePath(root, projectId, relPath);
  if (!cleanRel) throw new Error("File path is required");
  const info = await stat(absPath);
  if (!info.isFile()) throw new Error("Requested path is not a file");
  const buffer = await readFile(absPath);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const mimeType = mimeTypeForPath(cleanRel);
  const isText = isTextExtension(cleanRel);
  return {
    path: cleanRel,
    name: path.basename(cleanRel),
    category: classifyFileCategory(cleanRel),
    mimeType,
    isText,
    size: buffer.byteLength,
    sha256,
    updatedAt: info.mtime.toISOString(),
    buffer,
    ...(isText ? { text: buffer.toString("utf8") } : {}),
  };
}

export async function writeWorkspaceFile(root, projectId, relPath, content) {
  const { relPath: cleanRel, absPath } = resolveWorkspacePath(root, projectId, relPath);
  if (!cleanRel) throw new Error("File path is required");
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(String(content ?? ""), "utf8");
  const limit = Buffer.isBuffer(content) ? MAX_BINARY_BYTES : MAX_TEXT_BYTES;
  if (buf.byteLength > limit) {
    throw new Error(`File ${cleanRel} exceeds size limit (${Math.round(limit / (1024 * 1024))} MB)`);
  }
  await mkdir(path.dirname(absPath), { recursive: true });
  const temp = `${absPath}.${process.pid}.tmp`;
  await writeFile(temp, buf);
  await rename(temp, absPath);
  return {
    path: cleanRel,
    size: buf.byteLength,
    sha256: createHash("sha256").update(buf).digest("hex"),
  };
}

export async function createWorkspaceFolder(root, projectId, relPath) {
  const { relPath: cleanRel, absPath } = resolveWorkspacePath(root, projectId, relPath);
  if (!cleanRel) throw new Error("Folder path is required");
  await mkdir(absPath, { recursive: true });
  return { path: cleanRel };
}

export async function renameWorkspaceEntry(root, projectId, fromPath, toPath) {
  const src = resolveWorkspacePath(root, projectId, fromPath);
  const dst = resolveWorkspacePath(root, projectId, toPath);
  if (!src.relPath || !dst.relPath) throw new Error("Both source and target paths are required");
  await mkdir(path.dirname(dst.absPath), { recursive: true });
  await rename(src.absPath, dst.absPath);
  return { from: src.relPath, to: dst.relPath };
}

export async function deleteWorkspaceEntry(root, projectId, relPath) {
  const { relPath: cleanRel, absPath } = resolveWorkspacePath(root, projectId, relPath);
  if (!cleanRel) throw new Error("Cannot delete workspace root");
  await rm(absPath, { recursive: true, force: true });
  return { deleted: cleanRel };
}

export async function computeWikilinksAndBacklinks(root, projectId, project = null) {
  const files = await collectAllWorkspaceFilesFlat(root, projectId);
  const forward = {};
  const backlinks = {};

  const recordLink = (sourceLabel, targetRaw, excerpt) => {
    const target = String(targetRaw || "").trim();
    if (!target) return;
    if (!forward[sourceLabel]) forward[sourceLabel] = [];
    if (!forward[sourceLabel].includes(target)) forward[sourceLabel].push(target);
    if (!backlinks[target]) backlinks[target] = [];
    if (!backlinks[target].some((entry) => entry.from === sourceLabel && entry.excerpt === excerpt)) {
      backlinks[target].push({ from: sourceLabel, excerpt });
    }
  };

  const scanText = (sourceLabel, text) => {
    const lines = String(text || "").split(/\r?\n/);
    for (const line of lines) {
      for (const match of line.matchAll(/\[\[([^\]]+)\]\]/g)) {
        recordLink(sourceLabel, match[1], line.trim().slice(0, 140));
      }
      for (const match of line.matchAll(/\[@([a-zA-Z0-9_:-]+)\]/g)) {
        recordLink(sourceLabel, `@${match[1]}`, line.trim().slice(0, 140));
      }
    }
  };

  for (const file of files) {
    if (![".md", ".txt", ".tex"].includes(path.extname(file.relPath).toLowerCase())) continue;
    const raw = await readFile(file.absPath, "utf8").catch(() => "");
    scanText(file.relPath, raw);
  }

  if (project?.manuscript) {
    scanText("manuscript:abstract", project.manuscript.abstract || "");
    for (const sec of project.manuscript.sections || []) {
      scanText(`manuscript:${sec.id}`, sec.content || "");
    }
  }

  return { forward, backlinks };
}

export async function searchWorkspace(root, projectId, project, query) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return { query: "", fileMatches: [], nodeMatches: [], planningMatches: [], manuscriptMatches: [] };

  const fileMatches = [];
  const files = await collectAllWorkspaceFilesFlat(root, projectId);
  for (const file of files) {
    if (file.relPath.toLowerCase().includes(needle)) {
      fileMatches.push({ path: file.relPath, line: 0, snippet: `Filename match: ${file.relPath}` });
    }
    if (!isTextExtension(file.relPath) || file.size > 512 * 1024) continue;
    const text = await readFile(file.absPath, "utf8").catch(() => "");
    const lines = text.split(/\r?\n/);
    let hitsForFile = 0;
    for (let i = 0; i < lines.length && hitsForFile < 5; i += 1) {
      if (lines[i].toLowerCase().includes(needle)) {
        fileMatches.push({ path: file.relPath, line: i + 1, snippet: lines[i].trim().slice(0, 180) });
        hitsForFile += 1;
      }
    }
  }

  const nodeMatches = [];
  for (const node of project?.nodes || []) {
    const titleHit = node.title.toLowerCase().includes(needle);
    const abstractHit = typeof node.data?.abstract === "string" && node.data.abstract.toLowerCase().includes(needle);
    const quoteHit = typeof node.data?.quote === "string" && node.data.quote.toLowerCase().includes(needle);
    const fullTextHit = typeof node.data?.fullText === "string" && node.data.fullText.toLowerCase().includes(needle);
    const stmtHit = typeof node.data?.statement === "string" && node.data.statement.toLowerCase().includes(needle);
    const descHit = typeof node.data?.description === "string" && node.data.description.toLowerCase().includes(needle);

    if (titleHit || abstractHit || quoteHit || fullTextHit || stmtHit || descHit) {
      let snippet = node.title;
      if (quoteHit) snippet = node.data.quote;
      else if (abstractHit) snippet = node.data.abstract.slice(0, 180);
      else if (stmtHit) snippet = node.data.statement.slice(0, 180);
      else if (descHit) snippet = node.data.description.slice(0, 180);
      else if (fullTextHit) {
        const idx = node.data.fullText.toLowerCase().indexOf(needle);
        snippet = node.data.fullText.slice(Math.max(0, idx - 60), idx + 140);
      }
      nodeMatches.push({ nodeId: node.id, type: node.type, title: node.title, snippet });
    }
  }

  const planningMatches = [];
  for (const task of project?.tasks || []) {
    if (task.title.toLowerCase().includes(needle) || (task.notes || "").toLowerCase().includes(needle)) {
      planningMatches.push({ kind: "task", id: task.id, title: task.title, detail: `${task.stage} · ${task.status}` });
    }
  }
  for (const idea of project?.ideas || []) {
    if (idea.title.toLowerCase().includes(needle) || (idea.notes || "").toLowerCase().includes(needle)) {
      planningMatches.push({ kind: "idea", id: idea.id, title: idea.title, detail: idea.status });
    }
  }

  const manuscriptMatches = [];
  if (project?.manuscript) {
    if ((project.manuscript.abstract || "").toLowerCase().includes(needle)) {
      manuscriptMatches.push({ sectionId: "abstract", heading: "Abstract", snippet: project.manuscript.abstract.slice(0, 180) });
    }
    for (const sec of project.manuscript.sections || []) {
      const idx = sec.content.toLowerCase().indexOf(needle);
      if (idx >= 0) {
        manuscriptMatches.push({
          sectionId: sec.id,
          heading: sec.heading,
          snippet: sec.content.slice(Math.max(0, idx - 50), idx + 140),
        });
      }
    }
  }

  return { query, fileMatches, nodeMatches, planningMatches, manuscriptMatches };
}
