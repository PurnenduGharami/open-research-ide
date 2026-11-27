import type { LatexTemplate } from "../packages/contracts/index";
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
  warnings?: string[];
}

export function renderProjectHtml(project: ResearchProject): string;
export function renderProjectLatex(project: ResearchProject, options?: { template?: LatexTemplate }): LatexExport;
export function renderProjectPdf(htmlDocument: string, canonicalUpdatedAt?: string): Promise<Buffer>;
export function buildRoCrateMetadata(
  project: ResearchProject,
  extraParts?: Array<{ path: string; mimeType?: string; size?: number; sha256?: string }>,
): string;
export function buildZipArchive(entries: Array<{ name: string; data: string | Buffer }>, timestampIso?: string): Buffer;
export function exportProject(root?: string, projectId?: string): Promise<ProjectExportResult>;
