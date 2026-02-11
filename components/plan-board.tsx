"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DayPlan } from "@/lib/types/park";
import { PixieLoader } from "@/components/pixie-loader";

type ParkOption = {
  id: string;
  name: string;
};

export function PlanBoard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const parkFromQuery = searchParams.get("park");

  const [parks, setParks] = useState<ParkOption[]>([]);
  const [parkId, setParkId] = useState("");
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [freshness, setFreshness] = useState<string>("");

  useEffect(() => {
    fetch("/api/parks", { cache: "no-store" })
      .then((response) => response.json())
      .then((json) => {
        setParks(json.parks ?? []);
        if (json.parks?.length > 0) {
          const stored = localStorage.getItem("selected_park_id");
          const preferred = [parkFromQuery, stored, json.parks[0].id].find(
            (candidate) => candidate && json.parks.some((park: ParkOption) => park.id === candidate)
          );
          if (preferred) {
            setParkId(preferred);
            localStorage.setItem("selected_park_id", preferred);
          }
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!parkFromQuery || !parks.some((park) => park.id === parkFromQuery)) {
      return;
    }
    setParkId(parkFromQuery);
    localStorage.setItem("selected_park_id", parkFromQuery);
  }, [parkFromQuery, parks]);

  function applyPark(nextParkId: string) {
    setParkId(nextParkId);
    localStorage.setItem("selected_park_id", nextParkId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("park", nextParkId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  async function generatePlan() {
    if (!parkId || busy) {
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/plan/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ parkId, hours: 8 })
      });
      const json = await response.json();
      setPlan(json.plan ?? null);
      if (json.dataFreshness) {
        setFreshness(
          `${json.dataFreshness.provider} • ${Math.round((json.dataFreshness.ageSeconds ?? 0) / 60)}m old`
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function replan() {
    if (!parkId || !plan || busy) {
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/plan/replan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ parkId, plan })
      });
      const json = await response.json();
      setPlan(json.plan ?? null);
      if (json.dataFreshness) {
        setFreshness(
          `${json.dataFreshness.provider} • ${Math.round((json.dataFreshness.ageSeconds ?? 0) / 60)}m old`
        );
      }
    } finally {
      setBusy(false);
    }
  }

  const totalWait = useMemo(() => {
    if (!plan) {
      return 0;
    }
    return plan.steps.reduce((acc, step) => acc + (step.expectedWait ?? 0), 0);
  }, [plan]);

  return (
    <section className="space-y-4">
      <div className="glass-card rounded-3xl p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-soft">Day Planning</p>
            <h2 className="mt-1 text-2xl font-semibold">Build and optimize your timeline</h2>
          </div>
          <span className="pill px-3 py-1 text-xs">{freshness || "Waiting for first plan run"}</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <select
            value={parkId}
            onChange={(event) => applyPark(event.target.value)}
            className="rounded-2xl border border-white/15 bg-slate-950/50 px-3 py-2 text-sm text-white outline-none ring-accent-0/40 focus:ring"
          >
            {parks.map((park) => (
              <option key={park.id} value={park.id}>
                {park.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={generatePlan} className="button-primary px-4 py-2 text-sm" disabled={busy}>
            {busy ? "Working..." : "Generate plan"}
          </button>
          <button type="button" onClick={replan} className="button-ghost px-4 py-2 text-sm" disabled={!plan || busy}>
            Replan from live data
          </button>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Timeline</h3>
          <span className="text-sm text-soft">
            {plan ? `${plan.steps.length} steps • ${totalWait}m expected queue time` : "No plan generated yet"}
          </span>
        </div>

        <div className="space-y-2">
          {busy ? (
            <div className="mb-1 flex items-center gap-2 text-sm text-soft">
              <PixieLoader size={20} />
              Plotting your route with fresh queue conditions...
            </div>
          ) : null}
          {plan?.steps.map((step, index) => (
            <motion.div
              key={step.stepId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.06, 0.35), duration: 0.24 }}
              className="relative rounded-2xl border border-white/10 bg-slate-950/40 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">
                  {index + 1}. {step.attractionName}
                </p>
                <span className="pill px-3 py-1 text-xs">{step.expectedWait ?? "--"}m</span>
              </div>
              <p className="mt-1 text-xs text-soft">
                {new Date(step.targetWindowStart).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit"
                })}{" "}
                -{" "}
                {new Date(step.targetWindowEnd).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit"
                })}
              </p>
              <p className="mt-2 text-sm text-soft">{step.reason}</p>
              {index < (plan?.steps.length ?? 0) - 1 ? (
                <motion.div
                  className="absolute -bottom-4 left-6 h-4 border-l border-dashed border-cyan-300/40"
                  initial={{ opacity: 0, scaleY: 0 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  transition={{ delay: Math.min(index * 0.06 + 0.12, 0.45), duration: 0.2 }}
                />
              ) : null}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
