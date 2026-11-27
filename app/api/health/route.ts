import { NextResponse } from "next/server";
import { noStore } from "../../../src/server-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "open-research-ide",
      version: "0.3.0",
      runtime: "standalone",
      defaultProvider: "gemini",
    },
    { headers: noStore },
  );
}
