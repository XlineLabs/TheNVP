import { randomBytes } from "crypto";

/** Short, URL-safe random suffix (base62-ish via hex+base36 mix is overkill; hex is fine). */
function rand(n = 8): string {
  return randomBytes(Math.ceil(n / 2))
    .toString("hex")
    .slice(0, n);
}

/** Prefixed id, e.g. id("jb") -> "jb_3f9a1c2b". */
export function id(prefix: string): string {
  return `${prefix}_${rand(8)}`;
}

/** API key shown to the worker once at registration (never stored in clear). */
export function newApiKey(): string {
  return `nvp_live_${randomBytes(24).toString("hex")}`;
}

/** User-facing API key for external apps (OpenAI-compatible). Shown once. */
export function newUserApiKey(): string {
  return `sk-nvp-${randomBytes(24).toString("hex")}`;
}
