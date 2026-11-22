import { NextRequest, NextResponse } from "next/server";
import { continueInvestigation } from "../../../../src/research-runtime.mjs";
import { boundedText, errorResponse, noStore, projectRoot, requireSameOrigin } from "../../../../src/server-utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const body = await request.json();
    if (typeof body.projectId !== "string" || !body.projectId) throw new Error("Project ID is required");
    const message = boundedText(body.message, "Follow-up message", 3, 4000);
    const started = await continueInvestigation(body.projectId, message, { root: projectRoot });
    started.completion.catch(() => {});
    return NextResponse.json({ projectId: started.projectId, sessionKey: started.sessionKey, runId: started.runId }, { status: 202, headers: noStore });
  } catch (error) {
    return errorResponse(error, 400);
  }
}
