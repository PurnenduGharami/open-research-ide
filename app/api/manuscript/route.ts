import { randomUUID } from "node:crypto";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { executeResearchCommand, readProject } from "../../../plugins/research-engine/engine.mjs";
import { renderProjectLatex } from "../../../src/export-renderer.mjs";
import { draftManuscriptFromProject, polishManuscriptSectionWithGemini } from "../../../src/manuscript.mjs";
import { auditManuscriptProse, humanizeProseText } from "../../../src/prose-linter.mjs";
import { errorResponse, noStore, projectRoot, requireSameOrigin } from "../../../src/server-utils";
import type { LatexTemplate } from "../../../packages/contracts";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const body = await request.json();
    const current = await readProject(projectRoot, typeof body.projectId === "string" ? body.projectId : undefined);
    if (!current) throw new Error("No investigation exists");

    if (body.action === "format-latex") {
      const template = (["article", "ieee", "neurips", "nature"].includes(body.template) ? body.template : "article") as LatexTemplate;
      const { mainTex, referencesBib } = renderProjectLatex(current, { template });
      return NextResponse.json({ template, mainTex, referencesBib }, { headers: noStore });
    }

    let manuscript = body.manuscript || current.manuscript;
    const valeConfigPath = path.join(projectRoot, ".vale.ini");

    if (body.action === "ai-refine") {
      if (!manuscript || typeof body.sectionId !== "string") throw new Error("Section ID and manuscript draft required");
      const section = (manuscript.sections || []).find((s: { id: string }) => s.id === body.sectionId);
      if (!section) throw new Error("Manuscript section not found");
      const revised = await polishManuscriptSectionWithGemini(current, section.heading, section.content || "", projectRoot);
      manuscript = {
        ...manuscript,
        sections: manuscript.sections.map((s: { id: string; heading: string; content: string; updatedAt?: string }) =>
          s.id === body.sectionId ? { ...s, content: revised, updatedAt: new Date().toISOString() } : s,
        ),
      };
      manuscript.proseAudit = await auditManuscriptProse(manuscript, { valeConfigPath });
    } else if (body.action === "draft" || !manuscript) {
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
