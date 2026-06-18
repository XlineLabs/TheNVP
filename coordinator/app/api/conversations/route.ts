import { desc, eq } from "drizzle-orm";
import { db } from "@/app/db/client";
import { conversations } from "@/app/db/schema";
import { HttpError, json } from "@/app/lib/http";
import { requireUser } from "@/app/lib/userauth";

export const dynamic = "force-dynamic";

/** GET /api/conversations — list the user's conversations (most recent first). */
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const rows = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, user.id))
      .orderBy(desc(conversations.createdAt));
    return json({
      conversations: rows.map((c) => ({
        id: c.id,
        title: c.title,
        model: c.modelId,
        created_at: c.createdAt,
      })),
    });
  } catch (e) {
    if (e instanceof HttpError) return e.toResponse();
    throw e;
  }
}
