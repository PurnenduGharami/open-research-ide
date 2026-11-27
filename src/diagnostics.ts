import type { DiagnosticItem, ManuscriptDocument, ResearchProject, WorkspaceFileEntry } from "../packages/contracts";

const CLAIM_VERB_RE = /\b(demonstrate[ds]?|show(?:s|ed|n)?|prove[ds]?|reduce[ds]?|increase[ds]?|improve[ds]?|degrade[ds]?|account(?:s|ed)?\s+for|decrease[ds]?|outperform(?:s|ed)?|significantly|correlation)\b/i;
const CITE_MARKER_RE = /(\[@[a-zA-Z0-9_:-]+\]|\[ev[:_a-zA-Z0-9-]+\]|\[\d+[:\],])/i;

export function auditManuscriptClaims(
  manuscript: ManuscriptDocument | undefined,
  project: ResearchProject | null,
): {
  totalSentences: number;
  citedSentences: number;
  unbackedClaims: Array<{ sectionId: string; heading: string; sentence: string }>;
} {
  if (!manuscript) {
    return { totalSentences: 0, citedSentences: 0, unbackedClaims: [] };
  }
  const hasPapers = Boolean(project?.nodes.some((n) => n.type === "paper"));
  let totalSentences = 0;
  let citedSentences = 0;
  const unbackedClaims: Array<{ sectionId: string; heading: string; sentence: string }> = [];

  for (const section of manuscript.sections || []) {
    const sentences = String(section.content || "")
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 24 && !s.startsWith("#") && !s.startsWith("!["));
    for (const sentence of sentences) {
      totalSentences += 1;
      const hasCite = CITE_MARKER_RE.test(sentence);
      if (hasCite) citedSentences += 1;
      else if (hasPapers && /\d+(\.\d+)?\s*(%|ms|kJ|°C|x\b|fold)/i.test(sentence) && CLAIM_VERB_RE.test(sentence)) {
        if (section.id !== "methods" && section.id !== "limitations") {
          unbackedClaims.push({ sectionId: section.id, heading: section.heading, sentence });
        }
      }
    }
  }

  return { totalSentences, citedSentences, unbackedClaims };
}

export function computeProjectDiagnostics(
  project: ResearchProject | null,
  _files?: WorkspaceFileEntry[],
): DiagnosticItem[] {
  if (!project) return [];
  const items: DiagnosticItem[] = [];

  const papers = project.nodes.filter((n) => n.type === "paper");
  const evidence = project.nodes.filter((n) => n.type === "evidence");
  const contradictions = project.nodes.filter((n) => n.type === "contradiction");
  const hypotheses = project.nodes.filter((n) => n.type === "hypothesis");
  const reviews = project.nodes.filter((n) => n.type === "review");
  const experiments = project.nodes.filter((n) => n.type === "experiment");

  for (const paper of papers) {
    if (paper.data.isRetracted) {
      items.push({
        id: `diag:retracted:${paper.id}`,
        severity: "error",
        code: "RETRACTED_PAPER",
        message: `Retracted publication indexed: "${paper.title}". Exclude or inspect retraction notice.`,
        targetView: "literature",
        nodeId: paper.id,
      });
    }
  }

  const unconfirmedCount = evidence.filter((e) => !e.data.verified && e.data.verificationStatus !== "rejected").length;
  if (unconfirmedCount > 0) {
    items.push({
      id: "diag:unconfirmed-evidence",
      severity: "warning",
      code: "UNCONFIRMED_EVIDENCE",
      message: `${unconfirmedCount} anchored ${unconfirmedCount === 1 ? "passage awaits" : "passages await"} human SHA-256 confirmation.`,
      targetView: "research",
      nodeId: evidence.find((e) => !e.data.verified && e.data.verificationStatus !== "rejected")?.id,
    });
  }

  const unresolved = contradictions.filter((c) => !c.data.resolution || c.data.resolution === "unresolved");
  for (const c of unresolved) {
    items.push({
      id: `diag:contradiction:${c.id}`,
      severity: "warning",
      code: "UNRESOLVED_CONTRADICTION",
      message: `Unclassified contradiction: "${c.title}". Triage whether studies truly disagree or differ in definitions.`,
      targetView: "research",
      nodeId: c.id,
    });
  }

  if (hypotheses.length > 0 && reviews.length < 3) {
    items.push({
      id: "diag:review-panel",
      severity: "info",
      code: "UNREVIEWED_HYPOTHESIS",
      message: `${hypotheses.length} hypothesis committed with ${reviews.length}/3 zero-memory independent reviews.`,
      targetView: "research",
      nodeId: hypotheses[0].id,
    });
  }

  for (const exp of experiments) {
    if (!Array.isArray(exp.data.expectedOutcomes) || exp.data.expectedOutcomes.length === 0) {
      items.push({
        id: `diag:exp:${exp.id}`,
        severity: "warning",
        code: "MISSING_FROZEN_OUTCOMES",
        message: `Experiment "${exp.title}" has no frozen expected outcomes prior to testing.`,
        targetView: "experiments",
        nodeId: exp.id,
      });
    }
  }

  if (project.manuscript) {
    const audit = auditManuscriptClaims(project.manuscript, project);
    for (const [idx, claim] of audit.unbackedClaims.slice(0, 6).entries()) {
      items.push({
        id: `diag:claim:${claim.sectionId}:${idx}`,
        severity: "warning",
        code: "UNBACKED_MANUSCRIPT_CLAIM",
        message: `Uncited quantitative claim in ${claim.heading}: "${claim.sentence.slice(0, 95)}…"`,
        targetView: "manuscript",
      });
    }
  }

  const activeContentRev = project.contentRevision ?? project.revision;
  if (project.exports.length > 0 && !project.exports.some((e) => (e.contentRevision ?? e.revision) === activeContentRev)) {
    items.push({
      id: "diag:stale-export",
      severity: "info",
      code: "STALE_EXPORT",
      message: `Content advanced to revision ${activeContentRev} since last export bundle.`,
      targetView: "published",
    });
  }

  return items;
}
