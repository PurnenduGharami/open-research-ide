import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { projectExportsDir } from "../../../../plugins/research-engine/engine.mjs";
import { errorResponse, projectRoot } from "../../../../src/server-utils";

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
    if (!(format in files)) return new Response("Unknown export format", { status: 404 });
    const item = files[format as keyof typeof files];
    const requestedProjectId = request.nextUrl.searchParams.get("projectId") || undefined;
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
