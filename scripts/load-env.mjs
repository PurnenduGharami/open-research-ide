import { readFileSync } from "node:fs";
import path from "node:path";

try {
  const source = readFileSync(path.join(process.cwd(), ".env"), "utf8");
  for (const line of source.split("\n")) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
} catch { /* Next.js or the caller may provide environment variables directly. */ }
