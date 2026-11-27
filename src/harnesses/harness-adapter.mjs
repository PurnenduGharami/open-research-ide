import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { executeResearchCommand, readProject } from "../../plugins/research-engine/engine.mjs";
import { literatureNodes, searchLiterature } from "../../plugins/research-engine/literature.mjs";
import { discoverLabsFromDois, labNodesFromDiscovery } from "../../plugins/research-engine/labs.mjs";
import { checkProviderHealth, invokeModelProvider, withExponentialBackoff } from "../providers/model-provider.mjs";
import { getPublicRuntimeConfig, readRuntimeConfig } from "../runtime-config.mjs";

const STANDALONE_TOOLS = [
  {
    name: "research_literature_search",
    description: "Search real OpenAlex, Semantic Scholar, and arXiv records, normalize papers, and append a unique literature block. Never invent results.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Concise scientific search keywords" },
        limit: { type: "integer", description: "Max papers to retrieve (1-20, default 6)" },
      },
      required: ["query"],
    },
  },
  {
    name: "research_find_labs",
    description: "Discover real university departments and research institutions from OpenAlex authorships of retrieved papers (or supplied DOIs). Never fabricate labs or quotes.",
    parameters: {
      type: "object",
      properties: {
        dois: { type: "array", items: { type: "string" }, description: "Paper DOIs to trace institutions from" },
        limit: { type: "integer", description: "Max institutions to return (default 6)" },
      },
    },
  },
  {
    name: "research_project_read",
    description: "Read the canonical research project JSON (papers, abstracts, nodes, edges, reviews, experiments).",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "research_project_commit",
    description: "Commit typed evidence, contradiction (with data.sides comparing both papers/quotes), gap, hypothesis, experiment, and lab nodes + edges + blocks. Evidence must exactly quote a paper abstract.",
    parameters: {
      type: "object",
      properties: {
        nodes: {
          type: "array",
          description: "Research nodes to upsert (evidence, contradiction, gap, hypothesis, experiment, lab).",
          items: { type: "object" },
        },
        edges: {
          type: "array",
          description: "Typed edges (supports, contradicts, identifies, addresses, tests, conducted-at).",
          items: { type: "object" },
        },
        blocks: {
          type: "array",
          description: "UI blocks referencing committed node IDs.",
          items: { type: "object" },
        },
        status: { type: "string", enum: ["investigating", "ready", "error"] },
        message: { type: "string" },
      },
      required: ["nodes"],
    },
  },
];

async function executeStandaloneTool(root, projectId, toolCall) {
  const callId = `${toolCall.id || randomUUID()}`;
  const params = toolCall.arguments || {};
  if (toolCall.name === "research_project_read") {
    const project = await readProject(root, projectId);
    if (!project) throw new Error("No investigation exists");
    return JSON.stringify(project);
  }
  if (toolCall.name === "research_literature_search") {
    const result = await searchLiterature(String(params.query || ""), { limit: params.limit || 6 });
    const current = await readProject(root, projectId);
    if (!current) throw new Error("No investigation exists");
    const converted = literatureNodes(result);
    let project = await executeResearchCommand(root, {
      projectId: current.projectId,
      commandId: `${callId}:sources`,
      baseRevision: current.revision,
      op: "record_sources",
      payload: { sources: converted.sources },
    });
    if (converted.nodes.length) {
      project = await executeResearchCommand(root, {
        projectId: current.projectId,
        commandId: `${callId}:nodes`,
        baseRevision: project.revision,
        op: "upsert_nodes",
        payload: { nodes: converted.nodes, edges: [] },
      });
      project = await executeResearchCommand(root, {
        projectId: current.projectId,
        commandId: `${callId}:block`,
        baseRevision: project.revision,
        op: "set_blocks",
        payload: {
          blocks: [{
            id: `literature:${callId}`,
            kind: "literature",
            title: `Literature: ${params.query}`,
            nodeIds: converted.nodes.map((n) => n.id),
          }],
        },
      });
    }
    return JSON.stringify({ revision: project.revision, papers: result.papers, sources: result.sources });
  }
  if (toolCall.name === "research_find_labs") {
    const current = await readProject(root, projectId);
    if (!current) throw new Error("No investigation exists");
    const dois = Array.isArray(params.dois) && params.dois.length
      ? params.dois
      : current.nodes.filter((n) => n.type === "paper" && n.data.doi).map((n) => String(n.data.doi));
    const discovery = await discoverLabsFromDois(dois, { limit: params.limit || 6 });
    let project = current;
    if (discovery.sources.length) {
      project = await executeResearchCommand(root, {
        projectId: current.projectId,
        commandId: `${callId}:lab-sources`,
        baseRevision: project.revision,
        op: "record_sources",
        payload: { sources: discovery.sources },
      });
    }
    const nodes = labNodesFromDiscovery(discovery);
    if (nodes.length) {
      project = await executeResearchCommand(root, {
        projectId: current.projectId,
        commandId: `${callId}:lab-nodes`,
        baseRevision: project.revision,
        op: "upsert_nodes",
        payload: { nodes, edges: [] },
      });
    }
    return JSON.stringify({ revision: project.revision, labs: discovery.labs, sources: discovery.sources });
  }
  if (toolCall.name === "research_project_commit") {
    const current = await readProject(root, projectId);
    if (!current) throw new Error("No investigation exists");
    let project = current;
    if (Array.isArray(params.nodes) && params.nodes.length) {
      project = await executeResearchCommand(root, {
        projectId: current.projectId,
        commandId: `${callId}:nodes`,
        baseRevision: project.revision,
        op: "upsert_nodes",
        payload: { nodes: params.nodes, edges: params.edges || [] },
      });
    }
    if (Array.isArray(params.blocks) && params.blocks.length) {
      project = await executeResearchCommand(root, {
        projectId: current.projectId,
        commandId: `${callId}:blocks`,
        baseRevision: project.revision,
        op: "set_blocks",
        payload: { blocks: params.blocks },
      });
    }
    if (params.status) {
      project = await executeResearchCommand(root, {
        projectId: current.projectId,
        commandId: `${callId}:status`,
        baseRevision: project.revision,
        op: "set_status",
        payload: { status: params.status, message: params.message },
      });
    }
    return JSON.stringify({ revision: project.revision, nodeCount: project.nodes.length, edgeCount: project.edges.length });
  }
  throw new Error(`Unknown tool ${toolCall.name}`);
}

const AGENT_PROMPT_FILES = {
  research: "agents/elephant/AGENTS.md",
  "research-auditor": "agents/goldfish-auditor/AGENTS.md",
  "research-critic": "agents/goldfish-critic/AGENTS.md",
  "research-feasibility": "agents/goldfish-feasibility/AGENTS.md",
};

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function loadAgentPrompt(root, agentId) {
  const relative = AGENT_PROMPT_FILES[agentId] || AGENT_PROMPT_FILES.research;
  for (const baseDir of [root, PACKAGE_ROOT]) {
    try {
      return await readFile(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ baseDir, relative), "utf8");
    } catch { /* Try package root fallback. */ }
  }
  return "You are a rigorous scientific research assistant. Never fabricate citations, quotes, or experimental results.";
}

export function createHarnessAdapter(runtimeConfig, root, options = {}) {
  const sessions = new Map();
  const controllers = new Map();
  return {
    kind: "standalone",
    async createSession({ agentId, label, requestedKey }) {
      const key = requestedKey || `standalone-${label}-${randomUUID()}`;
      sessions.set(key, { agentId, history: [] });
      return key;
    },
    async sendTurn({ sessionKey, agentId, projectId, message, idempotencyKey, onDelta, onRetry, onTool }) {
      const isReviewer = agentId !== "research" && agentId !== (process.env.RESEARCH_AGENT_ID || "research");
      const roleConfig = isReviewer ? runtimeConfig.reviewers : runtimeConfig.orchestrator;
      const system = await loadAgentPrompt(root, agentId);
      const session = sessions.get(sessionKey) || { agentId, history: [] };
      sessions.set(sessionKey, session);
      const controller = new AbortController();
      controllers.set(sessionKey, controller);

      const conversation = isReviewer
        ? [{ role: "user", content: message }]
        : [...session.history, { role: "user", content: message }];

      const startedAt = Date.now();
      let totalIn = 0;
      let totalOut = 0;
      let hasUsage = false;
      let finalText = "";

      try {
        const maxSteps = isReviewer ? 1 : 8;
        for (let step = 0; step < maxSteps; step += 1) {
          const response = await withExponentialBackoff(
            () => invokeModelProvider({
              roleConfig,
              runtimeConfig,
              system,
              messages: conversation,
              tools: isReviewer ? [] : STANDALONE_TOOLS,
              onDelta,
              signal: controller.signal,
              fetch: options.fetch,
            }),
            { maxRetries: 3, baseDelayMs: 1000, onRetry, signal: controller.signal },
          );
          if (response.usage) {
            hasUsage = true;
            totalIn += Number(response.usage.inputTokens || 0);
            totalOut += Number(response.usage.outputTokens || 0);
          }
          if (response.text) finalText = response.text;
          if (isReviewer || !response.toolCalls?.length) {
            conversation.push({
              role: "assistant",
              content: response.text || "",
              ...(response.rawParts?.length ? { rawParts: response.rawParts } : {}),
            });
            break;
          }
          conversation.push({
            role: "assistant",
            content: response.text || "",
            toolCalls: response.toolCalls,
            ...(response.rawParts?.length ? { rawParts: response.rawParts } : {}),
          });
          for (const call of response.toolCalls) {
            onTool?.(call.name);
            let toolOutput;
            try {
              toolOutput = await executeStandaloneTool(root, projectId, call);
            } catch (error) {
              toolOutput = JSON.stringify({ error: String(error?.message || error) });
            }
            conversation.push({ role: "tool", toolCallId: call.id, toolName: call.name, content: toolOutput });
          }
        }
        if (!isReviewer) session.history = conversation.slice(-24);
        return {
          runId: idempotencyKey || randomUUID(),
          text: finalText,
          usage: hasUsage ? { inputTokens: totalIn, outputTokens: totalOut } : undefined,
          durationMs: Date.now() - startedAt,
        };
      } finally {
        controllers.delete(sessionKey);
      }
    },
    async abortSession(sessionKey) {
      controllers.get(sessionKey)?.abort();
      controllers.delete(sessionKey);
    },
    async preflight() {
      const [orch, rev] = await Promise.all([
        checkProviderHealth(runtimeConfig.orchestrator, runtimeConfig, options),
        checkProviderHealth(runtimeConfig.reviewers, runtimeConfig, options),
      ]);
      const checks = [
        { id: "harness", label: "Execution runtime", ok: true, detail: "Direct Standalone Runtime (zero external daemon required)" },
        { id: "orchestrator", label: "Research Orchestrator model", ok: orch.ok, detail: orch.detail },
        { id: "reviewers", label: "Independent Review Panel model", ok: rev.ok, detail: rev.detail },
      ];
      return {
        ok: checks.every((c) => c.ok),
        harness: "standalone",
        config: getPublicRuntimeConfig(runtimeConfig),
        checks,
        note: "Non-generative check: no research session or model request was created.",
      };
    },
  };
}

export async function runPreflight(root = process.cwd(), options = {}) {
  const config = await readRuntimeConfig(root);
  const adapter = createHarnessAdapter(config, root, options);
  return adapter.preflight();
}
