import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { executeResearchCommand, readProject, sha256 } from "../plugins/research-engine/engine.mjs";
import { createHarnessAdapter } from "./harnesses/harness-adapter.mjs";
import { readRuntimeConfig } from "./runtime-config.mjs";

const emitter = new EventEmitter();
emitter.setMaxListeners(100);
const investigations = new Map();
const reviewers = [
  { reviewer: "auditor", agentId: "research-auditor", label: "Evidence Auditor" },
  { reviewer: "critic", agentId: "research-critic", label: "Methodology Critic" },
  { reviewer: "feasibility", agentId: "research-feasibility", label: "Feasibility Reviewer" },
];

const errorText = (error) => String(error?.message || error || "Unknown research error").slice(0, 2000);
const finiteUsage = (value) => value === undefined || value === null || value === ""
  ? undefined
  : Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : undefined;

export function runtimeEvents() { return emitter; }

function telemetry(investigation, status = investigation.status) {
  const elapsedMs = Math.max(0, (investigation.endedAt || Date.now()) - investigation.startedAt);
  const result = {
    sessionKey: investigation.sessionKey,
    projectId: investigation.projectId,
    stage: investigation.stage,
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

export function activeProjectIds() {
  return new Set(
    [...investigations.values()]
      .filter((investigation) => ["connecting", "running"].includes(investigation.status))
      .map((investigation) => investigation.projectId)
      .filter(Boolean),
  );
}

function emitRun(investigation, status = investigation.status) {
  emitter.emit("update", {
    type: "run",
    project: null,
    projectId: investigation.projectId,
    revision: investigation.revision,
    runId: investigation.runId,
    stage: investigation.stage,
    status,
    telemetry: telemetry(investigation, status),
  });
}

function emitStage(investigation, stage) {
  investigation.stage = stage;
  emitter.emit("update", {
    type: "stage",
    project: null,
    projectId: investigation.projectId,
    revision: investigation.revision,
    runId: investigation.runId,
    stage,
    status: investigation.status,
    telemetry: telemetry(investigation),
  });
}

function emitSnapshot(investigation, project) {
  investigation.revision = project.revision;
  investigation.projectId = project.projectId;
  emitter.emit("update", {
    type: "snapshot",
    project,
    projectId: project.projectId,
    revision: project.revision,
    runId: investigation.runId,
    stage: investigation.stage,
    status: investigation.status,
    telemetry: telemetry(investigation),
  });
}

function emitError(investigation, message, project = null) {
  emitter.emit("update", {
    type: "error",
    project,
    projectId: investigation.projectId,
    revision: investigation.revision,
    runId: investigation.runId,
    stage: investigation.stage,
    status: investigation.status,
    message,
    telemetry: telemetry(investigation),
  });
}

async function commit(investigation, op, payload, commandId) {
  const operation = investigation.commitQueue.then(async () => {
    const current = await readProject(investigation.root, investigation.projectId);
    if (!current) throw new Error("The investigation canonical state is missing");
    return executeResearchCommand(investigation.root, {
      projectId: current.projectId,
      commandId,
      baseRevision: current.revision,
      op,
      payload,
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

function accumulateUsage(investigation, usage) {
  const input = finiteUsage(usage?.inputTokens ?? usage?.input_tokens ?? usage?.promptTokens ?? usage?.prompt_tokens);
  const output = finiteUsage(usage?.outputTokens ?? usage?.output_tokens ?? usage?.completionTokens ?? usage?.completion_tokens);
  if (input !== undefined) investigation.inputTokens = (investigation.inputTokens || 0) + input;
  if (output !== undefined) investigation.outputTokens = (investigation.outputTokens || 0) + output;
  return { inputTokens: input, outputTokens: output };
}

async function createSession(investigation, agentId, label, requestedKey, model) {
  const sessionKey = await investigation.harness.createSession({ agentId, label, requestedKey, model });
  investigation.sessionKeys.add(sessionKey);
  return sessionKey;
}

async function callTurn(investigation, { agentId, sessionKey, kind, commandId, message, model }) {
  assertActive(investigation);
  const startedAt = Date.now();
  const effectiveModel = model || investigation.model;
  investigation.status = "running";
  emitRun(investigation, "running");
  try {
    const result = await investigation.harness.sendTurn({
      sessionKey,
      agentId,
      projectId: investigation.projectId,
      message,
      idempotencyKey: commandId,
      signal: investigation.abortController.signal,
      onRetry({ attempt, maxRetries, delayMs }) {
        emitError(investigation, `${agentId} was rate limited; retry ${attempt}/${maxRetries} in ${Math.round(delayMs / 100) / 10}s with the same idempotency key`);
      },
      onTool(toolName) {
        const labels = {
          research_literature_search: "Querying peer-reviewed literature APIs",
          research_find_labs: "Discovering real research facilities via OpenAlex",
          research_project_read: "Inspecting canonical research state",
          research_project_commit: "Committing grounded research artifacts",
        };
        if (labels[toolName]) emitStage(investigation, labels[toolName]);
      },
      onDelta(delta, payload) {
        if (!delta) return;
        emitter.emit("update", {
          type: "delta",
          project: null,
          projectId: investigation.projectId,
          revision: investigation.revision,
          delta,
          stage: investigation.stage,
          runId: payload?.runId || commandId,
          status: "running",
          telemetry: telemetry(investigation, "running"),
        });
      },
    });
    assertActive(investigation);
    const tokens = accumulateUsage(investigation, result.usage);
    const endedAt = new Date().toISOString();
    const run = {
      id: result.runId,
      kind,
      agentId,
      model: effectiveModel,
      status: "completed",
      startedAt: new Date(startedAt).toISOString(),
      endedAt,
      durationMs: Math.max(0, result.durationMs),
      ...tokens,
    };
    await commit(investigation, "record_run", { run }, `${commandId}:run`);
    emitRun(investigation, "running");
    return result;
  } catch (error) {
    const run = {
      id: commandId,
      kind,
      agentId,
      model: effectiveModel,
      status: "error",
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date().toISOString(),
      durationMs: Math.max(0, Date.now() - startedAt),
      error: errorText(error),
    };
    await commit(investigation, "record_run", { run }, `${commandId}:run-error`).catch(() => {});
    throw error;
  }
}

function packetFor(project) {
  const hypothesis = [...project.nodes].reverse().find((node) => node.type === "hypothesis");
  if (!hypothesis) throw new Error("No hypothesis has been committed yet; Independent Review Panel was skipped");
  const allowedTypes = new Set(["evidence", "contradiction", "gap"]);
  const artifacts = project.nodes.filter((node) => allowedTypes.has(node.type) && node.data.verificationStatus !== "rejected").slice(0, 20);
  const papers = new Map(project.nodes.filter((node) => node.type === "paper" && typeof node.data.abstract === "string").map((node) => [node.id, node]));
  const referenced = [];
  for (const node of [hypothesis, ...artifacts]) {
    if (typeof node.data.paperId === "string") referenced.push(node.data.paperId);
    for (const refId of node.sourceRefs || []) referenced.push(refId);
  }
  const ordered = [...new Set([...referenced, ...papers.keys()])];
  const abstracts = [];
  let budget = 48000;
  for (const paperId of ordered) {
    const paper = papers.get(paperId);
    if (!paper || abstracts.length >= 6) continue;
    const item = { paperId, title: paper.title, abstract: paper.data.abstract };
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
  const trimmed = String(text || "").trim();
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
      findings: [],
      verdict: "Unparseable reviewer response",
      rawResponse: text,
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
      sourceNodeIds: [...new Set((value.artifactIds || value.sourceNodeIds || []).filter((refId) => artifactIds.has(refId)))],
    };
  });
  const summary = String(parsed.summary || "No summary supplied").slice(0, 4000);
  const confidence = ["low", "medium", "high"].includes(parsed.confidence) ? ` Confidence: ${parsed.confidence}.` : "";
  return { findings, verdict: `${summary}${confidence}`, rawResponse: text };
}

async function runReviewer(investigation, definition, packetText) {
  const commandId = `${investigation.runId}:review:${definition.reviewer}`;
  const sessionKey = await createSession(investigation, definition.agentId, definition.reviewer, undefined, investigation.reviewerModel);
  const message = `Review only this bounded packet. Return one JSON object matching your instructions; no tools or other context.\n${packetText}`;
  const result = await callTurn(investigation, {
    agentId: definition.agentId,
    sessionKey,
    kind: `review-${definition.reviewer}`,
    commandId,
    message,
    model: investigation.reviewerModel,
  });
  return { ...definition, sessionKey, text: result.text, runId: result.runId };
}

async function runReviews(investigation, project) {
  emitStage(investigation, "Running Independent Review Panel (3 isolated reviewers in parallel)");
  const bounded = packetFor(project);
  const packetText = JSON.stringify(bounded.packet);
  const outgoing = reviewers.map((definition) => runReviewer(investigation, definition, packetText));
  const settled = await Promise.allSettled(outgoing);
  assertActive(investigation);
  const nodes = settled.map((outcome, index) => {
    const definition = reviewers[index];
    const base = {
      hypothesisId: bounded.hypothesisId,
      reviewer: definition.reviewer,
      packetSha256: sha256(packetText),
    };
    if (outcome.status === "rejected") {
      emitError(investigation, `${definition.label} failed: ${errorText(outcome.reason)}`);
      return {
        id: `review:${investigation.runId}:${definition.reviewer}`,
        type: "review",
        title: `${definition.label} — failed`,
        sourceRefs: [bounded.hypothesisId],
        data: {
          ...base,
          runId: `${investigation.runId}:${definition.reviewer}`,
          findings: [],
          verdict: "Review failed",
          rawResponse: "",
          parseError: errorText(outcome.reason),
        },
      };
    }
    const result = outcome.value;
    const parsed = parseReview(result.text, bounded.artifactIds);
    return {
      id: `review:${investigation.runId}:${definition.reviewer}`,
      type: "review",
      title: definition.label,
      sourceRefs: [bounded.hypothesisId],
      data: { ...base, runId: result.runId, sessionKey: result.sessionKey, ...parsed },
    };
  });
  const reviewProject = await commit(investigation, "upsert_nodes", {
    nodes,
    edges: nodes.map((node) => ({
      id: `edge:${node.id}`,
      source: node.id,
      target: bounded.hypothesisId,
      type: "reviews",
      label: `Reviews (${node.title})`,
    })),
  }, `${investigation.runId}:review-nodes`);
  await commit(investigation, "set_blocks", {
    blocks: [{ id: `review:${investigation.runId}`, kind: "review", title: "Independent Review Panel", nodeIds: nodes.map((node) => node.id) }],
  }, `${investigation.runId}:review-block`);
  return { reviewProject, bounded, reviewNodes: nodes };
}

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

async function runAutonomousArc(investigation, curiosity) {
  try {
    assertActive(investigation);
    emitStage(investigation, "Searching peer-reviewed literature & extracting grounded evidence");
    const firstTurn = await callTurn(investigation, {
      agentId: investigation.agentId,
      sessionKey: investigation.sessionKey,
      kind: "literature-analysis",
      commandId: `${investigation.runId}:elephant-literature`,
      message: `FIRST TURN — literature and hypothesis only. Curiosity: ${curiosity}\nFollow your first-turn workflow: retrieve at most 6 real papers with concise scientific keywords, preserve source failures, read fresh canonical state, and commit exact evidence, genuine contradictions if any, gaps, and one testable hypothesis. Do not create reviews, experiments, labs, results, or ready status. Write a sharp, readable synthesis explaining what the literature actually shows and where the real gap sits.`,
    });
    if (firstTurn.text) {
      await commit(investigation, "append_message", {
        role: "assistant",
        content: firstTurn.text,
        stage: "literature",
        runId: firstTurn.runId,
      }, `${investigation.runId}:msg-turn1`);
    }
    assertActive(investigation);
    const fresh = await readProject(investigation.root, investigation.projectId);
    if (!fresh) throw new Error("Canonical project disappeared after the literature turn");

    const { bounded, reviewNodes } = await runReviews(investigation, fresh);
    emitStage(investigation, "Synthesizing validation protocol, code/survey/facility plan & frozen expectations");
    const synthesisPacket = {
      ...bounded.packet,
      reviews: reviewNodes.map((node) => ({
        id: node.id,
        reviewer: node.data.reviewer,
        verdict: node.data.verdict,
        findings: node.data.findings,
        parseError: node.data.parseError,
      })),
    };
    const secondTurn = await callTurn(investigation, {
      agentId: investigation.agentId,
      sessionKey: investigation.sessionKey,
      kind: "protocol-synthesis",
      commandId: `${investigation.runId}:elephant-synthesis`,
      message: `SECOND TURN — bounded synthesis after Independent Review Panel. Read fresh canonical state. If the test requires physical/wet-lab/hardware facilities, call research_find_labs first to discover real OpenAlex institutions rather than guessing labs. Commit one measurable experiment tailored to the appropriate modality (computational with runnable Python/JS code, human survey with structured questions & channels, or physical/wet-lab with protocol & real facility candidates), frozen expectedOutcomes, and outreachDraft when relevant, followed by ready status. Expected outcomes are frozen predictions; no experiment has been run. Packet:\n${JSON.stringify(synthesisPacket)}`,
    });
    if (secondTurn.text) {
      await commit(investigation, "append_message", {
        role: "assistant",
        content: secondTurn.text,
        stage: "experiment",
        runId: secondTurn.runId,
      }, `${investigation.runId}:msg-turn2`);
    }
    assertActive(investigation);
    const completed = await readProject(investigation.root, investigation.projectId);
    if (!completed?.nodes.some((node) => node.type === "experiment" && Array.isArray(node.data.protocol) && Array.isArray(node.data.expectedOutcomes))) {
      throw new Error("Research Orchestrator did not commit an experiment with a protocol and frozen expected outcomes");
    }
    if (completed.status !== "ready") {
      await commit(investigation, "set_status", { status: "ready", message: "Literature, independent reviews, and validation plan completed" }, `${investigation.runId}:ready`);
    }
    investigation.status = "completed";
    investigation.stage = "Completed";
    investigation.endedAt = Date.now();
    emitRun(investigation, "completed");
  } catch (error) {
    await markFailure(investigation, error);
    throw error;
  }
}

async function runGuidedTurn(investigation, promptText, stageName = "Literature & Research Dialogue") {
  try {
    assertActive(investigation);
    emitStage(investigation, stageName);
    const turn = await callTurn(investigation, {
      agentId: investigation.agentId,
      sessionKey: investigation.sessionKey,
      kind: "guided-dialogue",
      commandId: `${investigation.runId}:guided`,
      message: promptText,
    });
    if (turn.text) {
      await commit(investigation, "append_message", {
        role: "assistant",
        content: turn.text,
        stage: stageName,
        runId: turn.runId,
      }, `${investigation.runId}:msg-assistant`);
    }
    await commit(investigation, "set_status", { status: "ready", message: `${stageName} updated` }, `${investigation.runId}:ready`);
    investigation.status = "completed";
    investigation.stage = "Ready for next turn";
    investigation.endedAt = Date.now();
    emitRun(investigation, "completed");
  } catch (error) {
    await markFailure(investigation, error);
    throw error;
  }
}

async function buildInvestigationContext(root, { projectId, sessionKey, runId }) {
  const runtimeConfig = await readRuntimeConfig(root);
  const harness = createHarnessAdapter(runtimeConfig, root);
  const model = runtimeConfig.orchestrator.model;
  const reviewerModel = runtimeConfig.reviewers.model;
  const investigation = {
    root,
    projectId,
    runId,
    sessionKey,
    agentId: process.env.RESEARCH_AGENT_ID || "research",
    model,
    reviewerModel,
    harness,
    stage: "Connecting",
    status: "connecting",
    startedAt: Date.now(),
    revision: 0,
    sessionKeys: new Set([sessionKey]),
    stopping: false,
    abortController: new AbortController(),
    commitQueue: Promise.resolve(),
  };
  investigations.set(sessionKey, investigation);
  return investigation;
}

export async function startInvestigation(curiosity, options = {}) {
  if (typeof curiosity !== "string" || !curiosity.trim()) throw new Error("Curiosity must be a non-empty string");
  const cleanCuriosity = curiosity.trim();
  const mode = options.mode === "guided" ? "guided" : "autonomous";
  const root = options.root || process.env.OPEN_RESEARCH_ROOT || process.cwd();
  const runId = randomUUID();
  const sessionKey = `research-${runId}`;
  const investigation = await buildInvestigationContext(root, { projectId: options.projectId, sessionKey, runId });
  emitRun(investigation, "connecting");
  try {
    const created = await executeResearchCommand(root, {
      op: "create",
      commandId: `create:${runId}`,
      curiosity: cleanCuriosity,
      title: cleanCuriosity.slice(0, 160),
      mode,
      sessionKey,
    });
    investigation.projectId = created.projectId;
    emitSnapshot(investigation, created);
    const actualKey = await createSession(investigation, investigation.agentId, "orchestrator", sessionKey, investigation.model);
    if (actualKey !== sessionKey) {
      investigations.delete(sessionKey);
      investigation.sessionKey = actualKey;
      investigations.set(actualKey, investigation);
      await commit(investigation, "initialize", { sessionKey: actualKey, mode }, `${runId}:bind-session`);
    }
  } catch (error) {
    await markFailure(investigation, error);
    throw error;
  }

  const completion = mode === "guided"
    ? runGuidedTurn(
        investigation,
        `GUIDED RESEARCH TURN — Curiosity: ${cleanCuriosity}\nRead the project, search real peer-reviewed literature (up to 6 papers), preserve any source failures, and commit exact unverified evidence quotes, genuine contradictions, research gaps, and a clear initial testable hypothesis when supported. Write a sharp, readable explanation grounded in the papers (never bloated jargon), highlighting why the current approach works or falls short and suggesting 2 concrete directions the researcher can explore next. Do not run reviews or fabricate experiments yet.`,
        "Exploring peer-reviewed literature",
      )
    : runAutonomousArc(investigation, cleanCuriosity);

  completion.catch(() => {});
  return { projectId: investigation.projectId, sessionKey: investigation.sessionKey, runId, completion };
}

export async function continueInvestigation(projectId, userMessage, options = {}) {
  if (typeof userMessage !== "string" || !userMessage.trim()) throw new Error("Follow-up message must not be empty");
  const root = options.root || process.env.OPEN_RESEARCH_ROOT || process.cwd();
  const current = await readProject(root, projectId);
  if (!current) throw new Error("Investigation not found");
  const runId = randomUUID();
  const requestedKey = current.sessionKey || `research-${current.projectId}`;
  const investigation = await buildInvestigationContext(root, { projectId: current.projectId, sessionKey: requestedKey, runId });
  investigation.revision = current.revision;
  emitRun(investigation, "connecting");

  await commit(investigation, "append_message", {
    role: "user",
    content: userMessage.trim(),
    stage: "follow-up",
    runId,
  }, `${runId}:msg-user`);
  await commit(investigation, "set_status", { status: "investigating", message: "Continuing research dialogue" }, `${runId}:investigating`);

  const sessionKey = await createSession(investigation, investigation.agentId, "orchestrator", requestedKey, investigation.model);
  if (sessionKey !== current.sessionKey) {
    investigation.sessionKey = sessionKey;
    investigations.set(sessionKey, investigation);
    await commit(investigation, "initialize", { sessionKey }, `${runId}:rebind-session`);
  }

  const prompt = `FOLLOW-UP RESEARCH TURN — The researcher says:\n${userMessage.trim()}\n\nCall research_project_read first. If the researcher is asking a new angle or pushing back, run research_literature_search with focused scientific keywords (which appends a new literature block without overwriting prior blocks). Commit any new exact evidence quotes, updated contradictions/gaps, refined hypothesis, or experiment/lab plans via research_project_commit. Reply concisely and clearly, citing the real retrieved papers.`;
  const completion = runGuidedTurn(investigation, prompt, "Continuing literature & analysis");
  completion.catch(() => {});
  return { projectId: current.projectId, sessionKey: investigation.sessionKey, runId, completion };
}

export async function triggerReviewPanel(projectId, options = {}) {
  const root = options.root || process.env.OPEN_RESEARCH_ROOT || process.cwd();
  const current = await readProject(root, projectId);
  if (!current) throw new Error("Investigation not found");
  const runId = randomUUID();
  const sessionKey = current.sessionKey || `research-panel-${runId}`;
  const investigation = await buildInvestigationContext(root, { projectId: current.projectId, sessionKey, runId });
  investigation.revision = current.revision;
  emitRun(investigation, "running");

  const completion = (async () => {
    try {
      await commit(investigation, "set_status", { status: "investigating", message: "Running Independent Review Panel" }, `${runId}:panel-start`);
      const fresh = await readProject(root, current.projectId);
      await runReviews(investigation, fresh);
      await commit(investigation, "set_status", { status: "ready", message: "Independent Review Panel completed" }, `${runId}:panel-done`);
      investigation.status = "completed";
      investigation.stage = "Reviews complete";
      investigation.endedAt = Date.now();
      emitRun(investigation, "completed");
    } catch (error) {
      await markFailure(investigation, error);
      throw error;
    }
  })();
  completion.catch(() => {});
  return { projectId: current.projectId, sessionKey, runId, completion };
}

export async function triggerExperimentSynthesis(projectId, options = {}) {
  const root = options.root || process.env.OPEN_RESEARCH_ROOT || process.cwd();
  const current = await readProject(root, projectId);
  if (!current) throw new Error("Investigation not found");
  const runId = randomUUID();
  const requestedKey = current.sessionKey || `research-${current.projectId}`;
  const investigation = await buildInvestigationContext(root, { projectId: current.projectId, sessionKey: requestedKey, runId });
  investigation.revision = current.revision;
  emitRun(investigation, "connecting");
  await commit(investigation, "set_status", { status: "investigating", message: "Designing validation experiment" }, `${runId}:exp-start`);
  const sessionKey = await createSession(investigation, investigation.agentId, "orchestrator", requestedKey, investigation.model);
  const modalityHint = options.modality ? `Preferred testing modality: ${options.modality}.` : "Choose the modality that genuinely fits the hypothesis (computational, survey, wet-lab, hardware, or observational).";
  const prompt = `VALIDATION & EXPERIMENT DESIGN TURN — ${modalityHint}\nRead the canonical project (papers, evidence, hypothesis, and any Independent Review Panel findings). If physical/wet-lab/hardware testing is needed, call research_find_labs to discover real OpenAlex institutions. Commit an experiment node with: modality, objective, concrete protocol steps, variables, controls, sampleSizeRationale, statisticalPlan, safety, limitations, frozen expectedOutcomes ([{metric, prediction, rationale}]), plus:\n- For computational: codeExperiment ({language, filename, dependencies, code, runCommand, colabReady: true})\n- For survey: surveyDesign ({targetPopulation, targetSampleSize, estimatedMinutes, distributionChannels, questions})\n- For wet-lab/hardware: real OpenAlex lab nodes + outreachDraft ({subject, body}).\nSet status to ready.`;
  const completion = runGuidedTurn(investigation, prompt, "Synthesizing validation & testing plan");
  completion.catch(() => {});
  return { projectId: current.projectId, sessionKey, runId, completion };
}

export async function stopInvestigation(sessionKey, runId) {
  const investigation = investigations.get(sessionKey) || [...investigations.values()].find((item) => item.sessionKey === sessionKey || item.sessionKeys.has(sessionKey));
  if (!investigation || (runId && investigation.runId !== runId) || ["completed", "error"].includes(investigation.status)) return;
  investigation.stopping = true;
  investigation.status = "error";
  investigation.abortController.abort();
  const outcomes = await Promise.allSettled([...investigation.sessionKeys].map((key) =>
    investigation.harness.abortSession(key),
  ));
  const failures = outcomes.filter((outcome) => outcome.status === "rejected");
  if (failures.length === outcomes.length && failures.length) {
    throw new AggregateError(failures.map((failure) => failure.reason), "Could not abort any investigation session");
  }
  emitRun(investigation, "error");
}
