import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { executeResearchCommand, readProject, sha256 } from "../plugins/research-engine/engine.mjs";
import { getGateway, sendTurn } from "./gateway.mjs";

const MODEL = process.env.RESEARCH_MODEL || "cerebras/moonshotai-kimi-k3.1-pro-trial";
const emitter = new EventEmitter();
emitter.setMaxListeners(100);
const investigations = new Map();
const reviewers = [
  { reviewer: "auditor", agentId: "research-auditor" },
  { reviewer: "critic", agentId: "research-critic" },
  { reviewer: "feasibility", agentId: "research-feasibility" },
];
const errorText = (error) => String(error?.message || error || "Unknown research error").slice(0, 2000);
const finiteUsage = (value) => value === undefined || value === null || value === "" ? undefined : Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : undefined;

export function runtimeEvents() { return emitter; }

function telemetry(investigation, status = investigation.status) {
  const elapsedMs = Math.max(0, (investigation.endedAt || Date.now()) - investigation.startedAt);
  const result = {
    sessionKey: investigation.sessionKey,
    status,
    runId: investigation.runId,
    startedAt: new Date(investigation.startedAt).toISOString(),
    elapsedMs,
    outputTpsLabel: "run-average output TPS",
  };
  if (investigation.inputTokens !== undefined) result.inputTokens = investigation.inputTokens;
  if (investigation.outputTokens !== undefined) result.outputTokens = investigation.outputTokens;
  if (investigation.outputTokens !== undefined && elapsedMs > 0 && !["connecting", "running"].includes(status)) {
    result.outputTps = Math.round((investigation.outputTokens / (elapsedMs / 1000)) * 10) / 10;
  }
  return result;
}

export function activeRuns() {
  return [...investigations.values()]
    .filter((investigation) => ["connecting", "running"].includes(investigation.status))
    .map((investigation) => telemetry(investigation));
}

function emitRun(investigation, status = investigation.status) {
  emitter.emit("update", {
    type: "run", project: null, revision: investigation.revision,
    runId: investigation.runId, status, telemetry: telemetry(investigation, status),
  });
}

function emitSnapshot(investigation, project) {
  investigation.revision = project.revision;
  emitter.emit("update", {
    type: "snapshot", project, revision: project.revision,
    runId: investigation.runId, status: investigation.status, telemetry: telemetry(investigation),
  });
}

function emitError(investigation, message, project = null) {
  emitter.emit("update", {
    type: "error", project, revision: investigation.revision,
    runId: investigation.runId, status: investigation.status,
    message, telemetry: telemetry(investigation),
  });
}

async function commit(investigation, op, payload, commandId) {
  const operation = investigation.commitQueue.then(async () => {
    const current = await readProject(investigation.root);
    if (!current) throw new Error("The investigation canonical state is missing");
    return executeResearchCommand(investigation.root, {
      commandId, baseRevision: current.revision, op, payload,
    });
  });
  investigation.commitQueue = operation.catch(() => {});
  const project = await operation;
  emitSnapshot(investigation, project);
  return project;
}

function assertActive(investigation) {
  if (investigation.stopping) throw new Error("Investigation stopped by researcher");
}

async function createSession(investigation, agentId, label, requestedKey) {
  const key = requestedKey || `research-${label}-${randomUUID()}`;
  investigation.sessionKeys.add(key);
  const gateway = await getGateway();
  const created = await gateway.request("sessions.create", {
    key, agentId, model: MODEL, thinkingLevel: "off",
    displayName: `Open Research IDE — ${label}`,
  });
  const sessionKey = created?.sessionKey || created?.key || key;
  investigation.sessionKeys.add(sessionKey);
  return sessionKey;
}

const isRateLimit = (error) => error?.status === 429 || error?.statusCode === 429 || /(?:\b429\b|rate.?limit|too many requests)/i.test(errorText(error));

async function sendWithBasicRetry(options, investigation) {
  try {
    return await sendTurn(options);
  } catch (error) {
    assertActive(investigation);
    if (!isRateLimit(error)) throw error;
    emitError(investigation, `${options.agentId} was rate limited; retrying once with the same idempotency key`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    assertActive(investigation);
    return sendTurn(options);
  }
}

function accumulateUsage(investigation, usage) {
  const input = finiteUsage(usage?.inputTokens ?? usage?.input_tokens ?? usage?.promptTokens ?? usage?.prompt_tokens);
  const output = finiteUsage(usage?.outputTokens ?? usage?.output_tokens ?? usage?.completionTokens ?? usage?.completion_tokens);
  if (input !== undefined) investigation.inputTokens = (investigation.inputTokens || 0) + input;
  if (output !== undefined) investigation.outputTokens = (investigation.outputTokens || 0) + output;
  return { inputTokens: input, outputTokens: output };
}

async function callTurn(investigation, { agentId, sessionKey, kind, commandId, message }) {
  assertActive(investigation);
  const startedAt = Date.now();
  investigation.status = "running";
  emitRun(investigation, "running");
  try {
    const result = await sendWithBasicRetry({
      sessionKey, agentId, message, idempotencyKey: commandId,
      onDelta(delta, payload) {
        if (!delta) return;
        emitter.emit("update", {
          type: "delta", project: null, revision: investigation.revision,
          delta, runId: payload?.runId || commandId, status: "running",
          telemetry: telemetry(investigation, "running"),
        });
      },
    }, investigation);
    assertActive(investigation);
    const tokens = accumulateUsage(investigation, result.usage);
    const endedAt = new Date().toISOString();
    const run = {
      id: result.runId, kind, agentId, model: MODEL, status: "completed",
      startedAt: new Date(startedAt).toISOString(), endedAt,
      durationMs: Math.max(0, result.durationMs), ...tokens,
    };
    await commit(investigation, "record_run", { run }, `${commandId}:run`);
    emitRun(investigation, "running");
    return result;
  } catch (error) {
    const run = {
      id: commandId, kind, agentId, model: MODEL, status: "error",
      startedAt: new Date(startedAt).toISOString(), endedAt: new Date().toISOString(),
      durationMs: Math.max(0, Date.now() - startedAt), error: errorText(error),
    };
    await commit(investigation, "record_run", { run }, `${commandId}:run-error`);
    throw error;
  }
}

function packetFor(project) {
  const hypothesis = [...project.nodes].reverse().find((node) => node.type === "hypothesis");
  if (!hypothesis) throw new Error("Elephant did not commit a hypothesis; isolated review was skipped");
  const allowedTypes = new Set(["evidence", "contradiction", "gap"]);
  const artifacts = project.nodes.filter((node) => allowedTypes.has(node.type)).slice(0, 20);
  const papers = new Map(project.nodes.filter((node) => node.type === "paper" && typeof node.data.abstract === "string").map((node) => [node.id, node]));
  const referenced = [];
  for (const node of [hypothesis, ...artifacts]) {
    if (typeof node.data.paperId === "string") referenced.push(node.data.paperId);
    for (const id of node.sourceRefs || []) referenced.push(id);
  }
  const ordered = [...new Set([...referenced, ...papers.keys()])];
  const abstracts = [];
  let budget = 48000;
  for (const id of ordered) {
    const paper = papers.get(id);
    if (!paper || abstracts.length >= 6) continue;
    const item = { paperId: id, title: paper.title, abstract: paper.data.abstract };
    const size = JSON.stringify(item).length;
    if (size > budget) continue;
    abstracts.push(item);
    budget -= size;
  }
  const cleanNode = (node) => ({ id: node.id, type: node.type, title: node.title, sourceRefs: node.sourceRefs, data: node.data });
  return {
    packet: { hypothesis: cleanNode(hypothesis), artifacts: artifacts.map(cleanNode), abstracts },
    hypothesisId: hypothesis.id,
    artifactIds: new Set([hypothesis.id, ...artifacts.map((node) => node.id), ...abstracts.map((paper) => paper.paperId)]),
  };
}

function jsonCandidates(text) {
  const candidates = [];
  const trimmed = text.trim();
  if (trimmed) candidates.push(trimmed);
  for (const match of trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) candidates.push(match[1].trim());
  const stack = [];
  let inString = false;
  let escaped = false;
  for (let index = 0; index < trimmed.length; index += 1) {
    const character = trimmed[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") stack.push(index);
    else if (character === "}" && stack.length) {
      const start = stack.pop();
      if (!stack.length) candidates.push(trimmed.slice(start, index + 1));
    }
  }
  return candidates;
}

function parseReview(text, artifactIds) {
  let parsed;
  let lastError;
  for (const candidate of jsonCandidates(text)) {
    try {
      const value = JSON.parse(candidate);
      if (value && typeof value === "object" && !Array.isArray(value) && Array.isArray(value.findings)) {
        parsed = value;
        break;
      }
    } catch (error) { lastError = error; }
  }
  if (!parsed) {
    return {
      findings: [], verdict: "Unparseable reviewer response", rawResponse: text,
      parseError: `Reviewer did not return the required JSON object${lastError ? `: ${errorText(lastError)}` : ""}`,
    };
  }
  const findings = parsed.findings.slice(0, 20).map((finding) => {
    const value = finding && typeof finding === "object" ? finding : { finding: String(finding) };
    return {
      claim: String(value.claim || value.finding || "Reviewer concern").slice(0, 2000),
      rationale: String(value.reason || value.rationale || value.finding || "No rationale supplied").slice(0, 4000),
      severity: String(value.severity || "medium"),
      status: String(value.status || "concern"),
      sourceNodeIds: [...new Set((value.artifactIds || value.sourceNodeIds || []).filter((id) => artifactIds.has(id)))],
    };
  });
  const summary = String(parsed.summary || "No summary supplied").slice(0, 4000);
  const confidence = ["low", "medium", "high"].includes(parsed.confidence) ? ` Confidence: ${parsed.confidence}.` : "";
  return { findings, verdict: `${summary}${confidence}`, rawResponse: text };
}

async function runReviewer(investigation, definition, packetText) {
  const commandId = `${investigation.runId}:review:${definition.reviewer}`;
  const sessionKey = await createSession(investigation, definition.agentId, definition.reviewer);
  const message = `Review only this bounded packet. Return one JSON object matching your instructions; no tools or other context.\n${packetText}`;
  const result = await callTurn(investigation, {
    agentId: definition.agentId, sessionKey, kind: `review-${definition.reviewer}`, commandId, message,
  });
  return { ...definition, sessionKey, text: result.text, runId: result.runId };
}

async function runReviews(investigation, project) {
  const bounded = packetFor(project);
  const packetText = JSON.stringify(bounded.packet);
  const outgoing = reviewers.map((definition) => runReviewer(investigation, definition, packetText));
  const settled = await Promise.allSettled(outgoing);
  assertActive(investigation);
  const nodes = settled.map((outcome, index) => {
    const definition = reviewers[index];
    const base = {
      hypothesisId: bounded.hypothesisId, reviewer: definition.reviewer,
      packetSha256: sha256(packetText),
    };
    if (outcome.status === "rejected") {
      emitError(investigation, `${definition.agentId} failed: ${errorText(outcome.reason)}`);
      return {
        id: `review:${investigation.runId}:${definition.reviewer}`,
        type: "review", title: `Goldfish ${definition.reviewer} — failed`, sourceRefs: [bounded.hypothesisId],
        data: { ...base, runId: `${investigation.runId}:${definition.reviewer}`, findings: [], verdict: "Review failed", rawResponse: "", parseError: errorText(outcome.reason) },
      };
    }
    const result = outcome.value;
    const parsed = parseReview(result.text, bounded.artifactIds);
    return {
      id: `review:${investigation.runId}:${definition.reviewer}`,
      type: "review", title: `Goldfish ${definition.reviewer}`, sourceRefs: [bounded.hypothesisId],
      data: { ...base, runId: result.runId, sessionKey: result.sessionKey, ...parsed },
    };
  });
  const reviewProject = await commit(investigation, "upsert_nodes", {
    nodes,
    edges: nodes.map((node) => ({ id: `edge:${node.id}`, source: node.id, target: bounded.hypothesisId, type: "reviews", label: `Reviews ${definitionLabel(node.data.reviewer)}` })),
  }, `${investigation.runId}:review-nodes`);
  await commit(investigation, "set_blocks", {
    blocks: [{ id: `review:${investigation.runId}`, kind: "review", title: "Independent Goldfish reviews", nodeIds: nodes.map((node) => node.id) }],
  }, `${investigation.runId}:review-block`);
  return { reviewProject, bounded, reviewNodes: nodes };
}

function definitionLabel(reviewer) { return `Goldfish ${reviewer}`; }

async function markFailure(investigation, error) {
  investigation.status = "error";
  investigation.endedAt = Date.now();
  const message = errorText(error);
  let project = null;
  try {
    project = await commit(investigation, "set_status", { status: "error", message }, `${investigation.runId}:fatal`);
  } catch (statusError) {
    emitError(investigation, `${message}; could not record terminal state: ${errorText(statusError)}`);
  }
  emitError(investigation, message, project);
  emitRun(investigation, "error");
}

async function investigate(investigation, curiosity) {
  try {
    assertActive(investigation);
    await callTurn(investigation, {
      agentId: investigation.agentId, sessionKey: investigation.sessionKey, kind: "literature-analysis",
      commandId: `${investigation.runId}:elephant-literature`,
      message: `FIRST TURN — literature and hypothesis only. Curiosity: ${curiosity}\nFollow your first-turn workflow: retrieve at most 6 real papers with concise scientific keywords, preserve source failures, read fresh canonical state, and commit exact evidence, genuine contradictions if any, gaps, and one hypothesis. Do not create reviews, experiments, labs, results, or ready status.`,
    });
    assertActive(investigation);
    const fresh = await readProject(investigation.root);
    if (!fresh) throw new Error("Canonical project disappeared after the literature turn");
    const { bounded, reviewNodes } = await runReviews(investigation, fresh);
    const synthesisPacket = {
      ...bounded.packet,
      reviews: reviewNodes.map((node) => ({
        id: node.id, reviewer: node.data.reviewer, verdict: node.data.verdict,
        findings: node.data.findings, parseError: node.data.parseError,
      })),
    };
    await callTurn(investigation, {
      agentId: investigation.agentId, sessionKey: investigation.sessionKey, kind: "protocol-synthesis",
      commandId: `${investigation.runId}:elephant-synthesis`,
      message: `SECOND TURN — bounded synthesis after three fresh reviews. Read fresh canonical state, then commit one measurable experiment with frozen expected outcomes, honest lab candidates and an outreach draft, followed by ready status. Expected outcomes are predictions; no experiment has been run. Packet:\n${JSON.stringify(synthesisPacket)}`,
    });
    assertActive(investigation);
    const completed = await readProject(investigation.root);
    if (!completed?.nodes.some((node) => node.type === "experiment" && Array.isArray(node.data.protocol) && Array.isArray(node.data.expectedOutcomes))) {
      throw new Error("Elephant did not commit an experiment with a protocol and frozen expected outcomes");
    }
    if (completed.status !== "ready") {
      await commit(investigation, "set_status", { status: "ready", message: "Literature, independent reviews, and experiment synthesis completed" }, `${investigation.runId}:ready`);
    }
    investigation.status = "completed";
    investigation.endedAt = Date.now();
    emitRun(investigation, "completed");
  } catch (error) {
    await markFailure(investigation, error);
    throw error;
  }
}

export async function startInvestigation(curiosity) {
  if (typeof curiosity !== "string" || !curiosity.trim()) throw new Error("Curiosity must be a non-empty string");
  const cleanCuriosity = curiosity.trim();
  const root = process.env.OPEN_RESEARCH_ROOT || process.cwd();
  const runId = randomUUID();
  const sessionKey = `research-${runId}`;
  const investigation = {
    root, runId, sessionKey, agentId: process.env.RESEARCH_AGENT_ID || "research",
    status: "connecting", startedAt: Date.now(), revision: 0,
    sessionKeys: new Set([sessionKey]), stopping: false, commitQueue: Promise.resolve(),
  };
  investigations.set(sessionKey, investigation);
  emitRun(investigation, "connecting");
  try {
    const created = await executeResearchCommand(root, {
      op: "create", commandId: `create:${runId}`, curiosity: cleanCuriosity,
      title: cleanCuriosity.slice(0, 160), sessionKey,
    });
    emitSnapshot(investigation, created);
    const actualKey = await createSession(investigation, investigation.agentId, "elephant", sessionKey);
    if (actualKey !== sessionKey) {
      investigations.delete(sessionKey);
      investigation.sessionKey = actualKey;
      investigations.set(actualKey, investigation);
      await commit(investigation, "initialize", { sessionKey: actualKey }, `${runId}:bind-session`);
    }
  } catch (error) {
    await markFailure(investigation, error);
    throw error;
  }
  const completion = investigate(investigation, cleanCuriosity);
  completion.catch(() => {});
  return { sessionKey: investigation.sessionKey, runId, completion };
}

export async function stopInvestigation(sessionKey, runId) {
  const investigation = investigations.get(sessionKey) || [...investigations.values()].find((item) => item.sessionKey === sessionKey || item.sessionKeys.has(sessionKey));
  if (!investigation || (runId && investigation.runId !== runId) || ["completed", "error"].includes(investigation.status)) return;
  investigation.stopping = true;
  investigation.status = "error";
  const gateway = await getGateway();
  const outcomes = await Promise.allSettled([...investigation.sessionKeys].map((key) =>
    gateway.request("chat.abort", { sessionKey: key })
  ));
  const failures = outcomes.filter((outcome) => outcome.status === "rejected");
  if (failures.length === outcomes.length && failures.length) throw new AggregateError(failures.map((failure) => failure.reason), "Could not abort any investigation session");
  emitRun(investigation, "error");
}
