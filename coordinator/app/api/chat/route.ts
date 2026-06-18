import { error, HttpError, json } from "@/app/lib/http";
import { startChatMessage } from "@/app/lib/chat";
import { requireUser } from "@/app/lib/userauth";

export const dynamic = "force-dynamic";

/**
 * POST /api/chat
 * Body: { message, conversation_id?, model? }
 * Enqueues an inference job for a real iPhone worker and returns immediately.
 * The client polls GET /api/conversations/:id for the assistant reply (which is
 * created — and the user charged — when the worker submits its result).
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);

    let body: {
      message?: string;
      conversation_id?: string;
      model?: string;
      web_search?: boolean;
      reasoning?: boolean;
      boost?: boolean;
    };
    try {
      body = await req.json();
    } catch {
      return error("Invalid JSON body", 400);
    }
    if (typeof body.message !== "string") return error("message (string) is required", 400);

    const result = await startChatMessage(
      user.id,
      body.message,
      body.conversation_id,
      body.model,
      body.web_search === true,
      body.reasoning === true,
      body.boost === true ? 2 : 1, // Boost = race 2 workers, keep the fastest
    );
    return json({ conversation_id: result.conversationId, job_id: result.jobId, status: "pending" }, 202);
  } catch (e) {
    if (e instanceof HttpError) return e.toResponse();
    throw e;
  }
}
