import { NextRequest, NextResponse } from "next/server";
import { readProject } from "../../../plugins/research-engine/engine.mjs";
import { errorResponse, noStore, projectRoot, requireSameOrigin } from "../../../src/server-utils";
import {
  computeWikilinksAndBacklinks,
  createWorkspaceFolder,
  deleteWorkspaceEntry,
  ensureWorkspaceScaffold,
  listWorkspaceFiles,
  readWorkspaceFile,
  renameWorkspaceEntry,
  writeWorkspaceFile,
} from "../../../src/workspace-files.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const requestedProjectId = request.nextUrl.searchParams.get("projectId") || undefined;
    const project = await readProject(projectRoot, requestedProjectId);
    if (!project) throw new Error("No investigation exists");
    await ensureWorkspaceScaffold(projectRoot, project.projectId, project);

    const filePath = request.nextUrl.searchParams.get("path");
    const raw = request.nextUrl.searchParams.get("raw") === "1";

    if (filePath) {
      const file = await readWorkspaceFile(projectRoot, project.projectId, filePath);
      if (raw) {
        return new Response(new Uint8Array(file.buffer), {
          headers: {
            "Content-Type": file.mimeType,
            "Content-Length": String(file.size),
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",
            "Content-Disposition": `inline; filename="${file.name.replace(/"/g, "")}"`,
          },
        });
      }
      const { buffer: _buf, ...rest } = file;
      const links = await computeWikilinksAndBacklinks(projectRoot, project.projectId, project);
      return NextResponse.json({
        file: rest,
        backlinks: links.backlinks[file.path] || links.backlinks[file.name] || [],
        forwardLinks: links.forward[file.path] || [],
      }, { headers: noStore });
    }

    const [tree, links] = await Promise.all([
      listWorkspaceFiles(projectRoot, project.projectId),
      computeWikilinksAndBacklinks(projectRoot, project.projectId, project),
    ]);
    return NextResponse.json({ projectId: project.projectId, files: tree, links }, { headers: noStore });
  } catch (error) {
    return errorResponse(error, 400);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const projectId = typeof form.get("projectId") === "string" ? String(form.get("projectId")) : undefined;
      const folder = typeof form.get("folder") === "string" ? String(form.get("folder")).trim() : "data";
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("File upload missing");
      const current = await readProject(projectRoot, projectId);
      if (!current) throw new Error("No investigation exists");
      await ensureWorkspaceScaffold(projectRoot, current.projectId, current);
      const safeName = file.name.replace(/[/\\]/g, "_").replace(/^\.+/, "") || "upload.bin";
      const relPath = folder ? `${folder.replace(/\/+$/, "")}/${safeName}` : safeName;
      const buf = Buffer.from(await file.arrayBuffer());
      const written = await writeWorkspaceFile(projectRoot, current.projectId, relPath, buf);
      const files = await listWorkspaceFiles(projectRoot, current.projectId);
      return NextResponse.json({ written, files }, { headers: noStore });
    }

    const body = await request.json();
    const current = await readProject(projectRoot, typeof body.projectId === "string" ? body.projectId : undefined);
    if (!current) throw new Error("No investigation exists");
    await ensureWorkspaceScaffold(projectRoot, current.projectId, current);

    if (body.action === "write") {
      if (typeof body.path !== "string" || !body.path.trim()) throw new Error("File path is required");
      const written = await writeWorkspaceFile(projectRoot, current.projectId, body.path, String(body.content ?? ""));
      const files = await listWorkspaceFiles(projectRoot, current.projectId);
      return NextResponse.json({ written, files }, { headers: noStore });
    }
    if (body.action === "mkdir") {
      if (typeof body.path !== "string" || !body.path.trim()) throw new Error("Folder path is required");
      await createWorkspaceFolder(projectRoot, current.projectId, body.path);
      const files = await listWorkspaceFiles(projectRoot, current.projectId);
      return NextResponse.json({ files }, { headers: noStore });
    }
    if (body.action === "rename") {
      if (typeof body.from !== "string" || typeof body.to !== "string") throw new Error("Source and destination paths required");
      await renameWorkspaceEntry(projectRoot, current.projectId, body.from, body.to);
      const files = await listWorkspaceFiles(projectRoot, current.projectId);
      return NextResponse.json({ files }, { headers: noStore });
    }
    if (body.action === "scaffold") {
      const files = await listWorkspaceFiles(projectRoot, current.projectId);
      return NextResponse.json({ files }, { headers: noStore });
    }
    throw new Error("Unsupported file workspace action");
  } catch (error) {
    return errorResponse(error, 400);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const body = await request.json();
    const current = await readProject(projectRoot, typeof body.projectId === "string" ? body.projectId : undefined);
    if (!current) throw new Error("No investigation exists");
    if (typeof body.path !== "string" || !body.path.trim()) throw new Error("File path is required");
    const removed = await deleteWorkspaceEntry(projectRoot, current.projectId, body.path);
    const files = await listWorkspaceFiles(projectRoot, current.projectId);
    return NextResponse.json({ ...removed, files }, { headers: noStore });
  } catch (error) {
    return errorResponse(error, 400);
  }
}
