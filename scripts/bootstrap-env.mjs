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
} catch {}
const envPath = path.join(root, ".env");
let existing = "";
try { existing = await readFile(envPath, "utf8"); } catch {}
const values = {
  OPENCLAW_GATEWAY_URL: `ws://127.0.0.1:${port}`,
  OPENCLAW_HTTP_URL: `http://127.0.0.1:${port}`,
  OPENCLAW_GATEWAY_TOKEN: token,
  RESEARCH_AGENT_ID: "research",
  RESEARCH_MODEL: "cerebras/moonshotai-kimi-k3.1-pro-trial",
  PORT: "3000",
};
const seen = new Set();
const lines = existing.split("\n").filter(Boolean).map((line) => {
  const match = line.match(/^([A-Z][A-Z0-9_]*)=/);
  if (!match || !(match[1] in values)) return line;
  seen.add(match[1]);
  const key = match[1];
  const existingValue = line.slice(key.length + 1);
  if ((key === "OPENCLAW_GATEWAY_TOKEN" || key === "CEREBRAS_API_KEY") && existingValue) return line;
  return `${key}=${values[key]}`;
});
for (const [key, value] of Object.entries(values)) if (!seen.has(key)) lines.push(`${key}=${value}`);
await writeFile(envPath, `${lines.join("\n")}\n`, { mode: 0o600 });
await chmod(path.join(root, ".env"), 0o600);
console.log(`Local .env written (Gateway token ${token ? "discovered" : "missing"}; values not printed).`);
