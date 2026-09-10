import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { dbPath } from "./paths";

export type SourceType = "codebase" | "document" | "topic";

export interface MapRow {
  id: string;
  title: string;
  source_type: SourceType;
  /** Local path, git URL, or topic name — whatever identifies the Source. */
  source_ref: string;
  /** JSON blob for source-kind specifics: seed notes, document file, clone path. */
  source_meta: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  /** 0 once any generation ran on a provider with no known pricing. */
  cost_known: number;
  generation_count: number;
  created_at: string;
  updated_at: string;
}

export interface NodeRow {
  id: string;
  map_id: string;
  /** null marks a Root Node. */
  parent_id: string | null;
  label: string;
  summary: string;
  has_children: number;
  /** 1 once expansion has been attempted — expanded with no children is a Leaf. */
  expanded: number;
  order_index: number;
  created_at: string;
}

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  db = new Database(dbPath());
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS maps (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      source_type TEXT NOT NULL CHECK (source_type IN ('codebase','document','topic')),
      source_ref TEXT NOT NULL,
      source_meta TEXT,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0,
      cost_known INTEGER NOT NULL DEFAULT 1,
      generation_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      map_id TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
      parent_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      summary TEXT NOT NULL,
      has_children INTEGER NOT NULL DEFAULT 0,
      expanded INTEGER NOT NULL DEFAULT 0,
      order_index INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_nodes_map ON nodes (map_id);
    CREATE INDEX IF NOT EXISTS idx_nodes_parent ON nodes (map_id, parent_id, order_index);
  `);
  return db;
}

const now = () => new Date().toISOString();

export function createMap(input: {
  title: string;
  sourceType: SourceType;
  sourceRef: string;
  sourceMeta?: Record<string, unknown>;
}): MapRow {
  const id = randomUUID();
  const ts = now();
  getDb()
    .prepare(
      `INSERT INTO maps (id, title, source_type, source_ref, source_meta, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.title,
      input.sourceType,
      input.sourceRef,
      input.sourceMeta ? JSON.stringify(input.sourceMeta) : null,
      ts,
      ts,
    );
  return getMap(id)!;
}

export function listMaps(): MapRow[] {
  return getDb().prepare(`SELECT * FROM maps ORDER BY updated_at DESC`).all() as MapRow[];
}

export function getMap(id: string): MapRow | undefined {
  return getDb().prepare(`SELECT * FROM maps WHERE id = ?`).get(id) as MapRow | undefined;
}

export function deleteMap(id: string): void {
  getDb().prepare(`DELETE FROM maps WHERE id = ?`).run(id);
}

export function updateMapSourceMeta(id: string, meta: Record<string, unknown>): void {
  getDb()
    .prepare(`UPDATE maps SET source_meta = ?, updated_at = ? WHERE id = ?`)
    .run(JSON.stringify(meta), now(), id);
}

export function parseSourceMeta(map: MapRow): Record<string, unknown> {
  if (!map.source_meta) return {};
  try {
    return JSON.parse(map.source_meta) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function listNodes(mapId: string): NodeRow[] {
  return getDb()
    .prepare(`SELECT * FROM nodes WHERE map_id = ? ORDER BY order_index, created_at`)
    .all(mapId) as NodeRow[];
}

export function getNode(id: string): NodeRow | undefined {
  return getDb().prepare(`SELECT * FROM nodes WHERE id = ?`).get(id) as NodeRow | undefined;
}

export function getChildren(mapId: string, parentId: string | null): NodeRow[] {
  const sql = parentId
    ? `SELECT * FROM nodes WHERE map_id = ? AND parent_id = ? ORDER BY order_index`
    : `SELECT * FROM nodes WHERE map_id = ? AND parent_id IS NULL ORDER BY order_index`;
  const stmt = getDb().prepare(sql);
  return (parentId ? stmt.all(mapId, parentId) : stmt.all(mapId)) as NodeRow[];
}

/** The Root Node → node chain, root first, used as expansion context. */
export function getAncestors(node: NodeRow): NodeRow[] {
  const chain: NodeRow[] = [];
  let current = node.parent_id ? getNode(node.parent_id) : undefined;
  while (current) {
    chain.unshift(current);
    current = current.parent_id ? getNode(current.parent_id) : undefined;
  }
  return chain;
}

/** Replaces a parent's children — a re-expansion discards the previous attempt's subtree. */
export function replaceChildren(
  mapId: string,
  parentId: string | null,
  children: { label: string; summary: string }[],
): NodeRow[] {
  const database = getDb();
  const ts = now();
  const write = database.transaction(() => {
    if (parentId) {
      database.prepare(`DELETE FROM nodes WHERE map_id = ? AND parent_id = ?`).run(mapId, parentId);
    } else {
      database.prepare(`DELETE FROM nodes WHERE map_id = ? AND parent_id IS NULL`).run(mapId);
    }
    const insert = database.prepare(
      `INSERT INTO nodes (id, map_id, parent_id, label, summary, has_children, expanded, order_index, created_at)
       VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)`,
    );
    children.forEach((child, index) => {
      insert.run(randomUUID(), mapId, parentId, child.label, child.summary, index, ts);
    });
    if (parentId) {
      database
        .prepare(`UPDATE nodes SET expanded = 1, has_children = ? WHERE id = ?`)
        .run(children.length > 0 ? 1 : 0, parentId);
    }
    database.prepare(`UPDATE maps SET updated_at = ? WHERE id = ?`).run(ts, mapId);
  });
  write();
  return getChildren(mapId, parentId);
}

/** Marks a Node as a Leaf: expansion happened (or was declined) and produced nothing. */
export function markLeaf(nodeId: string): void {
  getDb().prepare(`UPDATE nodes SET expanded = 1, has_children = 0 WHERE id = ?`).run(nodeId);
}

export function recordUsage(
  mapId: string,
  usage: { inputTokens: number; outputTokens: number; costUsd: number | null },
): void {
  getDb()
    .prepare(
      `UPDATE maps
         SET input_tokens = input_tokens + ?,
             output_tokens = output_tokens + ?,
             cost_usd = cost_usd + ?,
             cost_known = CASE WHEN ? = 1 THEN cost_known ELSE 0 END,
             generation_count = generation_count + 1,
             updated_at = ?
       WHERE id = ?`,
    )
    .run(
      usage.inputTokens,
      usage.outputTokens,
      usage.costUsd ?? 0,
      usage.costUsd === null ? 0 : 1,
      now(),
      mapId,
    );
}
