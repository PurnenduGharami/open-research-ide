import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { chromium } from "playwright";
import { executeResearchCommand, projectPath } from "../plugins/research-engine/engine.mjs";
import { exportProject, renderProjectHtml, renderProjectLatex } from "../src/export-renderer.mjs";

const run = promisify(execFile);

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), "research-exports-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const created = await executeResearchCommand(root, {
    op: "create", commandId: "fixture-create", curiosity: "Does the fixture <script>alert(1)</script> remain inert?",
    title: "Fixture & </script><script>globalThis.__unsafe = true</script>",
  });
  const abstract = "Humidity reduced strength by twenty percent. A secondary observation followed.";
  const populated = await executeResearchCommand(root, {
    commandId: "fixture-artifacts", baseRevision: created.revision, op: "upsert_nodes",
    payload: {
      nodes: [
        { id: "paper:fixture", type: "paper", title: "Fixture \\input{escaped} paper", data: { abstract, doi: "10.1234/fixture", authors: ["A. Researcher"], year: 2026, url: "https://example.test/paper?a=1&b=2" } },
        { id: "evidence:fixture", type: "evidence", title: "Unverified exact quote", data: { paperId: "paper:fixture", quote: "Humidity reduced strength by twenty percent.", verified: true } },
        { id: "experiment:fixture", type: "experiment", title: "Frozen fixture protocol", data: { protocol: ["Measure baseline", "Expose samples"], expectedOutcomes: "Strength falls" } },
        { id: "lab:quoted", type: "lab", title: "Quoted fixture lab", data: { price: 4200, currency: "USD", priceBasis: "written_lab_quote" } },
        { id: "lab:estimated", type: "lab", title: "Estimated fixture lab", data: { price: 900, currency: "USD", priceBasis: "model_estimate" } },
      ],
      edges: [{ id: "edge:fixture", source: "paper:fixture", target: "experiment:fixture", type: "tests", label: "Tests fixture claim" }],
    },
  });
  const blocked = await executeResearchCommand(root, {
    commandId: "fixture-blocks", baseRevision: populated.revision, op: "set_blocks",
    payload: { blocks: [{ id: "block:fixture", kind: "experiment", title: "Fixture plan", nodeIds: ["experiment:fixture"] }] },
  });
  const result = await executeResearchCommand(root, {
    commandId: "fixture-result", baseRevision: blocked.revision, op: "import_result",
    payload: { experimentId: "experiment:fixture", observations: "Observed strength fell by eighteen percent.", result: { id: "result:fixture", title: "Imported fixture result" } },
  });
  return { root, project: result };
}

test("standalone HTML is deterministic, revision-faithful, safely embedded, and honestly labelled", async (t) => {
  const { project } = await fixture(t);
  const before = JSON.stringify(project);
  const first = renderProjectHtml(project);
  const second = renderProjectHtml(project);
  assert.equal(first, second);
  assert.equal(JSON.stringify(project), before);
  assert.match(first, new RegExp(`Canonical revision ${project.revision}`));
  assert.match(first, /Unverified evidence — human confirmation required/);
  assert.match(first, /Lab-quoted price/);
  assert.match(first, /Model-estimated price — unverified/);
  assert.match(first, /Observed strength fell by eighteen percent\./);
  assert.match(first, /Strength falls/);
  assert.ok(!first.includes("</script><script>globalThis.__unsafe"));
  assert.ok(first.includes("Fixture \\input{escaped} paper"));
  const match = first.match(/<script id="canonical-project" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(match);
  assert.deepEqual(JSON.parse(match[1]), project);
  assert.ok(!match[1].includes("</script>"));
  assert.match(first, /<search>/);
  assert.match(first, /form.addEventListener\("submit"/);
  assert.ok(!first.includes("<script src="));
  assert.ok(!first.includes("<link rel=\"stylesheet\""));
});

test("LaTeX includes the same revision, citations, escaped data, and status labels", async (t) => {
  const { project } = await fixture(t);
  const first = renderProjectLatex(project);
  assert.deepEqual(first, renderProjectLatex(project));
  assert.match(first.mainTex, new RegExp(`Canonical revision ${project.revision}`));
  assert.match(first.mainTex, /Unverified evidence — human confirmation required/);
  assert.match(first.mainTex, /Lab-quoted price/);
  assert.match(first.mainTex, /Model-estimated price — unverified/);
  assert.match(first.mainTex, /\\textbackslash\{\}input\\\{escaped\\\}/);
  assert.match(first.mainTex, /\\cite\{paper_1\}/);
  assert.match(first.referencesBib, /@misc\{paper_1,/);
  assert.match(first.referencesBib, /doi = \{10\.1234\/fixture\}/);
  assert.match(first.mainTex, /Observed strength fell by eighteen percent\./);
  assert.match(first.mainTex, /Strength falls/);
});

test("standalone filtering works in Chromium without executing embedded untrusted markup", async (t) => {
  const { project } = await fixture(t);
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setContent(renderProjectHtml(project));
  assert.equal(await page.evaluate(() => globalThis.__unsafe), undefined);
  await page.selectOption("#artifact-type", "lab");
  await page.getByRole("button", { name: "Apply filters" }).click();
  assert.equal(await page.locator(".artifact:visible").count(), 2);
  assert.equal(await page.locator("#filter-status").textContent(), "2 of 6 artifacts shown");
  await page.getByRole("button", { name: "Clear filters" }).click();
  assert.equal(await page.locator(".artifact:visible").count(), 6);
  await page.getByRole("link", { name: "Knowledge graph", exact: true }).click();
  assert.equal(await page.evaluate(() => location.hash), "#graph");
});

test("CLI writes all four deterministic files with hashes and never mutates canonical JSON", async (t) => {
  const { root, project } = await fixture(t);
  const canonicalPath = projectPath(root);
  const canonicalBefore = await readFile(canonicalPath, "utf8");
  const script = path.resolve("scripts/export-project.mjs");
  const { stdout, stderr } = await run(process.execPath, [script, root], { timeout: 60_000 });
  assert.equal(stderr, "");
  assert.match(stdout, new RegExp(`revision\\t${project.revision}`));
  assert.match(stdout, /research-report\.html\tsha256:[a-f0-9]{64}/);
  assert.match(stdout, /research-report\.pdf\tsha256:[a-f0-9]{64}/);
  assert.match(stdout, /main\.tex\tsha256:[a-f0-9]{64}/);
  assert.match(stdout, /references\.bib\tsha256:[a-f0-9]{64}/);
  assert.equal(await readFile(canonicalPath, "utf8"), canonicalBefore);
  const first = await exportProject(root);
  const second = await exportProject(root);
  assert.deepEqual(first, second);
  assert.equal(first.revision, project.revision);
  const pdf = await readFile(path.join(root, "workspace", "exports", "pdf", "research-report.pdf"));
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  const pdfText = pdf.toString("latin1");
  const revisionHex = Buffer.from(`Revision ${project.revision}`, "utf16le").swap16().toString("hex").toUpperCase();
  assert.ok(pdfText.includes(revisionHex));
  assert.equal(await readFile(canonicalPath, "utf8"), canonicalBefore);
});
