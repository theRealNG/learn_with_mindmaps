import fs from "node:fs/promises";
import path from "node:path";
import { createMap, updateMapSourceMeta, type MapRow } from "./db";
import { documentsDir, normalizeGitUrl } from "./paths";
import { fetchAndExtract } from "./sources/extract";
import { pdfToText } from "./sources/pdf";

export class IngestError extends Error {}

const GIT_URL = /^(https?:\/\/|git@|ssh:\/\/|git:\/\/)/i;

export function looksLikeGitUrl(value: string): boolean {
  return GIT_URL.test(value.trim());
}

/** Creates a Codebase Map from either a local path or a git URL (cloned lazily on first use). */
export async function createCodebaseMap(input: {
  ref: string;
  title?: string;
}): Promise<MapRow> {
  const ref = input.ref.trim();
  if (!ref) throw new IngestError("A local path or git URL is required.");

  if (looksLikeGitUrl(ref)) {
    const name = normalizeGitUrl(ref).split("/").pop() || ref;
    return createMap({
      title: input.title?.trim() || name,
      sourceType: "codebase",
      sourceRef: ref,
      sourceMeta: { origin: "git" },
    });
  }

  const resolved = path.resolve(ref);
  let stat;
  try {
    stat = await fs.stat(resolved);
  } catch {
    throw new IngestError(`No such directory: ${resolved}`);
  }
  if (!stat.isDirectory()) throw new IngestError(`Not a directory: ${resolved}`);

  return createMap({
    title: input.title?.trim() || path.basename(resolved),
    sourceType: "codebase",
    sourceRef: resolved,
    sourceMeta: { origin: "local" },
  });
}

/**
 * Normalizes a Document Source — pasted text, an uploaded .md/.txt/.pdf, or a fetched URL —
 * into one text file the section tools navigate.
 */
export async function createDocumentMap(input: {
  kind: "text" | "url" | "file";
  text?: string;
  url?: string;
  file?: { name: string; buffer: Buffer };
  title?: string;
}): Promise<MapRow> {
  let title = input.title?.trim() || "";
  let text = "";
  let origin = "";

  if (input.kind === "text") {
    text = (input.text || "").trim();
    if (!text) throw new IngestError("Paste some text to build a map from.");
    origin = "pasted text";
    title ||= firstHeading(text) || "Pasted document";
  } else if (input.kind === "url") {
    const url = (input.url || "").trim();
    if (!url) throw new IngestError("A URL is required.");
    const page = await fetchAndExtract(url);
    text = page.text;
    origin = url;
    title ||= page.title || url;
    if (!text.trim()) throw new IngestError(`No readable article text found at ${url}.`);
  } else {
    const file = input.file;
    if (!file) throw new IngestError("A file is required.");
    const extension = path.extname(file.name).toLowerCase();
    if (extension === ".pdf") {
      const parsed = await pdfToText(file.buffer);
      text = parsed.text;
      title ||= parsed.title || path.basename(file.name, extension);
    } else if ([".md", ".markdown", ".txt", ".rst", ""].includes(extension)) {
      text = file.buffer.toString("utf8");
      title ||= firstHeading(text) || path.basename(file.name, extension);
    } else {
      throw new IngestError(`Unsupported file type "${extension}". Use .md, .txt, or .pdf.`);
    }
    origin = `upload: ${file.name}`;
    if (!text.trim()) throw new IngestError(`No text could be extracted from ${file.name}.`);
  }

  const map = createMap({
    title,
    sourceType: "document",
    sourceRef: origin,
    sourceMeta: { origin },
  });
  const fileName = `${map.id}.md`;
  await fs.writeFile(path.join(documentsDir(), fileName), text, "utf8");
  updateMapSourceMeta(map.id, { origin, file: fileName, characters: text.length });
  return { ...map, source_meta: JSON.stringify({ origin, file: fileName, characters: text.length }) };
}

export function createTopicMap(input: {
  topic: string;
  seedNotes?: string;
  referenceLinks?: string[];
  title?: string;
}): MapRow {
  const topic = input.topic.trim();
  if (!topic) throw new IngestError("A topic is required.");
  return createMap({
    title: input.title?.trim() || topic,
    sourceType: "topic",
    sourceRef: topic,
    sourceMeta: {
      seedNotes: input.seedNotes?.trim() || null,
      referenceLinks: (input.referenceLinks || []).map((link) => link.trim()).filter(Boolean),
    },
  });
}

function firstHeading(text: string): string {
  const match = /^#{1,2}\s+(.+)$/m.exec(text);
  if (match) return match[1].trim();
  const line = text.split("\n").find((candidate) => candidate.trim());
  return line ? line.trim().slice(0, 80) : "";
}
