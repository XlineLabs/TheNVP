import Link from "next/link";
import { NetworkStats } from "@/app/ui/NetworkStats";

export default function Home() {
  return (
    <main style={{ overflowX: "hidden" }}>
      {/* Nav */}
      <header
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "20px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <strong style={{ fontSize: 20 }}>
          <span className="gold">NVP</span> Protocol
        </strong>
        <nav style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Link href="/login">Log in</Link>
          <Link href="/signup" className="btn" style={{ padding: "9px 16px" }}>Sign up</Link>
        </nav>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: 880, margin: "0 auto", padding: "48px 20px 24px", textAlign: "center" }}>
        <div
          style={{
            display: "inline-block",
            padding: "6px 14px",
            borderRadius: 999,
            border: "1px solid var(--border)",
            color: "var(--gold)",
            fontSize: 13,
            marginBottom: 20,
          }}
        >
          ⚡ The people-powered AI network
        </div>
        <h1 style={{ fontSize: "clamp(34px, 7vw, 60px)", lineHeight: 1.05, margin: 0 }}>
          AI that runs on <span className="gold">millions of phones</span> — not datacenters.
        </h1>
        <p className="muted" style={{ fontSize: "clamp(16px,2.5vw,20px)", maxWidth: 640, margin: "22px auto 0" }}>
          Every iPhone running NVP becomes a node in a global inference network. Ask anything in the
          chatbot; the answer is computed on a real phone — and its owner gets paid, in real dollars.
          No datacenter. No middleman. A new economy for idle compute.
        </p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 32, flexWrap: "wrap" }}>
          <Link href="/signup" className="btn">Try the chatbot — $1500 free</Link>
          <Link href="/login" className="btn secondary">Log in</Link>
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
          Build the iPhone app to earn ·{" "}
          <Link href="/dashboard" className="gold">API for your apps</Link>
        </p>
        <NetworkStats />
      </section>

      {/* Stats strip */}
      <section
        style={{
          maxWidth: 880,
          margin: "10px auto 0",
          padding: "0 20px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))",
          gap: 14,
        }}
      >
        {[
          ["📱", "Phones = nodes", "Idle NPUs do the work"],
          ["💵", "Real payouts", "Owners earn per job"],
          ["🔒", "Verified", "Canaries reject fake work"],
          ["🔌", "OpenAI-compatible", "Drop-in /v1 API"],
        ].map(([icon, t, d]) => (
          <div key={t} className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 26 }}>{icon}</div>
            <div style={{ fontWeight: 700, marginTop: 6 }}>{t}</div>
            <div className="muted" style={{ fontSize: 13 }}>{d}</div>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section style={{ maxWidth: 880, margin: "60px auto 0", padding: "0 20px" }}>
        <h2 style={{ textAlign: "center" }}>How the revolution works</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px,1fr))",
            gap: 16,
            marginTop: 20,
          }}
        >
          <Step n="1" title="You ask">Send a message in the chatbot or call the API.</Step>
          <Step n="2" title="A phone answers">The job is dispatched to an online iPhone running Gemma on-device.</Step>
          <Step n="3" title="Everyone wins">You get the answer; the phone owner is paid in real USD.</Step>
        </div>
      </section>

      <footer className="muted" style={{ maxWidth: 880, margin: "70px auto 0", padding: "0 20px 50px", textAlign: "center", fontSize: 13 }}>
        NVP Protocol · central coordinator now, decentralization roadmap in <code>docs/07</code>
      </footer>
    </main>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="gold" style={{ fontSize: 28, fontWeight: 800 }}>{n}</div>
      <div style={{ fontWeight: 700, marginTop: 4 }}>{title}</div>
      <p className="muted" style={{ margin: "6px 0 0" }}>{children}</p>
    </div>
  );
}
