import { readProject } from "../../../plugins/research-engine/engine.mjs";
import { activeRuns, runtimeEvents } from "../../../src/research-runtime.mjs";
import { projectRoot } from "../../../src/server-utils";
import type { StreamEvent } from "../../../packages/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  const url = new URL(request.url);
  const requestedProjectId = url.searchParams.get("projectId") || undefined;
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let synchronizer: ReturnType<typeof setInterval> | undefined;
  let listener: ((event: StreamEvent) => void) | undefined;
  let lastRevision = -1;
  let lastProjectId: string | undefined = requestedProjectId;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (value: unknown) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`)); } catch { closed = true; }
      };
      try {
        const snapshot = await readProject(projectRoot, requestedProjectId);
        lastRevision = snapshot?.revision ?? -1;
        lastProjectId = snapshot?.projectId ?? requestedProjectId;
        send({ type: "snapshot", project: snapshot, projectId: snapshot?.projectId, revision: snapshot?.revision, runs: activeRuns() });
      } catch (error) {
        send({ type: "error", project: null, message: error instanceof Error ? error.message : "Could not read project" });
      }
      listener = (event) => {
        if (requestedProjectId && event.projectId && event.projectId !== requestedProjectId) return;
        if (event.project !== undefined && event.project !== null) {
          lastRevision = event.project.revision;
          lastProjectId = event.project.projectId;
        }
        send(event);
      };
      runtimeEvents().on("update", listener);
      synchronizer = setInterval(async () => {
        if (closed) return;
        try {
          const latest = await readProject(projectRoot, requestedProjectId);
          const revision = latest?.revision ?? -1;
          if (revision !== lastRevision || latest?.projectId !== lastProjectId) {
            lastRevision = revision;
            lastProjectId = latest?.projectId;
            send({ type: "snapshot", project: latest, projectId: latest?.projectId, revision: latest?.revision });
          }
        } catch (error) {
          send({ type: "error", project: null, message: error instanceof Error ? error.message : "Project synchronization failed" });
        }
      }, 1200);
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

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
