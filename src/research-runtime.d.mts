import type { EventEmitter } from "node:events";
import type { RunTelemetry } from "../packages/contracts/index";

export interface InvestigationTelemetry extends RunTelemetry {
  sessionKey: string;
}

export function startInvestigation(curiosity: string): Promise<{
  sessionKey: string;
  runId: string;
  completion: Promise<void>;
}>;
export function stopInvestigation(sessionKey: string, runId?: string): Promise<void>;
export function runtimeEvents(): EventEmitter;
export function activeRuns(): InvestigationTelemetry[];
