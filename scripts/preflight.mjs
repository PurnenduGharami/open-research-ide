import "./load-env.mjs";
import { runPreflight } from "../src/harnesses/harness-adapter.mjs";

try {
  const result = await runPreflight(process.cwd());
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
} catch (error) {
  console.log(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    note: "No research session or generation was created.",
  }, null, 2));
  process.exitCode = 1;
}
