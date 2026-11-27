import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  deleteProject,
  executeResearchCommand,
  listProjects,
  readProject,
  recoverInterruptedProjects,
  setActiveProject,
} from "../../../plugins/research-engine/engine.mjs";
import { importProjectBundle } from "../../../src/bundle-io.mjs";
import { activeProjectIds, activeRuns } from "../../../src/research-runtime.mjs";
import { seedSampleInvestigation } from "../../../src/sample-project.mjs";
import { errorResponse, noStore, projectRoot, requireSameOrigin } from "../../../src/server-utils";
import { ensureWorkspaceScaffold } from "../../../src/workspace-files.mjs";

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
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("Bundle file (.zip or .json) is required");
      const buf = Buffer.from(await file.arrayBuffer());
      const imported = await importProjectBundle(projectRoot, buf);
      const listed = await listProjects(projectRoot);
      return NextResponse.json({
        project: imported.project,
        projects: listed.projects,
        activeProjectId: listed.activeProjectId,
        filesRestored: imported.filesRestored,
        hasRoCrate: imported.hasRoCrate,
        verification: imported.verification,
      }, { headers: noStore });
    }

    const body = await request.json();
    if (body.action === "load-sample") {
      const project = await seedSampleInvestigation(projectRoot);
      const listed = await listProjects(projectRoot);
      return NextResponse.json({ project, projects: listed.projects, activeProjectId: listed.activeProjectId }, { headers: noStore });
    }
    if (body.action === "create-blank") {
      const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 160) : "New Research Workspace";
      const curiosity = typeof body.curiosity === "string" && body.curiosity.trim()
        ? body.curiosity.trim().slice(0, 4000)
        : "Manual & literature-grounded investigation workspace";
      const created = await executeResearchCommand(projectRoot, {
        op: "create",
        commandId: `ui-blank-${randomUUID()}`,
        curiosity,
        title,
        mode: "guided",
      });
      const project = await executeResearchCommand(projectRoot, {
        projectId: created.projectId,
        commandId: `ui-blank-ready-${randomUUID()}`,
        baseRevision: created.revision,
        op: "set_status",
        payload: { status: "ready", message: "Blank manual workspace initialized (no AI key required)" },
      });
      await ensureWorkspaceScaffold(projectRoot, project.projectId, project);
      const listed = await listProjects(projectRoot);
      return NextResponse.json({ project, projects: listed.projects, activeProjectId: listed.activeProjectId }, { headers: noStore });
    }
    if (body.action === "import-bundle" && body.json) {
      const imported = await importProjectBundle(projectRoot, typeof body.json === "string" ? body.json : JSON.stringify(body.json));
      const listed = await listProjects(projectRoot);
      return NextResponse.json({
        project: imported.project,
        projects: listed.projects,
        activeProjectId: listed.activeProjectId,
        filesRestored: imported.filesRestored,
        hasRoCrate: imported.hasRoCrate,
        verification: imported.verification,
      }, { headers: noStore });
    }
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
