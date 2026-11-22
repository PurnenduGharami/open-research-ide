#!/usr/bin/env node
import path from "node:path";
import { exportProject } from "../src/export-renderer.mjs";

const args = process.argv.slice(2);
if (args.length > 1 || args[0]?.startsWith("-")) {
  console.error("Usage: node scripts/export-project.mjs [project-root]");
  process.exitCode = 1;
} else {
  const root = path.resolve(args[0] || process.cwd());
  try {
    const result = await exportProject(root);
    console.log(`revision\t${result.revision}`);
    for (const file of result.files) console.log(`${file.format}\t${path.join(root, file.path)}\tsha256:${file.sha256}`);
  } catch (error) {
    console.error(`Export failed: ${error?.message || error}`);
    process.exitCode = 1;
  }
}
