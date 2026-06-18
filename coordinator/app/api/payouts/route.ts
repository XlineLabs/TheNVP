import { db } from "@/app/db/client";
import { payouts } from "@/app/db/schema";
import { requireWorker } from "@/app/lib/auth";
import { error, HttpError, json } from "@/app/lib/http";
import { id } from "@/app/lib/ids";
import { getBalance } from "@/app/lib/ledger";

export const dynamic = "force-dynamic";

/**
 * POST /api/payouts — request a withdrawal.
 * v0: creates a `requested` row only (no real transfer). The balance is NOT
 * debited here; the ledger 'payout' entry is written when an admin marks it
 * paid (see /api/admin/payouts/:id).
 */
export async function POST(req: Request) {
  try {
    const worker = await requireWorker(req);

    let body: { amount?: number; method?: string };
    try {
      body = await req.json();
    } catch {
      return error("Invalid JSON body", 400);
    }

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return error("amount must be a positive number", 400);
    }

    const balance = await getBalance(worker.id);
    if (amount > balance) {
      return error("amount exceeds balance", 400, { balance });
    }

    const payoutId = id("po");
    const method = body.method?.trim() || "manual";
    await db.insert(payouts).values({
      id: payoutId,
      workerId: worker.id,
      amount: amount.toFixed(6),
      status: "requested",
      method,
    });

    return json({ payout_id: payoutId, status: "requested", amount }, 201);
  } catch (e) {
    if (e instanceof HttpError) return e.toResponse();
    throw e;
  }
}
