import { NextResponse } from "next/server";

// Liveness probe. Intentionally does NOT touch the DB so it stays green even
// when the database is down (use a dedicated readiness check for that later).
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok", service: "nvp-coordinator", time: new Date().toISOString() });
}
