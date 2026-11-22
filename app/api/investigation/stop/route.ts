import { NextRequest, NextResponse } from "next/server";
import { stopInvestigation } from "../../../../src/research-runtime.mjs";
import { errorResponse, noStore, requireSameOrigin } from "../../../../src/server-utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const body = await request.json();
    if (typeof body.sessionKey !== "string" || !body.sessionKey) throw new Error("An active investigation session is required");
    await stopInvestigation(body.sessionKey, typeof body.runId === "string" ? body.runId : undefined);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) {
    return errorResponse(error, 400);
  }
}
