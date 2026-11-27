import { NextRequest, NextResponse } from "next/server";
import { assertSameOriginHeaders } from "./origin-guard.mjs";

export const projectRoot = process.env.OPEN_RESEARCH_ROOT || process.cwd();

export function errorResponse(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  const revisionConflict = message.startsWith("Stale revision:") || message.startsWith("Canonical revision changed during export");
  return NextResponse.json({ error: message }, { status: revisionConflict ? 409 : status });
}

export function requireSameOrigin(request: NextRequest) {
  assertSameOriginHeaders({
    origin: request.headers.get("origin"),
    host: request.headers.get("host"),
    forwardedHost: request.headers.get("x-forwarded-host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
    nextUrlHost: request.nextUrl.host,
    nextUrlProtocol: request.nextUrl.protocol,
  });
}

export function boundedText(value: unknown, field: string, min: number, max: number) {
  if (typeof value !== "string" || value.trim().length < min || value.length > max) {
    throw new Error(`${field} must contain ${min}–${max} characters`);
  }
  return value.trim();
}

export const noStore = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" } as const;
