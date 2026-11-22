import type { ManuscriptDocument, ResearchProject } from "../packages/contracts/index";

export function draftManuscriptFromProject(project: ResearchProject, options?: { root?: string }): Promise<ManuscriptDocument>;
