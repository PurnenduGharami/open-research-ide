import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const PROJECT_FILENAME = "research-project.json";
const PROJECTS_DIR = "projects";
const INDEX_FILENAME = "index.json";

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

const messageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  createdAt: z.string(),
  stage: z.string().optional(),
  citations: z.array(z.string()).optional(),
  blockIds: z.array(z.string()).optional(),
  runId: z.string().optional(),
}).strict();

const proseIssueSchema = z.object({
  rule: z.string(),
  severity: z.enum(["suggestion", "warning", "error"]),
  sectionId: z.string(),
  excerpt: z.string(),
  message: z.string(),
  replacement: z.string().optional(),
}).strict();

const manuscriptSchema = z.object({
  title: z.string(),
  abstract: z.string(),
  sections: z.array(z.object({
    id: z.string(),
    heading: z.string(),
    content: z.string(),
    updatedAt: z.string(),
  }).strict()),
  proseAudit: z.object({
    engine: z.enum(["vale+builtin", "builtin"]),
    checkedAt: z.string(),
    score: z.number(),
    wordCount: z.number(),
    issueCount: z.number(),
    summary: z.string(),
    issues: z.array(proseIssueSchema),
  }).strict().optional(),
  sourceRevision: z.number().int().nonnegative(),
  updatedAt: z.string(),
}).strict();

export const projectSchema = z.object({
  schemaVersion: z.literal(1),
  projectId: z.string().min(1),
  revision: z.number().int().nonnegative(),
  contentRevision: z.number().int().nonnegative().optional(),
  title: z.string().min(1),
  curiosity: z.string().min(1),
  mode: z.enum(["guided", "autonomous"]).optional(),
  status: z.enum(["investigating", "ready", "error"]),
  privacy: z.literal("local-only"),
  sessionKey: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  nodes: z.array(nodeSchema),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    type: z.enum(["supports", "contradicts", "identifies", "addresses", "tests", "observed-in", "reviews", "conducted-at"]),
    label: z.string(),
  }).strict()),
  uiBlocks: z.array(z.object({
    id: z.string(),
    kind: z.enum(["literature", "analysis", "review", "experiment", "result"]),
    title: z.string(),
    nodeIds: z.array(z.string()),
    createdAt: z.string(),
  }).strict()),
  messages: z.array(messageSchema).optional(),
  manuscript: manuscriptSchema.optional(),
  sources: z.array(z.object({
    id: z.string(),
    provider: z.string(),
    url: z.string(),
    status: z.enum(["ok", "partial", "error"]),
    queriedAt: z.string(),
    error: z.string().optional(),
  }).strict()),
  runs: z.array(z.object({
    id: z.string(),
    kind: z.string(),
    agentId: z.string(),
    model: z.string(),
    status: z.enum(["running", "completed", "error"]),
    startedAt: z.string(),
    endedAt: z.string().optional(),
    durationMs: z.number().nonnegative().optional(),
    inputTokens: z.number().nonnegative().optional(),
    outputTokens: z.number().nonnegative().optional(),
    outputTps: z.number().nonnegative().optional(),
    error: z.string().optional(),
  }).strict()),
  timeline: z.array(z.object({
    id: z.string(),
    at: z.string(),
    kind: z.string(),
    message: z.string(),
    nodeIds: z.array(z.string()).default([]),
  }).strict()),
  assets: z.array(z.object({
    id: z.string(),
    label: z.string(),
    kind: z.string(),
    path: z.string(),
    sha256: z.string(),
    createdAt: z.string(),
  }).strict()),
  exports: z.array(z.object({
    id: z.string(),
    revision: z.number().int(),
    contentRevision: z.number().int().optional(),
    format: z.enum(["html", "pdf", "latex", "zip"]),
    path: z.string(),
    sha256: z.string(),
    createdAt: z.string(),
  }).strict()),
  commandIds: z.array(z.string()),
}).strict();

function safeProjectId(projectId) {
  const clean = String(projectId || "").trim();
  if (!/^[a-zA-Z0-9_-]{4,120}$/.test(clean)) throw new Error("Invalid project ID");
  return clean;
}

export function workspaceDir(root) {
  return path.join(root, "workspace");
}

export function projectPath(root, projectId) {
  if (projectId) {
    return path.join(root, "workspace", PROJECTS_DIR, safeProjectId(projectId), "project.json");
  }
  return path.join(root, "workspace", PROJECT_FILENAME);
}

export function projectExportsDir(root, projectId) {
  if (projectId) {
    return path.join(root, "workspace", PROJECTS_DIR, safeProjectId(projectId), "exports");
  }
  return path.join(root, "workspace", "exports");
}

function indexPath(root) {
  return path.join(root, "workspace", PROJECTS_DIR, INDEX_FILENAME);
}

export function summarizeProject(project) {
  const papers = project.nodes.filter((node) => node.type === "paper");
  const evidence = project.nodes.filter((node) => node.type === "evidence");
  const verified = evidence.filter((node) => node.data.verified === true);
  const experiments = project.nodes.filter((node) => node.type === "experiment");
  const results = project.nodes.filter((node) => node.type === "result");
  return {
    projectId: project.projectId,
    title: project.title,
    curiosity: project.curiosity,
    mode: project.mode || "guided",
    status: project.status,
    revision: project.revision,
    contentRevision: project.contentRevision ?? project.revision,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    paperCount: papers.length,
    evidenceCount: evidence.length,
    verifiedEvidenceCount: verified.length,
    experimentCount: experiments.length,
    resultCount: results.length,
  };
}

export function emptyProject(curiosity, title = "Untitled investigation", mode = "guided") {
  const at = now();
  return projectSchema.parse({
    schemaVersion: 1,
    projectId: id(),
    revision: 0,
    contentRevision: 0,
    title,
    curiosity,
    mode: mode === "autonomous" ? "autonomous" : "guided",
    status: "investigating",
    privacy: "local-only",
    createdAt: at,
    updatedAt: at,
    nodes: [],
    edges: [],
    uiBlocks: [],
    messages: [],
    sources: [],
    runs: [],
    timeline: [],
    assets: [],
    exports: [],
    commandIds: [],
  });
}

async function atomicWriteJson(filename, value, keepBackup = false) {
  await mkdir(path.dirname(filename), { recursive: true });
  if (keepBackup) {
    try { await copyFile(filename, `${filename}.bak`); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  }
  const temporary = `${filename}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, filename);
}

async function readIndex(root) {
  try {
    const parsed = JSON.parse(await readFile(indexPath(root), "utf8"));
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.projects)) {
      return { activeProjectId: typeof parsed.activeProjectId === "string" ? parsed.activeProjectId : null, projects: parsed.projects };
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return { activeProjectId: null, projects: [] };
}

async function writeIndex(root, index) {
  await atomicWriteJson(indexPath(root), index, false);
}

async function syncProjectToIndex(root, project, makeActive = false) {
  const index = await readIndex(root);
  const summary = summarizeProject(project);
  const existingIdx = index.projects.findIndex((item) => item.projectId === project.projectId);
  if (existingIdx >= 0) index.projects[existingIdx] = summary;
  else index.projects.unshift(summary);
  index.projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (makeActive || !index.activeProjectId) index.activeProjectId = project.projectId;
  await writeIndex(root, index);
  return index;
}

async function readJsonFile(filename) {
  try {
    return projectSchema.parse(JSON.parse(await readFile(filename, "utf8")));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export async function listProjects(root) {
  const index = await readIndex(root);
  if (index.projects.length > 0) {
    return { activeProjectId: index.activeProjectId, projects: index.projects };
  }
  const legacy = await readJsonFile(projectPath(root));
  if (legacy) {
    await atomicWriteJson(projectPath(root, legacy.projectId), legacy, false);
    const synced = await syncProjectToIndex(root, legacy, true);
    return { activeProjectId: synced.activeProjectId, projects: synced.projects };
  }
  return { activeProjectId: null, projects: [] };
}

export async function getActiveProjectId(root) {
  const listed = await listProjects(root);
  return listed.activeProjectId;
}

export async function readProject(root, projectId) {
  if (projectId) {
    return readJsonFile(projectPath(root, projectId));
  }
  const index = await readIndex(root);
  if (index.activeProjectId) {
    const active = await readJsonFile(projectPath(root, index.activeProjectId));
    if (active) return active;
  }
  const legacy = await readJsonFile(projectPath(root));
  if (legacy) {
    await atomicWriteJson(projectPath(root, legacy.projectId), legacy, false);
    await syncProjectToIndex(root, legacy, true);
    return legacy;
  }
  return null;
}

export async function setActiveProject(root, projectId) {
  const project = await readProject(root, projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  const index = await readIndex(root);
  index.activeProjectId = project.projectId;
  await writeIndex(root, index);
  await atomicWriteJson(projectPath(root), project, false);
  return project;
}

export async function deleteProject(root, projectId) {
  const safeId = safeProjectId(projectId);
  const dir = path.join(root, "workspace", PROJECTS_DIR, safeId);
  await rm(dir, { recursive: true, force: true });
  const index = await readIndex(root);
  index.projects = index.projects.filter((item) => item.projectId !== safeId);
  if (index.activeProjectId === safeId) {
    index.activeProjectId = index.projects[0]?.projectId || null;
  }
  await writeIndex(root, index);
  if (index.activeProjectId) {
    const nextActive = await readProject(root, index.activeProjectId);
    if (nextActive) await atomicWriteJson(projectPath(root), nextActive, false);
  } else {
    await rm(projectPath(root), { force: true });
  }
  return index;
}

function cleanNode(raw, at) {
  const createdAt = raw.createdAt || at;
  const data = { ...(raw.data || {}) };
  if (raw.type === "evidence") {
    data.verified = false;
    data.verificationStatus = "unverified";
  }
  return nodeSchema.parse({
    id: raw.id || id(),
    type: raw.type,
    title: String(raw.title || "Untitled").slice(0, 500),
    createdAt,
    updatedAt: at,
    sourceRefs: raw.sourceRefs || [],
    data,
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
    if (!paper || typeof quote !== "string" || !quote.trim() || typeof paper.data.abstract !== "string" || !paper.data.abstract.includes(quote)) {
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
      if (payload.sessionKey) project.sessionKey = payload.sessionKey;
      if (payload.mode) project.mode = payload.mode;
      event(project, "investigation", "Investigation opened");
      break;
    case "set_mode":
      project.mode = payload.mode === "autonomous" ? "autonomous" : "guided";
      event(project, "mode", `Investigation mode set to ${project.mode}`);
      break;
    case "append_message": {
      if (!project.messages) project.messages = [];
      const message = messageSchema.parse({
        id: payload.id || id(),
        role: payload.role,
        content: String(payload.content || ""),
        createdAt: payload.createdAt || at,
        ...(payload.stage ? { stage: payload.stage } : {}),
        ...(payload.citations?.length ? { citations: payload.citations } : {}),
        ...(payload.blockIds?.length ? { blockIds: payload.blockIds } : {}),
        ...(payload.runId ? { runId: payload.runId } : {}),
      });
      project.messages.push(message);
      break;
    }
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
          node.data.verificationStatus = previous.data.verificationStatus || (node.data.verified ? "verified" : "unverified");
          if (previous.data.verificationMethod) node.data.verificationMethod = previous.data.verificationMethod;
          if (previous.data.rejectedReason) node.data.rejectedReason = previous.data.rejectedReason;
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
    case "update_node": {
      const target = project.nodes.find((node) => node.id === payload.nodeId);
      if (!target) throw new Error("Research node not found");
      if (target.type === "paper" && payload.data && "abstract" in payload.data && payload.data.abstract !== target.data.abstract) {
        throw new Error(`Paper ${target.id} cannot replace its immutable abstract snapshot`);
      }
      if (target.type === "evidence" && payload.data && (("quote" in payload.data && payload.data.quote !== target.data.quote) || ("paperId" in payload.data && payload.data.paperId !== target.data.paperId))) {
        throw new Error(`Evidence ${target.id} cannot replace its paper or quote`);
      }
      if (target.type === "experiment" && target.data.expectedOutcomesFrozenAt && payload.data && "expectedOutcomes" in payload.data && JSON.stringify(payload.data.expectedOutcomes) !== JSON.stringify(target.data.expectedOutcomes)) {
        throw new Error(`Experiment ${target.id} cannot overwrite frozen expected outcomes`);
      }
      if (typeof payload.title === "string" && payload.title.trim()) {
        target.title = payload.title.trim().slice(0, 500);
      }
      if (payload.data && typeof payload.data === "object") {
        target.data = { ...target.data, ...payload.data };
      }
      target.updatedAt = at;
      event(project, "curation", `Researcher updated ${target.type}: ${target.title}`, [target.id]);
      break;
    }
    case "delete_node": {
      const target = project.nodes.find((node) => node.id === payload.nodeId);
      if (!target) throw new Error("Research node not found");
      if (target.type === "paper" && project.nodes.some((node) => node.type === "evidence" && node.data.paperId === target.id)) {
        throw new Error("Remove or detach linked evidence passages before deleting this paper");
      }
      project.nodes = project.nodes.filter((node) => node.id !== target.id);
      project.edges = project.edges.filter((edge) => edge.source !== target.id && edge.target !== target.id);
      project.uiBlocks = project.uiBlocks.map((block) => ({
        ...block,
        nodeIds: block.nodeIds.filter((nodeId) => nodeId !== target.id),
      })).filter((block) => block.nodeIds.length > 0);
      event(project, "curation", `Removed ${target.type}: ${target.title}`);
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
      evidence.data.verificationStatus = "verified";
      evidence.data.verificationMethod = payload.method || "human-exact-abstract-confirmation";
      delete evidence.data.rejectedReason;
      evidence.updatedAt = at;
      event(project, "confirmation", "Evidence confirmed by researcher", [evidence.id]);
      break;
    }
    case "unconfirm_evidence": {
      const evidence = project.nodes.find((node) => node.id === payload.nodeId && node.type === "evidence");
      if (!evidence) throw new Error("Evidence node not found");
      evidence.data.verified = false;
      evidence.data.verificationStatus = "unverified";
      delete evidence.data.rejectedReason;
      evidence.updatedAt = at;
      event(project, "confirmation", "Evidence returned to unverified state", [evidence.id]);
      break;
    }
    case "reject_evidence": {
      const evidence = project.nodes.find((node) => node.id === payload.nodeId && node.type === "evidence");
      if (!evidence) throw new Error("Evidence node not found");
      evidence.data.verified = false;
      evidence.data.verificationStatus = "rejected";
      if (payload.reason) evidence.data.rejectedReason = String(payload.reason).slice(0, 500);
      evidence.updatedAt = at;
      event(project, "confirmation", "Evidence rejected by researcher", [evidence.id]);
      break;
    }
    case "update_lab": {
      const lab = project.nodes.find((node) => node.id === payload.nodeId && node.type === "lab");
      if (!lab) throw new Error("Lab node not found");
      if (typeof payload.contacted === "boolean") {
        lab.data.contacted = payload.contacted;
        if (payload.contacted && !lab.data.contactedAt) lab.data.contactedAt = at;
      }
      if (typeof payload.contactedAt === "string") lab.data.contactedAt = payload.contactedAt;
      if (typeof payload.notes === "string") lab.data.notes = payload.notes.slice(0, 4000);
      if (typeof payload.pathway === "string") lab.data.pathway = payload.pathway;
      if (payload.price && typeof payload.price === "object") {
        const kind = ["quoted", "model-estimated", "unavailable"].includes(payload.price.kind) ? payload.price.kind : "unavailable";
        lab.data.price = {
          ...(typeof payload.price.amount === "number" && Number.isFinite(payload.price.amount) ? { amount: payload.price.amount } : {}),
          ...(payload.price.currency ? { currency: String(payload.price.currency).slice(0, 12) } : {}),
          kind,
          note: String(payload.price.note || (kind === "quoted" ? "Written quote entered by researcher" : "No supplier quote recorded")).slice(0, 500),
        };
      }
      lab.updatedAt = at;
      event(project, "lab", `Updated lab status for ${lab.data.name || lab.title}`, [lab.id]);
      break;
    }
    case "update_experiment_run": {
      const experiment = project.nodes.find((node) => node.id === payload.experimentId && node.type === "experiment");
      if (!experiment) throw new Error("Experiment not found");
      const currentCode = experiment.data.codeExperiment && typeof experiment.data.codeExperiment === "object"
        ? experiment.data.codeExperiment
        : { language: "python", filename: "experiment.py", dependencies: [], code: "", runCommand: "python3 experiment.py" };
      experiment.data.codeExperiment = {
        ...currentCode,
        ...(payload.code !== undefined ? { code: String(payload.code) } : {}),
        ...(payload.lastRunOutput ? { lastRunOutput: payload.lastRunOutput } : {}),
      };
      experiment.updatedAt = at;
      event(project, "experiment", "Computational experiment run recorded", [experiment.id]);
      break;
    }
    case "import_result": {
      const experiment = project.nodes.find((node) => node.id === payload.experimentId && node.type === "experiment");
      if (!experiment) throw new Error("Experiment not found");
      const result = cleanNode({ ...payload.result, type: "result" }, at);
      result.data = {
        ...result.data,
        experimentId: experiment.id,
        observations: payload.observations,
        importedAt: result.data.importedAt || at,
        ...(Array.isArray(payload.metricResults) && payload.metricResults.length ? { metricResults: payload.metricResults } : {}),
        ...(payload.datasetName ? { datasetName: String(payload.datasetName).slice(0, 200) } : {}),
        ...(payload.datasetSummary ? { datasetSummary: String(payload.datasetSummary).slice(0, 4000) } : {}),
        ...(payload.sourceModality ? { sourceModality: payload.sourceModality } : {}),
      };
      project.nodes.push(result);
      project.edges.push({ id: id(), source: experiment.id, target: result.id, type: "observed-in", label: "Observed result" });
      project.uiBlocks.push({ id: id(), kind: "result", title: "Imported observations", nodeIds: [result.id], createdAt: at });
      event(project, "result", "Observed results imported; expectations unchanged", [experiment.id, result.id]);
      break;
    }
    case "set_manuscript": {
      project.manuscript = manuscriptSchema.parse({
        ...payload.manuscript,
        sourceRevision: payload.manuscript.sourceRevision ?? project.contentRevision ?? project.revision,
        updatedAt: at,
      });
      event(project, "manuscript", "Manuscript draft updated");
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
      project.exports.push({
        ...payload.export,
        id: payload.export.id || id(),
        revision: project.revision,
        contentRevision: project.contentRevision ?? project.revision,
        createdAt: at,
      });
      break;
    case "record_exports": {
      const sourceRevision = project.revision;
      const sourceContentRevision = project.contentRevision ?? project.revision;
      for (const exported of payload.exports || []) {
        project.exports.push({
          ...exported,
          id: exported.id || id(),
          revision: sourceRevision,
          contentRevision: sourceContentRevision,
          createdAt: at,
        });
      }
      break;
    }
    case "set_status":
      project.status = payload.status;
      if (payload.message) event(project, payload.status, payload.message);
      break;
    case "recover_interrupted": {
      const hasArtifacts = project.nodes.length > 0 || (project.messages?.length ?? 0) > 0;
      project.status = hasArtifacts ? "ready" : "error";
      for (const run of project.runs) {
        if (run.status === "running") {
          run.status = "error";
          run.endedAt = at;
          run.error = "Interrupted by server restart";
        }
      }
      event(project, "recovery", "Recovered interrupted investigation after server restart");
      break;
    }
    default:
      throw new Error(`Unsupported research command: ${op}`);
  }
}

const BOOKKEEPING_OPS = new Set(["record_export", "record_exports", "record_run"]);
const queues = new Map();

export function executeResearchCommand(root, command) {
  const queueKey = command.projectId ? projectPath(root, command.projectId) : path.join(root, "workspace", "__active__");
  const previous = queues.get(queueKey) || Promise.resolve();
  const task = previous.catch(() => {}).then(async () => {
    const isCreate = command.op === "create";
    const current = isCreate ? null : await readProject(root, command.projectId);
    if (!isCreate) {
      if (!current) throw new Error("No investigation exists");
      if (current.commandIds.includes(command.commandId)) return current;
      if (command.baseRevision !== current.revision) {
        throw new Error(`Stale revision: expected ${current.revision}, received ${command.baseRevision}`);
      }
    }
    const draft = isCreate
      ? emptyProject(command.curiosity, command.title, command.mode)
      : structuredClone(current);
    if (isCreate && command.projectId) draft.projectId = safeProjectId(command.projectId);
    if (!isCreate) apply(draft, command.op, command.payload || {});
    if (command.sessionKey && isCreate) draft.sessionKey = command.sessionKey;
    if (isCreate && command.curiosity) {
      draft.messages = [{
        id: id(),
        role: "user",
        content: command.curiosity,
        createdAt: now(),
        stage: "curiosity",
      }];
    }
    validateGraph(draft);
    draft.revision = isCreate ? 1 : current.revision + 1;
    const prevContentRev = isCreate ? 0 : (current.contentRevision ?? current.revision);
    draft.contentRevision = isCreate
      ? 1
      : BOOKKEEPING_OPS.has(command.op)
        ? prevContentRev
        : prevContentRev + 1;
    draft.updatedAt = now();
    if (!draft.commandIds.includes(command.commandId)) draft.commandIds.push(command.commandId);
    if (draft.commandIds.length > 500) draft.commandIds = draft.commandIds.slice(-500);
    if (isCreate) event(draft, "investigation", "Investigation opened");
    const validated = projectSchema.parse(draft);

    const targetFile = projectPath(root, validated.projectId);
    await atomicWriteJson(targetFile, validated, Boolean(current));
    const index = await syncProjectToIndex(root, validated, isCreate || !command.projectId);
    if (index.activeProjectId === validated.projectId || !command.projectId) {
      await atomicWriteJson(projectPath(root), validated, Boolean(current));
    }
    return validated;
  });
  queues.set(queueKey, task);
  return task;
}

export async function recoverInterruptedProjects(root, activeProjectIds = new Set()) {
  const listed = await listProjects(root);
  const recovered = [];
  for (const summary of listed.projects) {
    if (summary.status !== "investigating" || activeProjectIds.has(summary.projectId)) continue;
    const current = await readProject(root, summary.projectId);
    if (!current || current.status !== "investigating") continue;
    const updated = await executeResearchCommand(root, {
      projectId: current.projectId,
      commandId: `recover:${current.projectId}:${current.revision}`,
      baseRevision: current.revision,
      op: "recover_interrupted",
      payload: {},
    });
    recovered.push(updated.projectId);
  }
  return recovered;
}
