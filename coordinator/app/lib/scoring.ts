/**
 * Verification & reputation knobs (docs/02 §verif). M2 implements canary
 * checking; M4 adds redundancy + gating using the same constants.
 */
export const SCORING = {
  /** Fraction of dispatched jobs that should be canaries (used in M4 injection). */
  P_CANARY: 0.1,
  /** Reputation lost when a canary answer is wrong. */
  REPUTATION_PENALTY: 0.1,
  /** Small reputation gain on a verified-correct canary (capped at 1.0). */
  REPUTATION_REWARD: 0.02,
  /** Below this score a worker is suspended (enforced in M4 gating). */
  REPUTATION_FLOOR: 0.3,
  REPUTATION_MAX: 1.0,
};

/**
 * Normalize generative output before comparing to the expected canary answer.
 * Greedy decoding makes outputs deterministic, but we still trim and collapse
 * whitespace to absorb harmless formatting differences (docs/06 §5 caveat).
 * Intentionally case-sensitive: same model + quant yields identical casing.
 */
export function normalizeOutput(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

export function canaryMatches(output: string, expected: string): boolean {
  return normalizeOutput(output) === normalizeOutput(expected);
}

export function clampReputation(r: number): number {
  return Math.max(0, Math.min(SCORING.REPUTATION_MAX, r));
}
