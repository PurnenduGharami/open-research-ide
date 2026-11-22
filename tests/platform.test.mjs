import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  deleteProject,
  executeResearchCommand,
  listProjects,
  readProject,
  recoverInterruptedProjects,
  setActiveProject,
} from "../plugins/research-engine/engine.mjs";
import { buildZipArchive } from "../src/export-renderer.mjs";
import { draftManuscriptFromProject } from "../src/manuscript.mjs";
import { auditManuscriptProse, humanizeProseText } from "../src/prose-linter.mjs";
import { getPublicRuntimeConfig, readRuntimeConfig, saveRuntimeConfig } from "../src/runtime-config.mjs";
import {
  buildColabNotebook,
  buildSurveyCsvTemplate,
  buildSurveySchema,
  parseCsvSummary,
  runExperimentCodeLocally,
} from "../src/validation-tools.mjs";

test("multi-project lifecycle: create multiple projects, switch, recover interrupted, and delete", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "ori-multiproject-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const first = await executeResearchCommand(root, { op: "create", commandId: "c1", curiosity: "First research question on batteries", title: "Battery Study", mode: "guided" });
  const second = await executeResearchCommand(root, { op: "create", commandId: "c2", curiosity: "Second research question on compilers", title: "Compiler Study", mode: "autonomous" });

  assert.notEqual(first.projectId, second.projectId);
  const listed = await listProjects(root);
  assert.equal(listed.projects.length, 2);
  assert.equal(listed.activeProjectId, second.projectId);

  const switched = await setActiveProject(root, first.projectId);
  assert.equal(switched.projectId, first.projectId);
  assert.equal((await readProject(root)).projectId, first.projectId);

  const recovered = await recoverInterruptedProjects(root, new Set());
  assert.equal(recovered.length, 2);
  assert.equal((await readProject(root, first.projectId)).status, "ready");

  await deleteProject(root, first.projectId);
  const afterDelete = await listProjects(root);
  assert.equal(afterDelete.projects.length, 1);
  assert.equal(afterDelete.activeProjectId, second.projectId);
});

test("evidence confirm/unconfirm/reject, lab quote updates, and non-staling contentRevision across record_exports", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "ori-curation-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  let project = await executeResearchCommand(root, { op: "create", commandId: "c", curiosity: "Test curation and export freshness" });
  project = await executeResearchCommand(root, {
    projectId: project.projectId,
    commandId: "n",
    baseRevision: project.revision,
    op: "upsert_nodes",
    payload: {
      nodes: [
        { id: "paper:1", type: "paper", title: "Paper 1", data: { abstract: "Exact measured effect was 12 percent." } },
        { id: "ev:1", type: "evidence", title: "Effect", data: { paperId: "paper:1", quote: "Exact measured effect was 12 percent." } },
        { id: "lab:1", type: "lab", title: "Core Facility", data: { name: "Core Facility", contacted: false, price: { kind: "unavailable", note: "None" } } },
      ],
    },
  });

  project = await executeResearchCommand(root, { projectId: project.projectId, commandId: "conf", baseRevision: project.revision, op: "confirm_evidence", payload: { nodeId: "ev:1" } });
  assert.equal(project.nodes.find((n) => n.id === "ev:1").data.verified, true);

  project = await executeResearchCommand(root, { projectId: project.projectId, commandId: "unconf", baseRevision: project.revision, op: "unconfirm_evidence", payload: { nodeId: "ev:1" } });
  assert.equal(project.nodes.find((n) => n.id === "ev:1").data.verified, false);

  project = await executeResearchCommand(root, { projectId: project.projectId, commandId: "rej", baseRevision: project.revision, op: "reject_evidence", payload: { nodeId: "ev:1", reason: "Weak sample" } });
  assert.equal(project.nodes.find((n) => n.id === "ev:1").data.verificationStatus, "rejected");

  project = await executeResearchCommand(root, {
    projectId: project.projectId,
    commandId: "labupd",
    baseRevision: project.revision,
    op: "update_lab",
    payload: { nodeId: "lab:1", contacted: true, notes: "Emailed director", price: { kind: "quoted", amount: 1500, currency: "USD", note: "Written quote #42" } },
  });
  const lab = project.nodes.find((n) => n.id === "lab:1");
  assert.equal(lab.data.contacted, true);
  assert.equal(lab.data.price.kind, "quoted");
  assert.equal(lab.data.price.amount, 1500);

  const contentRevBeforeExport = project.contentRevision;
  project = await executeResearchCommand(root, {
    projectId: project.projectId,
    commandId: "exp",
    baseRevision: project.revision,
    op: "record_exports",
    payload: { exports: [{ format: "zip", path: "workspace/exports/research-bundle.zip", sha256: "a".repeat(64) }] },
  });
  assert.equal(project.contentRevision, contentRevBeforeExport);
  assert.equal(project.exports[0].contentRevision, project.contentRevision);
});

test("validation tools build valid Colab notebooks, survey exports, CSV summaries, and execute local JS", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "ori-validation-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const project = { title: "Test Study", curiosity: "Does caching lower tail latency?" };
  const exp = {
    id: "exp:1",
    title: "Latency Benchmark",
    data: {
      modality: "computational",
      expectedOutcomes: [{ metric: "p99_ms", prediction: "< 50ms" }],
      codeExperiment: { language: "javascript", filename: "bench.mjs", dependencies: [], code: "console.log('p99_ms=28.4');", runCommand: "node bench.mjs" },
      surveyDesign: { targetPopulation: "Engineers", targetSampleSize: 40, estimatedMinutes: 4, distributionChannels: [], questions: [{ id: "q1", prompt: "Rate latency", kind: "likert" }] },
    },
  };

  const nb = buildColabNotebook(project, exp);
  assert.equal(nb.nbformat, 4);
  assert.ok(nb.cells.length >= 3);

  const schema = buildSurveySchema(project, exp);
  assert.equal(schema.questions.length, 1);
  const csvTpl = buildSurveyCsvTemplate(exp);
  assert.match(csvTpl, /"participant_id","submitted_at","q1"/);

  const csvSummary = parseCsvSummary("id,score\n1,10\n2,20\n3,30\n");
  assert.equal(csvSummary.rowCount, 3);
  assert.match(csvSummary.preview, /mean=20\.000/);

  const runOut = await runExperimentCodeLocally(root, "proj1", exp);
  assert.equal(runOut.exitCode, 0);
  assert.match(runOut.stdout, /p99_ms=28\.4/);
});

test("prose linter detects AI clichés and humanizer improves manuscript prose score", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "ori-manuscript-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const aiHeavy = {
    abstract: "In today's rapidly evolving landscape, it is worth noting that this groundbreaking study delves into a multifaceted tapestry that plays a crucial role in seamlessly leveraging results.",
    sections: [{ id: "intro", heading: "Intro", content: "Furthermore, the paradigm shift underscores pivotal outcomes. Moreover, it is worth noting that a wide range of factors matter. Additionally, we delve into details.", updatedAt: new Date().toISOString() }],
  };
  const before = await auditManuscriptProse(aiHeavy, { useVale: false });
  assert.ok(before.issueCount >= 5);
  assert.ok(before.score < 80);

  const cleaned = {
    abstract: humanizeProseText(aiHeavy.abstract),
    sections: [{ ...aiHeavy.sections[0], content: humanizeProseText(aiHeavy.sections[0].content) }],
  };
  const after = await auditManuscriptProse(cleaned, { useVale: false });
  assert.ok(after.score > before.score);

  const project = await executeResearchCommand(root, { op: "create", commandId: "m1", curiosity: "Does morning light improve sleep latency?" });
  const draft = await draftManuscriptFromProject(project);
  assert.equal(draft.sections.length, 6);
  assert.ok(draft.proseAudit.score >= 85);
});

test("deterministic ZIP archive builder and server-only runtime config masking", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "ori-config-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const ts = "2026-11-22T00:00:00.000Z";
  const z1 = buildZipArchive([{ name: "a.txt", data: "hello" }, { name: "b.json", data: "{\"ok\":true}" }], ts);
  const z2 = buildZipArchive([{ name: "a.txt", data: "hello" }, { name: "b.json", data: "{\"ok\":true}" }], ts);
  assert.equal(z1.subarray(0, 4).toString("hex"), "504b0304");
  assert.deepEqual(z1, z2);

  await saveRuntimeConfig(root, {
    harness: "standalone",
    orchestrator: { provider: "anthropic", model: "claude-sonnet-4-5" },
    reviewers: { provider: "ollama", model: "qwen2.5:14b" },
    secrets: { anthropic: "sk-ant-secret-fixture-value" },
  });
  const loaded = await readRuntimeConfig(root);
  assert.equal(loaded.harness, "standalone");
  assert.equal(loaded.orchestrator.provider, "anthropic");
  assert.equal(loaded.reviewers.provider, "ollama");

  const publicView = getPublicRuntimeConfig(loaded);
  assert.equal(publicView.providersConfigured.anthropic, true);
  assert.equal(JSON.stringify(publicView).includes("sk-ant-secret-fixture-value"), false);
});
