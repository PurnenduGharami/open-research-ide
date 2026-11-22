import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { executeResearchCommand, readProject } from "../../../plugins/research-engine/engine.mjs";
import { parseCsvSummary } from "../../../src/validation-tools.mjs";
import { boundedText, errorResponse, noStore, projectRoot, requireSameOrigin } from "../../../src/server-utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const body = await request.json();
    if (typeof body.experimentId !== "string" || !body.experimentId) throw new Error("Experiment ID is required");
    const csvSummary = typeof body.csvText === "string" && body.csvText.trim() ? parseCsvSummary(body.csvText) : null;
    const rawObs = typeof body.observations === "string" && body.observations.trim()
      ? body.observations.trim()
      : csvSummary?.preview || "";
    const observations = boundedText(rawObs, "Observations", 1, 50000);
    const metricResults = Array.isArray(body.metricResults)
      ? body.metricResults
          .filter((row: Record<string, unknown>) => row && typeof row.metric === "string" && typeof row.observed === "string" && row.observed.trim())
          .map((row: Record<string, unknown>) => ({
            metric: String(row.metric).slice(0, 200),
            expected: String(row.expected || "").slice(0, 500),
            observed: String(row.observed).slice(0, 1000),
            verdict: ["supports", "contradicts", "inconclusive"].includes(String(row.verdict)) ? String(row.verdict) : "inconclusive",
            ...(typeof row.notes === "string" && row.notes.trim() ? { notes: row.notes.trim().slice(0, 500) } : {}),
          }))
      : [];
    const current = await readProject(projectRoot, typeof body.projectId === "string" ? body.projectId : undefined);
    if (!current) throw new Error("No investigation exists");
    const project = await executeResearchCommand(projectRoot, {
      projectId: current.projectId,
      op: "import_result",
      commandId: `ui-result-${randomUUID()}`,
      baseRevision: current.revision,
      payload: {
        experimentId: body.experimentId,
        observations,
        metricResults,
        ...(typeof body.datasetName === "string" ? { datasetName: body.datasetName } : {}),
        ...(csvSummary ? { datasetSummary: csvSummary.preview } : {}),
        ...(typeof body.sourceModality === "string" ? { sourceModality: body.sourceModality } : {}),
        result: { title: "Imported experimental observations", sourceRefs: [], data: { importedAt: new Date().toISOString() } },
      },
    });
    return NextResponse.json({ project }, { headers: noStore });
  } catch (error) {
    return errorResponse(error, 400);
  }
}
