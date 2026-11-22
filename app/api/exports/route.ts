import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { executeResearchCommand, readProject } from "../../../plugins/research-engine/engine.mjs";
import { exportProject } from "../../../src/export-renderer.mjs";
import { errorResponse, noStore, projectRoot, requireSameOrigin } from "../../../src/server-utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    let projectId: string | undefined;
    try {
      const body = await request.json();
      if (typeof body?.projectId === "string" && body.projectId) projectId = body.projectId;
    } catch { /* Empty POST body allowed. */ }
    const result = await exportProject(projectRoot, projectId);
    const current = await readProject(projectRoot, projectId);
    if (!current || current.revision !== result.revision) {
      throw new Error(`Canonical revision changed during export; generated files remain revision ${result.revision}`);
    }
    const updated = await executeResearchCommand(projectRoot, {
      projectId: current.projectId,
      op: "record_exports",
      commandId: `ui-export-${randomUUID()}`,
      baseRevision: result.revision,
      payload: { exports: result.files },
    });
    const files = result.files.map((file) => ({ ...file, url: `/api/exports/${file.format}?projectId=${encodeURIComponent(current.projectId)}` }));
    return NextResponse.json({ ...result, project: updated, files }, { headers: noStore });
  } catch (error) {
    return errorResponse(error, 400);
  }
}
