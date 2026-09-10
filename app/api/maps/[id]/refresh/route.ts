import { NextResponse } from "next/server";
import { getMap, parseSourceMeta, updateMapSourceMeta } from "@/lib/db";
import { refreshClone } from "@/lib/git";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Explicit re-pull of a cached git clone — never automatic, so Nodes don't shift mid-exploration. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const map = getMap(id);
  if (!map) return NextResponse.json({ error: "Map not found." }, { status: 404 });

  const meta = parseSourceMeta(map);
  if (map.source_type !== "codebase" || meta.origin !== "git") {
    return NextResponse.json(
      { error: "Only git-backed codebase maps can be refreshed." },
      { status: 400 },
    );
  }

  try {
    const { head } = await refreshClone(map.source_ref);
    updateMapSourceMeta(id, { ...meta, head, refreshedAt: new Date().toISOString() });
    return NextResponse.json({ ok: true, head });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
