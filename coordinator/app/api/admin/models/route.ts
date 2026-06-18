import { db } from "@/app/db/client";
import { models } from "@/app/db/schema";
import { requireAdmin } from "@/app/lib/auth";
import { error, HttpError, json } from "@/app/lib/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/models — add or update a supported model.
 * Body: { id, name, download_url, quant, size_mb, credit_rate, enabled? }
 */
export async function POST(req: Request) {
  try {
    requireAdmin(req);

    let b: Record<string, unknown>;
    try {
      b = await req.json();
    } catch {
      return error("Invalid JSON body", 400);
    }

    const id = String(b.id ?? "").trim();
    const name = String(b.name ?? "").trim();
    const downloadUrl = String(b.download_url ?? "").trim();
    const quant = String(b.quant ?? "").trim();
    const sizeMb = Number(b.size_mb);
    const creditRate = Number(b.credit_rate);
    if (!id || !name || !downloadUrl || !quant || !Number.isFinite(sizeMb) || !Number.isFinite(creditRate)) {
      return error("id, name, download_url, quant, size_mb, credit_rate are required", 400);
    }
    const enabled = b.enabled === undefined ? true : Boolean(b.enabled);

    const values = {
      id,
      name,
      downloadUrl,
      quant,
      sizeMb: Math.trunc(sizeMb),
      creditRate: creditRate.toFixed(6),
      enabled,
    };

    await db
      .insert(models)
      .values(values)
      .onConflictDoUpdate({ target: models.id, set: values });

    return json({ ok: true, model: { ...values, credit_rate: creditRate } }, 201);
  } catch (e) {
    if (e instanceof HttpError) return e.toResponse();
    throw e;
  }
}
