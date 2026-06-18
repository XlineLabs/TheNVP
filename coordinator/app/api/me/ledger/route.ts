import { desc, eq } from "drizzle-orm";
import { db } from "@/app/db/client";
import { ledgerEntries } from "@/app/db/schema";
import { requireWorker } from "@/app/lib/auth";
import { HttpError, json } from "@/app/lib/http";

export const dynamic = "force-dynamic";

/** GET /api/me/ledger — credit history (most recent first). */
export async function GET(req: Request) {
  try {
    const worker = await requireWorker(req);
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "100") || 100, 500);

    const rows = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.workerId, worker.id))
      .orderBy(desc(ledgerEntries.createdAt))
      .limit(limit);

    return json({
      entries: rows.map((r) => ({
        id: r.id,
        amount: Number(r.amount),
        type: r.type,
        job_id: r.jobId,
        created_at: r.createdAt,
      })),
    });
  } catch (e) {
    if (e instanceof HttpError) return e.toResponse();
    throw e;
  }
}
