import path from "node:path";
import { parseSourceMeta, type MapRow } from "../db";
import { ensureClone } from "../git";
import { documentsDir } from "../paths";
import { CodebaseSource } from "./codebase";
import { DocumentSource } from "./document";
import { TopicSource } from "./topic";
import type { SourceAdapter } from "./types";

export * from "./types";
export { CodebaseSource } from "./codebase";
export { DocumentSource } from "./document";
export { TopicSource } from "./topic";

/** Builds the exploration adapter for a Map's Source, cloning a git URL on first use. */
export async function adapterForMap(map: MapRow): Promise<SourceAdapter> {
  const meta = parseSourceMeta(map);

  if (map.source_type === "codebase") {
    if (meta.origin === "git") {
      const clonePath = await ensureClone(map.source_ref);
      return new CodebaseSource(clonePath, map.source_ref);
    }
    return new CodebaseSource(path.resolve(map.source_ref), map.source_ref);
  }

  if (map.source_type === "document") {
    const file = path.join(documentsDir(), String(meta.file ?? `${map.id}.md`));
    return DocumentSource.fromFile(file, map.title, String(meta.origin ?? "document"));
  }

  return new TopicSource(
    map.source_ref,
    (meta.seedNotes as string) || null,
    Array.isArray(meta.referenceLinks) ? (meta.referenceLinks as string[]) : [],
  );
}
