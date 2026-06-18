import { sql } from "drizzle-orm";
import { db } from "@/app/db/client";
import { NOMINAL_TOPS_PER_DEVICE } from "@/app/lib/defaults";
import { json } from "@/app/lib/http";

export const dynamic = "force-dynamic";

/** GET /api/stats — public network stats (no auth) for social proof. */
export async function GET() {
  // Real devices only (exclude the TS simulator used in dev).
  const d = await db.execute<{ total: string; online: string }>(sql`
    SELECT COUNT(*)::text AS total,
           COUNT(*) FILTER (WHERE last_seen_at > now() - interval '90 seconds')::text AS online
    FROM workers WHERE platform <> 'simulator'
  `);
  const j = await db.execute<{ done: string }>(sql`
    SELECT COUNT(*) FILTER (WHERE accepted)::text AS done FROM job_results
  `);
  const t = await db.execute<{ toks: string }>(sql`
    SELECT COALESCE(SUM((length(output)/4.0)/GREATEST(latency_ms,1)*1000.0),0)::text AS toks
    FROM job_results WHERE accepted AND submitted_at > now() - interval '60 seconds'
  `);
  const total = Number(d.rows[0]?.total ?? "0");
  const online = Number(d.rows[0]?.online ?? "0");
  return json({
    devices_total: total,
    devices_online: online,
    jobs_done: Number(j.rows[0]?.done ?? "0"),
    live_tokens_per_sec: Math.round(Number(t.rows[0]?.toks ?? "0") * 10) / 10,
    // Live available compute = ONLINE devices × nominal NPU (not historical total).
    combined_tops: online * NOMINAL_TOPS_PER_DEVICE,
  });
}
