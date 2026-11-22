import type { ResearchProject } from "../plugins/research-engine/engine.d.mts";

export interface LatexExport {
  mainTex: string;
  referencesBib: string;
}

export interface ExportedFile {
  format: "html" | "pdf" | "latex" | "zip";
  path: string;
  sha256: string;
}

export interface ProjectExportResult {
  revision: number;
  contentRevision?: number;
  files: ExportedFile[];
}

export function renderProjectHtml(project: ResearchProject): string;
export function renderProjectLatex(project: ResearchProject): LatexExport;
export function renderProjectPdf(htmlDocument: string, canonicalUpdatedAt?: string): Promise<Buffer>;
export function buildZipArchive(entries: Array<{ name: string; data: string | Buffer }>, timestampIso?: string): Buffer;
export function exportProject(root?: string, projectId?: string): Promise<ProjectExportResult>;
