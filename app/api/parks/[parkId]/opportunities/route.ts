import { NextRequest, NextResponse } from "next/server";
import { getParkLiveSnapshot } from "@/lib/data/live-data-service";
import { buildWaitOpportunitySnapshot } from "@/lib/data/wait-history-store";
import { buildWaitOpportunitySnapshotFromPostgres } from "@/lib/data/wait-opportunities-db";

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

  const opportunitiesFromDb = await buildWaitOpportunitySnapshotFromPostgres(snapshot);
  const opportunities = opportunitiesFromDb ?? buildWaitOpportunitySnapshot(snapshot);

  return NextResponse.json({
    ...opportunities,
    baselineBackend: opportunitiesFromDb ? "postgres" : "local",
    dataFreshness: {
      provider: snapshot.provider,
      sourceUpdatedAt: snapshot.sourceUpdatedAt,
      ageSeconds: snapshot.freshnessSeconds,
      stale: snapshot.stale
    }
  });
}
