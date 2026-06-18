/**
 * Chatbot-user authentication: email + password, with a signed JWT stored in an
 * httpOnly cookie. Separate from worker auth (Bearer API key) — different actor.
 */
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/app/db/client";
import { users } from "@/app/db/schema";
import { env } from "@/app/lib/env";
import { HttpError } from "@/app/lib/http";

export const SESSION_COOKIE = "nvp_session";
const SESSION_DAYS = 30;

export type User = typeof users.$inferSelect;

function secret(): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

/** Read the session cookie from a request and return the user, or throw 401. */
export async function requireUser(req: Request): Promise<User> {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  if (!match) throw new HttpError(401, "Not authenticated");

  let userId: string;
  try {
    const { payload } = await jwtVerify(decodeURIComponent(match[1]), secret());
    userId = String(payload.sub);
  } catch {
    throw new HttpError(401, "Invalid session");
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new HttpError(401, "User no longer exists");
  return user;
}

/** Require a logged-in user who is the admin (by email). */
export async function requireAdminUser(req: Request): Promise<User> {
  const user = await requireUser(req);
  // ADMIN_EMAIL imported lazily to avoid a cycle.
  const { ADMIN_EMAIL } = await import("@/app/lib/defaults");
  if (user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    throw new HttpError(403, "Admin only");
  }
  return user;
}

export function isAdminEmail(email: string, adminEmail: string): boolean {
  return email.toLowerCase() === adminEmail.toLowerCase();
}
