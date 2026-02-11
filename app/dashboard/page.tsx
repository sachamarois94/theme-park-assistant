import { Suspense } from "react";
import { HomeDashboard } from "@/components/home-dashboard";

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="glass-card rounded-3xl p-5">Loading live operations...</div>}>
      <HomeDashboard />
    </Suspense>
  );
}
