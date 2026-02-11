import { getParkById, PARKS } from "@/lib/config/parks";
import { queueTimesProvider } from "@/lib/providers/queuetimes";
import { themeParksProvider } from "@/lib/providers/themeparks";
import { DayPlan, ParkDefinition, ParkId, ParkLiveSnapshot, PlannerStep } from "@/lib/types/park";

const CACHE_TTL_SECONDS = Number(process.env.LIVE_CACHE_TTL_SECONDS ?? 45);
const PROV_ORDER = [themeParksProvider, queueTimesProvider];

type CachedSnapshot = {
  snapshot: ParkLiveSnapshot;
  expiresAt: number;
};

const liveCache = new Map<ParkId, CachedSnapshot>();

function nowIso(): string {
  return new Date().toISOString();
}

function randomWait(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildSyntheticSnapshot(park: ParkDefinition, reason: string): ParkLiveSnapshot {
  const ingestedAt = nowIso();
  const attractions = park.headlineAttractions.map((name, index) => {
    const wait = randomWait(15, 70);
    return {
      attractionId: `${park.id}-synthetic-${index + 1}`,
      name,
      status: "OPERATING" as const,
      waitMinutes: wait,
      queueType: "STANDBY" as const,
      sourceUpdatedAt: ingestedAt,
      ingestedAt,
      provider: "synthetic" as const
    };
  });

  const waits = attractions.map((item) => item.waitMinutes).filter((v): v is number => typeof v === "number");
  const sorted = [...attractions].sort((a, b) => (a.waitMinutes ?? 0) - (b.waitMinutes ?? 0));

  return {
    parkId: park.id,
    parkName: park.name,
    provider: "synthetic",
    sourceUpdatedAt: ingestedAt,
    ingestedAt,
    freshnessSeconds: 0,
    stale: false,
    degradedReason: reason,
    attractions,
    summary: {
      openCount: attractions.length,
      downCount: 0,
      averageWaitMinutes: Math.round(waits.reduce((acc, value) => acc + value, 0) / waits.length),
      shortestWait: sorted.length > 0 ? { name: sorted[0].name, minutes: sorted[0].waitMinutes ?? 0 } : null,
      longestWait:
        sorted.length > 0
          ? {
              name: sorted[sorted.length - 1].name,
              minutes: sorted[sorted.length - 1].waitMinutes ?? 0
            }
          : null
    }
  };
}

export async function getParkLiveSnapshot(
  parkId: string,
  options?: { forceRefresh?: boolean }
): Promise<ParkLiveSnapshot | null> {
  const park = getParkById(parkId);
  if (!park) {
    return null;
  }

  const forceRefresh = options?.forceRefresh ?? false;
  const cached = liveCache.get(park.id);
  const now = Date.now();
  if (!forceRefresh && cached && cached.expiresAt > now) {
    return cached.snapshot;
  }

  for (const provider of PROV_ORDER) {
    const snapshot = await provider.getLiveData(park);
    if (snapshot && snapshot.attractions.length > 0) {
      liveCache.set(park.id, {
        snapshot,
        expiresAt: now + CACHE_TTL_SECONDS * 1000
      });
      return snapshot;
    }
  }

  if (cached) {
    return {
      ...cached.snapshot,
      stale: true,
      degradedReason: cached.snapshot.degradedReason ?? "Serving last known data. Live providers unavailable."
    };
  }

  const synthetic = buildSyntheticSnapshot(
    park,
    "Live providers unavailable. Showing synthetic waits for UI continuity."
  );
  liveCache.set(park.id, {
    snapshot: synthetic,
    expiresAt: now + CACHE_TTL_SECONDS * 1000
  });
  return synthetic;
}

export function listParks() {
  return PARKS.map((park) => ({
    id: park.id,
    name: park.name,
    resort: park.resort
  }));
}

export function recommendNext(snapshot: ParkLiveSnapshot) {
  const candidates = snapshot.attractions
    .filter((item) => item.status === "OPERATING")
    .filter((item): item is typeof item & { waitMinutes: number } => typeof item.waitMinutes === "number")
    .sort((a, b) => a.waitMinutes - b.waitMinutes);

  const top = candidates[0] ?? null;
  return {
    top,
    alternatives: candidates.slice(1, 4)
  };
}

export function buildPlanFromSnapshot(snapshot: ParkLiveSnapshot, startTime?: string, hours = 8): DayPlan {
  const start = startTime ? new Date(startTime) : new Date();
  const candidates = snapshot.attractions
    .filter((item) => item.status === "OPERATING")
    .sort((a, b) => (a.waitMinutes ?? 999) - (b.waitMinutes ?? 999))
    .slice(0, Math.max(4, Math.min(12, hours + 2)));

  const steps: PlannerStep[] = [];
  let cursor = new Date(start);

  for (let i = 0; i < candidates.length; i += 1) {
    const attraction = candidates[i];
    const wait = attraction.waitMinutes ?? 30;
    const bufferMinutes = i % 3 === 2 ? 25 : 15;
    const duration = Math.max(35, Math.min(95, wait + bufferMinutes));
    const end = new Date(cursor.getTime() + duration * 60000);

    steps.push({
      stepId: `step-${i + 1}`,
      attractionId: attraction.attractionId,
      attractionName: attraction.name,
      targetWindowStart: cursor.toISOString(),
      targetWindowEnd: end.toISOString(),
      expectedWait: attraction.waitMinutes,
      reason:
        i === 0
          ? "Low wait right now. Best immediate throughput."
          : "Placed to balance queue time and move efficiency."
    });

    cursor = end;
  }

  return {
    planId: `plan-${snapshot.parkId}-${Date.now()}`,
    parkId: snapshot.parkId,
    generatedAt: nowIso(),
    steps
  };
}

export function replanFromSnapshot(snapshot: ParkLiveSnapshot, existing?: DayPlan): DayPlan {
  if (!existing || existing.steps.length === 0) {
    return buildPlanFromSnapshot(snapshot);
  }

  const currentByAttraction = new Map(
    snapshot.attractions.map((item) => [item.attractionId, item] as const)
  );

  const repriced = existing.steps.map((step) => {
    const live = currentByAttraction.get(step.attractionId);
    return {
      ...step,
      expectedWait: live?.waitMinutes ?? step.expectedWait ?? null,
      reason: live?.status === "DOWN"
        ? "Ride currently down. Consider swapping."
        : "Replanned using latest queue snapshot."
    };
  });

  const sorted = [...repriced].sort((a, b) => (a.expectedWait ?? 999) - (b.expectedWait ?? 999));

  return {
    ...existing,
    generatedAt: nowIso(),
    steps: sorted
  };
}
