import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { executeResearchCommand, readProject } from "../../../../plugins/research-engine/engine.mjs";
import { boundedText, errorResponse, noStore, projectRoot, requireSameOrigin } from "../../../../src/server-utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const body = await request.json();
    if (typeof body.paperId !== "string" || !body.paperId) throw new Error("Paper ID is required");
    const quote = boundedText(body.quote, "Abstract passage", 8, 2000);
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 200) : "Human-curated abstract passage";
    const projectId = typeof body.projectId === "string" ? body.projectId : undefined;
    const current = await readProject(projectRoot, projectId);
    if (!current) throw new Error("No investigation exists");
    const nodeId = `evidence:human:${randomUUID().slice(0, 8)}`;
    let project = await executeResearchCommand(projectRoot, {
      projectId: current.projectId,
      op: "upsert_nodes",
      commandId: `ui-add-ev-${nodeId}`,
      baseRevision: current.revision,
      payload: {
        nodes: [{
          id: nodeId,
          type: "evidence",
          title,
          sourceRefs: [body.paperId],
          data: { paperId: body.paperId, quote, curationSource: "human" },
        }],
        edges: [{
          id: `edge:${nodeId}:${body.paperId}`,
          source: nodeId,
          target: body.paperId,
          type: "supports",
          label: "Exact abstract highlight",
        }],
      },
    });
    if (body.confirmImmediately !== false) {
      project = await executeResearchCommand(projectRoot, {
        projectId: current.projectId,
        op: "confirm_evidence",
        commandId: `ui-confirm-ev-${nodeId}`,
        baseRevision: project.revision,
        payload: { nodeId, method: "human-direct-abstract-highlight" },
      });
    }
    const analysisBlock = project.uiBlocks.find((b) => b.kind === "analysis");
    const blockId = analysisBlock?.id || `analysis:human:${current.projectId}`;
    const nextNodeIds = [...new Set([...(analysisBlock?.nodeIds || []), nodeId])];
    project = await executeResearchCommand(projectRoot, {
      projectId: current.projectId,
      op: "set_blocks",
      commandId: `ui-block-ev-${nodeId}`,
      baseRevision: project.revision,
      payload: {
        blocks: [{ id: blockId, kind: "analysis", title: analysisBlock?.title || "Grounded evidence & analysis", nodeIds: nextNodeIds }],
      },
    });
    return NextResponse.json({ project, nodeId }, { headers: noStore });
  } catch (error) {
    return errorResponse(error, 400);
  }
}
