import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { deleteProject, executeResearchCommand } from "../plugins/research-engine/engine.mjs";

const base = process.env.QA_BASE_URL || "http://127.0.0.1:3000";
const root = process.cwd();
const outDir = path.join(root, "workspace", "smoke");
const errors = [];
const checks = [];

async function seedFixtureProject() {
  let project = await executeResearchCommand(root, {
    op: "create",
    commandId: `qa-seed-${Date.now()}`,
    curiosity: "Does adaptive quantization reduce LLM inference memory without degrading reasoning accuracy?",
    title: "Adaptive Quantization & Reasoning Accuracy",
    mode: "guided",
  });
  const abstract1 =
    "Adaptive mixed-precision quantization preserves 99.1% of GSM8K reasoning accuracy while cutting KV-cache memory by 42% across 7B and 14B models.";
  const abstract2 =
    "Uniform 4-bit KV quantization degrades multi-step math accuracy by 9.4% on long proofs when attention-sink channels are quantized identically to tail tokens.";
  const quote1 = "Adaptive mixed-precision quantization preserves 99.1% of GSM8K reasoning accuracy";
  const quote2 = "Uniform 4-bit KV quantization degrades multi-step math accuracy by 9.4% on long proofs";

  project = await executeResearchCommand(root, {
    projectId: project.projectId,
    commandId: `qa-nodes-${Date.now()}`,
    baseRevision: project.revision,
    op: "upsert_nodes",
    payload: {
      nodes: [
        { id: "paper:qa1", type: "paper", title: "Mixed-Precision KV-Cache Quantization for Reasoning Models", sourceRefs: ["OpenAlex"], data: { abstract: abstract1, doi: "10.1000/qa-quant", authors: ["A. Lin", "R. Gupta"], year: 2026, venue: "ICML", url: "https://doi.org/10.1000/qa-quant" } },
        { id: "paper:qa2", type: "paper", title: "Long-Horizon Proof Degradation Under Uniform 4-Bit KV Compression", sourceRefs: ["OpenAlex"], data: { abstract: abstract2, doi: "10.1000/qa-uniform", authors: ["S. Patel"], year: 2026, venue: "NeurIPS", url: "https://doi.org/10.1000/qa-uniform" } },
        { id: "ev:qa1", type: "evidence", title: "KV-cache memory reduction claim", sourceRefs: ["paper:qa1"], data: { paperId: "paper:qa1", quote: quote1 } },
        { id: "ev:qa2", type: "evidence", title: "Uniform 4-bit degradation claim", sourceRefs: ["paper:qa2"], data: { paperId: "paper:qa2", quote: quote2 } },
        {
          id: "contradiction:qa1",
          type: "contradiction",
          title: "4-bit KV quantization: preserved accuracy vs. 9.4% drop",
          sourceRefs: ["ev:qa1", "ev:qa2"],
          data: {
            description: "Mixed-precision adaptive quantization keeps 99.1% on GSM8K, whereas uniform 4-bit drops 9.4% on long proofs.",
            resolution: "unresolved",
            sides: [
              { label: "Study A (Adaptive)", paperId: "paper:qa1", evidenceId: "ev:qa1", quote: quote1, definitionNote: "Attention sinks retained at higher precision; measured on GSM8K." },
              { label: "Study B (Uniform)", paperId: "paper:qa2", evidenceId: "ev:qa2", quote: quote2, definitionNote: "Uniform 4-bit across all channels; measured on long proofs." },
            ],
          },
        },
        { id: "gap:qa1", type: "gap", title: "Long-horizon multi-step proof tasks remain untested", sourceRefs: ["paper:qa1"], data: { description: "Prior evaluations stop at short-chain arithmetic benchmarks." } },
        { id: "hyp:qa1", type: "hypothesis", title: "4-bit adaptive quantization preserves multi-step math accuracy above 97%", sourceRefs: ["ev:qa1", "gap:qa1"], data: { statement: "Keeping attention sinks at 8-bit while quantizing remaining keys to 4-bit preserves >97% accuracy on multi-step benchmarks." } },
        { id: "rev:auditor", type: "review", title: "Evidence Auditor", sourceRefs: ["hyp:qa1"], data: { reviewer: "auditor", hypothesisId: "hyp:qa1", verdict: "Quote verified against abstract. Confidence: high.", findings: [{ severity: "low", claim: "Single benchmark cited", rationale: "Expand beyond GSM8K." }] } },
        { id: "rev:critic", type: "review", title: "Methodology Critic", sourceRefs: ["hyp:qa1"], data: { reviewer: "critic", hypothesisId: "hyp:qa1", verdict: "Add full-precision baseline control. Confidence: medium.", findings: [{ severity: "medium", claim: "Needs FP16 control", rationale: "Compare latency and accuracy on identical seeds." }] } },
        { id: "rev:feasibility", type: "review", title: "Feasibility Reviewer", sourceRefs: ["hyp:qa1"], data: { reviewer: "feasibility", hypothesisId: "hyp:qa1", verdict: "Directly testable via Python benchmark. Confidence: high.", findings: [{ severity: "low", claim: "Runnable on single GPU/Colab", rationale: "Low compute barrier." }] } },
        { id: "exp:qa1", type: "experiment", title: "4-bit Adaptive vs FP16 Benchmark", sourceRefs: ["hyp:qa1"], data: { modality: "computational", objective: "Measure memory and accuracy across 50 reasoning prompts.", protocol: ["Run FP16 baseline", "Run adaptive 4-bit quantization", "Compare accuracy and peak VRAM"], expectedOutcomes: [{ metric: "Accuracy retention", prediction: ">= 97% of FP16 baseline" }, { metric: "KV-cache memory", prediction: ">= 35% reduction" }], codeExperiment: { language: "javascript", filename: "bench.mjs", dependencies: [], code: "console.log('Accuracy retention: 98.4%\\nKV-cache reduction: 41.2%');", runCommand: "node bench.mjs", colabReady: true } } },
        { id: "lab:qa1", type: "lab", title: "Systems Efficiency Group", sourceRefs: ["OpenAlex"], data: { name: "Systems Efficiency Group", institution: "Open Benchmark Consortium", contacted: false, price: { kind: "unavailable", note: "No service fee; open-source benchmark" } } },
      ],
      edges: [
        { id: "e1", source: "ev:qa1", target: "paper:qa1", type: "supports", label: "Exact abstract quote" },
        { id: "e1b", source: "ev:qa2", target: "paper:qa2", type: "supports", label: "Exact abstract quote" },
        { id: "ec1", source: "contradiction:qa1", target: "ev:qa1", type: "contradicts", label: "Adaptive 99.1%" },
        { id: "ec2", source: "contradiction:qa1", target: "ev:qa2", type: "contradicts", label: "Uniform -9.4%" },
        { id: "e2", source: "hyp:qa1", target: "gap:qa1", type: "addresses", label: "Addresses gap" },
        { id: "e3", source: "exp:qa1", target: "hyp:qa1", type: "tests", label: "Tests hypothesis" },
      ],
    },
  });
  project = await executeResearchCommand(root, {
    projectId: project.projectId,
    commandId: `qa-blocks-${Date.now()}`,
    baseRevision: project.revision,
    op: "set_blocks",
    payload: {
      blocks: [
        { id: "b-lit", kind: "literature", title: "Literature: adaptive quantization", nodeIds: ["paper:qa1", "paper:qa2"] },
        { id: "b-an", kind: "analysis", title: "Grounded evidence & hypothesis", nodeIds: ["ev:qa1", "ev:qa2", "contradiction:qa1", "gap:qa1", "hyp:qa1"] },
        { id: "b-rev", kind: "review", title: "Independent Review Panel", nodeIds: ["rev:auditor", "rev:critic", "rev:feasibility"] },
        { id: "b-exp", kind: "experiment", title: "Validation plan", nodeIds: ["exp:qa1", "lab:qa1"] },
      ],
    },
  });
  project = await executeResearchCommand(root, {
    projectId: project.projectId,
    commandId: `qa-ready-${Date.now()}`,
    baseRevision: project.revision,
    op: "set_status",
    payload: { status: "ready", message: "Seeded fixture ready" },
  });
  return project;
}

async function assertNoOverflow(page, label) {
  const dims = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert.ok(dims.scrollWidth <= dims.innerWidth + 1, `${label} horizontal overflow: ${JSON.stringify(dims)}`);
  checks.push(`${label}: no horizontal overflow`);
}

await mkdir(outDir, { recursive: true });
const seeded = await seedFixtureProject();
const browser = await chromium.launch({ headless: true });

try {
  for (const vp of [
    { name: "desktop-1440", width: 1440, height: 1000 },
    { name: "mobile-390", width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("pageerror", (err) => errors.push(`${vp.name} pageerror: ${err.message}`));
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(`${vp.name} console: ${msg.text()}`); });

    await page.goto(base, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.getByRole("heading", { name: /Adaptive Quantization/i }).first().waitFor({ timeout: 15000 });
    await assertNoOverflow(page, `${vp.name} research`);

    // Confirm evidence + verify side-by-side contradiction display on desktop pass
    if (vp.name === "desktop-1440") {
      await page.getByRole("button", { name: "Confirm evidence" }).first().click();
      await page.getByText("Confirmed").first().waitFor({ timeout: 10000 });
      await page.getByText("Study A (Adaptive)").first().waitFor({ timeout: 10000 });
      await page.getByText("Study B (Uniform)").first().waitFor({ timeout: 10000 });
      await page.screenshot({ path: path.join(outDir, "qa-light-research.png"), fullPage: false });
      await page.getByRole("button", { name: "Toggle color theme" }).click();
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(outDir, "qa-dark-research.png"), fullPage: false });
      await page.getByRole("button", { name: "Toggle color theme" }).click();
      checks.push("evidence confirmation, dual-theme toggle, and side-by-side contradiction cards rendered");
    } else {
      await page.screenshot({ path: path.join(outDir, "qa-mobile-research.png"), fullPage: false });
    }

    // Knowledge Graph view + 1-click contradiction map jump
    await page.getByRole("button", { name: /Knowledge Graph/ }).click();
    await page.locator(".react-flow").waitFor({ timeout: 15000 });
    if (vp.name === "desktop-1440") {
      await page.locator(".kfg-node--contradiction").first().click();
      await page.getByText("Compare Both Passages").waitFor({ timeout: 10000 });
      await page.getByRole("button", { name: "Different Definitions" }).first().click();
      await page.getByRole("button", { name: /Jump to passage/i }).first().click();
      await page.locator("mark.ori-abstract-mark").first().waitFor({ timeout: 10000 });
      checks.push("map contradiction click -> side-by-side compare -> triage -> jump to highlighted passage");
    }
    await assertNoOverflow(page, `${vp.name} graph`);

    // Validation & Testing Workspace
    await page.getByRole("button", { name: /Validation/ }).click();
    await page.getByRole("heading", { name: /Universal Validation/i }).waitFor({ timeout: 10000 });
    if (vp.name === "desktop-1440") {
      await page.getByRole("button", { name: /Run Locally/i }).click();
      await page.locator(".ori-terminal-out").filter({ hasText: "Accuracy retention: 98.4%" }).waitFor({ timeout: 15000 });
      await page.screenshot({ path: path.join(outDir, "redesign-desktop-validation.png"), fullPage: false });
      checks.push("local computational code runner executed and captured stdout");
      // CodeMirror 6 + Sample Size Power calculator check
      await page.locator(".cm-editor").first().waitFor({ timeout: 10000 });
      await page.getByRole("button", { name: "Compute N" }).click();
      await page.getByText(/Required sample size:/i).waitFor({ timeout: 10000 });
      checks.push("CodeMirror 6 editor and Statistical Power calculator verified");
    }
    await assertNoOverflow(page, `${vp.name} validation`);

    // Files & Notes Workbench (create/preview KaTeX note)
    await page.getByRole("button", { name: /Files & Notes/ }).click();
    await page.getByRole("heading", { name: /Files, Lab Notebooks & KaTeX Studio/i }).waitFor({ timeout: 10000 });
    if (vp.name === "desktop-1440") {
      await page.getByPlaceholder(/New note/i).fill("e2e-katex-check.md");
      await page.getByRole("button", { name: "Create Note" }).click();
      await page.locator(".ori-md-preview .katex").first().waitFor({ timeout: 10000 });
      await page.screenshot({ path: path.join(outDir, "qa-light-files.png"), fullPage: false });
      checks.push("Files & Notes workbench created note and rendered KaTeX equation");
    }
    await assertNoOverflow(page, `${vp.name} files`);

    // Literature Library & Citation.js BibTeX import
    await page.getByRole("button", { name: /Literature/ }).click();
    await page.getByRole("heading", { name: /Peer-Reviewed Literature/i }).waitFor({ timeout: 10000 });
    if (vp.name === "desktop-1440") {
      await page.getByRole("button", { name: /Import \.bib/i }).click();
      await page.getByPlaceholder(/@article/i).fill("@article{knox2026test, author={Knox, E.}, title={Test Reference Title}, journal={J. Tests}, year={2026}}");
      await page.getByRole("button", { name: "Import Parsed Records" }).click();
      await page.getByText("Test Reference Title").first().waitFor({ timeout: 10000 });
      await page.getByRole("button", { name: /Format Bibliography/i }).click();
      await page.getByText(/CSL Bibliography/i).waitFor({ timeout: 10000 });
      await page.screenshot({ path: path.join(outDir, "qa-light-literature.png"), fullPage: false });
      checks.push("Literature library parsed BibTeX and formatted CSL bibliography");
    }
    await assertNoOverflow(page, `${vp.name} literature`);

    // Command Palette (Ctrl+K) + Problems diagnostics check
    if (vp.name === "desktop-1440") {
      await page.keyboard.press("Control+k");
      await page.getByPlaceholder(/Jump to files, nodes, or IDE commands/i).waitFor({ timeout: 10000 });
      await page.keyboard.press("Escape");
      checks.push("Command Palette opened via Ctrl+K and closed via Escape");
    }

    // Manuscript Studio
    await page.getByRole("button", { name: /Manuscript/ }).click();
    await page.getByRole("heading", { name: /Manuscript & Human-Quality Prose Studio/i }).waitFor({ timeout: 10000 });
    if (vp.name === "desktop-1440") {
      await page.getByRole("button", { name: /Draft Manuscript/i }).click();
      await page.getByText(/Prose Quality Score/i).waitFor({ timeout: 15000 });
      checks.push("manuscript drafted and prose-audited");
    }
    await assertNoOverflow(page, `${vp.name} manuscript`);

    // Published & Export Studio (verify fresh export + ZIP download)
    await page.getByRole("button", { name: /Published/ }).click();
    await page.getByRole("heading", { name: /Publication & Export Studio/i }).waitFor({ timeout: 10000 });
    if (vp.name === "desktop-1440") {
      await page.getByRole("button", { name: /Export revision/i }).click();
      await page.getByText(/Exports are up to date/i).waitFor({ timeout: 60000 });
      await page.getByRole("link", { name: /Download Complete Archive/i }).waitFor({ timeout: 10000 });
      await page.screenshot({ path: path.join(outDir, "redesign-desktop-published.png"), fullPage: false });
      checks.push("exports generated, fresh (non-stale), and ZIP link available");
    }
    await assertNoOverflow(page, `${vp.name} published`);

    // Landing Home (+ New Research) + Sample Walkthrough, Blank Workspace & Bundle Import checks
    await page.getByRole("button", { name: "New research" }).click();
    await page.getByRole("heading", { name: /What are you curious about/i }).waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: /Explore Sample Investigation/i }).waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: /New Blank Workspace/i }).waitFor({ timeout: 10000 });
    await page.getByText(/Import Research Bundle/i).waitFor({ timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, vp.name === "desktop-1440" ? "qa-light-landing.png" : `redesign-${vp.name}-landing.png`), fullPage: true });
    await assertNoOverflow(page, `${vp.name} landing`);

    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, checks, errors }, null, 2));
} finally {
  await browser.close();
  await deleteProject(root, seeded.projectId).catch(() => { });
}
