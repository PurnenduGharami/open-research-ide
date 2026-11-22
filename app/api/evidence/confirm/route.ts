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
    const projectId = typeof body.projectId === "string" ? body.projectId : undefined;
    const action = body.action === "reject" ? "reject_evidence" : body.action === "unconfirm" ? "unconfirm_evidence" : "confirm_evidence";
    const current = await readProject(projectRoot, projectId);
    if (!current) throw new Error("No investigation exists");
    const project = await executeResearchCommand(projectRoot, {
      projectId: current.projectId,
      op: action,
      commandId: `ui-${action}-${body.nodeId}-${randomUUID()}`,
      baseRevision: current.revision,
      payload: {
        nodeId: body.nodeId,
        ...(typeof body.reason === "string" ? { reason: body.reason } : {}),
      },
    });
    return NextResponse.json({ project }, { headers: noStore });
  } catch (error) {
    return errorResponse(error, 400);
  }
}
