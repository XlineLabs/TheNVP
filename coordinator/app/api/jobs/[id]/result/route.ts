import { requireWorker } from "@/app/lib/auth";
import { error, HttpError, json } from "@/app/lib/http";
import { submitResult } from "@/app/lib/results";

export const dynamic = "force-dynamic";

/**
 * POST /api/jobs/:id/result
 * Body: { output, latency_ms?, tokens_out? }
 * Verifies (canary) and credits on acceptance.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const worker = await requireWorker(req);
    const { id: jobId } = await ctx.params;

    let body: { output?: string; latency_ms?: number; tokens_out?: number };
    try {
      body = await req.json();
    } catch {
      return error("Invalid JSON body", 400);
    }
    if (typeof body.output !== "string") {
      return error("output (string) is required", 400);
    }

    const outcome = await submitResult(
      worker,
      jobId,
      body.output,
      typeof body.latency_ms === "number" ? body.latency_ms : null,
      typeof body.tokens_out === "number" ? body.tokens_out : null,
    );

    return json(outcome);
  } catch (e) {
    if (e instanceof HttpError) return e.toResponse();
    throw e;
  }
}
