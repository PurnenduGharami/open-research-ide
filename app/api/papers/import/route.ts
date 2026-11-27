import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { executeResearchCommand, readProject } from "../../../../plugins/research-engine/engine.mjs";
import { formatCitations, generateCiteKey, parseReferencesText } from "../../../../src/citations.mjs";
import { boundedText, errorResponse, noStore, projectRoot, requireSameOrigin } from "../../../../src/server-utils";
import type { CitationStyle } from "../../../../packages/contracts";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const body = await request.json();
    const current = await readProject(projectRoot, typeof body.projectId === "string" ? body.projectId : undefined);
    if (!current) throw new Error("No investigation exists");

    if (body.action === "format") {
      const style = (["apa", "ieee", "vancouver", "harvard1", "bibtex", "ris"].includes(body.style) ? body.style : "apa") as CitationStyle;
      const papers = current.nodes.filter((n) => n.type === "paper");
      const formatted = formatCitations(papers, style);
      return NextResponse.json({ style, count: papers.length, formatted }, { headers: noStore });
    }

    let importedNodes: Array<Record<string, unknown>> = [];
    if (body.action === "manual") {
      const title = boundedText(body.title, "Paper title", 3, 400);
      const authors = typeof body.authors === "string"
        ? body.authors.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean)
        : Array.isArray(body.authors) ? body.authors : [];
      const year = body.year ? Number(body.year) || null : null;
      const venue = typeof body.venue === "string" ? body.venue.trim() : "";
      const doi = typeof body.doi === "string" ? body.doi.trim().replace(/^https?:\/\/doi\.org\//i, "") : "";
      const url = typeof body.url === "string" ? body.url.trim() : (doi ? `https://doi.org/${doi}` : "");
      const abstract = typeof body.abstract === "string" ? body.abstract.trim() : "";
      const nodeId = `paper:manual:${randomUUID().slice(0, 8)}`;
      importedNodes = [{
        id: nodeId,
        type: "paper",
        title,
        sourceRefs: ["Manual Entry"],
        data: {
          title,
          authors,
          year,
          venue,
          doi,
          url,
          abstract,
          provider: "Manual Entry",
          providers: ["Manual Entry"],
          citeKey: generateCiteKey({ title, authors, year }),
          readingStatus: "to-read",
        },
      }];
    } else {
      const raw = boundedText(body.text, "BibTeX / RIS / CSL-JSON text", 10, 500000);
      importedNodes = parseReferencesText(raw, typeof body.sourceLabel === "string" ? body.sourceLabel : "Imported Reference");
    }

    let project = await executeResearchCommand(projectRoot, {
      projectId: current.projectId,
      op: "upsert_nodes",
      commandId: `ui-import-refs-${randomUUID()}`,
      baseRevision: current.revision,
      payload: { nodes: importedNodes, edges: [] },
    });

    const litBlock = project.uiBlocks.find((b) => b.kind === "literature");
    const blockId = litBlock?.id || `literature:imported:${current.projectId}`;
    const nextIds = [...new Set([...(litBlock?.nodeIds || []), ...importedNodes.map((n) => String(n.id))])];
    project = await executeResearchCommand(projectRoot, {
      projectId: current.projectId,
      op: "set_blocks",
      commandId: `ui-import-block-${randomUUID()}`,
      baseRevision: project.revision,
      payload: {
        blocks: [{ id: blockId, kind: "literature", title: litBlock?.title || "Peer-Reviewed Literature", nodeIds: nextIds }],
      },
    });

    return NextResponse.json({ project, importedCount: importedNodes.length }, { headers: noStore });
  } catch (error) {
    return errorResponse(error, 400);
  }
}
