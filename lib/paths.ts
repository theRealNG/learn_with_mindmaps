import fs from "node:fs";
import path from "node:path";

/** Root for everything the app persists: SQLite file, document store, repo clones. */
export function dataDir(): string {
  const dir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function dbPath(): string {
  return path.join(dataDir(), "mindmaps.db");
}

/** Normalized documents (pasted text, uploads, fetched articles) live here as one file per Map. */
export function documentsDir(): string {
  const dir = path.join(dataDir(), "documents");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Git clones are cached here, keyed by normalized URL, and reused across sessions
 * and across any Map pointing at the same repo.
 */
export function reposDir(): string {
  const dir = path.join(dataDir(), "repos");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Strips scheme/credentials/.git so the same repo maps to one cache slot. */
export function normalizeGitUrl(url: string): string {
  return url
    .trim()
    .replace(/^git\+/, "")
    .replace(/\.git$/, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

export function repoCacheKey(url: string): string {
  const normalized = normalizeGitUrl(url);
  const slug = normalized
    .replace(/^[a-z+]+:\/\//, "")
    .replace(/^[^@]+@/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) | 0;
  }
  return `${slug}-${(hash >>> 0).toString(16)}`;
}

export function repoCachePath(url: string): string {
  return path.join(reposDir(), repoCacheKey(url));
}
