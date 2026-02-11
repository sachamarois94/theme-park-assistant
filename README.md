# Theme Park Assistant

Dark-first, mobile-first Next.js PWA for Orlando Disney + Universal operations guidance.

## What is included

- V1 app shell with Home, Plan, Chat, and Pricing pages.
- PWA setup (manifest + service worker registration).
- Live data API endpoints:
  - `GET /api/parks`
  - `GET /api/parks/:parkId/live`
  - `GET /api/parks/:parkId/opportunities`
  - `POST /api/chat`
  - `POST /api/plan/generate`
  - `POST /api/plan/replan`
  - `GET|POST /api/proactive/toggle`
  - `GET /api/proactive/nudges?parkId=...`
- Queue-time adapter strategy:
  - Primary: ThemeParks Wiki API
  - Fallback: Queue-Times API

## Quick start

Prerequisite:
- Use Node `20.x`, `22.x`, or `24.x` (Node `25.x` is not supported for this project).
- If you do not use `nvm`, run with Node 22 directly:

```bash
npx -y node@22 ./node_modules/next/dist/bin/next dev
```

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

3. (Optional but recommended) Fill in known provider IDs for each park.

   Tip: for production reliability, set explicit provider IDs for all parks in `.env.local`.

4. Run development server:

```bash
npm run dev
```

5. Open the website:

`http://localhost:3000`

If UI looks stale/unstyled in development:

```bash
rm -rf .next
npm run dev
```

And hard-refresh your browser (`Cmd+Shift+R`). The app now auto-unregisters service workers in dev.

## Notes on queue data

- If provider IDs are not configured, the app attempts park-name discovery.
- If both providers fail, APIs return a synthetic snapshot with a `degradedReason` for UI continuity.
- For production, replace synthetic fallback with strict degraded mode and monitor provider health.

## Historical wait baselines

The recommendation engine now uses relative wait opportunities:
- Typical baseline by `park + attraction + day-of-week + 15-minute bucket`
- Fallbacks: same attraction/hour, then attraction global median
- Output: best move hero + better/worse-than-usual scorecards

Local/development storage:
- Uses a compact bounded history store in `.data/wait-history.json` (not full raw logs)
- Bounded arrays keep memory and disk growth controlled

Production recommendation:
- Move history persistence to managed storage (Postgres/Timescale/ClickHouse/BigQuery)
- Keep this same scoring logic in the app layer, but query baselines from the database

## Production DB Pipeline (New)

This repo now includes a production-ready Postgres schema + ingestion worker.

Files:
- `db/wait-history-schema.sql`
- `scripts/setup-wait-history-db.mjs`
- `scripts/ingest-live-to-db.mjs`
- `scripts/refresh-wait-baselines.mjs`

### 1) Prepare database objects

Set `DATABASE_URL` in `.env.local`, then run:

```bash
npm run db:prepare:wait-history
```

This creates:
- `wait_observations` table (deduped raw observations)
- materialized views:
  - `wait_baseline_15m`
  - `wait_baseline_hour`
  - `wait_baseline_global`
- helper SQL functions:
  - `refresh_wait_baselines()`
  - `prune_wait_observations(retention interval)`

### 2) Run ingestion worker

Keep app/API running, then ingest snapshots:

```bash
npm run db:ingest:wait-history
```

What it does:
- calls `/api/parks`
- calls `/api/parks/:parkId/live?refresh=true`
- inserts normalized rows into Postgres with conflict-safe dedupe

### 3) Refresh baselines + retention

```bash
npm run db:refresh:wait-baselines
```

This refreshes all baseline materialized views and prunes old history by `PRUNE_RETENTION_DAYS` (default `120`).

### 4) Recommended production schedules

- Ingest job: every 5 minutes
- Baseline refresh + prune: every 15 minutes

macOS one-command installer:

```bash
npm run db:cron:install:macos
```

This installs cron jobs that run:

```bash
/bin/bash scripts/jobs/ingest-wait-history.sh
/bin/bash scripts/jobs/refresh-wait-baselines.sh
```

Useful checks:

```bash
crontab -l | sed -n '/THEME_PARK_ASSISTANT_BEGIN/,/THEME_PARK_ASSISTANT_END/p'
tail -f .logs/cron/ingest.log
tail -f .logs/cron/refresh.log
```

Uninstall managed cron jobs:

```bash
npm run db:cron:uninstall:macos
```

Environment variables used by workers:
- `DATABASE_URL` (required)
- `BASE_URL` (default `http://localhost:3000`)
- `INGEST_REQUEST_TIMEOUT_MS` (default `25000`)
- `INGEST_BATCH_SIZE` (default `250`)
- `INGEST_FORCE_REFRESH` (default `1`)
- `INGEST_REFRESH_BASELINES` (default `0`)
- `PRUNE_RETENTION_DAYS` (default `120`)

## Validation commands

Run these while `npm run dev` is active:

```bash
npm run smoke:api
```

```bash
npm run health:live
```

Optional thresholds for health check:

```bash
MAX_SYNTHETIC_PARKS=0 MAX_STALE_PARKS=2 npm run health:live
```

## Proactive nudges

- Toggle with `POST /api/proactive/toggle`.
- Fetch recommendations/alerts with `GET /api/proactive/nudges?parkId=...`.
- Nudge engine emits:
  - wait-drop opportunities
  - best-move prompts
  - operating-status closures
- Quiet hours and cooldown windows are configurable in `.env.local`.
- Default v1 settings are tuned aggressively to surface more nudges (quiet hours disabled unless configured).

## Project structure

- `/app` - Next.js App Router pages and API routes
- `/components` - UI components
- `/lib/config` - park definitions
- `/lib/providers` - provider adapters and normalization utilities
- `/lib/data` - live snapshot caching, planning, and recommendation helpers
- `/docs` - PRD, architecture, UI blueprint, and data strategy
