import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { projectExportsDir, readProject } from "../../../../plugins/research-engine/engine.mjs";
import { buildRoCrateMetadata, renderProjectLatex } from "../../../../src/export-renderer.mjs";
import { errorResponse, projectRoot } from "../../../../src/server-utils";
import { collectAllWorkspaceFilesFlat } from "../../../../src/workspace-files.mjs";
import type { LatexTemplate } from "../../../../packages/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const files = {
  html: { relative: "research-report.html", type: "text/html; charset=utf-8", name: "research-report.html" },
  pdf: { relative: "pdf/research-report.pdf", type: "application/pdf", name: "research-report.pdf" },
  latex: { relative: "latex/main.tex", type: "application/x-tex; charset=utf-8", name: "main.tex" },
  bib: { relative: "latex/references.bib", type: "text/plain; charset=utf-8", name: "references.bib" },
  zip: { relative: "research-bundle.zip", type: "application/zip", name: "open-research-bundle.zip" },
} as const;

export async function GET(request: NextRequest, context: { params: Promise<{ format: string }> }) {
  try {
    const { format } = await context.params;
    const requestedProjectId = request.nextUrl.searchParams.get("projectId") || undefined;

    if (format === "rocrate") {
      const project = await readProject(projectRoot, requestedProjectId);
      if (!project) return new Response("Project not found", { status: 404 });
      const flat = await collectAllWorkspaceFilesFlat(projectRoot, project.projectId).catch(() => []);
      const crate = buildRoCrateMetadata(
        project,
        flat.map((f) => ({ path: `files/${f.relPath}`, mimeType: f.mimeType, size: f.size, sha256: f.sha256 })),
      );
      return new Response(crate, {
        headers: {
          "Content-Type": "application/ld+json; charset=utf-8",
          "Content-Disposition": 'attachment; filename="ro-crate-metadata.json"',
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const template = request.nextUrl.searchParams.get("template");
    if (format === "latex" && template && ["ieee", "neurips", "nature"].includes(template)) {
      const project = await readProject(projectRoot, requestedProjectId);
      if (!project) return new Response("Project not found", { status: 404 });
      const rendered = renderProjectLatex(project, { template: template as LatexTemplate });
      return new Response(rendered.mainTex, {
        headers: {
          "Content-Type": "application/x-tex; charset=utf-8",
          "Content-Disposition": `attachment; filename="main-${template}.tex"`,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    if (!(format in files)) return new Response("Unknown export format", { status: 404 });
    const item = files[format as keyof typeof files];
    const root = requestedProjectId
      ? projectExportsDir(projectRoot, requestedProjectId)
      : path.join(projectRoot, "workspace", "exports");
    const filename = path.resolve(root, item.relative);
    if (!filename.startsWith(`${path.resolve(root)}${path.sep}`)) return new Response("Invalid path", { status: 400 });
    const content = await readFile(/* turbopackIgnore: true */ filename);
    return new Response(content, {
      headers: {
        "Content-Type": item.type,
        "Content-Disposition": `attachment; filename="${item.name}"`,
        "Content-Length": String(content.byteLength),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error, 404);
  }
}
