import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { executeResearchCommand, readProject } from "../../../../plugins/research-engine/engine.mjs";
import { literatureNodes, searchLiterature } from "../../../../plugins/research-engine/literature.mjs";
import { boundedText, errorResponse, noStore, projectRoot, requireSameOrigin } from "../../../../src/server-utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const body = await request.json();

    if (body.action === "query") {
      const query = boundedText(body.query, "Literature search query", 2, 300);
      const limit = typeof body.limit === "number" ? body.limit : 10;
      const result = await searchLiterature(query, { limit });
      return NextResponse.json(result, { headers: noStore });
    }

    if (body.action === "add") {
      const current = await readProject(projectRoot, typeof body.projectId === "string" ? body.projectId : undefined);
      if (!current) throw new Error("No investigation exists");
      const rawPapers = Array.isArray(body.papers) ? body.papers : body.paper ? [body.paper] : [];
      if (!rawPapers.length) throw new Error("No paper records supplied");
      const converted = literatureNodes({ papers: rawPapers, sources: [] });
      let project = await executeResearchCommand(projectRoot, {
        projectId: current.projectId,
        op: "upsert_nodes",
        commandId: `ui-add-papers-${randomUUID()}`,
        baseRevision: current.revision,
        payload: { nodes: converted.nodes, edges: [] },
      });
      const block = project.uiBlocks.find((b) => b.kind === "literature");
      const blockId = block?.id || `literature:search:${current.projectId}`;
      const nextNodeIds = [...new Set([...(block?.nodeIds || []), ...converted.nodes.map((n) => String(n.id))])];
      project = await executeResearchCommand(projectRoot, {
        projectId: current.projectId,
        op: "set_blocks",
        commandId: `ui-lit-block-${randomUUID()}`,
        baseRevision: project.revision,
        payload: {
          blocks: [{ id: blockId, kind: "literature", title: block?.title || "Peer-Reviewed Literature", nodeIds: nextNodeIds }],
        },
      });
      return NextResponse.json({ project, addedCount: converted.nodes.length }, { headers: noStore });
    }

    throw new Error("Unsupported literature search action");
  } catch (error) {
    return errorResponse(error, 400);
  }
}
