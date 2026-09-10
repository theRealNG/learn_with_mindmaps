"use client";

import { useEffect, useMemo } from "react";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { NodeDto } from "@/lib/types";

const COLUMN_WIDTH = 300;
const CARD_HEIGHT = 118;
const ROW_GAP = 18;

export interface CanvasColumn {
  /** The node whose children this column holds; null for the Root Node column. */
  parentId: string | null;
  nodes: NodeDto[];
  loading?: boolean;
}

type CardData = {
  label: string;
  summary: string;
  selected: boolean;
  onPath: boolean;
  expanded: boolean;
  hasChildren: boolean;
  onSelect: (id: string) => void;
};

function NodeCard({ id, data }: NodeProps<Node<CardData>>) {
  return (
    <div
      className="node-card"
      data-selected={data.selected}
      data-onpath={!data.selected && data.onPath}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") data.onSelect(id);
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div className="label">{data.label}</div>
      <div className="snippet">{data.summary}</div>
      <div className="marks">
        {data.hasChildren && <span>expanded</span>}
        {data.expanded && !data.hasChildren && <span>leaf</span>}
        {!data.expanded && <span>unexpanded</span>}
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="node-card shimmer" style={{ cursor: "default" }}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div className="label" style={{ color: "var(--text-faint)" }}>
        Generating…
      </div>
      <div className="snippet">Exploring the source and writing this level.</div>
    </div>
  );
}

const nodeTypes = { card: NodeCard, loading: LoadingCard };

function Flow({
  columns,
  selectedId,
  pathIds,
  onSelect,
}: {
  columns: CanvasColumn[];
  selectedId: string | null;
  pathIds: string[];
  onSelect: (id: string) => void;
}) {
  const { fitView } = useReactFlow();

  const { nodes, edges } = useMemo(() => {
    const flowNodes: Node[] = [];
    const flowEdges: Edge[] = [];

    columns.forEach((column, columnIndex) => {
      const count = column.loading ? 3 : column.nodes.length;
      const totalHeight = count * CARD_HEIGHT + Math.max(0, count - 1) * ROW_GAP;
      const top = -totalHeight / 2;

      if (column.loading) {
        for (let index = 0; index < count; index++) {
          const id = `loading-${columnIndex}-${index}`;
          flowNodes.push({
            id,
            type: "loading",
            position: { x: columnIndex * COLUMN_WIDTH, y: top + index * (CARD_HEIGHT + ROW_GAP) },
            data: {},
            draggable: false,
          });
          if (column.parentId) {
            flowEdges.push({
              id: `edge-${column.parentId}-${id}`,
              source: column.parentId,
              target: id,
              animated: true,
              style: { stroke: "var(--border-strong)" },
            });
          }
        }
        return;
      }

      column.nodes.forEach((node, index) => {
        flowNodes.push({
          id: node.id,
          type: "card",
          position: { x: columnIndex * COLUMN_WIDTH, y: top + index * (CARD_HEIGHT + ROW_GAP) },
          data: {
            label: node.label,
            summary: node.summary,
            selected: node.id === selectedId,
            onPath: pathIds.includes(node.id),
            expanded: node.expanded,
            hasChildren: node.hasChildren,
            onSelect,
          } satisfies CardData,
          draggable: false,
        });
        if (column.parentId) {
          flowEdges.push({
            id: `edge-${column.parentId}-${node.id}`,
            source: column.parentId,
            target: node.id,
            style: {
              stroke: pathIds.includes(node.id) ? "var(--accent)" : "var(--border-strong)",
            },
          });
        }
      });
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [columns, selectedId, pathIds, onSelect]);

  // Keep the active path in view as it grows; pan/zoom stays available but isn't load-bearing.
  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.18, duration: 320, maxZoom: 1 });
    }, 40);
    return () => clearTimeout(timer);
  }, [fitView, nodes.length, selectedId]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      onNodeClick={(_, node) => {
        if (node.type === "card") onSelect(node.id);
      }}
      proOptions={{ hideAttribution: true }}
      minZoom={0.2}
      maxZoom={1.6}
      fitView
    >
      <Background color="#222835" gap={22} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

export default function MapCanvas(props: {
  columns: CanvasColumn[];
  selectedId: string | null;
  pathIds: string[];
  onSelect: (id: string) => void;
}) {
  return (
    <ReactFlowProvider>
      <Flow {...props} />
    </ReactFlowProvider>
  );
}
