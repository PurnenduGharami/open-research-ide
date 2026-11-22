import { readProject } from "../../../plugins/research-engine/engine.mjs";
import { activeRuns, runtimeEvents } from "../../../src/research-runtime.mjs";
import { projectRoot } from "../../../src/server-utils";
import type { StreamEvent } from "../../../packages/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let synchronizer: ReturnType<typeof setInterval> | undefined;
  let listener: ((event: StreamEvent) => void) | undefined;
  let lastRevision = -1;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (value: unknown) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`)); } catch { closed = true; }
      };
      try {
        const snapshot = await readProject(projectRoot);
        lastRevision = snapshot?.revision ?? -1;
        send({ type: "snapshot", project: snapshot, revision: snapshot?.revision, runs: activeRuns() });
      } catch (error) {
        send({ type: "error", project: null, message: error instanceof Error ? error.message : "Could not read project" });
      }
      listener = (event) => {
        if (event.project !== undefined) lastRevision = event.project?.revision ?? -1;
        send(event);
      };
      runtimeEvents().on("update", listener);
      synchronizer = setInterval(async () => {
        if (closed) return;
        try {
          const latest = await readProject(projectRoot);
          const revision = latest?.revision ?? -1;
          if (revision !== lastRevision) {
            lastRevision = revision;
            send({ type: "snapshot", project: latest, revision: latest?.revision });
          }
        } catch (error) {
          send({ type: "error", project: null, message: error instanceof Error ? error.message : "Project synchronization failed" });
        }
      }, 1000);
      heartbeat = setInterval(() => {
        if (!closed) try { controller.enqueue(encoder.encode(": keepalive\n\n")); } catch { closed = true; }
      }, 15000);
      request.signal.addEventListener("abort", () => {
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        if (synchronizer) clearInterval(synchronizer);
        if (listener) runtimeEvents().off("update", listener);
        try { controller.close(); } catch { /* Already closed. */ }
      }, { once: true });
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      if (synchronizer) clearInterval(synchronizer);
      if (listener) runtimeEvents().off("update", listener);
    },
  });
  return new Response(stream, { headers: {
    "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive", "X-Accel-Buffering": "no", "X-Content-Type-Options": "nosniff",
  } });
}
