export type ParkId =
  | "disney-magic-kingdom"
  | "disney-epcot"
  | "disney-hollywood-studios"
  | "disney-animal-kingdom"
  | "universal-studios-florida"
  | "universal-islands-of-adventure"
  | "universal-epic-universe"
  | "universal-volcano-bay";

export type RideStatus =
  | "OPERATING"
  | "DOWN"
  | "CLOSED"
  | "REFURBISHMENT"
  | "UNKNOWN";

export type QueueType = "STANDBY" | "SINGLE_RIDER" | "VIRTUAL" | "UNKNOWN";

export type ProviderKey = "themeparks" | "queuetimes" | "synthetic";

export interface ParkDefinition {
  id: ParkId;
  name: string;
  resort: "Walt Disney World" | "Universal Orlando";
  aliases: string[];
  providerHints: {
    themeparksEntityId?: string;
    queueTimesParkId?: string;
  };
  headlineAttractions: string[];
}

export interface LiveAttractionState {
  attractionId: string;
  name: string;
  land?: string;
  status: RideStatus;
  waitMinutes: number | null;
  queueType: QueueType;
  sourceUpdatedAt: string;
  ingestedAt: string;
  provider: ProviderKey;
}

export interface ParkLiveSummary {
  openCount: number;
  downCount: number;
  averageWaitMinutes: number | null;
  shortestWait: { name: string; minutes: number } | null;
  longestWait: { name: string; minutes: number } | null;
}

export interface ParkLiveSnapshot {
  parkId: ParkId;
  parkName: string;
  provider: ProviderKey;
  sourceUpdatedAt: string;
  ingestedAt: string;
  freshnessSeconds: number;
  stale: boolean;
  degradedReason?: string;
  attractions: LiveAttractionState[];
  summary: ParkLiveSummary;
}

export interface PlannerStep {
  stepId: string;
  attractionId: string;
  attractionName: string;
  targetWindowStart: string;
  targetWindowEnd: string;
  expectedWait: number | null;
  reason: string;
}

export interface DayPlan {
  planId: string;
  parkId: ParkId;
  generatedAt: string;
  steps: PlannerStep[];
}

export type WaitBaselineConfidence = "HIGH" | "MEDIUM" | "LOW";
export type WaitBaselineSource = "bucket" | "hour" | "global" | "fallback";

export interface WaitOpportunityEntry {
  attractionId: string;
  attractionName: string;
  land?: string;
  currentWaitMinutes: number;
  typicalWaitMinutes: number;
  deltaMinutes: number;
  deltaPercent: number;
  confidence: WaitBaselineConfidence;
  baselineSource: WaitBaselineSource;
  score: number;
  reliabilityRisk: number;
  trendPoints: number[];
}

export interface WaitOpportunitySnapshot {
  parkId: ParkId;
  generatedAt: string;
  hero: WaitOpportunityEntry | null;
  betterThanUsual: WaitOpportunityEntry[];
  worseThanUsual: WaitOpportunityEntry[];
  insight: string;
}

export type ProactiveNudgeType = "WAIT_DROP" | "BEST_MOVE" | "CLOSURE";

export interface ProactiveNudge {
  id: string;
  parkId: ParkId;
  type: ProactiveNudgeType;
  title: string;
  message: string;
  attractionId?: string;
  attractionName?: string;
  previousWaitMinutes?: number | null;
  currentWaitMinutes?: number | null;
  priority: number;
  createdAt: string;
}
