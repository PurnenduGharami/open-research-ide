import path from "node:path";
import { auditManuscriptProse, humanizeProseText } from "./prose-linter.mjs";

function formatCitation(paper, indexMap) {
  const num = indexMap.get(paper.id);
  const firstAuthor = Array.isArray(paper.data?.authors) && paper.data.authors[0]
    ? paper.data.authors[0].split(" ").slice(-1)[0]
    : "Unknown";
  const year = paper.data?.year || "n.d.";
  return `[${num ?? "?"}: ${firstAuthor}, ${year}]`;
}

export async function draftManuscriptFromProject(project, options = {}) {
  const papers = project.nodes.filter((n) => n.type === "paper");
  const evidence = project.nodes.filter((n) => n.type === "evidence" && n.data.verificationStatus !== "rejected");
  const verifiedEvidence = evidence.filter((n) => n.data.verified === true);
  const contradictions = project.nodes.filter((n) => n.type === "contradiction");
  const gaps = project.nodes.filter((n) => n.type === "gap");
  const hypotheses = project.nodes.filter((n) => n.type === "hypothesis");
  const reviews = project.nodes.filter((n) => n.type === "review");
  const experiments = project.nodes.filter((n) => n.type === "experiment");
  const results = project.nodes.filter((n) => n.type === "result");
  const labs = project.nodes.filter((n) => n.type === "lab");

  const paperMap = new Map(papers.map((p) => [p.id, p]));
  const citeNum = new Map(papers.map((p, i) => [p.id, i + 1]));
  const at = new Date().toISOString();

  const primaryHypothesis = hypotheses[0];
  const primaryExperiment = experiments[0];

  const abstractParts = [
    `This investigation examines the research question: "${project.curiosity}".`,
    papers.length
      ? `We retrieved ${papers.length} peer-reviewed ${papers.length === 1 ? "record" : "records"} from live academic indexes (${[...new Set(project.sources.filter((s) => s.status === "ok").map((s) => s.provider))].join(", ") || "recorded sources"}) and anchored ${evidence.length} abstract ${evidence.length === 1 ? "passage" : "passages"} (${verifiedEvidence.length} human-confirmed).`
      : "No literature records have been retrieved in this revision.",
    primaryHypothesis ? `The primary testable hypothesis states: ${primaryHypothesis.data?.statement || primaryHypothesis.title}.` : "",
    results.length
      ? `Observed data (${results.length} imported ${results.length === 1 ? "record" : "records"}) are reported separately from frozen pre-registered expectations.`
      : primaryExperiment
        ? `A ${primaryExperiment.data?.modality || "structured"} validation protocol with frozen expected outcomes is prepared; experimental execution remains pending.`
        : "",
  ].filter(Boolean);

  const introLines = [
    `Curiosity driving this work: ${project.curiosity}`,
    papers.length
      ? `Prior published work establishes partial foundations across ${papers.length} retrieved studies (${papers.slice(0, 4).map((p) => `${p.title} ${formatCitation(p, citeNum)}`).join("; ")}).`
      : "Literature retrieval has not yet populated published references.",
    gaps.length
      ? `Three observations narrow the open space:\n${gaps.map((g) => `- ${g.title}${g.data?.description ? `: ${g.data.description}` : ""}`).join("\n")}`
      : "Explicit research gaps will appear once literature analysis commits gap nodes.",
  ];

  const litLines = [];
  if (evidence.length) {
    litLines.push("Anchored passages extracted verbatim from paper abstracts:");
    for (const ev of evidence) {
      const parent = ev.data?.paperId ? paperMap.get(ev.data.paperId) : null;
      const statusLabel = ev.data?.verified ? "Verified" : "Unverified";
      litLines.push(`- (${statusLabel}) "${ev.data?.quote || ev.title}" ${parent ? formatCitation(parent, citeNum) : ""}`);
    }
  } else if (papers.length) {
    litLines.push("Retrieved papers are indexed below; no individual abstract passages have been anchored as evidence nodes yet.");
  }
  if (contradictions.length) {
    litLines.push("\nIdentified tensions across studies:");
    for (const c of contradictions) {
      litLines.push(`- ${c.title}${c.data?.description ? `: ${c.data.description}` : ""}`);
    }
  }

  const hypLines = [];
  if (hypotheses.length) {
    for (const h of hypotheses) {
      hypLines.push(`${h.title}\n${h.data?.statement || ""}`.trim());
    }
  } else {
    hypLines.push("No formal hypothesis has been committed in this revision.");
  }

  if (reviews.length) {
    hypLines.push("\nIndependent Review Panel summary (zero-memory reviewers auditing only the bounded evidence packet):");
    for (const r of reviews) {
      const count = Array.isArray(r.data?.findings) ? r.data.findings.length : 0;
      hypLines.push(`- ${r.title}: ${r.data?.verdict || "No verdict"} (${count} structured ${count === 1 ? "finding" : "findings"}).`);
      for (const f of (r.data?.findings || []).slice(0, 3)) {
        hypLines.push(`  • [${f.severity || "medium"}] ${f.claim || f.finding}: ${f.rationale || ""}`);
      }
    }
  }

  const methodLines = [];
  if (experiments.length) {
    for (const exp of experiments) {
      methodLines.push(`Protocol: ${exp.title} (Modality: ${exp.data?.modality || "general"})`);
      if (exp.data?.objective) methodLines.push(`Objective: ${exp.data.objective}`);
      if (Array.isArray(exp.data?.protocol) && exp.data.protocol.length) {
        methodLines.push("Steps:\n" + exp.data.protocol.map((s, idx) => `${idx + 1}. ${s}`).join("\n"));
      }
      if (Array.isArray(exp.data?.controls) && exp.data.controls.length) {
        methodLines.push(`Controls: ${exp.data.controls.join("; ")}`);
      }
      if (exp.data?.sampleSizeRationale) methodLines.push(`Sample size rationale: ${exp.data.sampleSizeRationale}`);
      if (exp.data?.statisticalPlan) methodLines.push(`Statistical plan: ${exp.data.statisticalPlan}`);
      if (Array.isArray(exp.data?.expectedOutcomes) && exp.data.expectedOutcomes.length) {
        methodLines.push(`Frozen expected outcomes (locked ${exp.data.expectedOutcomesFrozenAt || "before testing"}):\n` +
          exp.data.expectedOutcomes.map((o) => `- ${o.metric}: ${o.prediction}`).join("\n"));
      }
    }
    if (labs.length) {
      methodLines.push("\nCandidate facilities / collaborators (provenance-labelled):");
      for (const lab of labs) {
        const priceNote = lab.data?.price?.kind === "quoted"
          ? `Quoted ${lab.data.price.currency || ""} ${lab.data.price.amount ?? ""}`.trim()
          : lab.data?.price?.kind === "model-estimated"
            ? `Model-estimated (${lab.data.price.note || "unverified"})`
            : "Pricing unavailable";
        methodLines.push(`- ${lab.data?.name || lab.title} (${lab.data?.contacted ? "Contacted" : "Uncontacted"}; ${priceNote})`);
      }
    }
  } else {
    methodLines.push("No validation experiment has been designed yet.");
  }

  const resultLines = [];
  if (results.length) {
    for (const res of results) {
      resultLines.push(`Imported observation (${res.data?.importedAt || res.createdAt}):`);
      if (Array.isArray(res.data?.metricResults) && res.data.metricResults.length) {
        for (const m of res.data.metricResults) {
          resultLines.push(`- ${m.metric}: expected "${m.expected}" vs. observed "${m.observed}" → ${m.verdict.toUpperCase()}${m.notes ? ` (${m.notes})` : ""}`);
        }
      }
      if (res.data?.observations) resultLines.push(res.data.observations);
    }
  } else {
    resultLines.push("No empirical observations have been imported yet. Predictions listed under Methods remain untested hypotheses.");
  }

  const failedSources = project.sources.filter((s) => s.status !== "ok");
  const limitLines = [
    `Evidence audit coverage: ${verifiedEvidence.length} of ${evidence.length} anchored abstract passages have been human-confirmed.`,
    failedSources.length
      ? `Literature retrieval gaps: ${failedSources.map((s) => `${s.provider} returned ${s.error || s.status}`).join("; ")}. No substitute citations were fabricated.`
      : "All queried literature sources responded without error at retrieval time.",
    "Abstract-level evidence cannot substitute for full-text method inspection and statistical replication prior to formal journal submission.",
  ];

  const draft = {
    title: project.title,
    abstract: humanizeProseText(abstractParts.join(" ")),
    sections: [
      { id: "introduction", heading: "1. Introduction & Research Question", content: humanizeProseText(introLines.join("\n\n")), updatedAt: at },
      { id: "literature", heading: "2. Grounded Literature & Contradictions", content: humanizeProseText(litLines.join("\n")), updatedAt: at },
      { id: "hypothesis-review", heading: "3. Hypothesis & Independent Review", content: humanizeProseText(hypLines.join("\n")), updatedAt: at },
      { id: "methods", heading: "4. Validation Design & Frozen Predictions", content: humanizeProseText(methodLines.join("\n\n")), updatedAt: at },
      { id: "results", heading: "5. Observed Results", content: humanizeProseText(resultLines.join("\n\n")), updatedAt: at },
      { id: "limitations", heading: "6. Limitations & Audit Trail", content: humanizeProseText(limitLines.join("\n\n")), updatedAt: at },
    ],
    sourceRevision: project.contentRevision ?? project.revision,
    updatedAt: at,
  };

  const valeConfigPath = options.root ? path.join(options.root, ".vale.ini") : undefined;
  draft.proseAudit = await auditManuscriptProse(draft, { valeConfigPath });
  return draft;
}
