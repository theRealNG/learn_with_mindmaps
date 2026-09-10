/** Shapes the API returns and the client renders — no server-only imports, safe in client components. */

export type SourceType = "codebase" | "document" | "topic";

export interface MapUsage {
  inputTokens: number;
  outputTokens: number;
  /** Null when the active provider has no known pricing — show raw tokens instead. */
  costUsd: number | null;
  generations: number;
}

export interface MapDto {
  id: string;
  title: string;
  sourceType: SourceType;
  sourceRef: string;
  sourceMeta: Record<string, unknown>;
  usage: MapUsage;
  createdAt: string;
  updatedAt: string;
}

export interface NodeDto {
  id: string;
  parentId: string | null;
  label: string;
  summary: string;
  hasChildren: boolean;
  expanded: boolean;
  orderIndex: number;
}
