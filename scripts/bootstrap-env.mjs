import { chmod, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const envPath = path.join(root, ".env");
let existing = "";
try { existing = await readFile(envPath, "utf8"); } catch { /* Fresh .env */ }

const values = {
  RESEARCH_HARNESS: "standalone",
  RESEARCH_AGENT_ID: "research",
  RESEARCH_PROVIDER: process.env.RESEARCH_PROVIDER || "gemini",
  RESEARCH_MODEL: process.env.RESEARCH_MODEL || "gemini-2.5-flash",
  RESEARCH_REVIEW_PROVIDER: process.env.RESEARCH_REVIEW_PROVIDER || "gemini",
  RESEARCH_REVIEW_MODEL: process.env.RESEARCH_REVIEW_MODEL || "gemini-2.5-flash",
  PORT: "3000",
};

const preserveIfNonEmpty = new Set([
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "VERTEX_API_KEY",
  "GOOGLE_CLOUD_PROJECT",
  "GOOGLE_CLOUD_LOCATION",
  "CUSTOM_API_KEY",
  "RESEARCH_MODEL",
  "RESEARCH_PROVIDER",
  "RESEARCH_REVIEW_MODEL",
  "RESEARCH_REVIEW_PROVIDER",
  "OPENALEX_MAILTO",
  "SEMANTIC_SCHOLAR_API_KEY",
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
console.log("Local .env written (Direct Standalone Runtime with Google Gemini ready; secrets not printed).");
