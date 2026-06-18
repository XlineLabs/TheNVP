/**
 * Baked-in defaults so the project runs right after a GitHub→Vercel import with
 * ZERO environment configuration. Environment variables, when set, ALWAYS win
 * (see env.ts and the db CLI scripts).
 *
 * ⚠️ SECURITY: these embed real credentials in the repo. Fine for a PRIVATE repo
 * during the beta, but anyone with repo access can reach the database. For
 * production: set DATABASE_URL / ADMIN_TOKEN / JWT_SECRET as Vercel env vars and
 * rotate the Neon password.
 */
export const DEFAULTS = {
  DATABASE_URL:
    "postgresql://neondb_owner:npg_nitaCGJgk43h@ep-old-rice-ahbkw5hf-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
  // Default admin/requester token (change for production).
  ADMIN_TOKEN: "nvp-default-admin-token-change-me",
  // Default cookie-signing secret (change for production).
  JWT_SECRET: "nvp-default-jwt-secret-change-me-please-rotate",
};

/** The chatbot account that gets the admin dashboard. */
export const ADMIN_EMAIL = "tuikosite@gmail.com";

/** Nominal on-device NPU throughput (TOPS) per worker for the combined-power estimate. */
export const NOMINAL_TOPS_PER_DEVICE = 35;
