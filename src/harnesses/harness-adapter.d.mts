import type { SetupStatus } from "../../packages/contracts/index";
import type { RuntimeConfig } from "../runtime-config.d.mts";

export function createHarnessAdapter(runtimeConfig: RuntimeConfig, root: string, options?: { fetch?: typeof fetch; verifyRemote?: boolean }): {
  kind: "standalone";
  createSession: (opts: { agentId: string; label: string; requestedKey?: string; model?: string }) => Promise<string>;
  sendTurn: (opts: Record<string, unknown>) => Promise<{ runId: string; text: string; usage?: Record<string, unknown>; durationMs: number }>;
  abortSession: (sessionKey: string) => Promise<void>;
  preflight: () => Promise<SetupStatus>;
};

export function runPreflight(root?: string, options?: { fetch?: typeof fetch; verifyRemote?: boolean }): Promise<SetupStatus>;
