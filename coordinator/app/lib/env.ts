/**
 * Centralized environment access. Falls back to baked-in DEFAULTS (defaults.ts)
 * so the app runs after a GitHub→Vercel import with no env configuration.
 * Set the matching env vars on Vercel to override for production.
 */
import { DEFAULTS } from "./defaults";

function valueOr(name: keyof typeof DEFAULTS): string {
  const v = process.env[name];
  return v && v.length > 0 ? v : DEFAULTS[name];
}

export const env = {
  /** Neon (or any Postgres) connection string. Use the *pooled* endpoint on Vercel. */
  get DATABASE_URL(): string {
    return valueOr("DATABASE_URL");
  },
  /** Shared secret for admin + requester endpoints (seed, canaries, payouts approval, job submit). */
  get ADMIN_TOKEN(): string {
    return valueOr("ADMIN_TOKEN");
  },
  /** Secret used to sign chatbot-user session JWTs. */
  get JWT_SECRET(): string {
    return valueOr("JWT_SECRET");
  },
};

/** Free USD balance granted to a chatbot user on signup (v0; no real money moves). */
export const SIGNUP_GRANT_USD = 1500;
