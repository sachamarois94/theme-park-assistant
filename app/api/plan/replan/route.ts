import { NextRequest, NextResponse } from "next/server";
import { getParkLiveSnapshot, replanFromSnapshot } from "@/lib/data/live-data-service";
import { buildServiceNotice } from "@/lib/data/live-quality";
import { DayPlan, ParkId } from "@/lib/types/park";

interface ReplanRequest {
  parkId?: ParkId;
  plan?: DayPlan;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as ReplanRequest;
  if (!body.parkId) {
    return NextResponse.json({ error: "parkId is required." }, { status: 400 });
  }

  const snapshot = await getParkLiveSnapshot(body.parkId, { forceRefresh: true });
  if (!snapshot) {
    return NextResponse.json({ error: "Unsupported park id." }, { status: 404 });
  }

  const plan = replanFromSnapshot(snapshot, body.plan);

  return NextResponse.json({
    plan,
    serviceNotice: buildServiceNotice(snapshot),
    dataFreshness: {
      provider: snapshot.provider,
      sourceUpdatedAt: snapshot.sourceUpdatedAt,
      ageSeconds: snapshot.freshnessSeconds,
      stale: snapshot.stale
    }
  });
}
