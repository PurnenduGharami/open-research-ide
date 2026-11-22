import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { executeResearchCommand, readProject } from "../plugins/research-engine/engine.mjs";

const fake = {
  calls: [], sessions: [], subscriptions: new Set(), packets: [], reviewerReads: [], pending: new Map(),
  runCounter: 0, activeReviewers: 0, maxActiveReviewers: 0, holdFirst: false,
  reset({ holdFirst = false, rateLimitReviewer = null, includeUsage = true } = {}) {
    this.calls = [];
    this.sessions = [];
    this.subscriptions = new Set();
    this.packets = [];
    this.reviewerReads = [];
    this.pending = new Map();
    this.runCounter = 0;
    this.activeReviewers = 0;
    this.maxActiveReviewers = 0;
    this.holdFirst = holdFirst;
    this.rateLimitReviewer = rateLimitReviewer;
    this.rateLimitSeen = false;
    this.includeUsage = includeUsage;
  },
};

const emitChat = (options, payload) => options.onEvent({ event: "chat", payload });
const reviewerAgent = (agentId) => ["research-auditor", "research-critic", "research-feasibility"].includes(agentId);

async function elephantToolEffects(params) {
  const root = process.env.OPEN_RESEARCH_ROOT;
  const key = params.idempotencyKey;
  let project = await readProject(root);
  if (params.message.startsWith("FIRST TURN")) {
    project = await executeResearchCommand(root, {
      commandId: `${key}:sources`, baseRevision: project.revision, op: "record_sources",
      payload: { sources: [
        { id: "openalex", provider: "OpenAlex", url: "https://example.test/unavailable", status: "error", queriedAt: new Date().toISOString(), error: "HTTP 503 fixture failure" },
        { id: "semantic-scholar", provider: "Semantic Scholar", url: "https://example.test/fixture", status: "ok", queriedAt: new Date().toISOString() },
      ] },
    });
    const nodes = [
      { id: "paper:fixture", type: "paper", title: "Fixture humidity study", sourceRefs: ["semantic-scholar"], data: { abstract: "Humidity reduced strength by twenty percent. Samples varied widely.", doi: "10.0000/fixture" } },
      { id: "evidence:fixture", type: "evidence", title: "Exact strength claim", sourceRefs: ["paper:fixture"], data: { paperId: "paper:fixture", quote: "Humidity reduced strength by twenty percent." } },
      { id: "gap:fixture", type: "gap", title: "Controls remain unclear", sourceRefs: ["paper:fixture"], data: { description: "The fixture abstract does not establish a controlled protocol." } },
      { id: "hypothesis:fixture", type: "hypothesis", title: "Controlled humidity changes strength", sourceRefs: ["evidence:fixture"], data: { statement: "Controlled humidity exposure changes measured material strength." } },
    ];
    project = await executeResearchCommand(root, {
      commandId: `${key}:nodes`, baseRevision: project.revision, op: "upsert_nodes",
      payload: { nodes, edges: [
        { id: "edge:evidence", source: "evidence:fixture", target: "paper:fixture", type: "supports", label: "Exact abstract evidence" },
        { id: "edge:gap", source: "gap:fixture", target: "evidence:fixture", type: "identifies", label: "Identifies missing control" },
        { id: "edge:hypothesis", source: "hypothesis:fixture", target: "gap:fixture", type: "addresses", label: "Addresses control gap" },
      ] },
    });
    await executeResearchCommand(root, {
      commandId: `${key}:blocks`, baseRevision: project.revision, op: "set_blocks",
      payload: { blocks: [{ id: "analysis:fixture", kind: "analysis", title: "Fixture analysis", nodeIds: ["evidence:fixture", "gap:fixture", "hypothesis:fixture"] }] },
    });
    return "Committed fixture literature synthesis";
  }
  project = await executeResearchCommand(root, {
    commandId: `${key}:nodes`, baseRevision: project.revision, op: "upsert_nodes",
    payload: { nodes: [
      { id: "experiment:fixture", type: "experiment", title: "Frozen fixture protocol", data: { protocol: ["Measure dry baseline", "Expose controlled samples", "Measure strength blinded"], expectedOutcomes: [{ metric: "Strength", prediction: "Strength changes relative to baseline", rationale: "Fixture hypothesis" }], controls: ["Unexposed samples"], outreachDraft: { subject: "Protocol fit", body: "Could you assess fit and pricing for this unrun protocol?" } } },
      { id: "lab:one", type: "lab", title: "Candidate facility one", data: { institution: "Candidate institution", contacted: false, fit: "Unverified fixture candidate", price: { kind: "unavailable", note: "No price obtained" } } },
      { id: "lab:two", type: "lab", title: "Candidate facility two", data: { institution: "Candidate institution", contacted: false, fit: "Unverified fixture candidate", price: { kind: "unavailable", note: "No price obtained" } } },
    ], edges: [{ id: "edge:test", source: "experiment:fixture", target: "hypothesis:fixture", type: "tests", label: "Tests frozen hypothesis" }] },
  });
  project = await executeResearchCommand(root, {
    commandId: `${key}:block`, baseRevision: project.revision, op: "set_blocks",
    payload: { blocks: [{ id: "experiment:block", kind: "experiment", title: "Unrun protocol", nodeIds: ["experiment:fixture", "lab:one", "lab:two"] }] },
  });
  await executeResearchCommand(root, {
    commandId: `${key}:ready`, baseRevision: project.revision, op: "set_status",
    payload: { status: "ready", message: "Unrun protocol synthesized; predictions frozen" },
  });
  return "Committed unrun fixture protocol";
}

function reviewText(agentId) {
  if (agentId === "research-auditor") return '```json\n{"summary":"Evidence is limited","findings":[{"severity":"high","claim":"One abstract is insufficient","reason":"The packet contains one fixture abstract","artifactIds":["hypothesis:fixture","invented:id"]}],"confidence":"high"}\n```';
  if (agentId === "research-critic") return 'Analysis follows.\n{"summary":"Controls are underspecified","findings":[{"severity":"medium","claim":"Alternative explanations remain","reason":"Blinding and sampling need detail","artifactIds":["gap:fixture"]}],"confidence":"medium"}';
  return "This response is deliberately not JSON";
}

class FakeGatewayClient {
  constructor(options) { this.options = options; }
  start() { queueMicrotask(() => this.options.onHelloOk({})); }
  async stopAndWait() {}
  async request(method, params) {
    fake.calls.push({ method, params });
    if (method === "status") return { ok: true };
    if (method === "agents.list") return { agents: ["research", "research-auditor", "research-critic", "research-feasibility"].map((id) => ({ id })) };
    if (method === "models.list") return { models: [{ id: "moonshotai-kimi-k3.1-pro-trial", provider: "cerebras", available: true }] };
    if (method === "sessions.create") {
      fake.sessions.push(params);
      return { sessionKey: params.key, key: params.key };
    }
    if (method === "sessions.messages.subscribe") {
      fake.subscriptions.add(params.key);
      return { key: params.key, agentId: params.agentId };
    }
    if (method === "sessions.messages.unsubscribe") {
      fake.subscriptions.delete(params.key);
      return { key: params.key };
    }
    if (method === "chat.abort") {
      const pending = fake.pending.get(params.sessionKey);
      if (pending) {
        fake.pending.delete(params.sessionKey);
        emitChat(this.options, { sessionKey: params.sessionKey, runId: pending.runId, state: "aborted", errorMessage: "Investigation stopped by researcher" });
      }
      return { status: pending ? "aborted" : "no-active-run" };
    }
    if (method !== "chat.send") throw new Error(`Unexpected mocked RPC ${method}`);
    assert.ok(fake.subscriptions.has(params.sessionKey), `Missing live subscription for ${params.sessionKey}`);
    const runId = `provider-run-${++fake.runCounter}`;
    const reviewer = reviewerAgent(params.agentId);
    if (reviewer) {
      fake.activeReviewers += 1;
      fake.maxActiveReviewers = Math.max(fake.maxActiveReviewers, fake.activeReviewers);
      fake.packets.push({ agentId: params.agentId, packet: JSON.parse(params.message.split("\n").pop()), sessionKey: params.sessionKey });
    }
    if (reviewer && params.agentId === fake.rateLimitReviewer && !fake.rateLimitSeen) {
      fake.rateLimitSeen = true;
      fake.activeReviewers -= 1;
      emitChat(this.options, { sessionKey: params.sessionKey, runId, state: "error", errorMessage: "HTTP 429 fixture rate limit" });
      return { runId, status: "started" };
    }
    if (fake.holdFirst && params.agentId === "research") {
      fake.pending.set(params.sessionKey, { runId });
      emitChat(this.options, { sessionKey: params.sessionKey, runId, state: "delta", deltaText: "Pending fixture" });
      return { runId, status: "started" };
    }
    const before = reviewer ? JSON.stringify(await readProject(process.env.OPEN_RESEARCH_ROOT)) : null;
    const text = reviewer ? reviewText(params.agentId) : await elephantToolEffects(params);
    const after = reviewer ? JSON.stringify(await readProject(process.env.OPEN_RESEARCH_ROOT)) : null;
    if (reviewer) {
      fake.reviewerReads.push({ agentId: params.agentId, unchanged: before === after });
      fake.activeReviewers -= 1;
    }
    await new Promise((resolve) => setTimeout(resolve, 2));
    emitChat(this.options, { sessionKey: params.sessionKey, runId, state: "delta", deltaText: `${params.agentId} delta` });
    // Deliberately emit a synchronous terminal before returning the chat.send ack.
    emitChat(this.options, {
      sessionKey: params.sessionKey, runId, state: "final",
      message: { content: [{ type: "text", text }], ...(fake.includeUsage ? { usage: { inputTokens: 100, outputTokens: 20 } } : {}) },
    });
    return { runId, status: "started" };
  }
}

process.env.OPENCLAW_GATEWAY_TOKEN = "fixture-token";
process.env.RESEARCH_MODEL = "cerebras/moonshotai-kimi-k3.1-pro-trial";
const gateway = await import("../src/gateway.mjs");
const runtime = await import("../src/research-runtime.mjs");
gateway.setGatewayClientFactory((options) => new FakeGatewayClient(options));

after(async () => {
  await gateway.closeGateway();
  gateway.setGatewayClientFactory();
});

async function rootFor(t, prefix) {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  process.env.OPEN_RESEARCH_ROOT = root;
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("preflight uses model RPC and reports all dedicated agents", async () => {
  fake.reset();
  const result = await gateway.preflight();
  assert.equal(result.ok, true);
  assert.equal(result.reviewers.length, 3);
  assert.ok(fake.calls.some((call) => call.method === "models.list" && call.params.view === "configured"));
});

test("runtime isolates three reviewers, parses robustly, emits real events, and survives early terminal events", async (t) => {
  const root = await rootFor(t, "research-runtime-flow-");
  fake.reset();
  const events = [];
  const listener = (event) => events.push(event);
  runtime.runtimeEvents().on("update", listener);
  t.after(() => runtime.runtimeEvents().off("update", listener));

  const started = await runtime.startInvestigation("Does controlled humidity affect material strength?");
  assert.ok(started.sessionKey.startsWith("research-"));
  assert.ok(started.runId);
  assert.equal(runtime.activeRuns().length, 1);
  await started.completion;

  const project = await readProject(root);
  assert.equal(project.status, "ready");
  assert.equal(project.sessionKey, started.sessionKey);
  assert.equal(project.sources.find((source) => source.id === "openalex").status, "error");
  assert.match(project.sources.find((source) => source.id === "openalex").error, /503/);
  assert.equal(project.nodes.filter((node) => node.type === "review").length, 3);
  assert.equal(project.runs.filter((run) => run.status === "completed").length, 5, JSON.stringify(project.runs));
  assert.ok(project.runs.every((run) => run.outputTps > 0));
  assert.equal(project.nodes.find((node) => node.type === "experiment").data.expectedOutcomesFrozenAt !== undefined, true);
  assert.equal(project.nodes.some((node) => node.type === "result"), false);

  const auditor = project.nodes.find((node) => node.type === "review" && node.data.reviewer === "auditor");
  assert.equal(auditor.data.findings[0].sourceNodeIds.includes("invented:id"), false);
  assert.ok(auditor.data.packetSha256);
  assert.ok(auditor.data.sessionKey);
  assert.ok(auditor.data.rawResponse.includes("Evidence is limited"));
  const feasibility = project.nodes.find((node) => node.type === "review" && node.data.reviewer === "feasibility");
  assert.match(feasibility.data.parseError, /required JSON/);
  assert.equal(feasibility.data.rawResponse, "This response is deliberately not JSON");

  assert.equal(fake.packets.length, 3);
  assert.equal(new Set(fake.packets.map((packet) => packet.sessionKey)).size, 3);
  assert.deepEqual(fake.reviewerReads.every((read) => read.unchanged), true);
  assert.equal(fake.maxActiveReviewers, 3);
  assert.equal(fake.subscriptions.size, 0);
  for (const { packet } of fake.packets) {
    assert.deepEqual(Object.keys(packet).sort(), ["abstracts", "artifacts", "hypothesis"]);
    assert.equal(packet.abstracts[0].abstract, "Humidity reduced strength by twenty percent. Samples varied widely.");
    assert.equal(JSON.stringify(packet).includes("provider-run"), false);
  }
  const reviewCreates = fake.sessions.filter((session) => session.agentId.startsWith("research-") && session.agentId !== "research");
  assert.equal(reviewCreates.length, 3);
  assert.ok(reviewCreates.every((session) => session.model === "cerebras/moonshotai-kimi-k3.1-pro-trial" && session.thinkingLevel === "off" && !session.parentSessionKey && !session.fork));
  const reviewerSends = fake.calls.filter((call) => call.method === "chat.send" && reviewerAgent(call.params.agentId));
  assert.equal(reviewerSends.length, 3);

  assert.equal(events.filter((event) => event.type === "delta").length, 5);
  assert.ok(events.some((event) => event.type === "snapshot" && event.project?.nodes.some((node) => node.type === "review")));
  assert.equal(events.at(-1).type, "run");
  assert.equal(events.at(-1).status, "completed");
  assert.ok(events.at(-1).telemetry.outputTps > 0);
  assert.ok(events.filter((event) => event.type === "snapshot").every((event) => event.project.status !== "ready" || event.project.nodes.some((node) => node.type === "experiment")));
  assert.equal(runtime.activeRuns().length, 0);
});

test("stop aborts only the dedicated active session and persists failure", async (t) => {
  const root = await rootFor(t, "research-runtime-stop-");
  await gateway.closeGateway();
  fake.reset({ holdFirst: true });
  const started = await runtime.startInvestigation("Stop this fixture investigation");
  for (let index = 0; index < 100 && fake.pending.size === 0; index += 1) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(fake.pending.size, 1);
  await runtime.stopInvestigation(started.sessionKey, started.runId);
  await assert.rejects(started.completion, /stopped|aborted/i);
  const project = await readProject(root);
  assert.equal(project.status, "error");
  assert.equal(fake.calls.filter((call) => call.method === "chat.abort").length, 1);
  assert.equal(fake.calls.some((call) => call.method === "sessions.create" && reviewerAgent(call.params.agentId)), false);
  assert.equal(runtime.activeRuns().some((run) => run.sessionKey === started.sessionKey), false);
  await runtime.stopInvestigation(started.sessionKey, "wrong-run-id");
});

test("429 retry reuses the session and idempotency key, and missing usage omits TPS", async (t) => {
  await rootFor(t, "research-runtime-retry-");
  await gateway.closeGateway();
  fake.reset({ rateLimitReviewer: "research-auditor", includeUsage: false });
  const events = [];
  const listener = (event) => events.push(event);
  runtime.runtimeEvents().on("update", listener);
  t.after(() => runtime.runtimeEvents().off("update", listener));
  const started = await runtime.startInvestigation("Retry one rate-limited reviewer");
  await started.completion;
  const sends = fake.calls.filter((call) => call.method === "chat.send" && call.params.agentId === "research-auditor");
  assert.equal(sends.length, 2);
  assert.equal(sends[0].params.idempotencyKey, sends[1].params.idempotencyKey);
  assert.equal(sends[0].params.sessionKey, sends[1].params.sessionKey);
  const project = await readProject(process.env.OPEN_RESEARCH_ROOT);
  assert.equal(project.status, "ready");
  assert.equal(project.runs.filter((run) => run.status === "completed").length, 5);
  assert.ok(project.runs.every((run) => run.outputTps === undefined && run.outputTokens === undefined && run.inputTokens === undefined));
  assert.ok(events.some((event) => event.type === "error" && event.message.includes("rate limited")));
  assert.equal(events.at(-1).telemetry.outputTps, undefined);
});

test("writer preserves confirmed evidence and frozen outcomes, and routes results through import", async (t) => {
  const root = await rootFor(t, "research-runtime-writer-");
  let project = await executeResearchCommand(root, { op: "create", commandId: "create", curiosity: "Fixture invariants" });
  const nodes = [
    { id: "paper:immutable", type: "paper", title: "Fixture paper", data: { abstract: "Exact fixture abstract." } },
    { id: "evidence:immutable", type: "evidence", title: "Evidence", data: { paperId: "paper:immutable", quote: "Exact fixture abstract." } },
    { id: "experiment:frozen", type: "experiment", title: "Protocol", data: { protocol: ["Measure"], expectedOutcomes: [{ metric: "m", prediction: "unchanged" }] } },
  ];
  project = await executeResearchCommand(root, { commandId: "nodes", baseRevision: project.revision, op: "upsert_nodes", payload: { nodes } });
  project = await executeResearchCommand(root, { commandId: "confirm", baseRevision: project.revision, op: "confirm_evidence", payload: { nodeId: "evidence:immutable" } });
  project = await executeResearchCommand(root, { commandId: "same-evidence", baseRevision: project.revision, op: "upsert_nodes", payload: { nodes: [nodes[1]] } });
  assert.equal(project.nodes.find((node) => node.id === "evidence:immutable").data.verified, true);
  await assert.rejects(() => executeResearchCommand(root, { commandId: "change-paper", baseRevision: project.revision, op: "upsert_nodes", payload: { nodes: [{ ...nodes[0], data: { abstract: "Replacement" } }] } }), /immutable abstract/);
  await assert.rejects(() => executeResearchCommand(root, { commandId: "change-outcomes", baseRevision: project.revision, op: "upsert_nodes", payload: { nodes: [{ ...nodes[2], data: { expectedOutcomes: [{ metric: "m", prediction: "observed result" }] } }] } }), /frozen expected outcomes/);
  await assert.rejects(() => executeResearchCommand(root, { commandId: "synthetic-result", baseRevision: project.revision, op: "upsert_nodes", payload: { nodes: [{ id: "result:fake", type: "result", title: "Unrun result", data: {} }] } }), /import_result/);
});
