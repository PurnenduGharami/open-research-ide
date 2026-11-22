import type { ResearchProject } from "../plugins/research-engine/engine.d.mts";

export interface LatexExport {
  mainTex: string;
  referencesBib: string;
}

export interface ExportedFile {
  format: "html" | "pdf" | "latex";
  path: string;
  sha256: string;
}

export interface ProjectExportResult {
  revision: number;
  files: ExportedFile[];
}

export function renderProjectHtml(project: ResearchProject): string;
export function renderProjectLatex(project: ResearchProject): LatexExport;
export function renderProjectPdf(htmlDocument: string, canonicalUpdatedAt?: string): Promise<Buffer>;
export function exportProject(root?: string): Promise<ProjectExportResult>;
