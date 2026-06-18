/**
 * Real USD pricing model (v0).
 *
 * This is the single source of truth for how much a job costs the chatbot user
 * and how much the phone worker earns. Amounts are REAL US dollars — workers see
 * exactly what they'd be paid. In v0 no real money moves (chatbot users get a
 * $1500 free grant), but the numbers are production-shaped so flipping to real
 * billing later is a config change, not a rewrite.
 *
 * Prices are anchored to cheap hosted small-model APIs and kept transparent and
 * tunable. cost = perRequest + tokensIn/1e6*inRate + tokensOut/1e6*outRate.
 */

export type ModelPricing = {
  usdPerMTokIn: number; // $ per 1M input tokens
  usdPerMTokOut: number; // $ per 1M output tokens
  usdPerRequest: number; // flat per-request fee (keeps tiny jobs visible)
};

export const PRICING: Record<string, ModelPricing> = {
  gemma3_1b: { usdPerMTokIn: 0.15, usdPerMTokOut: 0.6, usdPerRequest: 0.00015 },
  gemma3n_e2b: { usdPerMTokIn: 0.3, usdPerMTokOut: 1.2, usdPerRequest: 0.0003 },
  gemma_4_e2b_it_4bit: { usdPerMTokIn: 0.2, usdPerMTokOut: 0.8, usdPerRequest: 0.0002 },
  qwen2_5_0_5b: { usdPerMTokIn: 0.1, usdPerMTokOut: 0.4, usdPerRequest: 0.0001 },
};

const FALLBACK: ModelPricing = { usdPerMTokIn: 0.2, usdPerMTokOut: 0.8, usdPerRequest: 0.0002 };

/**
 * Share of the job price that goes to the worker. v0 = 100% (the network takes
 * nothing yet); lower it later to fund the platform.
 */
export const WORKER_SHARE = 1.0;

export function pricingFor(modelId: string): ModelPricing {
  return PRICING[modelId] ?? FALLBACK;
}

/** Rough token estimate when we don't have a tokenizer server-side (~4 chars/token). */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/** Total job cost in USD (what the requesting user pays), rounded to 6 dp. */
export function jobCostUsd(modelId: string, tokensIn: number, tokensOut: number): number {
  const p = pricingFor(modelId);
  const cost = p.usdPerRequest + (tokensIn / 1e6) * p.usdPerMTokIn + (tokensOut / 1e6) * p.usdPerMTokOut;
  return round6(cost);
}

/** What the worker earns for a job in USD, rounded to 6 dp. */
export function workerEarningUsd(modelId: string, tokensIn: number, tokensOut: number): number {
  return round6(jobCostUsd(modelId, tokensIn, tokensOut) * WORKER_SHARE);
}

export function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/** Format a USD amount for display. Small amounts keep more precision. */
export function formatUsd(n: number): string {
  if (n !== 0 && Math.abs(n) < 0.01) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(2)}`;
}
