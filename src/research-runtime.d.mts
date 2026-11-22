import type { EventEmitter } from "node:events";
import type { ExperimentModality, InvestigationMode, RunTelemetry } from "../packages/contracts/index";

export interface InvestigationTelemetry extends RunTelemetry {
  sessionKey: string;
}

export function startInvestigation(curiosity: string, options?: { mode?: InvestigationMode; projectId?: string; root?: string }): Promise<{
  projectId: string;
  sessionKey: string;
  runId: string;
  completion: Promise<void>;
}>;
export function continueInvestigation(projectId: string, userMessage: string, options?: { root?: string }): Promise<{
  projectId: string;
  sessionKey: string;
  runId: string;
  completion: Promise<void>;
}>;
export function triggerReviewPanel(projectId: string, options?: { root?: string }): Promise<{
  projectId: string;
  sessionKey: string;
  runId: string;
  completion: Promise<void>;
}>;
export function triggerExperimentSynthesis(projectId: string, options?: { modality?: ExperimentModality; root?: string }): Promise<{
  projectId: string;
  sessionKey: string;
  runId: string;
  completion: Promise<void>;
}>;
export function stopInvestigation(sessionKey: string, runId?: string): Promise<void>;
export function runtimeEvents(): EventEmitter;
export function activeRuns(): InvestigationTelemetry[];
export function activeProjectIds(): Set<string>;
