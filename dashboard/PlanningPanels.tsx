"use client";

import { useState } from "react";
import { ArrowUpRight, CheckSquare, Lightbulb, Plus, Trash2 } from "lucide-react";
import type {
  HypothesisVote,
  ResearchProject,
  ResearchTaskStage,
  ResearchTaskStatus,
} from "../packages/contracts";
import { MonoMeta, SectionHeader, StatusBadge } from "./ui";

const STAGES: ResearchTaskStage[] = ["ideation", "literature", "analysis", "validation", "writing", "submission"];

function nextVote(current: HypothesisVote | undefined): HypothesisVote {
  if (!current || current === "neutral") return "supports";
  if (current === "supports") return "contradicts";
  return "neutral";
}

export function IdeationAndTasksPanel({
  project,
  busy,
  onPlanningAction,
}: {
  project: ResearchProject;
  busy: boolean;
  onPlanningAction: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const ideas = project.ideas || [];
  const tasks = project.tasks || [];

  const [ideaTitle, setIdeaTitle] = useState("");
  const [ideaNotes, setIdeaNotes] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskStage, setTaskStage] = useState<ResearchTaskStage>("literature");
  const [taskPriority, setTaskPriority] = useState<"low" | "medium" | "high">("medium");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <section className="ori-panel">
        <SectionHeader
          eyebrow="Ideation Scratchpad"
          title="Research Sparks & Concept Notes"
          description="Capture raw observations and promote promising questions directly into formal Graph Hypotheses or Research Gaps."
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            className="ori-input"
            placeholder="Research idea or mechanistic question..."
            value={ideaTitle}
            onChange={(e) => setIdeaTitle(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              className="ori-input"
              style={{ flex: 1, minWidth: 220 }}
              placeholder="Rationale, variables, or quick notes..."
              value={ideaNotes}
              onChange={(e) => setIdeaNotes(e.target.value)}
            />
            <button
              type="button"
              className="ori-btn ori-btn--primary ori-btn--sm"
              disabled={busy || ideaTitle.trim().length < 4}
              onClick={async () => {
                await onPlanningAction({
                  action: "upsert-idea",
                  idea: { title: ideaTitle.trim(), notes: ideaNotes.trim(), status: "spark" },
                });
                setIdeaTitle("");
                setIdeaNotes("");
              }}
            >
              <Plus size={13} /> Save Idea
            </button>
          </div>
        </div>

        {ideas.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No research ideas logged yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ideas.map((idea) => (
              <div key={idea.id} className="ori-inspector-card" style={{ padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 13.5 }}>{idea.title}</strong>
                  <StatusBadge tone={idea.status === "promoted" ? "ok" : "accent"}>{idea.status}</StatusBadge>
                </div>
                {idea.notes ? <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{idea.notes}</p> : null}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {idea.status !== "promoted" ? (
                    <>
                      <button
                        type="button"
                        className="ori-btn ori-btn--secondary ori-btn--sm"
                        disabled={busy}
                        onClick={() => void onPlanningAction({ action: "promote-idea", ideaId: idea.id, targetType: "hypothesis" })}
                      >
                        <ArrowUpRight size={12} /> Promote to Hypothesis
                      </button>
                      <button
                        type="button"
                        className="ori-btn ori-btn--ghost ori-btn--sm"
                        disabled={busy}
                        onClick={() => void onPlanningAction({ action: "promote-idea", ideaId: idea.id, targetType: "gap" })}
                      >
                        Promote to Gap
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="ori-btn ori-btn--ghost ori-btn--sm"
                    disabled={busy}
                    onClick={() => void onPlanningAction({ action: "delete-idea", ideaId: idea.id })}
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="ori-panel">
        <SectionHeader
          eyebrow="Project Organization"
          title="Stage-Tagged Research Task Tracker"
          description="Track concrete execution milestones from literature screening to lab validation and final LaTeX submission."
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            className="ori-input"
            style={{ flex: 1, minWidth: 200 }}
            placeholder="Add milestone (e.g. Run Welch t-test on control cohort)..."
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
          />
          <select className="ori-select" style={{ width: 130 }} value={taskStage} onChange={(e) => setTaskStage(e.target.value as ResearchTaskStage)}>
            {STAGES.map((st) => <option key={st} value={st}>{st}</option>)}
          </select>
          <select className="ori-select" style={{ width: 110 }} value={taskPriority} onChange={(e) => setTaskPriority(e.target.value as "low" | "medium" | "high")}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <button
            type="button"
            className="ori-btn ori-btn--primary ori-btn--sm"
            disabled={busy || taskTitle.trim().length < 3}
            onClick={async () => {
              await onPlanningAction({
                action: "upsert-task",
                task: { title: taskTitle.trim(), stage: taskStage, status: "todo", priority: taskPriority },
              });
              setTaskTitle("");
            }}
          >
            <CheckSquare size={13} /> Add Task
          </button>
        </div>

        {tasks.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No tasks recorded yet.</p>
        ) : (
          <div className="ori-table-wrap">
            <table className="ori-table">
              <thead>
                <tr><th>Milestone</th><th>Stage</th><th>Priority</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <strong style={{ fontSize: 13.5 }}>{task.title}</strong>
                      {task.linkedFilePath ? <MonoMeta> · {task.linkedFilePath}</MonoMeta> : null}
                    </td>
                    <td><StatusBadge tone="neutral">{task.stage}</StatusBadge></td>
                    <td><StatusBadge tone={task.priority === "high" ? "danger" : "neutral"}>{task.priority}</StatusBadge></td>
                    <td>
                      <select
                        className="ori-select"
                        style={{ minWidth: 115, padding: "4px 8px", fontSize: 12.5 }}
                        value={task.status}
                        disabled={busy}
                        onChange={(e) => void onPlanningAction({ action: "upsert-task", task: { ...task, status: e.target.value as ResearchTaskStatus } })}
                      >
                        <option value="todo">To Do</option>
                        <option value="in-progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                    </td>
                    <td>
                      <button type="button" className="ori-icon-btn" aria-label={`Delete ${task.title}`} onClick={() => void onPlanningAction({ action: "delete-task", taskId: task.id })}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export function CompetingHypothesesPanel({
  project,
  busy,
  onPlanningAction,
  onSelectNode,
}: {
  project: ResearchProject;
  busy: boolean;
  onPlanningAction: (payload: Record<string, unknown>) => Promise<void>;
  onSelectNode: (nodeId: string) => void;
}) {
  const hypotheses = project.nodes.filter((n) => n.type === "hypothesis");
  const evidence = project.nodes.filter((n) => n.type === "evidence" && n.data.verificationStatus !== "rejected");
  const matrix = project.hypothesisMatrix || {};

  const [newHypTitle, setNewHypTitle] = useState("");
  const [newHypStmt, setNewHypStmt] = useState("");

  return (
    <section className="ori-panel">
      <SectionHeader
        eyebrow="Chamberlin Multiple Working Hypotheses"
        title="Competing Hypotheses Matrix (H1 vs. H2)"
        description="Compare verified evidence side-by-side across rival hypotheses. Click any cell to cycle Neutral → Supports → Contradicts."
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          className="ori-input"
          style={{ flex: 1, minWidth: 200 }}
          placeholder="Add competing hypothesis title (manual, no AI required)..."
          value={newHypTitle}
          onChange={(e) => setNewHypTitle(e.target.value)}
        />
        <input
          className="ori-input"
          style={{ flex: 1, minWidth: 200 }}
          placeholder="Falsifiable testable prediction..."
          value={newHypStmt}
          onChange={(e) => setNewHypStmt(e.target.value)}
        />
        <button
          type="button"
          className="ori-btn ori-btn--primary ori-btn--sm"
          disabled={busy || newHypTitle.trim().length < 4}
          onClick={async () => {
            await onPlanningAction({ action: "create-hypothesis", title: newHypTitle.trim(), statement: newHypStmt.trim() });
            setNewHypTitle("");
            setNewHypStmt("");
          }}
        >
          <Lightbulb size={13} /> Add Hypothesis
        </button>
      </div>

      {!hypotheses.length || !evidence.length ? (
        <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>
          Add at least one hypothesis and one anchored evidence passage to score them against each other.
        </p>
      ) : (
        <div className="ori-table-wrap">
          <table className="ori-table">
            <thead>
              <tr>
                <th>Anchored Evidence ({evidence.length})</th>
                {hypotheses.map((h, idx) => {
                  const sup = evidence.filter((ev) => matrix[ev.id]?.[h.id] === "supports").length;
                  const con = evidence.filter((ev) => matrix[ev.id]?.[h.id] === "contradicts").length;
                  return (
                    <th key={h.id}>
                      <button type="button" className="ori-text-link" style={{ fontSize: 12 }} onClick={() => onSelectNode(h.id)}>
                        H{idx + 1}: {h.title.slice(0, 38)}
                      </button>
                      <div style={{ marginTop: 2, fontWeight: 400, textTransform: "none" }}>+{sup} / -{con}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {evidence.map((ev) => (
                <tr key={ev.id}>
                  <td>
                    <button type="button" className="ori-text-link" style={{ fontSize: 13 }} onClick={() => onSelectNode(ev.id)}>
                      {ev.title}
                    </button>
                    {ev.data.verified ? <MonoMeta> · Confirmed</MonoMeta> : <MonoMeta> · Unverified</MonoMeta>}
                  </td>
                  {hypotheses.map((h) => {
                    const vote: HypothesisVote = matrix[ev.id]?.[h.id] || "neutral";
                    return (
                      <td key={`${ev.id}-${h.id}`}>
                        <button
                          type="button"
                          disabled={busy}
                          className={`ori-chip-btn${vote !== "neutral" ? " ori-chip-btn--active" : ""}`}
                          style={{
                            borderColor: vote === "contradicts" ? "var(--status-danger)" : vote === "supports" ? "var(--status-ok)" : undefined,
                            color: vote === "contradicts" ? "var(--status-danger)" : vote === "supports" ? "var(--status-ok)" : undefined,
                          }}
                          onClick={() => void onPlanningAction({
                            action: "set-matrix-vote",
                            evidenceId: ev.id,
                            hypothesisId: h.id,
                            vote: nextVote(vote),
                          })}
                        >
                          {vote === "supports" ? "+ Supports" : vote === "contradicts" ? "− Contradicts" : "○ Neutral"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
