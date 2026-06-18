import { desc, eq } from "drizzle-orm";
import { db } from "@/app/db/client";
import { payouts } from "@/app/db/schema";
import { requireWorker } from "@/app/lib/auth";
import { HttpError, json } from "@/app/lib/http";

export const dynamic = "force-dynamic";

/** GET /api/me/payouts — this worker's withdrawal requests. */
export async function GET(req: Request) {
  try {
    const worker = await requireWorker(req);
    const rows = await db
      .select()
      .from(payouts)
      .where(eq(payouts.workerId, worker.id))
      .orderBy(desc(payouts.createdAt));

    return json({
      payouts: rows.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        status: p.status,
        method: p.method,
        created_at: p.createdAt,
      })),
    });
  } catch (e) {
    if (e instanceof HttpError) return e.toResponse();
    throw e;
  }
}
