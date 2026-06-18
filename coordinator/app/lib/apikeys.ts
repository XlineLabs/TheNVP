import { and, eq } from "drizzle-orm";
import { db } from "@/app/db/client";
import { apiKeys, users } from "@/app/db/schema";
import { hashApiKey } from "@/app/lib/hash";
import { HttpError } from "@/app/lib/http";
import type { User } from "@/app/lib/userauth";

/**
 * Authenticate an external API caller by `Authorization: Bearer sk-nvp-...`.
 * Returns the owning user. Used by the OpenAI-compatible /v1 endpoints.
 */
export async function requireApiKeyUser(req: Request): Promise<User> {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new HttpError(401, "Missing API key (Authorization: Bearer sk-nvp-...)");

  const keyHash = hashApiKey(match[1].trim());
  const [key] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.revoked, false)))
    .limit(1);
  if (!key) throw new HttpError(401, "Invalid or revoked API key");

  const [user] = await db.select().from(users).where(eq(users.id, key.userId)).limit(1);
  if (!user) throw new HttpError(401, "User no longer exists");

  // Last-used timestamp — awaited so it actually runs (Drizzle is lazy).
  try {
    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id));
  } catch {
    // non-fatal
  }

  return user;
}
