import type { MapRow, NodeRow } from "./db";
import { parseSourceMeta } from "./db";
import type { MapDto, NodeDto } from "./types";

export type { MapDto, NodeDto } from "./types";

export function toMapDto(map: MapRow): MapDto {
  return {
    id: map.id,
    title: map.title,
    sourceType: map.source_type,
    sourceRef: map.source_ref,
    sourceMeta: parseSourceMeta(map),
    usage: {
      inputTokens: map.input_tokens,
      outputTokens: map.output_tokens,
      // Null once any generation ran on a model with no known pricing — raw tokens only.
      costUsd: map.cost_known === 1 ? map.cost_usd : null,
      generations: map.generation_count,
    },
    createdAt: map.created_at,
    updatedAt: map.updated_at,
  };
}

export function toNodeDto(node: NodeRow): NodeDto {
  return {
    id: node.id,
    parentId: node.parent_id,
    label: node.label,
    summary: node.summary,
    hasChildren: node.has_children === 1,
    expanded: node.expanded === 1,
    orderIndex: node.order_index,
  };
}
