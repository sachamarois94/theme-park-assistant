#!/usr/bin/env node

import process from "node:process";

const DATABASE_URL = process.env.DATABASE_URL;
const PRUNE_RETENTION_DAYS = Number(process.env.PRUNE_RETENTION_DAYS ?? 120);

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

async function main() {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const Client = await loadPgClient();
  const client = new Client({ connectionString: DATABASE_URL });

  await client.connect();
  try {
    const refreshStarted = Date.now();
    await client.query("SELECT refresh_wait_baselines()");

    let removed = 0;
    if (PRUNE_RETENTION_DAYS > 0) {
      const retention = `${PRUNE_RETENTION_DAYS} days`;
      const result = await client.query("SELECT prune_wait_observations($1::interval) AS removed", [retention]);
      removed = Number(result.rows?.[0]?.removed ?? 0);
    }

    const elapsedMs = Date.now() - refreshStarted;
    const summary = {
      baselinesRefreshed: true,
      pruneRetentionDays: PRUNE_RETENTION_DAYS,
      observationsRemoved: removed,
      elapsedMs
    };

    console.log("Refresh summary:", JSON.stringify(summary, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
});
