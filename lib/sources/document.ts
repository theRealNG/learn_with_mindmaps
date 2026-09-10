import fs from "node:fs/promises";
import type { ExplorationTool, SourceAdapter } from "./types";
import { truncate } from "./types";

export interface Section {
  id: number;
  heading: string;
  level: number;
  text: string;
}

const MAX_SECTION_CHARS = 12_000;
const CHUNK_TARGET = 2_500;

/**
 * Splits a normalized document into navigable sections: markdown headings when the
 * document has them, otherwise fixed-size paragraph chunks.
 */
export function splitSections(text: string): Section[] {
  const lines = text.split("\n");
  const hasHeadings = lines.some((line) => /^#{1,6}\s+\S/.test(line));

  if (hasHeadings) {
    const sections: Section[] = [];
    let current: Section = { id: 1, heading: "(preamble)", level: 0, text: "" };
    for (const line of lines) {
      const match = /^(#{1,6})\s+(.*)$/.exec(line);
      if (match) {
        if (current.text.trim() || current.heading !== "(preamble)") {
          sections.push({ ...current, text: current.text.trim() });
        }
        current = {
          id: sections.length + 1,
          heading: match[2].trim(),
          level: match[1].length,
          text: "",
        };
      } else {
        current.text += `${line}\n`;
      }
    }
    if (current.text.trim() || current.heading !== "(preamble)") {
      sections.push({ ...current, text: current.text.trim() });
    }
    if (sections.length > 0) {
      return sections.map((section, index) => ({ ...section, id: index + 1 }));
    }
  }

  const paragraphs = text.split(/\n\s*\n/);
  const sections: Section[] = [];
  let buffer = "";
  for (const paragraph of paragraphs) {
    if (buffer.length + paragraph.length > CHUNK_TARGET && buffer.trim()) {
      sections.push({
        id: sections.length + 1,
        heading: `Part ${sections.length + 1}`,
        level: 1,
        text: buffer.trim(),
      });
      buffer = "";
    }
    buffer += `${paragraph}\n\n`;
  }
  if (buffer.trim()) {
    sections.push({
      id: sections.length + 1,
      heading: `Part ${sections.length + 1}`,
      level: 1,
      text: buffer.trim(),
    });
  }
  return sections;
}

export class DocumentSource implements SourceAdapter {
  readonly kind = "document";
  private sections: Section[] = [];

  private constructor(
    private title: string,
    private origin: string,
    private text: string,
  ) {
    this.sections = splitSections(text);
  }

  static async fromFile(filePath: string, title: string, origin: string): Promise<DocumentSource> {
    const text = await fs.readFile(filePath, "utf8");
    return new DocumentSource(title, origin, text);
  }

  static fromText(text: string, title: string, origin: string): DocumentSource {
    return new DocumentSource(title, origin, text);
  }

  describe(): string {
    return `A document titled "${this.title}" (${this.origin}), split into ${this.sections.length} navigable sections.`;
  }

  async seed(): Promise<string> {
    return `Document outline (${this.sections.length} sections):\n${this.outline()}`;
  }

  private outline(): string {
    return this.sections
      .map(
        (section) =>
          `${"  ".repeat(Math.max(0, section.level - 1))}[${section.id}] ${section.heading} (${section.text.length} chars)`,
      )
      .join("\n");
  }

  tools(): ExplorationTool[] {
    return [
      {
        spec: {
          name: "list_sections",
          description: "List the document's sections with their ids, headings, and lengths.",
          parameters: { type: "object", properties: {} },
        },
        run: async () => this.outline(),
      },
      {
        spec: {
          name: "read_section",
          description: "Read the full text of one section by its id.",
          parameters: {
            type: "object",
            properties: {
              section_id: { type: "integer", description: "Section id from list_sections." },
            },
            required: ["section_id"],
          },
        },
        run: async (input) => this.readSection(Number(input.section_id)),
      },
      {
        spec: {
          name: "search_document",
          description:
            "Search the document text for a phrase or regular expression; returns matching sections with snippets.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Phrase or regular expression to look for." },
              max_results: { type: "integer", description: "Max snippets to return (default 20)." },
            },
            required: ["query"],
          },
        },
        run: async (input) =>
          this.search(String(input.query ?? ""), Number(input.max_results ?? 20)),
      },
    ];
  }

  private readSection(id: number): string {
    const section = this.sections.find((candidate) => candidate.id === id);
    if (!section) {
      return `No section with id ${id}. Valid ids: 1-${this.sections.length}.`;
    }
    return `## ${section.heading}\n\n${truncate(section.text, MAX_SECTION_CHARS)}`;
  }

  private search(query: string, maxResults: number): string {
    let regex: RegExp;
    try {
      regex = new RegExp(query, "gi");
    } catch {
      regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    }
    const limit = Math.min(Math.max(1, maxResults), 100);
    const hits: string[] = [];
    for (const section of this.sections) {
      const haystack = `${section.heading}\n${section.text}`;
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(haystack)) !== null && hits.length < limit) {
        const start = Math.max(0, match.index - 120);
        const snippet = haystack.slice(start, match.index + match[0].length + 120).replace(/\s+/g, " ");
        hits.push(`[${section.id}] ${section.heading}: …${snippet}…`);
        if (match[0].length === 0) break;
      }
      if (hits.length >= limit) break;
    }
    return hits.length > 0 ? hits.join("\n") : `No matches for "${query}".`;
  }
}
