import { and, eq } from "drizzle-orm";
import { db } from "@/app/db/client";
import { apiKeys } from "@/app/db/schema";
import { error, HttpError, json } from "@/app/lib/http";
import { requireUser } from "@/app/lib/userauth";

export const dynamic = "force-dynamic";

/** DELETE /api/keys/:id — revoke one of the user's API keys. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id: keyId } = await ctx.params;
    const [key] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, user.id)))
      .limit(1);
    if (!key) return error("Key not found", 404);

    await db.update(apiKeys).set({ revoked: true }).where(eq(apiKeys.id, keyId));
    return json({ ok: true, id: keyId, revoked: true });
  } catch (e) {
    if (e instanceof HttpError) return e.toResponse();
    throw e;
  }
}
