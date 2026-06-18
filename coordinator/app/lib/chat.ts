import { and, eq } from "drizzle-orm";
import { db } from "@/app/db/client";
import { conversations, jobs, messages, models } from "@/app/db/schema";
import { HttpError } from "@/app/lib/http";
import { id } from "@/app/lib/ids";
import { getUserBalance } from "@/app/lib/ledger";
import { formatResults, webSearch } from "@/app/lib/websearch";

const DEFAULT_MODEL = "gemma3_1b"; // matches the model the iPhone app runs on-device

export type StartChatResult = {
  conversationId: string;
  jobId: string;
};

/**
 * Build a single prompt string from the conversation. The worker (iPhone) wraps
 * this in the model's chat template; for v0 multi-turn we inline a compact
 * transcript and end on "Assistant:".
 */
function buildPrompt(history: { role: string; content: string }[], reasoning: boolean): string {
  // More context: keep up to the last 16 turns.
  const recent = history.slice(-16);
  const transcript = recent
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");
  const sys = reasoning
    ? "You are a helpful assistant. Think step by step, then give a thorough, well-structured answer.\n\n"
    : "";
  if (recent.length === 1 && !reasoning) return recent[0].content;
  return `${sys}${transcript}\nAssistant:`;
}

/**
 * Start a chat turn: persist the user message and enqueue an inference job for a
 * real worker. Returns immediately (no long-held request). The assistant reply
 * is created and the user charged when the worker submits the result
 * (see results.ts); the web client polls the conversation for the answer.
 */
/**
 * Web-augmented ("agent") prompt: the model reasons over live web results and
 * answers, citing sources. One shot (reliable on a small model) rather than a
 * fragile autonomous multi-tool loop.
 */
function buildAgentPrompt(question: string, results: string): string {
  return [
    "You are a helpful assistant with access to live web search results.",
    "Think briefly, then answer the question using the results. Cite sources like [1], [2].",
    "",
    "Web results:",
    results,
    "",
    `Question: ${question}`,
    "Answer:",
  ].join("\n");
}

export async function startChatMessage(
  userId: string,
  message: string,
  conversationId: string | undefined,
  modelId: string | undefined,
  useWebSearch: boolean = false,
  reasoning: boolean = false,
  parallel: number = 1,
): Promise<StartChatResult> {
  const text = message?.trim();
  if (!text) throw new HttpError(400, "message is required");

  const model = modelId?.trim() || DEFAULT_MODEL;
  const [m] = await db.select().from(models).where(eq(models.id, model)).limit(1);
  if (!m || !m.enabled) throw new HttpError(400, `Unknown or disabled model: ${model}`);

  const balanceBefore = await getUserBalance(userId);
  if (balanceBefore <= 0) throw new HttpError(402, "Insufficient balance");

  // Resolve or create the conversation.
  let convId = conversationId;
  if (convId) {
    const [conv] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, convId), eq(conversations.userId, userId)))
      .limit(1);
    if (!conv) throw new HttpError(404, "Conversation not found");
  } else {
    convId = id("cnv");
    await db.insert(conversations).values({
      id: convId,
      userId,
      modelId: model,
      title: text.slice(0, 48),
    });
  }

  // Persist the user's message, then build the prompt from the full history.
  await db.insert(messages).values({
    id: id("msg"),
    conversationId: convId,
    role: "user",
    content: text,
  });
  const history = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(eq(messages.conversationId, convId))
    .orderBy(messages.createdAt);

  // Agent mode: search the web (free, no key) and let the model answer from it.
  let prompt: string;
  if (useWebSearch) {
    let resultsBlock = "(no web results found)";
    try {
      resultsBlock = formatResults(await webSearch(text, 5));
    } catch {
      // fall through with no results
    }
    prompt = buildAgentPrompt(text, resultsBlock);
  } else {
    prompt = buildPrompt(history, reasoning);
  }

  // Boost: send this turn to N workers in parallel and keep the fastest answer
  // (best-of-N latency). All replicas share a "turn id" (redundancy_group); only
  // the first to finish delivers the reply (guarded in results.ts). This really
  // uses multiple devices — but it does NOT split one model across devices
  // (that's v2; see docs/09).
  const n = Math.max(1, Math.min(Math.floor(parallel) || 1, 3));
  const turnId = id("turn");
  for (let i = 0; i < n; i++) {
    await db.insert(jobs).values({
      id: id("jb"),
      modelId: model,
      prompt,
      params: { max_tokens: 768, temperature: 0, top_k: 1, seed: 0 },
      status: "queued",
      isCanary: false,
      requesterUserId: userId,
      conversationId: convId,
      redundancyGroup: turnId,
    });
  }

  // The client polls for the assistant message keyed by this stable turn id.
  return { conversationId: convId, jobId: turnId };
}
