import { costOf, textOf, toolUsesOf } from "./llm";
import type {
  AssistantBlock,
  LlmMessage,
  LlmProvider,
  ToolResultBlock,
  ToolSpec,
  Usage,
} from "./llm";
import type { NodeRow } from "./db";
import type { ExplorationTool, SourceAdapter } from "./sources";

export interface GeneratedNode {
  label: string;
  summary: string;
}

export interface GenerationResult {
  nodes: GeneratedNode[];
  usage: Usage;
  costUsd: number | null;
  turnsUsed: number;
  /** True when the runaway guard cut the generation short. */
  hitTurnCap: boolean;
  /** Set when the model declared this Node a Leaf rather than producing children. */
  leafReason: string | null;
}

const SUBMIT_TOOL: ToolSpec = {
  name: "submit_nodes",
  description:
    "Submit the finished nodes. Call this exactly once, after you have explored enough to write grounded summaries. Submit an empty list with leaf_reason if the concept genuinely cannot be broken down further.",
  parameters: {
    type: "object",
    properties: {
      nodes: {
        type: "array",
        description: "The nodes, in the order they should be read.",
        items: {
          type: "object",
          properties: {
            label: {
              type: "string",
              description: "Short concept name, 2-6 words. No trailing punctuation.",
            },
            summary: {
              type: "string",
              description:
                "2-4 sentences explaining this concept in plain language, grounded in what you found in the source.",
            },
          },
          required: ["label", "summary"],
        },
      },
      leaf_reason: {
        type: "string",
        description: "If nodes is empty, why this concept is a leaf.",
      },
    },
    required: ["nodes"],
  },
};

function maxTurns(): number {
  const configured = Number(process.env.MAX_TOOL_TURNS);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 10;
}

const SYSTEM_PROMPT = `You build mind maps that let someone learn a subject by drilling down, instead of reading a wall of text.

You work in one tool-use turn at a time:
1. Explore the source with the tools you have been given. Actually look — do not write from assumption.
2. When you know enough, call submit_nodes exactly once with the nodes you have written.

Rules for the nodes you produce:
- Produce 4 to 7 nodes. Fewer only if the material genuinely holds no more; never pad.
- A label is a short concept name (2-6 words), not a sentence or a file name.
- A summary is 2-4 sentences of plain language explaining the concept itself — what it is and why it matters — not a description of where you found it.
- Nodes at the same level must be distinct from each other, and each must be a genuine part of its parent, not a restatement of it.
- Ground every summary in what the source actually says. If the source contradicts what you expected, follow the source.
- Order nodes so that reading them top to bottom builds understanding.

You are writing one level only. Do not try to cover a node's own sub-details — those become its children when the user expands it.`;

async function runLoop(
  provider: LlmProvider,
  source: SourceAdapter,
  task: string,
): Promise<GenerationResult> {
  const explorationTools = source.tools();
  const toolIndex = new Map<string, ExplorationTool>(
    explorationTools.map((tool) => [tool.spec.name, tool]),
  );
  const seed = await source.seed();

  const messages: LlmMessage[] = [
    {
      role: "user",
      content: `${task}\n\nSource: ${source.describe()}\n\nStarting point:\n${seed}`,
    },
  ];

  const usage: Usage = { inputTokens: 0, outputTokens: 0 };
  const limit = maxTurns();
  let hitTurnCap = false;
  let turnsUsed = 0;

  for (let turn = 1; turn <= limit; turn++) {
    // On the final allowed turn, take the exploration tools away so the model must submit.
    const lastTurn = turn === limit;
    if (lastTurn) {
      hitTurnCap = true;
      messages.push({
        role: "user",
        content:
          "You have reached the exploration limit for this generation. Call submit_nodes now with the best nodes you can write from what you have already seen.",
      });
    }

    const response = await provider.complete({
      system: SYSTEM_PROMPT,
      messages,
      tools: lastTurn ? [SUBMIT_TOOL] : [...explorationTools.map((tool) => tool.spec), SUBMIT_TOOL],
    });
    turnsUsed = turn;
    usage.inputTokens += response.usage.inputTokens;
    usage.outputTokens += response.usage.outputTokens;

    const content: AssistantBlock[] = response.content;
    messages.push({ role: "assistant", content });

    const toolUses = toolUsesOf(content);
    const submission = toolUses.find((use) => use.name === SUBMIT_TOOL.name);
    if (submission) {
      const parsed = parseSubmission(submission.input);
      return {
        ...parsed,
        usage,
        costUsd: costOf(provider, usage),
        turnsUsed,
        hitTurnCap: hitTurnCap && parsed.nodes.length === 0 ? true : hitTurnCap,
      };
    }

    if (toolUses.length === 0) {
      messages.push({
        role: "user",
        content: `${textOf(content) ? "" : "You returned no tool call. "}Continue exploring with the tools, or call submit_nodes if you have seen enough.`,
      });
      continue;
    }

    const results: ToolResultBlock[] = [];
    for (const use of toolUses) {
      const tool = toolIndex.get(use.name);
      if (!tool) {
        results.push({
          type: "tool_result",
          toolUseId: use.id,
          content: `Unknown tool "${use.name}".`,
          isError: true,
        });
        continue;
      }
      try {
        results.push({ type: "tool_result", toolUseId: use.id, content: await tool.run(use.input) });
      } catch (error) {
        results.push({
          type: "tool_result",
          toolUseId: use.id,
          content: `Error: ${(error as Error).message}`,
          isError: true,
        });
      }
    }
    messages.push({ role: "tool_results", results });
  }

  // The cap stops the generation rather than looping; whatever was produced (nothing here) is returned.
  return {
    nodes: [],
    leafReason: null,
    usage,
    costUsd: costOf(provider, usage),
    turnsUsed,
    hitTurnCap: true,
  };
}

function parseSubmission(input: Record<string, unknown>): {
  nodes: GeneratedNode[];
  leafReason: string | null;
} {
  const raw = Array.isArray(input.nodes) ? input.nodes : [];
  const nodes: GeneratedNode[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as { label?: unknown; summary?: unknown };
    const label = String(candidate.label ?? "").trim();
    const summary = String(candidate.summary ?? "").trim();
    if (label) nodes.push({ label, summary });
  }
  const leafReason = typeof input.leaf_reason === "string" ? input.leaf_reason.trim() : "";
  return { nodes, leafReason: leafReason || null };
}

/** Root Node generation: the zero-th case of expansion — no ancestors or siblings yet. */
export function generateRootNodes(
  provider: LlmProvider,
  source: SourceAdapter,
): Promise<GenerationResult> {
  return runLoop(
    provider,
    source,
    "Generate the ROOT NODES for a new mind map of this source. These are the highest-level concepts: what this source is fundamentally about, what it is trying to achieve, and the main pillars someone needs in order to understand it. Explore the top-level structure first, then go deeper where you need to before writing.",
  );
}

/**
 * Expansion is Map-aware: the model is given the ancestor chain and the Node's immediate
 * siblings (label + summary each), and explores the Source fresh for this Node.
 */
export function expandNode(
  provider: LlmProvider,
  source: SourceAdapter,
  node: NodeRow,
  ancestors: NodeRow[],
  siblings: NodeRow[],
): Promise<GenerationResult> {
  const lines: string[] = [];

  if (ancestors.length > 0) {
    lines.push("Where this node sits in the map (root first):");
    ancestors.forEach((ancestor, depth) => {
      lines.push(`${"  ".repeat(depth)}- ${ancestor.label}: ${ancestor.summary}`);
    });
    lines.push(`${"  ".repeat(ancestors.length)}- ${node.label}  <-- expanding this one`);
  } else {
    lines.push(`This is a root node of the map: ${node.label}`);
  }

  lines.push("", `The node being expanded:\n${node.label}\n${node.summary}`);

  if (siblings.length > 0) {
    lines.push(
      "",
      "Its siblings at the same level — do not duplicate their material, the user can read them directly:",
      ...siblings.map((sibling) => `- ${sibling.label}: ${sibling.summary}`),
    );
  }

  lines.push(
    "",
    "Generate this node's CHILDREN: the next level of detail down. Each child must be a genuine sub-part of this node — narrower than it, and not a restatement of an ancestor or sibling. Explore the source for this specific node before writing; do not rely on the summaries above as your only material. If the concept truly bottoms out here, submit an empty list with leaf_reason.",
  );

  return runLoop(provider, source, lines.join("\n"));
}
