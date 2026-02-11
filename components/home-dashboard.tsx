"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ParkLiveSnapshot,
  ProactiveNudge,
  WaitOpportunityEntry,
  WaitOpportunitySnapshot
} from "@/lib/types/park";
import { PixieLoader } from "@/components/pixie-loader";

type ParkOption = {
  id: string;
  name: string;
  resort: string;
};

type LiveApiResponse = Omit<ParkLiveSnapshot, "parkId"> & { parkId: string };
type OpportunityApiResponse = WaitOpportunitySnapshot & {
  dataFreshness?: {
    provider: string;
    sourceUpdatedAt: string;
    ageSeconds: number;
    stale: boolean;
  };
};

function waitTone(wait: number | null): "low" | "mid" | "high" {
  if (wait === null) {
    return "mid";
  }
  if (wait <= 20) {
    return "low";
  }
  if (wait <= 45) {
    return "mid";
  }
  return "high";
}

function formatDeltaBadge(entry: WaitOpportunityEntry): string {
  const minuteSign = entry.deltaMinutes > 0 ? "+" : "";
  const percentSign = entry.deltaPercent > 0 ? "+" : "";
  return `${minuteSign}${entry.deltaMinutes}m (${percentSign}${entry.deltaPercent}%) vs typical`;
}

function confidenceClass(confidence: WaitOpportunityEntry["confidence"]): string {
  if (confidence === "HIGH") {
    return "border-emerald-300/40 bg-emerald-500/10 text-emerald-100";
  }
  if (confidence === "MEDIUM") {
    return "border-cyan-300/40 bg-cyan-500/10 text-cyan-100";
  }
  return "border-amber-300/40 bg-amber-500/10 text-amber-100";
}

function TrendSparkline({
  points,
  stroke
}: {
  points: number[];
  stroke: string;
}) {
  if (points.length < 2) {
    return <div className="h-10 w-full rounded-xl bg-slate-950/40" />;
  }

  const width = 160;
  const height = 40;
  const padding = 4;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(1, max - min);

  const polyline = points
    .map((point, index) => {
      const x = padding + (index / Math.max(1, points.length - 1)) * (width - padding * 2);
      const y = height - padding - ((point - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-10 w-full">
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polyline}
      />
    </svg>
  );
}

function AnimatedWaitNumber({ value }: { value: number | null }) {
  const [display, setDisplay] = useState<number | null>(value);

  useEffect(() => {
    if (value === null) {
      setDisplay(null);
      return;
    }
    if (display === null) {
      setDisplay(value);
      return;
    }

    const start = display;
    const delta = value - start;
    if (delta === 0) {
      return;
    }

    const steps = Math.min(14, Math.max(6, Math.abs(delta)));
    let frame = 0;
    const timer = window.setInterval(() => {
      frame += 1;
      const next = Math.round(start + (delta * frame) / steps);
      setDisplay(next);
      if (frame >= steps) {
        window.clearInterval(timer);
      }
    }, 28);

    return () => window.clearInterval(timer);
  }, [value, display]);

  if (display === null) {
    return <span>--</span>;
  }
  return <span>{display}</span>;
}

function WaitProgressRing({ wait }: { wait: number | null }) {
  const value = wait ?? 0;
  const ratio = Math.max(0.05, Math.min(1, value / 120));
  const color = value <= 20 ? "#6EE7B7" : value <= 45 ? "#FCD34D" : "#FCA5A5";
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10">
      <circle cx="20" cy="20" r="16" stroke="rgba(255,255,255,0.15)" strokeWidth="4" fill="none" />
      <circle
        cx="20"
        cy="20"
        r="16"
        stroke={color}
        strokeWidth="4"
        fill="none"
        strokeDasharray={`${ratio * 100} 100`}
        strokeLinecap="round"
        transform="rotate(-90 20 20)"
      />
    </svg>
  );
}

export function HomeDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const parkFromQuery = searchParams.get("park");

  const [parks, setParks] = useState<ParkOption[]>([]);
  const [selectedParkId, setSelectedParkId] = useState<string>("");
  const [snapshot, setSnapshot] = useState<LiveApiResponse | null>(null);
  const [opportunities, setOpportunities] = useState<OpportunityApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [proactiveEnabled, setProactiveEnabled] = useState(false);
  const [nudges, setNudges] = useState<ProactiveNudge[]>([]);
  const [nudgesLoading, setNudgesLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [parksRes, proactiveRes] = await Promise.all([
        fetch("/api/parks", { cache: "no-store" }),
        fetch("/api/proactive/toggle", { cache: "no-store" })
      ]);

      if (!mounted) {
        return;
      }

      const parksJson = await parksRes.json();
      const nextParks = parksJson.parks as ParkOption[];
      setParks(nextParks);

      if (nextParks.length > 0) {
        const stored = localStorage.getItem("selected_park_id");
        const preferred = [parkFromQuery, stored, nextParks[0].id].find(
          (candidate) => candidate && nextParks.some((park) => park.id === candidate)
        );
        if (preferred) {
          setSelectedParkId(preferred);
          localStorage.setItem("selected_park_id", preferred);
        }
      }

      const proactiveJson = await proactiveRes.json();
      setProactiveEnabled(Boolean(proactiveJson.enabled));
    }

    load().catch(() => {
      // Preserve UI even if boot calls fail.
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!parkFromQuery || !parks.some((park) => park.id === parkFromQuery)) {
      return;
    }
    setSelectedParkId(parkFromQuery);
    localStorage.setItem("selected_park_id", parkFromQuery);
  }, [parkFromQuery, parks]);

  useEffect(() => {
    if (!selectedParkId) {
      return;
    }

    let mounted = true;

    async function loadLive(refresh = false) {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const querySuffix = refresh ? "?refresh=true" : "";
      const [liveResponse, opportunitiesResponse] = await Promise.all([
        fetch(`/api/parks/${selectedParkId}/live${querySuffix}`, {
          cache: "no-store"
        }),
        fetch(`/api/parks/${selectedParkId}/opportunities${querySuffix}`, {
          cache: "no-store"
        })
      ]);
      const liveJson = await liveResponse.json();
      const opportunitiesJson = await opportunitiesResponse.json();

      if (mounted) {
        setSnapshot(liveJson as LiveApiResponse);
        setOpportunities(opportunitiesJson as OpportunityApiResponse);
        setLoading(false);
        setRefreshing(false);
      }
    }

    loadLive().catch(() => {
      setLoading(false);
      setRefreshing(false);
    });

    const interval = window.setInterval(() => {
      loadLive().catch(() => undefined);
    }, 45_000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [selectedParkId]);

  useEffect(() => {
    if (!proactiveEnabled || !selectedParkId) {
      setNudges([]);
      return;
    }

    let mounted = true;

    async function loadNudges() {
      setNudgesLoading(true);
      const response = await fetch(`/api/proactive/nudges?parkId=${selectedParkId}`, {
        cache: "no-store"
      });
      const json = await response.json();
      if (!mounted) {
        return;
      }
      setNudges(Array.isArray(json.nudges) ? (json.nudges as ProactiveNudge[]) : []);
      setNudgesLoading(false);
    }

    loadNudges().catch(() => {
      setNudgesLoading(false);
    });

    const interval = window.setInterval(() => {
      loadNudges().catch(() => undefined);
    }, 60_000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [proactiveEnabled, selectedParkId]);

  const recommendation = useMemo(() => {
    if (!snapshot) {
      return null;
    }

    return [...snapshot.attractions]
      .filter((item) => item.status === "OPERATING" && typeof item.waitMinutes === "number")
      .sort((a, b) => (a.waitMinutes ?? 999) - (b.waitMinutes ?? 999))[0] ?? null;
  }, [snapshot]);

  const heroOpportunity = opportunities?.hero ?? null;
  const betterThanUsual = opportunities?.betterThanUsual ?? [];
  const worseThanUsual = opportunities?.worseThanUsual ?? [];

  async function toggleProactive() {
    const next = !proactiveEnabled;
    setProactiveEnabled(next);
    await fetch("/api/proactive/toggle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: next })
    }).catch(() => {
      setProactiveEnabled(!next);
    });
  }

  async function refreshLiveNow() {
    if (!selectedParkId) {
      return;
    }
    setRefreshing(true);
    const [liveResponse, opportunitiesResponse] = await Promise.all([
      fetch(`/api/parks/${selectedParkId}/live?refresh=true`, {
        cache: "no-store"
      }),
      fetch(`/api/parks/${selectedParkId}/opportunities?refresh=true`, {
        cache: "no-store"
      })
    ]);
    const liveJson = await liveResponse.json();
    const opportunitiesJson = await opportunitiesResponse.json();
    setSnapshot(liveJson as LiveApiResponse);
    setOpportunities(opportunitiesJson as OpportunityApiResponse);
    if (proactiveEnabled) {
      const nudgeResponse = await fetch(`/api/proactive/nudges?parkId=${selectedParkId}`, {
        cache: "no-store"
      });
      const nudgeJson = await nudgeResponse.json();
      setNudges(Array.isArray(nudgeJson.nudges) ? (nudgeJson.nudges as ProactiveNudge[]) : []);
    }
    setRefreshing(false);
  }

  function applyParkSelection(nextParkId: string) {
    setSelectedParkId(nextParkId);
    localStorage.setItem("selected_park_id", nextParkId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("park", nextParkId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <section className="space-y-5">
      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="glass-card sparkle rounded-3xl p-5 shadow-glow md:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-soft">Best Move Now</p>
              <h2 className="mt-1 text-2xl font-semibold md:text-3xl">
                {heroOpportunity?.attractionName ?? recommendation?.name ?? "Choosing your best next move..."}
              </h2>
            </div>
            <span className="pill px-4 py-2 text-sm">
              {heroOpportunity
                ? `${heroOpportunity.currentWaitMinutes}m now`
                : recommendation?.waitMinutes
                  ? `${recommendation.waitMinutes}m now`
                  : "Waiting for live queue data"}
            </span>
          </div>
          {heroOpportunity ? (
            <div className="mt-4 space-y-2 text-sm">
              <p className="text-soft">
                Typical for this time: <span className="text-white">{heroOpportunity.typicalWaitMinutes}m</span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-xs ${
                    heroOpportunity.deltaMinutes <= 0
                      ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-100"
                      : "border-rose-300/40 bg-rose-500/10 text-rose-100"
                  }`}
                >
                  {formatDeltaBadge(heroOpportunity)}
                </span>
                <span className={`rounded-full border px-3 py-1 text-xs ${confidenceClass(heroOpportunity.confidence)}`}>
                  Confidence: {heroOpportunity.confidence}
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-4 max-w-xl text-sm text-soft">
              {recommendation
                ? "Opportunity engine is building history. Showing best current throughput meanwhile."
                : "This card updates automatically as live queues change."}
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="button-primary px-4 py-2 text-sm font-medium"
              onClick={refreshLiveNow}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh now"}
            </button>
            <button
              type="button"
              className="button-ghost px-4 py-2 text-sm"
              onClick={toggleProactive}
            >
              Proactive mode: {proactiveEnabled ? "On" : "Off"}
            </button>
            {(refreshing || loading) ? (
              <div className="flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100">
                <PixieLoader size={22} />
                Pixie dust recalculating...
              </div>
            ) : null}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.07, ease: "easeOut" }}
          className="glass-card rounded-3xl p-5 shadow-card"
        >
          <p className="text-xs uppercase tracking-[0.22em] text-soft">Current Context</p>
          <label className="mt-4 block text-xs uppercase tracking-[0.18em] text-soft">Park</label>
          <select
            value={selectedParkId}
            onChange={(event) => applyParkSelection(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/15 bg-slate-950/50 px-3 py-2 text-sm text-white outline-none ring-accent-0/40 focus:ring"
          >
            {parks.map((park) => (
              <option key={park.id} value={park.id}>
                {park.name}
              </option>
            ))}
          </select>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-slate-900/45 p-3">
              <p className="text-soft">Open</p>
              <p className="mt-1 text-xl font-semibold">{snapshot?.summary.openCount ?? "-"}</p>
            </div>
            <div className="rounded-2xl bg-slate-900/45 p-3">
              <p className="text-soft">Down</p>
              <p className="mt-1 text-xl font-semibold">{snapshot?.summary.downCount ?? "-"}</p>
            </div>
            <div className="col-span-2 rounded-2xl bg-slate-900/45 p-3">
              <p className="text-soft">Freshness</p>
              <p className="mt-1 text-sm">
                {snapshot
                  ? `Updated ${Math.max(0, Math.round(snapshot.freshnessSeconds / 60))}m ago via ${snapshot.provider}`
                  : "Loading feed"}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1, ease: "easeOut" }}
        className="glass-card rounded-3xl p-4 shadow-card md:p-5"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Relative Wait Scorecard</h3>
          <span className="pill px-3 py-1 text-xs text-soft">
            {opportunities?.insight ?? "Building historical baseline..."}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium text-emerald-200">Better Than Usual</p>
            {betterThanUsual.length === 0 ? (
              <p className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-100">
                No standout positive anomalies yet.
              </p>
            ) : (
              betterThanUsual.map((entry) => (
                <div
                  key={`better-${entry.attractionId}`}
                  className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-white">{entry.attractionName}</p>
                    <span className="text-xs text-emerald-100">{entry.currentWaitMinutes}m now</span>
                  </div>
                  <p className="mt-1 text-xs text-emerald-100/90">
                    Typical {entry.typicalWaitMinutes}m • {formatDeltaBadge(entry)}
                  </p>
                  <div className="mt-2">
                    <TrendSparkline points={entry.trendPoints} stroke="#6EE7B7" />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-rose-200">Worse Than Usual</p>
            {worseThanUsual.length === 0 ? (
              <p className="rounded-2xl border border-rose-300/20 bg-rose-500/10 px-3 py-3 text-sm text-rose-100">
                No major negative anomalies right now.
              </p>
            ) : (
              worseThanUsual.map((entry) => (
                <div
                  key={`worse-${entry.attractionId}`}
                  className="rounded-2xl border border-rose-300/20 bg-rose-500/10 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-white">{entry.attractionName}</p>
                    <span className="text-xs text-rose-100">{entry.currentWaitMinutes}m now</span>
                  </div>
                  <p className="mt-1 text-xs text-rose-100/90">
                    Typical {entry.typicalWaitMinutes}m • {formatDeltaBadge(entry)}
                  </p>
                  <div className="mt-2">
                    <TrendSparkline points={entry.trendPoints} stroke="#FCA5A5" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.12, ease: "easeOut" }}
        className="glass-card rounded-3xl p-4 shadow-card md:p-5"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Live Queue Board</h3>
          {snapshot?.degradedReason ? (
            <span className="pill px-3 py-1 text-xs text-amber-200">{snapshot.degradedReason}</span>
          ) : (
            <span className="pill px-3 py-1 text-xs text-soft">Queue-focused attractions</span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-soft">
            <PixieLoader size={24} />
            Loading live operations...
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {snapshot?.attractions.slice(0, 12).map((attraction, index) => (
              <motion.div
                key={`${attraction.attractionId}-${index}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
                className="rounded-2xl border border-white/10 bg-slate-950/40 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-white">{attraction.name}</p>
                    <p className="text-xs text-soft">{attraction.land ?? "Live attraction"}</p>
                  </div>
                  <span className="pill px-3 py-1 text-xs">
                    {attraction.status}
                  </span>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div className="flex items-end gap-2">
                    <p
                      className={`text-2xl font-semibold transition-colors ${
                        waitTone(attraction.waitMinutes) === "low"
                          ? "text-emerald-200"
                          : waitTone(attraction.waitMinutes) === "mid"
                            ? "text-amber-100"
                            : "text-rose-200"
                      }`}
                    >
                      <AnimatedWaitNumber value={attraction.waitMinutes} />m
                    </p>
                    <WaitProgressRing wait={attraction.waitMinutes} />
                  </div>
                  <p className="text-xs text-soft">{attraction.queueType}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.16, ease: "easeOut" }}
        className="glass-card rounded-3xl p-4 shadow-card md:p-5"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Proactive Nudges</h3>
          <span className="pill px-3 py-1 text-xs">{proactiveEnabled ? "Active" : "Off"}</span>
        </div>

        {!proactiveEnabled ? (
          <p className="text-sm text-soft">Enable proactive mode to receive wait-drop and disruption alerts.</p>
        ) : nudgesLoading ? (
          <div className="flex items-center gap-2 text-sm text-soft">
            <PixieLoader size={22} />
            Checking for meaningful updates...
          </div>
        ) : nudges.length === 0 ? (
          <p className="text-sm text-soft">No high-impact nudges right now. You are in a stable operating window.</p>
        ) : (
          <div className="space-y-2">
            {nudges.map((nudge) => (
              <div
                key={nudge.id}
                className="rounded-2xl border border-cyan-200/20 bg-cyan-500/10 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-white">{nudge.title}</p>
                  <span className="pill px-3 py-1 text-xs">{nudge.type}</span>
                </div>
                <p className="mt-2 text-sm text-slate-100">{nudge.message}</p>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </section>
  );
}
