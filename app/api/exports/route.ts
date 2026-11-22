import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { executeResearchCommand, readProject } from "../../../plugins/research-engine/engine.mjs";
import { exportProject } from "../../../src/export-renderer.mjs";
import { errorResponse, noStore, projectRoot, requireSameOrigin } from "../../../src/server-utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const result = await exportProject(projectRoot);
    const current = await readProject(projectRoot);
    if (!current || current.revision !== result.revision) throw new Error(`Canonical revision changed during export; generated files remain revision ${result.revision}`);
    await executeResearchCommand(projectRoot, {
      op: "record_exports", commandId: `ui-export-${randomUUID()}`, baseRevision: result.revision,
      payload: { exports: result.files },
    });
    const files = result.files.map((file) => ({ ...file, url: `/api/exports/${file.format}` }));
    return NextResponse.json({ ...result, files }, { headers: noStore });
  } catch (error) {
    return errorResponse(error, 400);
  }
}
