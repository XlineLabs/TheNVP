import { createHash, timingSafeEqual } from "crypto";

/**
 * API keys are high-entropy random tokens (see ids.newApiKey), so a fast SHA-256
 * is sufficient — we don't need a slow password hash (no brute-force surface).
 */
export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

/** Constant-time compare of two hex digests of equal length. */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
