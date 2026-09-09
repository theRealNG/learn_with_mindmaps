import Anthropic from "@anthropic-ai/sdk";
import { lookupPricing } from "./pricing";
import type {
  AssistantBlock,
  CompletionRequest,
  CompletionResponse,
  LlmProvider,
} from "./types";

export class AnthropicProvider implements LlmProvider {
  readonly id = "anthropic";
  readonly model: string;
  private client: Anthropic;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  pricing() {
    return lookupPricing(this.model);
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const messages: Anthropic.MessageParam[] = request.messages.map((message) => {
      if (message.role === "user") {
        return { role: "user", content: message.content };
      }
      if (message.role === "tool_results") {
        return {
          role: "user",
          content: message.results.map((result) => ({
            type: "tool_result" as const,
            tool_use_id: result.toolUseId,
            content: result.content,
            is_error: result.isError,
          })),
        };
      }
      return {
        role: "assistant",
        content: message.content.map((block) =>
          block.type === "text"
            ? { type: "text" as const, text: block.text }
            : {
                type: "tool_use" as const,
                id: block.id,
                name: block.name,
                input: block.input,
              },
        ),
      };
    });

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: request.maxOutputTokens ?? 4096,
      system: request.system,
      messages,
      tools: request.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters as Anthropic.Tool.InputSchema,
      })),
    });

    const content: AssistantBlock[] = [];
    for (const block of response.content) {
      if (block.type === "text") {
        content.push({ type: "text", text: block.text });
      } else if (block.type === "tool_use") {
        content.push({
          type: "tool_use",
          id: block.id,
          name: block.name,
          input: (block.input ?? {}) as Record<string, unknown>,
        });
      }
    }

    return {
      content,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}
