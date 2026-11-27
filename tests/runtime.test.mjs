import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { executeResearchCommand, readProject } from "../plugins/research-engine/engine.mjs";
import { createHarnessAdapter, runPreflight } from "../src/harnesses/harness-adapter.mjs";
import { invokeModelProvider, sanitizeGeminiSchema } from "../src/providers/model-provider.mjs";
import { saveRuntimeConfig } from "../src/runtime-config.mjs";
import * as runtime from "../src/research-runtime.mjs";

const originalFetch = globalThis.fetch;
const originalGeminiKey = process.env.GEMINI_API_KEY;
const originalHarness = process.env.RESEARCH_HARNESS;
const originalModel = process.env.RESEARCH_MODEL;
const originalProvider = process.env.RESEARCH_PROVIDER;

process.env.GEMINI_API_KEY = "AIza-fixture-test-key-value";
process.env.RESEARCH_HARNESS = "standalone";
process.env.RESEARCH_PROVIDER = "gemini";
process.env.RESEARCH_MODEL = "gemini-2.5-flash";

after(() => {
  globalThis.fetch = originalFetch;
  if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalGeminiKey;
  if (originalHarness === undefined) delete process.env.RESEARCH_HARNESS;
  else process.env.RESEARCH_HARNESS = originalHarness;
  if (originalModel === undefined) delete process.env.RESEARCH_MODEL;
  else process.env.RESEARCH_MODEL = originalModel;
  if (originalProvider === undefined) delete process.env.RESEARCH_PROVIDER;
  else process.env.RESEARCH_PROVIDER = originalProvider;
});

async function rootFor(t, prefix) {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  process.env.OPEN_RESEARCH_ROOT = root;
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function sseResponse(chunks) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

test("sanitizeGeminiSchema strips unsupported fields and empty objects", () => {
  assert.equal(sanitizeGeminiSchema({ type: "object", properties: {} }), undefined);
  const cleaned = sanitizeGeminiSchema({
    type: "object",
    additionalProperties: false,
    properties: {
      query: { type: "string", description: "Keywords", additionalProperties: false },
      nested: { type: "object", properties: {} },
    },
    required: ["query", "nested"],
  });
  assert.deepEqual(cleaned, {
    type: "object",
    properties: { query: { type: "string", description: "Keywords" } },
    required: ["query"],
  });
});

test("invokeModelProvider streams Gemini SSE, merges multi-tool responses, and preserves thoughtSignature", async () => {
  const seenRequests = [];
  let turn = 0;
  const mockFetch = async (url, init) => {
    seenRequests.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    turn += 1;
    if (turn === 1) {
      return sseResponse([
        {
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  { thought: true, text: "Internal thinking..." },
                  { functionCall: { name: "research_project_read", args: {} }, thoughtSignature: "sig_abc123" },
                  { functionCall: { name: "research_literature_search", args: { query: "sodium ion" } } },
                ],
              },
            },
          ],
          usageMetadata: { promptTokenCount: 40, candidatesTokenCount: 15 },
        },
      ]);
    }
    return sseResponse([
      {
        candidates: [{ content: { role: "model", parts: [{ text: "Grounded " }] } }],
      },
      {
        candidates: [{ content: { role: "model", parts: [{ text: "answer." }] } }],
        usageMetadata: { promptTokenCount: 80, candidatesTokenCount: 25 },
      },
    ]);
  };

  const deltas = [];
  const runtimeConfig = {
    harness: "standalone",
    orchestrator: { provider: "gemini", model: "gemini-2.5-flash" },
    reviewers: { provider: "gemini", model: "gemini-2.5-flash" },
    secrets: { gemini: "AIza-test-header-key" },
  };

  const first = await invokeModelProvider({
    roleConfig: runtimeConfig.orchestrator,
    runtimeConfig,
    system: "You are a scientific assistant.",
    messages: [{ role: "user", content: "Investigate sodium-ion sub-zero failure." }],
    tools: [
      { name: "research_project_read", description: "Read project", parameters: { type: "object", properties: {} } },
      { name: "research_literature_search", description: "Search", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
    ],
    fetch: mockFetch,
  });

  assert.equal(seenRequests[0].headers["x-goog-api-key"], "AIza-test-header-key");
  assert.equal(seenRequests[0].url.includes("key="), false);
  assert.equal(first.toolCalls.length, 2);
  assert.equal(first.rawParts.find((p) => p.thoughtSignature)?.thoughtSignature, "sig_abc123");

  const second = await invokeModelProvider({
    roleConfig: runtimeConfig.orchestrator,
    runtimeConfig,
    system: "You are a scientific assistant.",
    messages: [
      { role: "user", content: "Investigate sodium-ion sub-zero failure." },
      { role: "assistant", content: first.text, toolCalls: first.toolCalls, rawParts: first.rawParts },
      { role: "tool", toolName: "research_project_read", toolCallId: first.toolCalls[0].id, content: "{\"ok\":true}" },
      { role: "tool", toolName: "research_literature_search", toolCallId: first.toolCalls[1].id, content: "{\"papers\":[]}" },
    ],
    onDelta: (d) => deltas.push(d),
    fetch: mockFetch,
  });

  assert.equal(second.text, "Grounded answer.");
  assert.deepEqual(deltas, ["Grounded ", "answer."]);
  const sentContents = seenRequests[1].body.contents;
  assert.equal(sentContents.length, 3);
  assert.equal(sentContents[1].parts.find((p) => p.thoughtSignature)?.thoughtSignature, "sig_abc123");
  assert.equal(sentContents[2].role, "user");
  assert.equal(sentContents[2].parts.length, 2);
  assert.equal(sentContents[2].parts[0].functionResponse.name, "research_project_read");
  assert.equal(sentContents[2].parts[1].functionResponse.name, "research_literature_search");
});

test("preflight reports Direct Standalone Runtime and Gemini provider readiness", async (t) => {
  const root = await rootFor(t, "ori-preflight-");
  await saveRuntimeConfig(root, {
    orchestrator: { provider: "gemini", model: "gemini-2.5-flash" },
    reviewers: { provider: "gemini", model: "gemini-2.5-pro" },
    secrets: { gemini: "AIza-fixture" },
  });
  const result = await runPreflight(root, { verifyRemote: false });
  assert.equal(result.ok, true);
  assert.equal(result.harness, "standalone");
  assert.equal(result.checks[0].id, "harness");
  assert.match(result.checks[0].detail, /Standalone/i);
  assert.equal(result.checks.every((c) => c.ok), true);
});

test("runtime isolates three reviewers in parallel, parses robustly, and records Gemini token telemetry", async (t) => {
  const root = await rootFor(t, "ori-runtime-flow-");
  await saveRuntimeConfig(root, {
    orchestrator: { provider: "gemini", model: "gemini-2.5-flash" },
    reviewers: { provider: "gemini", model: "gemini-2.5-flash" },
    secrets: { gemini: "AIza-fixture" },
  });

  let reviewerPackets = [];
  let activeReviewers = 0;
  let maxActiveReviewers = 0;
  let orchStep = 0;

  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    const systemText = body.systemInstruction?.parts?.[0]?.text || "";
    const lastUserText = body.contents.at(-1)?.parts?.[0]?.text || "";

    if (!body.tools?.length && systemText.includes("zero-memory")) {
      activeReviewers += 1;
      maxActiveReviewers = Math.max(maxActiveReviewers, activeReviewers);
      const packet = JSON.parse(lastUserText.split("\n").pop());
      reviewerPackets.push({ systemText, packet, contentsCount: body.contents.length });
      await new Promise((resolve) => setTimeout(resolve, 15));
      activeReviewers -= 1;

      if (systemText.includes("Evidence Auditor")) {
        return sseResponse([{
          candidates: [{ content: { parts: [{ text: '```json\n{"summary":"Evidence is limited","findings":[{"severity":"high","claim":"One abstract is insufficient","reason":"Only one abstract supplied","artifactIds":["hypothesis:fixture","invented:id"]}],"confidence":"high"}\n```' }] } }],
          usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 25 },
        }]);
      }
      if (systemText.includes("Methodology Critic")) {
        return sseResponse([{
          candidates: [{ content: { parts: [{ text: 'Analysis follows.\n{"summary":"Controls are underspecified","findings":[{"severity":"medium","claim":"Alternative explanations remain","reason":"Need blinding","artifactIds":["gap:fixture"]}],"confidence":"medium"}' }] } }],
          usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20 },
        }]);
      }
      return sseResponse([{
        candidates: [{ content: { parts: [{ text: "This response is deliberately not JSON" }] } }],
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 10 },
      }]);
    }

    orchStep += 1;
    if (orchStep === 1) {
      return sseResponse([{
        candidates: [{
          content: {
            parts: [{
              functionCall: {
                name: "research_project_commit",
                args: {
                  nodes: [
                    { id: "paper:fixture", type: "paper", title: "Fixture humidity study", sourceRefs: ["OpenAlex"], data: { abstract: "Humidity reduced strength by twenty percent. Samples varied widely.", doi: "10.0000/fixture" } },
                    { id: "evidence:fixture", type: "evidence", title: "Exact strength claim", sourceRefs: ["paper:fixture"], data: { paperId: "paper:fixture", quote: "Humidity reduced strength by twenty percent." } },
                    { id: "gap:fixture", type: "gap", title: "Controls remain unclear", sourceRefs: ["paper:fixture"], data: { description: "No controlled baseline." } },
                    { id: "hypothesis:fixture", type: "hypothesis", title: "Controlled humidity changes strength", sourceRefs: ["evidence:fixture"], data: { statement: "Controlled humidity exposure changes measured strength." } },
                  ],
                  edges: [
                    { id: "edge:ev", source: "evidence:fixture", target: "paper:fixture", type: "supports", label: "Exact abstract quote" },
                    { id: "edge:gap", source: "gap:fixture", target: "evidence:fixture", type: "identifies", label: "Missing control" },
                    { id: "edge:hyp", source: "hypothesis:fixture", target: "gap:fixture", type: "addresses", label: "Addresses gap" },
                  ],
                  blocks: [{ id: "analysis:fixture", kind: "analysis", title: "Fixture analysis", nodeIds: ["evidence:fixture", "gap:fixture", "hypothesis:fixture"] }],
                },
              },
            }],
          },
        }],
        usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 40 },
      }]);
    }
    if (orchStep === 2) {
      return sseResponse([{
        candidates: [{ content: { parts: [{ text: "Literature synthesis complete." }] } }],
        usageMetadata: { promptTokenCount: 140, candidatesTokenCount: 15 },
      }]);
    }
    if (orchStep === 3) {
      return sseResponse([{
        candidates: [{
          content: {
            parts: [{
              functionCall: {
                name: "research_project_commit",
                args: {
                  nodes: [
                    { id: "experiment:fixture", type: "experiment", title: "Frozen fixture protocol", data: { modality: "computational", protocol: ["Measure dry baseline", "Expose samples"], expectedOutcomes: [{ metric: "Strength", prediction: "Falls 15%", rationale: "Fixture" }] } },
                  ],
                  edges: [{ id: "edge:test", source: "experiment:fixture", target: "hypothesis:fixture", type: "tests", label: "Tests hypothesis" }],
                  blocks: [{ id: "exp:block", kind: "experiment", title: "Validation plan", nodeIds: ["experiment:fixture"] }],
                  status: "ready",
                  message: "Ready",
                },
              },
            }],
          },
        }],
        usageMetadata: { promptTokenCount: 130, candidatesTokenCount: 35 },
      }]);
    }
    return sseResponse([{
      candidates: [{ content: { parts: [{ text: "Protocol synthesized." }] } }],
      usageMetadata: { promptTokenCount: 150, candidatesTokenCount: 12 },
    }]);
  };

  const events = [];
  const listener = (ev) => events.push(ev);
  runtime.runtimeEvents().on("update", listener);
  t.after(() => runtime.runtimeEvents().off("update", listener));

  const started = await runtime.startInvestigation("Does controlled humidity affect material strength?", { mode: "autonomous", root });
  await started.completion;

  const project = await readProject(root, started.projectId);
  assert.equal(project.status, "ready");
  assert.equal(project.nodes.filter((n) => n.type === "review").length, 3);
  assert.equal(maxActiveReviewers, 3);
  assert.equal(reviewerPackets.length, 3);
  assert.ok(reviewerPackets.every((r) => r.contentsCount === 1));
  for (const { packet } of reviewerPackets) {
    assert.deepEqual(Object.keys(packet).sort(), ["abstracts", "artifacts", "hypothesis"]);
  }

  const auditor = project.nodes.find((n) => n.type === "review" && n.data.reviewer === "auditor");
  assert.equal(auditor.data.findings[0].sourceNodeIds.includes("invented:id"), false);
  const feasibility = project.nodes.find((n) => n.type === "review" && n.data.reviewer === "feasibility");
  assert.match(feasibility.data.parseError, /required JSON/);
  assert.ok(project.runs.every((run) => run.outputTps > 0));
  assert.equal(events.at(-1).type, "run");
  assert.equal(events.at(-1).status, "completed");
});

test("stopInvestigation aborts active Gemini request and persists error state", async (t) => {
  const root = await rootFor(t, "ori-runtime-stop-");
  await saveRuntimeConfig(root, {
    orchestrator: { provider: "gemini", model: "gemini-2.5-flash" },
    reviewers: { provider: "gemini", model: "gemini-2.5-flash" },
    secrets: { gemini: "AIza-fixture" },
  });

  let requestStarted = false;
  globalThis.fetch = (_url, init) => {
    requestStarted = true;
    return new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new Error("Aborted by test")));
    });
  };

  const started = await runtime.startInvestigation("Stop this fixture investigation", { mode: "guided", root });
  for (let i = 0; i < 100 && !requestStarted; i += 1) await new Promise((r) => setTimeout(r, 5));
  assert.equal(requestStarted, true);
  await runtime.stopInvestigation(started.sessionKey, started.runId);
  await assert.rejects(started.completion, /stopped|aborted/i);
  const project = await readProject(root, started.projectId);
  assert.equal(project.status, "error");
});

test("429 retry succeeds and missing usage omits TPS", async (t) => {
  const root = await rootFor(t, "ori-runtime-retry-");
  await saveRuntimeConfig(root, {
    orchestrator: { provider: "gemini", model: "gemini-2.5-flash" },
    reviewers: { provider: "gemini", model: "gemini-2.5-flash" },
    secrets: { gemini: "AIza-fixture" },
  });

  let attempts = 0;
  const adapter = createHarnessAdapter(
    {
      harness: "standalone",
      orchestrator: { provider: "gemini", model: "gemini-2.5-flash" },
      reviewers: { provider: "gemini", model: "gemini-2.5-flash" },
      secrets: { gemini: "AIza-fixture" },
    },
    root,
    {
      fetch: async () => {
        attempts += 1;
        if (attempts === 1) {
          return new Response("RESOURCE_EXHAUSTED", { status: 429, headers: { "retry-after": "0.01" } });
        }
        return sseResponse([{ candidates: [{ content: { parts: [{ text: "Recovered after 429." }] } }] }]);
      },
    },
  );

  const project = await executeResearchCommand(root, { op: "create", commandId: "c-retry", curiosity: "Retry check" });
  const key = await adapter.createSession({ agentId: "research", label: "orchestrator" });
  let retried = false;
  const out = await adapter.sendTurn({
    sessionKey: key,
    agentId: "research",
    projectId: project.projectId,
    message: "Say hello",
    onRetry: () => { retried = true; },
  });
  assert.equal(attempts, 2);
  assert.equal(retried, true);
  assert.equal(out.text, "Recovered after 429.");
  assert.equal(out.usage, undefined);
});

test("writer preserves confirmed evidence and frozen outcomes, and routes results through import", async (t) => {
  const root = await rootFor(t, "ori-runtime-writer-");
  let project = await executeResearchCommand(root, { op: "create", commandId: "create", curiosity: "Fixture invariants" });
  const nodes = [
    { id: "paper:immutable", type: "paper", title: "Fixture paper", data: { abstract: "Exact fixture abstract." } },
    { id: "evidence:immutable", type: "evidence", title: "Evidence", data: { paperId: "paper:immutable", quote: "Exact fixture abstract." } },
    { id: "experiment:frozen", type: "experiment", title: "Protocol", data: { protocol: ["Measure"], expectedOutcomes: [{ metric: "m", prediction: "unchanged" }] } },
  ];
  project = await executeResearchCommand(root, { projectId: project.projectId, commandId: "nodes", baseRevision: project.revision, op: "upsert_nodes", payload: { nodes } });
  project = await executeResearchCommand(root, { projectId: project.projectId, commandId: "confirm", baseRevision: project.revision, op: "confirm_evidence", payload: { nodeId: "evidence:immutable" } });
  project = await executeResearchCommand(root, { projectId: project.projectId, commandId: "same-evidence", baseRevision: project.revision, op: "upsert_nodes", payload: { nodes: [nodes[1]] } });
  assert.equal(project.nodes.find((node) => node.id === "evidence:immutable").data.verified, true);
  await assert.rejects(() => executeResearchCommand(root, { projectId: project.projectId, commandId: "change-paper", baseRevision: project.revision, op: "upsert_nodes", payload: { nodes: [{ ...nodes[0], data: { abstract: "Replacement" } }] } }), /immutable abstract/);
  await assert.rejects(() => executeResearchCommand(root, { projectId: project.projectId, commandId: "change-outcomes", baseRevision: project.revision, op: "upsert_nodes", payload: { nodes: [{ ...nodes[2], data: { expectedOutcomes: [{ metric: "m", prediction: "observed result" }] } }] } }), /frozen expected outcomes/);
  await assert.rejects(() => executeResearchCommand(root, { projectId: project.projectId, commandId: "synthetic-result", baseRevision: project.revision, op: "upsert_nodes", payload: { nodes: [{ id: "result:fake", type: "result", title: "Unrun result", data: {} }] } }), /import_result/);
});
