import { listMaps } from "@/lib/db";
import { toMapDto } from "@/lib/serialize";
import NewMapForm from "@/components/NewMapForm";
import ConfigBanner from "@/components/ConfigBanner";
import MapList from "@/components/MapList";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const maps = listMaps().map(toMapDto);

  return (
    <main className="home">
      <h1>Learn with Mindmaps</h1>
      <p className="tagline">
        Turn a codebase, a document, or an open-ended topic into a map you can drill into —
        one level at a time, instead of a wall of text.
      </p>

      <ConfigBanner />

      <NewMapForm />

      <div className="section-title">Your maps</div>
      <MapList maps={maps} />
    </main>
  );
}
