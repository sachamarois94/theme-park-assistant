import { NextRequest, NextResponse } from "next/server";
import { getParkLiveSnapshot } from "@/lib/data/live-data-service";
import { buildWaitOpportunitySnapshot } from "@/lib/data/wait-history-store";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ parkId: string }> }
) {
  const { parkId } = await context.params;
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "true";
  const snapshot = await getParkLiveSnapshot(parkId, { forceRefresh });

  if (!snapshot) {
    return NextResponse.json({ error: "Unsupported park id" }, { status: 404 });
  }

  const opportunities = buildWaitOpportunitySnapshot(snapshot);

  return NextResponse.json({
    ...opportunities,
    dataFreshness: {
      provider: snapshot.provider,
      sourceUpdatedAt: snapshot.sourceUpdatedAt,
      ageSeconds: snapshot.freshnessSeconds,
      stale: snapshot.stale
    }
  });
}
