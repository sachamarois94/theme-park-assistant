# Theme Park Assistant

Dark-first, mobile-first Next.js PWA for Orlando Disney + Universal operations guidance.

## What is included

- V1 app shell with Home, Plan, Chat, and Pricing pages.
- PWA setup (manifest + service worker registration).
- Live data API endpoints:
  - `GET /api/parks`
  - `GET /api/parks/:parkId/live`
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
