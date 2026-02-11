import { ParkDefinition, ParkLiveSnapshot } from "@/lib/types/park";
import {
  ageSeconds,
  buildSummary,
  LiveProvider,
  normalizeQueueType,
  normalizeStatus,
  safeJsonFetch
} from "@/lib/providers/base";

const API_BASE = process.env.THEMEPARKS_API_BASE ?? "https://api.themeparks.wiki/v1";
const STALE_AFTER_SECONDS = Number(process.env.LIVE_STALE_AFTER_SECONDS ?? 10800);

const discoveredEntityIds = new Map<string, string>();

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function collectNamedNodes(input: unknown, results: Array<{ id: string; name: string }>) {
  if (!input || typeof input !== "object") {
    return;
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      collectNamedNodes(item, results);
    }
    return;
  }

  const value = input as Record<string, unknown>;
  const id = value.id;
  const name = value.name;

  if ((typeof id === "string" || typeof id === "number") && typeof name === "string") {
    results.push({ id: String(id), name });
  }

  for (const child of Object.values(value)) {
    collectNamedNodes(child, results);
  }
}

async function resolveEntityId(park: ParkDefinition): Promise<string | null> {
  if (park.providerHints.themeparksEntityId) {
    return park.providerHints.themeparksEntityId;
  }

  const cached = discoveredEntityIds.get(park.id);
  if (cached) {
    return cached;
  }

  const destinations = await safeJsonFetch<unknown>(`${API_BASE}/destinations`);
  if (!destinations) {
    return null;
  }

  const nodes: Array<{ id: string; name: string }> = [];
  collectNamedNodes(destinations, nodes);
  const aliases = [park.name, ...park.aliases].map(normalize);
  const aliasSet = new Set(aliases);

  const exact = nodes.find((node) => aliasSet.has(normalize(node.name)));
  if (exact) {
    discoveredEntityIds.set(park.id, exact.id);
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

  discoveredEntityIds.set(park.id, match.id);
  return match.id;
}

interface ThemeParksQueue {
  waitTime?: number | null;
}

interface ThemeParksLiveEntity {
  id?: string | number;
  name?: string;
  lastUpdated?: string;
  last_updated?: string;
  status?: string;
  queue?: Record<string, ThemeParksQueue | null | undefined>;
  waitTime?: number;
  location?: {
    land?: string;
    area?: string;
    name?: string;
  };
  land?: string;
}

function collectLiveEntities(input: unknown, results: ThemeParksLiveEntity[]) {
  if (!input || typeof input !== "object") {
    return;
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      collectLiveEntities(item, results);
    }
    return;
  }

  const value = input as Record<string, unknown>;
  const hasName = typeof value.name === "string";
  const hasQueue = typeof value.queue === "object" || typeof value.waitTime === "number";
  const hasStatus = typeof value.status === "string";

  if (hasName && (hasQueue || hasStatus)) {
    results.push(value as unknown as ThemeParksLiveEntity);
  }

  for (const child of Object.values(value)) {
    collectLiveEntities(child, results);
  }
}

function pickWaitAndQueueType(entity: ThemeParksLiveEntity): { wait: number | null; queueType: string } {
  if (entity.queue && typeof entity.queue === "object") {
    const queueEntries = Object.entries(entity.queue);

    for (const [queueType, queue] of queueEntries) {
      if (queue && typeof queue.waitTime === "number") {
        return { wait: Math.max(0, Math.round(queue.waitTime)), queueType };
      }
    }
  }

  if (typeof entity.waitTime === "number") {
    return { wait: Math.max(0, Math.round(entity.waitTime)), queueType: "standby" };
  }

  return { wait: null, queueType: "unknown" };
}

export const themeParksProvider: LiveProvider = {
  key: "themeparks",

  async getLiveData(park: ParkDefinition): Promise<ParkLiveSnapshot | null> {
    const entityId = await resolveEntityId(park);
    if (!entityId) {
      return null;
    }

    const payload = await safeJsonFetch<unknown>(`${API_BASE}/entity/${entityId}/live`);
    if (!payload) {
      return null;
    }

    const liveEntities: ThemeParksLiveEntity[] = [];
    collectLiveEntities(payload, liveEntities);

    const ingestedAt = new Date().toISOString();
    const attractions = liveEntities
      .filter((entity) => typeof entity.name === "string" && entity.name.trim().length > 0)
      .map((entity, index) => {
        const queue = pickWaitAndQueueType(entity);
        const sourceUpdatedAt = entity.lastUpdated ?? entity.last_updated ?? ingestedAt;

        return {
          attractionId: String(entity.id ?? `${park.id}-${index}`),
          name: entity.name!.trim(),
          land: entity.location?.land ?? entity.location?.area ?? entity.location?.name ?? entity.land,
          status: normalizeStatus(entity.status),
          waitMinutes: queue.wait,
          queueType: normalizeQueueType(queue.queueType),
          sourceUpdatedAt,
          ingestedAt,
          provider: "themeparks" as const
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
      provider: "themeparks",
      sourceUpdatedAt: newestSourceUpdate,
      ingestedAt,
      freshnessSeconds,
      stale: freshnessSeconds > STALE_AFTER_SECONDS,
      attractions,
      summary: buildSummary(attractions)
    };
  }
};
