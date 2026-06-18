import { and, eq, sql } from "drizzle-orm";
import { db } from "@/app/db/client";
import { jobResults, jobs, models } from "@/app/db/schema";
import { HttpError } from "@/app/lib/http";
import { id } from "@/app/lib/ids";
import { getUserBalance } from "@/app/lib/ledger";

const DEFAULT_MODEL = "gemma3_1b";
const POLL_MS = 400;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type InferenceResult = {
  output: string;
  jobId: string;
  model: string;
};

/**
 * Run a one-shot inference job on behalf of a user (API endpoints): enqueue for a
 * real worker, wait for the answer, and let result submission charge the user.
 * Throws HttpError on bad model, insufficient balance, or no worker in time.
 */
export async function runInference(
  userId: string,
  modelId: string | undefined,
  prompt: string,
  maxTokens: number,
  timeoutMs: number,
): Promise<InferenceResult> {
  const model = modelId?.trim() || DEFAULT_MODEL;
  const [m] = await db.select().from(models).where(eq(models.id, model)).limit(1);
  if (!m || !m.enabled) throw new HttpError(400, `Unknown or disabled model: ${model}`);

  if ((await getUserBalance(userId)) <= 0) throw new HttpError(402, "Insufficient balance");

  const jobId = id("jb");
  await db.insert(jobs).values({
    id: jobId,
    modelId: model,
    prompt,
    params: { max_tokens: Math.min(Math.max(maxTokens, 1), 1024), temperature: 0, top_k: 1, seed: 0 },
    status: "queued",
    isCanary: false,
    requesterUserId: userId,
  });

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const [job] = await db
      .select({ status: jobs.status })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);
    if (job?.status === "done") {
      const [r] = await db
        .select({ output: jobResults.output })
        .from(jobResults)
        .where(and(eq(jobResults.jobId, jobId), eq(jobResults.accepted, true)))
        .limit(1);
      return { output: r?.output ?? "", jobId, model };
    }
    if (job?.status === "failed") break;
    await sleep(POLL_MS);
  }

  // Mark dead so it isn't picked up later.
  await db.execute(
    sql`UPDATE jobs SET status='failed' WHERE id=${jobId} AND status IN ('queued','assigned')`,
  );
  throw new HttpError(503, "No workers are online to process the request. Try again shortly.");
}
