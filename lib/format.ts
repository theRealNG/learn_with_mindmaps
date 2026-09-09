export function formatUsage(usage: {
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  generations: number;
}): string {
  const tokens = usage.inputTokens + usage.outputTokens;
  if (tokens === 0) return "not generated yet";
  // Dollar cost only when the active provider exposes pricing; otherwise raw tokens.
  const cost = usage.costUsd !== null ? ` · ${formatCost(usage.costUsd)}` : "";
  return `${formatTokens(tokens)} tokens${cost}`;
}

export function formatTokens(count: number): string {
  if (count < 1000) return String(count);
  if (count < 1_000_000) return `${(count / 1000).toFixed(count < 10_000 ? 1 : 0)}k`;
  return `${(count / 1_000_000).toFixed(2)}M`;
}

export function formatCost(usd: number): string {
  if (usd < 0.01) return `<$0.01`;
  return `$${usd.toFixed(2)}`;
}
