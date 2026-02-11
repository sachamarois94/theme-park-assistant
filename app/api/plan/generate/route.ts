import { NextRequest, NextResponse } from "next/server";
import { buildPlanFromSnapshot, getParkLiveSnapshot } from "@/lib/data/live-data-service";
import { ParkId } from "@/lib/types/park";

interface GeneratePlanRequest {
  parkId?: ParkId;
  startTime?: string;
  hours?: number;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as GeneratePlanRequest;
  if (!body.parkId) {
    return NextResponse.json({ error: "parkId is required." }, { status: 400 });
  }

  const snapshot = await getParkLiveSnapshot(body.parkId);
  if (!snapshot) {
    return NextResponse.json({ error: "Unsupported park id." }, { status: 404 });
  }

  const plan = buildPlanFromSnapshot(snapshot, body.startTime, body.hours ?? 8);
  return NextResponse.json({
    plan,
    dataFreshness: {
      provider: snapshot.provider,
      sourceUpdatedAt: snapshot.sourceUpdatedAt,
      ageSeconds: snapshot.freshnessSeconds,
      stale: snapshot.stale
    }
  });
}
