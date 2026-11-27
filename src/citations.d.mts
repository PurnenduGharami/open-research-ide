import type { CitationStyle, ResearchNode } from "../packages/contracts/index";

export function generateCiteKey(paper: { title?: string; authors?: string[]; year?: number | null }): string;
export function parseReferencesText(inputText: string, sourceLabel?: string): Array<Record<string, unknown>>;
export function papersToCslJson(papers: ResearchNode[]): Array<Record<string, unknown>>;
export function formatCitations(papers: ResearchNode[], style?: CitationStyle): string;
