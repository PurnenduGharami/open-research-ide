import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { executeResearchCommand, readProject } from "../../../plugins/research-engine/engine.mjs";
import { errorResponse, noStore, projectRoot, requireSameOrigin } from "../../../src/server-utils";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const body = await request.json();
    if (typeof body.nodeId !== "string" || !body.nodeId) throw new Error("Node ID is required");
    const current = await readProject(projectRoot, typeof body.projectId === "string" ? body.projectId : undefined);
    if (!current) throw new Error("No investigation exists");
    const project = await executeResearchCommand(projectRoot, {
      projectId: current.projectId,
      op: "update_node",
      commandId: `ui-update-node-${randomUUID()}`,
      baseRevision: current.revision,
      payload: {
        nodeId: body.nodeId,
        ...(typeof body.title === "string" ? { title: body.title } : {}),
        ...(body.data && typeof body.data === "object" ? { data: body.data } : {}),
      },
    });
    return NextResponse.json({ project }, { headers: noStore });
  } catch (error) {
    return errorResponse(error, 400);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const body = await request.json();
    if (typeof body.nodeId !== "string" || !body.nodeId) throw new Error("Node ID is required");
    const current = await readProject(projectRoot, typeof body.projectId === "string" ? body.projectId : undefined);
    if (!current) throw new Error("No investigation exists");
    const project = await executeResearchCommand(projectRoot, {
      projectId: current.projectId,
      op: "delete_node",
      commandId: `ui-delete-node-${randomUUID()}`,
      baseRevision: current.revision,
      payload: { nodeId: body.nodeId },
    });
    return NextResponse.json({ project }, { headers: noStore });
  } catch (error) {
    return errorResponse(error, 400);
  }
}
