import type { CodeRunOutput, ResearchNode, ResearchProject } from "../packages/contracts/index";

export function buildColabNotebook(project: ResearchProject, experiment: ResearchNode): Record<string, unknown>;
export function buildSurveySchema(project: ResearchProject, experiment: ResearchNode): Record<string, unknown>;
export function buildSurveyCsvTemplate(experiment: ResearchNode): string;
export function parseCsvSummary(csvText: string): { rowCount: number; columns: string[]; preview: string };
export function runExperimentCodeLocally(root: string, projectId: string, experiment: ResearchNode, codeOverride?: string): Promise<CodeRunOutput>;
