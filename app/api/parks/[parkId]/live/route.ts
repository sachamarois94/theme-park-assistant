import { NextRequest, NextResponse } from "next/server";
import { getParkLiveSnapshot } from "@/lib/data/live-data-service";

export async function GET(
  request: NextRequest,
  context: { params: { parkId: string } }
) {
  const { parkId } = context.params;
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "true";

  const snapshot = await getParkLiveSnapshot(parkId, { forceRefresh });

  if (!snapshot) {
    return NextResponse.json(
      { error: "Unsupported park id" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    parkId: snapshot.parkId,
    parkName: snapshot.parkName,
    provider: snapshot.provider,
    sourceUpdatedAt: snapshot.sourceUpdatedAt,
    ingestedAt: snapshot.ingestedAt,
    freshnessSeconds: snapshot.freshnessSeconds,
    stale: snapshot.stale,
    degradedReason: snapshot.degradedReason,
    summary: snapshot.summary,
    attractions: snapshot.attractions
  });
}
