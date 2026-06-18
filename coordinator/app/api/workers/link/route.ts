import { eq } from "drizzle-orm";
import { db } from "@/app/db/client";
import { users, workers } from "@/app/db/schema";
import { requireWorker } from "@/app/lib/auth";
import { error, HttpError, json } from "@/app/lib/http";
import { verifyPassword } from "@/app/lib/userauth";

export const dynamic = "force-dynamic";

/**
 * POST /api/workers/link — link this worker device to a chatbot account.
 * Auth: worker Bearer key. Body: { email, password }.
 * Afterwards the chatbot (same account) can see this device's earnings.
 */
export async function POST(req: Request) {
  try {
    const worker = await requireWorker(req);
    let body: { email?: string; password?: string };
    try {
      body = await req.json();
    } catch {
      return error("Invalid JSON body", 400);
    }
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";
    if (!email || !password) return error("email and password required", 400);

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return error("Invalid email or password", 401);
    }

    await db.update(workers).set({ userId: user.id }).where(eq(workers.id, worker.id));
    return json({ ok: true, linked_to: user.email });
  } catch (e) {
    if (e instanceof HttpError) return e.toResponse();
    throw e;
  }
}
