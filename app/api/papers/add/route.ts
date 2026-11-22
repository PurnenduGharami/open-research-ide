import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { executeResearchCommand, readProject } from "../../../../plugins/research-engine/engine.mjs";
import { lookupPaperByDoi } from "../../../../plugins/research-engine/literature.mjs";
import { boundedText, errorResponse, noStore, projectRoot, requireSameOrigin } from "../../../../src/server-utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const body = await request.json();
    const doi = boundedText(body.doi, "DOI", 4, 200);
    const current = await readProject(projectRoot, typeof body.projectId === "string" ? body.projectId : undefined);
    if (!current) throw new Error("No investigation exists");
    const found = await lookupPaperByDoi(doi);
    let project = await executeResearchCommand(projectRoot, {
      projectId: current.projectId,
      op: "record_sources",
      commandId: `ui-doi-src-${randomUUID()}`,
      baseRevision: current.revision,
      payload: { sources: [found.source] },
    });
    project = await executeResearchCommand(projectRoot, {
      projectId: current.projectId,
      op: "upsert_nodes",
      commandId: `ui-doi-node-${randomUUID()}`,
      baseRevision: project.revision,
      payload: { nodes: [found.node], edges: [] },
    });
    project = await executeResearchCommand(projectRoot, {
      projectId: current.projectId,
      op: "set_blocks",
      commandId: `ui-doi-block-${randomUUID()}`,
      baseRevision: project.revision,
      payload: {
        blocks: [{
          id: `literature:manual:${randomUUID().slice(0, 8)}`,
          kind: "literature",
          title: `Added paper by DOI: ${doi}`,
          nodeIds: [String(found.node.id)],
        }],
      },
    });
    return NextResponse.json({ project }, { headers: noStore });
  } catch (error) {
    return errorResponse(error, 400);
  }
}
