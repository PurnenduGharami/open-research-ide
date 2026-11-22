export type NodeType = "paper" | "evidence" | "contradiction" | "gap" | "hypothesis" | "experiment" | "result" | "review" | "lab";
export type EdgeType = "supports" | "contradicts" | "identifies" | "addresses" | "tests" | "observed-in" | "reviews" | "conducted-at";
export type ProjectStatus = "investigating" | "ready" | "error";
export type RunStatus = "running" | "completed" | "error";
export type ViewId = "research" | "literature" | "experiments" | "graph" | "published";
export type FindingStatus = "supported" | "weak" | "unsupported" | "uncertain" | "concern";
export type PriceKind = "quoted" | "model-estimated" | "unavailable";

export interface PaperData {
  title?: string;
  abstract?: string;
  doi?: string;
  url?: string;
  authors?: string[];
  year?: number;
  venue?: string;
  providerIds?: Record<string, string>;
  citationCount?: number;
}

export interface EvidenceData {
  paperId?: string;
  quote?: string;
  quoteSha256?: string;
  abstractSha256?: string;
  verified?: boolean;
  verificationMethod?: string;
}

export interface ReviewFinding {
  claim?: string;
  finding?: string;
  status?: FindingStatus | string;
  severity?: "low" | "medium" | "high" | string;
  rationale?: string;
  sourceNodeIds?: string[];
}

export interface ReviewData {
  hypothesisId?: string;
  reviewer?: "auditor" | "critic" | "feasibility" | string;
  runId?: string;
  findings?: ReviewFinding[];
  verdict?: string;
  rawResponse?: string;
  parseError?: string;
}

export interface ExpectedOutcome {
  metric: string;
  prediction: string;
  rationale?: string;
}

export interface ExperimentData {
  protocol?: string[];
  expectedOutcomes?: ExpectedOutcome[];
  expectedOutcomesFrozenAt?: string;
  variables?: Record<string, string>;
  safety?: string[];
  outreachDraft?: { subject: string; body: string };
}

export interface LabData {
  name?: string;
  institution?: string;
  url?: string;
  fit?: string;
  contacted?: boolean;
  price?: { amount?: number; currency?: string; kind: PriceKind; note: string };
}

export interface ResultData {
  experimentId?: string;
  observations?: string;
  importedAt?: string;
}

export type ResearchNodeData = PaperData & EvidenceData & ReviewData & ExperimentData & LabData & ResultData & Record<string, unknown>;

export interface ResearchNode {
  id: string;
  type: NodeType;
  title: string;
  createdAt: string;
  updatedAt: string;
  sourceRefs: string[];
  data: ResearchNodeData;
}

export interface ResearchEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label: string;
}

export interface UIBlock {
  id: string;
  kind: "literature" | "analysis" | "review" | "experiment" | "result";
  title: string;
  nodeIds: string[];
  createdAt: string;
}

export interface ResearchSource {
  id: string;
  provider: string;
  url: string;
  status: "ok" | "partial" | "error";
  queriedAt: string;
  error?: string;
}

export interface ResearchRun {
  id: string;
  kind: string;
  agentId: string;
  model: string;
  status: RunStatus;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  outputTps?: number;
  error?: string;
}

export interface TimelineEvent {
  id: string;
  at: string;
  kind: string;
  message: string;
  nodeIds: string[];
}

export interface ResearchAsset {
  id: string;
  label: string;
  kind: string;
  path: string;
  sha256: string;
  createdAt: string;
}

export interface ResearchExport {
  id: string;
  revision: number;
  format: "html" | "pdf" | "latex";
  path: string;
  sha256: string;
  createdAt: string;
}

export interface ResearchProject {
  schemaVersion: 1;
  projectId: string;
  revision: number;
  title: string;
  curiosity: string;
  status: ProjectStatus;
  privacy: "local-only";
  sessionKey?: string;
  createdAt: string;
  updatedAt: string;
  nodes: ResearchNode[];
  edges: ResearchEdge[];
  uiBlocks: UIBlock[];
  sources: ResearchSource[];
  runs: ResearchRun[];
  timeline: TimelineEvent[];
  assets: ResearchAsset[];
  exports: ResearchExport[];
  commandIds: string[];
}

export interface RunTelemetry {
  status: "idle" | "connecting" | "running" | "completed" | "error";
  runId?: string;
  startedAt?: string;
  elapsedMs?: number;
  outputTps?: number;
  inputTokens?: number;
  outputTokens?: number;
  outputTpsLabel: "run-average output TPS";
}

export interface StreamEvent {
  type: "snapshot" | "delta" | "run" | "error";
  project: ResearchProject | null;
  revision?: number;
  delta?: string;
  runId?: string;
  status?: string;
  message?: string;
  telemetry?: RunTelemetry;
}

export interface SetupStatus {
  ok: boolean;
  checks: Array<{ id: string; label: string; ok: boolean; detail: string }>;
  note: string;
}

export interface ExportResult {
  revision: number;
  files: Array<{ format: "html" | "pdf" | "latex"; path: string; sha256: string; url?: string }>;
}

export const NODE_LABELS: Record<NodeType, string> = {
  paper: "Paper", evidence: "Evidence", contradiction: "Contradiction", gap: "Research gap",
  hypothesis: "Hypothesis", experiment: "Experiment", result: "Observed result", review: "Goldfish review", lab: "Lab",
};

export function nodesOfType(project: ResearchProject | null, type: NodeType): ResearchNode[] {
  return project?.nodes.filter((node) => node.type === type) ?? [];
}
