import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { executeResearchCommand, readProject } from "../../../plugins/research-engine/engine.mjs";
import { errorResponse, noStore, projectRoot, requireSameOrigin } from "../../../src/server-utils";
import {
  calculateSampleSizePower,
  generatePublicationSvgChart,
  parseCsvTable,
  runCorrelationAnalysis,
  runWelchTTest,
} from "../../../src/stats-engine.mjs";
import { ensureWorkspaceScaffold, readWorkspaceFile, writeWorkspaceFile } from "../../../src/workspace-files.mjs";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const body = await request.json();

    if (body.action === "analyze-csv") {
      let csvText = typeof body.csvText === "string" ? body.csvText : "";
      if (!csvText && typeof body.filePath === "string" && body.filePath) {
        const current = await readProject(projectRoot, typeof body.projectId === "string" ? body.projectId : undefined);
        if (!current) throw new Error("No investigation exists");
        const loaded = await readWorkspaceFile(projectRoot, current.projectId, body.filePath);
        csvText = loaded.text || "";
      }
      const parsed = parseCsvTable(csvText);
      return NextResponse.json(parsed, { headers: noStore });
    }

    if (body.action === "t-test") {
      const result = runWelchTTest(body.groupA, body.groupB);
      return NextResponse.json(result, { headers: noStore });
    }

    if (body.action === "correlation") {
      const result = runCorrelationAnalysis(body.xs, body.ys);
      return NextResponse.json(result, { headers: noStore });
    }

    if (body.action === "power") {
      const result = calculateSampleSizePower({
        effectSizeD: body.effectSizeD,
        alpha: body.alpha ?? 0.05,
        power: body.power ?? 0.8,
      });
      return NextResponse.json(result, { headers: noStore });
    }

    if (body.action === "render-chart" || body.action === "save-figure") {
      const svg = generatePublicationSvgChart(body.chart || body);
      if (body.action === "render-chart") {
        return NextResponse.json({ svg }, { headers: noStore });
      }
      const current = await readProject(projectRoot, typeof body.projectId === "string" ? body.projectId : undefined);
      if (!current) throw new Error("No investigation exists");
      await ensureWorkspaceScaffold(projectRoot, current.projectId, current);
      const rawName = String(body.filename || `figure-${Date.now()}.svg`).replace(/[^a-zA-Z0-9._-]/g, "_");
      const filename = rawName.endsWith(".svg") ? rawName : `${rawName}.svg`;
      const relPath = `figures/${filename}`;
      const written = await writeWorkspaceFile(projectRoot, current.projectId, relPath, svg);
      const project = await executeResearchCommand(projectRoot, {
        projectId: current.projectId,
        op: "record_asset",
        commandId: `ui-fig-${randomUUID()}`,
        baseRevision: current.revision,
        payload: {
          asset: {
            label: body.chart?.title || filename,
            kind: "figure",
            path: relPath,
            sha256: written.sha256,
          },
        },
      });
      return NextResponse.json({ svg, path: relPath, sha256: written.sha256, project }, { headers: noStore });
    }

    throw new Error("Unsupported statistics action");
  } catch (error) {
    return errorResponse(error, 400);
  }
}
