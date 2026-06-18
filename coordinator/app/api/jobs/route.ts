import { eq } from "drizzle-orm";
import { db } from "@/app/db/client";
import { jobs, models } from "@/app/db/schema";
import { requireAdmin } from "@/app/lib/auth";
import { error, HttpError, json } from "@/app/lib/http";
import { id } from "@/app/lib/ids";

export const dynamic = "force-dynamic";

/**
 * POST /api/jobs — submit an inference job (requester).
 * v0: the requester uses the admin token (docs/03). Params are forced to greedy
 * (temperature 0, top-k 1, fixed seed) so output is verifiable.
 */
export async function POST(req: Request) {
  try {
    requireAdmin(req);

    let body: { model?: string; prompt?: string; max_tokens?: number };
    try {
      body = await req.json();
    } catch {
      return error("Invalid JSON body", 400);
    }

    const modelId = body.model?.trim();
    const prompt = body.prompt;
    if (!modelId || typeof prompt !== "string" || prompt.length === 0) {
      return error("model and prompt are required", 400);
    }

    const [model] = await db.select().from(models).where(eq(models.id, modelId)).limit(1);
    if (!model || !model.enabled) {
      return error(`Unknown or disabled model: ${modelId}`, 400);
    }

    const maxTokens =
      Number.isFinite(body.max_tokens) && (body.max_tokens as number) > 0
        ? Math.min(body.max_tokens as number, 1024)
        : 128;

    const jobId = id("jb");
    await db.insert(jobs).values({
      id: jobId,
      modelId,
      prompt,
      // Deterministic decoding enforced server-side (docs/02 §verif).
      params: { max_tokens: maxTokens, temperature: 0, top_k: 1, seed: 0 },
      status: "queued",
      isCanary: false,
    });

    return json({ job_id: jobId, status: "queued" }, 201);
  } catch (e) {
    if (e instanceof HttpError) return e.toResponse();
    throw e;
  }
}
