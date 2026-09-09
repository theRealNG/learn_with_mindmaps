import { NextResponse } from "next/server";
import { getChildren, getMap, recordUsage, replaceChildren } from "@/lib/db";
import { generateRootNodes } from "@/lib/generate";
import { getProvider, MissingProviderConfig } from "@/lib/llm";
import { toMapDto, toNodeDto } from "@/lib/serialize";
import { adapterForMap } from "@/lib/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Generates (or regenerates) a Map's Root Nodes — the zero-th case of expansion. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const map = getMap(id);
  if (!map) return NextResponse.json({ error: "Map not found." }, { status: 404 });

  try {
    const provider = getProvider();
    const source = await adapterForMap(map);
    const result = await generateRootNodes(provider, source);

    recordUsage(id, { ...result.usage, costUsd: result.costUsd });
    if (result.nodes.length > 0) {
      replaceChildren(id, null, result.nodes);
    }

    return NextResponse.json({
      nodes: getChildren(id, null).map(toNodeDto),
      map: toMapDto(getMap(id)!),
      hitTurnCap: result.hitTurnCap,
      leafReason: result.leafReason,
      turnsUsed: result.turnsUsed,
    });
  } catch (error) {
    const status = error instanceof MissingProviderConfig ? 400 : 500;
    return NextResponse.json({ error: (error as Error).message }, { status });
  }
}
