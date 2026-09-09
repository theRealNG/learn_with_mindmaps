import type { ToolSpec } from "../llm/types";

/** One tool the model can call while exploring a Source. */
export interface ExplorationTool {
  spec: ToolSpec;
  run(input: Record<string, unknown>): Promise<string>;
}

/**
 * A Source the model explores on demand. Every Source kind exposes the same shape:
 * a seed describing top-level structure, plus tools for pulling in detail.
 */
export interface SourceAdapter {
  kind: "codebase" | "document" | "topic";
  /** Human-readable description of the Source, used in the system prompt. */
  describe(): string;
  /** Top-level structure (file tree, section outline, topic + seed notes) to seed exploration. */
  seed(): Promise<string>;
  tools(): ExplorationTool[];
}

export function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n\n[... truncated, ${text.length - limit} more characters ...]`;
}
