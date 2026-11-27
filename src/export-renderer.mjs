import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { projectExportsDir, projectSchema, readProject } from "../plugins/research-engine/engine.mjs";
import { collectAllWorkspaceFilesFlat } from "./workspace-files.mjs";

const TYPES = ["paper", "evidence", "contradiction", "gap", "hypothesis", "experiment", "result", "review", "lab"];
const TYPE_LABELS = {
  paper: ["Paper", "Papers"],
  evidence: ["Evidence", "Evidence"],
  contradiction: ["Contradiction", "Contradictions"],
  gap: ["Gap", "Research gaps"],
  hypothesis: ["Hypothesis", "Hypotheses"],
  experiment: ["Experiment", "Experiments"],
  result: ["Result", "Observed results"],
  review: ["Independent review", "Independent Review Panel"],
  lab: ["Facility / Lab", "Facilities & Labs"],
};

const HIDDEN_INTERNAL_KEYS = new Set(["quoteSha256", "abstractSha256", "packetSha256", "providerIds", "rawResponse", "sessionKey", "runId"]);

const html = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character]));

const compactKey = (key) => key.toLowerCase().replace(/[^a-z0-9]/g, "");
const humanKey = (key) => {
  if (compactKey(key) === "outputtps") return "Run-average output TPS";
  return key.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
};

const displayValue = (value) => {
  if (value === null || value === undefined) return "Not recorded";
  if (Array.isArray(value) && value.every((item) => item === null || ["string", "number", "boolean"].includes(typeof item))) {
    return value.map((item) => (item === null ? "null" : String(item))).join(", ") || "None recorded";
  }
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
};

function safeHref(key, value) {
  if (typeof value !== "string") return null;
  const normalized = compactKey(key);
  const candidate = normalized === "doi" && value ? `https://doi.org/${value}` : value;
  if (!["url", "doi", "website", "homepage", "sourceurl", "rorurl", "openaccessurl"].includes(normalized)) return null;
  try {
    const parsed = new URL(candidate);
    return ["https:", "http:", "mailto:"].includes(parsed.protocol) ? parsed.href : null;
  } catch { return null; }
}

function findLabPricing(node) {
  const basisKeys = new Set(["pricebasis", "pricingbasis", "costbasis", "quotestatus", "pricetype", "pricingtype", "costtype", "kind"]);
  let hasPricing = false;
  let basis = "";
  const visit = (value, depth = 0) => {
    if (!value || typeof value !== "object" || depth > 4) return;
    for (const [key, child] of Object.entries(value)) {
      const normalized = compactKey(key);
      if (normalized.includes("price") || normalized.includes("cost") || normalized.includes("quote")) hasPricing = true;
      if (basisKeys.has(normalized) && typeof child === "string") basis = child;
      if (child && typeof child === "object") visit(child, depth + 1);
    }
  };
  visit(node.data);
  if (!hasPricing) return null;
  if (/model|estimat|approx/i.test(basis)) return "Model-estimated price — unverified";
  if (/quot/i.test(basis)) return "Lab-quoted price";
  if (/unavailable/i.test(basis)) return "Pricing unavailable";
  return "Pricing basis not recorded — unverified";
}

function nodeStatus(node) {
  if (node.type === "evidence") {
    if (node.data.verificationStatus === "rejected") {
      return { text: "Rejected evidence — excluded by researcher", kind: "warning" };
    }
    return node.data.verified === true
      ? { text: "Human-confirmed evidence", kind: "verified" }
      : { text: "Unverified evidence — human confirmation required", kind: "warning" };
  }
  if (node.type === "lab") {
    const pricing = findLabPricing(node);
    if (pricing) return { text: pricing, kind: pricing === "Lab-quoted price" ? "verified" : "warning" };
  }
  return null;
}

function renderGraphSvg(project) {
  if (!project.nodes.length) return "";
  const colIndex = { paper: 0, evidence: 1, contradiction: 1, gap: 2, hypothesis: 3, review: 4, experiment: 5, result: 6, lab: 6 };
  const cols = new Map();
  for (const node of project.nodes) {
    const c = colIndex[node.type] ?? 0;
    if (!cols.has(c)) cols.set(c, []);
    cols.get(c).push(node);
  }
  const colEntries = [...cols.entries()].sort(([a], [b]) => a - b);
  const maxRows = Math.max(1, ...colEntries.map(([, list]) => list.length));
  const boxW = 164;
  const boxH = 54;
  const gapX = 56;
  const gapY = 22;
  const pad = 20;
  const width = pad * 2 + colEntries.length * boxW + Math.max(0, colEntries.length - 1) * gapX;
  const height = pad * 2 + maxRows * boxH + Math.max(0, maxRows - 1) * gapY;
  const coords = new Map();
  colEntries.forEach(([, list], cIdx) => {
    const x = pad + cIdx * (boxW + gapX);
    list.forEach((node, rIdx) => {
      const y = pad + rIdx * (boxH + gapY);
      coords.set(node.id, { x, y, cx: x + boxW / 2, cy: y + boxH / 2 });
    });
  });
  const edgesSvg = project.edges.map((edge) => {
    const s = coords.get(edge.source);
    const t = coords.get(edge.target);
    if (!s || !t) return "";
    const stroke = edge.type === "contradicts" ? "#b91c1c" : edge.type === "supports" ? "#1e4fc2" : "#787e88";
    return `<line x1="${s.x + boxW}" y1="${s.cy}" x2="${t.x}" y2="${t.cy}" stroke="${stroke}" stroke-width="1.5" opacity="0.75" />`;
  }).join("");
  const nodesSvg = project.nodes.map((node) => {
    const pos = coords.get(node.id);
    if (!pos) return "";
    const border = node.type === "contradiction" ? "#b91c1c" : node.type === "hypothesis" || node.type === "experiment" ? "#1e4fc2" : "#e6e6e2";
    const label = node.title.length > 26 ? `${node.title.slice(0, 25)}…` : node.title;
    return `<g><rect x="${pos.x}" y="${pos.y}" width="${boxW}" height="${boxH}" rx="11" fill="#ffffff" stroke="${border}" stroke-width="1.2" /><text x="${pos.x + 10}" y="${pos.y + 18}" font-size="9" font-weight="600" fill="#787e88">${html(TYPE_LABELS[node.type][0].toUpperCase())}</text><text x="${pos.x + 10}" y="${pos.y + 36}" font-size="11" font-weight="600" fill="#111315">${html(label)}</text></g>`;
  }).join("");
  return `<div class="svg-wrap"><svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="Knowledge graph diagram with ${project.nodes.length} nodes and ${project.edges.length} edges"><rect width="${width}" height="${height}" rx="18" fill="#f5f5f3" />${edgesSvg}${nodesSvg}</svg></div>`;
}

function renderMetricComparisonHtml(node) {
  const rows = node.data?.metricResults;
  if (!Array.isArray(rows) || !rows.length) return "";
  return `<table class="metric-table"><thead><tr><th>Metric</th><th>Frozen Expected</th><th>Observed</th><th>Verdict</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${html(r.metric)}</td><td>${html(r.expected)}</td><td>${html(r.observed)}</td><td><span class="badge ${r.verdict === "supports" ? "verified" : "warning"}">${html(r.verdict)}</span></td></tr>`).join("")}</tbody></table>`;
}

function dataFields(data, node) {
  const fields = Object.entries(data || {}).filter(([key]) => key !== "metricResults");
  if (!fields.length) return "<p class=\"empty\">No additional fields recorded.</p>";
  const pricing = node.type === "lab" ? findLabPricing(node) : null;
  return `<dl class="fields">${fields.map(([key, value]) => {
    const normalized = compactKey(key);
    const isPrice = pricing && (normalized.includes("price") || normalized.includes("cost")) && !normalized.includes("basis");
    const label = `${humanKey(key)}${isPrice ? ` (${pricing})` : ""}`;
    const href = safeHref(key, value);
    const content = typeof value === "object" && value !== null
      ? `<pre role="region" aria-label="${html(label)} structured data" tabindex="0"><code>${html(displayValue(value))}</code></pre>`
      : href
        ? `<a href="${html(href)}" rel="noreferrer nofollow">${html(displayValue(value))}</a>`
        : html(displayValue(value));
    return `<div class="field"><dt>${html(label)}</dt><dd>${content}</dd></div>`;
  }).join("")}</dl>`;
}

function renderContradictionSidesHtml(node) {
  const sides = Array.isArray(node.data?.sides) ? node.data.sides : [];
  if (!sides.length) return "";
  const resolution = typeof node.data?.resolution === "string" ? node.data.resolution : "unresolved";
  return `<p class="meta">Triage: <strong>${html(resolution.replace(/-/g, " "))}</strong></p><div class="sides-grid">${sides.map((side, idx) => `<div class="side-box"><strong>${html(side.label || `Study ${idx + 1}`)}</strong>${side.quote ? `<blockquote>&ldquo;${html(side.quote)}&rdquo;</blockquote>` : ""}${side.definitionNote ? `<p class="meta">${html(side.definitionNote)}</p>` : ""}</div>`).join("")}</div>`;
}

function renderNode(node, index) {
  const status = nodeStatus(node);
  return `<article class="artifact" id="artifact-${index}" data-type="${html(node.type)}" data-node-id="${html(node.id)}">
    <div class="artifact-heading"><h3>${html(node.title)}</h3><span class="type">${html(TYPE_LABELS[node.type][0])}</span></div>
    ${status ? `<p class="badge ${status.kind}">${html(status.text)}</p>` : ""}
    <p class="meta"><code>${html(node.id)}</code> · Updated <time datetime="${html(node.updatedAt)}">${html(node.updatedAt)}</time></p>
    ${node.sourceRefs.length ? `<p class="meta">Source references: ${html(node.sourceRefs.join(", "))}</p>` : ""}
    ${node.type === "contradiction" ? renderContradictionSidesHtml(node) : ""}
    ${node.type === "result" ? renderMetricComparisonHtml(node) : ""}
    ${dataFields(node.data, node)}
  </article>`;
}

function recordFields(record) {
  return `<dl class="fields compact">${Object.entries(record).map(([key, value]) =>
    `<div class="field"><dt>${html(humanKey(key))}</dt><dd>${html(displayValue(value))}</dd></div>`).join("")}</dl>`;
}

function optionalSection(id, title, records, renderer) {
  if (!records.length) return "";
  return `<section id="${id}"><h2>${html(title)}</h2>${renderer(records)}</section>`;
}

const CSS = `
:root{color-scheme:light;--canvas:#fcfcfb;--parchment:#f5f5f3;--pearl:#ffffff;--ink:#111315;--muted:#525760;--tertiary:#787e88;--line:#e6e6e2;--soft:#efefec;--primary:#1e4fc2;--primary-focus:#173f9e;--warning:#92400e;--warning-soft:#fffbeb;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:17px;line-height:1.47;letter-spacing:-0.011em;color:var(--ink);background:var(--canvas)}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:24px}body{margin:0}a{color:var(--primary);text-underline-offset:3px}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--primary-focus);outline-offset:2px}code,pre{font-family:ui-monospace,"SFMono-Regular",monospace;font-size:13px;letter-spacing:0}code{overflow-wrap:anywhere}.shell{width:min(980px,calc(100% - 48px));margin:0 auto}.report-header{padding:64px 0 40px;background:var(--parchment)}.brand{font-size:14px;font-weight:600;color:var(--primary);letter-spacing:-0.01em;margin-bottom:16px}.report-header h1{font-family:Georgia,"Times New Roman",serif;font-size:clamp(34px,5vw,48px);font-weight:400;line-height:1.08;letter-spacing:-0.02em;max-width:24ch;margin:0 0 16px}.meta{color:var(--tertiary);font-size:14px;line-height:1.43}.revision{display:inline-block;border:1px solid var(--line);border-radius:9999px;background:var(--pearl);color:var(--primary);padding:4px 12px;font-weight:600;margin-right:8px}.navigation{border-bottom:1px solid var(--line);background:var(--pearl);position:sticky;top:0;z-index:10}.navigation ul{display:flex;gap:8px;list-style:none;padding:10px 0;margin:0;overflow-x:auto}.navigation a{display:block;padding:6px 12px;border-radius:9999px;text-decoration:none;color:var(--muted);font-size:14px;white-space:nowrap}.navigation a:hover{background:var(--parchment);color:var(--primary)}main{padding:40px 0 64px}section{margin:0 0 48px}h2{font-family:Georgia,"Times New Roman",serif;font-size:32px;font-weight:400;line-height:1.18;letter-spacing:-0.015em;margin:0 0 20px}h3{font-size:20px;font-weight:600;line-height:1.25;letter-spacing:-0.01em;margin:0}.curiosity{font-size:22px;font-weight:400;line-height:1.45;margin:0 0 16px}.filters{padding:24px;background:var(--parchment);border-radius:14px}.filter-row{display:grid;grid-template-columns:minmax(180px,1fr) minmax(160px,.45fr) auto auto;gap:12px;align-items:end}.control label{display:block;font-size:14px;font-weight:600;margin-bottom:6px}.control input,.control select{width:100%;height:44px;border:1px solid var(--line);border-radius:9999px;background:var(--pearl);padding:10px 18px;color:var(--ink);font-size:15px}button{min-height:44px;border:1px solid var(--primary);border-radius:9999px;padding:10px 20px;background:var(--primary);color:#fff;font-size:14px;font-weight:500;cursor:pointer}button#clear-filters{background:var(--pearl);color:var(--primary)}button:active{transform:scale(0.97)}.filter-status{display:block;color:var(--tertiary);font-size:14px;margin-top:12px}.artifact{padding:24px;margin-bottom:16px;border:1px solid var(--line);border-radius:14px;background:var(--pearl);overflow-wrap:anywhere}.artifact-heading{display:flex;justify-content:space-between;align-items:start;gap:16px;margin-bottom:8px}.type{color:var(--tertiary);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;white-space:nowrap}.badge{display:inline-block;padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:600;margin:4px 0 10px}.badge.warning{color:var(--warning);background:var(--warning-soft)}.badge.verified{color:var(--primary);background:rgba(30,79,194,0.08)}.sides-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:12px 0}.side-box{padding:12px 14px;border-radius:10px;border:1px solid var(--line);background:var(--parchment)}.side-box blockquote{margin:8px 0;font-size:14px;color:var(--ink)}.fields{margin:16px 0 0}.field{display:grid;grid-template-columns:minmax(140px,220px) minmax(0,1fr);gap:16px;padding:10px 0;border-top:1px solid var(--soft)}.field dt{font-size:14px;font-weight:600;color:var(--tertiary)}.field dd{margin:0;min-width:0;font-size:15px;white-space:pre-wrap}.field pre{white-space:pre-wrap;overflow:auto;max-height:420px;margin:0;padding:12px;background:var(--parchment);border-radius:11px}.svg-wrap{margin:16px 0 24px;overflow-x:auto}.metric-table{width:100%;border-collapse:collapse;margin:16px 0;font-size:14px}.metric-table th,.metric-table td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:left}.metric-table th{color:var(--tertiary);font-weight:600}.manuscript-block{padding:28px;background:var(--parchment);border-radius:14px;margin-bottom:24px}.manuscript-block p{white-space:pre-wrap;margin:12px 0}.record-list{list-style:none;padding:0;margin:0}.record-list>li{padding:16px 0;border-top:1px solid var(--line)}.report-footer{padding:40px 0;background:var(--parchment);color:var(--tertiary);font-size:12px}[hidden]{display:none!important}
@media(max-width:700px){.filter-row,.sides-grid{grid-template-columns:1fr}.field{grid-template-columns:1fr;gap:4px}}
@page{size:A4;margin:18mm 16mm 20mm}
@media print{:root{background:#fff;font-size:11px;letter-spacing:0}.shell{width:100%}.report-header{padding:0 0 16px;background:#fff}.navigation,.filters,.report-footer{display:none}.artifact{break-inside:avoid-page;padding:14px}}
`;

const INTERACTION = `(() => {
  const project = JSON.parse(document.getElementById("canonical-project").textContent);
  const form = document.getElementById("artifact-filters");
  const query = document.getElementById("artifact-query");
  const type = document.getElementById("artifact-type");
  const clear = document.getElementById("clear-filters");
  const status = document.getElementById("filter-status");
  const artifacts = Array.from(document.querySelectorAll(".artifact"));
  const apply = () => {
    const needle = query.value.trim().toLocaleLowerCase();
    let visible = 0;
    for (const artifact of artifacts) {
      const matches = (!needle || artifact.textContent.toLocaleLowerCase().includes(needle)) &&
        (type.value === "all" || artifact.dataset.type === type.value);
      artifact.hidden = !matches;
      if (matches) visible += 1;
    }
    for (const section of document.querySelectorAll("[data-artifact-section]")) {
      section.hidden = !section.querySelector(".artifact:not([hidden])");
    }
    status.textContent = visible + " of " + project.nodes.length + " artifacts shown";
  };
  form.addEventListener("submit", (event) => { event.preventDefault(); apply(); });
  clear.addEventListener("click", () => { query.value = ""; type.value = "all"; apply(); query.focus(); });
})();`;

function embeddedJson(project) {
  return JSON.stringify(project).replace(/[<>&\u2028\u2029]/g, (character) => ({
    "<": "\\u003c", ">": "\\u003e", "&": "\\u0026", "\u2028": "\\u2028", "\u2029": "\\u2029",
  }[character]));
}

export function renderProjectHtml(input) {
  const project = projectSchema.parse(input);
  const sections = TYPES.filter((type) => project.nodes.some((node) => node.type === type));
  const navigation = [
    ...(project.manuscript ? [["manuscript", "Manuscript"]] : []),
    ...sections.map((type) => [`artifacts-${type}`, TYPE_LABELS[type][1]]),
    ["graph", "Knowledge graph"],
    ["timeline", "Timeline"],
    ...(project.sources.length ? [["sources", "Sources"]] : []),
    ...(project.runs.length ? [["runs", "Runs"]] : []),
  ];
  const nodeSections = sections.map((type) => {
    const nodes = project.nodes.map((node, index) => ({ node, index })).filter(({ node }) => node.type === type);
    return `<section id="artifacts-${type}" data-artifact-section><h2>${TYPE_LABELS[type][1]}</h2>${nodes.map(({ node, index }) => renderNode(node, index)).join("")}</section>`;
  }).join("");
  const manuscriptHtml = project.manuscript
    ? `<section id="manuscript"><h2>Research Manuscript</h2><div class="manuscript-block"><h3>Abstract</h3><p>${html(project.manuscript.abstract)}</p>${project.manuscript.sections.map((s) => `<h3>${html(s.heading)}</h3><p>${html(s.content)}</p>`).join("")}</div></section>`
    : "";
  const edges = project.edges.map((edge) => `<li><h3>${html(edge.label)}</h3>${recordFields(edge)}</li>`).join("");
  const timeline = project.timeline.map((ev) => `<li><h3>${html(ev.message)}</h3><p class="meta"><time datetime="${html(ev.at)}">${html(ev.at)}</time> · ${html(ev.kind)}</p></li>`).join("");
  const sources = project.sources.map((source) => `<li><h3>${html(source.provider)} · ${html(source.status)}</h3>${recordFields(source)}</li>`).join("");
  const runs = project.runs.map((run) => `<li><h3>${html(run.kind)} · ${html(run.status)}</h3>${recordFields(run)}</li>`).join("");

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'">
<title>${html(project.title)} — Revision ${project.revision}</title><style>${CSS}</style></head>
<body><header class="report-header"><div class="shell"><div class="brand">Open Research IDE</div><h1>${html(project.title)}</h1><p class="meta"><span class="revision">Canonical revision ${project.revision}</span>${html(project.status)} · Local-only · State updated ${html(project.updatedAt)}</p></div></header>
<nav class="navigation" aria-label="Report sections"><div class="shell"><ul><li><a href="#overview">Overview</a></li>${navigation.map(([id, label]) => `<li><a href="#${id}">${html(label)}</a></li>`).join("")}</ul></div></nav>
<main class="shell"><section id="overview"><h2>Research question</h2><p class="curiosity">${html(project.curiosity)}</p><p class="meta">Project ${html(project.projectId)} · Mode: ${html(project.mode || "guided")} · Created ${html(project.createdAt)}</p></section>
${manuscriptHtml}
<search><form id="artifact-filters" class="filters" action="#artifacts" method="get"><div class="filter-row"><div class="control"><label for="artifact-query">Search research artifacts</label><input id="artifact-query" name="query" type="search" autocorrect="off" autocapitalize="none" spellcheck="false"></div><div class="control"><label for="artifact-type">Artifact type</label><select id="artifact-type" name="type"><option value="all">All types</option>${sections.map((type) => `<option value="${type}">${html(TYPE_LABELS[type][1])}</option>`).join("")}</select></div><button type="submit">Apply filters</button><button id="clear-filters" type="button">Clear filters</button></div><output id="filter-status" class="filter-status" for="artifact-query artifact-type">${project.nodes.length} of ${project.nodes.length} artifacts shown</output></form></search>
<div id="artifacts">${nodeSections || "<section><h2>Research artifacts</h2><p class=\"empty\">No research artifacts are recorded at this revision.</p></section>"}</div>
<section id="graph"><h2>Knowledge graph</h2>${renderGraphSvg(project)}${edges ? `<ol class="record-list">${edges}</ol>` : "<p class=\"empty\">No semantic edges are recorded at this revision.</p>"}</section>
<section id="timeline"><h2>Research timeline</h2>${timeline ? `<ol class="record-list">${timeline}</ol>` : "<p class=\"empty\">No timeline events are recorded.</p>"}</section>
${optionalSection("sources", "Source provenance", project.sources, () => `<ol class="record-list">${sources}</ol>`)}
${optionalSection("runs", "Runs and measured usage", project.runs, () => `<ol class="record-list">${runs}</ol>`)}
</main><footer class="report-footer"><div class="shell">Rendered deterministically from canonical project JSON at revision ${project.revision}. Evidence remains unverified unless explicitly labelled human-confirmed. Pricing is identified by its recorded basis.</div></footer>
<script id="canonical-project" type="application/json">${embeddedJson(project)}</script><script>${INTERACTION}</script></body></html>`;
}

function latex(value) {
  return String(value).replace(/[\\{}$&#_%^~]/g, (character) => ({
    "\\": "\\textbackslash{}", "{": "\\{", "}": "\\}", "$": "\\$", "&": "\\&",
    "#": "\\#", "_": "\\_", "%": "\\%", "^": "\\textasciicircum{}", "~": "\\textasciitilde{}",
  }[character])).replace(/\r?\n/g, " ");
}

function latexFields(data, node) {
  const entries = Object.entries(data || {}).filter(([key]) => !HIDDEN_INTERNAL_KEYS.has(key));
  if (!entries.length) return "\\emph{No additional fields recorded.}\n";
  const pricing = node?.type === "lab" ? findLabPricing(node) : null;
  return `\\begin{description}\n${entries.map(([key, value]) => {
    const normalized = compactKey(key);
    const isPrice = pricing && (normalized.includes("price") || normalized.includes("cost")) && !normalized.includes("basis");
    return `  \\item[${latex(humanKey(key))}${isPrice ? ` (${latex(pricing)})` : ""}] ${latex(displayValue(value))}`;
  }).join("\n")}\n\\end{description}\n`;
}

function bibEntryType(paperData) {
  const venue = String(paperData?.venue || "").trim();
  if (!venue) return "misc";
  if (/conference|proceedings|symposium|workshop|neurips|icml|iclr|acl|emnlp|cvpr|sigcomm|osdi|sosp|chi|aaai/i.test(venue)) {
    return "inproceedings";
  }
  if (/arxiv/i.test(venue)) return "misc";
  return "article";
}

function latexPreambleForTemplate(template = "article") {
  if (template === "ieee") {
    return `\\documentclass[conference]{IEEEtran}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage[hidelinks]{hyperref}
\\usepackage{enumitem}
\\setlist{description}{style=nextline,leftmargin=0pt}`;
  }
  if (template === "neurips") {
    return `\\documentclass[10pt]{article}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage[letterpaper,top=1in,bottom=1in,left=1.25in,right=1.25in]{geometry}
\\usepackage{times}
\\usepackage[hidelinks]{hyperref}
\\usepackage{enumitem}
\\setlist{description}{style=nextline,leftmargin=0pt}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{5.5pt}`;
  }
  if (template === "nature") {
    return `\\documentclass[11pt]{article}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage[a4paper,margin=20mm]{geometry}
\\usepackage[hidelinks]{hyperref}
\\usepackage{enumitem}
\\setlist{description}{style=nextline,leftmargin=0pt}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{6pt}`;
  }
  return `\\documentclass[11pt]{article}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage[a4paper,margin=22mm]{geometry}
\\usepackage[hidelinks]{hyperref}
\\usepackage{enumitem}
\\setlist{description}{style=nextline,leftmargin=0pt}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{6pt}`;
}

export function renderProjectLatex(input, options = {}) {
  const project = projectSchema.parse(input);
  const template = ["article", "ieee", "neurips", "nature"].includes(options.template) ? options.template : "article";
  const papers = project.nodes.filter((node) => node.type === "paper");
  const citationKeys = new Map(papers.map((node, index) => [node.id, `paper_${index + 1}`]));

  const manuscriptTex = project.manuscript
    ? `\\begin{abstract}\n${latex(project.manuscript.abstract)}\n\\end{abstract}\n\n${project.manuscript.sections.map((s) => `\\section{${latex(s.heading.replace(/^\d+\.\s*/, ""))}}\n${s.content.split(/\n\n+/).map((p) => latex(p)).join("\n\n")}\n`).join("\n")}\n\\appendix\n`
    : "";

  const nodeSections = TYPES.map((type) => {
    const nodes = project.nodes.filter((node) => node.type === type);
    if (!nodes.length) return "";
    return `\\section{${TYPE_LABELS[type][1]}}\n${nodes.map((node) => {
      const status = nodeStatus(node);
      const citation = citationKeys.has(node.id) ? `~\\cite{${citationKeys.get(node.id)}}` : "";
      return `\\subsection*{${latex(node.title)}${citation}}\n${status ? `\\textbf{${latex(status.text)}}\\par\n` : ""}${latexFields(node.data, node)}`;
    }).join("\n")}`;
  }).filter(Boolean).join("\n");

  const references = papers.length ? papers.map((node) => {
    const data = node.data || {};
    const entryType = bibEntryType(data);
    const fields = [];
    const add = (key, value) => {
      if (value !== undefined && value !== null && value !== "" && displayValue(value) !== "") {
        fields.push(`  ${key} = {${latex(displayValue(value))}}`);
      }
    };
    add("title", node.title);
    if (Array.isArray(data.authors) && data.authors.length) {
      add("author", data.authors.map((author) => (typeof author === "object" ? author.name || "" : author)).filter(Boolean).join(" and "));
    }
    if (entryType === "article") add("journal", data.venue);
    else if (entryType === "inproceedings") add("booktitle", data.venue);
    add("year", data.year);
    add("doi", data.doi);
    add("url", data.url);
    add("note", data.providers || data.provider ? `Source: ${displayValue(data.providers || data.provider)}` : "");
    return `@${entryType}{${citationKeys.get(node.id)},\n${fields.join(",\n")}\n}`;
  }).join("\n\n") + "\n" : "% No paper records are present in this canonical revision.\n";

  const bibStyle = template === "ieee" ? "IEEEtran" : template === "nature" ? "unsrt" : "plain";
  const mainTex = `${latexPreambleForTemplate(template)}
\\title{${latex(project.title)}\\\\ Canonical revision ${project.revision}}
\\author{Open Research IDE --- Local-First Scientific Record}
\\date{Canonical state updated ${latex(project.updatedAt)}}
\\begin{document}
\\maketitle
${manuscriptTex}\\section{Research question}
${latex(project.curiosity)}\\par
\\textbf{Project:} \\texttt{${latex(project.projectId)}}\\par
\\textbf{Status:} ${latex(project.status)}\\par
\\textbf{Evidence policy:} Evidence is unverified unless explicitly labelled human-confirmed. Pricing is identified by its recorded basis.
${nodeSections || "\\section{Research artifacts}\n\\emph{No research artifacts are recorded at this revision.}\n"}
\\section{Knowledge graph}
${project.edges.length ? `\\begin{itemize}\n${project.edges.map((edge) => `  \\item \\textbf{${latex(edge.label)}}: \\texttt{${latex(edge.source)}} $\\rightarrow$ \\texttt{${latex(edge.target)}} (${latex(edge.type)})`).join("\n")}\n\\end{itemize}` : "\\emph{No semantic edges are recorded at this revision.}"}
\\nocite{*}
\\bibliographystyle{${bibStyle}}
\\bibliography{references}
\\end{document}
`;
  return { mainTex, referencesBib: references };
}

export function buildRoCrateMetadata(project, extraParts = []) {
  const valid = projectSchema.parse(project);
  const baseParts = [
    { "@id": "research-report.html" },
    { "@id": "latex/main.tex" },
    { "@id": "latex/references.bib" },
    { "@id": "research-project.json" },
    ...extraParts.map((item) => ({ "@id": item.path })),
  ];
  const entities = [
    {
      "@id": "ro-crate-metadata.json",
      "@type": "CreativeWork",
      conformsTo: { "@id": "https://w3id.org/ro/crate/1.1" },
      about: { "@id": "./" },
    },
    {
      "@id": "./",
      "@type": "Dataset",
      name: valid.title,
      description: valid.curiosity,
      datePublished: valid.updatedAt,
      license: { "@id": "https://opensource.org/licenses/MIT" },
      hasPart: baseParts,
    },
    ...extraParts.map((item) => ({
      "@id": item.path,
      "@type": "File",
      name: path.basename(item.path),
      encodingFormat: item.mimeType || "application/octet-stream",
      contentSize: String(item.size ?? 0),
      ...(item.sha256 ? { sha256: item.sha256 } : {}),
    })),
  ];
  return `${JSON.stringify({ "@context": "https://w3id.org/ro/crate/1.1/context", "@graph": entities }, null, 2)}\n`;
}

function canonicalPdfDate(value) {
  const date = value ? new Date(value) : new Date(0);
  const valid = Number.isNaN(date.getTime()) ? new Date(0) : date;
  const two = (number) => String(number).padStart(2, "0");
  return `D:${valid.getUTCFullYear()}${two(valid.getUTCMonth() + 1)}${two(valid.getUTCDate())}${two(valid.getUTCHours())}${two(valid.getUTCMinutes())}${two(valid.getUTCSeconds())}+00'00'`;
}

export async function renderProjectPdf(htmlDocument, canonicalUpdatedAt) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.setContent(htmlDocument, { waitUntil: "load" });
    await page.emulateMedia({ media: "print" });
    const printed = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      tagged: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: "<div style=\"width:100%;text-align:center;font-size:8px;color:#7a7a7a\"><span class=\"pageNumber\"></span> / <span class=\"totalPages\"></span></div>",
    });
    const replacement = canonicalPdfDate(canonicalUpdatedAt);
    const normalized = printed.toString("latin1").replace(/(\/(?:CreationDate|ModDate)\s*\()D:[^)\r\n]*(\))/g, (match, prefix, suffix) => {
      const length = match.length - prefix.length - suffix.length;
      return `${prefix}${replacement.padEnd(length, " ").slice(0, length)}${suffix}`;
    });
    return Buffer.from(normalized, "latin1");
  } finally {
    await browser.close();
  }
}

// Zero-dependency deterministic PKZIP (STORE method + CRC-32)
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i += 1) {
  let c = i;
  for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[i] = c >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function buildZipArchive(entries, timestampIso) {
  const date = timestampIso ? new Date(timestampIso) : new Date(0);
  const valid = Number.isNaN(date.getTime()) ? new Date(0) : date;
  const dosTime = ((valid.getUTCHours() & 0x1f) << 11) | ((valid.getUTCMinutes() & 0x3f) << 5) | ((valid.getUTCSeconds() >> 1) & 0x1f);
  const dosDate = (((Math.max(1980, valid.getUTCFullYear()) - 1980) & 0x7f) << 9) | (((valid.getUTCMonth() + 1) & 0x0f) << 5) | (valid.getUTCDate() & 0x1f);

  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const dataBuf = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data), "utf8");
    const crc = crc32(dataBuf);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(dataBuf.length, 18);
    localHeader.writeUInt32LE(dataBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, nameBuf, dataBuf);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(dataBuf.length, 20);
    centralHeader.writeUInt32LE(dataBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + dataBuf.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDir, eocd]);
}

const digest = (value) => createHash("sha256").update(value).digest("hex");

export async function exportProject(root = process.cwd(), projectId) {
  const resolvedRoot = path.resolve(/* turbopackIgnore: true */ root);
  const project = await readProject(resolvedRoot, projectId);
  if (!project) throw new Error(`No canonical research project found at ${path.join(resolvedRoot, "workspace", "research-project.json")}`);
  const htmlDocument = renderProjectHtml(project);
  const { mainTex, referencesBib } = renderProjectLatex(project);
  const warnings = [];
  let pdf = null;
  try {
    pdf = await renderProjectPdf(htmlDocument, project.updatedAt);
  } catch (error) {
    warnings.push(`PDF export skipped (Chromium headless binary unavailable): ${error instanceof Error ? error.message : String(error)}`);
  }
  const canonicalJson = `${JSON.stringify(project, null, 2)}\n`;
  const workspaceFlat = await collectAllWorkspaceFilesFlat(resolvedRoot, project.projectId).catch(() => []);
  const workspaceEntries = await Promise.all(
    workspaceFlat.map(async (f) => ({
      path: `files/${f.relPath}`,
      mimeType: f.mimeType,
      size: f.size,
      sha256: f.sha256,
      data: await readFile(f.absPath),
    })),
  );
  const roCrateJson = buildRoCrateMetadata(project, workspaceEntries);

  const zipEntries = [
    { name: "research-report.html", data: htmlDocument },
    ...(pdf ? [{ name: "research-report.pdf", data: pdf }] : []),
    { name: "latex/main.tex", data: mainTex },
    { name: "latex/references.bib", data: referencesBib },
    { name: "research-project.json", data: canonicalJson },
    { name: "ro-crate-metadata.json", data: roCrateJson },
    ...workspaceEntries.map((entry) => ({ name: entry.path, data: entry.data })),
  ];
  const zip = buildZipArchive(zipEntries, project.updatedAt);

  const outputRoot = projectId ? projectExportsDir(resolvedRoot, projectId) : path.join(resolvedRoot, "workspace", "exports");
  const targets = [
    { format: "html", path: path.join(outputRoot, "research-report.html"), value: htmlDocument },
    ...(pdf ? [{ format: "pdf", path: path.join(outputRoot, "pdf", "research-report.pdf"), value: pdf }] : []),
    { format: "latex", path: path.join(outputRoot, "latex", "main.tex"), value: mainTex },
    { format: "latex", path: path.join(outputRoot, "latex", "references.bib"), value: referencesBib },
    { format: "zip", path: path.join(outputRoot, "research-bundle.zip"), value: zip },
  ];
  await Promise.all(targets.map((target) => mkdir(path.dirname(target.path), { recursive: true })));
  await Promise.all(targets.map((target) => writeFile(target.path, target.value)));

  // Also mirror to workspace/exports/ so legacy CLI/routes always find the active project's exports
  if (projectId) {
    const activeExportRoot = path.join(resolvedRoot, "workspace", "exports");
    await Promise.all(targets.map(async (target) => {
      const rel = path.relative(outputRoot, target.path);
      const mirrorPath = path.join(activeExportRoot, rel);
      await mkdir(path.dirname(mirrorPath), { recursive: true });
      await writeFile(mirrorPath, target.value);
    }));
  }

  return {
    revision: project.revision,
    contentRevision: project.contentRevision ?? project.revision,
    files: targets.map((target) => ({
      format: target.format,
      path: path.relative(resolvedRoot, target.path).split(path.sep).join("/"),
      sha256: digest(target.value),
    })),
    ...(warnings.length ? { warnings } : {}),
  };
}
