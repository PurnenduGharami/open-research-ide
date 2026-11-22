import { readFile } from "node:fs/promises";
import path from "node:path";
import { errorResponse, projectRoot } from "../../../../src/server-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const files = {
  html: { relative: "research-report.html", type: "text/html; charset=utf-8", name: "research-report.html" },
  pdf: { relative: "pdf/research-report.pdf", type: "application/pdf", name: "research-report.pdf" },
  latex: { relative: "latex/main.tex", type: "application/x-tex; charset=utf-8", name: "main.tex" },
  bib: { relative: "latex/references.bib", type: "text/plain; charset=utf-8", name: "references.bib" },
} as const;

export async function GET(_request: Request, context: { params: Promise<{ format: string }> }) {
  try {
    const { format } = await context.params;
    if (!(format in files)) return new Response("Unknown export format", { status: 404 });
    const item = files[format as keyof typeof files];
    const root = path.join(projectRoot, "workspace", "exports");
    const filename = path.resolve(root, item.relative);
    if (!filename.startsWith(`${path.resolve(root)}${path.sep}`)) return new Response("Invalid path", { status: 400 });
    const content = await readFile(filename);
    return new Response(content, { headers: {
      "Content-Type": item.type, "Content-Disposition": `attachment; filename="${item.name}"`,
      "Content-Length": String(content.byteLength), "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    return errorResponse(error, 404);
  }
}
