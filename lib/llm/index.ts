import { AnthropicProvider } from "./anthropic";
import { OpenAiProvider } from "./openai";
import type { LlmProvider } from "./types";

export * from "./types";

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-sonnet-5",
  openai: "gpt-5",
};

export class MissingProviderConfig extends Error {}

/** Builds the configured provider from env. Swapping vendors is a config change, not a code change. */
export function getProvider(): LlmProvider {
  const id = (process.env.LLM_PROVIDER || "anthropic").toLowerCase();
  const model = process.env.LLM_MODEL || DEFAULT_MODELS[id];

  if (id === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new MissingProviderConfig(
        "ANTHROPIC_API_KEY is not set. Add it to .env (see .env.example).",
      );
    }
    return new AnthropicProvider(key, model);
  }

  if (id === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key && !process.env.OPENAI_BASE_URL) {
      throw new MissingProviderConfig(
        "OPENAI_API_KEY is not set. Add it to .env (see .env.example).",
      );
    }
    return new OpenAiProvider(key || "not-needed", model, process.env.OPENAI_BASE_URL);
  }

  throw new MissingProviderConfig(
    `Unknown LLM_PROVIDER "${id}". Supported values: anthropic, openai.`,
  );
}
