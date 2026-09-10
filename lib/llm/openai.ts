import OpenAI from "openai";
import { lookupPricing } from "./pricing";
import type {
  AssistantBlock,
  CompletionRequest,
  CompletionResponse,
  LlmProvider,
} from "./types";

export class OpenAiProvider implements LlmProvider {
  readonly id = "openai";
  readonly model: string;
  private client: OpenAI;

  constructor(apiKey: string, model: string, baseURL?: string) {
    // baseURL lets any OpenAI-compatible endpoint be used (Ollama, LM Studio, a proxy).
    this.client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
    this.model = model;
  }

  pricing() {
    return lookupPricing(this.model);
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: request.system },
    ];

    for (const message of request.messages) {
      if (message.role === "user") {
        messages.push({ role: "user", content: message.content });
      } else if (message.role === "tool_results") {
        // Chat Completions wants one `tool` message per tool call.
        for (const result of message.results) {
          messages.push({
            role: "tool",
            tool_call_id: result.toolUseId,
            content: result.content,
          });
        }
      } else {
        const text = message.content
          .filter((block) => block.type === "text")
          .map((block) => (block as { text: string }).text)
          .join("\n");
        const toolCalls = message.content
          .filter((block) => block.type === "tool_use")
          .map((block) => {
            const call = block as { id: string; name: string; input: unknown };
            return {
              id: call.id,
              type: "function" as const,
              function: { name: call.name, arguments: JSON.stringify(call.input) },
            };
          });
        messages.push({
          role: "assistant",
          content: text || null,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        });
      }
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_completion_tokens: request.maxOutputTokens ?? 4096,
      messages,
      tools: request.tools.map((tool) => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      })),
    });

    const choice = response.choices[0]?.message;
    const content: AssistantBlock[] = [];
    if (choice?.content) {
      content.push({ type: "text", text: choice.content });
    }
    for (const call of choice?.tool_calls ?? []) {
      if (call.type !== "function") continue;
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
      } catch {
        input = {};
      }
      content.push({ type: "tool_use", id: call.id, name: call.function.name, input });
    }

    return {
      content,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
    };
  }
}
