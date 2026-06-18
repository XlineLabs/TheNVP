import { db } from "@/app/db/client";
import { workers } from "@/app/db/schema";
import { hashApiKey } from "@/app/lib/hash";
import { error, json } from "@/app/lib/http";
import { id, newApiKey } from "@/app/lib/ids";

export const dynamic = "force-dynamic";

/**
 * POST /api/workers/register
 * Body: { device_pubkey, platform, model_caps? }
 * Returns the worker_id and a one-time api_key (only the hash is stored).
 */
export async function POST(req: Request) {
  let body: { device_pubkey?: string; platform?: string; model_caps?: string[]; device_model?: string };
  try {
    body = await req.json();
  } catch {
    return error("Invalid JSON body", 400);
  }

  const devicePubkey = body.device_pubkey?.trim();
  const platform = body.platform?.trim();
  if (!devicePubkey || !platform) {
    return error("device_pubkey and platform are required", 400);
  }
  const modelCaps = Array.isArray(body.model_caps) ? body.model_caps : [];

  const apiKey = newApiKey();
  const workerId = id("wk");

  await db.insert(workers).values({
    id: workerId,
    devicePubkey,
    platform,
    apiKeyHash: hashApiKey(apiKey),
    modelCaps,
    deviceModel: body.device_model?.toString().slice(0, 40) ?? null,
    lastSeenAt: new Date(),
  });

  // api_key is returned exactly once — the worker stores it (Keychain on iOS).
  return json({ worker_id: workerId, api_key: apiKey, reputation: 1.0 }, 201);
}
