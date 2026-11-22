import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { executeResearchCommand, readProject } from "../../../plugins/research-engine/engine.mjs";
import {
  buildColabNotebook,
  buildSurveyCsvTemplate,
  buildSurveySchema,
  runExperimentCodeLocally,
} from "../../../src/validation-tools.mjs";
import { errorResponse, noStore, projectRoot, requireSameOrigin } from "../../../src/server-utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const body = await request.json();
    const current = await readProject(projectRoot, typeof body.projectId === "string" ? body.projectId : undefined);
    if (!current) throw new Error("No investigation exists");
    const experiment = current.nodes.find((n) => n.id === body.experimentId && n.type === "experiment");
    if (!experiment) throw new Error("Experiment not found");

    if (body.action === "colab") {
      const notebook = buildColabNotebook(current, experiment);
      return new Response(`${JSON.stringify(notebook, null, 2)}\n`, {
        headers: {
          "Content-Type": "application/x-ipynb+json; charset=utf-8",
          "Content-Disposition": `attachment; filename="open-research-experiment.ipynb"`,
          ...noStore,
        },
      });
    }

    if (body.action === "survey-schema") {
      const schema = buildSurveySchema(current, experiment);
      return new Response(`${JSON.stringify(schema, null, 2)}\n`, {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="survey-instrument.json"`,
          ...noStore,
        },
      });
    }

    if (body.action === "survey-csv") {
      const csv = buildSurveyCsvTemplate(experiment);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="survey-responses-template.csv"`,
          ...noStore,
        },
      });
    }

    if (body.action === "run-code") {
      const output = await runExperimentCodeLocally(projectRoot, current.projectId, experiment, typeof body.code === "string" ? body.code : undefined);
      const project = await executeResearchCommand(projectRoot, {
        projectId: current.projectId,
        op: "update_experiment_run",
        commandId: `ui-code-run-${randomUUID()}`,
        baseRevision: current.revision,
        payload: {
          experimentId: experiment.id,
          ...(typeof body.code === "string" ? { code: body.code } : {}),
          lastRunOutput: output,
        },
      });
      return NextResponse.json({ project, output }, { headers: noStore });
    }

    throw new Error("Unsupported validation action");
  } catch (error) {
    return errorResponse(error, 400);
  }
}
