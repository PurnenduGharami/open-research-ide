import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { executeResearchCommand, readProject } from "../../../plugins/research-engine/engine.mjs";
import { boundedText, errorResponse, noStore, projectRoot, requireSameOrigin } from "../../../src/server-utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const body = await request.json();
    const current = await readProject(projectRoot, typeof body.projectId === "string" ? body.projectId : undefined);
    if (!current) throw new Error("No investigation exists");

    if (body.action === "upsert-task") {
      const project = await executeResearchCommand(projectRoot, {
        projectId: current.projectId,
        op: "upsert_task",
        commandId: `ui-task-${randomUUID()}`,
        baseRevision: current.revision,
        payload: { task: body.task },
      });
      return NextResponse.json({ project }, { headers: noStore });
    }

    if (body.action === "delete-task") {
      const project = await executeResearchCommand(projectRoot, {
        projectId: current.projectId,
        op: "delete_task",
        commandId: `ui-del-task-${randomUUID()}`,
        baseRevision: current.revision,
        payload: { taskId: body.taskId },
      });
      return NextResponse.json({ project }, { headers: noStore });
    }

    if (body.action === "upsert-idea") {
      const project = await executeResearchCommand(projectRoot, {
        projectId: current.projectId,
        op: "upsert_idea",
        commandId: `ui-idea-${randomUUID()}`,
        baseRevision: current.revision,
        payload: { idea: body.idea },
      });
      return NextResponse.json({ project }, { headers: noStore });
    }

    if (body.action === "delete-idea") {
      const project = await executeResearchCommand(projectRoot, {
        projectId: current.projectId,
        op: "delete_idea",
        commandId: `ui-del-idea-${randomUUID()}`,
        baseRevision: current.revision,
        payload: { ideaId: body.ideaId },
      });
      return NextResponse.json({ project }, { headers: noStore });
    }

    if (body.action === "promote-idea") {
      const idea = (current.ideas || []).find((item: { id: string }) => item.id === body.ideaId);
      if (!idea) throw new Error("Idea not found");
      const targetType = body.targetType === "gap" ? "gap" : "hypothesis";
      const nodeId = `${targetType}:manual:${randomUUID().slice(0, 8)}`;
      let project = await executeResearchCommand(projectRoot, {
        projectId: current.projectId,
        op: "upsert_nodes",
        commandId: `ui-promote-node-${nodeId}`,
        baseRevision: current.revision,
        payload: {
          nodes: [{
            id: nodeId,
            type: targetType,
            title: idea.title,
            sourceRefs: [],
            data: targetType === "hypothesis"
              ? { statement: idea.notes || idea.title }
              : { description: idea.notes || idea.title },
          }],
        },
      });
      const analysis = project.uiBlocks.find((b) => b.kind === "analysis");
      project = await executeResearchCommand(projectRoot, {
        projectId: current.projectId,
        op: "set_blocks",
        commandId: `ui-promote-block-${nodeId}`,
        baseRevision: project.revision,
        payload: {
          blocks: [{
            id: analysis?.id || `analysis:manual:${current.projectId}`,
            kind: "analysis",
            title: analysis?.title || "Grounded evidence & hypothesis",
            nodeIds: [...new Set([...(analysis?.nodeIds || []), nodeId])],
          }],
        },
      });
      project = await executeResearchCommand(projectRoot, {
        projectId: current.projectId,
        op: "upsert_idea",
        commandId: `ui-promote-mark-${nodeId}`,
        baseRevision: project.revision,
        payload: { idea: { ...idea, status: "promoted", promotedNodeId: nodeId } },
      });
      return NextResponse.json({ project, nodeId }, { headers: noStore });
    }

    if (body.action === "create-hypothesis") {
      const title = boundedText(body.title, "Hypothesis title", 4, 300);
      const statement = typeof body.statement === "string" && body.statement.trim() ? body.statement.trim() : title;
      const nodeId = `hypothesis:manual:${randomUUID().slice(0, 8)}`;
      let project = await executeResearchCommand(projectRoot, {
        projectId: current.projectId,
        op: "upsert_nodes",
        commandId: `ui-add-hyp-${nodeId}`,
        baseRevision: current.revision,
        payload: {
          nodes: [{
            id: nodeId,
            type: "hypothesis",
            title,
            sourceRefs: [],
            data: { statement },
          }],
        },
      });
      const analysis = project.uiBlocks.find((b) => b.kind === "analysis");
      project = await executeResearchCommand(projectRoot, {
        projectId: current.projectId,
        op: "set_blocks",
        commandId: `ui-hyp-block-${nodeId}`,
        baseRevision: project.revision,
        payload: {
          blocks: [{
            id: analysis?.id || `analysis:manual:${current.projectId}`,
            kind: "analysis",
            title: analysis?.title || "Grounded evidence & hypothesis",
            nodeIds: [...new Set([...(analysis?.nodeIds || []), nodeId])],
          }],
        },
      });
      return NextResponse.json({ project, nodeId }, { headers: noStore });
    }

    if (body.action === "set-matrix-vote") {
      const project = await executeResearchCommand(projectRoot, {
        projectId: current.projectId,
        op: "set_hypothesis_vote",
        commandId: `ui-vote-${randomUUID()}`,
        baseRevision: current.revision,
        payload: {
          evidenceId: body.evidenceId,
          hypothesisId: body.hypothesisId,
          vote: body.vote,
        },
      });
      return NextResponse.json({ project }, { headers: noStore });
    }

    throw new Error("Unsupported planning action");
  } catch (error) {
    return errorResponse(error, 400);
  }
}
