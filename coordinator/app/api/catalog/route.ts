import { eq } from "drizzle-orm";
import { db } from "@/app/db/client";
import { models } from "@/app/db/schema";
import { HttpError, json } from "@/app/lib/http";
import { requireUser } from "@/app/lib/userauth";

export const dynamic = "force-dynamic";

/** GET /api/catalog — enabled models for the chat model picker (user auth). */
export async function GET(req: Request) {
  try {
    await requireUser(req);
    const rows = await db.select().from(models).where(eq(models.enabled, true));
    return json({
      models: rows.map((m) => ({ id: m.id, name: m.name })),
    });
  } catch (e) {
    if (e instanceof HttpError) return e.toResponse();
    throw e;
  }
}
