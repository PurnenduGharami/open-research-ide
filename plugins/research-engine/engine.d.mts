import type { NodeType, ResearchNode, ResearchProject } from "../packages/contracts/index";
export type ResearchNodeType = NodeType;
export type { ResearchNode, ResearchProject };
export const projectSchema: { parse(value: unknown): ResearchProject };
export function emptyProject(curiosity: string, title?: string): ResearchProject;
export function projectPath(root: string): string;
export function readProject(root: string): Promise<ResearchProject | null>;
export function executeResearchCommand(root: string, command: any): Promise<ResearchProject>;
export function sha256(value: string): string;
