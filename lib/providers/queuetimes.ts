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
const STALE_AFTER_SECONDS = Number(process.env.LIVE_STALE_AFTER_SECONDS ?? 10800);
const API_BASE_FALLBACK = "https://queue-times.com";

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

  const parkPayloadCandidates = [
    await safeJsonFetch<unknown>(`${API_BASE}/parks`),
    await safeJsonFetch<unknown>(`${API_BASE}/parks.json`),
    await safeJsonFetch<unknown>(`${API_BASE_FALLBACK}/parks.json`),
    await safeJsonFetch<unknown>(`${API_BASE_FALLBACK}/parks`)
  ].filter(Boolean);

  if (parkPayloadCandidates.length === 0) {
    return null;
  }

  const nodes: Array<{ id: string; name: string }> = [];
  for (const payload of parkPayloadCandidates) {
    collectNodes(payload, nodes);
  }

  const aliases = [park.name, ...park.aliases].map(normalize);
  const aliasSet = new Set(aliases);

  const exact = nodes.find((node) => aliasSet.has(normalize(node.name)));
  if (exact) {
    discoveredParkIds.set(park.id, exact.id);
    return exact.id;
  }

  const expanded = nodes
    .map((node) => ({ node, normalized: normalize(node.name) }))
    .filter((entry) =>
      aliases.some((alias) => entry.normalized.includes(alias) || alias.includes(entry.normalized))
    )
    .sort((a, b) => a.normalized.length - b.normalized.length);

  const match = expanded[0]?.node;

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
  waitTime?: number | null;
  queue_type?: string;
  queueType?: string;
  last_updated?: string;
  updated_at?: string;
  lastUpdated?: string;
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
    ("wait_time" in value ||
      "waitTime" in value ||
      "is_open" in value ||
      "status" in value ||
      "queue_type" in value ||
      "queueType" in value);

  if (hasRideShape) {
    results.push(value as unknown as QueueTimesRide);
  }

  for (const child of Object.values(value)) {
    collectRides(child, results);
  }
}

async function fetchQueuePayload(parkId: string): Promise<unknown | null> {
  const candidates = [
    `${API_BASE}/park/${parkId}/queue_times`,
    `${API_BASE}/parks/${parkId}/queue_times`,
    `${API_BASE}/park/${parkId}/queue_times.json`,
    `${API_BASE}/parks/${parkId}/queue_times.json`,
    `${API_BASE_FALLBACK}/parks/${parkId}/queue_times.json`,
    `${API_BASE_FALLBACK}/parks/${parkId}/queue_times`
  ];

  for (const url of candidates) {
    const payload = await safeJsonFetch<unknown>(url);
    if (payload) {
      return payload;
    }
  }
  return null;
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
        const sourceUpdatedAt = ride.last_updated ?? ride.lastUpdated ?? ride.updated_at ?? ingestedAt;
        const wait = typeof ride.wait_time === "number"
          ? ride.wait_time
          : typeof ride.waitTime === "number"
            ? ride.waitTime
            : null;

        return {
          attractionId: String(ride.id ?? `${park.id}-${index}`),
          name: ride.name!.trim(),
          land: ride.land,
          status,
          waitMinutes: typeof wait === "number" ? Math.max(0, Math.round(wait)) : null,
          queueType: normalizeQueueType(ride.queue_type ?? ride.queueType),
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
