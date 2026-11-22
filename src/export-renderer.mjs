import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { projectSchema, readProject } from "../plugins/research-engine/engine.mjs";

const TYPES = ["paper", "evidence", "contradiction", "gap", "hypothesis", "experiment", "result", "review", "lab"];
const TYPE_LABELS = {
  paper: ["Paper", "Papers"], evidence: ["Evidence", "Evidence"],
  contradiction: ["Contradiction", "Contradictions"], gap: ["Gap", "Gaps"],
  hypothesis: ["Hypothesis", "Hypotheses"], experiment: ["Experiment", "Experiments"],
  result: ["Result", "Results"], review: ["Review", "Reviews"], lab: ["Lab", "Lab options"],
};

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
    return value.map((item) => item === null ? "null" : String(item)).join(", ") || "None recorded";
  }
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
};

function safeHref(key, value) {
  if (typeof value !== "string") return null;
  const normalized = compactKey(key);
  const candidate = normalized === "doi" && value ? `https://doi.org/${value}` : value;
  if (!["url", "doi", "website", "homepage", "sourceurl"].includes(normalized)) return null;
  try {
    const parsed = new URL(candidate);
    return ["https:", "http:", "mailto:"].includes(parsed.protocol) ? parsed.href : null;
  } catch { return null; }
}

function findLabPricing(node) {
  const basisKeys = new Set(["pricebasis", "pricingbasis", "costbasis", "quotestatus", "pricetype", "pricingtype", "costtype"]);
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
  return "Pricing basis not recorded — unverified";
}

function nodeStatus(node) {
  if (node.type === "evidence") {
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

function dataFields(data, node) {
  const fields = Object.entries(data || {});
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

function renderNode(node, index) {
  const status = nodeStatus(node);
  return `<article class="artifact" id="artifact-${index}" data-type="${html(node.type)}" data-node-id="${html(node.id)}">
    <div class="artifact-heading"><h3>${html(node.title)}</h3><span class="type">${html(TYPE_LABELS[node.type][0])}</span></div>
    ${status ? `<p class="badge ${status.kind}">${html(status.text)}</p>` : ""}
    <p class="meta"><code>${html(node.id)}</code> · Updated <time datetime="${html(node.updatedAt)}">${html(node.updatedAt)}</time></p>
    ${node.sourceRefs.length ? `<p class="meta">Source references: ${html(node.sourceRefs.join(", "))}</p>` : ""}
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
:root{color-scheme:light;--canvas:#f5f5f4;--surface:#fff;--secondary:#f9f9f8;--selected:#f0f4f1;--ink:#1d1d1f;--muted:#636366;--tertiary:#737375;--line:#e4e4e1;--strong:#a6a6a1;--accent:#2f6550;--accent-soft:#eaf2ed;--warning:#80551b;--warning-soft:#fff4df;--blue:#476c87;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif;font-size:14px;line-height:1.55;color:var(--ink);background:var(--canvas)}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:24px}body{margin:0}::selection{background:#cfe2d6;color:var(--ink)}a{color:var(--accent);text-underline-offset:3px}a:hover{text-decoration-thickness:2px}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,pre:focus-visible{outline:3px solid var(--blue);outline-offset:3px}button,input,select{font:inherit;font-size:max(1rem,1em)}code,pre{font-family:ui-monospace,"SFMono-Regular",monospace;font-variant-numeric:tabular-nums}code{overflow-wrap:anywhere}.shell{width:min(1120px,calc(100% - 40px));margin:0 auto}.report-header{padding:48px 0 28px;border-bottom:1px solid var(--line);background:var(--surface)}.brand{font-weight:650;color:var(--accent);margin-bottom:20px}.report-header h1{font-size:clamp(30px,5vw,48px);line-height:1.12;letter-spacing:-.025em;max-width:22ch;margin:0 0 20px;text-wrap:balance}.meta{color:var(--muted);font-size:12px;line-height:1.45}.report-header .meta{font-size:14px}.revision{display:inline-block;border:1px solid #bad0c3;border-radius:999px;background:var(--accent-soft);color:#234b3b;padding:3px 10px;font-weight:600;margin-right:8px}.navigation{border-bottom:1px solid var(--line);background:var(--secondary)}.navigation ul{display:flex;gap:4px;list-style:none;padding:8px 0;margin:0;overflow-x:auto}.navigation a{display:block;padding:8px 10px;border-radius:8px;text-decoration:none;color:var(--muted);white-space:nowrap}.navigation a:hover{background:var(--selected);color:var(--ink)}main{padding:28px 0 48px}section{margin:0 0 36px}h2{font-size:24px;line-height:1.25;letter-spacing:-.015em;margin:0 0 16px;text-wrap:balance}h3{font-size:17px;line-height:1.3;margin:0;text-wrap:balance}.curiosity{max-width:75ch;font-size:18px;line-height:1.55;margin:0}.filters{padding:20px;background:var(--surface);border:1px solid var(--line);border-radius:14px}.filter-row{display:grid;grid-template-columns:minmax(180px,1fr) minmax(160px,.45fr) auto auto;gap:12px;align-items:end}.control label{display:block;font-weight:600;margin-bottom:6px}.control input,.control select{width:100%;height:44px;border:1px solid var(--strong);border-radius:8px;background:var(--surface);padding:8px 11px;color:var(--ink);accent-color:var(--accent)}button{min-height:44px;border:1px solid var(--strong);border-radius:8px;padding:8px 14px;background:var(--surface);color:var(--ink);cursor:pointer}button:hover{background:var(--selected)}.filter-status{display:block;color:var(--muted);margin-top:10px}.artifact{padding:24px 0;border-top:1px solid var(--line);overflow-wrap:anywhere}.artifact:first-of-type{border-top:0}.artifact-heading{display:flex;justify-content:space-between;align-items:start;gap:16px;margin-bottom:8px}.type{color:var(--muted);font-size:12px;white-space:nowrap}.badge{display:inline-block;padding:5px 10px;border-radius:999px;font-size:12px;font-weight:650;border:1px solid;margin:4px 0 10px}.badge.warning{color:var(--warning);background:var(--warning-soft);border-color:#d5b77d}.badge.verified{color:#234b3b;background:var(--accent-soft);border-color:#bad0c3}.fields{margin:16px 0 0}.field{display:grid;grid-template-columns:minmax(140px,220px) minmax(0,1fr);gap:20px;padding:9px 0;border-top:1px solid var(--line)}.field dt{font-weight:600;color:var(--muted)}.field dd{margin:0;min-width:0;white-space:pre-wrap}.compact .field{padding:6px 0}.field pre{white-space:pre-wrap;overflow:auto;max-height:420px;margin:0;padding:12px;background:var(--secondary);border:1px solid var(--line);border-radius:8px}.empty{color:var(--muted)}.record-list{list-style:none;padding:0;margin:0}.record-list>li{padding:16px 0;border-top:1px solid var(--line);overflow-wrap:anywhere}.record-list h3{margin-bottom:8px}.timeline time{font-family:ui-monospace,"SFMono-Regular",monospace;font-variant-numeric:tabular-nums}.report-footer{padding:22px 0 36px;border-top:1px solid var(--line);color:var(--muted);font-size:12px}[hidden]{display:none!important}
@media(max-width:700px){.shell{width:min(100% - 28px,1120px)}.report-header{padding-top:32px}.filter-row{grid-template-columns:1fr}.control input,.control select,button{min-height:48px}.field{grid-template-columns:1fr;gap:4px}.artifact{padding:20px 0}.artifact-heading{display:block}.type{display:block;margin-top:4px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
@page{size:A4;margin:18mm 16mm 20mm}
@media print{:root{background:#fff;font-size:10px}.shell{width:100%}.report-header{padding:0 0 16px;background:#fff}.report-header h1{font-size:30px}.navigation,.filters,.report-footer{display:none}main{padding:0}section{margin-bottom:24px;break-inside:auto}h2{font-size:18px}h3{font-size:13px}.artifact{padding:12px 0;break-inside:avoid-page}.field{grid-template-columns:150px minmax(0,1fr);gap:12px;padding:5px 0}.badge{padding:2px 7px}.field pre{max-height:none;white-space:pre-wrap}.record-list>li{break-inside:avoid-page}a{color:var(--ink);text-decoration:none}.curiosity{font-size:13px}}
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
    ...sections.map((type) => [`artifacts-${type}`, TYPE_LABELS[type][1]]),
    ["graph", "Knowledge graph"], ["timeline", "Timeline"],
    ...(project.sources.length ? [["sources", "Sources"]] : []),
    ...(project.runs.length ? [["runs", "Runs"]] : []),
  ];
  const nodeSections = sections.map((type) => {
    const nodes = project.nodes.map((node, index) => ({ node, index })).filter(({ node }) => node.type === type);
    return `<section id="artifacts-${type}" data-artifact-section><h2>${TYPE_LABELS[type][1]}</h2>${nodes.map(({ node, index }) => renderNode(node, index)).join("")}</section>`;
  }).join("");
  const edges = project.edges.map((edge) => `<li><h3>${html(edge.label)}</h3>${recordFields(edge)}</li>`).join("");
  const timeline = project.timeline.map((event) => `<li><h3>${html(event.message)}</h3><p class="meta timeline"><time datetime="${html(event.at)}">${html(event.at)}</time> · ${html(event.kind)}</p>${event.nodeIds.length ? `<p class="meta">Artifacts: ${html(event.nodeIds.join(", "))}</p>` : ""}</li>`).join("");
  const sources = project.sources.map((source) => `<li><h3>${html(source.provider)} · ${html(source.status)}</h3>${recordFields(source)}</li>`).join("");
  const runs = project.runs.map((run) => `<li><h3>${html(run.kind)} · ${html(run.status)}</h3>${recordFields(run)}</li>`).join("");
  const blocks = project.uiBlocks.map((block) => `<li><h3>${html(block.title)}</h3>${recordFields(block)}</li>`).join("");
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'">
<title>${html(project.title)} — Revision ${project.revision}</title><style>${CSS}</style></head>
<body><header class="report-header"><div class="shell"><div class="brand">Open Research IDE</div><h1>${html(project.title)}</h1><p class="meta"><span class="revision">Canonical revision ${project.revision}</span>${html(project.status)} · Local-only · State updated ${html(project.updatedAt)}</p></div></header>
<nav class="navigation" aria-label="Report sections"><div class="shell"><ul><li><a href="#overview">Overview</a></li>${navigation.map(([id, label]) => `<li><a href="#${id}">${html(label)}</a></li>`).join("")}</ul></div></nav>
<main class="shell"><section id="overview"><h2>Research question</h2><p class="curiosity">${html(project.curiosity)}</p><p class="meta">Project ${html(project.projectId)} · Created ${html(project.createdAt)} · Schema ${project.schemaVersion}</p></section>
<search><form id="artifact-filters" class="filters" action="#artifacts" method="get"><div class="filter-row"><div class="control"><label for="artifact-query">Search research artifacts</label><input id="artifact-query" name="query" type="search" autocorrect="off" autocapitalize="none" spellcheck="false"></div><div class="control"><label for="artifact-type">Artifact type</label><select id="artifact-type" name="type"><option value="all">All types</option>${sections.map((type) => `<option value="${type}">${html(TYPE_LABELS[type][1])}</option>`).join("")}</select></div><button type="submit">Apply filters</button><button id="clear-filters" type="button">Clear filters</button></div><output id="filter-status" class="filter-status" for="artifact-query artifact-type">${project.nodes.length} of ${project.nodes.length} artifacts shown</output></form></search>
<div id="artifacts">${nodeSections || "<section><h2>Research artifacts</h2><p class=\"empty\">No research artifacts are recorded at this revision.</p></section>"}</div>
<section id="graph"><h2>Knowledge graph</h2>${edges ? `<ol class="record-list">${edges}</ol>` : "<p class=\"empty\">No semantic edges are recorded at this revision.</p>"}</section>
<section id="timeline"><h2>Research timeline</h2>${timeline ? `<ol class="record-list">${timeline}</ol>` : "<p class=\"empty\">No timeline events are recorded.</p>"}</section>
${optionalSection("sources", "Source provenance", project.sources, () => `<ol class="record-list">${sources}</ol>`)}
${optionalSection("runs", "Runs and measured usage", project.runs, () => `<ol class="record-list">${runs}</ol>`)}
${optionalSection("document-structure", "Document structure", project.uiBlocks, () => `<ol class="record-list">${blocks}</ol>`)}
${project.assets.length ? `<section id="assets"><h2>Assets</h2><ol class="record-list">${project.assets.map((asset) => `<li><h3>${html(asset.label)}</h3>${recordFields(asset)}</li>`).join("")}</ol></section>` : ""}
</main><footer class="report-footer"><div class="shell">Rendered only from canonical project JSON at revision ${project.revision}. Evidence remains unverified unless explicitly labelled human-confirmed. Pricing is identified by its recorded basis.</div></footer>
<script id="canonical-project" type="application/json">${embeddedJson(project)}</script><script>${INTERACTION}</script></body></html>`;
}

function latex(value) {
  return String(value).replace(/[\\{}$&#_%^~]/g, (character) => ({
    "\\": "\\textbackslash{}", "{": "\\{", "}": "\\}", "$": "\\$", "&": "\\&",
    "#": "\\#", "_": "\\_", "%": "\\%", "^": "\\textasciicircum{}", "~": "\\textasciitilde{}",
  }[character])).replace(/\r?\n/g, " ");
}

function latexFields(data, node) {
  const entries = Object.entries(data || {});
  if (!entries.length) return "\\emph{No additional fields recorded.}\n";
  const pricing = node?.type === "lab" ? findLabPricing(node) : null;
  return `\\begin{description}\n${entries.map(([key, value]) => {
    const normalized = compactKey(key);
    const isPrice = pricing && (normalized.includes("price") || normalized.includes("cost")) && !normalized.includes("basis");
    return `  \\item[${latex(humanKey(key))}${isPrice ? ` (${latex(pricing)})` : ""}] ${latex(displayValue(value))}`;
  }).join("\n")}\n\\end{description}\n`;
}

function latexRecords(title, records) {
  if (!records.length) return "";
  return `\\section{${latex(title)}}\n${records.map((record) => {
    const heading = record.label || record.message || record.title || record.provider || record.kind || record.id;
    return `\\subsection*{${latex(heading)}}\n${latexFields(record)}`;
  }).join("\n")}`;
}

export function renderProjectLatex(input) {
  const project = projectSchema.parse(input);
  const papers = project.nodes.filter((node) => node.type === "paper");
  const citationKeys = new Map(papers.map((node, index) => [node.id, `paper_${index + 1}`]));
  const nodeSections = TYPES.map((type) => {
    const nodes = project.nodes.filter((node) => node.type === type);
    if (!nodes.length) return "";
    return `\\section{${TYPE_LABELS[type][1]}}\n${nodes.map((node) => {
      const status = nodeStatus(node);
      const citation = citationKeys.has(node.id) ? `~\\cite{${citationKeys.get(node.id)}}` : "";
      return `\\subsection*{${latex(node.title)}${citation}}\n\\textbf{${latex(TYPE_LABELS[type][0])}} \\texttt{${latex(node.id)}}\\par\n${status ? `\\textbf{${latex(status.text)}}\\par\n` : ""}\\textbf{Updated:} ${latex(node.updatedAt)}\\par\n${latexFields(node.data, node)}`;
    }).join("\n")}`;
  }).filter(Boolean).join("\n");
  const references = papers.length ? papers.map((node, index) => {
    const data = node.data || {};
    const fields = [];
    const add = (key, value) => { if (value !== undefined && value !== null && value !== "" && displayValue(value) !== "") fields.push(`  ${key} = {${latex(displayValue(value))}}`); };
    add("title", node.title);
    if (Array.isArray(data.authors) && data.authors.length) add("author", data.authors.map((author) => typeof author === "object" ? author.name || "" : author).filter(Boolean).join(" and "));
    add("year", data.year);
    add("doi", data.doi);
    add("url", data.url);
    add("note", data.providers || data.provider ? `Source: ${displayValue(data.providers || data.provider)}` : "");
    return `@misc{${citationKeys.get(node.id)},\n${fields.join(",\n")}\n}`;
  }).join("\n\n") + "\n" : "% No paper records are present in this canonical revision.\n";
  const mainTex = `\\documentclass[11pt]{article}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage[a4paper,margin=22mm]{geometry}
\\usepackage[hidelinks]{hyperref}
\\usepackage{enumitem}
\\setlist{description}{style=nextline,leftmargin=0pt}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{6pt}
\\title{${latex(project.title)}\\\\ Canonical revision ${project.revision}}
\\author{Open Research IDE --- local-only research record}
\\date{Canonical state updated ${latex(project.updatedAt)}}
\\begin{document}
\\maketitle
\\section{Research question}
${latex(project.curiosity)}\\par
\\textbf{Project:} \\texttt{${latex(project.projectId)}}\\par
\\textbf{Status:} ${latex(project.status)}\\par
\\textbf{Evidence policy:} Evidence is unverified unless explicitly labelled human-confirmed. Pricing is identified by its recorded basis.
${nodeSections || "\\section{Research artifacts}\n\\emph{No research artifacts are recorded at this revision.}\n"}
\\section{Knowledge graph}
${project.edges.length ? `\\begin{itemize}\n${project.edges.map((edge) => `  \\item \\textbf{${latex(edge.label)}}: \\texttt{${latex(edge.source)}} $\\rightarrow$ \\texttt{${latex(edge.target)}} (${latex(edge.type)})`).join("\n")}\n\\end{itemize}` : "\\emph{No semantic edges are recorded at this revision.}"}
${latexRecords("Research timeline", project.timeline)}
${latexRecords("Source provenance", project.sources)}
${latexRecords("Runs and measured usage", project.runs)}
${latexRecords("Document structure", project.uiBlocks)}
${latexRecords("Assets", project.assets)}
\\nocite{*}
\\bibliographystyle{plain}
\\bibliography{references}
\\end{document}
`;
  return { mainTex, referencesBib: references };
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
      format: "A4", printBackground: true, preferCSSPageSize: true, tagged: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: "<div style=\"width:100%;text-align:center;font-size:8px;color:#636366\"><span class=\"pageNumber\"></span> / <span class=\"totalPages\"></span></div>",
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

const digest = (value) => createHash("sha256").update(value).digest("hex");

export async function exportProject(root = process.cwd()) {
  const resolvedRoot = path.resolve(/* turbopackIgnore: true */ root);
  const project = await readProject(resolvedRoot);
  if (!project) throw new Error(`No canonical research project found at ${path.join(resolvedRoot, "workspace", "research-project.json")}`);
  const htmlDocument = renderProjectHtml(project);
  const { mainTex, referencesBib } = renderProjectLatex(project);
  const pdf = await renderProjectPdf(htmlDocument, project.updatedAt);
  const outputRoot = path.join(resolvedRoot, "workspace", "exports");
  const targets = [
    { format: "html", path: path.join(outputRoot, "research-report.html"), value: htmlDocument },
    { format: "pdf", path: path.join(outputRoot, "pdf", "research-report.pdf"), value: pdf },
    { format: "latex", path: path.join(outputRoot, "latex", "main.tex"), value: mainTex },
    { format: "latex", path: path.join(outputRoot, "latex", "references.bib"), value: referencesBib },
  ];
  await Promise.all(targets.map((target) => mkdir(path.dirname(target.path), { recursive: true })));
  await Promise.all(targets.map((target) => writeFile(target.path, target.value)));
  return {
    revision: project.revision,
    files: targets.map((target) => ({
      format: target.format,
      path: path.relative(resolvedRoot, target.path).split(path.sep).join("/"),
      sha256: digest(target.value),
    })),
  };
}
