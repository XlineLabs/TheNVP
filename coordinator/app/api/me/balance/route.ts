import { requireWorker } from "@/app/lib/auth";
import { HttpError, json } from "@/app/lib/http";
import { getBalance, getJobsDone } from "@/app/lib/ledger";

export const dynamic = "force-dynamic";

/** GET /api/me/balance — current credit balance + jobs done. */
export async function GET(req: Request) {
  try {
    const worker = await requireWorker(req);
    const [balance, jobsDone] = await Promise.all([
      getBalance(worker.id),
      getJobsDone(worker.id),
    ]);
    return json({ balance, currency: "USD", jobs_done: jobsDone });
  } catch (e) {
    if (e instanceof HttpError) return e.toResponse();
    throw e;
  }
}
