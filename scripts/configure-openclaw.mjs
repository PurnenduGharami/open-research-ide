import "./load-env.mjs";
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
const model = (process.env.RESEARCH_MODEL || "cerebras/moonshotai-kimi-k3.1-pro-trial").trim();
const reviewModel = (process.env.RESEARCH_REVIEW_MODEL || model).trim();

const entries = [
  ["research", "Research Orchestrator", "elephant", model, { allow: ["research_literature_search", "research_find_labs", "research_project_read", "research_project_commit"] }],
  ["research-auditor", "Evidence Auditor (Independent Review Panel)", "goldfish-auditor", reviewModel, { deny: ["*"] }],
  ["research-critic", "Methodology Critic (Independent Review Panel)", "goldfish-critic", reviewModel, { deny: ["*"] }],
  ["research-feasibility", "Feasibility Reviewer (Independent Review Panel)", "goldfish-feasibility", reviewModel, { deny: ["*"] }],
];

const batch = [
  { path: "plugins.load.paths", value: [...new Set([...loadPaths, pluginPath])] },
  { path: "plugins.entries.research-engine.enabled", value: true },
  { path: "plugins.entries.research-engine.config.projectRoot", value: root },
];

for (const [id, name, workspace, agentModel, tools] of entries) {
  const settings = { workspace: path.join(root, "agents", workspace), model: agentModel, thinkingDefault: "off", reasoningDefault: "off", skills: [], tools };
  if (!existingIds.has(id)) {
    batch.push({ path: `agents.entries.${id}`, value: { name, ...settings } });
  } else {
    batch.push({ path: `agents.entries.${id}.name`, value: name });
    for (const [key, value] of Object.entries(settings)) {
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
console.log(`Research plugin and four agent entries configured for ${root} (orchestrator: ${model}, reviewers: ${reviewModel}); existing default agent preserved.`);
