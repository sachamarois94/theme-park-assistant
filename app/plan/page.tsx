import { Suspense } from "react";
import { PlanBoard } from "@/components/plan-board";

export default function PlanPage() {
  return (
    <Suspense fallback={<div className="glass-card rounded-3xl p-5">Loading planner...</div>}>
      <PlanBoard />
    </Suspense>
  );
}
