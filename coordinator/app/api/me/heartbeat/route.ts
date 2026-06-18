import { eq } from "drizzle-orm";
import { db } from "@/app/db/client";
import { workers } from "@/app/db/schema";
import { HttpError, json } from "@/app/lib/http";
import { hashApiKey } from "@/app/lib/hash";

export const dynamic = "force-dynamic";

/**
 * POST /api/me/heartbeat
 * Lightweight endpoint to mark worker as online (updates last_seen_at).
 * Worker should call this every 15-20 seconds while active.
 */
export async function POST(req: Request) {
  try {
    const header = req.headers.get("authorization") ?? "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) throw new HttpError(401, "Missing or malformed Authorization header");

    const apiKey = match[1].trim();
    const keyHash = hashApiKey(apiKey);

    const [worker] = await db.select().from(workers).where(eq(workers.apiKeyHash, keyHash)).limit(1);
    if (!worker) throw new HttpError(401, "Invalid API key");

    await db.update(workers).set({ lastSeenAt: new Date() }).where(eq(workers.id, worker.id));

    return json({ ok: true, online: true });
  } catch (e) {
    if (e instanceof HttpError) return e.toResponse();
    throw e;
  }
}