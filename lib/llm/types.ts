/**
 * A small provider-agnostic message/tool protocol. Adapters translate to and from
 * a vendor SDK so the generation loop never mentions a specific provider.
 */

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema for the tool's arguments. */
  parameters: Record<string, unknown>;
}

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type AssistantBlock = TextBlock | ToolUseBlock;

export interface ToolResultBlock {
  type: "tool_result";
  toolUseId: string;
  content: string;
  isError?: boolean;
}

export type LlmMessage =
  | { role: "user"; content: string }
  | { role: "tool_results"; results: ToolResultBlock[] }
  | { role: "assistant"; content: AssistantBlock[] };

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface CompletionRequest {
  system: string;
  messages: LlmMessage[];
  tools: ToolSpec[];
  maxOutputTokens?: number;
}

export interface CompletionResponse {
  content: AssistantBlock[];
  usage: Usage;
}

export interface LlmProvider {
  /** Provider id, e.g. "anthropic". */
  readonly id: string;
  readonly model: string;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  /** USD per million tokens, or null when this model's pricing isn't known. */
  pricing(): { input: number; output: number } | null;
}

export function costOf(
  provider: LlmProvider,
  usage: Usage,
): number | null {
  const price = provider.pricing();
  if (!price) return null;
  return (
    (usage.inputTokens / 1_000_000) * price.input +
    (usage.outputTokens / 1_000_000) * price.output
  );
}

export function textOf(content: AssistantBlock[]): string {
  return content
    .filter((block): block is TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

export function toolUsesOf(content: AssistantBlock[]): ToolUseBlock[] {
  return content.filter((block): block is ToolUseBlock => block.type === "tool_use");
}
