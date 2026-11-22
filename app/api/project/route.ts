import { NextResponse } from "next/server";
import { readProject } from "../../../plugins/research-engine/engine.mjs";
import { activeRuns } from "../../../src/research-runtime.mjs";
import { errorResponse, noStore, projectRoot } from "../../../src/server-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ project: await readProject(projectRoot), runs: activeRuns() }, { headers: noStore });
  } catch (error) {
    return errorResponse(error);
  }
}
