"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import MapCanvas, { type CanvasColumn } from "./MapCanvas";
import DetailPanel from "./DetailPanel";
import { formatCost, formatTokens } from "@/lib/format";
import type { MapDto, NodeDto } from "@/lib/types";

const SOURCE_LABEL: Record<string, string> = {
  codebase: "Codebase",
  document: "Document",
  topic: "Topic",
};

export default function MapWorkspace({
  initialMap,
  initialNodes,
}: {
  initialMap: MapDto;
  initialNodes: NodeDto[];
}) {
  const [map, setMap] = useState(initialMap);
  const [nodes, setNodes] = useState(initialNodes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"roots" | "expand" | "refresh" | null>(null);
  const [expandingId, setExpandingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const roots = useMemo(
    () => nodes.filter((node) => node.parentId === null).sort((a, b) => a.orderIndex - b.orderIndex),
    [nodes],
  );

  const childrenOf = useCallback(
    (parentId: string | null) =>
      nodes
        .filter((node) => node.parentId === parentId)
        .sort((a, b) => a.orderIndex - b.orderIndex),
    [nodes],
  );

  /** Root Node → selection. This chain is the only branch the canvas renders. */
  const path = useMemo(() => {
    const chain: NodeDto[] = [];
    let current = selectedId ? byId.get(selectedId) : undefined;
    while (current) {
      chain.unshift(current);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return chain;
  }, [selectedId, byId]);

  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;
  const selectedChildren = selectedId ? childrenOf(selectedId) : [];

  const columns = useMemo<CanvasColumn[]>(() => {
    const result: CanvasColumn[] = [];
    if (busy === "roots") {
      return [{ parentId: null, nodes: [], loading: true }];
    }
    result.push({ parentId: null, nodes: roots });
    for (const node of path) {
      const children = childrenOf(node.id);
      const loading = expandingId === node.id;
      if (loading) {
        result.push({ parentId: node.id, nodes: [], loading: true });
        break;
      }
      if (children.length === 0) break;
      result.push({ parentId: node.id, nodes: children });
    }
    return result;
  }, [roots, path, childrenOf, expandingId, busy]);

  const pathIds = useMemo(() => path.map((node) => node.id), [path]);

  async function post(url: string) {
    const response = await fetch(url, { method: "POST" });
    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) throw new Error((data.error as string) || "Request failed.");
    return data;
  }

  async function generateRoots() {
    setBusy("roots");
    setError(null);
    setNotice(null);
    setSelectedId(null);
    try {
      const data = await post(`/api/maps/${map.id}/generate-roots`);
      const generated = data.nodes as NodeDto[];
      // Regenerating roots replaces the whole tree.
      setNodes(generated);
      setMap(data.map as MapDto);
      if (data.hitTurnCap) {
        setNotice("Generation hit the tool-call cap and returned early — results may be thin.");
      }
      if (generated.length > 0) setSelectedId(generated[0].id);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function expand(nodeId: string) {
    setExpandingId(nodeId);
    setBusy("expand");
    setError(null);
    setNotice(null);
    setSelectedId(nodeId);
    try {
      const data = await post(`/api/nodes/${nodeId}/expand`);
      const updated = data.node as NodeDto;
      const children = data.children as NodeDto[];
      setNodes((current) => {
        // Drop the old subtree under this node, then splice in the fresh children.
        const removed = new Set<string>();
        const collect = (parentId: string) => {
          for (const node of current) {
            if (node.parentId === parentId && !removed.has(node.id)) {
              removed.add(node.id);
              collect(node.id);
            }
          }
        };
        collect(nodeId);
        return [
          ...current
            .filter((node) => !removed.has(node.id))
            .map((node) => (node.id === updated.id ? updated : node)),
          ...children,
        ];
      });
      setMap(data.map as MapDto);
      if (data.hitTurnCap) {
        setNotice("Expansion hit the tool-call cap and returned early — results may be thin.");
      } else if (children.length === 0 && data.leafReason) {
        setNotice(String(data.leafReason));
      }
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setExpandingId(null);
      setBusy(null);
    }
  }

  async function refresh() {
    setBusy("refresh");
    setError(null);
    try {
      const data = await post(`/api/maps/${map.id}/refresh`);
      setNotice(`Repository refreshed to ${data.head}. Existing nodes are unchanged.`);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const isGitCodebase = map.sourceType === "codebase" && map.sourceMeta.origin === "git";
  const totalTokens = map.usage.inputTokens + map.usage.outputTokens;

  return (
    <div className="workspace">
      <header className="topbar">
        <Link className="badge" href="/" style={{ textDecoration: "none" }}>
          ← Maps
        </Link>
        <span className="badge">{SOURCE_LABEL[map.sourceType]}</span>
        <div className="grow">
          <h1>{map.title}</h1>
          <div className="sub">{map.sourceRef}</div>
        </div>
        <div className="usage">
          <div>
            <strong>{formatTokens(totalTokens)}</strong> tokens
            {map.usage.costUsd !== null && <> · <strong>{formatCost(map.usage.costUsd)}</strong></>}
          </div>
          <div style={{ color: "var(--text-faint)" }}>
            {map.usage.generations} generation{map.usage.generations === 1 ? "" : "s"}
            {map.usage.costUsd === null && totalTokens > 0 && " · no pricing for this model"}
          </div>
        </div>
        {isGitCodebase && (
          <button className="ghost" onClick={refresh} disabled={busy !== null}>
            {busy === "refresh" ? "Refreshing…" : "Refresh repo"}
          </button>
        )}
        <button onClick={generateRoots} disabled={busy !== null}>
          {busy === "roots" ? "Generating…" : roots.length > 0 ? "Regenerate roots" : "Generate roots"}
        </button>
      </header>

      <div className="split">
        <div className="canvas-side">
          <nav className="breadcrumb">
            <button onClick={() => setSelectedId(null)} data-current={path.length === 0}>
              {map.title}
            </button>
            {path.map((node) => (
              <span key={node.id} style={{ display: "contents" }}>
                <span className="sep">›</span>
                <button
                  onClick={() => setSelectedId(node.id)}
                  data-current={node.id === selectedId}
                >
                  {node.label}
                </button>
              </span>
            ))}
          </nav>

          <div className="canvas">
            {error && (
              <div className="canvas-empty" style={{ justifyContent: "flex-start", paddingTop: 20 }}>
                <div className="notice warn" style={{ maxWidth: 460 }}>
                  {error}
                </div>
              </div>
            )}
            {roots.length === 0 && busy !== "roots" && !error && (
              <div className="canvas-empty">
                <div>This map has no root nodes yet.</div>
                <button className="primary" onClick={generateRoots} disabled={busy !== null}>
                  Generate root nodes
                </button>
              </div>
            )}
            <MapCanvas
              columns={columns}
              selectedId={selectedId}
              pathIds={pathIds}
              onSelect={setSelectedId}
            />
          </div>
        </div>

        <DetailPanel
          node={selected}
          childNodes={selectedChildren}
          expanding={expandingId === selectedId}
          notice={notice}
          onExpand={expand}
          onSelect={setSelectedId}
        />
      </div>
    </div>
  );
}
