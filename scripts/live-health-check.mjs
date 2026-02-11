#!/usr/bin/env node

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const MAX_SYNTHETIC = Number(process.env.MAX_SYNTHETIC_PARKS ?? 0);
const MAX_STALE = Number(process.env.MAX_STALE_PARKS ?? 2);

async function main() {
  const response = await fetch(`${BASE_URL}/api/health/live`);
  if (!response.ok) {
    throw new Error(`Health endpoint failed (${response.status})`);
  }

  const payload = await response.json();
  const syntheticCount = payload?.summary?.syntheticCount ?? 999;
  const staleCount = payload?.summary?.staleCount ?? 999;

  const checks = [
    {
      label: "syntheticCount",
      actual: syntheticCount,
      max: MAX_SYNTHETIC
    },
    {
      label: "staleCount",
      actual: staleCount,
      max: MAX_STALE
    }
  ];

  let failed = false;
  for (const check of checks) {
    if (check.actual > check.max) {
      failed = true;
      console.error(`FAIL: ${check.label}=${check.actual} exceeds max ${check.max}`);
    } else {
      console.log(`PASS: ${check.label}=${check.actual} (max ${check.max})`);
    }
  }

  console.log("Health summary:", JSON.stringify(payload.summary, null, 2));

  if (failed) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
});
