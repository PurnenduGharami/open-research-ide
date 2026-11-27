#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

function run(cmd, args, { optional = false } = {}) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit" });
  if (result.error || result.status !== 0) {
    if (optional) return false;
    process.exit(result.status || 1);
  }
  return true;
}

console.log("Open Research IDE — Cross-Platform Setup (Google Gemini Standalone Runtime)");
run(process.execPath, [path.join(root, "scripts", "bootstrap-env.mjs")]);
run(npmCmd, ["ci"]);
run(npmCmd, ["run", "preflight"], { optional: true });

console.log("\nSetup complete. Add GEMINI_API_KEY in .env (or via Setup in the UI) and start with:");
console.log("  npm run dev");
console.log("Open http://127.0.0.1:3000 (or try 'Explore Sample Investigation' without an API key).");
