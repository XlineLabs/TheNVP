"use client";

import { useState } from "react";

/**
 * Minimal requester test page (docs/01): submit a job via POST /api/jobs using
 * the admin token. Not a rich UI — just enough to enqueue jobs by hand.
 */
export default function TestPage() {
  const [adminToken, setAdminToken] = useState("");
  const [model, setModel] = useState("gemma_4_e2b_it_4bit");
  const [prompt, setPrompt] = useState("Summarize in one sentence: the sky is blue because of Rayleigh scattering.");
  const [maxTokens, setMaxTokens] = useState(128);
  const [result, setResult] = useState<string>("");

  async function submit() {
    setResult("submitting…");
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": adminToken },
        body: JSON.stringify({ model, prompt, max_tokens: maxTokens }),
      });
      setResult(`HTTP ${res.status}\n` + JSON.stringify(await res.json(), null, 2));
    } catch (e) {
      setResult("Error: " + String(e));
    }
  }

  const field: React.CSSProperties = {
    width: "100%",
    padding: 8,
    marginTop: 4,
    background: "#0f1b2e",
    color: "#e7ecf3",
    border: "1px solid #25324a",
    borderRadius: 6,
  };

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
      <h1 style={{ color: "#e9c46a" }}>Submit a job (requester)</h1>
      <label>
        Admin token
        <input style={field} value={adminToken} onChange={(e) => setAdminToken(e.target.value)} type="password" />
      </label>
      <label style={{ display: "block", marginTop: 12 }}>
        Model id
        <input style={field} value={model} onChange={(e) => setModel(e.target.value)} />
      </label>
      <label style={{ display: "block", marginTop: 12 }}>
        Prompt
        <textarea style={{ ...field, height: 100 }} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      </label>
      <label style={{ display: "block", marginTop: 12 }}>
        max_tokens
        <input
          style={field}
          type="number"
          value={maxTokens}
          onChange={(e) => setMaxTokens(Number(e.target.value))}
        />
      </label>
      <button
        onClick={submit}
        style={{
          marginTop: 16,
          padding: "10px 18px",
          background: "#e9c46a",
          color: "#0b1220",
          border: "none",
          borderRadius: 8,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Submit job
      </button>
      {result && (
        <pre style={{ ...field, marginTop: 16, whiteSpace: "pre-wrap" }}>{result}</pre>
      )}
    </main>
  );
}
