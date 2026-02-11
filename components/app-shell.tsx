"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/plan", label: "Plan" },
  { href: "/chat", label: "Chat" },
  { href: "/pricing", label: "Pricing" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 pb-24 pt-6 md:px-8 md:pb-10">
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
      </header>

      <main>{children}</main>

      <nav className="glass-card fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-2rem)] -translate-x-1/2 items-center justify-around rounded-3xl border border-white/10 px-2 py-2 shadow-glow md:relative md:bottom-auto md:left-auto md:w-full md:translate-x-0 md:justify-start md:gap-2 md:rounded-2xl md:px-3 md:py-3">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "rounded-2xl px-4 py-2 text-sm transition-colors",
                active ? "bg-white/10 text-white" : "text-soft hover:text-white"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
