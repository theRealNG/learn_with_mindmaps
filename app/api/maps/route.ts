import { NextResponse } from "next/server";
import { listMaps } from "@/lib/db";
import {
  createCodebaseMap,
  createDocumentMap,
  createTopicMap,
  IngestError,
} from "@/lib/ingest";
import { toMapDto } from "@/lib/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ maps: listMaps().map(toMapDto) });
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        throw new IngestError("No file was uploaded.");
      }
      const map = await createDocumentMap({
        kind: "file",
        file: { name: file.name, buffer: Buffer.from(await file.arrayBuffer()) },
        title: (form.get("title") as string) || undefined,
      });
      return NextResponse.json({ map: toMapDto(map) }, { status: 201 });
    }

    const body = (await request.json()) as Record<string, string | string[] | undefined>;
    const sourceType = String(body.sourceType || "");

    if (sourceType === "codebase") {
      const map = await createCodebaseMap({
        ref: String(body.ref || ""),
        title: body.title as string | undefined,
      });
      return NextResponse.json({ map: toMapDto(map) }, { status: 201 });
    }

    if (sourceType === "document") {
      const map = await createDocumentMap({
        kind: body.url ? "url" : "text",
        url: body.url as string | undefined,
        text: body.text as string | undefined,
        title: body.title as string | undefined,
      });
      return NextResponse.json({ map: toMapDto(map) }, { status: 201 });
    }

    if (sourceType === "topic") {
      const map = createTopicMap({
        topic: String(body.topic || ""),
        seedNotes: body.seedNotes as string | undefined,
        referenceLinks: String(body.referenceLinks || "")
          .split(/[\n,]/)
          .map((link) => link.trim())
          .filter(Boolean),
        title: body.title as string | undefined,
      });
      return NextResponse.json({ map: toMapDto(map) }, { status: 201 });
    }

    throw new IngestError(`Unknown sourceType "${sourceType}".`);
  } catch (error) {
    const status = error instanceof IngestError ? 400 : 500;
    return NextResponse.json({ error: (error as Error).message }, { status });
  }
}
