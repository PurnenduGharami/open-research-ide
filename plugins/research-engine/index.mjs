import { Type } from "typebox";
import { fileURLToPath } from "node:url";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { executeResearchCommand, readProject } from "./engine.mjs";
import { literatureNodes, searchLiterature } from "./literature.mjs";
import { discoverLabsFromDois, labNodesFromDiscovery } from "./labs.mjs";

const textResult = (details) => ({ content: [{ type: "text", text: JSON.stringify(details) }], details });

export default definePluginEntry({
  id: "research-engine",
  name: "Open Research Engine",
  description: "Retrieves real literature, real OpenAlex institutional facilities, and commits auditable research artifacts",
  register(api) {
    const root = api.pluginConfig.projectRoot || process.env.OPEN_RESEARCH_ROOT || fileURLToPath(new URL("../../", import.meta.url));
    api.registerTool({
      name: "research_literature_search",
      description: "Search real OpenAlex, Semantic Scholar, and arXiv records, normalize papers, and append a unique literature block. Never invent results; source failures are returned.",
      parameters: Type.Object({ query: Type.String({ minLength: 3 }), limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 20 })) }),
      async execute(toolCallId, params) {
        const result = await searchLiterature(params.query, { limit: params.limit });
        const current = await readProject(root);
        if (!current) throw new Error("Start an investigation from Open Research IDE first");
        const converted = literatureNodes(result);
        let project = await executeResearchCommand(root, {
          projectId: current.projectId,
          commandId: `${toolCallId}:sources`,
          baseRevision: current.revision,
          op: "record_sources",
          payload: { sources: converted.sources },
        });
        if (converted.nodes.length) {
          project = await executeResearchCommand(root, {
            projectId: current.projectId,
            commandId: `${toolCallId}:nodes`,
            baseRevision: project.revision,
            op: "upsert_nodes",
            payload: { nodes: converted.nodes, edges: [] },
          });
          const block = {
            id: `literature:${toolCallId}`,
            kind: "literature",
            title: `Literature: ${params.query}`,
            nodeIds: converted.nodes.map((node) => node.id),
          };
          project = await executeResearchCommand(root, {
            projectId: current.projectId,
            commandId: `${toolCallId}:block`,
            baseRevision: project.revision,
            op: "set_blocks",
            payload: { blocks: [block] },
          });
        }
        return textResult({ revision: project.revision, papers: result.papers, sources: result.sources });
      },
    }, { workspaceAccess: false });

    api.registerTool({
      name: "research_find_labs",
      description: "Discover real university departments and research institutions from OpenAlex authorships of papers in the project (or supplied DOIs). Never fabricates lab names, contacts, or quotes.",
      parameters: Type.Object({
        dois: Type.Optional(Type.Array(Type.String())),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 20 })),
      }),
      async execute(toolCallId, params) {
        const current = await readProject(root);
        if (!current) throw new Error("No investigation exists");
        const dois = params.dois?.length
          ? params.dois
          : current.nodes.filter((node) => node.type === "paper" && node.data.doi).map((node) => String(node.data.doi));
        const discovery = await discoverLabsFromDois(dois, { limit: params.limit || 6 });
        let project = current;
        if (discovery.sources.length) {
          project = await executeResearchCommand(root, {
            projectId: current.projectId,
            commandId: `${toolCallId}:lab-sources`,
            baseRevision: project.revision,
            op: "record_sources",
            payload: { sources: discovery.sources },
          });
        }
        const nodes = labNodesFromDiscovery(discovery);
        if (nodes.length) {
          project = await executeResearchCommand(root, {
            projectId: current.projectId,
            commandId: `${toolCallId}:lab-nodes`,
            baseRevision: project.revision,
            op: "upsert_nodes",
            payload: { nodes, edges: [] },
          });
        }
        return textResult({ revision: project.revision, labs: discovery.labs, sources: discovery.sources });
      },
    }, { workspaceAccess: false });

    api.registerTool({
      name: "research_project_read",
      description: "Read the complete canonical research project. Use node IDs and exact abstracts from this state rather than guessing.",
      parameters: Type.Object({}),
      async execute() {
        const project = await readProject(root);
        if (!project) throw new Error("No investigation exists");
        return textResult(project);
      },
    }, { workspaceAccess: false });

    api.registerTool({
      name: "research_project_commit",
      description: "Commit typed analysis, reviews, experiment, hypothesis, and lab nodes. Evidence inserted here remains unverified and must exactly quote a paper abstract. Do not overwrite expected experiment outcomes with observations.",
      parameters: Type.Object({
        nodes: Type.Array(Type.Any()),
        edges: Type.Optional(Type.Array(Type.Any())),
        blocks: Type.Optional(Type.Array(Type.Any())),
        status: Type.Optional(Type.Union([Type.Literal("investigating"), Type.Literal("ready"), Type.Literal("error")])),
        message: Type.Optional(Type.String()),
      }),
      async execute(toolCallId, params) {
        const current = await readProject(root);
        if (!current) throw new Error("No investigation exists");
        let project = current;
        if (params.nodes.length) {
          project = await executeResearchCommand(root, {
            projectId: current.projectId,
            commandId: `${toolCallId}:nodes`,
            baseRevision: project.revision,
            op: "upsert_nodes",
            payload: { nodes: params.nodes, edges: params.edges || [] },
          });
        }
        if (params.blocks?.length) {
          project = await executeResearchCommand(root, {
            projectId: current.projectId,
            commandId: `${toolCallId}:blocks`,
            baseRevision: project.revision,
            op: "set_blocks",
            payload: { blocks: params.blocks },
          });
        }
        if (params.status) {
          project = await executeResearchCommand(root, {
            projectId: current.projectId,
            commandId: `${toolCallId}:status`,
            baseRevision: project.revision,
            op: "set_status",
            payload: { status: params.status, message: params.message },
          });
        }
        return textResult({ revision: project.revision, nodeCount: project.nodes.length, edgeCount: project.edges.length });
      },
    }, { workspaceAccess: false });
  },
});
