import { Type } from "typebox";
import { fileURLToPath } from "node:url";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { executeResearchCommand, readProject } from "./engine.mjs";
import { literatureNodes, searchLiterature } from "./literature.mjs";

const textResult = (details) => ({ content: [{ type: "text", text: JSON.stringify(details) }], details });

export default definePluginEntry({
  id: "research-engine",
  name: "Open Research Engine",
  description: "Retrieves real literature and commits auditable research artifacts",
  register(api) {
    const root = api.pluginConfig.projectRoot || process.env.OPEN_RESEARCH_ROOT || fileURLToPath(new URL("../../", import.meta.url));
    api.registerTool({
      name: "research_literature_search",
      description: "Search real OpenAlex and Semantic Scholar records, normalize papers, and create immutable abstract/evidence nodes. Never invent results; source failures are returned.",
      parameters: Type.Object({ query: Type.String({ minLength: 3 }), limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 20 })) }),
      async execute(toolCallId, params) {
        const result = await searchLiterature(params.query, { limit: params.limit });
        const current = await readProject(root);
        if (!current) throw new Error("Start an investigation from Open Research IDE first");
        const converted = literatureNodes(result);
        let project = await executeResearchCommand(root, {
          commandId: `${toolCallId}:sources`, baseRevision: current.revision,
          op: "record_sources", payload: { sources: converted.sources },
        });
        if (converted.nodes.length) project = await executeResearchCommand(root, {
          commandId: `${toolCallId}:nodes`, baseRevision: project.revision,
          op: "upsert_nodes", payload: { nodes: converted.nodes, edges: [] },
        });
        if (converted.nodes.length) {
          const block = { id: `literature:${current.projectId}`, kind: "literature", title: `Literature: ${params.query}`, nodeIds: converted.nodes.map((node) => node.id) };
          project = await executeResearchCommand(root, {
            commandId: `${toolCallId}:block`, baseRevision: project.revision,
            op: "set_blocks", payload: { blocks: [block] },
          });
        }
        return textResult({ revision: project.revision, papers: result.papers, sources: result.sources });
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
      description: "Commit typed analysis, reviews, experiment, hypothesis, result, and lab nodes. Evidence inserted here remains unverified and must exactly quote a paper abstract. Do not overwrite expected experiment outcomes with observations.",
      parameters: Type.Object({
        nodes: Type.Array(Type.Any()), edges: Type.Optional(Type.Array(Type.Any())),
        blocks: Type.Optional(Type.Array(Type.Any())),
        status: Type.Optional(Type.Union([Type.Literal("investigating"), Type.Literal("ready"), Type.Literal("error")])),
        message: Type.Optional(Type.String()),
      }),
      async execute(toolCallId, params) {
        const current = await readProject(root);
        if (!current) throw new Error("No investigation exists");
        let project = current;
        if (params.nodes.length) project = await executeResearchCommand(root, {
          commandId: `${toolCallId}:nodes`, baseRevision: project.revision,
          op: "upsert_nodes", payload: { nodes: params.nodes, edges: params.edges || [] },
        });
        if (params.blocks?.length) project = await executeResearchCommand(root, {
          commandId: `${toolCallId}:blocks`, baseRevision: project.revision,
          op: "set_blocks", payload: { blocks: params.blocks },
        });
        if (params.status) project = await executeResearchCommand(root, {
          commandId: `${toolCallId}:status`, baseRevision: project.revision,
          op: "set_status", payload: { status: params.status, message: params.message },
        });
        return textResult({ revision: project.revision, nodeCount: project.nodes.length, edgeCount: project.edges.length });
      },
    }, { workspaceAccess: false });
  },
});
