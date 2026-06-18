"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Me = { email: string; balance: number; isAdmin: boolean };
type WorkerStatus = {
  has_worker: boolean;
  devices: number;
  online: number;
  jobs_done: number;
  earned: number;
};
type Key = {
  id: string;
  name: string;
  prefix: string;
  revoked: boolean;
  last_used_at: string | null;
  created_at: string;
};

function usd(n: number): string {
  if (n !== 0 && Math.abs(n) < 0.01) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(2)}`;
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent ? "var(--gold)" : "var(--text)" }}>{value}</div>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [keys, setKeys] = useState<Key[]>([]);
  const [newName, setNewName] = useState("");
  const [created, setCreated] = useState<{ name: string; key: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [worker, setWorker] = useState<WorkerStatus | null>(null);

  const loadKeys = useCallback(async () => {
    const res = await fetch("/api/keys");
    if (res.ok) setKeys((await res.json()).keys);
  }, []);

  useEffect(() => {
    setBaseUrl(window.location.origin);
    (async () => {
      const res = await fetch("/api/auth/me");
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const data = await res.json();
      setMe({ email: data.user.email, balance: data.balance, isAdmin: !!data.is_admin });
      loadKeys();
      const ws = await fetch("/api/me/worker");
      if (ws.ok) setWorker(await ws.json());
    })();
  }, [router, loadKeys]);

  async function createKey() {
    setBusy(true);
    setCreated(null);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newName.trim() || "API key" }),
      });
      const data = await res.json();
      if (res.ok) {
        setCreated({ name: data.name, key: data.key });
        setNewName("");
        loadKeys();
      }
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    await fetch(`/api/keys/${id}`, { method: "DELETE" });
    loadKeys();
  }

  if (!me) return <main className="center" style={{ minHeight: "100vh" }}>Loading…</main>;

  const curl = `curl ${baseUrl}/v1/chat/completions \\
  -H "Authorization: Bearer $NVP_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "qwen2_5_0_5b",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`;

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ fontSize: 20 }}>
          <span className="gold">NVP</span> Dashboard
        </strong>
        <nav style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Link href="/chat">Chat</Link>
          {me.isAdmin && <Link href="/admin" className="gold">Admin</Link>}
          <span className="gold" style={{ fontWeight: 700 }}>{usd(me.balance)}</span>
        </nav>
      </header>

      {/* Worker status (only if this account is linked to a worker device) */}
      {worker?.has_worker && (
        <div className="card" style={{ marginTop: 18 }}>
          <h3 style={{ marginTop: 0 }}>📱 Worker status</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12 }}>
            <Metric label="Devices" value={`${worker.online}/${worker.devices} online`} />
            <Metric label="Jobs done" value={String(worker.jobs_done)} />
            <Metric label="Earned" value={usd(worker.earned)} accent />
          </div>
          <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
            Earnings from your iPhone(s) running the NVP worker, linked to this account.
          </p>
        </div>
      )}

      <h1 style={{ marginTop: 28 }}>API keys</h1>
      <p className="muted" style={{ marginTop: -8 }}>
        Use NVP from any OpenAI-compatible app (OpenClaw, etc.). Requests are answered by the phone
        network and billed from your balance.
      </p>

      {/* Create */}
      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label className="muted" style={{ fontSize: 13 }}>Key name</label>
            <input
              className="input"
              placeholder="e.g. OpenClaw"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <button className="btn" onClick={createKey} disabled={busy}>
            {busy ? "Creating…" : "Create API key"}
          </button>
        </div>
        {created && (
          <div style={{ marginTop: 14 }}>
            <div className="muted" style={{ fontSize: 13 }}>
              Copy your key now — it won’t be shown again:
            </div>
            <code
              style={{
                display: "block",
                marginTop: 6,
                padding: "10px 12px",
                background: "var(--bg-elev-2)",
                borderRadius: 8,
                wordBreak: "break-all",
                color: "var(--green)",
              }}
            >
              {created.key}
            </code>
          </div>
        )}
      </div>

      {/* List */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Your keys</h3>
        {keys.length === 0 && <p className="muted">No keys yet.</p>}
        {keys.map((k) => (
          <div
            key={k.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 0",
              borderBottom: "1px solid var(--border)",
              opacity: k.revoked ? 0.5 : 1,
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{k.name}</div>
              <code className="muted" style={{ fontSize: 13 }}>{k.prefix}</code>
              {k.revoked && <span style={{ color: "var(--red)", marginLeft: 8 }}>revoked</span>}
            </div>
            {!k.revoked && (
              <button className="btn secondary" style={{ padding: "6px 12px" }} onClick={() => revoke(k.id)}>
                Revoke
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Usage */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Use it</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Base URL <code className="gold">{baseUrl}/v1</code> · model{" "}
          <code className="gold">qwen2_5_0_5b</code> · OpenAI-compatible (<code>/v1/chat/completions</code>,{" "}
          <code>/v1/models</code>).
        </p>
        <pre
          style={{
            background: "var(--bg-elev-2)",
            padding: 14,
            borderRadius: 8,
            overflowX: "auto",
            fontSize: 13,
            whiteSpace: "pre-wrap",
          }}
        >
          {curl}
        </pre>
        <p className="muted" style={{ fontSize: 13 }}>
          Note: decoding is deterministic (greedy); `temperature` is ignored. A worker (iPhone) must be
          online to answer.
        </p>
      </div>
    </main>
  );
}
