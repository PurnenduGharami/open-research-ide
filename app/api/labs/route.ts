import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { executeResearchCommand, readProject } from "../../../plugins/research-engine/engine.mjs";
import { discoverLabsFromDois, labNodesFromDiscovery } from "../../../plugins/research-engine/labs.mjs";
import { errorResponse, noStore, projectRoot, requireSameOrigin } from "../../../src/server-utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const body = await request.json();
    const current = await readProject(projectRoot, typeof body.projectId === "string" ? body.projectId : undefined);
    if (!current) throw new Error("No investigation exists");

    if (body.action === "discover") {
      const dois = current.nodes.filter((n) => n.type === "paper" && n.data.doi).map((n) => String(n.data.doi));
      if (!dois.length) throw new Error("Add or retrieve papers with DOIs before discovering real OpenAlex institutions");
      const discovery = await discoverLabsFromDois(dois, { limit: 8 });
      let project = current;
      if (discovery.sources.length) {
        project = await executeResearchCommand(projectRoot, {
          projectId: current.projectId,
          op: "record_sources",
          commandId: `ui-labs-src-${randomUUID()}`,
          baseRevision: project.revision,
          payload: { sources: discovery.sources },
        });
      }
      const nodes = labNodesFromDiscovery(discovery);
      const experiment = project.nodes.find((n) => n.type === "experiment");
      const edges = experiment
        ? nodes.map((lab) => ({ id: `edge:${experiment.id}:${lab.id}`, source: experiment.id, target: lab.id, type: "conducted-at", label: "Candidate facility" }))
        : [];
      if (nodes.length) {
        project = await executeResearchCommand(projectRoot, {
          projectId: current.projectId,
          op: "upsert_nodes",
          commandId: `ui-labs-nodes-${randomUUID()}`,
          baseRevision: project.revision,
          payload: { nodes, edges },
        });
      }
      return NextResponse.json({ project, discoveredCount: nodes.length }, { headers: noStore });
    }

    if (body.action === "update" && typeof body.nodeId === "string") {
      const project = await executeResearchCommand(projectRoot, {
        projectId: current.projectId,
        op: "update_lab",
        commandId: `ui-lab-update-${randomUUID()}`,
        baseRevision: current.revision,
        payload: {
          nodeId: body.nodeId,
          ...(typeof body.contacted === "boolean" ? { contacted: body.contacted } : {}),
          ...(typeof body.contactedAt === "string" ? { contactedAt: body.contactedAt } : {}),
          ...(typeof body.notes === "string" ? { notes: body.notes } : {}),
          ...(typeof body.pathway === "string" ? { pathway: body.pathway } : {}),
          ...(body.price && typeof body.price === "object" ? { price: body.price } : {}),
        },
      });
      return NextResponse.json({ project }, { headers: noStore });
    }

    throw new Error("Unsupported lab action");
  } catch (error) {
    return errorResponse(error, 400);
  }
}
