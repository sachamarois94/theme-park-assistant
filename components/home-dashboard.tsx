"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ParkLiveSnapshot, ProactiveNudge } from "@/lib/types/park";

type ParkOption = {
  id: string;
  name: string;
  resort: string;
};

type LiveApiResponse = Omit<ParkLiveSnapshot, "parkId"> & { parkId: string };

export function HomeDashboard() {
  const [parks, setParks] = useState<ParkOption[]>([]);
  const [selectedParkId, setSelectedParkId] = useState<string>("");
  const [snapshot, setSnapshot] = useState<LiveApiResponse | null>(null);
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
        setSelectedParkId(nextParks[0].id);
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

      const response = await fetch(`/api/parks/${selectedParkId}/live${refresh ? "?refresh=true" : ""}`, {
        cache: "no-store"
      });
      const json = await response.json();

      if (mounted) {
        setSnapshot(json as LiveApiResponse);
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
    const response = await fetch(`/api/parks/${selectedParkId}/live?refresh=true`, {
      cache: "no-store"
    });
    const json = await response.json();
    setSnapshot(json as LiveApiResponse);
    if (proactiveEnabled) {
      const nudgeResponse = await fetch(`/api/proactive/nudges?parkId=${selectedParkId}`, {
        cache: "no-store"
      });
      const nudgeJson = await nudgeResponse.json();
      setNudges(Array.isArray(nudgeJson.nudges) ? (nudgeJson.nudges as ProactiveNudge[]) : []);
    }
    setRefreshing(false);
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
              <p className="text-xs uppercase tracking-[0.22em] text-soft">Live Recommendation</p>
              <h2 className="mt-1 text-2xl font-semibold md:text-3xl">
                {recommendation ? recommendation.name : "Choosing your best next move..."}
              </h2>
            </div>
            <span className="pill px-4 py-2 text-sm">
              {recommendation?.waitMinutes ? `${recommendation.waitMinutes} min wait` : "Waiting for live queue data"}
            </span>
          </div>
          <p className="mt-4 max-w-xl text-sm text-soft">
            {recommendation
              ? "Throughput-first recommendation based on current queue conditions."
              : "This card updates automatically as live queues change."}
          </p>
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
            onChange={(event) => setSelectedParkId(event.target.value)}
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
          <p className="text-soft">Loading live operations...</p>
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
                  <p className="text-2xl font-semibold">{attraction.waitMinutes ?? "--"}m</p>
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
          <p className="text-sm text-soft">Checking for meaningful updates...</p>
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
