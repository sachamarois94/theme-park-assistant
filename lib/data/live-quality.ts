import { ParkLiveSnapshot } from "@/lib/types/park";

export function buildServiceNotice(snapshot: ParkLiveSnapshot): string | null {
  if (snapshot.provider === "synthetic") {
    return "Live provider data is unavailable. Guidance may be less accurate until feeds recover.";
  }

  if (snapshot.degradedReason) {
    return snapshot.degradedReason;
  }

  if (snapshot.stale) {
    return "Live data is older than expected. Recommendations are based on delayed queue updates.";
  }

  return null;
}
