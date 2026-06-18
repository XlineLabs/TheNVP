import { sql } from "drizzle-orm";
import { db } from "@/app/db/client";
import { HttpError, json } from "@/app/lib/http";
import { requireUser } from "@/app/lib/userauth";

export const dynamic = "force-dynamic";

const ONLINE_WINDOW = "90 seconds";

/**
 * GET /api/me/worker — summary of the logged-in user's linked worker device(s):
 * how many devices, how many online, total jobs done and total earned.
 * Shown in chatbot Settings → Worker status (only if they have a linked worker).
 */
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);

    const devices = await db.execute<{ total: string; online: string }>(sql`
      SELECT COUNT(*)::text AS total,
             COUNT(*) FILTER (WHERE last_seen_at > now() - interval '${sql.raw(ONLINE_WINDOW)}')::text AS online
      FROM workers WHERE user_id = ${user.id}
    `);

    const earn = await db.execute<{ jobs: string; earned: string }>(sql`
      SELECT COUNT(*)::text AS jobs, COALESCE(SUM(amount),0)::text AS earned
      FROM ledger_entries
      WHERE type = 'earn' AND worker_id IN (SELECT id FROM workers WHERE user_id = ${user.id})
    `);

    const total = Number(devices.rows[0]?.total ?? "0");
    return json({
      has_worker: total > 0,
      devices: total,
      online: Number(devices.rows[0]?.online ?? "0"),
      jobs_done: Number(earn.rows[0]?.jobs ?? "0"),
      earned: Number(earn.rows[0]?.earned ?? "0"),
    });
  } catch (e) {
    if (e instanceof HttpError) return e.toResponse();
    throw e;
  }
}
