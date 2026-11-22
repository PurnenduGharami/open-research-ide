"use client";

import { useId, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  AlertCircle,
  Beaker,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  FileSearch,
  FlaskConical,
  Lightbulb,
  ListChecks,
  Mail,
  ShieldCheck,
} from "lucide-react";
import type {
  ExpectedOutcome,
  ResearchNode,
  ResearchProject,
  ResearchSource,
  ReviewFinding,
} from "../packages/contracts";

export function formatDateTime(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function safeExternalUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function nodesFromIds(project: ResearchProject, ids?: string[]): ResearchNode[] {
  if (!ids) return [];
  const byId = new Map(project.nodes.map((node) => [node.id, node]));
  return ids.map((id) => byId.get(id)).filter((node): node is ResearchNode => Boolean(node));
}

export function DashboardEmptyState({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="ori-empty-state">
      {icon ? <div className="ori-empty-icon" aria-hidden="true">{icon}</div> : null}
      <h2>{title}</h2>
      <div className="ori-empty-copy">{children}</div>
    </div>
  );
}

export function StepTracker({ project }: { project: ResearchProject | null }) {
  const papers = project?.nodes.filter((node) => node.type === "paper") ?? [];
  const hypotheses = project?.nodes.filter((node) => node.type === "hypothesis") ?? [];
  const reviews = project?.nodes.filter((node) => node.type === "review") ?? [];
  const experiments = project?.nodes.filter((node) => node.type === "experiment") ?? [];
  const results = project?.nodes.filter((node) => node.type === "result") ?? [];
  const reviewers = new Set(reviews.map((node) => node.data.reviewer?.toLowerCase()).filter(Boolean));
  const reviewCount = ["auditor", "critic", "feasibility"].filter((reviewer) => reviewers.has(reviewer)).length;
  const exports = project?.exports ?? [];
  const steps = [
    { label: "Curiosity", complete: Boolean(project?.curiosity.trim()), detail: project ? "Question captured" : "No question yet" },
    { label: "Literature", complete: papers.length > 0, detail: papers.length ? plural(papers.length, "paper") : "No papers yet" },
    { label: "Hypotheses", complete: hypotheses.length > 0, detail: hypotheses.length ? plural(hypotheses.length, "hypothesis", "hypotheses") : "None yet" },
    { label: "Goldfish", complete: reviewCount === 3, detail: `${reviewCount} of 3 reviews` },
    { label: "Experiment", complete: experiments.length > 0, detail: experiments.length ? plural(experiments.length, "experiment") : "None yet" },
    { label: "Results", complete: results.length > 0, detail: results.length ? plural(results.length, "observed result") : "None imported" },
    { label: "Published", complete: exports.length > 0, detail: exports.length ? plural(exports.length, "export file") : "No files yet" },
  ];
  const nextStep = steps.findIndex((step) => !step.complete);

  return (
    <section className="ori-step-tracker" aria-label="Research progress">
      <ol>
        {steps.map((step, index) => (
          <li
            key={step.label}
            className={`ori-step${step.complete ? " ori-step--complete" : ""}${project && index === nextStep ? " ori-step--next" : ""}`}
            aria-current={project && index === nextStep ? "step" : undefined}
          >
            <span className="ori-step-marker" aria-hidden="true">
              {step.complete ? <Check size={14} strokeWidth={2.2} /> : index + 1}
            </span>
            <span className="ori-step-copy">
              <span className="ori-step-label">{step.label}</span>
              <span className="ori-step-detail">{step.detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function SourceFailures({ sources }: { sources: ResearchSource[] }) {
  const failures = sources.filter((source) => source.status !== "ok" || source.error);
  if (!failures.length) return null;

  return (
    <section className="ori-source-failures" aria-labelledby="ori-source-failures-title">
      <div className="ori-section-heading-row">
        <AlertCircle size={18} aria-hidden="true" />
        <h2 id="ori-source-failures-title">Literature source issues</h2>
      </div>
      <ul>
        {failures.map((source) => {
          const href = safeExternalUrl(source.url);
          return (
            <li key={source.id}>
              <div>
                <strong>{source.provider}</strong>
                <span className={`ori-pill ${source.status === "error" ? "ori-pill--error" : "ori-pill--warning"}`}>
                  {source.status === "error" ? "Source failed" : source.status === "partial" ? "Partial source" : "Source issue"}
                </span>
              </div>
              <p>{source.error || (source.status === "partial" ? "The provider reported a partial result without an error detail." : "The provider reported an error without an error detail.")}</p>
              <div className="ori-source-meta">
                <span>Queried {formatDateTime(source.queriedAt)}</span>
                {href ? <a href={href} target="_blank" rel="noreferrer">Provider record <ExternalLink size={12} aria-hidden="true" /></a> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function doiHref(doi: string): string {
  const normalized = doi.trim().replace(/^doi:\s*/i, "").replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
  return `https://doi.org/${normalized.split("/").map(encodeURIComponent).join("/")}`;
}

export function LiteratureTable({
  papers,
  sources = [],
  onSelectNode,
}: {
  papers: ResearchNode[];
  sources?: ResearchSource[];
  onSelectNode: (id: string) => void;
}) {
  return (
    <>
      <SourceFailures sources={sources} />
      {papers.length ? (
        <div className="ori-table-scroll" tabIndex={0} role="region" aria-label="Retrieved literature table">
          <table className="ori-literature-table">
            <caption>Literature records in the current canonical revision</caption>
            <thead>
              <tr>
                <th scope="col">Paper</th>
                <th scope="col">Providers</th>
                <th scope="col">Year</th>
                <th scope="col">DOI</th>
                <th scope="col">Abstract</th>
              </tr>
            </thead>
            <tbody>
              {papers.map((paper) => {
                const providers = Object.entries(paper.data.providerIds ?? {});
                const doi = paper.data.doi?.trim();
                const sourceUrl = safeExternalUrl(paper.data.url);
                return (
                  <tr key={paper.id}>
                    <th scope="row" data-label="Paper">
                      <button type="button" className="ori-node-link" onClick={() => onSelectNode(paper.id)}>{paper.title}</button>
                      <span className="ori-paper-meta">{paper.data.venue || "Venue not supplied"}</span>
                      {sourceUrl ? <a className="ori-inline-link" href={sourceUrl} target="_blank" rel="noreferrer">Source page <ExternalLink size={12} aria-hidden="true" /></a> : null}
                    </th>
                    <td data-label="Providers">
                      {providers.length ? (
                        <ul className="ori-provider-list" aria-label={`Providers for ${paper.title}`}>
                          {providers.map(([provider, id]) => <li key={provider} title={`${provider} record: ${id}`}>{provider}</li>)}
                        </ul>
                      ) : "—"}
                    </td>
                    <td data-label="Year" className="ori-numeric">{paper.data.year ?? "—"}</td>
                    <td data-label="DOI">
                      {doi ? <a href={doiHref(doi)} target="_blank" rel="noreferrer">{doi.replace(/^doi:\s*/i, "")}<ExternalLink size={12} aria-hidden="true" /></a> : "—"}
                    </td>
                    <td data-label="Abstract">
                      <span className={paper.data.abstract?.trim() ? "ori-text-status ori-text-status--available" : "ori-text-status"}>
                        {paper.data.abstract?.trim() ? "Available" : "Unavailable"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <DashboardEmptyState icon={<BookOpen size={24} />} title="No literature in this revision">
          <p>Papers appear here only after a literature provider returns real records.</p>
        </DashboardEmptyState>
      )}
    </>
  );
}

export function AnalysisBlock({
  project,
  nodeIds,
  busy,
  onSelectNode,
  onConfirmEvidence,
}: {
  project: ResearchProject;
  nodeIds: string[];
  busy: boolean;
  onSelectNode: (id: string) => void;
  onConfirmEvidence: (id: string) => void;
}) {
  const headingId = useId();
  const nodes = nodesFromIds(project, nodeIds);
  const evidence = nodes.filter((node) => node.type === "evidence" || node.type === "contradiction");
  const hypotheses = nodes.filter((node) => node.type === "hypothesis");
  const gaps = nodes.filter((node) => node.type === "gap");
  const papers = new Map(project.nodes.filter((node) => node.type === "paper").map((node) => [node.id, node]));

  if (!nodes.length) {
    return <p className="ori-inline-empty">No analysis nodes are attached to this block in the current revision.</p>;
  }

  return (
    <div className="ori-analysis-block">
      {evidence.length ? (
        <section aria-labelledby={`${headingId}-evidence`}>
          <h3 id={`${headingId}-evidence`}>Evidence passages</h3>
          <ul className="ori-evidence-list">
            {evidence.map((node) => {
              const paper = node.data.paperId ? papers.get(node.data.paperId) : undefined;
              return (
                <li key={node.id}>
                  <div className="ori-evidence-header">
                    <button type="button" className="ori-node-link" onClick={() => onSelectNode(node.id)}>{node.title}</button>
                    <span className={`ori-pill ${node.type === "contradiction" ? "ori-pill--error" : node.data.verified ? "ori-pill--success" : "ori-pill--warning"}`}>
                      {node.type === "contradiction" ? "Contradiction" : node.data.verified ? "Confirmed" : "Unverified"}
                    </span>
                  </div>
                  {node.data.quote ? <blockquote>{node.data.quote}</blockquote> : <p className="ori-inline-empty">No exact passage is recorded for this evidence node.</p>}
                  <div className="ori-evidence-actions">
                    {paper ? <button type="button" className="ori-text-button" onClick={() => onSelectNode(paper.id)}>Source: {paper.title}<ChevronRight size={13} aria-hidden="true" /></button> : null}
                    {node.type === "evidence" && !node.data.verified ? (
                      <button type="button" className="ori-button ori-button--secondary" disabled={busy} onClick={() => onConfirmEvidence(node.id)}>
                        <ClipboardCheck size={15} aria-hidden="true" />Confirm evidence
                      </button>
                    ) : null}
                  </div>
                  {node.type === "evidence" && !node.data.verified ? <p className="ori-field-hint">Confirmation runs a deterministic passage check; no model is used.</p> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {hypotheses.length ? (
        <section aria-labelledby={`${headingId}-hypotheses`}>
          <h3 id={`${headingId}-hypotheses`}>Hypotheses</h3>
          <ul className="ori-title-list">
            {hypotheses.map((node) => (
              <li key={node.id}><Lightbulb size={16} aria-hidden="true" /><button type="button" className="ori-node-link" onClick={() => onSelectNode(node.id)}>{node.title}</button></li>
            ))}
          </ul>
        </section>
      ) : null}
      {gaps.length ? (
        <section aria-labelledby={`${headingId}-gaps`}>
          <h3 id={`${headingId}-gaps`}>Research gaps</h3>
          <ul className="ori-title-list">
            {gaps.map((node) => <li key={node.id}><FileSearch size={16} aria-hidden="true" /><button type="button" className="ori-node-link" onClick={() => onSelectNode(node.id)}>{node.title}</button></li>)}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

const GOLD_FISH = [
  { id: "auditor", label: "Auditor", description: "Evidence audit", icon: ShieldCheck },
  { id: "critic", label: "Critic", description: "Independent scientific critique", icon: FileSearch },
  { id: "feasibility", label: "Feasibility", description: "Practical feasibility", icon: ListChecks },
] as const;

function FindingList({ findings }: { findings: ReviewFinding[] }) {
  return (
    <ul className="ori-finding-list">
      {findings.map((finding, index) => (
        <li key={`${finding.claim || finding.finding || "finding"}-${index}`}>
          <div className="ori-finding-meta">
            {finding.status ? <span className="ori-pill">{finding.status}</span> : null}
            {finding.severity ? <span className="ori-finding-severity">{finding.severity} severity</span> : null}
          </div>
          {finding.claim ? <p><strong>Claim:</strong> {finding.claim}</p> : null}
          {finding.finding ? <p>{finding.finding}</p> : null}
          {finding.rationale ? <p className="ori-secondary-copy">{finding.rationale}</p> : null}
        </li>
      ))}
    </ul>
  );
}

export function ReviewBlock({
  project,
  nodeIds,
  onSelectNode,
}: {
  project: ResearchProject;
  nodeIds: string[];
  onSelectNode: (id: string) => void;
}) {
  const headingId = useId();
  const blockNodes = nodesFromIds(project, nodeIds);
  const attachedReviews = blockNodes.filter((node) => node.type === "review");
  const reviews = attachedReviews.length ? attachedReviews : project.nodes.filter((node) => node.type === "review");
  const attachedHypotheses = blockNodes.filter((node) => node.type === "hypothesis");
  const hypothesisIds = new Set(reviews.map((node) => node.data.hypothesisId).filter((id): id is string => Boolean(id)));
  const hypotheses = attachedHypotheses.length
    ? attachedHypotheses
    : project.nodes.filter((node) => node.type === "hypothesis" && (hypothesisIds.size ? hypothesisIds.has(node.id) : true));
  const additionalReviews = reviews.filter((node) => !GOLD_FISH.some(({ id }) => id === node.data.reviewer?.toLowerCase()));

  return (
    <div className="ori-review-block">
      <section className="ori-review-hypotheses" aria-labelledby={`${headingId}-hypotheses`}>
        <h3 id={`${headingId}-hypotheses`}>Hypotheses under review</h3>
        {hypotheses.length ? (
          <ul className="ori-title-list">
            {hypotheses.map((node) => <li key={node.id}><Lightbulb size={16} aria-hidden="true" /><button type="button" className="ori-node-link" onClick={() => onSelectNode(node.id)}>{node.title}</button></li>)}
          </ul>
        ) : <p className="ori-inline-empty">No hypotheses are linked to these reviews in the current revision.</p>}
      </section>
      <div className="ori-goldfish-grid">
        {GOLD_FISH.map(({ id, label, description, icon: Icon }) => {
          const reviewerNodes = reviews.filter((node) => node.data.reviewer?.toLowerCase() === id);
          return (
            <article className="ori-goldfish-card" key={id}>
              <header>
                <Icon size={20} aria-hidden="true" />
                <div><h3>{label}</h3><p>{description}</p></div>
              </header>
              <span className="ori-review-count">{plural(reviewerNodes.length, "review")}</span>
              {reviewerNodes.length ? reviewerNodes.map((review) => (
                <div className="ori-review-entry" key={review.id}>
                  <button type="button" className="ori-node-link" onClick={() => onSelectNode(review.id)}>{review.title}</button>
                  {review.data.verdict ? <p className="ori-review-verdict">{review.data.verdict}</p> : null}
                  {review.data.parseError ? <p className="ori-review-parse-error"><AlertCircle size={14} aria-hidden="true" />{review.data.parseError}</p> : null}
                  {review.data.findings?.length ? <FindingList findings={review.data.findings} /> : <p className="ori-inline-empty">No structured findings were returned for this review.</p>}
                </div>
              )) : <p className="ori-inline-empty">No {label.toLowerCase()} review is present in this revision.</p>}
            </article>
          );
        })}
      </div>
      {additionalReviews.length ? (
        <section className="ori-additional-reviews" aria-labelledby="ori-additional-reviews-title">
          <h3 id="ori-additional-reviews-title">Additional reviews</h3>
          {additionalReviews.map((review) => <button type="button" className="ori-node-link" key={review.id} onClick={() => onSelectNode(review.id)}>{review.title}</button>)}
        </section>
      ) : null}
    </div>
  );
}

function formatPrice(node: ResearchNode): { label: string; value?: string } {
  const price = node.data.price;
  if (!price) return { label: "Unavailable" };
  const label = price.kind === "quoted" ? "Quoted" : price.kind === "model-estimated" ? "Model-estimated" : "Unavailable";
  if (typeof price.amount !== "number" || !Number.isFinite(price.amount) || !price.currency) return { label };
  try {
    return { label, value: new Intl.NumberFormat(undefined, { style: "currency", currency: price.currency }).format(price.amount) };
  } catch {
    return { label, value: `${price.currency} ${price.amount}` };
  }
}

export function LabBridge({ labs, onSelectNode }: { labs: ResearchNode[]; onSelectNode: (id: string) => void }) {
  const headingId = useId();
  return (
    <section className="ori-lab-bridge" aria-labelledby={headingId}>
      <div className="ori-section-heading-row">
        <Beaker size={18} aria-hidden="true" />
        <h3 id={headingId}>Lab Bridge</h3>
      </div>
      {labs.length ? (
        <ul className="ori-lab-list">
          {labs.map((lab) => {
            const price = formatPrice(lab);
            const href = safeExternalUrl(lab.data.url);
            return (
              <li key={lab.id}>
                <div className="ori-lab-heading">
                  <div>
                    <button type="button" className="ori-node-link" onClick={() => onSelectNode(lab.id)}>{lab.data.name || lab.title}</button>
                    {lab.data.institution ? <p>{lab.data.institution}</p> : null}
                  </div>
                  <span className={`ori-pill ${lab.data.contacted ? "ori-pill--success" : ""}`}>{lab.data.contacted ? "Contacted" : "Uncontacted"}</span>
                </div>
                {lab.data.fit ? <p>{lab.data.fit}</p> : null}
                <div className="ori-price-row">
                  <span className={`ori-price-label ori-price-label--${lab.data.price?.kind ?? "unavailable"}`}>{price.label}</span>
                  {price.value ? <strong className="ori-numeric">{price.value}</strong> : <span>No price amount available</span>}
                </div>
                {lab.data.price?.note ? <p className="ori-field-hint">{lab.data.price.note}</p> : null}
                {href ? <a className="ori-inline-link" href={href} target="_blank" rel="noreferrer">Lab website <ExternalLink size={12} aria-hidden="true" /></a> : null}
              </li>
            );
          })}
        </ul>
      ) : <p className="ori-inline-empty">No lab options are recorded for this experiment.</p>}
    </section>
  );
}

function OutcomeList({ outcomes }: { outcomes: ExpectedOutcome[] }) {
  return (
    <ol className="ori-outcome-list">
      {outcomes.map((outcome, index) => (
        <li key={`${outcome.metric}-${index}`}>
          <strong>{outcome.metric}</strong>
          <p>{outcome.prediction}</p>
          {outcome.rationale ? <p className="ori-secondary-copy">{outcome.rationale}</p> : null}
        </li>
      ))}
    </ol>
  );
}

export function ResultImportForm({
  experimentId,
  busy,
  onImportResult,
}: {
  experimentId: string;
  busy: boolean;
  onImportResult: (experimentId: string, observations: string) => void;
}) {
  const id = useId();
  const [observations, setObservations] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = observations.trim();
    if (!value) return;
    onImportResult(experimentId, value);
    setObservations("");
  };

  return (
    <form className="ori-result-form" onSubmit={submit}>
      <div>
        <h3>Import observed results</h3>
        <p id={`${id}-hint`}>Observations are stored separately and never overwrite the frozen predictions above.</p>
      </div>
      <label htmlFor={`${id}-observations`}>Observed measurements and outcomes</label>
      <textarea
        id={`${id}-observations`}
        value={observations}
        onChange={(event) => setObservations(event.target.value)}
        aria-describedby={`${id}-hint`}
        rows={4}
        required
        disabled={busy}
        placeholder="Paste the observations returned by your experiment or lab."
      />
      <div className="ori-form-actions">
        <button type="submit" className="ori-button ori-button--primary" disabled={busy || !observations.trim()}>
          <ClipboardCheck size={16} aria-hidden="true" />Import observed results
        </button>
      </div>
    </form>
  );
}

export function ExperimentBlock({
  experiment,
  labs,
  busy,
  onSelectNode,
  onImportResult,
}: {
  experiment: ResearchNode;
  labs: ResearchNode[];
  busy: boolean;
  onSelectNode: (id: string) => void;
  onImportResult: (experimentId: string, observations: string) => void;
}) {
  const data = experiment.data;
  const variableEntries = Object.entries(data.variables ?? {});
  return (
    <div className="ori-experiment-block">
      <div className="ori-experiment-title-row">
        <button type="button" className="ori-node-link ori-experiment-title" onClick={() => onSelectNode(experiment.id)}>{experiment.title}</button>
        <span className="ori-pill"><FlaskConical size={12} aria-hidden="true" />Experiment</span>
      </div>
      {data.protocol?.length ? (
        <section aria-labelledby={`${experiment.id}-protocol`}>
          <h3 id={`${experiment.id}-protocol`}>Protocol</h3>
          <ol className="ori-protocol-list">{data.protocol.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ol>
        </section>
      ) : <p className="ori-inline-empty">No protocol steps are recorded in this revision.</p>}
      {variableEntries.length ? (
        <section aria-labelledby={`${experiment.id}-variables`}>
          <h3 id={`${experiment.id}-variables`}>Variables</h3>
          <dl className="ori-variable-list">{variableEntries.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
        </section>
      ) : null}
      <section className="ori-frozen-outcomes" aria-labelledby={`${experiment.id}-outcomes`}>
        <div className="ori-section-heading-row">
          <CheckCircle2 size={18} aria-hidden="true" />
          <h3 id={`${experiment.id}-outcomes`}>Frozen expected outcomes</h3>
        </div>
        <p className="ori-field-hint">{data.expectedOutcomesFrozenAt ? `Frozen at ${formatDateTime(data.expectedOutcomesFrozenAt)}.` : "Freeze time not recorded."}</p>
        {data.expectedOutcomes?.length ? <OutcomeList outcomes={data.expectedOutcomes} /> : <p className="ori-inline-empty">No expected outcomes are recorded for this experiment.</p>}
      </section>
      {data.safety?.length ? (
        <section aria-labelledby={`${experiment.id}-safety`}>
          <h3 id={`${experiment.id}-safety`}>Safety constraints</h3>
          <ul className="ori-plain-list">{data.safety.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      ) : null}
      <LabBridge labs={labs} onSelectNode={onSelectNode} />
      {data.outreachDraft ? (
        <details className="ori-outreach-draft">
          <summary><Mail size={16} aria-hidden="true" />Outreach draft</summary>
          <div><h4>{data.outreachDraft.subject}</h4><p>{data.outreachDraft.body}</p></div>
        </details>
      ) : null}
      <ResultImportForm experimentId={experiment.id} busy={busy} onImportResult={onImportResult} />
    </div>
  );
}

export function ResultBlock({ project, nodeIds, onSelectNode }: { project: ResearchProject; nodeIds: string[]; onSelectNode: (id: string) => void }) {
  const attached = nodesFromIds(project, nodeIds).filter((node) => node.type === "result");
  const results = attached.length ? attached : project.nodes.filter((node) => node.type === "result");
  const experiments = new Map(project.nodes.filter((node) => node.type === "experiment").map((node) => [node.id, node]));
  if (!results.length) {
    return <DashboardEmptyState icon={<ClipboardCheck size={24} />} title="No observed results imported"><p>Imported observations will remain separate from expected outcomes.</p></DashboardEmptyState>;
  }
  return (
    <ul className="ori-result-list">
      {results.map((result) => {
        const experiment = result.data.experimentId ? experiments.get(result.data.experimentId) : undefined;
        return (
          <li key={result.id}>
            <button type="button" className="ori-node-link" onClick={() => onSelectNode(result.id)}>{result.title}</button>
            <div className="ori-result-meta">
              <span>Imported {formatDateTime(result.data.importedAt)}</span>
              {experiment ? <button type="button" className="ori-text-button" onClick={() => onSelectNode(experiment.id)}>Experiment: {experiment.title}<ChevronRight size={13} aria-hidden="true" /></button> : null}
            </div>
            {result.data.observations ? <p className="ori-observations">{result.data.observations}</p> : <p className="ori-inline-empty">No observation text is recorded.</p>}
          </li>
        );
      })}
    </ul>
  );
}

export function TimelineBlock({ project, onSelectNode }: { project: ResearchProject; onSelectNode: (id: string) => void }) {
  const nodeById = new Map(project.nodes.map((node) => [node.id, node]));
  return (
    <section className="ori-block ori-timeline-block" aria-labelledby="ori-timeline-title">
      <div className="ori-block-header"><h2 id="ori-timeline-title">Investigation timeline</h2><span className="ori-revision-label">Revision {project.revision}</span></div>
      {project.timeline.length ? (
        <ol className="ori-timeline-list">
          {project.timeline.map((event) => (
            <li key={event.id}>
              <div className="ori-timeline-marker" aria-hidden="true" />
              <div>
                <div className="ori-timeline-meta"><time dateTime={event.at}>{formatDateTime(event.at)}</time><span>{event.kind}</span></div>
                <p>{event.message}</p>
                {event.nodeIds.length ? <div className="ori-timeline-nodes">{event.nodeIds.map((id) => {
                  const node = nodeById.get(id);
                  return node ? <button type="button" className="ori-text-button" key={id} onClick={() => onSelectNode(id)}>{node.title}</button> : null;
                })}</div> : null}
              </div>
            </li>
          ))}
        </ol>
      ) : <p className="ori-inline-empty">No timeline events are recorded in this revision.</p>}
    </section>
  );
}
