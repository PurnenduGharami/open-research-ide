import { NextRequest, NextResponse } from "next/server";

export const projectRoot = process.env.OPEN_RESEARCH_ROOT || process.cwd();

export function errorResponse(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  const revisionConflict = message.startsWith("Stale revision:") || message.startsWith("Canonical revision changed during export");
  return NextResponse.json({ error: message }, { status: revisionConflict ? 409 : status });
}

const loopbackHost = (host: string) => /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);

export function requireSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  let originUrl: URL;
  try { originUrl = new URL(origin); } catch { throw new Error("Cross-origin mutations are not allowed"); }
  const requestHosts = [request.headers.get("host"), request.nextUrl.host].filter((host): host is string => Boolean(host));
  const sameHost = requestHosts.includes(originUrl.host);
  const loopbackAlias = loopbackHost(originUrl.host) && requestHosts.some(loopbackHost);
  if ((!sameHost && !loopbackAlias) || originUrl.protocol !== request.nextUrl.protocol) {
    throw new Error("Cross-origin mutations are not allowed");
  }
}

export function boundedText(value: unknown, field: string, min: number, max: number) {
  if (typeof value !== "string" || value.trim().length < min || value.length > max) {
    throw new Error(`${field} must contain ${min}–${max} characters`);
  }
  return value.trim();
}

export const noStore = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" } as const;
