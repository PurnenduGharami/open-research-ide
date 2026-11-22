import { NextRequest, NextResponse } from "next/server";
import {
  deleteProject,
  listProjects,
  readProject,
  recoverInterruptedProjects,
  setActiveProject,
} from "../../../plugins/research-engine/engine.mjs";
import { activeProjectIds, activeRuns } from "../../../src/research-runtime.mjs";
import { errorResponse, noStore, projectRoot, requireSameOrigin } from "../../../src/server-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let recoveredOnce = false;

export async function GET(request: NextRequest) {
  try {
    if (!recoveredOnce) {
      recoveredOnce = true;
      await recoverInterruptedProjects(projectRoot, activeProjectIds()).catch(() => {});
    }
    const requestedId = request.nextUrl.searchParams.get("projectId") || undefined;
    const listed = await listProjects(projectRoot);
    const project = await readProject(projectRoot, requestedId);
    return NextResponse.json({
      project,
      projects: listed.projects,
      activeProjectId: listed.activeProjectId,
      runs: activeRuns(),
    }, { headers: noStore });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const body = await request.json();
    if (body.action === "switch" && typeof body.projectId === "string") {
      const project = await setActiveProject(projectRoot, body.projectId);
      const listed = await listProjects(projectRoot);
      return NextResponse.json({ project, projects: listed.projects, activeProjectId: listed.activeProjectId }, { headers: noStore });
    }
    if (body.action === "delete" && typeof body.projectId === "string") {
      const index = await deleteProject(projectRoot, body.projectId);
      const project = index.activeProjectId ? await readProject(projectRoot, index.activeProjectId) : null;
      return NextResponse.json({ project, projects: index.projects, activeProjectId: index.activeProjectId }, { headers: noStore });
    }
    throw new Error("Unsupported project action");
  } catch (error) {
    return errorResponse(error, 400);
  }
}
