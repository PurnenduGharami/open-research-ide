import { randomUUID } from "node:crypto";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { executeResearchCommand, readProject } from "../../../plugins/research-engine/engine.mjs";
import { draftManuscriptFromProject } from "../../../src/manuscript.mjs";
import { auditManuscriptProse, humanizeProseText } from "../../../src/prose-linter.mjs";
import { errorResponse, noStore, projectRoot, requireSameOrigin } from "../../../src/server-utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const body = await request.json();
    const current = await readProject(projectRoot, typeof body.projectId === "string" ? body.projectId : undefined);
    if (!current) throw new Error("No investigation exists");

    let manuscript = body.manuscript || current.manuscript;
    const valeConfigPath = path.join(projectRoot, ".vale.ini");

    if (body.action === "draft" || !manuscript) {
      manuscript = await draftManuscriptFromProject(current, { root: projectRoot });
    } else if (body.action === "humanize") {
      manuscript = {
        ...manuscript,
        abstract: humanizeProseText(manuscript.abstract || ""),
        sections: (manuscript.sections || []).map((section: { id: string; heading: string; content: string; updatedAt?: string }) => ({
          ...section,
          content: humanizeProseText(section.content || ""),
          updatedAt: new Date().toISOString(),
        })),
      };
      manuscript.proseAudit = await auditManuscriptProse(manuscript, { valeConfigPath });
    } else if (body.action === "audit" || body.action === "save") {
      manuscript = {
        ...manuscript,
        proseAudit: await auditManuscriptProse(manuscript, { valeConfigPath }),
      };
    }

    const project = await executeResearchCommand(projectRoot, {
      projectId: current.projectId,
      op: "set_manuscript",
      commandId: `ui-manuscript-${randomUUID()}`,
      baseRevision: current.revision,
      payload: { manuscript },
    });
    return NextResponse.json({ project, manuscript: project.manuscript }, { headers: noStore });
  } catch (error) {
    return errorResponse(error, 400);
  }
}
