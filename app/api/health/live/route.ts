import { NextResponse } from "next/server";
import { listParks, getParkLiveSnapshot } from "@/lib/data/live-data-service";

export async function GET() {
  const parks = listParks();
  const snapshots = await Promise.all(
    parks.map(async (park) => {
      const snapshot = await getParkLiveSnapshot(park.id, { forceRefresh: true });
      if (!snapshot) {
        return {
          parkId: park.id,
          provider: "none",
          stale: true,
          degradedReason: "No data",
          freshnessSeconds: null,
          attractions: 0
        };
      }

      return {
        parkId: snapshot.parkId,
        provider: snapshot.provider,
        stale: snapshot.stale,
        degradedReason: snapshot.degradedReason ?? null,
        freshnessSeconds: snapshot.freshnessSeconds,
        attractions: snapshot.attractions.length
      };
    })
  );

  const syntheticCount = snapshots.filter((entry) => entry.provider === "synthetic").length;
  const staleCount = snapshots.filter((entry) => entry.stale).length;

  return NextResponse.json({
    ok: syntheticCount === 0,
    generatedAt: new Date().toISOString(),
    summary: {
      parks: snapshots.length,
      syntheticCount,
      staleCount
    },
    parks: snapshots
  });
}
