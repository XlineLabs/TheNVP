import { sql } from "drizzle-orm";
import { db } from "@/app/db/client";
import { jobs, jobResults, ledgerEntries, models, payouts, workers } from "@/app/db/schema";
import { NOMINAL_TOPS_PER_DEVICE } from "@/app/lib/defaults";
import { HttpError, json } from "@/app/lib/http";
import { requireAdminUser } from "@/app/lib/userauth";
import { eq, and, gte } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/overview — live network stats for the admin dashboard.
 * Admin only (the ADMIN_EMAIL account). Poll this for a live view.
 */
export async function GET(req: Request) {
  try {
    await requireAdminUser(req);

    const devices = await db.execute<{ total: string; online: string }>(sql`
      SELECT COUNT(*)::text AS total,
             COUNT(*) FILTER (WHERE last_seen_at > now() - interval '90 seconds')::text AS online
      FROM workers WHERE platform <> 'simulator'
    `);

    const jobsStats = await db.execute<{ done: string; last_min: string; queued: string; avg_latency: string; success_count: string; total_count: string }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'done')::text AS done,
        COUNT(*) FILTER (WHERE accepted AND submitted_at > now() - interval '60 seconds')::text AS last_min,
        COUNT(*) FILTER (WHERE status = 'queued')::text AS queued,
        COALESCE(AVG(latency_ms) FILTER (WHERE accepted), 0)::text AS avg_latency,
        COUNT(*) FILTER (WHERE accepted)::text AS success_count,
        COUNT(*)::text AS total_count
      FROM job_results
    `);

    const tput = await db.execute<{ toks: string }>(sql`
      SELECT COALESCE(SUM( (length(output)/4.0) / GREATEST(latency_ms,1) * 1000.0 ), 0)::text AS toks
      FROM job_results
      WHERE accepted AND submitted_at > now() - interval '60 seconds'
    `);

    const earned = await db.execute<{ total: string }>(sql`
      SELECT COALESCE(SUM(amount),0)::text AS total FROM ledger_entries WHERE type='earn'
    `);

    const paid = await db.execute<{ total: string }>(sql`
      SELECT COALESCE(SUM(amount),0)::text AS total FROM ledger_entries WHERE type='payout'
    `);

    const workersList = await db.execute(sql`
      SELECT
        w.id, w.platform, w.device_model, w.reputation,
        to_char(w.last_seen_at, 'HH24:MI:SS') AS last_seen,
        (w.last_seen_at > now() - interval '90 seconds') AS is_online,
        COALESCE(jobs_done.cnt, 0) AS jobs_done,
        COALESCE(earned.total_earned, 0) AS earned
      FROM workers w
      LEFT JOIN (
        SELECT worker_id, COUNT(*)::int AS cnt
        FROM job_results WHERE accepted = true
        GROUP BY worker_id
      ) jobs_done ON jobs_done.worker_id = w.id
      LEFT JOIN (
        SELECT worker_id, SUM(amount)::numeric AS total_earned
        FROM ledger_entries WHERE type = 'earn'
        GROUP BY worker_id
      ) earned ON earned.worker_id = w.id
      WHERE w.platform <> 'simulator'
      ORDER BY w.last_seen_at DESC NULLS LAST
      LIMIT 100
    `);

    const recentJobs = await db.execute(sql`
      SELECT r.worker_id, r.accepted, r.latency_ms,
             to_char(r.submitted_at, 'HH24:MI:SS') AS at,
             j.model_id, j.is_canary
      FROM job_results r
      JOIN jobs j ON j.id = r.job_id
      ORDER BY r.submitted_at DESC
      LIMIT 50
    `);

    const modelsList = await db.execute(sql`
      SELECT m.*,
             COALESCE(q.cnt, 0) AS jobs_queued,
             COALESCE(d.cnt, 0) AS jobs_done
      FROM models m
      LEFT JOIN (
        SELECT model_id, COUNT(*)::int AS cnt
        FROM jobs WHERE status = 'queued'
        GROUP BY model_id
      ) q ON q.model_id = m.id
      LEFT JOIN (
        SELECT j.model_id, COUNT(*)::int AS cnt
        FROM job_results r
        JOIN jobs j ON j.id = r.job_id
        WHERE r.accepted = true
        GROUP BY j.model_id
      ) d ON d.model_id = m.id
      ORDER BY m.name
    `);

    const recentPayouts = await db.execute(sql`
      SELECT p.*
      FROM payouts p
      ORDER BY p.created_at DESC
      LIMIT 20
    `);

    const totalDevices = Number(devices.rows[0]?.total ?? "0");
    const onlineDevices = Number(devices.rows[0]?.online ?? "0");
    const successCount = Number(jobsStats.rows[0]?.success_count ?? "0");
    const totalCount = Number(jobsStats.rows[0]?.total_count ?? "0");

    return json({
      devices_total: totalDevices,
      devices_online: onlineDevices,
      jobs_done: Number(jobsStats.rows[0]?.done ?? "0"),
      jobs_last_min: Number(jobsStats.rows[0]?.last_min ?? "0"),
      jobs_queued: Number(jobsStats.rows[0]?.queued ?? "0"),
      live_tokens_per_sec: Math.round(Number(tput.rows[0]?.toks ?? "0") * 10) / 10,
      avg_latency_ms: Math.round(Number(jobsStats.rows[0]?.avg_latency ?? "0")),
      success_rate: totalCount > 0 ? successCount / totalCount : 0,
      total_paid_usd: Math.abs(Number(paid.rows[0]?.total ?? "0")),
      total_earned_usd: Number(earned.rows[0]?.total ?? "0"),
      combined_tops: onlineDevices * NOMINAL_TOPS_PER_DEVICE,
      nominal_tops_per_device: NOMINAL_TOPS_PER_DEVICE,
      workers: workersList.rows,
      recent_jobs: recentJobs.rows,
      models: modelsList.rows,
      recent_payouts: recentPayouts.rows,
    });
  } catch (e) {
    if (e instanceof HttpError) return e.toResponse();
    throw e;
  }
}