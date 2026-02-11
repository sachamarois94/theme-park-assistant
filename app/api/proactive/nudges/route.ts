import { NextRequest, NextResponse } from "next/server";
import { getParkLiveSnapshot } from "@/lib/data/live-data-service";
import { generateProactiveNudges } from "@/lib/data/proactive-engine";

const COOKIE_NAME = "proactive_mode";

export async function GET(request: NextRequest) {
  const enabled = request.cookies.get(COOKIE_NAME)?.value === "1";
  const parkId = request.nextUrl.searchParams.get("parkId");

  if (!parkId) {
    return NextResponse.json({ error: "parkId is required." }, { status: 400 });
  }

  if (!enabled) {
    return NextResponse.json({
      enabled: false,
      nudges: []
    });
  }

  const snapshot = await getParkLiveSnapshot(parkId, { forceRefresh: true });
  if (!snapshot) {
    return NextResponse.json({ error: "Unsupported park id." }, { status: 404 });
  }

  const nudges = generateProactiveNudges(snapshot);

  return NextResponse.json({
    enabled: true,
    nudges,
    dataFreshness: {
      provider: snapshot.provider,
      sourceUpdatedAt: snapshot.sourceUpdatedAt,
      ageSeconds: snapshot.freshnessSeconds,
      stale: snapshot.stale
    }
  });
}
