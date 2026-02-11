"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ParkAtmosphere } from "@/components/park-atmosphere";

const NAV = [
  { href: "/dashboard", label: "Home" },
  { href: "/plan", label: "Plan" },
  { href: "/chat", label: "Chat" },
  { href: "/pricing", label: "Pricing" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [parkId, setParkId] = useState<string | null>(null);

  useEffect(() => {
    const fromQuery = searchParams.get("park");
    if (fromQuery) {
      setParkId(fromQuery);
      localStorage.setItem("selected_park_id", fromQuery);
      return;
    }

    const stored = localStorage.getItem("selected_park_id");
    if (stored) {
      setParkId(stored);
    }
  }, [searchParams]);

  const links = useMemo(() => {
    return NAV.map((item) => {
      if (!parkId) {
        return { ...item, hrefWithPark: item.href };
      }
      const params = new URLSearchParams();
      params.set("park", parkId);
      return { ...item, hrefWithPark: `${item.href}?${params.toString()}` };
    });
  }, [parkId]);

  return (
    <div className="relative mx-auto min-h-screen max-w-6xl px-4 pb-10 pt-6 md:px-8">
      <ParkAtmosphere parkId={parkId ?? undefined} />

      <header className="glass-card subtle-grid sticky top-4 z-30 mb-6 rounded-3xl px-4 py-3 shadow-card">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-soft">Orlando Live Ops</p>
            <h1 className="text-lg font-semibold text-text-0 md:text-xl">Theme Park Assistant</h1>
          </div>
          <div className="pill px-3 py-1 text-xs text-soft">
            Proactive AI + Day Planner
          </div>
        </div>

        <nav className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/30 p-2">
          {links.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.hrefWithPark}
                className={clsx(
                  "rounded-xl px-4 py-2 text-sm transition-all",
                  active
                    ? "bg-cyan-500/20 text-white shadow-[0_0_20px_rgba(92,214,255,0.2)]"
                    : "text-soft hover:bg-white/10 hover:text-white"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main>{children}</main>
    </div>
  );
}
