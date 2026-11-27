import { NextRequest, NextResponse } from "next/server";
import { readProject } from "../../../plugins/research-engine/engine.mjs";
import { errorResponse, noStore, projectRoot } from "../../../src/server-utils";
import { ensureWorkspaceScaffold, searchWorkspace } from "../../../src/workspace-files.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId") || undefined;
    const query = request.nextUrl.searchParams.get("q") || "";
    const project = await readProject(projectRoot, projectId);
    if (!project) throw new Error("No investigation exists");
    await ensureWorkspaceScaffold(projectRoot, project.projectId, project);
    const results = await searchWorkspace(projectRoot, project.projectId, project, query);
    return NextResponse.json(results, { headers: noStore });
  } catch (error) {
    return errorResponse(error, 400);
  }
}
