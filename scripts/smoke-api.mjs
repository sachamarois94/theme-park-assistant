#!/usr/bin/env node

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const REQUIRED_PARKS = 8;

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

async function fetchJson(path, options = undefined) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`Non-JSON response at ${path} (status ${response.status})`);
  }

  if (!response.ok) {
    throw new Error(`Request failed ${path} (${response.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

async function run() {
  console.log(`Running smoke checks against ${BASE_URL}`);

  const parksPayload = await fetchJson("/api/parks");
  const parks = Array.isArray(parksPayload.parks) ? parksPayload.parks : [];
  if (parks.length < REQUIRED_PARKS) {
    fail(`Expected at least ${REQUIRED_PARKS} parks, got ${parks.length}`);
  }

  const liveResults = [];
  for (const park of parks) {
    const live = await fetchJson(`/api/parks/${park.id}/live?refresh=true`);
    liveResults.push(live);

    if (!live.provider) {
      fail(`Missing provider for park ${park.id}`);
    }
    if (!Array.isArray(live.attractions) || live.attractions.length === 0) {
      fail(`No attractions returned for park ${park.id}`);
    }
    if (!live.sourceUpdatedAt) {
      fail(`Missing sourceUpdatedAt for park ${park.id}`);
    }
  }

  const syntheticCount = liveResults.filter((item) => item.provider === "synthetic").length;
  if (syntheticCount > 0) {
    fail(`Synthetic provider returned for ${syntheticCount} parks`);
  }

  const sampleParkId = parks[0]?.id;
  if (!sampleParkId) {
    fail("No parks available to run chat/plan checks.");
    return;
  }

  const chat = await fetchJson("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      parkId: sampleParkId,
      message: "What are wait times like right now?"
    })
  });

  if (typeof chat.reply !== "string" || chat.reply.trim().length === 0) {
    fail("Chat API returned no reply text.");
  }
  if (!chat.dataFreshness?.provider) {
    fail("Chat API missing dataFreshness provider.");
  }

  const generated = await fetchJson("/api/plan/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ parkId: sampleParkId, hours: 8 })
  });

  if (!generated.plan?.steps || generated.plan.steps.length === 0) {
    fail("Plan generate returned no steps.");
  }

  const replanned = await fetchJson("/api/plan/replan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ parkId: sampleParkId, plan: generated.plan })
  });

  if (!replanned.plan?.steps || replanned.plan.steps.length === 0) {
    fail("Plan replan returned no steps.");
  }

  const health = await fetchJson("/api/health/live");
  if (health.summary?.parks < REQUIRED_PARKS) {
    fail("Health endpoint returned fewer parks than expected.");
  }

  const summary = {
    parkCount: parks.length,
    syntheticCount,
    staleCount: liveResults.filter((item) => item.stale).length,
    sampleParkId,
    healthOk: Boolean(health.ok)
  };
  console.log("Smoke summary:", JSON.stringify(summary, null, 2));

  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  }
  console.log("PASS: smoke checks complete");
}

run().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
});
