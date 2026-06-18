import { eq } from "drizzle-orm";
import { db } from "@/app/db/client";
import { workers } from "@/app/db/schema";
import { env } from "@/app/lib/env";
import { hashApiKey } from "@/app/lib/hash";
import { HttpError } from "@/app/lib/http";

export type Worker = typeof workers.$inferSelect;

/**
 * Authenticate a worker by `Authorization: Bearer <api_key>`. The key is hashed
 * and matched against workers.api_key_hash.
 */
export async function requireWorker(req: Request): Promise<Worker> {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new HttpError(401, "Missing or malformed Authorization header");

  const apiKey = match[1].trim();
  const keyHash = hashApiKey(apiKey);

  const [worker] = await db.select().from(workers).where(eq(workers.apiKeyHash, keyHash)).limit(1);
  if (!worker) throw new HttpError(401, "Invalid API key");

  // Presence: mark the worker seen now (powers the live "online" view).
  // Must be awaited — Drizzle queries are lazy; `void` would never execute it.
  try {
    await db.update(workers).set({ lastSeenAt: new Date() }).where(eq(workers.id, worker.id));
  } catch {
    // non-fatal
  }
  return worker;
}

/**
 * Authenticate an admin/requester by `X-Admin-Token: <ADMIN_TOKEN>`.
 * In v0 the requester reuses the admin token (docs/03).
 */
export function requireAdmin(req: Request): void {
  const token = req.headers.get("x-admin-token") ?? "";
  if (!token || token !== env.ADMIN_TOKEN) {
    throw new HttpError(401, "Invalid or missing admin token");
  }
}
