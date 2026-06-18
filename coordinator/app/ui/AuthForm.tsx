"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Something went wrong");
        return;
      }
      router.push("/chat");
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="center" style={{ minHeight: "100vh", padding: 20 }}>
      <div className="card" style={{ width: "100%", maxWidth: 380 }}>
        <Link href="/" className="muted" style={{ fontSize: 13 }}>
          ← NVP Node
        </Link>
        <h1 style={{ marginTop: 12 }}>{isSignup ? "Create your account" : "Welcome back"}</h1>
        {isSignup && (
          <p className="muted" style={{ marginTop: -8 }}>
            Get $1500 free credit to use the chatbot.
          </p>
        )}
        <form onSubmit={submit}>
          <label style={{ display: "block", marginTop: 14 }}>
            Email
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label style={{ display: "block", marginTop: 14 }}>
            Password
            <input
              className="input"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>
          {err && <div className="error">{err}</div>}
          <button className="btn" style={{ width: "100%", marginTop: 18 }} disabled={busy}>
            {busy ? "…" : isSignup ? "Sign up" : "Log in"}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 16, fontSize: 14 }}>
          {isSignup ? (
            <>
              Already have an account? <Link href="/login">Log in</Link>
            </>
          ) : (
            <>
              No account? <Link href="/signup">Sign up</Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
