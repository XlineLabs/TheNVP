import { db } from "@/app/db/client";
import { jobs, models } from "@/app/db/schema";
import { requireAdmin } from "@/app/lib/auth";
import { error, HttpError, json } from "@/app/lib/http";
import { id } from "@/app/lib/ids";

export const dynamic = "force-dynamic";

type CanaryInput = { model: string; prompt: string; expected: string; params?: Record<string, unknown> };

/**
 * POST /api/admin/canaries — seed canary jobs.
 * Body: { canaries: [{ model, prompt, expected, params? }], params? }
 */
export async function POST(req: Request) {
  try {
    requireAdmin(req);

    let b: { canaries?: CanaryInput[]; params?: Record<string, unknown> };
    try {
      b = await req.json();
    } catch {
      return error("Invalid JSON body", 400);
    }
    if (!Array.isArray(b.canaries) || b.canaries.length === 0) {
      return error("canaries (non-empty array) is required", 400);
    }

    const defaultParams = b.params ?? { max_tokens: 64, temperature: 0, top_k: 1, seed: 0 };
    const enabledModels = new Set((await db.select({ id: models.id }).from(models)).map((m) => m.id));

    let inserted = 0;
    for (const c of b.canaries) {
      if (!c.model || !enabledModels.has(c.model) || typeof c.prompt !== "string" || typeof c.expected !== "string") {
        continue;
      }
      await db.insert(jobs).values({
        id: id("jb"),
        modelId: c.model,
        prompt: c.prompt,
        params: { ...defaultParams, ...(c.params ?? {}) },
        status: "queued",
        isCanary: true,
        canaryExpected: c.expected,
      });
      inserted++;
    }

    return json({ ok: true, inserted }, 201);
  } catch (e) {
    if (e instanceof HttpError) return e.toResponse();
    throw e;
  }
}
