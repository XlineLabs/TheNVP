import { desc, eq } from "drizzle-orm";
import { db } from "@/app/db/client";
import { apiKeys } from "@/app/db/schema";
import { error, HttpError, json } from "@/app/lib/http";
import { hashApiKey } from "@/app/lib/hash";
import { id, newUserApiKey } from "@/app/lib/ids";
import { requireUser } from "@/app/lib/userauth";

export const dynamic = "force-dynamic";

/** GET /api/keys — list the user's API keys (masked). */
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const rows = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, user.id))
      .orderBy(desc(apiKeys.createdAt));
    return json({
      keys: rows.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        revoked: k.revoked,
        last_used_at: k.lastUsedAt,
        created_at: k.createdAt,
      })),
    });
  } catch (e) {
    if (e instanceof HttpError) return e.toResponse();
    throw e;
  }
}

/** POST /api/keys — create a key. Returns the secret ONCE. Body: { name? } */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    let body: { name?: string } = {};
    try {
      body = await req.json();
    } catch {
      // empty body is fine
    }
    const name = (body.name ?? "API key").toString().slice(0, 60) || "API key";

    const secret = newUserApiKey();
    const prefix = secret.slice(0, 14) + "…"; // e.g. sk-nvp-ab12cd…
    const keyId = id("ak");
    await db.insert(apiKeys).values({
      id: keyId,
      userId: user.id,
      name,
      keyHash: hashApiKey(secret),
      prefix,
    });

    // `key` is returned exactly once — the user copies it now.
    return json({ id: keyId, name, key: secret, prefix }, 201);
  } catch (e) {
    if (e instanceof HttpError) return e.toResponse();
    return error("Failed to create key", 500);
  }
}
