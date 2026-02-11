import { NextResponse } from "next/server";
import { listParks } from "@/lib/data/live-data-service";

export async function GET() {
  return NextResponse.json({
    parks: listParks()
  });
}
