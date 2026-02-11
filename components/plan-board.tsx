"use client";

import { useEffect, useMemo, useState } from "react";
import { DayPlan } from "@/lib/types/park";

type ParkOption = {
  id: string;
  name: string;
};

export function PlanBoard() {
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
          setParkId(json.parks[0].id);
        }
      })
      .catch(() => undefined);
  }, []);

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
            onChange={(event) => setParkId(event.target.value)}
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
          {plan?.steps.map((step, index) => (
            <div key={step.stepId} className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
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
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
