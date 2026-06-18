import { requireApiKeyUser } from "@/app/lib/apikeys";
import { error, HttpError, json } from "@/app/lib/http";
import { runInference } from "@/app/lib/inference";
import { estimateTokens } from "@/app/lib/pricing";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // synchronous: waits for a worker to answer

type ChatMessage = { role: string; content: string };

/**
 * POST /v1/chat/completions — OpenAI-compatible chat completions, backed by the
 * phone-worker network. Auth: `Authorization: Bearer sk-nvp-...` (a key created
 * in the dashboard). Use this base URL in OpenAI-compatible apps.
 *
 * Deterministic/greedy only (temperature is ignored) — required by verification.
 */
export async function POST(req: Request) {
  try {
    const user = await requireApiKeyUser(req);

    let body: { model?: string; messages?: ChatMessage[]; max_tokens?: number };
    try {
      body = await req.json();
    } catch {
      return error("Invalid JSON body", 400);
    }
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return error("messages (non-empty array) is required", 400);
    }

    // Flatten the conversation into a single prompt (small on-device model).
    const prompt = buildPrompt(body.messages);
    const maxTokens =
      Number.isFinite(body.max_tokens) && (body.max_tokens as number) > 0
        ? (body.max_tokens as number)
        : 256;

    const result = await runInference(user.id, body.model, prompt, maxTokens, 55_000);

    const promptTokens = estimateTokens(prompt);
    const completionTokens = estimateTokens(result.output);
    return json({
      id: `chatcmpl-${result.jobId}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: result.model,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: result.output },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
      },
    });
  } catch (e) {
    if (e instanceof HttpError) return e.toResponse();
    throw e;
  }
}

function buildPrompt(messages: ChatMessage[]): string {
  if (messages.length === 1) return messages[0].content;
  return (
    messages
      .map((m) => {
        const who = m.role === "assistant" ? "Assistant" : m.role === "system" ? "System" : "User";
        return `${who}: ${m.content}`;
      })
      .join("\n") + "\nAssistant:"
  );
}
