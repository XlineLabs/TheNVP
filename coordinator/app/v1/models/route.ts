import { eq } from "drizzle-orm";
import { db } from "@/app/db/client";
import { models } from "@/app/db/schema";
import { requireApiKeyUser } from "@/app/lib/apikeys";
import { HttpError, json } from "@/app/lib/http";

export const dynamic = "force-dynamic";

/** GET /v1/models — OpenAI-compatible model list. */
export async function GET(req: Request) {
  try {
    await requireApiKeyUser(req);
    const rows = await db.select().from(models).where(eq(models.enabled, true));
    return json({
      object: "list",
      data: rows.map((m) => ({
        id: m.id,
        object: "model",
        owned_by: "nvp",
      })),
    });
  } catch (e) {
    if (e instanceof HttpError) return e.toResponse();
    throw e;
  }
}
