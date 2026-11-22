import { NextRequest, NextResponse } from "next/server";
import { triggerExperimentSynthesis } from "../../../../src/research-runtime.mjs";
import { errorResponse, noStore, projectRoot, requireSameOrigin } from "../../../../src/server-utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const body = await request.json();
    if (typeof body.projectId !== "string" || !body.projectId) throw new Error("Project ID is required");
    const modality = ["computational", "survey", "wet-lab", "hardware", "observational"].includes(body.modality) ? body.modality : undefined;
    const started = await triggerExperimentSynthesis(body.projectId, { modality, root: projectRoot });
    started.completion.catch(() => {});
    return NextResponse.json({ projectId: started.projectId, sessionKey: started.sessionKey, runId: started.runId }, { status: 202, headers: noStore });
  } catch (error) {
    return errorResponse(error, 400);
  }
}
