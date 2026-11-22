export type NodeType = "paper" | "evidence" | "contradiction" | "gap" | "hypothesis" | "experiment" | "result" | "review" | "lab";
export type EdgeType = "supports" | "contradicts" | "identifies" | "addresses" | "tests" | "observed-in" | "reviews" | "conducted-at";
export type ProjectStatus = "investigating" | "ready" | "error";
export type RunStatus = "running" | "completed" | "error";
export type ViewId = "research" | "literature" | "experiments" | "graph" | "manuscript" | "published";
export type FindingStatus = "supported" | "weak" | "unsupported" | "uncertain" | "concern";
export type PriceKind = "quoted" | "model-estimated" | "unavailable";
export type InvestigationMode = "guided" | "autonomous";
export type ExperimentModality = "computational" | "survey" | "wet-lab" | "hardware" | "observational";
export type EvidenceVerificationStatus = "unverified" | "verified" | "rejected";
export type OutcomeVerdict = "supports" | "contradicts" | "inconclusive";
export type HarnessType = "openclaw" | "standalone";
export type ProviderType = "cerebras" | "openai-compatible" | "anthropic" | "gemini" | "openrouter" | "ollama";

export interface PaperData {
  title?: string;
  abstract?: string;
  doi?: string;
  url?: string;
  authors?: string[];
  year?: number | null;
  venue?: string;
  provider?: string;
  providers?: string[];
  providerIds?: Record<string, string>;
  citationCount?: number;
  openAccessUrl?: string;
  publishedDate?: string;
}

export interface EvidenceData {
  paperId?: string;
  quote?: string;
  quoteSha256?: string;
  abstractSha256?: string;
  verified?: boolean;
  verificationStatus?: EvidenceVerificationStatus;
  verificationMethod?: string;
  rejectedReason?: string;
  curationSource?: "orchestrator" | "human";
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
  sessionKey?: string;
  packetSha256?: string;
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

export interface CodeRunOutput {
  ranAt: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface CodeExperimentSpec {
  language: "python" | "javascript" | "cpp" | "r";
  filename: string;
  dependencies: string[];
  code: string;
  runCommand: string;
  colabReady?: boolean;
  lastRunOutput?: CodeRunOutput;
}

export interface SurveyDistributionChannel {
  name: string;
  tier: "free" | "paid";
  estimatedCost: string;
  notes: string;
}

export interface SurveyQuestion {
  id: string;
  prompt: string;
  kind: "likert" | "multiple-choice" | "open" | "numeric" | "attention-check";
  options?: string[];
  required?: boolean;
}

export interface SurveyDesignSpec {
  targetPopulation: string;
  targetSampleSize: number;
  estimatedMinutes: number;
  distributionChannels: SurveyDistributionChannel[];
  questions: SurveyQuestion[];
}

export interface ExperimentData {
  modality?: ExperimentModality;
  objective?: string;
  protocol?: string[];
  expectedOutcomes?: ExpectedOutcome[];
  expectedOutcomesFrozenAt?: string;
  variables?: Record<string, string>;
  controls?: string[];
  materials?: string[];
  safety?: string[];
  limitations?: string[];
  sampleSizeRationale?: string;
  statisticalPlan?: string;
  ethicsNotes?: string;
  estimatedCost?: { amount?: number; currency?: string; kind: PriceKind; note: string };
  outreachDraft?: { subject: string; body: string };
  codeExperiment?: CodeExperimentSpec;
  surveyDesign?: SurveyDesignSpec;
}

export interface LabData {
  name?: string;
  institution?: string;
  url?: string;
  rorUrl?: string;
  fit?: string;
  pathway?: "cro" | "university-core" | "academic-collaborator" | "commercial";
  contacted?: boolean;
  contactedAt?: string;
  notes?: string;
  authors?: string[];
  paperDois?: string[];
  price?: { amount?: number; currency?: string; kind: PriceKind; note: string };
}

export interface MetricObservation {
  metric: string;
  expected: string;
  observed: string;
  verdict: OutcomeVerdict;
  notes?: string;
}

export interface ResultData {
  experimentId?: string;
  observations?: string;
  importedAt?: string;
  metricResults?: MetricObservation[];
  datasetName?: string;
  datasetSummary?: string;
  sourceModality?: ExperimentModality;
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

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  stage?: string;
  citations?: string[];
  blockIds?: string[];
  runId?: string;
}

export interface ProseIssue {
  rule: string;
  severity: "suggestion" | "warning" | "error";
  sectionId: string;
  excerpt: string;
  message: string;
  replacement?: string;
}

export interface ProseAuditReport {
  engine: "vale+builtin" | "builtin";
  checkedAt: string;
  score: number;
  wordCount: number;
  issueCount: number;
  summary: string;
  issues: ProseIssue[];
}

export interface ManuscriptSection {
  id: string;
  heading: string;
  content: string;
  updatedAt: string;
}

export interface ManuscriptDocument {
  title: string;
  abstract: string;
  sections: ManuscriptSection[];
  proseAudit?: ProseAuditReport;
  sourceRevision: number;
  updatedAt: string;
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
  contentRevision?: number;
  format: "html" | "pdf" | "latex" | "zip";
  path: string;
  sha256: string;
  createdAt: string;
}

export interface ResearchProject {
  schemaVersion: 1;
  projectId: string;
  revision: number;
  contentRevision?: number;
  title: string;
  curiosity: string;
  mode?: InvestigationMode;
  status: ProjectStatus;
  privacy: "local-only";
  sessionKey?: string;
  createdAt: string;
  updatedAt: string;
  nodes: ResearchNode[];
  edges: ResearchEdge[];
  uiBlocks: UIBlock[];
  messages?: ConversationMessage[];
  manuscript?: ManuscriptDocument;
  sources: ResearchSource[];
  runs: ResearchRun[];
  timeline: TimelineEvent[];
  assets: ResearchAsset[];
  exports: ResearchExport[];
  commandIds: string[];
}

export interface ResearchProjectSummary {
  projectId: string;
  title: string;
  curiosity: string;
  mode: InvestigationMode;
  status: ProjectStatus;
  revision: number;
  contentRevision: number;
  createdAt: string;
  updatedAt: string;
  paperCount: number;
  evidenceCount: number;
  verifiedEvidenceCount: number;
  experimentCount: number;
  resultCount: number;
}

export interface RoleModelConfig {
  provider: ProviderType;
  model: string;
  baseUrl?: string;
}

export interface RuntimeConfigSummary {
  harness: HarnessType;
  orchestrator: RoleModelConfig;
  reviewers: RoleModelConfig;
  openclawGatewayUrl: string;
  hasGatewayToken: boolean;
  providersConfigured: Record<ProviderType, boolean>;
  hasSemanticScholarKey: boolean;
  hasOpenAlexMailto: boolean;
}

export interface RunTelemetry {
  status: "idle" | "connecting" | "running" | "completed" | "error";
  projectId?: string;
  stage?: string;
  runId?: string;
  startedAt?: string;
  elapsedMs?: number;
  outputTps?: number;
  inputTokens?: number;
  outputTokens?: number;
  outputTpsLabel: "run-average output TPS";
}

export interface StreamEvent {
  type: "snapshot" | "delta" | "run" | "stage" | "error";
  project: ResearchProject | null;
  projectId?: string;
  revision?: number;
  delta?: string;
  stage?: string;
  runId?: string;
  status?: string;
  message?: string;
  telemetry?: RunTelemetry;
}

export interface SetupStatus {
  ok: boolean;
  harness?: HarnessType;
  config?: RuntimeConfigSummary;
  checks: Array<{ id: string; label: string; ok: boolean; detail: string }>;
  note: string;
}

export interface ExportResult {
  revision: number;
  contentRevision?: number;
  files: Array<{ format: "html" | "pdf" | "latex" | "zip"; path: string; sha256: string; url?: string }>;
}

export interface RecentPaperCard {
  id: string;
  title: string;
  abstract: string;
  authors: string[];
  year: number | null;
  publishedDate?: string;
  venue: string;
  doi: string;
  url: string;
  provider: string;
  citationCount: number;
  topic: string;
}

export const NODE_LABELS: Record<NodeType, string> = {
  paper: "Paper",
  evidence: "Evidence",
  contradiction: "Contradiction",
  gap: "Research gap",
  hypothesis: "Hypothesis",
  experiment: "Experiment",
  result: "Observed result",
  review: "Independent review",
  lab: "Facility / Lab",
};

export function nodesOfType(project: ResearchProject | null, type: NodeType): ResearchNode[] {
  return project?.nodes.filter((node) => node.type === type) ?? [];
}
