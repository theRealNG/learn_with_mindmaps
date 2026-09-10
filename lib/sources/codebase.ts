import fs from "node:fs/promises";
import path from "node:path";
import type { ExplorationTool, SourceAdapter } from "./types";
import { truncate } from "./types";

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  "target",
  "vendor",
  "__pycache__",
  ".venv",
  "venv",
  ".idea",
  ".vscode",
  "coverage",
]);

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg", ".pdf", ".zip", ".gz",
  ".tar", ".mp4", ".mp3", ".wav", ".woff", ".woff2", ".ttf", ".eot", ".so", ".dylib",
  ".dll", ".exe", ".class", ".jar", ".wasm", ".lock",
]);

const MAX_FILE_CHARS = 60_000;
const MAX_READ_LINES = 800;

export class CodebaseSource implements SourceAdapter {
  readonly kind = "codebase";

  constructor(
    private root: string,
    private displayRef: string,
  ) {}

  describe(): string {
    return `A codebase rooted at ${this.displayRef}. Paths in tools are relative to the repository root.`;
  }

  /** Keeps the model inside the repo: no traversal above the root. */
  private resolve(relative: string): string {
    const target = path.resolve(this.root, relative || ".");
    const rootWithSep = this.root.endsWith(path.sep) ? this.root : this.root + path.sep;
    if (target !== this.root && !target.startsWith(rootWithSep)) {
      throw new Error(`Path "${relative}" is outside the repository root.`);
    }
    return target;
  }

  async seed(): Promise<string> {
    const tree = await this.tree(this.root, "", 2);
    const readme = await this.findReadme();
    const parts = [`Repository file tree (depth 2):\n${tree || "(empty)"}`];
    if (readme) {
      parts.push(`README (${readme.name}), first 6000 characters:\n${truncate(readme.text, 6000)}`);
    }
    return parts.join("\n\n");
  }

  private async tree(dir: string, prefix: string, depth: number): Promise<string> {
    if (depth < 0) return "";
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return "";
    }
    const visible = entries
      .filter((entry) => !entry.name.startsWith(".") || entry.name === ".github")
      .filter((entry) => !SKIP_DIRS.has(entry.name))
      .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
      .slice(0, 60);

    const lines: string[] = [];
    for (const entry of visible) {
      if (entry.isDirectory()) {
        lines.push(`${prefix}${entry.name}/`);
        const nested = await this.tree(path.join(dir, entry.name), `${prefix}  `, depth - 1);
        if (nested) lines.push(nested);
      } else {
        lines.push(`${prefix}${entry.name}`);
      }
    }
    return lines.join("\n");
  }

  private async findReadme(): Promise<{ name: string; text: string } | null> {
    let entries;
    try {
      entries = await fs.readdir(this.root, { withFileTypes: true });
    } catch {
      return null;
    }
    const readme = entries.find(
      (entry) => entry.isFile() && /^readme(\.md|\.txt|\.rst)?$/i.test(entry.name),
    );
    if (!readme) return null;
    try {
      const text = await fs.readFile(path.join(this.root, readme.name), "utf8");
      return { name: readme.name, text };
    } catch {
      return null;
    }
  }

  tools(): ExplorationTool[] {
    return [
      {
        spec: {
          name: "list_directory",
          description:
            "List files and subdirectories at a path inside the repository. Use it to orient before reading files.",
          parameters: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: 'Directory path relative to the repository root. Use "." for the root.',
              },
            },
            required: ["path"],
          },
        },
        run: async (input) => this.listDirectory(String(input.path ?? ".")),
      },
      {
        spec: {
          name: "read_file",
          description:
            "Read a text file from the repository. Returns numbered lines. Use offset/limit for large files.",
          parameters: {
            type: "object",
            properties: {
              path: { type: "string", description: "File path relative to the repository root." },
              offset: { type: "integer", description: "1-based line to start from. Defaults to 1." },
              limit: { type: "integer", description: `Max lines to return (default ${MAX_READ_LINES}).` },
            },
            required: ["path"],
          },
        },
        run: async (input) =>
          this.readFile(
            String(input.path ?? ""),
            Number(input.offset ?? 1),
            Number(input.limit ?? MAX_READ_LINES),
          ),
      },
      {
        spec: {
          name: "search_code",
          description:
            "Search the repository for a regular expression and return matching file paths with line numbers.",
          parameters: {
            type: "object",
            properties: {
              pattern: { type: "string", description: "JavaScript regular expression." },
              path: { type: "string", description: "Optional subdirectory to limit the search to." },
              max_results: { type: "integer", description: "Max matches to return (default 40)." },
            },
            required: ["pattern"],
          },
        },
        run: async (input) =>
          this.search(
            String(input.pattern ?? ""),
            String(input.path ?? "."),
            Number(input.max_results ?? 40),
          ),
      },
    ];
  }

  private async listDirectory(relative: string): Promise<string> {
    const dir = this.resolve(relative);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const lines = await Promise.all(
      entries
        .filter((entry) => !SKIP_DIRS.has(entry.name))
        .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
        .slice(0, 200)
        .map(async (entry) => {
          if (entry.isDirectory()) return `${entry.name}/`;
          try {
            const stat = await fs.stat(path.join(dir, entry.name));
            return `${entry.name}  (${stat.size} bytes)`;
          } catch {
            return entry.name;
          }
        }),
    );
    return lines.length > 0 ? lines.join("\n") : "(empty directory)";
  }

  private async readFile(relative: string, offset: number, limit: number): Promise<string> {
    const file = this.resolve(relative);
    if (BINARY_EXTENSIONS.has(path.extname(file).toLowerCase())) {
      return `Cannot read "${relative}": looks like a binary or generated file.`;
    }
    const raw = await fs.readFile(file, "utf8");
    const lines = raw.split("\n");
    const start = Math.max(1, Number.isFinite(offset) ? offset : 1);
    const count = Math.min(Math.max(1, Number.isFinite(limit) ? limit : MAX_READ_LINES), MAX_READ_LINES);
    const slice = lines.slice(start - 1, start - 1 + count);
    const body = slice.map((line, index) => `${start + index}\t${line}`).join("\n");
    const footer =
      start - 1 + slice.length < lines.length
        ? `\n\n[showing lines ${start}-${start + slice.length - 1} of ${lines.length}]`
        : "";
    return truncate(body, MAX_FILE_CHARS) + footer;
  }

  private async search(pattern: string, relative: string, maxResults: number): Promise<string> {
    let regex: RegExp;
    try {
      regex = new RegExp(pattern, "i");
    } catch (error) {
      return `Invalid regular expression: ${(error as Error).message}`;
    }
    const start = this.resolve(relative);
    const limit = Math.min(Math.max(1, maxResults), 200);
    const matches: string[] = [];

    const walk = async (dir: string): Promise<void> => {
      if (matches.length >= limit) return;
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (matches.length >= limit) return;
        if (SKIP_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else if (entry.isFile()) {
          if (BINARY_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
          let content: string;
          try {
            const stat = await fs.stat(full);
            if (stat.size > 2_000_000) continue;
            content = await fs.readFile(full, "utf8");
          } catch {
            continue;
          }
          const rel = path.relative(this.root, full);
          content.split("\n").forEach((line, index) => {
            if (matches.length >= limit) return;
            if (regex.test(line)) {
              matches.push(`${rel}:${index + 1}: ${line.trim().slice(0, 200)}`);
            }
          });
        }
      }
    };

    await walk(start);
    return matches.length > 0 ? matches.join("\n") : `No matches for /${pattern}/.`;
  }
}
