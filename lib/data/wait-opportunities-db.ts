import { Pool } from "pg";
import {
  ParkLiveSnapshot,
  WaitBaselineConfidence,
  WaitBaselineSource,
  WaitOpportunityEntry,
  WaitOpportunitySnapshot
} from "@/lib/types/park";

type BaselineRow = {
  attraction_id: string;
  median_wait_minutes: number | string;
  sample_count: number | string;
  source: WaitBaselineSource;
};

type RecentPointRow = {
  attraction_id: string;
  status: string;
  wait_minutes: number | null;
  source_updated_at: string;
};

type BaselineResult = {
  typicalWaitMinutes: number;
  confidence: WaitBaselineConfidence;
  source: WaitBaselineSource;
  sampleCount: number;
};

const GLOBAL_POOL_KEY = "__theme_park_postgres_pool__";

function getPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }

  const globalContainer = globalThis as unknown as Record<string, Pool | undefined>;
  if (!globalContainer[GLOBAL_POOL_KEY]) {
    globalContainer[GLOBAL_POOL_KEY] = new Pool({
      connectionString
    });
  }
  return globalContainer[GLOBAL_POOL_KEY]!;
}

function round(value: number, places = 2): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
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

function baselineForAttraction(
  attractionId: string,
  bucketRows: Map<string, BaselineRow>,
  hourRows: Map<string, BaselineRow>,
  globalRows: Map<string, BaselineRow>
): BaselineResult {
  const bucket = bucketRows.get(attractionId);
  if (bucket) {
    const sampleCount = toNumber(bucket.sample_count);
    return {
      typicalWaitMinutes: Math.max(0, Math.round(toNumber(bucket.median_wait_minutes))),
      confidence: scoreConfidence(sampleCount, "bucket"),
      source: "bucket",
      sampleCount
    };
  }

  const hour = hourRows.get(attractionId);
  if (hour) {
    const sampleCount = toNumber(hour.sample_count);
    return {
      typicalWaitMinutes: Math.max(0, Math.round(toNumber(hour.median_wait_minutes))),
      confidence: scoreConfidence(sampleCount, "hour"),
      source: "hour",
      sampleCount
    };
  }

  const global = globalRows.get(attractionId);
  if (global) {
    const sampleCount = toNumber(global.sample_count);
    return {
      typicalWaitMinutes: Math.max(0, Math.round(toNumber(global.median_wait_minutes))),
      confidence: scoreConfidence(sampleCount, "global"),
      source: "global",
      sampleCount
    };
  }

  return {
    typicalWaitMinutes: 0,
    confidence: "LOW",
    source: "fallback",
    sampleCount: 0
  };
}

function reliabilityRisk(points: RecentPointRow[]): number {
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
  return Math.min(1, downRatio * 0.75 + (Math.min(transitions, 8) / 8) * 0.25);
}

function buildTrendPoints(currentWait: number, points: RecentPointRow[]): number[] {
  const waits = points
    .map((point) => point.wait_minutes)
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

function toMap(rows: BaselineRow[]): Map<string, BaselineRow> {
  return new Map(rows.map((row) => [row.attraction_id, row] as const));
}

function toEntry(
  snapshot: ParkLiveSnapshot,
  attractionIndex: number,
  bucketRows: Map<string, BaselineRow>,
  hourRows: Map<string, BaselineRow>,
  globalRows: Map<string, BaselineRow>,
  recentPointsByAttraction: Map<string, RecentPointRow[]>
): WaitOpportunityEntry | null {
  const attraction = snapshot.attractions[attractionIndex];
  if (attraction.status !== "OPERATING" || typeof attraction.waitMinutes !== "number") {
    return null;
  }

  const baseline = baselineForAttraction(attraction.attractionId, bucketRows, hourRows, globalRows);
  const typical = baseline.typicalWaitMinutes > 0 ? baseline.typicalWaitMinutes : attraction.waitMinutes;
  const deltaMinutes = attraction.waitMinutes - typical;
  const deltaPercent = typical > 0 ? Math.round((deltaMinutes / typical) * 100) : 0;

  const recentPoints = recentPointsByAttraction.get(attraction.attractionId) ?? [];
  const risk = reliabilityRisk(recentPoints);
  const confidenceWeight =
    baseline.confidence === "HIGH" ? 1 : baseline.confidence === "MEDIUM" ? 0.86 : 0.72;
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
    trendPoints: buildTrendPoints(attraction.waitMinutes, recentPoints)
  };
}

function nowTimeKeys(date: Date): { dayOfWeek: number; bucket15m: number; hourOfDay: number } {
  const dayOfWeek = date.getDay();
  const totalMinutes = date.getHours() * 60 + date.getMinutes();
  return {
    dayOfWeek,
    bucket15m: Math.floor(totalMinutes / 15),
    hourOfDay: date.getHours()
  };
}

function buildRecentPointsMap(rows: RecentPointRow[]): Map<string, RecentPointRow[]> {
  const map = new Map<string, RecentPointRow[]>();
  for (const row of rows) {
    const list = map.get(row.attraction_id) ?? [];
    list.push(row);
    map.set(row.attraction_id, list);
  }
  return map;
}

export async function buildWaitOpportunitySnapshotFromPostgres(
  snapshot: ParkLiveSnapshot
): Promise<WaitOpportunitySnapshot | null> {
  const pool = getPool();
  if (!pool) {
    return null;
  }

  const attractionIds = snapshot.attractions.map((item) => item.attractionId);
  if (attractionIds.length === 0) {
    return {
      parkId: snapshot.parkId,
      generatedAt: new Date().toISOString(),
      hero: null,
      betterThanUsual: [],
      worseThanUsual: [],
      insight: "No active attractions in snapshot."
    };
  }

  const { dayOfWeek, bucket15m, hourOfDay } = nowTimeKeys(new Date());

  try {
    const [bucketResult, hourResult, globalResult, recentResult] = await Promise.all([
      pool.query<BaselineRow>(
        `
          SELECT
            attraction_id,
            median_wait_minutes,
            sample_count,
            'bucket'::text AS source
          FROM wait_baseline_15m
          WHERE park_id = $1
            AND day_of_week = $2
            AND bucket_15m = $3
            AND attraction_id = ANY($4::text[])
        `,
        [snapshot.parkId, dayOfWeek, bucket15m, attractionIds]
      ),
      pool.query<BaselineRow>(
        `
          SELECT
            attraction_id,
            median_wait_minutes,
            sample_count,
            'hour'::text AS source
          FROM wait_baseline_hour
          WHERE park_id = $1
            AND day_of_week = $2
            AND hour_of_day = $3
            AND attraction_id = ANY($4::text[])
        `,
        [snapshot.parkId, dayOfWeek, hourOfDay, attractionIds]
      ),
      pool.query<BaselineRow>(
        `
          SELECT
            attraction_id,
            median_wait_minutes,
            sample_count,
            'global'::text AS source
          FROM wait_baseline_global
          WHERE park_id = $1
            AND attraction_id = ANY($2::text[])
        `,
        [snapshot.parkId, attractionIds]
      ),
      pool.query<RecentPointRow>(
        `
          SELECT
            attraction_id,
            status,
            wait_minutes,
            source_updated_at
          FROM wait_observations
          WHERE park_id = $1
            AND attraction_id = ANY($2::text[])
            AND source_updated_at >= NOW() - INTERVAL '120 minutes'
          ORDER BY attraction_id, source_updated_at
        `,
        [snapshot.parkId, attractionIds]
      )
    ]);

    const bucketRows = toMap(bucketResult.rows);
    const hourRows = toMap(hourResult.rows);
    const globalRows = toMap(globalResult.rows);
    const recentPointsByAttraction = buildRecentPointsMap(recentResult.rows);

    const entries: WaitOpportunityEntry[] = snapshot.attractions
      .map((_, index) => toEntry(snapshot, index, bucketRows, hourRows, globalRows, recentPointsByAttraction))
      .filter((value): value is WaitOpportunityEntry => Boolean(value));

    const betterThanUsual = entries
      .filter((entry) => entry.deltaMinutes < 0)
      .sort((a, b) => b.score - a.score || a.deltaPercent - b.deltaPercent)
      .slice(0, 3);

    const worseThanUsual = entries
      .filter((entry) => entry.deltaMinutes > 0)
      .sort((a, b) => b.deltaPercent - a.deltaPercent || b.deltaMinutes - a.deltaMinutes)
      .slice(0, 3);

    const hero = betterThanUsual[0] ?? [...entries].sort((a, b) => b.score - a.score)[0] ?? null;
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
  } catch {
    return null;
  }
}
