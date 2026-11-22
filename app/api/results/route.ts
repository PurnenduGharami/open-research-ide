import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { executeResearchCommand, readProject } from "../../../plugins/research-engine/engine.mjs";
import { boundedText, errorResponse, noStore, projectRoot, requireSameOrigin } from "../../../src/server-utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const body = await request.json();
    if (typeof body.experimentId !== "string" || !body.experimentId) throw new Error("Experiment ID is required");
    const observations = boundedText(body.observations, "Observations", 1, 50000);
    const current = await readProject(projectRoot);
    if (!current) throw new Error("No investigation exists");
    const project = await executeResearchCommand(projectRoot, {
      op: "import_result", commandId: `ui-result-${randomUUID()}`, baseRevision: current.revision,
      payload: { experimentId: body.experimentId, observations, result: { title: "Imported experimental observations", sourceRefs: [], data: { importedAt: new Date().toISOString() } } },
    });
    return NextResponse.json({ project }, { headers: noStore });
  } catch (error) {
    return errorResponse(error, 400);
  }
}
