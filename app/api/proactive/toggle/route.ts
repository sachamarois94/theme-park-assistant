import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "proactive_mode";
const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;

export async function GET(request: NextRequest) {
  const enabled = request.cookies.get(COOKIE_NAME)?.value === "1";
  return NextResponse.json({ enabled });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { enabled?: boolean };
  const enabled = Boolean(body.enabled);

  const response = NextResponse.json({ enabled });
  response.cookies.set({
    name: COOKIE_NAME,
    value: enabled ? "1" : "0",
    maxAge: ONE_WEEK_SECONDS,
    httpOnly: false,
    sameSite: "lax",
    path: "/"
  });

  return response;
}
