import type { ManuscriptDocument, ResearchProject } from "../packages/contracts/index";

export function draftManuscriptFromProject(project: ResearchProject, options?: { root?: string }): Promise<ManuscriptDocument>;
export function polishManuscriptSectionWithGemini(
  project: ResearchProject,
  sectionHeading: string,
  currentText: string,
  root?: string,
): Promise<string>;
