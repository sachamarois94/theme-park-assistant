import fs from "node:fs";
import path from "node:path";
import {
  ParkLiveSnapshot,
  RideStatus,
  WaitBaselineConfidence,
  WaitBaselineSource,
  WaitOpportunityEntry,
  WaitOpportunitySnapshot
} from "@/lib/types/park";

const HISTORY_WEEKS = Number(process.env.WAIT_HISTORY_WEEKS ?? 8);
const LOOKBACK_90_MIN_MS = 90 * 60 * 1000;
const LOOKBACK_120_MIN_MS = 120 * 60 * 1000;
const FIVE_MIN_MS = 5 * 60 * 1000;
const BUCKET_SIZE_MINUTES = 15;
const MAX_BUCKET_SAMPLES = Number(process.env.WAIT_HISTORY_MAX_BUCKET_SAMPLES ?? 72);
const MAX_HOUR_SAMPLES = Number(process.env.WAIT_HISTORY_MAX_HOUR_SAMPLES ?? 256);
const MAX_GLOBAL_SAMPLES = Number(process.env.WAIT_HISTORY_MAX_GLOBAL_SAMPLES ?? 512);
const MAX_RECENT_POINTS = Number(process.env.WAIT_HISTORY_MAX_RECENT_POINTS ?? 48);
const HISTORY_FILE = process.env.WAIT_HISTORY_FILE ?? path.join(process.cwd(), ".data", "wait-history.json");
const PERSIST_ENABLED = process.env.WAIT_HISTORY_PERSIST !== "0";

interface RecentPoint {
  ts: number;
  waitMinutes: number | null;
  status: RideStatus;
}

interface AttractionHistory {
  parkId: string;
  attractionId: string;
  attractionName: string;
  land?: string;
  bucketSamples: Record<string, number[]>;
  hourSamples: Record<string, number[]>;
  globalSamples: number[];
  recentPoints: RecentPoint[];
}

interface PersistedStore {
  version: 1;
  updatedAt: number;
  attractions: Record<string, AttractionHistory>;
  slotByAttraction: Record<string, number>;
}

interface WaitHistoryStore {
  loaded: boolean;
  attractions: Map<string, AttractionHistory>;
  slotByAttraction: Map<string, number>;
  flushTimer: NodeJS.Timeout | null;
}

type BaselineResult = {
  typicalWaitMinutes: number;
  confidence: WaitBaselineConfidence;
  source: WaitBaselineSource;
  sampleCount: number;
};

const GLOBAL_STORE_KEY = "__theme_park_wait_history_store__";

function getStore(): WaitHistoryStore {
  const globalContainer = globalThis as unknown as Record<string, WaitHistoryStore | undefined>;
  if (!globalContainer[GLOBAL_STORE_KEY]) {
    globalContainer[GLOBAL_STORE_KEY] = {
      loaded: false,
      attractions: new Map(),
      slotByAttraction: new Map(),
      flushTimer: null
    };
  }
  return globalContainer[GLOBAL_STORE_KEY]!;
}

function round(value: number, places = 2): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function boundedPush(values: number[], value: number, max: number) {
  values.push(value);
  while (values.length > max) {
    values.shift();
  }
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return sorted[mid];
}

function toBucketKey(date: Date): string {
  const day = date.getDay();
  const minutes = date.getHours() * 60 + date.getMinutes();
  const bucket = Math.floor(minutes / BUCKET_SIZE_MINUTES);
  return `${day}-${bucket}`;
}

function toHourKey(date: Date): string {
  return String(date.getHours());
}

function toHistoryKey(parkId: string, attractionId: string): string {
  return `${parkId}:${attractionId}`;
}

function scoreConfidence(sampleCount: number, source: WaitBaselineSource): WaitBaselineConfidence {
  if (source === "bucket" && sampleCount >= 12) {
    return "HIGH";
  }
  if ((source === "bucket" && sampleCount >= 6) || (source === "hour" && sampleCount >= 30)) {
    return "MEDIUM";
  }
  return "LOW";
}

function loadStoreIfNeeded() {
  const store = getStore();
  if (store.loaded || !PERSIST_ENABLED) {
    store.loaded = true;
    return;
  }

  store.loaded = true;
  try {
    if (!fs.existsSync(HISTORY_FILE)) {
      return;
    }
    const parsed = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8")) as PersistedStore;
    if (!parsed || parsed.version !== 1) {
      return;
    }

    for (const [key, history] of Object.entries(parsed.attractions ?? {})) {
      store.attractions.set(key, history);
    }
    for (const [key, slot] of Object.entries(parsed.slotByAttraction ?? {})) {
      store.slotByAttraction.set(key, slot);
    }
  } catch {
    // Non-fatal: history can rebuild over time.
  }
}

function schedulePersist() {
  if (!PERSIST_ENABLED) {
    return;
  }
  const store = getStore();
  if (store.flushTimer) {
    return;
  }

  store.flushTimer = setTimeout(() => {
    const snapshot: PersistedStore = {
      version: 1,
      updatedAt: Date.now(),
      attractions: Object.fromEntries(store.attractions.entries()),
      slotByAttraction: Object.fromEntries(store.slotByAttraction.entries())
    };

    fs.promises
      .mkdir(path.dirname(HISTORY_FILE), { recursive: true })
      .then(() => fs.promises.writeFile(HISTORY_FILE, JSON.stringify(snapshot), "utf8"))
      .catch(() => {
        // Best effort persistence only.
      })
      .finally(() => {
        store.flushTimer = null;
      });
  }, 3000);
}

function getOrCreateHistory(parkId: string, attractionId: string, attractionName: string, land?: string): AttractionHistory {
  const store = getStore();
  const key = toHistoryKey(parkId, attractionId);
  const existing = store.attractions.get(key);
  if (existing) {
    existing.attractionName = attractionName;
    existing.land = land ?? existing.land;
    return existing;
  }

  const created: AttractionHistory = {
    parkId,
    attractionId,
    attractionName,
    land,
    bucketSamples: {},
    hourSamples: {},
    globalSamples: [],
    recentPoints: []
  };
  store.attractions.set(key, created);
  return created;
}

function addRecentPoint(history: AttractionHistory, ts: number, waitMinutes: number | null, status: RideStatus) {
  history.recentPoints.push({ ts, waitMinutes, status });
  const minTs = ts - LOOKBACK_120_MIN_MS;
  history.recentPoints = history.recentPoints
    .filter((point) => point.ts >= minTs)
    .slice(-MAX_RECENT_POINTS);
}

function baselineForHistory(history: AttractionHistory | undefined, now: Date): BaselineResult {
  if (!history) {
    return {
      typicalWaitMinutes: 0,
      confidence: "LOW",
      source: "fallback",
      sampleCount: 0
    };
  }

  const bucketKey = toBucketKey(now);
  const bucketValues = history.bucketSamples[bucketKey] ?? [];
  const bucketMedian = median(bucketValues);
  if (bucketMedian !== null && bucketValues.length >= 6) {
    return {
      typicalWaitMinutes: bucketMedian,
      confidence: scoreConfidence(bucketValues.length, "bucket"),
      source: "bucket",
      sampleCount: bucketValues.length
    };
  }

  const hourKey = toHourKey(now);
  const hourValues = history.hourSamples[hourKey] ?? [];
  const hourMedian = median(hourValues);
  if (hourMedian !== null && hourValues.length >= 8) {
    return {
      typicalWaitMinutes: hourMedian,
      confidence: scoreConfidence(hourValues.length, "hour"),
      source: "hour",
      sampleCount: hourValues.length
    };
  }

  const globalMedian = median(history.globalSamples);
  if (globalMedian !== null && history.globalSamples.length >= 8) {
    return {
      typicalWaitMinutes: globalMedian,
      confidence: scoreConfidence(history.globalSamples.length, "global"),
      source: "global",
      sampleCount: history.globalSamples.length
    };
  }

  return {
    typicalWaitMinutes: 0,
    confidence: "LOW",
    source: "fallback",
    sampleCount: 0
  };
}

function reliabilityRisk(history: AttractionHistory | undefined, nowTs: number): number {
  if (!history) {
    return 0;
  }
  const points = history.recentPoints.filter((point) => point.ts >= nowTs - LOOKBACK_90_MIN_MS);
  if (points.length < 2) {
    return 0;
  }

  let downCount = 0;
  let transitions = 0;

  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    if (point.status !== "OPERATING") {
      downCount += 1;
    }
    if (i > 0 && points[i - 1].status !== point.status) {
      transitions += 1;
    }
  }

  const downRatio = downCount / points.length;
  return Math.min(1, downRatio * 0.75 + Math.min(transitions, 8) / 8 * 0.25);
}

function buildTrend(history: AttractionHistory | undefined, currentWait: number, nowTs: number): number[] {
  if (!history) {
    return [currentWait];
  }

  const waits = history.recentPoints
    .filter((point) => point.ts >= nowTs - LOOKBACK_90_MIN_MS)
    .map((point) => point.waitMinutes)
    .filter((value): value is number => typeof value === "number");

  if (waits.length === 0) {
    return [currentWait];
  }

  const maxPoints = 18;
  const step = Math.max(1, Math.ceil(waits.length / maxPoints));
  const downsampled: number[] = [];
  for (let i = 0; i < waits.length; i += step) {
    downsampled.push(waits[i]);
  }
  return downsampled.slice(-maxPoints);
}

function isBestMoveCandidate(entry: WaitOpportunityEntry): boolean {
  return (
    entry.confidence !== "LOW" &&
    entry.baselineSource !== "fallback" &&
    entry.currentWaitMinutes > 0
  );
}

function buildOpportunityEntry(snapshot: ParkLiveSnapshot, attractionIndex: number): WaitOpportunityEntry | null {
  const attraction = snapshot.attractions[attractionIndex];
  if (attraction.status !== "OPERATING" || typeof attraction.waitMinutes !== "number") {
    return null;
  }

  const store = getStore();
  const key = toHistoryKey(snapshot.parkId, attraction.attractionId);
  const history = store.attractions.get(key);
  const baseline = baselineForHistory(history, new Date());
  const typical = baseline.typicalWaitMinutes > 0 ? baseline.typicalWaitMinutes : attraction.waitMinutes;
  const deltaMinutes = attraction.waitMinutes - typical;
  const deltaPercent = typical > 0 ? Math.round((deltaMinutes / typical) * 100) : 0;
  const risk = reliabilityRisk(history, Date.now());
  const confidenceWeight = baseline.confidence === "HIGH" ? 1 : baseline.confidence === "MEDIUM" ? 0.86 : 0.72;
  const relativeOpportunity = typical > 0 ? (typical - attraction.waitMinutes) / typical : 0;
  const absoluteComponent = Math.max(-1, Math.min(1, (40 - attraction.waitMinutes) / 40));
  const landBoost = attraction.land ? 0.04 : 0;
  const score = ((relativeOpportunity * 0.72 + absoluteComponent * 0.28 + landBoost) * confidenceWeight) - risk * 0.22;

  return {
    attractionId: attraction.attractionId,
    attractionName: attraction.name,
    land: attraction.land,
    currentWaitMinutes: attraction.waitMinutes,
    typicalWaitMinutes: typical,
    deltaMinutes,
    deltaPercent,
    confidence: baseline.confidence,
    baselineSource: baseline.source,
    score: round(score, 4),
    reliabilityRisk: round(risk, 3),
    trendPoints: buildTrend(history, attraction.waitMinutes, Date.now())
  };
}

export function ingestSnapshotHistory(snapshot: ParkLiveSnapshot) {
  loadStoreIfNeeded();
  const store = getStore();
  const now = Date.now();
  const maxAge = HISTORY_WEEKS * 7 * 24 * 60 * 60 * 1000;
  const minTs = now - maxAge;

  for (const attraction of snapshot.attractions) {
    const attractionTs = Date.parse(attraction.sourceUpdatedAt);
    const ts = Number.isFinite(attractionTs) ? attractionTs : now;
    const slot = Math.floor(ts / FIVE_MIN_MS);
    const key = toHistoryKey(snapshot.parkId, attraction.attractionId);
    const lastSlot = store.slotByAttraction.get(key);
    if (lastSlot === slot) {
      continue;
    }
    store.slotByAttraction.set(key, slot);

    const history = getOrCreateHistory(
      snapshot.parkId,
      attraction.attractionId,
      attraction.name,
      attraction.land
    );

    addRecentPoint(history, ts, attraction.waitMinutes, attraction.status);

    if (attraction.status === "OPERATING" && typeof attraction.waitMinutes === "number") {
      const date = new Date(ts);
      const bucketKey = toBucketKey(date);
      const hourKey = toHourKey(date);

      if (!history.bucketSamples[bucketKey]) {
        history.bucketSamples[bucketKey] = [];
      }
      if (!history.hourSamples[hourKey]) {
        history.hourSamples[hourKey] = [];
      }

      boundedPush(history.bucketSamples[bucketKey], attraction.waitMinutes, MAX_BUCKET_SAMPLES);
      boundedPush(history.hourSamples[hourKey], attraction.waitMinutes, MAX_HOUR_SAMPLES);
      boundedPush(history.globalSamples, attraction.waitMinutes, MAX_GLOBAL_SAMPLES);
    }

    // Keep recent points bounded to current time window after any source timestamp skew.
    history.recentPoints = history.recentPoints.filter((point) => point.ts >= minTs).slice(-MAX_RECENT_POINTS);
  }

  schedulePersist();
}

export function buildWaitOpportunitySnapshot(snapshot: ParkLiveSnapshot): WaitOpportunitySnapshot {
  loadStoreIfNeeded();

  const entries: WaitOpportunityEntry[] = snapshot.attractions
    .map((_, index) => buildOpportunityEntry(snapshot, index))
    .filter((value): value is WaitOpportunityEntry => Boolean(value));

  const betterThanUsual = entries
    .filter((entry) => entry.deltaMinutes < 0)
    .sort((a, b) => b.score - a.score || a.deltaPercent - b.deltaPercent)
    .slice(0, 3);

  const worseThanUsual = entries
    .filter((entry) => entry.deltaMinutes > 0)
    .sort((a, b) => b.deltaPercent - a.deltaPercent || b.deltaMinutes - a.deltaMinutes)
    .slice(0, 3);

  const preferredBetter = betterThanUsual.filter(isBestMoveCandidate);
  const preferredAll = entries.filter(isBestMoveCandidate).sort((a, b) => b.score - a.score);
  const hero = preferredBetter[0] ?? preferredAll[0] ?? null;
  const mediumOrHigh = entries.filter((entry) => entry.confidence !== "LOW").length;

  return {
    parkId: snapshot.parkId,
    generatedAt: new Date().toISOString(),
    hero,
    betterThanUsual,
    worseThanUsual,
    insight:
      mediumOrHigh >= 3
        ? "Baseline confidence is healthy for this park right now."
        : "Baseline is still learning; confidence improves as more historical samples accumulate."
  };
}
