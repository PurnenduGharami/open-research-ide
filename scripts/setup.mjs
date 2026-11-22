#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const openclawCmd = process.platform === "win32" ? "openclaw.cmd" : "openclaw";

function run(cmd, args, { optional = false } = {}) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit" });
  if (result.error || result.status !== 0) {
    if (optional) return false;
    process.exit(result.status || 1);
  }
  return true;
}

console.log("Open Research IDE — Cross-Platform Setup");
run(process.execPath, [path.join(root, "scripts", "bootstrap-env.mjs")]);
run(npmCmd, ["ci"]);

const hasOpenClaw = spawnSync(openclawCmd, ["--version"], { stdio: "ignore" }).status === 0;
if (hasOpenClaw) {
  console.log("OpenClaw detected — registering research plugin and agents...");
  run(process.execPath, [path.join(root, "scripts", "configure-openclaw.mjs")]);
  run(openclawCmd, ["config", "validate"], { optional: true });
} else {
  console.log("OpenClaw CLI not detected — Standalone Runtime is ready (configure any provider in .env or the Setup Modal).");
}

run(npmCmd, ["run", "preflight"], { optional: true });
console.log("\nSetup complete. Start the local IDE with: npm run dev");
console.log("Open http://127.0.0.1:3000");
