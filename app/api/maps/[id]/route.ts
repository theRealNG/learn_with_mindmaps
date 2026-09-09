import { NextResponse } from "next/server";
import { deleteMap, getMap, listNodes } from "@/lib/db";
import { toMapDto, toNodeDto } from "@/lib/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const map = getMap(id);
  if (!map) return NextResponse.json({ error: "Map not found." }, { status: 404 });
  return NextResponse.json({
    map: toMapDto(map),
    nodes: listNodes(id).map(toNodeDto),
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!getMap(id)) return NextResponse.json({ error: "Map not found." }, { status: 404 });
  deleteMap(id);
  return NextResponse.json({ ok: true });
}
