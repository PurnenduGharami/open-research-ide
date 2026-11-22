import { NextRequest, NextResponse } from "next/server";
import { startInvestigation } from "../../../src/research-runtime.mjs";
import { boundedText, errorResponse, noStore, requireSameOrigin } from "../../../src/server-utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const body = await request.json();
    const curiosity = boundedText(body.curiosity, "Curiosity", 10, 4000);
    const started = await startInvestigation(curiosity);
    started.completion.catch(() => { /* Terminal state is emitted over SSE and persisted by the runtime. */ });
    return NextResponse.json({ sessionKey: started.sessionKey, runId: started.runId }, { status: 202, headers: noStore });
  } catch (error) {
    return errorResponse(error, 400);
  }
}
