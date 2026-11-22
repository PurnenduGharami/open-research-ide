import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const AI_CLICHE_RULES = [
  { id: "AvoidAI.Delve", pattern: /\b(delve|delving|delved)\b/gi, severity: "warning", message: "Replace AI-overused 'delve' with 'examine', 'analyze', or 'investigate'.", replacement: "examine" },
  { id: "AvoidAI.Tapestry", pattern: /\b(tapestry|interplay|landscape|realm|paradigm shift)\b/gi, severity: "warning", message: "Avoid abstract filler metaphors ('tapestry', 'realm', 'landscape'); name the concrete domain or mechanism." },
  { id: "AvoidAI.InflatedAdj", pattern: /\b(groundbreaking|game-changing|revolutionary|pivotal|paramount|meticulous|multifaceted|nuanced|comprehensive|transformative|cutting-edge)\b/gi, severity: "warning", message: "Avoid inflated promotional adjectives in scientific prose; state specific magnitudes or properties." },
  { id: "AvoidAI.StockVerbs", pattern: /\b(underscores?|highlights?|showcases?|fosters?|garners?|leverages?|harnesses?|spearheads?|embarks?)\b/gi, severity: "suggestion", message: "Prefer direct scientific verbs ('shows', 'indicates', 'uses', 'tests', 'causes')." },
  { id: "AvoidAI.WorthNoting", pattern: /\b(it is worth noting that|importantly,|crucially,|notably,|interestingly,|remarkably,)\b/gi, severity: "warning", message: "Cut meta-commentary lead-ins; state the claim directly.", replacement: "" },
  { id: "AvoidAI.RapidlyEvolving", pattern: /\b(in today's rapidly evolving|in recent years,? there has been|plays a (crucial|pivotal|vital|key) role in)\b/gi, severity: "error", message: "Remove generic throat-clearing openings; open with the concrete empirical observation." },
  { id: "AvoidAI.EmptyConclusion", pattern: /\b(in conclusion,?|to summarize,?|in summary,?)\s+(it is clear that|this (study|paper|work) (demonstrates|highlights))/gi, severity: "warning", message: "State the specific empirical takeaway directly instead of a formulaic conclusion lead-in." },
  { id: "AvoidAI.WordyFiller", pattern: /\b(a wide range of|in order to|due to the fact that|it can be seen that|there is a need to)\b/gi, severity: "suggestion", message: "Tighten wordy filler ('many', 'to', 'because', 'data show')." },
  { id: "AvoidAI.Seamlessly", pattern: /\b(seamlessly|effortlessly|robustly|holistically)\b/gi, severity: "warning", message: "Remove vague promotional adverbs; specify measurable behavior." },
];

const DETERMINISTIC_REPLACEMENTS = [
  [/\bIt is worth noting that\s+/gi, ""],
  [/\bImportantly,\s+/gi, ""],
  [/\bCrucially,\s+/gi, ""],
  [/\bNotably,\s+/gi, ""],
  [/\bIn order to\b/gi, "To"],
  [/\bdue to the fact that\b/gi, "because"],
  [/\ba wide range of\b/gi, "several"],
  [/\bplays a (?:crucial|pivotal|vital|key) role in\b/gi, "drives"],
  [/\bdelve(?:s|d)? into\b/gi, "examine"],
  [/\bdelving into\b/gi, "examining"],
  [/\bleverage(?:s|d)?\b/gi, "use"],
  [/\bseamlessly\s+/gi, ""],
  [/\bmultifaceted\b/gi, "complex"],
  [/\bgroundbreaking\b/gi, "novel"],
  [/\bpivotal\b/gi, "central"],
  [/\bparamount\b/gi, "essential"],
  [/\bunderscores\b/gi, "supports"],
  [/\bunderscore\b/gi, "support"],
];

function checkSentenceCadence(sectionId, text) {
  const issues = [];
  const paragraphs = String(text || "").split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  for (const para of paragraphs) {
    const sentences = para.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
    if (sentences.length < 4) continue;
    const lengths = sentences.map((s) => s.split(/\s+/).length);
    let uniformStreak = 1;
    for (let i = 1; i < lengths.length; i += 1) {
      if (Math.abs(lengths[i] - lengths[i - 1]) <= 3) uniformStreak += 1;
      else uniformStreak = 1;
      if (uniformStreak >= 4) {
        issues.push({
          rule: "Humanizer.UniformCadence",
          severity: "suggestion",
          sectionId,
          excerpt: sentences.slice(i - 3, i + 1).join(" ").slice(0, 140),
          message: "Four consecutive sentences have nearly identical length. Vary sentence rhythm for natural academic readability.",
        });
        break;
      }
    }
  }
  return issues;
}

function checkTransitionStacking(sectionId, text) {
  const transitions = text.match(/(?:^|\.\s+)(Furthermore|Moreover|Additionally|Consequently|Nevertheless),/gm) || [];
  if (transitions.length >= 3) {
    return [{
      rule: "AvoidAI.TransitionStacking",
      severity: "warning",
      sectionId,
      excerpt: transitions.slice(0, 3).map((t) => t.trim()).join(" / "),
      message: `Found ${transitions.length} formal transition adverbs ('Furthermore/Moreover/Additionally') in one section. Connect arguments directly instead.`,
    }];
  }
  return [];
}

function runValeCli(markdownText, configPath) {
  return new Promise((resolve) => {
    mkdtemp(path.join(tmpdir(), "ori-vale-")).then(async (dir) => {
      const target = path.join(dir, "manuscript.md");
      try {
        await writeFile(target, markdownText, "utf8");
        execFile("vale", ["--output=JSON", "--config", configPath, target], { timeout: 8000, encoding: "utf8" }, async (error, stdout) => {
          await rm(dir, { recursive: true, force: true }).catch(() => {});
          if (error && error.code === "ENOENT") return resolve(null);
          try {
            const parsed = JSON.parse(stdout || "{}");
            const entries = Object.values(parsed).flat();
            const mapped = entries.map((item) => ({
              rule: `Vale.${item.Check || "Style"}`,
              severity: item.Severity === "error" ? "error" : item.Severity === "warning" ? "warning" : "suggestion",
              sectionId: "manuscript",
              excerpt: String(item.Match || "").slice(0, 120),
              message: String(item.Message || "Vale style suggestion"),
            }));
            resolve(mapped);
          } catch {
            resolve(null);
          }
        });
      } catch {
        await rm(dir, { recursive: true, force: true }).catch(() => {});
        resolve(null);
      }
    }).catch(() => resolve(null));
  });
}

export async function auditManuscriptProse(manuscript, options = {}) {
  const sections = [
    { id: "abstract", heading: "Abstract", content: manuscript.abstract || "" },
    ...(manuscript.sections || []),
  ];
  const issues = [];
  let wordCount = 0;

  for (const section of sections) {
    const content = String(section.content || "");
    wordCount += content.trim() ? content.trim().split(/\s+/).length : 0;
    for (const rule of AI_CLICHE_RULES) {
      const matches = [...content.matchAll(rule.pattern)];
      for (const match of matches.slice(0, 5)) {
        const idx = match.index ?? 0;
        const start = Math.max(0, idx - 30);
        const end = Math.min(content.length, idx + match[0].length + 40);
        issues.push({
          rule: rule.id,
          severity: rule.severity,
          sectionId: section.id,
          excerpt: content.slice(start, end).replace(/\s+/g, " ").trim(),
          message: rule.message,
          ...(rule.replacement !== undefined ? { replacement: rule.replacement } : {}),
        });
      }
    }
    issues.push(...checkTransitionStacking(section.id, content));
    issues.push(...checkSentenceCadence(section.id, content));
  }

  let engine = "builtin";
  if (options.useVale !== false && options.valeConfigPath) {
    const fullMd = sections.map((s) => `## ${s.heading}\n\n${s.content}`).join("\n\n");
    const valeIssues = await runValeCli(fullMd, options.valeConfigPath);
    if (Array.isArray(valeIssues)) {
      engine = "vale+builtin";
      issues.push(...valeIssues.slice(0, 40));
    }
  }

  const penalty = issues.reduce((sum, item) => sum + (item.severity === "error" ? 10 : item.severity === "warning" ? 5 : 2), 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const summary = issues.length === 0
    ? "Clean academic prose — zero AI clichés or filler patterns detected."
    : `Detected ${issues.length} style ${issues.length === 1 ? "issue" : "issues"} across ${wordCount} words (score ${score}/100).`;

  return {
    engine,
    checkedAt: new Date().toISOString(),
    score,
    wordCount,
    issueCount: issues.length,
    summary,
    issues: issues.slice(0, 60),
  };
}

export function humanizeProseText(text) {
  let out = String(text || "");
  for (const [pattern, replacement] of DETERMINISTIC_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  out = out.replace(/(^|[.!?]\s+)([a-z])/g, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
  out = out.replace(/[ \t]{2,}/g, " ");
  return out.trim();
}
