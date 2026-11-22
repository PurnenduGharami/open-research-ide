import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const PROJECT_FILENAME = "research-project.json";
const now = () => new Date().toISOString();
const id = () => randomUUID();
export const sha256 = (value) => createHash("sha256").update(value, "utf8").digest("hex");

const nodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["paper", "evidence", "contradiction", "gap", "hypothesis", "experiment", "result", "review", "lab"]),
  title: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  sourceRefs: z.array(z.string()).default([]),
  data: z.record(z.string(), z.unknown()).default({}),
}).strict();

export const projectSchema = z.object({
  schemaVersion: z.literal(1),
  projectId: z.string().min(1),
  revision: z.number().int().nonnegative(),
  title: z.string().min(1),
  curiosity: z.string().min(1),
  status: z.enum(["investigating", "ready", "error"]),
  privacy: z.literal("local-only"),
  sessionKey: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  nodes: z.array(nodeSchema),
  edges: z.array(z.object({
    id: z.string(), source: z.string(), target: z.string(),
    type: z.enum(["supports", "contradicts", "identifies", "addresses", "tests", "observed-in", "reviews", "conducted-at"]),
    label: z.string(),
  }).strict()),
  uiBlocks: z.array(z.object({
    id: z.string(), kind: z.enum(["literature", "analysis", "review", "experiment", "result"]),
    title: z.string(), nodeIds: z.array(z.string()), createdAt: z.string(),
  }).strict()),
  sources: z.array(z.object({
    id: z.string(), provider: z.string(), url: z.string(),
    status: z.enum(["ok", "partial", "error"]), queriedAt: z.string(), error: z.string().optional(),
  }).strict()),
  runs: z.array(z.object({
    id: z.string(), kind: z.string(), agentId: z.string(), model: z.string(),
    status: z.enum(["running", "completed", "error"]), startedAt: z.string(), endedAt: z.string().optional(),
    durationMs: z.number().nonnegative().optional(), inputTokens: z.number().nonnegative().optional(),
    outputTokens: z.number().nonnegative().optional(), outputTps: z.number().nonnegative().optional(), error: z.string().optional(),
  }).strict()),
  timeline: z.array(z.object({ id: z.string(), at: z.string(), kind: z.string(), message: z.string(), nodeIds: z.array(z.string()).default([]) }).strict()),
  assets: z.array(z.object({ id: z.string(), label: z.string(), kind: z.string(), path: z.string(), sha256: z.string(), createdAt: z.string() }).strict()),
  exports: z.array(z.object({ id: z.string(), revision: z.number().int(), format: z.enum(["html", "pdf", "latex"]), path: z.string(), sha256: z.string(), createdAt: z.string() }).strict()),
  commandIds: z.array(z.string()),
}).strict();

export function emptyProject(curiosity, title = "Untitled investigation") {
  const at = now();
  return projectSchema.parse({
    schemaVersion: 1, projectId: id(), revision: 0, title, curiosity,
    status: "investigating", privacy: "local-only", createdAt: at, updatedAt: at,
    nodes: [], edges: [], uiBlocks: [], sources: [], runs: [], timeline: [], assets: [], exports: [], commandIds: [],
  });
}

export function projectPath(root) {
  return path.join(root, "workspace", PROJECT_FILENAME);
}

export async function readProject(root) {
  try {
    return projectSchema.parse(JSON.parse(await readFile(projectPath(root), "utf8")));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function cleanNode(raw, at) {
  const createdAt = raw.createdAt || at;
  const data = { ...(raw.data || {}) };
  if (raw.type === "evidence") data.verified = false;
  return nodeSchema.parse({
    id: raw.id || id(), type: raw.type, title: String(raw.title || "Untitled").slice(0, 500),
    createdAt, updatedAt: at, sourceRefs: raw.sourceRefs || [], data,
  });
}

function validateGraph(project) {
  const ids = new Set(project.nodes.map((node) => node.id));
  if (ids.size !== project.nodes.length) throw new Error("Duplicate research node ID");
  for (const edge of project.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) throw new Error(`Edge ${edge.id} references a missing node`);
  }
  for (const block of project.uiBlocks) {
    if (block.nodeIds.some((nodeId) => !ids.has(nodeId))) throw new Error(`Block ${block.id} references a missing node`);
  }
  const papers = new Map(project.nodes.filter((node) => node.type === "paper").map((node) => [node.id, node]));
  for (const evidence of project.nodes.filter((node) => node.type === "evidence")) {
    const paper = papers.get(evidence.data.paperId);
    const quote = evidence.data.quote;
    if (!paper || typeof quote !== "string" || typeof paper.data.abstract !== "string" || !paper.data.abstract.includes(quote)) {
      throw new Error(`Evidence ${evidence.id} is not an exact substring of its paper abstract`);
    }
    evidence.data.quoteSha256 = sha256(quote);
    evidence.data.abstractSha256 = sha256(paper.data.abstract);
  }
}

function event(project, kind, message, nodeIds = []) {
  project.timeline.push({ id: id(), at: now(), kind, message, nodeIds });
}

function apply(project, op, payload) {
  const at = now();
  switch (op) {
    case "initialize":
      project.title = payload.title || project.title;
      project.sessionKey = payload.sessionKey;
      event(project, "investigation", "Investigation opened");
      break;
    case "upsert_nodes": {
      const incoming = (payload.nodes || []).map((node) => cleanNode(node, at));
      const byId = new Map(project.nodes.map((node) => [node.id, node]));
      for (const node of incoming) {
        if (node.type === "result") throw new Error("Results must use import_result");
        const previous = byId.get(node.id);
        if (previous?.type === "paper" && node.type === "paper" && previous.data.abstract !== undefined && previous.data.abstract !== node.data.abstract) {
          throw new Error(`Paper ${node.id} cannot replace its immutable abstract snapshot`);
        }
        if (previous?.type === "evidence" && node.type === "evidence") {
          if (previous.data.paperId !== node.data.paperId || previous.data.quote !== node.data.quote) {
            throw new Error(`Evidence ${node.id} cannot replace its paper or quote`);
          }
          node.data.verified = previous.data.verified === true;
          node.createdAt = previous.createdAt;
        }
        if (previous?.type === "experiment" && node.type === "experiment" && previous.data.expectedOutcomesFrozenAt) {
          if (node.data.expectedOutcomes !== undefined && JSON.stringify(node.data.expectedOutcomes) !== JSON.stringify(previous.data.expectedOutcomes)) {
            throw new Error(`Experiment ${node.id} cannot overwrite frozen expected outcomes`);
          }
          node.data.expectedOutcomes = previous.data.expectedOutcomes;
          node.data.expectedOutcomesFrozenAt = previous.data.expectedOutcomesFrozenAt;
        }
        if (node.type === "experiment" && node.data.expectedOutcomes !== undefined) {
          node.data.expectedOutcomesFrozenAt = previous?.data?.expectedOutcomesFrozenAt || at;
        }
        byId.set(node.id, node);
      }
      project.nodes = [...byId.values()];
      const edges = (payload.edges || []).map((edge) => ({ ...edge, id: edge.id || id() }));
      const edgeKeys = new Set(project.edges.map((edge) => `${edge.source}:${edge.type}:${edge.target}`));
      for (const edge of edges) {
        const key = `${edge.source}:${edge.type}:${edge.target}`;
        if (!edgeKeys.has(key)) { project.edges.push(edge); edgeKeys.add(key); }
      }
      if (incoming.length) event(project, "artifact", `${incoming.length} research ${incoming.length === 1 ? "artifact" : "artifacts"} added`, incoming.map((node) => node.id));
      break;
    }
    case "set_blocks": {
      const existing = new Map(project.uiBlocks.map((block) => [block.id, block]));
      for (const raw of payload.blocks || []) {
        const blockId = raw.id || id();
        existing.set(blockId, { ...raw, id: blockId, createdAt: raw.createdAt || at });
      }
      project.uiBlocks = [...existing.values()];
      break;
    }
    case "record_sources":
      for (const source of payload.sources || []) {
        const index = project.sources.findIndex((item) => item.id === source.id);
        const normalized = { ...source, queriedAt: source.queriedAt || at };
        if (index >= 0) project.sources[index] = normalized; else project.sources.push(normalized);
      }
      break;
    case "confirm_evidence": {
      const evidence = project.nodes.find((node) => node.id === payload.nodeId && node.type === "evidence");
      if (!evidence) throw new Error("Evidence node not found");
      evidence.data.verified = true;
      evidence.updatedAt = at;
      event(project, "confirmation", "Evidence confirmed by researcher", [evidence.id]);
      break;
    }
    case "import_result": {
      const experiment = project.nodes.find((node) => node.id === payload.experimentId && node.type === "experiment");
      if (!experiment) throw new Error("Experiment not found");
      const result = cleanNode({ ...payload.result, type: "result" }, at);
      result.data = { ...result.data, experimentId: experiment.id, observations: payload.observations };
      project.nodes.push(result);
      project.edges.push({ id: id(), source: experiment.id, target: result.id, type: "observed-in", label: "Observed result" });
      project.uiBlocks.push({ id: id(), kind: "result", title: "Imported observations", nodeIds: [result.id], createdAt: at });
      event(project, "result", "Observed results imported; expectations unchanged", [experiment.id, result.id]);
      break;
    }
    case "record_run": {
      const index = project.runs.findIndex((run) => run.id === payload.run.id);
      const run = index >= 0 ? { ...project.runs[index], ...payload.run } : { ...payload.run };
      delete run.outputTps;
      if (typeof run.outputTokens === "number" && typeof run.durationMs === "number" && run.durationMs > 0 && run.status !== "running") {
        run.outputTps = Math.round((run.outputTokens / (run.durationMs / 1000)) * 10) / 10;
      }
      if (index >= 0) project.runs[index] = run; else project.runs.push(run);
      break;
    }
    case "record_asset":
      project.assets.push({ ...payload.asset, id: payload.asset.id || id(), createdAt: payload.asset.createdAt || at });
      break;
    case "record_export":
      project.exports.push({ ...payload.export, id: payload.export.id || id(), revision: project.revision, createdAt: at });
      break;
    case "record_exports": {
      const sourceRevision = project.revision;
      for (const exported of payload.exports || []) {
        project.exports.push({ ...exported, id: exported.id || id(), revision: sourceRevision, createdAt: at });
      }
      break;
    }
    case "set_status":
      project.status = payload.status;
      if (payload.message) event(project, payload.status, payload.message);
      break;
    default: throw new Error(`Unsupported research command: ${op}`);
  }
}

const queues = new Map();
export function executeResearchCommand(root, command) {
  const filename = projectPath(root);
  const previous = queues.get(filename) || Promise.resolve();
  const task = previous.catch(() => {}).then(async () => {
    const current = await readProject(root);
    const isCreate = command.op === "create";
    if (isCreate) {
      if (current) throw new Error("An investigation already exists");
    } else {
      if (!current) throw new Error("No investigation exists");
      if (current.commandIds.includes(command.commandId)) return current;
      if (command.baseRevision !== current.revision) throw new Error(`Stale revision: expected ${current.revision}, received ${command.baseRevision}`);
    }
    const draft = isCreate ? emptyProject(command.curiosity, command.title) : structuredClone(current);
    if (!isCreate) apply(draft, command.op, command.payload || {});
    if (command.sessionKey && isCreate) draft.sessionKey = command.sessionKey;
    validateGraph(draft);
    draft.revision = isCreate ? 1 : current.revision + 1;
    draft.updatedAt = now();
    if (!draft.commandIds.includes(command.commandId)) draft.commandIds.push(command.commandId);
    if (draft.commandIds.length > 500) draft.commandIds = draft.commandIds.slice(-500);
    if (isCreate) event(draft, "investigation", "Investigation opened");
    const validated = projectSchema.parse(draft);
    await mkdir(path.dirname(filename), { recursive: true });
    if (current) await copyFile(filename, `${filename}.bak`);
    const temporary = `${filename}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(validated, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, filename);
    return validated;
  });
  queues.set(filename, task);
  return task;
}
