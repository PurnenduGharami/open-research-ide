import type { ResearchProject, WorkspaceFileEntry } from "../packages/contracts/index";

export const WORKSPACE_FOLDERS: string[];
export function classifyFileCategory(relPath: string): WorkspaceFileEntry["category"];
export function mimeTypeForPath(relPath: string): string;
export function isTextExtension(relPath: string): boolean;
export function resolveWorkspacePath(root: string, projectId: string, relPath?: string): { base: string; relPath: string; absPath: string };
export function ensureWorkspaceScaffold(root: string, projectId: string, project?: ResearchProject | null): Promise<void>;
export function listWorkspaceFiles(root: string, projectId: string): Promise<WorkspaceFileEntry[]>;
export function collectAllWorkspaceFilesFlat(root: string, projectId: string): Promise<Array<{
  relPath: string;
  absPath: string;
  size: number;
  mimeType: string;
  category: WorkspaceFileEntry["category"];
  updatedAt: string;
  sha256: string;
}>>;
export function readWorkspaceFile(root: string, projectId: string, relPath: string): Promise<{
  path: string;
  name: string;
  category: WorkspaceFileEntry["category"];
  mimeType: string;
  isText: boolean;
  size: number;
  sha256: string;
  updatedAt: string;
  buffer: Buffer;
  text?: string;
}>;
export function writeWorkspaceFile(root: string, projectId: string, relPath: string, content: string | Buffer): Promise<{
  path: string;
  size: number;
  sha256: string;
}>;
export function createWorkspaceFolder(root: string, projectId: string, relPath: string): Promise<{ path: string }>;
export function renameWorkspaceEntry(root: string, projectId: string, fromPath: string, toPath: string): Promise<{ from: string; to: string }>;
export function deleteWorkspaceEntry(root: string, projectId: string, relPath: string): Promise<{ deleted: string }>;
export function computeWikilinksAndBacklinks(root: string, projectId: string, project?: ResearchProject | null): Promise<{
  forward: Record<string, string[]>;
  backlinks: Record<string, Array<{ from: string; excerpt: string }>>;
}>;
export function searchWorkspace(root: string, projectId: string, project: ResearchProject | null, query: string): Promise<{
  query: string;
  fileMatches: Array<{ path: string; line: number; snippet: string }>;
  nodeMatches: Array<{ nodeId: string; type: string; title: string; snippet: string }>;
  planningMatches: Array<{ kind: "task" | "idea"; id: string; title: string; detail: string }>;
  manuscriptMatches: Array<{ sectionId: string; heading: string; snippet: string }>;
}>;
