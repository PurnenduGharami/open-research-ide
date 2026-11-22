import { NextRequest, NextResponse } from "next/server";
import { runPreflight } from "../../../src/harnesses/harness-adapter.mjs";
import { getPublicRuntimeConfig, saveRuntimeConfig } from "../../../src/runtime-config.mjs";
import { errorResponse, noStore, projectRoot, requireSameOrigin } from "../../../src/server-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await runPreflight(projectRoot);
    return NextResponse.json(result, { headers: noStore });
  } catch (error) {
    return errorResponse(error, 503);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const body = await request.json();
    const saved = await saveRuntimeConfig(projectRoot, body);
    let preflight;
    try {
      preflight = await runPreflight(projectRoot);
    } catch (cause) {
      preflight = {
        ok: false,
        harness: saved.harness,
        config: getPublicRuntimeConfig(saved),
        checks: [{ id: "preflight", label: "Connection check", ok: false, detail: cause instanceof Error ? cause.message : String(cause) }],
        note: "Configuration saved server-side. No research session was created.",
      };
    }
    return NextResponse.json(preflight, { headers: noStore });
  } catch (error) {
    return errorResponse(error, 400);
  }
}
