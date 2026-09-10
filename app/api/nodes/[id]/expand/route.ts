import { NextResponse } from "next/server";
import {
  getAncestors,
  getChildren,
  getMap,
  getNode,
  markLeaf,
  recordUsage,
  replaceChildren,
} from "@/lib/db";
import { expandNode } from "@/lib/generate";
import { getProvider, MissingProviderConfig } from "@/lib/llm";
import { toMapDto, toNodeDto } from "@/lib/serialize";
import { adapterForMap } from "@/lib/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Expands one Node: local-neighborhood Map context plus fresh exploration of the Source. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const node = getNode(id);
  if (!node) return NextResponse.json({ error: "Node not found." }, { status: 404 });
  const map = getMap(node.map_id);
  if (!map) return NextResponse.json({ error: "Map not found." }, { status: 404 });

  try {
    const provider = getProvider();
    const source = await adapterForMap(map);
    const ancestors = getAncestors(node);
    const siblings = getChildren(map.id, node.parent_id).filter(
      (candidate) => candidate.id !== node.id,
    );

    const result = await expandNode(provider, source, node, ancestors, siblings);
    recordUsage(map.id, { ...result.usage, costUsd: result.costUsd });

    if (result.nodes.length > 0) {
      replaceChildren(map.id, node.id, result.nodes);
    } else if (!result.hitTurnCap) {
      // The model looked and found nothing further: this branch bottoms out here.
      markLeaf(node.id);
    }

    return NextResponse.json({
      node: toNodeDto(getNode(node.id)!),
      children: getChildren(map.id, node.id).map(toNodeDto),
      map: toMapDto(getMap(map.id)!),
      hitTurnCap: result.hitTurnCap,
      leafReason: result.leafReason,
      turnsUsed: result.turnsUsed,
    });
  } catch (error) {
    const status = error instanceof MissingProviderConfig ? 400 : 500;
    return NextResponse.json({ error: (error as Error).message }, { status });
  }
}
