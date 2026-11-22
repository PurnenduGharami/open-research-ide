import "./load-env.mjs";
import { preflight, getGateway, closeGateway } from "../src/gateway.mjs";

try {
  const result = await preflight();
  const gateway = await getGateway();
  const agentPayload = await gateway.request("agents.list", {});
  const rows = Array.isArray(agentPayload) ? agentPayload : agentPayload.agents || agentPayload.entries || [];
  const reviewers = ["research-auditor", "research-critic", "research-feasibility"];
  const checks = [
    { id: "gateway", label: "OpenClaw Gateway", ok: result.gateway === "connected", detail: `${result.gateway}; protocol ${result.protocol}` },
    { id: "model", label: "Cerebras model", ok: result.cerebrasModel !== "not advertised", detail: result.cerebrasModel },
    { id: "elephant", label: "Elephant orchestrator", ok: result.researchAgent === "configured", detail: result.researchAgent },
    ...reviewers.map((id) => ({ id, label: `Reviewer ${id}`, ok: rows.some((agent) => agent.id === id), detail: rows.some((agent) => agent.id === id) ? "configured" : "missing" })),
  ];
  const ok = checks.every((check) => check.ok) && result.ok;
  console.log(JSON.stringify({ ...result, ok, checks }, null, 2));
  if (!ok) process.exitCode = 1;
} catch (error) {
  console.log(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error), note: "No research session or generation was created." }, null, 2));
  process.exitCode = 1;
} finally {
  await closeGateway();
}
