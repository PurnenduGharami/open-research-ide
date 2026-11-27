import type { RecentPaperCard, ResearchNode } from "../../packages/contracts/index";

export function searchLiterature(query: string, options?: { limit?: number; includeArxiv?: boolean; retries?: number; fetch?: typeof fetch }): Promise<{ query: string; papers: Array<Record<string, unknown>>; sources: Array<Record<string, unknown>>; retrievedAt: string }>;
export function lookupPaperByDoi(doiInput: string, options?: { fetch?: typeof fetch }): Promise<{ paper: Record<string, unknown>; node: Record<string, unknown>; source: Record<string, unknown> }>;
export function snowballCitations(paperNode: ResearchNode, options?: { direction?: "references" | "citations" | "both"; limit?: number; fetch?: typeof fetch }): Promise<{
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  sources: Array<Record<string, unknown>>;
}>;
export function recentTopicOptions(): Array<{ id: string; label: string }>;
export function fetchRecentPapers(topic?: string, options?: { limit?: number; fetch?: typeof fetch }): Promise<{ topic: string; topics: Array<{ id: string; label: string }>; papers: RecentPaperCard[]; sources: Array<Record<string, unknown>>; retrievedAt: string }>;
export function literatureNodes(result: { papers: Array<Record<string, unknown>>; sources: Array<Record<string, unknown>> }): { nodes: Array<Record<string, unknown>>; edges: Array<Record<string, unknown>>; sources: Array<Record<string, unknown>> };
