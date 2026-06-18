import { and, asc, eq } from "drizzle-orm";
import { db } from "@/app/db/client";
import { conversations, messages } from "@/app/db/schema";
import { error, HttpError, json } from "@/app/lib/http";
import { requireUser } from "@/app/lib/userauth";

export const dynamic = "force-dynamic";

/** GET /api/conversations/:id — messages of one conversation (oldest first). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id: convId } = await ctx.params;

    const [conv] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, convId), eq(conversations.userId, user.id)))
      .limit(1);
    if (!conv) return error("Conversation not found", 404);

    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, convId))
      .orderBy(asc(messages.createdAt));

    return json({
      conversation: { id: conv.id, title: conv.title, model: conv.modelId },
      messages: msgs.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        job_id: m.jobId,
        cost_usd: m.costUsd ? Number(m.costUsd) : null,
        created_at: m.createdAt,
      })),
    });
  } catch (e) {
    if (e instanceof HttpError) return e.toResponse();
    throw e;
  }
}
