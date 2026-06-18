import { eq } from "drizzle-orm";
import { db } from "@/app/db/client";
import { models } from "@/app/db/schema";
import { requireWorker } from "@/app/lib/auth";
import { HttpError, json } from "@/app/lib/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/models — list enabled models the worker can download.
 */
export async function GET(req: Request) {
  try {
    await requireWorker(req);
    const rows = await db.select().from(models).where(eq(models.enabled, true));
    return json({
      models: rows.map((m) => ({
        id: m.id,
        name: m.name,
        download_url: m.downloadUrl,
        quant: m.quant,
        size_mb: m.sizeMb,
        credit_rate: Number(m.creditRate),
      })),
    });
  } catch (e) {
    if (e instanceof HttpError) return e.toResponse();
    throw e;
  }
}
