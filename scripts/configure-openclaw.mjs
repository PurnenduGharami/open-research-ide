import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = (args) => execFileSync("openclaw", args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
const readJson = (args, fallback) => { try { return JSON.parse(cli(args)); } catch { return fallback; } };
const loadPaths = readJson(["config", "get", "plugins.load.paths", "--json"], []);
const pluginPath = path.join(root, "plugins", "research-engine");
const agents = readJson(["agents", "list", "--json"], []);
const existingIds = new Set(agents.map((agent) => agent.id));
const defaultId = agents.find((agent) => agent.isDefault)?.id || (existingIds.has("main") ? "main" : agents[0]?.id);
const model = "cerebras/moonshotai-kimi-k3.1-pro-trial";
const common = { model, thinkingDefault: "off", reasoningDefault: "off", skills: [] };
const entries = [
  ["research", "Elephant Research Orchestrator", "elephant", { allow: ["research_literature_search", "research_project_read", "research_project_commit"] }],
  ["research-auditor", "Goldfish Evidence Auditor", "goldfish-auditor", { deny: ["*"] }],
  ["research-critic", "Goldfish Scientific Critic", "goldfish-critic", { deny: ["*"] }],
  ["research-feasibility", "Goldfish Feasibility Reviewer", "goldfish-feasibility", { deny: ["*"] }],
];
const batch = [
  { path: "plugins.load.paths", value: [...new Set([...loadPaths, pluginPath])] },
  { path: "plugins.entries.research-engine.enabled", value: true },
  { path: "plugins.entries.research-engine.config.projectRoot", value: root },
];
for (const [id, name, workspace, tools] of entries) {
  if (!existingIds.has(id)) {
    batch.push({ path: `agents.entries.${id}`, value: { name, workspace: path.join(root, "agents", workspace), ...common, tools } });
  } else {
    batch.push({ path: `agents.entries.${id}.name`, value: name });
    for (const [key, value] of Object.entries({ workspace: path.join(root, "agents", workspace), ...common, tools })) {
      batch.push({ path: `agents.entries.${id}.${key}`, value });
    }
  }
}
if (agents.length > 1 || entries.some(([id]) => !existingIds.has(id))) {
  if (!defaultId) throw new Error("Configure an existing primary OpenClaw agent before adding research agents.");
  batch.push({ path: "agents.ownership", value: "explicit" });
  batch.push({ path: "agents.defaults.systemAgent.agentId", value: defaultId });
}
cli(["config", "set", "--batch-json", JSON.stringify(batch)]);
console.log(`Research plugin and four agent entries configured for ${root}; existing default agent preserved.`);
