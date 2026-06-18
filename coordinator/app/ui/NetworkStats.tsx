"use client";

import { useEffect, useState } from "react";

type Stats = {
  devices_online: number;
  devices_total: number;
  combined_tops: number;
  live_tokens_per_sec: number;
  jobs_done: number;
};

export function NetworkStats() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch("/api/stats");
        if (r.ok) setS(await r.json());
      } catch {
        /* ignore */
      }
    };
    poll();
    const t = setInterval(poll, 6000);
    return () => clearInterval(t);
  }, []);

  if (!s) return null;
  const items = [
    [`${s.devices_online}`, "phones online"],
    [`${s.combined_tops.toLocaleString()}`, "TOPS combined"],
    [`${s.live_tokens_per_sec}`, "tokens/sec live"],
    [`${s.jobs_done.toLocaleString()}`, "jobs answered"],
  ];
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        justifyContent: "center",
        flexWrap: "wrap",
        marginTop: 26,
      }}
    >
      {items.map(([v, l]) => (
        <div key={l} className="card" style={{ padding: "10px 16px", textAlign: "center" }}>
          <div className="gold" style={{ fontSize: 22, fontWeight: 800 }}>{v}</div>
          <div className="muted" style={{ fontSize: 12 }}>{l}</div>
        </div>
      ))}
    </div>
  );
}
