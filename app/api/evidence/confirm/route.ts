import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { executeResearchCommand, readProject } from "../../../../plugins/research-engine/engine.mjs";
import { errorResponse, noStore, projectRoot, requireSameOrigin } from "../../../../src/server-utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const body = await request.json();
    if (typeof body.nodeId !== "string" || !body.nodeId) throw new Error("Evidence node ID is required");
    const current = await readProject(projectRoot);
    if (!current) throw new Error("No investigation exists");
    const project = await executeResearchCommand(projectRoot, {
      op: "confirm_evidence", commandId: `ui-confirm-${body.nodeId}-${randomUUID()}`,
      baseRevision: current.revision, payload: { nodeId: body.nodeId },
    });
    return NextResponse.json({ project }, { headers: noStore });
  } catch (error) {
    return errorResponse(error, 400);
  }
}
