"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

type ParkOption = {
  id: string;
  name: string;
  resort: string;
};

const PARK_ICONS: Record<string, string> = {
  "disney-magic-kingdom": "🏰",
  "disney-epcot": "🌐",
  "disney-hollywood-studios": "🎬",
  "disney-animal-kingdom": "🌿",
  "universal-studios-florida": "🎢",
  "universal-islands-of-adventure": "🌀",
  "universal-epic-universe": "✨",
  "universal-volcano-bay": "🌋"
};

export function ParkLanding() {
  const [parks, setParks] = useState<ParkOption[]>([]);
  const [selectedParkId, setSelectedParkId] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    fetch("/api/parks", { cache: "no-store" })
      .then((response) => response.json())
      .then((json) => {
        if (!mounted) {
          return;
        }
        const nextParks = (json.parks ?? []) as ParkOption[];
        setParks(nextParks);

        const stored = typeof window !== "undefined" ? localStorage.getItem("selected_park_id") : null;
        if (stored && nextParks.some((park) => park.id === stored)) {
          setSelectedParkId(stored);
          return;
        }
        if (nextParks.length > 0) {
          setSelectedParkId(nextParks[0].id);
        }
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  const grouped = useMemo(() => {
    return {
      disney: parks.filter((park) => park.resort === "Walt Disney World"),
      universal: parks.filter((park) => park.resort === "Universal Orlando")
    };
  }, [parks]);

  function continueToDashboard() {
    if (!selectedParkId) {
      return;
    }
    localStorage.setItem("selected_park_id", selectedParkId);
    router.push(`/dashboard?park=${encodeURIComponent(selectedParkId)}`);
  }

  return (
    <section className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="glass-card rounded-3xl p-6 shadow-glow"
      >
        <p className="text-xs uppercase tracking-[0.22em] text-soft">Welcome</p>
        <h2 className="mt-2 text-3xl font-semibold md:text-4xl">Choose your park adventure</h2>
        <p className="mt-3 max-w-3xl text-sm text-soft">
          Pick your park first. The assistant, scorecards, and live queue intelligence will adapt instantly.
        </p>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.06, ease: "easeOut" }}
          className="glass-card rounded-3xl p-5 shadow-card"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-soft">Disney</p>
          <div className="mt-3 space-y-2">
            {grouped.disney.map((park, index) => {
              const selected = park.id === selectedParkId;
              return (
                <motion.button
                  key={park.id}
                  type="button"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 + index * 0.03, duration: 0.24 }}
                  onClick={() => setSelectedParkId(park.id)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition ${
                    selected
                      ? "border-cyan-300/50 bg-cyan-500/10 text-white shadow-glow"
                      : "border-white/15 bg-slate-950/45 text-white/90 hover:border-cyan-200/40"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <motion.span
                      animate={selected ? { y: [0, -2, 0], rotate: [0, -4, 0] } : {}}
                      transition={{ duration: 0.6, repeat: selected ? Infinity : 0, repeatDelay: 1.8 }}
                    >
                      {PARK_ICONS[park.id] ?? "🎡"}
                    </motion.span>
                    {park.name}
                  </span>
                  <span className="text-xs text-soft">{selected ? "Selected" : "Choose"}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.12, ease: "easeOut" }}
          className="glass-card rounded-3xl p-5 shadow-card"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-soft">Universal</p>
          <div className="mt-3 space-y-2">
            {grouped.universal.map((park, index) => {
              const selected = park.id === selectedParkId;
              return (
                <motion.button
                  key={park.id}
                  type="button"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.14 + index * 0.03, duration: 0.24 }}
                  onClick={() => setSelectedParkId(park.id)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition ${
                    selected
                      ? "border-cyan-300/50 bg-cyan-500/10 text-white shadow-glow"
                      : "border-white/15 bg-slate-950/45 text-white/90 hover:border-cyan-200/40"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <motion.span
                      animate={selected ? { y: [0, -2, 0], rotate: [0, 4, 0] } : {}}
                      transition={{ duration: 0.6, repeat: selected ? Infinity : 0, repeatDelay: 1.8 }}
                    >
                      {PARK_ICONS[park.id] ?? "🎡"}
                    </motion.span>
                    {park.name}
                  </span>
                  <span className="text-xs text-soft">{selected ? "Selected" : "Choose"}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.18, ease: "easeOut" }}
        className="flex items-center justify-between rounded-3xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3"
      >
        <p className="text-sm text-cyan-100">
          Next page includes your best move, relative wait scorecards, and live queue board for{" "}
          <span className="font-medium text-white">
            {parks.find((park) => park.id === selectedParkId)?.name ?? "your park"}
          </span>
          .
        </p>
        <button type="button" onClick={continueToDashboard} className="button-primary px-4 py-2 text-sm font-medium">
          Enter Park Queue
        </button>
      </motion.div>
    </section>
  );
}
