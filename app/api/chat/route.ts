import { NextRequest, NextResponse } from "next/server";
import { getParkLiveSnapshot, recommendNext } from "@/lib/data/live-data-service";
import { buildServiceNotice } from "@/lib/data/live-quality";
import { ParkId } from "@/lib/types/park";

interface ChatRequestBody {
  parkId?: ParkId;
  message?: string;
}

function buildFallbackReply() {
  return "I can help with wait times, what to do next, and replanning. Try asking: 'What should I do next?'";
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as ChatRequestBody;
  const parkId = body.parkId;
  const message = body.message?.trim() ?? "";

  if (!parkId || !message) {
    return NextResponse.json(
      {
        reply: buildFallbackReply()
      },
      { status: 200 }
    );
  }

  const snapshot = await getParkLiveSnapshot(parkId);
  if (!snapshot) {
    return NextResponse.json({ error: "Unsupported park id." }, { status: 404 });
  }

  const lower = message.toLowerCase();
  const recommendation = recommendNext(snapshot);
  const serviceNotice = buildServiceNotice(snapshot);

  if (lower.includes("wait") || lower.includes("line")) {
    const longest = snapshot.summary.longestWait;
    const shortest = snapshot.summary.shortestWait;

    return NextResponse.json({
      reply: [
        `Current average wait is ${snapshot.summary.averageWaitMinutes ?? "unknown"} minutes in ${snapshot.parkName}.`,
        longest ? `Longest wait: ${longest.name} (${longest.minutes}m).` : null,
        shortest ? `Best short queue: ${shortest.name} (${shortest.minutes}m).` : null
      ]
        .filter(Boolean)
        .join(" "),
      cards: recommendation.alternatives.slice(0, 3),
      serviceNotice,
      dataFreshness: {
        provider: snapshot.provider,
        sourceUpdatedAt: snapshot.sourceUpdatedAt,
        ageSeconds: snapshot.freshnessSeconds,
        stale: snapshot.stale
      }
    });
  }

  if (lower.includes("next") || lower.includes("what should") || lower.includes("recommend")) {
    const top = recommendation.top;
    if (!top) {
      return NextResponse.json({
        reply: "I cannot find an operating attraction with live wait data right now. Try a replan in a few minutes.",
        serviceNotice,
        dataFreshness: {
          provider: snapshot.provider,
          sourceUpdatedAt: snapshot.sourceUpdatedAt,
          ageSeconds: snapshot.freshnessSeconds,
          stale: snapshot.stale
        }
      });
    }

    return NextResponse.json({
      reply: `Go to ${top.name} next. Estimated wait is ${top.waitMinutes ?? "unknown"} minutes and this is currently one of the best throughput moves.`,
      cards: [top, ...recommendation.alternatives],
      serviceNotice,
      dataFreshness: {
        provider: snapshot.provider,
        sourceUpdatedAt: snapshot.sourceUpdatedAt,
        ageSeconds: snapshot.freshnessSeconds,
        stale: snapshot.stale
      }
    });
  }

  return NextResponse.json({
    reply: buildFallbackReply(),
    serviceNotice,
    dataFreshness: {
      provider: snapshot.provider,
      sourceUpdatedAt: snapshot.sourceUpdatedAt,
      ageSeconds: snapshot.freshnessSeconds,
      stale: snapshot.stale
    }
  });
}
