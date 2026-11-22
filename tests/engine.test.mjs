import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { executeResearchCommand, projectPath, readProject, sha256 } from "../plugins/research-engine/engine.mjs";

const setup = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "research-engine-"));
  const project = await executeResearchCommand(root, { op: "create", commandId: "create", curiosity: "Can this be tested?", title: "Writer test" });
  return { root, project };
};

test("writer is revision checked, idempotent, atomic, and keeps a backup", async (t) => {
  const { root, project } = await setup();
  t.after(() => rm(root, { recursive: true, force: true }));
  const command = { commandId: "paper-1", baseRevision: project.revision, op: "upsert_nodes", payload: { nodes: [{ id: "paper:1", type: "paper", title: "Real record", data: { abstract: "An exact opening claim. More detail.", doi: "10.1/test" } }] } };
  const first = await executeResearchCommand(root, command);
  assert.equal(first.revision, 2);
  const duplicate = await executeResearchCommand(root, { ...command, baseRevision: 999 });
  assert.equal(duplicate.revision, 2);
  await assert.rejects(() => executeResearchCommand(root, { ...command, commandId: "other" }), /Stale revision/);
  assert.equal(JSON.parse(await readFile(`${projectPath(root)}.bak`, "utf8")).revision, 1);
});

test("evidence uses exact abstract substrings and cannot self-verify", async (t) => {
  const { root, project } = await setup();
  t.after(() => rm(root, { recursive: true, force: true }));
  const paper = await executeResearchCommand(root, { commandId: "p", baseRevision: project.revision, op: "upsert_nodes", payload: { nodes: [{ id: "paper:1", type: "paper", title: "Paper", data: { abstract: "Humidity reduced strength by twenty percent." } }] } });
  const evidence = await executeResearchCommand(root, { commandId: "e", baseRevision: paper.revision, op: "upsert_nodes", payload: { nodes: [{ id: "evidence:1", type: "evidence", title: "Claim", data: { paperId: "paper:1", quote: "Humidity reduced strength", verified: true } }] } });
  const stored = evidence.nodes[1];
  assert.equal(stored.data.verified, false);
  assert.equal(stored.data.quoteSha256, sha256("Humidity reduced strength"));
  await assert.rejects(() => executeResearchCommand(root, { commandId: "bad", baseRevision: evidence.revision, op: "upsert_nodes", payload: { nodes: [{ id: "evidence:bad", type: "evidence", title: "Fabricated", data: { paperId: "paper:1", quote: "not in abstract" } }] } }), /exact substring/);
  const confirmed = await executeResearchCommand(root, { commandId: "human-confirm", baseRevision: evidence.revision, op: "confirm_evidence", payload: { nodeId: "evidence:1" } });
  assert.equal(confirmed.nodes[1].data.verified, true);
});

test("export manifests atomically preserve their shared canonical source revision", async (t) => {
  const { root, project } = await setup();
  t.after(() => rm(root, { recursive: true, force: true }));
  const files = [
    { format: "html", path: "workspace/exports/research-report.html", sha256: "a".repeat(64) },
    { format: "pdf", path: "workspace/exports/pdf/research-report.pdf", sha256: "b".repeat(64) },
    { format: "latex", path: "workspace/exports/latex/main.tex", sha256: "c".repeat(64) },
    { format: "latex", path: "workspace/exports/latex/references.bib", sha256: "d".repeat(64) },
  ];
  const recorded = await executeResearchCommand(root, {
    op: "record_exports", commandId: "exports", baseRevision: project.revision,
    payload: { exports: files },
  });
  assert.equal(recorded.revision, project.revision + 1);
  assert.equal(recorded.exports.length, 4);
  assert.ok(recorded.exports.every((item) => item.revision === project.revision));
  assert.equal(recorded.exports.filter((item) => item.format === "latex").length, 2);
});

test("parallel commands serialize through the single-writer queue", async (t) => {
  const { root, project } = await setup();
  t.after(() => rm(root, { recursive: true, force: true }));
  const results = await Promise.all([
    executeResearchCommand(root, { commandId: "same", baseRevision: project.revision, op: "set_status", payload: { status: "ready", message: "done" } }),
    executeResearchCommand(root, { commandId: "same", baseRevision: project.revision, op: "set_status", payload: { status: "ready", message: "done" } }),
  ]);
  assert.equal(results[0].revision, 2);
  assert.equal(results[1].revision, 2);
  assert.deepEqual(await readProject(root), results[0]);
});
