import { eq, sql } from "drizzle-orm";
import { db } from "@/app/db/client";
import { jobResults, jobs, ledgerEntries, models, workers } from "@/app/db/schema";
import { HttpError } from "@/app/lib/http";
import { id } from "@/app/lib/ids";
import { getBalance } from "@/app/lib/ledger";
import { estimateTokens, jobCostUsd, workerEarningUsd } from "@/app/lib/pricing";
import { canaryMatches, clampReputation, SCORING } from "@/app/lib/scoring";
import type { Worker } from "@/app/lib/auth";

export type SubmitOutcome = {
  accepted: boolean;
  credited: number;
  balance: number;
  reason?: string;
};

/**
 * Finalize a worker's result for a job (docs/02 lifecycle).
 *
 * Verification in v0/M2: canary jobs are checked against the known expected
 * answer (exact match after normalization); real jobs are accepted (redundancy
 * comes in M4). Atomicity without interactive transactions:
 *   1. read the job, validate ownership/state
 *   2. a GUARDED update (WHERE status='assigned') claims finalization exactly
 *      once — concurrent/double submits get 0 rows and are rejected
 *   3. a batch writes the result row, the ledger credit, and reputation change
 */
export async function submitResult(
  worker: Worker,
  jobId: string,
  output: string,
  latencyMs: number | null,
  tokensOut: number | null,
): Promise<SubmitOutcome> {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job) throw new HttpError(404, "Job not found");
  if (job.assignedWorkerId !== worker.id) throw new HttpError(403, "Job not assigned to you");
  if (job.status !== "assigned") throw new HttpError(409, "Job already finalized");

  const [model] = await db.select().from(models).where(eq(models.id, job.modelId)).limit(1);
  if (!model) throw new HttpError(500, "Model for job not found");

  // Real USD earning (docs: workers see the real amount). Output tokens are
  // reported by the worker; input tokens are estimated from the prompt.
  const tokIn = estimateTokens(job.prompt);
  const tokOut = tokensOut ?? estimateTokens(output);
  const earning = workerEarningUsd(job.modelId, tokIn, tokOut);

  // --- verification ---
  const accepted = job.isCanary ? canaryMatches(output, job.canaryExpected ?? "") : true;
  const newStatus = accepted ? "done" : "failed";

  // --- guarded finalization (idempotent against double-submit) ---
  const claim = await db.execute(
    sql`UPDATE jobs SET status = ${newStatus} WHERE id = ${jobId} AND status = 'assigned' RETURNING id`,
  );
  if (claim.rows.length === 0) throw new HttpError(409, "Job already finalized");

  // --- atomic writes: result row (+ credit | reputation penalty) ---
  const writes: unknown[] = [
    db.insert(jobResults).values({
      id: id("res"),
      jobId,
      workerId: worker.id,
      output,
      latencyMs: latencyMs ?? undefined,
      accepted,
    }),
  ];

  let newReputation = worker.reputation;
  if (accepted) {
    writes.push(
      db.insert(ledgerEntries).values({
        id: id("led"),
        workerId: worker.id,
        amount: earning.toFixed(6), // real USD, exact to 6 dp
        type: "earn",
        jobId,
      }),
    );
    if (job.isCanary) newReputation = clampReputation(worker.reputation + SCORING.REPUTATION_REWARD);
  } else {
    newReputation = clampReputation(worker.reputation - SCORING.REPUTATION_PENALTY);
  }

  if (newReputation !== worker.reputation) {
    writes.push(
      db.update(workers).set({ reputation: newReputation }).where(eq(workers.id, worker.id)),
    );
  }

  // drizzle neon-http batch runs these in a single atomic request.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.batch(writes as any);

  // Chat/API delivery: store the assistant reply for chat jobs. v0 beta: the
  // requesting user is NOT charged (free). The worker is still paid (above).
  // For Boost (racing) the replicas share a turn id (redundancy_group); only the
  // FIRST to finish writes the message (guarded INSERT … WHERE NOT EXISTS), so
  // the client sees exactly one reply keyed by that turn id.
  if (accepted && job.requesterUserId && job.conversationId) {
    const cost = jobCostUsd(job.modelId, tokIn, tokOut);
    const turnKey = job.redundancyGroup ?? jobId;
    await db.execute(sql`
      INSERT INTO messages (id, conversation_id, role, content, job_id, cost_usd, created_at)
      SELECT ${id("msg")}, ${job.conversationId}, 'assistant', ${output}, ${turnKey}, ${cost.toFixed(6)}, now()
      WHERE NOT EXISTS (
        SELECT 1 FROM messages
        WHERE conversation_id = ${job.conversationId} AND job_id = ${turnKey} AND role = 'assistant'
      )
    `);
  }

  const balance = await getBalance(worker.id);
  return {
    accepted,
    credited: accepted ? earning : 0,
    balance,
    reason: accepted ? undefined : "verification_failed",
  };
}
