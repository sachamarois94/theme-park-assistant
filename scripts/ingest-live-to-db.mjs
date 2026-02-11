#!/usr/bin/env node

import process from "node:process";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const DATABASE_URL = process.env.DATABASE_URL;
const REQUEST_TIMEOUT_MS = Number(process.env.INGEST_REQUEST_TIMEOUT_MS ?? 25000);
const BATCH_SIZE = Number(process.env.INGEST_BATCH_SIZE ?? 250);
const FORCE_REFRESH = process.env.INGEST_FORCE_REFRESH !== "0";
const REFRESH_BASELINES = process.env.INGEST_REFRESH_BASELINES === "1";

function toStringValue(value, fallback = "") {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function toIsoOrNow(value) {
  if (typeof value === "string") {
    const ts = Date.parse(value);
    if (Number.isFinite(ts)) {
      return new Date(ts).toISOString();
    }
  }
  return new Date().toISOString();
}

function normalizeStatus(value) {
  const raw = toStringValue(value, "UNKNOWN").toUpperCase();
  if (raw === "OPERATING" || raw === "DOWN" || raw === "CLOSED" || raw === "REFURBISHMENT") {
    return raw;
  }
  return "UNKNOWN";
}

function normalizeQueueType(value) {
  const raw = toStringValue(value, "UNKNOWN").toUpperCase();
  if (raw === "STANDBY" || raw === "SINGLE_RIDER" || raw === "VIRTUAL") {
    return raw;
  }
  return "UNKNOWN";
}

function normalizeWaitMinutes(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const rounded = Math.round(value);
  if (rounded < 0 || rounded > 480) {
    return null;
  }
  return rounded;
}

async function loadPgClient() {
  try {
    const pg = await import("pg");
    return pg.Client;
  } catch (error) {
    throw new Error(
      `Missing dependency \"pg\". Run: npm install pg. Original error: ${error.message}`
    );
  }
}

async function fetchJson(pathname) {
  const controller = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const response = await fetch(`${BASE_URL}${pathname}`, {
    cache: "no-store",
    signal: controller
  });
  let json;
  try {
    json = await response.json();
  } catch {
    throw new Error(`Non-JSON response: ${pathname} (${response.status})`);
  }
  if (!response.ok) {
    throw new Error(`Request failed ${pathname} (${response.status}): ${JSON.stringify(json)}`);
  }
  return json;
}

function buildRowsFromSnapshot(snapshot) {
  const parkId = toStringValue(snapshot?.parkId);
  const parkName = toStringValue(snapshot?.parkName, parkId || "unknown-park");
  const provider = toStringValue(snapshot?.provider, "unknown");
  const sourceUpdatedAt = toIsoOrNow(snapshot?.sourceUpdatedAt);

  if (!Array.isArray(snapshot?.attractions)) {
    return [];
  }

  return snapshot.attractions.map((attraction) => {
    const attractionSourceUpdatedAt = toIsoOrNow(attraction?.sourceUpdatedAt || sourceUpdatedAt);
    return {
      observedAt: attractionSourceUpdatedAt,
      sourceUpdatedAt: attractionSourceUpdatedAt,
      parkId,
      parkName,
      attractionId: toStringValue(attraction?.attractionId, "unknown-attraction"),
      attractionName: toStringValue(attraction?.name, "Unknown attraction"),
      land: toStringValue(attraction?.land) || null,
      status: normalizeStatus(attraction?.status),
      queueType: normalizeQueueType(attraction?.queueType),
      waitMinutes: normalizeWaitMinutes(attraction?.waitMinutes),
      provider: toStringValue(attraction?.provider, provider)
    };
  });
}

async function insertRows(client, rows) {
  if (rows.length === 0) {
    return 0;
  }

  const cols = [
    "observed_at",
    "source_updated_at",
    "park_id",
    "park_name",
    "attraction_id",
    "attraction_name",
    "land",
    "status",
    "queue_type",
    "wait_minutes",
    "provider"
  ];

  let inserted = 0;

  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const chunk = rows.slice(offset, offset + BATCH_SIZE);
    const values = [];
    const placeholders = chunk
      .map((row, rowIndex) => {
        const base = rowIndex * cols.length;
        values.push(
          row.observedAt,
          row.sourceUpdatedAt,
          row.parkId,
          row.parkName,
          row.attractionId,
          row.attractionName,
          row.land,
          row.status,
          row.queueType,
          row.waitMinutes,
          row.provider
        );
        return `(${cols.map((_, colIndex) => `$${base + colIndex + 1}`).join(", ")})`;
      })
      .join(", ");

    const sql = `
      INSERT INTO wait_observations (
        ${cols.join(", ")}
      ) VALUES ${placeholders}
      ON CONFLICT ON CONSTRAINT wait_observations_dedupe_key DO NOTHING
    `;

    const result = await client.query(sql, values);
    inserted += result.rowCount || 0;
  }

  return inserted;
}

async function refreshBaselines(client) {
  await client.query("SELECT refresh_wait_baselines()");
}

async function main() {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const parksPayload = await fetchJson("/api/parks");
  const parks = Array.isArray(parksPayload?.parks) ? parksPayload.parks : [];
  if (parks.length === 0) {
    throw new Error("No parks returned by /api/parks");
  }

  const rows = [];
  const failures = [];
  for (const park of parks) {
    const parkId = park?.id;
    if (!parkId) {
      continue;
    }
    const suffix = FORCE_REFRESH ? "?refresh=true" : "";
    try {
      const snapshot = await fetchJson(`/api/parks/${parkId}/live${suffix}`);
      const parkRows = buildRowsFromSnapshot(snapshot);
      rows.push(...parkRows);
    } catch (error) {
      failures.push({ parkId, error: error.message });
    }
  }

  const Client = await loadPgClient();
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  let inserted = 0;
  try {
    await client.query("BEGIN");
    inserted = await insertRows(client, rows);
    await client.query("COMMIT");

    if (REFRESH_BASELINES) {
      await refreshBaselines(client);
    }
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }

  const summary = {
    parksAttempted: parks.length,
    parkFailures: failures.length,
    rowsCollected: rows.length,
    rowsInserted: inserted,
    baselinesRefreshed: REFRESH_BASELINES
  };

  if (failures.length > 0) {
    console.warn("WARN: park fetch failures", JSON.stringify(failures, null, 2));
  }
  console.log("Ingest summary:", JSON.stringify(summary, null, 2));

  if (rows.length === 0) {
    throw new Error("No observations collected; verify BASE_URL and local app/API availability.");
  }
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
});
