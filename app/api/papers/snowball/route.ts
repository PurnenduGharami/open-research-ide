import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { executeResearchCommand, readProject } from "../../../../plugins/research-engine/engine.mjs";
import { snowballCitations } from "../../../../plugins/research-engine/literature.mjs";
import { errorResponse, noStore, projectRoot, requireSameOrigin } from "../../../../src/server-utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const body = await request.json();
    const current = await readProject(projectRoot, typeof body.projectId === "string" ? body.projectId : undefined);
    if (!current) throw new Error("No investigation exists");
    const paper = current.nodes.find((n) => n.id === body.paperId && n.type === "paper");
    if (!paper) throw new Error("Paper node not found");

    const direction = ["references", "citations", "both"].includes(body.direction) ? body.direction : "both";
    const result = await snowballCitations(paper, { direction, limit: 6 });

    let project = current;
    if (result.sources.length) {
      project = await executeResearchCommand(projectRoot, {
        projectId: current.projectId,
        op: "record_sources",
        commandId: `ui-snowball-src-${randomUUID()}`,
        baseRevision: project.revision,
        payload: { sources: result.sources },
      });
    }
    if (result.nodes.length) {
      project = await executeResearchCommand(projectRoot, {
        projectId: current.projectId,
        op: "upsert_nodes",
        commandId: `ui-snowball-nodes-${randomUUID()}`,
        baseRevision: project.revision,
        payload: { nodes: result.nodes, edges: result.edges },
      });
      const litBlock = project.uiBlocks.find((b) => b.kind === "literature");
      project = await executeResearchCommand(projectRoot, {
        projectId: current.projectId,
        op: "set_blocks",
        commandId: `ui-snowball-block-${randomUUID()}`,
        baseRevision: project.revision,
        payload: {
          blocks: [{
            id: litBlock?.id || `literature:snowball:${current.projectId}`,
            kind: "literature",
            title: litBlock?.title || "Peer-Reviewed Literature",
            nodeIds: [...new Set([...(litBlock?.nodeIds || []), ...result.nodes.map((n) => String(n.id))])],
          }],
        },
      });
    }

    return NextResponse.json({ project, addedCount: result.nodes.length }, { headers: noStore });
  } catch (error) {
    return errorResponse(error, 400);
  }
}
