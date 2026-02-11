import { recommendNext } from "@/lib/data/live-data-service";
import { ParkLiveSnapshot, ProactiveNudge } from "@/lib/types/park";

const QUIET_HOURS_START = Number(process.env.PROACTIVE_QUIET_HOURS_START ?? 0);
const QUIET_HOURS_END = Number(process.env.PROACTIVE_QUIET_HOURS_END ?? 0);
const WAIT_DROP_MIN_FROM = Number(process.env.PROACTIVE_WAIT_DROP_MIN_FROM ?? 20);
const WAIT_DROP_MIN_DELTA = Number(process.env.PROACTIVE_WAIT_DROP_MIN_DELTA ?? 8);
const BEST_MOVE_MAX_WAIT = Number(process.env.PROACTIVE_BEST_MOVE_MAX_WAIT ?? 45);
const NUDGE_COOLDOWN_SECONDS = Number(process.env.PROACTIVE_NUDGE_COOLDOWN_SECONDS ?? 240);
const NUDGE_LIMIT = Number(process.env.PROACTIVE_NUDGE_LIMIT ?? 4);

type HistoricalAttractionState = {
  waitMinutes: number | null;
  status: string;
};

const previousStateByPark = new Map<string, Map<string, HistoricalAttractionState>>();
const recentNudgeTimes = new Map<string, number>();

function nowEpoch(): number {
  return Date.now();
}

function inQuietHours(date = new Date()): boolean {
  if (QUIET_HOURS_START === QUIET_HOURS_END) {
    return false;
  }

  const hour = date.getHours();

  // Cross-midnight window support.
  if (QUIET_HOURS_START > QUIET_HOURS_END) {
    return hour >= QUIET_HOURS_START || hour < QUIET_HOURS_END;
  }
  return hour >= QUIET_HOURS_START && hour < QUIET_HOURS_END;
}

function buildNudgeKey(parkId: string, type: string, attractionId?: string): string {
  return `${parkId}:${type}:${attractionId ?? "park"}`;
}

function shouldEmit(parkId: string, type: string, attractionId?: string): boolean {
  const key = buildNudgeKey(parkId, type, attractionId);
  const lastTime = recentNudgeTimes.get(key);
  if (!lastTime) {
    return true;
  }
  return nowEpoch() - lastTime > NUDGE_COOLDOWN_SECONDS * 1000;
}

function markEmitted(parkId: string, type: string, attractionId?: string) {
  recentNudgeTimes.set(buildNudgeKey(parkId, type, attractionId), nowEpoch());
}

function updatePreviousState(snapshot: ParkLiveSnapshot) {
  const perAttraction = new Map<string, HistoricalAttractionState>();
  for (const attraction of snapshot.attractions) {
    perAttraction.set(attraction.attractionId, {
      waitMinutes: attraction.waitMinutes,
      status: attraction.status
    });
  }
  previousStateByPark.set(snapshot.parkId, perAttraction);
}

export function generateProactiveNudges(snapshot: ParkLiveSnapshot): ProactiveNudge[] {
  if (inQuietHours()) {
    updatePreviousState(snapshot);
    return [];
  }

  const nowIso = new Date().toISOString();
  const nudges: ProactiveNudge[] = [];
  const previous = previousStateByPark.get(snapshot.parkId);
  const byAttraction = new Map(snapshot.attractions.map((item) => [item.attractionId, item] as const));

  if (previous) {
    for (const [attractionId, prev] of previous) {
      const live = byAttraction.get(attractionId);
      if (!live) {
        continue;
      }

      if (
        typeof prev.waitMinutes === "number" &&
        typeof live.waitMinutes === "number" &&
        prev.waitMinutes >= WAIT_DROP_MIN_FROM &&
        prev.waitMinutes - live.waitMinutes >= WAIT_DROP_MIN_DELTA &&
        shouldEmit(snapshot.parkId, "WAIT_DROP", attractionId)
      ) {
        nudges.push({
          id: `nudge-${snapshot.parkId}-waitdrop-${attractionId}-${Date.now()}`,
          parkId: snapshot.parkId,
          type: "WAIT_DROP",
          title: `${live.name} just got faster`,
          message: `Wait dropped from ${prev.waitMinutes}m to ${live.waitMinutes}m. This is a good move now.`,
          attractionId,
          attractionName: live.name,
          previousWaitMinutes: prev.waitMinutes,
          currentWaitMinutes: live.waitMinutes,
          priority: 90,
          createdAt: nowIso
        });
        markEmitted(snapshot.parkId, "WAIT_DROP", attractionId);
      }

      const movedToDown =
        prev.status === "OPERATING" &&
        (live.status === "DOWN" || live.status === "CLOSED" || live.status === "REFURBISHMENT");
      if (movedToDown && shouldEmit(snapshot.parkId, "CLOSURE", attractionId)) {
        nudges.push({
          id: `nudge-${snapshot.parkId}-closure-${attractionId}-${Date.now()}`,
          parkId: snapshot.parkId,
          type: "CLOSURE",
          title: `${live.name} is currently unavailable`,
          message: "This ride just transitioned out of operating status. Replan to avoid queue dead time.",
          attractionId,
          attractionName: live.name,
          currentWaitMinutes: live.waitMinutes,
          priority: 100,
          createdAt: nowIso
        });
        markEmitted(snapshot.parkId, "CLOSURE", attractionId);
      }
    }
  }

  const recommendation = recommendNext(snapshot).top;
  if (
    recommendation &&
    typeof recommendation.waitMinutes === "number" &&
    recommendation.waitMinutes <= BEST_MOVE_MAX_WAIT &&
    shouldEmit(snapshot.parkId, "BEST_MOVE", recommendation.attractionId)
  ) {
    nudges.push({
      id: `nudge-${snapshot.parkId}-best-${recommendation.attractionId}-${Date.now()}`,
      parkId: snapshot.parkId,
      type: "BEST_MOVE",
      title: "Strong next move available",
      message: `${recommendation.name} is at ${recommendation.waitMinutes}m. Throughput is favorable if you go now.`,
      attractionId: recommendation.attractionId,
      attractionName: recommendation.name,
      currentWaitMinutes: recommendation.waitMinutes,
      priority: 70,
      createdAt: nowIso
    });
    markEmitted(snapshot.parkId, "BEST_MOVE", recommendation.attractionId);
  }

  updatePreviousState(snapshot);
  return nudges.sort((a, b) => b.priority - a.priority).slice(0, NUDGE_LIMIT);
}
