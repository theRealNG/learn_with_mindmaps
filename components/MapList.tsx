"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatUsage } from "@/lib/format";
import type { MapDto } from "@/lib/types";

const SOURCE_LABEL: Record<string, string> = {
  codebase: "Codebase",
  document: "Document",
  topic: "Topic",
};

export default function MapList({ maps }: { maps: MapDto[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  if (maps.length === 0) {
    return <div className="empty">No maps yet. Create one above.</div>;
  }

  async function remove(map: MapDto) {
    if (!confirm(`Delete "${map.title}" and all of its nodes?`)) return;
    setDeleting(map.id);
    await fetch(`/api/maps/${map.id}`, { method: "DELETE" });
    setDeleting(null);
    router.refresh();
  }

  return (
    <div className="map-list">
      {maps.map((map) => (
        <div key={map.id} className="map-card">
          <span className="badge">{SOURCE_LABEL[map.sourceType]}</span>
          <Link className="grow" href={`/maps/${map.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div className="title">{map.title}</div>
            <div className="sub">{map.sourceRef}</div>
          </Link>
          <span className="sub">{formatUsage(map.usage)}</span>
          <button
            className="ghost"
            onClick={() => remove(map)}
            disabled={deleting === map.id}
            aria-label={`Delete ${map.title}`}
          >
            {deleting === map.id ? "…" : "✕"}
          </button>
        </div>
      ))}
    </div>
  );
}
