#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DATABASE_URL = process.env.DATABASE_URL;
const SCHEMA_FILE = process.env.WAIT_HISTORY_SCHEMA_FILE || path.join(process.cwd(), "db", "wait-history-schema.sql");

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

  const sql = await fs.readFile(SCHEMA_FILE, "utf8");
  const Client = await loadPgClient();
  const client = new Client({ connectionString: DATABASE_URL });

  await client.connect();
  try {
    await client.query(sql);
    console.log(`PASS: applied wait-history schema from ${SCHEMA_FILE}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
});
