"use client";

import { useId, useMemo } from "react";
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
import type { EdgeType, NodeType, ResearchNode, ResearchProject } from "../packages/contracts";
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
  paper: "#476c87",
  evidence: "#2f6550",
  contradiction: "#b34b43",
  gap: "#9a6a27",
  hypothesis: "#476c87",
  experiment: "#2f6550",
  result: "#2f6550",
  review: "#636366",
  lab: "#476c87",
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
  if (node.type === "paper") {
    return [node.data.year, node.data.venue].filter(Boolean).join(" · ") || undefined;
  }
  if (node.type === "review" && node.data.reviewer) return `${node.data.reviewer} reviewer`;
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

function buildGraph(project: ResearchProject, selectedNodeId?: string): { nodes: GraphNode[]; edges: GraphEdge[] } {
  // Nodes and relationships are captured from this one canonical revision.
  const canonicalNodes = project.nodes;
  const knownIds = new Set(canonicalNodes.map((node) => node.id));
  const columns = new Map<number, ResearchNode[]>();

  for (const node of [...canonicalNodes].sort(compareIds)) {
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
        position: { x: column * 300, y: row * 192 + (maxRows - columnNodes.length) * 96 },
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
      const color = edge.type === "contradicts" ? "#b34b43" : edge.type === "supports" ? "#2f6550" : "#858587";
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
        labelStyle: { fill: edge.type === "contradicts" ? "#b34b43" : "#636366", fontSize: 10, fontWeight: 600 },
        labelBgStyle: { fill: "#ffffff", fillOpacity: 0.96 },
        labelBgPadding: [6, 4],
        labelBgBorderRadius: 5,
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
  const graph = useMemo(
    () => (project ? buildGraph(project, selectedNodeId) : { nodes: [], edges: [] }),
    [project, selectedNodeId],
  );

  const selectFromKeyboard = ({ nodes }: OnSelectionChangeParams<GraphNode, GraphEdge>) => {
    if (nodes.length === 1 && nodes[0].id !== selectedNodeId) onSelectNode(nodes[0].id);
  };

  if (!project) {
    return (
      <section className="kfg-shell kfg-shell--empty" aria-label="Knowledge graph">
        <Network size={26} strokeWidth={1.5} aria-hidden="true" />
        <h2>No investigation map yet</h2>
        <p>Start a research curiosity. Typed nodes and semantic relationships will appear only after they are committed to canonical state.</p>
      </section>
    );
  }

  return (
    <section className="kfg-shell" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <header className="kfg-header">
        <div>
          <h2 id={titleId}>Investigation map</h2>
          <p id={descriptionId}>Revision {project.revision} · {graph.nodes.length} nodes · {graph.edges.length} semantic relationships</p>
        </div>
        <span className="kfg-revision"><Network size={14} aria-hidden="true" /> Canonical r{project.revision}</span>
      </header>

      {graph.nodes.length === 0 ? (
        <div className="kfg-empty-graph">
          <Network size={26} strokeWidth={1.5} aria-hidden="true" />
          <h3>No graph nodes in revision {project.revision}</h3>
          <p>The canonical project is ready, but no typed research nodes have been committed yet.</p>
        </div>
      ) : (
        <>
          <div className="kfg-flow">
            <ReactFlow<GraphNode, GraphEdge>
              key={`${project.projectId}:${project.revision}`}
              nodes={graph.nodes}
              edges={graph.edges}
              nodeTypes={nodeTypes}
              onNodeClick={(_event, node) => onSelectNode(node.id)}
              onSelectionChange={selectFromKeyboard}
              fitView
              fitViewOptions={{ padding: 0.16, maxZoom: 0.9 }}
              minZoom={0.25}
              maxZoom={1.6}
              nodesDraggable={false}
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
              aria-label={`Interactive knowledge graph for revision ${project.revision}. A keyboard-accessible node index follows.`}
            >
              <Background variant={BackgroundVariant.Dots} color="#d4d4d0" gap={24} size={1.25} />
              <Controls position="bottom-left" showInteractive={false} />
              <MiniMap<GraphNode>
                className="kfg-minimap"
                position="bottom-right"
                pannable
                zoomable
                ariaLabel="Knowledge graph minimap"
                bgColor="#ffffff"
                maskColor="rgb(245 245 244 / 72%)"
                nodeColor={(node) => NODE_COLORS[node.data.kind]}
                nodeStrokeColor="#d4d4d0"
                nodeBorderRadius={8}
              />
              <Panel position="top-right" className="kfg-canvas-note">Scroll to pan · pinch to zoom</Panel>
            </ReactFlow>
          </div>

          <details className="kfg-index">
            <summary><ListTree size={16} aria-hidden="true" /> Keyboard-accessible node index <span>{graph.nodes.length}</span></summary>
            <div className="kfg-index-content">
              <p>Select any canonical node to open the same item in the research inspector.</p>
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
                        <span className={`kfg-index-icon kfg-index-icon--${node.type}`}><Icon size={16} strokeWidth={1.8} aria-hidden="true" /></span>
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
