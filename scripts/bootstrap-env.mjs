import { chmod, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const configPath = path.join(os.homedir(), ".openclaw", "openclaw.json");
let token = process.env.OPENCLAW_GATEWAY_TOKEN || "";
let port = 18789;
try {
  const config = JSON.parse(await readFile(configPath, "utf8"));
  token ||= typeof config.gateway?.auth?.token === "string" ? config.gateway.auth.token : "";
  if (Number.isInteger(config.gateway?.port)) port = config.gateway.port;
} catch { /* OpenClaw may not be installed in standalone mode. */ }

const envPath = path.join(root, ".env");
let existing = "";
try { existing = await readFile(envPath, "utf8"); } catch { /* Fresh .env */ }

const values = {
  RESEARCH_HARNESS: token ? "openclaw" : (process.env.RESEARCH_HARNESS || "standalone"),
  OPENCLAW_GATEWAY_URL: `ws://127.0.0.1:${port}`,
  OPENCLAW_HTTP_URL: `http://127.0.0.1:${port}`,
  OPENCLAW_GATEWAY_TOKEN: token,
  RESEARCH_AGENT_ID: "research",
  RESEARCH_PROVIDER: process.env.RESEARCH_PROVIDER || "cerebras",
  RESEARCH_MODEL: process.env.RESEARCH_MODEL || "cerebras/moonshotai-kimi-k3.1-pro-trial",
  PORT: "3000",
};

const preserveIfNonEmpty = new Set([
  "OPENCLAW_GATEWAY_TOKEN",
  "CEREBRAS_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "OPENROUTER_API_KEY",
  "RESEARCH_HARNESS",
  "RESEARCH_MODEL",
  "RESEARCH_PROVIDER",
]);

const seen = new Set();
const lines = existing.split(/\r?\n/).filter((line) => line.length > 0).map((rawLine) => {
  const line = rawLine.replace(/\r$/, "");
  const match = line.match(/^([A-Z][A-Z0-9_]*)=/);
  if (!match || !(match[1] in values)) return line;
  const key = match[1];
  seen.add(key);
  const existingValue = line.slice(key.length + 1).trim();
  if (preserveIfNonEmpty.has(key) && existingValue) return line;
  return `${key}=${values[key]}`;
});

for (const [key, value] of Object.entries(values)) {
  if (!seen.has(key)) lines.push(`${key}=${value}`);
}

await writeFile(envPath, `${lines.join("\n")}\n`, { mode: 0o600 });
try { await chmod(envPath, 0o600); } catch { /* Ignore POSIX chmod errors on Windows. */ }
console.log(`Local .env written (Gateway token ${token ? "discovered" : "not found — standalone mode ready"}; secrets not printed).`);
