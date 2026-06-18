import { eq } from "drizzle-orm";
import { db } from "@/app/db/client";
import { ledgerEntries, payouts } from "@/app/db/schema";
import { requireAdmin } from "@/app/lib/auth";
import { error, HttpError, json } from "@/app/lib/http";
import { id as newId } from "@/app/lib/ids";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["approved", "paid", "rejected"]);

/**
 * POST /api/admin/payouts/:id — operator approves/pays/rejects a withdrawal.
 * Body: { status: "approved" | "paid" | "rejected" }
 * On "paid" we write the negative ledger entry that actually debits the balance.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(req);
    const { id: payoutId } = await ctx.params;

    let b: { status?: string };
    try {
      b = await req.json();
    } catch {
      return error("Invalid JSON body", 400);
    }
    const status = String(b.status ?? "").trim();
    if (!ALLOWED.has(status)) {
      return error(`status must be one of: ${[...ALLOWED].join(", ")}`, 400);
    }

    const [payout] = await db.select().from(payouts).where(eq(payouts.id, payoutId)).limit(1);
    if (!payout) return error("Payout not found", 404);

    // Debit the ledger exactly once, when transitioning into "paid".
    if (status === "paid" && payout.status !== "paid") {
      await db.batch([
        db.update(payouts).set({ status }).where(eq(payouts.id, payoutId)),
        db.insert(ledgerEntries).values({
          id: newId("led"),
          workerId: payout.workerId,
          amount: (-Number(payout.amount)).toFixed(6),
          type: "payout",
          jobId: null,
        }),
      ]);
    } else {
      await db.update(payouts).set({ status }).where(eq(payouts.id, payoutId));
    }

    return json({ ok: true, payout_id: payoutId, status });
  } catch (e) {
    if (e instanceof HttpError) return e.toResponse();
    throw e;
  }
}
