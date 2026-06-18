"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Worker = {
  id: string;
  platform: string;
  device_model: string | null;
  reputation: number;
  last_seen: string | null;
  is_online: boolean | null;
  jobs_done?: number;
  earned?: number;
};

type RecentJob = {
  worker_id: string;
  accepted: boolean;
  latency_ms: number | null;
  at: string;
  model_id: string;
  is_canary: boolean;
};

type Model = {
  id: string;
  name: string;
  size_mb: number;
  credit_rate: string;
  enabled: boolean;
  jobs_queued?: number;
  jobs_done?: number;
};

type Payout = {
  id: string;
  worker_id: string;
  amount: string;
  status: string;
  method: string;
  created_at: string;
};

type Overview = {
  devices_total: number;
  devices_online: number;
  devices_charging?: number;
  devices_thermal_fair?: number;
  jobs_done: number;
  jobs_last_min: number;
  jobs_queued: number;
  live_tokens_per_sec: number;
  total_paid_usd: number;
  total_earned_usd: number;
  combined_tops: number;
  nominal_tops_per_device: number;
  avg_latency_ms: number;
  success_rate: number;
  workers: Worker[];
  recent_jobs: RecentJob[];
  models: Model[];
  recent_payouts: Payout[];
};

export default function AdminPage() {
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [denied, setDenied] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"overview" | "workers" | "jobs" | "models" | "payouts">("overview");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function poll() {
      const res = await fetch("/api/admin/overview");
      if (res.status === 401) return router.replace("/login");
      if (res.status === 403) {
        setDenied(true);
        if (timer.current) clearInterval(timer.current);
        return;
      }
      if (res.ok) setData(await res.json());
    }
    poll();
    timer.current = setInterval(poll, 3000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [router]);

  if (denied)
    return (
      <main className="center" style={{ minHeight: "100vh", flexDirection: "column", gap: 12 }}>
        <h2>Admin only</h2>
        <Link href="/chat">← Back to chat</Link>
      </main>
    );
  if (!data) return <main className="center" style={{ minHeight: "100vh" }}>Loading live data…</main>;

  return (
    <main style={{ maxWidth: 1400, margin: "0 auto", padding: "2rem 1.25rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <strong style={{ fontSize: 24 }}>
          <span className="gold">NVP</span> Admin
        </strong>
        <nav style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <span className="muted" style={{ fontSize: 13 }}>
            <span style={{ color: "var(--green)" }}>●</span> live
          </span>
          <Link href="/chat">Chat</Link>
          <Link href="/dashboard">Dashboard</Link>
        </nav>
      </header>

      {/* Tab Navigation */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
        {(["overview", "workers", "jobs", "models", "payouts"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              textTransform: "capitalize",
              background: selectedTab === tab ? "var(--accent)" : "transparent",
              color: selectedTab === tab ? "var(--on-accent)" : "var(--text)",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {selectedTab === "overview" && <OverviewTab data={data} />}
      {selectedTab === "workers" && <WorkersTab workers={data.workers} />}
      {selectedTab === "jobs" && <JobsTab jobs={data.recent_jobs} jobsDone={data.jobs_done} jobsLastMin={data.jobs_last_min} />}
      {selectedTab === "models" && <ModelsTab models={data.models || []} />}
      {selectedTab === "payouts" && <PayoutsTab payouts={data.recent_payouts || []} totalPaid={data.total_paid_usd} />}
    </main>
  );
}

function OverviewTab({ data }: { data: Overview }) {
  return (
    <>
      {/* Combined power hero */}
      <div className="card" style={{ textAlign: "center", padding: "26px 16px", marginBottom: 16 }}>
        <div className="muted" style={{ fontSize: 13 }}>Combined network compute (estimate)</div>
        <div style={{ fontSize: 52, fontWeight: 800 }} className="gold">
          {data.combined_tops.toLocaleString()} <span style={{ fontSize: 24 }}>TOPS</span>
        </div>
        <div className="muted" style={{ fontSize: 12 }}>
          {data.devices_total} devices × ~{data.nominal_tops_per_device} TOPS NPU ·{" "}
          {data.live_tokens_per_sec} tok/s live
        </div>
      </div>

      {/* Stat grid - 4 columns */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 12, marginBottom: 16 }}>
        <Stat label="Devices Online" value={`${data.devices_online} / ${data.devices_total}`} accent="var(--green)" icon="📱" />
        <Stat label="Jobs Completed" value={data.jobs_done.toLocaleString()} icon="✅" />
        <Stat label="Jobs / Last Min" value={String(data.jobs_last_min)} icon="⚡" />
        <Stat label="Live TOK/s" value={data.live_tokens_per_sec.toFixed(1)} icon="🚀" />
        <Stat label="Avg Latency" value={`${data.avg_latency_ms}ms`} icon="⏱️" />
        <Stat label="Success Rate" value={`${(data.success_rate * 100).toFixed(1)}%`} icon="🎯" />
        <Stat label="Total Paid Out" value={`$${data.total_paid_usd.toFixed(4)}`} accent="var(--gold)" icon="💰" />
        <Stat label="Total Earned" value={`$${data.total_earned_usd?.toFixed(4) || "$0"}`} accent="var(--green)" icon="📈" />
      </div>

      {/* Workers + Activity side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px,1fr))", gap: 14 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Active Workers</h3>
          {data.workers.length === 0 && <p className="muted">No workers yet.</p>}
          {data.workers.slice(0, 10).map((w) => (
            <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ color: w.is_online ? "var(--green)" : "var(--muted)", fontSize: 18 }}>●</span>
              <code style={{ fontSize: 12 }}>{w.id}</code>
              <span className="muted" style={{ fontSize: 12 }}>{w.device_model ?? w.platform}</span>
              <span style={{ flex: 1 }} />
              <span className="muted" style={{ fontSize: 11 }}>rep {w.reputation?.toFixed(2) || "1.00"}</span>
              <span className="muted" style={{ fontSize: 11 }}>{w.last_seen ?? "—"}</span>
            </div>
          ))}
          {data.workers.length > 10 && (
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>+{data.workers.length - 10} more workers</p>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Live Activity</h3>
          {data.recent_jobs.length === 0 && <p className="muted">No recent jobs.</p>}
          {data.recent_jobs.slice(0, 15).map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 12, borderBottom: "1px solid var(--border)" }}>
              <span style={{ color: r.accepted ? "var(--green)" : "var(--red)" }}>{r.accepted ? "✓" : "✗"}</span>
              <span className="muted">{r.at}</span>
              <code style={{ fontSize: 11 }}>{r.worker_id.slice(0, 12)}...</code>
              <span style={{ flex: 1 }} />
              <span className="gold">{r.model_id}</span>
              {r.is_canary && <span style={{ background: "var(--red)", color: "white", padding: "2px 6px", borderRadius: 4, fontSize: 10 }}>canary</span>}
              {r.latency_ms != null && <span className="muted">{r.latency_ms}ms</span>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function WorkersTab({ workers }: { workers: Worker[] }) {
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>All Workers ({workers.length})</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border)" }}>
              <th style={{ textAlign: "left", padding: "8px", color: "var(--muted)", fontSize: 12 }}>Status</th>
              <th style={{ textAlign: "left", padding: "8px", color: "var(--muted)", fontSize: 12 }}>Worker ID</th>
              <th style={{ textAlign: "left", padding: "8px", color: "var(--muted)", fontSize: 12 }}>Platform</th>
              <th style={{ textAlign: "left", padding: "8px", color: "var(--muted)", fontSize: 12 }}>Device</th>
              <th style={{ textAlign: "left", padding: "8px", color: "var(--muted)", fontSize: 12 }}>Reputation</th>
              <th style={{ textAlign: "left", padding: "8px", color: "var(--muted)", fontSize: 12 }}>Last Seen</th>
              <th style={{ textAlign: "left", padding: "8px", color: "var(--muted)", fontSize: 12 }}>Jobs Done</th>
              <th style={{ textAlign: "left", padding: "8px", color: "var(--muted)", fontSize: 12 }}>Earned</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((w) => (
              <tr key={w.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "8px" }}>
                  <span style={{ color: w.is_online ? "var(--green)" : "var(--muted)", fontSize: 18 }}>●</span>
                </td>
                <td style={{ padding: "8px", fontFamily: "monospace", fontSize: 11 }}>{w.id}</td>
                <td style={{ padding: "8px", fontSize: 12 }}>{w.platform}</td>
                <td style={{ padding: "8px", fontSize: 12 }}>{w.device_model ?? "—"}</td>
                <td style={{ padding: "8px", fontSize: 12 }}>{w.reputation?.toFixed(3) || "1.000"}</td>
                <td style={{ padding: "8px", fontSize: 12 }}>{w.last_seen ?? "—"}</td>
                <td style={{ padding: "8px", fontSize: 12 }}>{w.jobs_done ?? 0}</td>
                <td style={{ padding: "8px", fontSize: 12, color: "var(--green)" }}>${w.earned?.toFixed(4) || "0"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function JobsTab({ jobs, jobsDone, jobsLastMin }: { jobs: RecentJob[]; jobsDone: number; jobsLastMin: number }) {
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Job History</h3>
      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        <div style={{ padding: "12px 16px", background: "var(--elev)", borderRadius: 8 }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{jobsDone.toLocaleString()}</div>
          <div className="muted" style={{ fontSize: 12 }}>Total Completed</div>
        </div>
        <div style={{ padding: "12px 16px", background: "var(--elev)", borderRadius: 8 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--green)" }}>{jobsLastMin}</div>
          <div className="muted" style={{ fontSize: 12 }}>Last Minute</div>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border)" }}>
              <th style={{ textAlign: "left", padding: "8px", color: "var(--muted)", fontSize: 12 }}>Status</th>
              <th style={{ textAlign: "left", padding: "8px", color: "var(--muted)", fontSize: 12 }}>Time</th>
              <th style={{ textAlign: "left", padding: "8px", color: "var(--muted)", fontSize: 12 }}>Worker</th>
              <th style={{ textAlign: "left", padding: "8px", color: "var(--muted)", fontSize: 12 }}>Model</th>
              <th style={{ textAlign: "left", padding: "8px", color: "var(--muted)", fontSize: 12 }}>Type</th>
              <th style={{ textAlign: "left", padding: "8px", color: "var(--muted)", fontSize: 12 }}>Latency</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "8px" }}>
                  <span style={{ color: j.accepted ? "var(--green)" : "var(--red)", fontWeight: 700 }}>{j.accepted ? "✓" : "✗"}</span>
                </td>
                <td style={{ padding: "8px", fontSize: 12 }}>{j.at}</td>
                <td style={{ padding: "8px", fontFamily: "monospace", fontSize: 11 }}>{j.worker_id.slice(0, 12)}...</td>
                <td style={{ padding: "8px", fontSize: 12, color: "var(--gold)" }}>{j.model_id}</td>
                <td style={{ padding: "8px", fontSize: 12 }}>
                  {j.is_canary ? (
                    <span style={{ background: "var(--red)", color: "white", padding: "2px 6px", borderRadius: 4, fontSize: 10 }}>canary</span>
                  ) : (
                    <span style={{ color: "var(--muted)" }}>job</span>
                  )}
                </td>
                <td style={{ padding: "8px", fontSize: 12 }}>{j.latency_ms != null ? `${j.latency_ms}ms` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ModelsTab({ models }: { models: Model[] }) {
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Available Models</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border)" }}>
              <th style={{ textAlign: "left", padding: "8px", color: "var(--muted)", fontSize: 12 }}>Name</th>
              <th style={{ textAlign: "left", padding: "8px", color: "var(--muted)", fontSize: 12 }}>ID</th>
              <th style={{ textAlign: "left", padding: "8px", color: "var(--muted)", fontSize: 12 }}>Size</th>
              <th style={{ textAlign: "left", padding: "8px", color: "var(--muted)", fontSize: 12 }}>Credit Rate</th>
              <th style={{ textAlign: "left", padding: "8px", color: "var(--muted)", fontSize: 12 }}>Status</th>
              <th style={{ textAlign: "left", padding: "8px", color: "var(--muted)", fontSize: 12 }}>Jobs Queued</th>
              <th style={{ textAlign: "left", padding: "8px", color: "var(--muted)", fontSize: 12 }}>Jobs Done</th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "8px", fontWeight: 600 }}>{m.name}</td>
                <td style={{ padding: "8px", fontFamily: "monospace", fontSize: 11 }}>{m.id}</td>
                <td style={{ padding: "8px", fontSize: 12 }}>{(m.size_mb / 1024).toFixed(2)} GB</td>
                <td style={{ padding: "8px", fontSize: 12, color: "var(--gold)" }}>${m.credit_rate}/job</td>
                <td style={{ padding: "8px", fontSize: 12 }}>
                  <span style={{ color: m.enabled ? "var(--green)" : "var(--red)" }}>{m.enabled ? "● Enabled" : "○ Disabled"}</span>
                </td>
                <td style={{ padding: "8px", fontSize: 12 }}>{m.jobs_queued ?? 0}</td>
                <td style={{ padding: "8px", fontSize: 12 }}>{m.jobs_done ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PayoutsTab({ payouts, totalPaid }: { payouts: Payout[]; totalPaid: number }) {
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Payout Requests</h3>
      <div style={{ marginBottom: 16, padding: "12px 16px", background: "var(--elev)", borderRadius: 8 }}>
        <span className="muted" style={{ fontSize: 12 }}>Total Paid Out: </span>
        <span style={{ fontWeight: 700, color: "var(--gold)" }}>${totalPaid.toFixed(4)}</span>
      </div>
      {payouts.length === 0 && <p className="muted">No payout requests.</p>}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border)" }}>
              <th style={{ textAlign: "left", padding: "8px", color: "var(--muted)", fontSize: 12 }}>ID</th>
              <th style={{ textAlign: "left", padding: "8px", color: "var(--muted)", fontSize: 12 }}>Worker</th>
              <th style={{ textAlign: "left", padding: "8px", color: "var(--muted)", fontSize: 12 }}>Amount</th>
              <th style={{ textAlign: "left", padding: "8px", color: "var(--muted)", fontSize: 12 }}>Method</th>
              <th style={{ textAlign: "left", padding: "8px", color: "var(--muted)", fontSize: 12 }}>Status</th>
              <th style={{ textAlign: "left", padding: "8px", color: "var(--muted)", fontSize: 12 }}>Date</th>
              <th style={{ textAlign: "left", padding: "8px", color: "var(--muted)", fontSize: 12 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "8px", fontFamily: "monospace", fontSize: 10 }}>{p.id}</td>
                <td style={{ padding: "8px", fontFamily: "monospace", fontSize: 10 }}>{p.worker_id.slice(0, 12)}...</td>
                <td style={{ padding: "8px", fontWeight: 600, color: "var(--green)" }}>${p.amount}</td>
                <td style={{ padding: "8px", fontSize: 12 }}>{p.method}</td>
                <td style={{ padding: "8px", fontSize: 12 }}>
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 11,
                    background: p.status === "paid" ? "var(--green)" : p.status === "approved" ? "var(--gold)" : "var(--elev)",
                    color: p.status === "paid" || p.status === "approved" ? "var(--bg)" : "var(--text)"
                  }}>
                    {p.status}
                  </span>
                </td>
                <td style={{ padding: "8px", fontSize: 12 }}>{p.created_at?.slice(0, 10) || "—"}</td>
                <td style={{ padding: "8px" }}>
                  {p.status === "requested" && (
                    <div style={{ display: "flex", gap: 4 }}>
                      <button style={{ padding: "4px 8px", fontSize: 11, background: "var(--green)", color: "var(--bg)", border: "none", borderRadius: 4, cursor: "pointer" }}>
                        Approve
                      </button>
                      <button style={{ padding: "4px 8px", fontSize: 11, background: "var(--red)", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
                        Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, accent, icon }: { label: string; value: string; accent?: string; icon?: string }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
      {icon && <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>}
      <div style={{ fontSize: 28, fontWeight: 700, color: accent ?? "var(--text)" }}>{value}</div>
      <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{label}</div>
    </div>
  );
}