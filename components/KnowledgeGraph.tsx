"use client";

import { useId, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
} from "@xyflow/react";
import type { Edge, Node, NodeProps, OnSelectionChangeParams } from "@xyflow/react";
import {
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  FlaskConical,
  Lightbulb,
  ListTree,
  Network,
  Quote,
  Search,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NODE_LABELS } from "../packages/contracts";
import type { ContradictionResolution, EdgeType, NodeType, ResearchNode, ResearchProject } from "../packages/contracts";
import { CONTRADICTION_RESOLUTION_LABELS } from "../src/contradictions";
import "@xyflow/react/dist/style.css";

export interface KnowledgeGraphProps {
  project: ResearchProject | null;
  selectedNodeId?: string;
  onSelectNode: (id: string) => void;
}

type GraphNodeData = {
  label: string;
  title: string;
  kind: NodeType;
  kindLabel: string;
  detail?: string;
  evidenceVerified?: boolean;
};

type GraphNode = Node<GraphNodeData, "research">;
type GraphEdge = Edge<{ relationship: EdgeType }, "smoothstep">;

const ALL_TYPES: NodeType[] = ["paper", "evidence", "contradiction", "gap", "hypothesis", "review", "experiment", "result", "lab"];

const NODE_ICONS: Record<NodeType, LucideIcon> = {
  paper: BookOpen,
  evidence: Quote,
  contradiction: CircleAlert,
  gap: Search,
  hypothesis: Lightbulb,
  experiment: FlaskConical,
  result: ClipboardCheck,
  review: ShieldCheck,
  lab: Building2,
};

const NODE_COLORS: Record<NodeType, string> = {
  paper: "#1e4fc2",
  evidence: "#1e4fc2",
  contradiction: "#b91c1c",
  gap: "#92400e",
  hypothesis: "#1e4fc2",
  experiment: "#1e4fc2",
  result: "#166534",
  review: "#525760",
  lab: "#787e88",
};

const NODE_COLUMNS: Record<NodeType, number> = {
  paper: 0,
  evidence: 1,
  contradiction: 1,
  gap: 2,
  hypothesis: 3,
  review: 4,
  experiment: 5,
  result: 6,
  lab: 6,
};

function compareIds(a: ResearchNode, b: ResearchNode): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function nodeDetail(node: ResearchNode): string | undefined {
  if (node.type === "paper") return [node.data.year, node.data.venue].filter(Boolean).join(" · ") || undefined;
  if (node.type === "contradiction") {
    const res = node.data.resolution as ContradictionResolution | undefined;
    return (res && CONTRADICTION_RESOLUTION_LABELS[res]?.label) || "Click to compare passages";
  }
  if (node.type === "review" && node.data.reviewer) return `${node.data.reviewer} reviewer`;
  if (node.type === "experiment" && node.data.modality) return `${node.data.modality} · expectations frozen`;
  if (node.type === "experiment" && node.data.expectedOutcomesFrozenAt) return "Expected outcomes frozen";
  if (node.type === "lab" && node.data.price) return node.data.price.kind;
  return undefined;
}

function ResearchFlowNode({ data, selected }: NodeProps<GraphNode>) {
  const Icon = NODE_ICONS[data.kind];
  return (
    <div className={`kfg-node kfg-node--${data.kind}${selected ? " kfg-node--selected" : ""}`}>
      <Handle type="target" position={Position.Left} className="kfg-handle" />
      <div className="kfg-node-kind">
        <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
        <span>{data.kindLabel}</span>
      </div>
      <p className="kfg-node-title">{data.title}</p>
      {data.detail ? <p className="kfg-node-detail">{data.detail}</p> : null}
      {data.kind === "evidence" ? (
        <span className={`kfg-evidence-state${data.evidenceVerified ? " kfg-evidence-state--verified" : ""}`}>
          {data.evidenceVerified ? <CheckCircle2 size={13} aria-hidden="true" /> : <CircleAlert size={13} aria-hidden="true" />}
          {data.evidenceVerified ? "Verified evidence" : "Unverified evidence"}
        </span>
      ) : null}
      <Handle type="source" position={Position.Right} className="kfg-handle" />
    </div>
  );
}

const nodeTypes = { research: ResearchFlowNode };

function buildGraph(
  project: ResearchProject,
  selectedNodeId: string | undefined,
  activeTypes: Set<NodeType>,
  verifiedOnly: boolean,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const filteredNodes = project.nodes.filter((node) => {
    if (!activeTypes.has(node.type)) return false;
    if (verifiedOnly && node.type === "evidence" && node.data.verified !== true) return false;
    return true;
  });
  const knownIds = new Set(filteredNodes.map((node) => node.id));
  const columns = new Map<number, ResearchNode[]>();

  for (const node of [...filteredNodes].sort(compareIds)) {
    const column = NODE_COLUMNS[node.type];
    columns.set(column, [...(columns.get(column) ?? []), node]);
  }
  const maxRows = Math.max(1, ...[...columns.values()].map((column) => column.length));
  const nodes: GraphNode[] = [];

  for (const [column, columnNodes] of [...columns.entries()].sort(([a], [b]) => a - b)) {
    columnNodes.forEach((node, row) => {
      nodes.push({
        id: node.id,
        type: "research",
        position: { x: column * 310, y: row * 188 + (maxRows - columnNodes.length) * 90 },
        data: {
          label: node.title,
          title: node.title,
          kind: node.type,
          kindLabel: NODE_LABELS[node.type],
          detail: nodeDetail(node),
          evidenceVerified: node.type === "evidence" ? node.data.verified === true : undefined,
        },
        selected: node.id === selectedNodeId,
        focusable: true,
        ariaRole: "group",
        ariaLabel: `${NODE_LABELS[node.type]}: ${node.title}`,
      });
    });
  }

  const edges: GraphEdge[] = project.edges
    .filter((edge) => knownIds.has(edge.source) && knownIds.has(edge.target))
    .map((edge) => {
      const color = edge.type === "contradicts" ? "#b91c1c" : edge.type === "supports" ? "#1e4fc2" : "#787e88";
      const selected = edge.source === selectedNodeId || edge.target === selectedNodeId;
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "smoothstep",
        data: { relationship: edge.type },
        label: edge.label || edge.type,
        selected,
        focusable: false,
        className: `kfg-edge kfg-edge--${edge.type}${selected ? " kfg-edge--selected" : ""}`,
        style: { stroke: color, strokeWidth: selected ? 2.25 : 1.5 },
        labelStyle: { fill: edge.type === "contradicts" ? "var(--status-danger)" : "var(--text-secondary)", fontSize: 10, fontWeight: 600 },
        labelBgStyle: { fill: "var(--bg-surface)", fillOpacity: 0.96 },
        labelBgPadding: [6, 4],
        labelBgBorderRadius: 6,
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
        ariaRole: "group",
        ariaLabel: `${edge.label || edge.type}: ${edge.source} to ${edge.target}`,
      };
    });

  return { nodes, edges };
}

export function KnowledgeGraph({ project, selectedNodeId, onSelectNode }: KnowledgeGraphProps) {
  const titleId = useId();
  const descriptionId = useId();
  const [hiddenTypes, setHiddenTypes] = useState<Set<NodeType>>(new Set());
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const activeTypes = useMemo(() => new Set(ALL_TYPES.filter((t) => !hiddenTypes.has(t))), [hiddenTypes]);
  const graph = useMemo(
    () => (project ? buildGraph(project, selectedNodeId, activeTypes, verifiedOnly) : { nodes: [], edges: [] }),
    [project, selectedNodeId, activeTypes, verifiedOnly],
  );

  const toggleType = (type: NodeType) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const selectFromKeyboard = ({ nodes }: OnSelectionChangeParams<GraphNode, GraphEdge>) => {
    if (nodes.length === 1 && nodes[0].id !== selectedNodeId) onSelectNode(nodes[0].id);
  };

  if (!project) {
    return (
      <section className="kfg-shell kfg-shell--empty" aria-label="Knowledge graph">
        <Network size={26} strokeWidth={1.5} aria-hidden="true" />
        <h2>No investigation map yet</h2>
        <p>Start a research curiosity. Typed nodes and semantic relationships appear as canonical artifacts are committed.</p>
      </section>
    );
  }

  return (
    <section className="kfg-shell" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <header className="kfg-header">
        <div>
          <h2 id={titleId}>Knowledge Graph</h2>
          <p id={descriptionId}>Revision {project.revision} · {graph.nodes.length} visible nodes · {graph.edges.length} semantic relationships</p>
        </div>
        <span className="kfg-revision"><Network size={14} aria-hidden="true" /> Canonical r{project.revision}</span>
      </header>

      <div className="kfg-toolbar" role="toolbar" aria-label="Filter graph nodes">
        {ALL_TYPES.map((type) => {
          const count = project.nodes.filter((n) => n.type === type).length;
          if (!count) return null;
          const active = activeTypes.has(type);
          return (
            <button
              key={type}
              type="button"
              className={`kfg-filter-chip${active ? " kfg-filter-chip--active" : ""}`}
              onClick={() => toggleType(type)}
              aria-pressed={active}
            >
              {NODE_LABELS[type]} ({count})
            </button>
          );
        })}
        <button
          type="button"
          className={`kfg-filter-chip${verifiedOnly ? " kfg-filter-chip--active" : ""}`}
          onClick={() => setVerifiedOnly((v) => !v)}
          aria-pressed={verifiedOnly}
        >
          Verified evidence only
        </button>
      </div>

      {graph.nodes.length === 0 ? (
        <div className="kfg-empty-graph">
          <Network size={26} strokeWidth={1.5} aria-hidden="true" />
          <h3>No matching nodes in revision {project.revision}</h3>
          <p>Adjust your node filters or run a literature query to populate the graph.</p>
        </div>
      ) : (
        <>
          <div className="kfg-flow">
            {/* Stable key on projectId only — never remounts or resets zoom/pan on revision updates */}
            <ReactFlow<GraphNode, GraphEdge>
              key={project.projectId}
              nodes={graph.nodes}
              edges={graph.edges}
              nodeTypes={nodeTypes}
              onNodeClick={(_event, node) => onSelectNode(node.id)}
              onSelectionChange={selectFromKeyboard}
              fitView
              fitViewOptions={{ padding: 0.16, maxZoom: 0.95 }}
              minZoom={0.25}
              maxZoom={1.6}
              nodesDraggable
              nodesConnectable={false}
              nodesFocusable
              edgesFocusable={false}
              elementsSelectable
              panOnScroll
              zoomOnScroll={false}
              zoomOnPinch
              selectionOnDrag={false}
              onlyRenderVisibleElements
              role="group"
              aria-label={`Interactive knowledge graph for revision ${project.revision}.`}
            >
              <Background variant={BackgroundVariant.Dots} color="var(--border-strong)" gap={24} size={1.2} />
              <Controls position="bottom-left" showInteractive={false} />
              <MiniMap<GraphNode>
                className="kfg-minimap"
                position="bottom-right"
                pannable
                zoomable
                ariaLabel="Knowledge graph minimap"
                bgColor="var(--bg-surface)"
                maskColor="var(--bg-hover)"
                nodeColor={(node) => NODE_COLORS[node.data.kind]}
                nodeStrokeColor="var(--border-subtle)"
                nodeBorderRadius={8}
              />
              <Panel position="top-right" className="kfg-canvas-note">Drag nodes · scroll to pan · pinch to zoom</Panel>
            </ReactFlow>
          </div>

          <details className="kfg-index">
            <summary><ListTree size={16} aria-hidden="true" /> Keyboard-accessible node index <span>{graph.nodes.length}</span></summary>
            <div className="kfg-index-content">
              <p>Select any canonical node to inspect its provenance and edit or verify it in the inspector.</p>
              <ul role="list" className="kfg-node-list">
                {project.nodes.map((node) => {
                  const Icon = NODE_ICONS[node.type];
                  const selected = node.id === selectedNodeId;
                  return (
                    <li key={node.id}>
                      <button
                        type="button"
                        className={`kfg-node-index-button${selected ? " kfg-node-index-button--selected" : ""}`}
                        onClick={() => onSelectNode(node.id)}
                        aria-current={selected ? "true" : undefined}
                      >
                        <span className="kfg-index-icon"><Icon size={16} strokeWidth={1.8} aria-hidden="true" /></span>
                        <span className="kfg-index-copy">
                          <span className="kfg-index-kind">{NODE_LABELS[node.type]}</span>
                          <strong>{node.title}</strong>
                          {node.type === "evidence" ? <span className="kfg-index-evidence">{node.data.verified === true ? "Verified evidence" : "Unverified evidence"}</span> : null}
                        </span>
                        {selected ? <span className="kfg-index-selected">Selected</span> : null}
                        <ArrowRight size={15} aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
