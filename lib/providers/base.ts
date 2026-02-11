import {
  LiveAttractionState,
  ParkDefinition,
  ParkLiveSnapshot,
  ParkLiveSummary,
  ProviderKey,
  QueueType,
  RideStatus
} from "@/lib/types/park";

export interface LiveProvider {
  key: Exclude<ProviderKey, "synthetic">;
  getLiveData(park: ParkDefinition): Promise<ParkLiveSnapshot | null>;
}

export function normalizeStatus(input?: string | null): RideStatus {
  const value = (input ?? "").toLowerCase();

  if (["operating", "open", "up"].some((token) => value.includes(token))) {
    return "OPERATING";
  }
  if (["down", "closed", "temporarily"].some((token) => value.includes(token))) {
    return "DOWN";
  }
  if (["refurb", "maintenance"].some((token) => value.includes(token))) {
    return "REFURBISHMENT";
  }

  return "UNKNOWN";
}

export function normalizeQueueType(input?: string | null): QueueType {
  const value = (input ?? "").toLowerCase();

  if (value.includes("single")) {
    return "SINGLE_RIDER";
  }
  if (value.includes("virtual") || value.includes("boarding")) {
    return "VIRTUAL";
  }
  if (value.includes("standby") || value.includes("stand-by") || value === "") {
    return "STANDBY";
  }

  return "UNKNOWN";
}

export function buildSummary(attractions: LiveAttractionState[]): ParkLiveSummary {
  const open = attractions.filter((item) => item.status === "OPERATING");
  const down = attractions.filter((item) =>
    item.status === "DOWN" || item.status === "CLOSED" || item.status === "REFURBISHMENT"
  );
  const waits = open
    .map((item) => item.waitMinutes)
    .filter((value): value is number => typeof value === "number");

  const averageWaitMinutes =
    waits.length > 0
      ? Math.round(waits.reduce((acc, current) => acc + current, 0) / waits.length)
      : null;

  const sortedByWait = open
    .filter((item): item is LiveAttractionState & { waitMinutes: number } => typeof item.waitMinutes === "number")
    .sort((a, b) => a.waitMinutes - b.waitMinutes);

  return {
    openCount: open.length,
    downCount: down.length,
    averageWaitMinutes,
    shortestWait:
      sortedByWait.length > 0
        ? { name: sortedByWait[0].name, minutes: sortedByWait[0].waitMinutes }
        : null,
    longestWait:
      sortedByWait.length > 0
        ? {
            name: sortedByWait[sortedByWait.length - 1].name,
            minutes: sortedByWait[sortedByWait.length - 1].waitMinutes
          }
        : null
  };
}

export async function safeJsonFetch<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: abortController.signal,
      headers: {
        "accept-language": "en-US,en;q=0.8",
        accept: "application/json"
      },
      cache: "no-store"
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function ageSeconds(isoTime: string): number {
  const parsed = Date.parse(isoTime);
  if (Number.isNaN(parsed)) {
    return Number.MAX_SAFE_INTEGER;
  }
  return Math.max(0, Math.floor((Date.now() - parsed) / 1000));
}
