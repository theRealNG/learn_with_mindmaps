import { NextResponse } from "next/server";
import { getProvider } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lets the UI show which provider/model is active, and warn early if the key is missing. */
export async function GET() {
  try {
    const provider = getProvider();
    return NextResponse.json({
      configured: true,
      provider: provider.id,
      model: provider.model,
      pricingKnown: provider.pricing() !== null,
      maxToolTurns: Number(process.env.MAX_TOOL_TURNS) || 10,
      webSearch: (process.env.WEB_SEARCH_PROVIDER || "duckduckgo").toLowerCase(),
    });
  } catch (error) {
    return NextResponse.json({ configured: false, error: (error as Error).message });
  }
}
