import { sql } from "drizzle-orm";
import { db } from "@/app/db/client";

export type DispatchedJob = {
  id: string;
  model_id: string;
  prompt: string;
  params: Record<string, unknown>;
  is_canary: boolean;
};

/**
 * Atomically claim ONE queued job for the given models (docs/03 §dispatch).
 * FOR UPDATE SKIP LOCKED guarantees two concurrent workers never grab the same
 * job. Returns null if nothing is queued.
 */
export async function claimJob(
  workerId: string,
  modelIds: string[],
): Promise<DispatchedJob | null> {
  if (modelIds.length === 0) return null;

  // Build an IN (...) list of individual bound params — the neon-http driver
  // doesn't encode a JS array for `= ANY($)`.
  const inList = sql.join(
    modelIds.map((m) => sql`${m}`),
    sql`, `,
  );

  const res = await db.execute<DispatchedJob>(sql`
    UPDATE jobs
       SET status = 'assigned',
           assigned_worker_id = ${workerId},
           deadline = now() + interval '120 seconds'
     WHERE id = (
       SELECT id FROM jobs
        WHERE status = 'queued'
          AND model_id IN (${inList})
        ORDER BY created_at
          FOR UPDATE SKIP LOCKED
        LIMIT 1
     )
    RETURNING id, model_id, prompt, params, is_canary
  `);

  return res.rows[0] ?? null;
}
