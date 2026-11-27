import type { ResearchProject, ResearchProjectSummary } from "../../packages/contracts/index";

export type { ResearchProject, ResearchProjectSummary };
export const PROJECT_FILENAME: string;
export const projectSchema: { parse: (input: unknown) => ResearchProject };
export function sha256(value: string): string;
export function workspaceDir(root: string): string;
export function projectPath(root: string, projectId?: string): string;
export function projectExportsDir(root: string, projectId?: string): string;
export function projectFilesDir(root: string, projectId: string): string;
export function summarizeProject(project: ResearchProject): ResearchProjectSummary;
export function emptyProject(curiosity: string, title?: string, mode?: "guided" | "autonomous"): ResearchProject;
export function listProjects(root: string): Promise<{ activeProjectId: string | null; projects: ResearchProjectSummary[] }>;
export function getActiveProjectId(root: string): Promise<string | null>;
export function readProject(root: string, projectId?: string): Promise<ResearchProject | null>;
export function setActiveProject(root: string, projectId: string): Promise<ResearchProject>;
export function deleteProject(root: string, projectId: string): Promise<{ activeProjectId: string | null; projects: ResearchProjectSummary[] }>;
export function executeResearchCommand(root: string, command: Record<string, unknown>): Promise<ResearchProject>;
export function recoverInterruptedProjects(root: string, activeProjectIds?: Set<string>): Promise<string[]>;
export function verifyProjectEvidenceHashes(project: ResearchProject): {
  total: number;
  verified: number;
  failed: Array<{ nodeId: string; reason: string }>;
};
export function saveImportedProject(root: string, rawProject: unknown): Promise<ResearchProject>;
