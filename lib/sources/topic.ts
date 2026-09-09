import { fetchAndExtract } from "./extract";
import type { ExplorationTool, SourceAdapter } from "./types";
import { truncate } from "./types";
import { NoSearchBackend, webSearch } from "./websearch";

const MAX_PAGE_CHARS = 20_000;

/**
 * An open-ended Topic. Same exploration-tools pattern as the other Sources, with web
 * search standing in for file/section reads — a Topic has no supplied text to check against.
 */
export class TopicSource implements SourceAdapter {
  readonly kind = "topic";

  constructor(
    private topic: string,
    private seedNotes: string | null,
    private referenceLinks: string[] = [],
  ) {}

  describe(): string {
    const parts = [`An open-ended topic: "${this.topic}".`];
    if (this.seedNotes) parts.push(`Scoping notes from the user: ${this.seedNotes}`);
    if (this.referenceLinks.length > 0) {
      parts.push(`Reference links supplied by the user: ${this.referenceLinks.join(", ")}`);
    }
    return parts.join(" ");
  }

  async seed(): Promise<string> {
    const parts = [`Topic: ${this.topic}`];
    if (this.seedNotes) parts.push(`Scoping notes: ${this.seedNotes}`);
    if (this.referenceLinks.length > 0) {
      parts.push(
        `Reference links to start from (use fetch_page on these):\n${this.referenceLinks.map((link) => `- ${link}`).join("\n")}`,
      );
    }
    parts.push(
      "There is no supplied document for this Source. Ground what you write in web search results rather than recall alone.",
    );
    return parts.join("\n\n");
  }

  tools(): ExplorationTool[] {
    return [
      {
        spec: {
          name: "web_search",
          description:
            "Search the web and return titles, URLs, and snippets. Use it to ground claims and catch stale information.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query." },
              max_results: { type: "integer", description: "Max results (default 6)." },
            },
            required: ["query"],
          },
        },
        run: async (input) => {
          try {
            const results = await webSearch(
              String(input.query ?? ""),
              Number(input.max_results ?? 6),
            );
            if (results.length === 0) return "No results.";
            return results
              .map((result) => `${result.title}\n${result.url}\n${result.snippet}`)
              .join("\n\n");
          } catch (error) {
            if (error instanceof NoSearchBackend) {
              return `Web search is unavailable: ${error.message} Continue from your own knowledge, and keep claims general rather than citing specifics you cannot verify.`;
            }
            return `Web search failed: ${(error as Error).message}`;
          }
        },
      },
      {
        spec: {
          name: "fetch_page",
          description: "Fetch a URL and return its main article text.",
          parameters: {
            type: "object",
            properties: { url: { type: "string", description: "Absolute URL to fetch." } },
            required: ["url"],
          },
        },
        run: async (input) => {
          const url = String(input.url ?? "");
          try {
            const page = await fetchAndExtract(url);
            return `# ${page.title}\n\n${truncate(page.text, MAX_PAGE_CHARS)}`;
          } catch (error) {
            return `Could not fetch ${url}: ${(error as Error).message}`;
          }
        },
      },
    ];
  }
}
