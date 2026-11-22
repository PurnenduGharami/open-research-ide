import { NextRequest, NextResponse } from "next/server";
import { fetchRecentPapers } from "../../../../plugins/research-engine/literature.mjs";
import { errorResponse, noStore } from "../../../../src/server-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const topic = request.nextUrl.searchParams.get("topic") || "all";
    const limitParam = Number(request.nextUrl.searchParams.get("limit") || 6);
    const data = await fetchRecentPapers(topic, { limit: Number.isFinite(limitParam) ? limitParam : 6 });
    return NextResponse.json(data, { headers: noStore });
  } catch (error) {
    return errorResponse(error, 502);
  }
}
