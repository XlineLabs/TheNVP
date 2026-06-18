import { requireWorker } from "@/app/lib/auth";
import { claimJob } from "@/app/lib/dispatch";
import { HttpError, json } from "@/app/lib/http";
import { SCORING } from "@/app/lib/scoring";

export const dynamic = "force-dynamic";
// Vercel: allow the long-poll to hold the request. Keep < platform max.
export const maxDuration = 30;

const LONG_POLL_MS = 25_000;
const POLL_INTERVAL_MS = 400; // faster job pickup -> lower latency

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET /api/jobs/next?models=a,b — long-poll for a job (docs/02 §long-polling).
 * Waits up to ~25s for a queued job for the requested models (defaults to the
 * worker's model_caps), then 204 if none. The worker simply re-polls on 204.
 */
export async function GET(req: Request) {
  try {
    const worker = await requireWorker(req);

    // Reputation gating (docs/02 §verif): workers that repeatedly fail canaries
    // drop below the floor and are suspended from receiving jobs.
    if (worker.reputation < SCORING.REPUTATION_FLOOR) {
      return json({ error: "Worker suspended (low reputation)", reputation: worker.reputation }, 403);
    }

    const url = new URL(req.url);
    const param = url.searchParams.get("models");
    const requested = param
      ? param
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : ((worker.modelCaps as string[]) ?? []);

    if (requested.length === 0) {
      return json({ error: "No models specified and worker has no model_caps" }, 400);
    }

    const deadline = Date.now() + LONG_POLL_MS;
    do {
      const job = await claimJob(worker.id, requested);
      if (job) {
        return json({
          job_id: job.id,
          model: job.model_id,
          prompt: job.prompt,
          params: job.params,
        });
      }
      if (Date.now() + POLL_INTERVAL_MS >= deadline) break;
      await sleep(POLL_INTERVAL_MS);
    } while (Date.now() < deadline);

    // No job available — worker should re-poll.
    return new Response(null, { status: 204 });
  } catch (e) {
    if (e instanceof HttpError) return e.toResponse();
    throw e;
  }
}
