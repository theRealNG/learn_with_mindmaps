import { notFound } from "next/navigation";
import { getMap, listNodes } from "@/lib/db";
import { toMapDto, toNodeDto } from "@/lib/serialize";
import MapWorkspace from "@/components/MapWorkspace";

export const dynamic = "force-dynamic";

export default async function MapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const map = getMap(id);
  if (!map) notFound();

  return (
    <MapWorkspace
      initialMap={toMapDto(map)}
      initialNodes={listNodes(id).map(toNodeDto)}
    />
  );
}
