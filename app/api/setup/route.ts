import { NextResponse } from "next/server";
import { closeGateway, getGateway, preflight } from "../../../src/gateway.mjs";
import { errorResponse, noStore } from "../../../src/server-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await preflight();
    const gateway = await getGateway();
    const payload = await gateway.request("agents.list", {});
    const rows = Array.isArray(payload) ? payload : payload.agents || payload.entries || [];
    const reviewerIds = ["research-auditor", "research-critic", "research-feasibility"];
    const checks = [
      { id: "gateway", label: "OpenClaw Gateway", ok: result.gateway === "connected", detail: `Connected; protocol ${result.protocol}` },
      { id: "model", label: "Cerebras / Kimi", ok: result.cerebrasModel !== "not advertised", detail: result.cerebrasModel },
      { id: "research", label: "Elephant orchestrator", ok: result.researchAgent === "configured", detail: result.researchAgent },
      ...reviewerIds.map((id) => ({ id, label: id.replace("research-", ""), ok: rows.some((agent: { id: string }) => agent.id === id), detail: rows.some((agent: { id: string }) => agent.id === id) ? "Configured" : "Missing" })),
    ];
    return NextResponse.json({ ok: Boolean(result.ok) && checks.every((check) => check.ok), checks, note: "Non-generative preflight only. No research session was created." }, { headers: noStore });
  } catch (error) {
    return errorResponse(error, 503);
  }
}
