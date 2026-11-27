import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import { executeResearchCommand, readProject } from "../plugins/research-engine/engine.mjs";
import { snowballCitations } from "../plugins/research-engine/literature.mjs";
import { importProjectBundle } from "../src/bundle-io.mjs";
import { formatCitations, parseReferencesText } from "../src/citations.mjs";
import { auditManuscriptClaims, computeProjectDiagnostics } from "../src/diagnostics.ts";
import { buildRoCrateMetadata, buildZipArchive, exportProject, renderProjectLatex } from "../src/export-renderer.mjs";
import { extractPdfTextFromBuffer } from "../src/pdf-engine.mjs";
import { seedSampleInvestigation } from "../src/sample-project.mjs";
import {
  calculateSampleSizePower,
  generatePublicationSvgChart,
  parseCsvTable,
  runCorrelationAnalysis,
  runWelchTTest,
} from "../src/stats-engine.mjs";
import {
  computeWikilinksAndBacklinks,
  deleteWorkspaceEntry,
  ensureWorkspaceScaffold,
  listWorkspaceFiles,
  readWorkspaceFile,
  resolveWorkspacePath,
  searchWorkspace,
  writeWorkspaceFile,
} from "../src/workspace-files.mjs";

test("workspace files scaffold, CRUD, path traversal rejection, wikilinks, and grep work end-to-end", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "ori-files-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const project = await executeResearchCommand(root, {
    op: "create",
    commandId: "files-create",
    curiosity: "Does cooling improve cycle life?",
    title: "Thermal Cycle Study",
  });
  await ensureWorkspaceScaffold(root, project.projectId, project);
  const tree = await listWorkspaceFiles(root, project.projectId);
  assert.ok(tree.some((e) => e.kind === "folder" && e.name === "notes"));
  assert.ok(tree.some((e) => e.kind === "folder" && e.name === "data"));

  assert.throws(() => resolveWorkspacePath(root, project.projectId, "../secrets.txt"), /Unsafe workspace path/);
  assert.throws(() => resolveWorkspacePath(root, project.projectId, "/etc/passwd"), /Invalid workspace relative path/);

  await writeWorkspaceFile(root, project.projectId, "notes/observations.md", "See [[notes/lab-notebook.md]] and [@smith2025test]. Arrhenius fit holds.");
  const loaded = await readWorkspaceFile(root, project.projectId, "notes/observations.md");
  assert.match(loaded.text, /Arrhenius fit holds/);

  const links = await computeWikilinksAndBacklinks(root, project.projectId, project);
  assert.ok(links.backlinks["notes/lab-notebook.md"]?.some((b) => b.from === "notes/observations.md"));

  const search = await searchWorkspace(root, project.projectId, project, "Arrhenius");
  assert.ok(search.fileMatches.some((m) => m.path === "notes/observations.md"));

  await deleteWorkspaceEntry(root, project.projectId, "notes/observations.md");
  await assert.rejects(() => readWorkspaceFile(root, project.projectId, "notes/observations.md"));
});

test("citation-js parses BibTeX/RIS records and formats APA, IEEE, Vancouver, and BibTeX", () => {
  const bib = `
@article{smith2025sodium,
  author = {Smith, Alice and Kumar, Raj},
  title = {Low Temperature Desolvation in Sodium Ion Electrolytes},
  journal = {Journal of Power Sources},
  year = {2025},
  doi = {10.1016/j.jpowsour.2025.001}
}
`;
  const nodes = parseReferencesText(bib, "BibTeX Test");
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].type, "paper");
  assert.equal(nodes[0].data.doi, "10.1016/j.jpowsour.2025.001");

  const ris = `TY  - JOUR\nAU  - Doe, Jane\nTI  - Thermal Stability of Hard Carbon\nJO  - Electrochimica Acta\nPY  - 2024\nDO  - 10.1016/j.electacta.2024.100\nER  - `;
  const risNodes = parseReferencesText(ris, "RIS Test");
  assert.equal(risNodes.length, 1);
  assert.match(risNodes[0].title, /Thermal Stability/);

  const ieee = formatCitations(nodes, "ieee");
  assert.match(ieee, /\[1\].*Smith.*Low Temperature Desolvation/);
  const apa = formatCitations(nodes, "apa");
  assert.match(apa, /Smith/);
  const outBib = formatCitations(nodes, "bibtex");
  assert.match(outBib, /@article/);
});

test("unpdf extracts full-text PDF pages and engine enforces fullText SHA-256 substring anchoring", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "ori-pdf-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setContent("<html><body><h1>Cryogenic Sodium Cell Full Text</h1><p>Measured impedance dropped by 41 percent under fluorinated diglyme at -20 C.</p></body></html>");
  const pdfBuf = await page.pdf({ format: "A4" });

  const extracted = await extractPdfTextFromBuffer(pdfBuf);
  assert.equal(extracted.pageCount, 1);
  assert.match(extracted.fullText, /Measured impedance dropped by 41 percent/);
  assert.equal(extracted.fullTextSha256.length, 64);

  let project = await executeResearchCommand(root, { op: "create", commandId: "pdf-c", curiosity: "Test PDF fullText anchoring" });
  project = await executeResearchCommand(root, {
    projectId: project.projectId,
    commandId: "pdf-p",
    baseRevision: project.revision,
    op: "upsert_nodes",
    payload: { nodes: [{ id: "paper:pdf1", type: "paper", title: "Cryogenic Paper", data: { abstract: "Short abstract." } }] },
  });
  project = await executeResearchCommand(root, {
    projectId: project.projectId,
    commandId: "pdf-attach",
    baseRevision: project.revision,
    op: "attach_paper_fulltext",
    payload: {
      paperId: "paper:pdf1",
      fullText: extracted.fullText,
      pages: extracted.pages,
      pageCount: extracted.pageCount,
      fullTextSha256: extracted.fullTextSha256,
    },
  });

  const evValid = await executeResearchCommand(root, {
    projectId: project.projectId,
    commandId: "pdf-ev-ok",
    baseRevision: project.revision,
    op: "upsert_nodes",
    payload: {
      nodes: [{
        id: "ev:full1",
        type: "evidence",
        title: "Full text impedance quote",
        data: { paperId: "paper:pdf1", quote: "Measured impedance dropped by 41 percent", sourceField: "fullText", page: 1 },
      }],
    },
  });
  assert.equal(evValid.nodes.find((n) => n.id === "ev:full1").data.sourceField, "fullText");

  await assert.rejects(() => executeResearchCommand(root, {
    projectId: project.projectId,
    commandId: "pdf-ev-bad",
    baseRevision: evValid.revision,
    op: "upsert_nodes",
    payload: {
      nodes: [{
        id: "ev:fullbad",
        type: "evidence",
        title: "Hallucinated full text quote",
        data: { paperId: "paper:pdf1", quote: "fabricated sentence absent from pdf", sourceField: "fullText" },
      }],
    },
  }), /exact substring of its paper full text/);
});

test("snowballCitations expands OpenAlex backward references and forward citations while flagging retractions", async () => {
  const mockFetch = async (url) => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => JSON.stringify({
      results: [
        {
          id: url.includes("cites:") ? "https://openalex.org/W202" : "https://openalex.org/W201",
          title: url.includes("cites:") ? "Retracted Citing Study" : "Referenced Foundational Study",
          publication_year: 2026,
          is_retracted: url.includes("cites:"),
          cited_by_count: 14,
          authorships: [{ author: { display_name: "M. Lee" } }],
          abstract_inverted_index: { Connected: [0], "work.": [1] },
        },
      ],
    }),
  });
  const seedPaper = {
    id: "openalex:W100",
    type: "paper",
    title: "Anchor Paper",
    data: {
      providerIds: { OpenAlex: "W100" },
      referencedWorkIds: ["W199"],
      citedByApiUrl: "https://api.openalex.org/works?filter=cites:W100",
    },
  };
  const out = await snowballCitations(seedPaper, { direction: "both", limit: 4, fetch: mockFetch });
  assert.equal(out.nodes.length, 2);
  assert.equal(out.edges.length, 2);
  assert.equal(out.nodes.some((n) => n.id === "openalex:W202" && n.data.isRetracted === true), true);
});

test("stats-engine computes CSV tables, Welch t-test, Pearson r, sample size power, and valid SVG figures", () => {
  const parsed = parseCsvTable("temp,ctrl,treat\n1,10,20\n2,11,22\n3,9,19\n4,10.5,21.5\n");
  assert.equal(parsed.rowCount, 4);
  assert.equal(parsed.summaries.length, 3);

  const tRes = runWelchTTest(parsed.numericColumns.ctrl, parsed.numericColumns.treat);
  assert.ok(tRes.pValue < 0.001);
  assert.ok(tRes.cohensD < -5);

  const sameT = runWelchTTest([10, 11, 12, 11], [10, 11, 12, 11]);
  assert.equal(sameT.pValue, 1);

  const corr = runCorrelationAnalysis([1, 2, 3, 4], [2, 4, 6, 8]);
  assert.ok(Math.abs(corr.r - 1) < 1e-6);

  const pwr = calculateSampleSizePower({ effectSizeD: 0.8, alpha: 0.05, power: 0.8 });
  assert.ok(pwr.perGroupN >= 24 && pwr.perGroupN <= 27);

  const svg = generatePublicationSvgChart({
    kind: "bar",
    title: "Control vs <Treatment>",
    labels: ["Ctrl", "Treat"],
    values: [10.1, 20.6],
    errors: [0.8, 1.3],
  });
  assert.ok(svg.startsWith("<svg"));
  assert.ok(svg.includes("Control vs &lt;Treatment&gt;"));
});

test("diagnostics catch retracted papers, unconfirmed quotes, contradictions, and unbacked numeric claims", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "ori-diag-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sample = await seedSampleInvestigation(root);
  sample.nodes[0].data.isRetracted = true;
  const items = computeProjectDiagnostics(sample);
  assert.ok(items.some((d) => d.code === "RETRACTED_PAPER"));
  assert.ok(items.some((d) => d.code === "UNCONFIRMED_EVIDENCE"));
  assert.ok(items.some((d) => d.code === "UNRESOLVED_CONTRADICTION"));

  const claimCheck = auditManuscriptClaims({
    title: "Test",
    abstract: "Abstract",
    sections: [{ id: "results", heading: "Results", content: "Fluorinated solvent improved retention by 42% across trials.", updatedAt: sample.updatedAt }],
    sourceRevision: 1,
    updatedAt: sample.updatedAt,
  }, sample);
  assert.equal(claimCheck.unbackedClaims.length, 1);
});

test("RO-Crate 1.1 JSON-LD, venue LaTeX templates, and full round-trip ZIP import/verify work deterministically", async (t) => {
  const rootA = await mkdtemp(path.join(tmpdir(), "ori-crate-a-"));
  const rootB = await mkdtemp(path.join(tmpdir(), "ori-crate-b-"));
  t.after(async () => {
    await rm(rootA, { recursive: true, force: true });
    await rm(rootB, { recursive: true, force: true });
  });

  const sample = await seedSampleInvestigation(rootA);
  const ieee = renderProjectLatex(sample, { template: "ieee" });
  assert.match(ieee.mainTex, /\\documentclass\[conference\]\{IEEEtran\}/);

  const crate = JSON.parse(buildRoCrateMetadata(sample, [{ path: "files/notes/lab-notebook.md", mimeType: "text/markdown", size: 120, sha256: "a".repeat(64) }]));
  assert.equal(crate["@context"], "https://w3id.org/ro/crate/1.1/context");
  assert.ok(crate["@graph"].some((e) => e["@id"] === "./" && e["@type"] === "Dataset"));

  await exportProject(rootA, sample.projectId);
  const loadedZip = await import("node:fs/promises").then((fs) =>
    fs.readFile(path.join(rootA, "workspace", "projects", sample.projectId, "exports", "research-bundle.zip")),
  );

  const restored = await importProjectBundle(rootB, loadedZip);
  assert.equal(restored.hasRoCrate, true);
  assert.ok(restored.filesRestored >= 4);
  assert.equal(restored.verification.total, 2);
  assert.equal(restored.verification.verified, 2);
  assert.equal(restored.verification.failed.length, 0);

  const restoredNotebook = await readWorkspaceFile(rootB, restored.project.projectId, "notes/lab-notebook.md");
  assert.match(restoredNotebook.text, /Arrhenius|Charge-Transfer/);
  const reloaded = await readProject(rootB, restored.project.projectId);
  assert.equal(reloaded.title, sample.title);
});
