import type {
  ContradictionResolution,
  ContradictionSide,
  ResearchNode,
  ResearchProject,
} from "../packages/contracts";

export interface ResolvedContradictionSide {
  key: string;
  sideLabel: string;
  paper?: ResearchNode;
  evidence?: ResearchNode;
  quote?: string;
  abstract?: string;
  definitionNote?: string;
}

export const CONTRADICTION_RESOLUTION_LABELS: Record<
  ContradictionResolution,
  { label: string; shortLabel: string; tone: "danger" | "warn" | "accent" | "neutral" }
> = {
  unresolved: {
    label: "Unresolved tension",
    shortLabel: "Unresolved",
    tone: "danger",
  },
  "true-disagreement": {
    label: "True disagreement",
    shortLabel: "True Disagreement",
    tone: "danger",
  },
  "different-definitions": {
    label: "Different definitions / metrics",
    shortLabel: "Different Definitions",
    tone: "warn",
  },
  "different-conditions": {
    label: "Different conditions / population",
    shortLabel: "Different Conditions",
    tone: "accent",
  },
};

export function splitAbstractAroundQuote(
  abstract?: string,
  quote?: string,
): { before: string; match: string; after: string } | null {
  if (!abstract || !quote) return null;
  const cleanQuote = quote.trim();
  if (!cleanQuote) return null;
  let index = abstract.indexOf(cleanQuote);
  if (index === -1) {
    index = abstract.toLowerCase().indexOf(cleanQuote.toLowerCase());
  }
  if (index === -1) return null;
  return {
    before: abstract.slice(0, index),
    match: abstract.slice(index, index + cleanQuote.length),
    after: abstract.slice(index + cleanQuote.length),
  };
}

export function abstractSnippet(abstract?: string, quote?: string, radius = 140): {
  before: string;
  match: string;
  after: string;
  truncatedStart: boolean;
  truncatedEnd: boolean;
} | null {
  const split = splitAbstractAroundQuote(abstract, quote);
  if (!split) return null;
  const truncatedStart = split.before.length > radius;
  const truncatedEnd = split.after.length > radius;
  return {
    before: truncatedStart ? split.before.slice(split.before.length - radius).replace(/^\S*\s+/, "") : split.before,
    match: split.match,
    after: truncatedEnd ? split.after.slice(0, radius).replace(/\s+\S*$/, "") : split.after,
    truncatedStart,
    truncatedEnd,
  };
}

export function resolveContradictionSides(
  project: ResearchProject,
  contradiction: ResearchNode,
): ResolvedContradictionSide[] {
  const nodeMap = new Map(project.nodes.map((node) => [node.id, node]));
  const evidenceByPaper = new Map<string, ResearchNode[]>();
  for (const node of project.nodes) {
    if (node.type === "evidence" && typeof node.data.paperId === "string") {
      const list = evidenceByPaper.get(node.data.paperId) ?? [];
      list.push(node);
      evidenceByPaper.set(node.data.paperId, list);
    }
  }

  const results: ResolvedContradictionSide[] = [];
  const seenKeys = new Set<string>();

  const pushSide = (raw: ContradictionSide, fallbackIndex: number) => {
    const evidence = raw.evidenceId ? nodeMap.get(raw.evidenceId) : undefined;
    const resolvedPaperId = raw.paperId || (typeof evidence?.data.paperId === "string" ? evidence.data.paperId : undefined);
    const paper = resolvedPaperId ? nodeMap.get(resolvedPaperId) : undefined;
    const fallbackEvidence = !evidence && paper ? (evidenceByPaper.get(paper.id)?.find((e) => e.data.verified) ?? evidenceByPaper.get(paper.id)?.[0]) : undefined;
    const finalEvidence = evidence || fallbackEvidence;
    const quote = raw.quote || (typeof finalEvidence?.data.quote === "string" ? finalEvidence.data.quote : undefined);
    const abstract = typeof paper?.data.abstract === "string" ? paper.data.abstract : undefined;
    const dedupeKey = finalEvidence?.id || paper?.id || (quote ? `quote:${quote.slice(0, 48)}` : `side:${fallbackIndex}`);
    if (seenKeys.has(dedupeKey)) return;
    seenKeys.add(dedupeKey);
    const letter = String.fromCharCode(65 + results.length);
    results.push({
      key: dedupeKey,
      sideLabel: raw.label || `Study ${letter}`,
      paper,
      evidence: finalEvidence,
      quote,
      abstract,
      definitionNote: raw.definitionNote,
    });
  };

  if (Array.isArray(contradiction.data.sides)) {
    contradiction.data.sides.forEach((side, idx) => {
      if (side && typeof side === "object") pushSide(side, idx);
    });
  }

  const incidentEdges = [
    ...project.edges.filter((e) => e.type === "contradicts" && (e.source === contradiction.id || e.target === contradiction.id)),
    ...project.edges.filter((e) => e.type !== "contradicts" && (e.source === contradiction.id || e.target === contradiction.id)),
  ];

  const candidateIds = [
    ...incidentEdges.map((e) => (e.source === contradiction.id ? e.target : e.source)),
    ...(contradiction.sourceRefs || []),
  ];

  for (const candidateId of candidateIds) {
    const target = nodeMap.get(candidateId);
    if (!target) continue;
    if (target.type === "evidence") {
      pushSide({ evidenceId: target.id }, results.length);
    } else if (target.type === "paper") {
      pushSide({ paperId: target.id }, results.length);
    }
  }

  return results;
}
