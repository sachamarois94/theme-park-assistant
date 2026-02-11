import { ParkDefinition, ParkLiveSnapshot } from "@/lib/types/park";
import {
  ageSeconds,
  buildSummary,
  LiveProvider,
  normalizeQueueType,
  normalizeStatus,
  safeJsonFetch
} from "@/lib/providers/base";

const API_BASE = process.env.QUEUETIMES_API_BASE ?? "https://queue-times.com/pages/api";
const STALE_AFTER_SECONDS = Number(process.env.LIVE_STALE_AFTER_SECONDS ?? 360);

const discoveredParkIds = new Map<string, string>();

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function collectNodes(input: unknown, results: Array<{ id: string; name: string }>) {
  if (!input || typeof input !== "object") {
    return;
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      collectNodes(item, results);
    }
    return;
  }

  const value = input as Record<string, unknown>;
  const id = value.id;
  const name = value.name;

  if ((typeof id === "number" || typeof id === "string") && typeof name === "string") {
    results.push({ id: String(id), name });
  }

  for (const child of Object.values(value)) {
    collectNodes(child, results);
  }
}

async function resolveParkId(park: ParkDefinition): Promise<string | null> {
  if (park.providerHints.queueTimesParkId) {
    return park.providerHints.queueTimesParkId;
  }

  const cached = discoveredParkIds.get(park.id);
  if (cached) {
    return cached;
  }

  const parkPayload = await safeJsonFetch<unknown>(`${API_BASE}/parks`);
  if (!parkPayload) {
    return null;
  }

  const nodes: Array<{ id: string; name: string }> = [];
  collectNodes(parkPayload, nodes);
  const aliases = new Set([park.name, ...park.aliases].map(normalize));
  const match = nodes.find((node) => aliases.has(normalize(node.name)));

  if (!match) {
    return null;
  }

  discoveredParkIds.set(park.id, match.id);
  return match.id;
}

interface QueueTimesRide {
  id?: string | number;
  name?: string;
  is_open?: boolean;
  status?: string;
  wait_time?: number | null;
  queue_type?: string;
  last_updated?: string;
  updated_at?: string;
  land?: string;
}

function collectRides(input: unknown, results: QueueTimesRide[]) {
  if (!input || typeof input !== "object") {
    return;
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      collectRides(item, results);
    }
    return;
  }

  const value = input as Record<string, unknown>;
  const hasRideShape = typeof value.name === "string" &&
    ("wait_time" in value || "is_open" in value || "status" in value || "queue_type" in value);

  if (hasRideShape) {
    results.push(value as unknown as QueueTimesRide);
  }

  for (const child of Object.values(value)) {
    collectRides(child, results);
  }
}

async function fetchQueuePayload(parkId: string): Promise<unknown | null> {
  const first = await safeJsonFetch<unknown>(`${API_BASE}/park/${parkId}/queue_times`);
  if (first) {
    return first;
  }

  return safeJsonFetch<unknown>(`${API_BASE}/parks/${parkId}/queue_times`);
}

export const queueTimesProvider: LiveProvider = {
  key: "queuetimes",

  async getLiveData(park: ParkDefinition): Promise<ParkLiveSnapshot | null> {
    const parkId = await resolveParkId(park);
    if (!parkId) {
      return null;
    }

    const payload = await fetchQueuePayload(parkId);
    if (!payload) {
      return null;
    }

    const ingestedAt = new Date().toISOString();
    const rides: QueueTimesRide[] = [];
    collectRides(payload, rides);

    const attractions = rides
      .filter((ride) => typeof ride.name === "string" && ride.name.trim().length > 0)
      .map((ride, index) => {
        const status = ride.is_open === false
          ? "DOWN"
          : normalizeStatus(ride.status ?? (ride.is_open ? "operating" : undefined));
        const sourceUpdatedAt = ride.last_updated ?? ride.updated_at ?? ingestedAt;

        return {
          attractionId: String(ride.id ?? `${park.id}-${index}`),
          name: ride.name!.trim(),
          land: ride.land,
          status,
          waitMinutes: typeof ride.wait_time === "number" ? Math.max(0, Math.round(ride.wait_time)) : null,
          queueType: normalizeQueueType(ride.queue_type),
          sourceUpdatedAt,
          ingestedAt,
          provider: "queuetimes" as const
        };
      })
      .filter((item) => item.name.length > 0);

    if (attractions.length === 0) {
      return null;
    }

    const newestSourceUpdate = attractions.reduce((latest, current) => {
      const latestMs = Date.parse(latest);
      const currentMs = Date.parse(current.sourceUpdatedAt);
      return currentMs > latestMs ? current.sourceUpdatedAt : latest;
    }, attractions[0].sourceUpdatedAt);

    const freshnessSeconds = ageSeconds(newestSourceUpdate);

    return {
      parkId: park.id,
      parkName: park.name,
      provider: "queuetimes",
      sourceUpdatedAt: newestSourceUpdate,
      ingestedAt,
      freshnessSeconds,
      stale: freshnessSeconds > STALE_AFTER_SECONDS,
      attractions,
      summary: buildSummary(attractions)
    };
  }
};
