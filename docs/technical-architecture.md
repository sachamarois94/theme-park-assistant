# Theme Park Assistant V1 Technical Architecture

## 1) Architecture Goals

- Web-first, app-ready foundation.
- Near real-time operations data for Orlando Disney + Universal parks.
- Clean separation between UI, assistant orchestration, and data providers.
- Easy path to native app reuse in v2.

## 2) System Overview

Components:
1. Web Client (Next.js PWA)
2. API Gateway (BFF)
3. Assistant Orchestrator
4. Park Data Service (provider adapters + normalization + cache)
5. Storage (ephemeral session + analytics/events)
6. Background Pollers/Workers

Data flow:
1. Pollers fetch provider updates on schedule.
2. Adapters normalize payloads into canonical schema.
3. Cache stores latest snapshots + TTL metadata.
4. Assistant tools query canonical read APIs.
5. Client receives answers + rationale + freshness timestamp.

## 3) Provider Strategy (Queue/Wait Data)

V1 source plan:
- Primary provider: ThemeParks Wiki API (`https://api.themeparks.wiki/v1`).
- Secondary fallback: Queue-Times API (`https://queue-times.com/pages/api`).

Why dual-source:
- Reduces outage risk and stale-data exposure.
- Allows per-park fallback when one feed degrades.

Important constraints:
- Community/unofficial ecosystem risk exists for park operations data.
- Build adapters as swappable modules to migrate to licensed feeds later if needed.

Freshness policy:
- Poll every 60 seconds per destination (configurable).
- Mark data stale when source timestamp exceeds configured freshness SLA.
- UI always shows "Last updated" and degraded-state banners.

## 4) Canonical Data Model

Core entities:
- `Destination`: provider-agnostic park grouping.
- `Park`: single park record.
- `Attraction`: ride/show metadata.
- `LiveAttractionState`:
  - `status` (`OPERATING`, `DOWN`, `CLOSED`, `REFURBISHMENT`, `UNKNOWN`)
  - `waitMinutes` (nullable)
  - `queueType` (`STANDBY`, `SINGLE_RIDER`, `VIRTUAL`)
  - `sourceUpdatedAt`
  - `ingestedAt`
  - `provider`
- `PlannerStep`:
  - `attractionId`
  - `targetWindowStart/End`
  - `expectedWait`
  - `reason`

Session model (v1 guest):
- `SessionContext`:
  - current park
  - proactive enabled
  - temporary preference toggles (e.g., thrill/family pace)
  - current plan snapshot

## 5) API Surface (Internal + Client)

Client APIs:
- `GET /api/parks`
- `GET /api/parks/:parkId/live`
- `POST /api/chat`
- `POST /api/plan/generate`
- `POST /api/plan/replan`
- `POST /api/proactive/toggle`

Assistant tool APIs:
- `tool.get_wait_times(parkId, filters)`
- `tool.suggest_next_best(parkId, context)`
- `tool.build_day_plan(parkId, constraints)`
- `tool.replan_after_change(planId, event)`

Response contract requirements:
- Include `dataFreshness` block (`sourceUpdatedAt`, `ageSeconds`, `provider`).
- Include `alternatives` for recommendation outputs.

## 6) Recommendation Engine (V1 Heuristic)

Rank score inputs:
- Current wait time.
- Wait trend delta (if available).
- Distance proxy (land/zone level initially).
- Attraction status risk.
- User pace toggle (relaxed vs maximize rides).

Output:
- Top recommendation.
- 2 fallback alternatives.
- "Go now" urgency indicator when delta favors immediate move.

## 7) Reliability and Degraded Modes

Failure handling:
1. Provider timeout:
   - serve last-known-good with stale banner.
2. Single park feed failure:
   - fallback provider for affected park.
3. Full ingest failure:
   - disable proactive nudges and explain degradation in UI.

Observability:
- Metrics:
  - provider success rate
  - ingest latency
  - stale read rate
  - chat tool failure rate
- Alerts on prolonged stale data.

## 8) Security and Privacy

- Guest sessions via secure, short-lived session tokens.
- No PII required for v1 core functionality.
- Store minimal event analytics with anonymized identifiers.
- Apply rate limits on chat and live endpoints.

## 9) Deployment Topology

- Frontend + BFF on Vercel (or equivalent).
- Worker jobs on serverless cron/queue worker platform.
- Redis (or equivalent) for hot live-data cache.
- Postgres (or equivalent) for analytics/events and future accounts.

### Production Wait-History Pipeline

Storage objects:
- `wait_observations` table for 5-minute ingest rows.
- `wait_baseline_15m` materialized view for main baseline lookup.
- `wait_baseline_hour` and `wait_baseline_global` materialized views as fallback tiers.

Worker cadence:
1. Ingest worker every 5 minutes (`scripts/ingest-live-to-db.mjs`).
2. Baseline refresh worker every 15 minutes (`scripts/refresh-wait-baselines.mjs`).
3. Retention prune each refresh run via `prune_wait_observations()` (default 120 days).

## 10) Delivery Plan

Phase 1:
- Canonical schema + provider adapters + live endpoints.

Phase 2:
- Chat orchestration + recommendation tools.

Phase 3:
- Day planner + proactive mode + pricing concept pages.

Phase 4:
- Hardening (monitoring, error budgets, perf passes, PWA polish).
