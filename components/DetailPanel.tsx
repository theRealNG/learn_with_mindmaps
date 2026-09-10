"use client";

import type { NodeDto } from "@/lib/types";

export default function DetailPanel({
  node,
  childNodes,
  expanding,
  notice,
  onExpand,
  onSelect,
}: {
  node: NodeDto | null;
  childNodes: NodeDto[];
  expanding: boolean;
  notice: string | null;
  onExpand: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
}) {
  if (!node) {
    return (
      <aside className="detail">
        <div className="detail-inner">
          <h2>Nothing selected</h2>
          <p className="summary">
            Pick a node on the canvas to read its full summary and expand it into the next level
            of detail.
          </p>
        </div>
      </aside>
    );
  }

  const isLeaf = node.expanded && !node.hasChildren;

  return (
    <aside className="detail">
      <div className="detail-inner">
        <h2>{node.label}</h2>
        <p className="summary">{node.summary}</p>

        {notice && <div className="notice warn">{notice}</div>}

        <div className="actions">
          <button
            className="primary"
            onClick={() => onExpand(node.id)}
            disabled={expanding}
          >
            {expanding && <span className="spinner" />}
            {expanding
              ? "Expanding…"
              : node.hasChildren
                ? "Regenerate children"
                : isLeaf
                  ? "Try expanding again"
                  : "Expand"}
          </button>
        </div>

        {isLeaf && !expanding && (
          <div className="notice">
            Marked as a leaf — the model found nothing further to break this down into.
          </div>
        )}

        {childNodes.length > 0 && (
          <>
            <div className="section-title" style={{ marginTop: 0 }}>
              Children
            </div>
            <div className="chips">
              {childNodes.map((child) => (
                <button key={child.id} className="chip" onClick={() => onSelect(child.id)}>
                  <span className="chip-label">{child.label}</span>
                  <span className="chip-snippet">{child.summary}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
