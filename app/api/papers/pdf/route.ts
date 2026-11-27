import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { executeResearchCommand, readProject } from "../../../../plugins/research-engine/engine.mjs";
import { generateCiteKey } from "../../../../src/citations.mjs";
import { extractPdfTextFromBuffer, fetchOpenAccessPdf } from "../../../../src/pdf-engine.mjs";
import { errorResponse, noStore, projectRoot, requireSameOrigin } from "../../../../src/server-utils";
import { ensureWorkspaceScaffold, writeWorkspaceFile } from "../../../../src/workspace-files.mjs";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const projectId = typeof form.get("projectId") === "string" ? String(form.get("projectId")) : undefined;
      const targetPaperId = typeof form.get("paperId") === "string" && String(form.get("paperId")).trim()
        ? String(form.get("paperId")).trim()
        : undefined;
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("PDF file is required");

      const current = await readProject(projectRoot, projectId);
      if (!current) throw new Error("No investigation exists");
      await ensureWorkspaceScaffold(projectRoot, current.projectId, current);

      const buffer = Buffer.from(await file.arrayBuffer());
      const extracted = await extractPdfTextFromBuffer(buffer);
      const safeName = file.name.replace(/[/\\]/g, "_").replace(/^\.+/, "").replace(/\.pdf$/i, "") || `paper-${randomUUID().slice(0, 6)}`;
      const pdfAssetPath = `papers/${safeName}.pdf`;
      await writeWorkspaceFile(projectRoot, current.projectId, pdfAssetPath, buffer);

      let paperId = targetPaperId;
      let project = current;

      if (!paperId) {
        paperId = `paper:pdf:${randomUUID().slice(0, 8)}`;
        const title = extracted.inferredTitle || safeName.replace(/[_-]+/g, " ");
        const firstPageExcerpt = (extracted.pages[0]?.text || "").slice(0, 1400);
        project = await executeResearchCommand(projectRoot, {
          projectId: current.projectId,
          op: "upsert_nodes",
          commandId: `ui-pdf-paper-${randomUUID()}`,
          baseRevision: project.revision,
          payload: {
            nodes: [{
              id: paperId,
              type: "paper",
              title,
              sourceRefs: ["Local PDF"],
              data: {
                title,
                doi: extracted.inferredDoi || "",
                abstract: firstPageExcerpt,
                provider: "Local PDF",
                providers: ["Local PDF"],
                citeKey: generateCiteKey({ title, authors: [], year: null }),
                readingStatus: "reading",
              },
            }],
          },
        });
        const litBlock = project.uiBlocks.find((b) => b.kind === "literature");
        project = await executeResearchCommand(projectRoot, {
          projectId: current.projectId,
          op: "set_blocks",
          commandId: `ui-pdf-block-${randomUUID()}`,
          baseRevision: project.revision,
          payload: {
            blocks: [{
              id: litBlock?.id || `literature:pdf:${current.projectId}`,
              kind: "literature",
              title: litBlock?.title || "Peer-Reviewed Literature",
              nodeIds: [...new Set([...(litBlock?.nodeIds || []), paperId])],
            }],
          },
        });
      }

      project = await executeResearchCommand(projectRoot, {
        projectId: current.projectId,
        op: "attach_paper_fulltext",
        commandId: `ui-pdf-fulltext-${randomUUID()}`,
        baseRevision: project.revision,
        payload: {
          paperId,
          fullText: extracted.fullText,
          pages: extracted.pages,
          pageCount: extracted.pageCount,
          fullTextSha256: extracted.fullTextSha256,
          pdfAssetPath,
        },
      });

      return NextResponse.json({
        project,
        paperId,
        pageCount: extracted.pageCount,
        pdfAssetPath,
      }, { headers: noStore });
    }

    const body = await request.json();
    const current = await readProject(projectRoot, typeof body.projectId === "string" ? body.projectId : undefined);
    if (!current) throw new Error("No investigation exists");
    if (body.action !== "fetch-oa" || typeof body.paperId !== "string") {
      throw new Error("Unsupported PDF action");
    }
    const paper = current.nodes.find((n) => n.id === body.paperId && n.type === "paper");
    if (!paper) throw new Error("Paper node not found");
    const oaUrl = typeof paper.data.openAccessUrl === "string" ? paper.data.openAccessUrl : "";
    if (!oaUrl) throw new Error("Paper does not have an Open Access PDF URL indexed");

    const buffer = await fetchOpenAccessPdf(oaUrl);
    const extracted = await extractPdfTextFromBuffer(buffer);
    await ensureWorkspaceScaffold(projectRoot, current.projectId, current);
    const safeName = (paper.data.citeKey || paper.id).replace(/[^a-zA-Z0-9_-]/g, "_");
    const pdfAssetPath = `papers/${safeName}.pdf`;
    await writeWorkspaceFile(projectRoot, current.projectId, pdfAssetPath, buffer);

    const project = await executeResearchCommand(projectRoot, {
      projectId: current.projectId,
      op: "attach_paper_fulltext",
      commandId: `ui-oa-pdf-${randomUUID()}`,
      baseRevision: current.revision,
      payload: {
        paperId: paper.id,
        fullText: extracted.fullText,
        pages: extracted.pages,
        pageCount: extracted.pageCount,
        fullTextSha256: extracted.fullTextSha256,
        pdfAssetPath,
      },
    });

    return NextResponse.json({ project, paperId: paper.id, pageCount: extracted.pageCount, pdfAssetPath }, { headers: noStore });
  } catch (error) {
    return errorResponse(error, 400);
  }
}
