"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Me = { email: string; balance: number };
type Msg = { role: "user" | "assistant"; content: string; cost_usd?: number | null; pending?: boolean };
type Conv = { id: string; title: string };
type Model = { id: string; name: string };
type Stats = { devices_online: number; combined_tops: number; live_tokens_per_sec: number };

function usd(n: number): string {
  if (n !== 0 && Math.abs(n) < 0.01) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(2)}`;
}

const SUGGESTIONS = [
  "Explain quantum computing simply",
  "Write a Python script to rename files",
  "Latest AI news (turn on Web)",
  "Draft a polite follow-up email",
];

export default function ChatPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [model, setModel] = useState("gemma3_1b");
  const [webSearch, setWebSearch] = useState(false);
  const [reasoning, setReasoning] = useState(false);
  const [boost, setBoost] = useState(false);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const lastUserText = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConvs = useCallback(async () => {
    const res = await fetch("/api/conversations");
    if (res.ok) setConvs((await res.json()).conversations);
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me");
      if (res.status === 401) return router.replace("/login");
      const data = await res.json();
      setMe({ email: data.user.email, balance: data.balance });
      loadConvs();
      const cat = await fetch("/api/catalog");
      if (cat.ok) {
        const list = (await cat.json()).models as Model[];
        setModels(list);
        if (list.length && !list.find((m) => m.id === "gemma3_1b")) setModel(list[0].id);
      }
    })();
  }, [router, loadConvs]);

  useEffect(() => {
    const poll = async () => {
      const r = await fetch("/api/stats");
      if (r.ok) setStats(await r.json());
    };
    poll();
    const t = setInterval(poll, 8000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  async function waitForReply(convId: string, jobId: string): Promise<Msg | null> {
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      await sleep(700);
      const res = await fetch(`/api/conversations/${convId}`);
      if (!res.ok) continue;
      const data = await res.json();
      const found = data.messages.find(
        (m: { role: string; job_id?: string }) => m.role === "assistant" && m.job_id === jobId,
      );
      if (found) return { role: "assistant", content: found.content, cost_usd: found.cost_usd };
    }
    return null;
  }

  async function openConversation(id: string) {
    setActiveConv(id);
    setError("");
    setSidebarOpen(false);
    const res = await fetch(`/api/conversations/${id}`);
    if (res.ok) setMessages((await res.json()).messages);
  }

  function newChat() {
    setActiveConv(null);
    setMessages([]);
    setError("");
  }

  async function submitText(text: string) {
    if (!text || sending) return;
    lastUserText.current = text;
    setError("");
    setInput("");
    setSending(true);
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "", pending: true }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, conversation_id: activeConv ?? undefined, model, web_search: webSearch, reasoning, boost }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((m) => m.filter((x) => !x.pending));
        setError(data.error ?? "Failed to send");
        return;
      }
      setActiveConv(data.conversation_id);
      loadConvs();
      const reply = await waitForReply(data.conversation_id, data.job_id);
      if (!reply) {
        setMessages((m) => m.filter((x) => !x.pending));
        setError("No worker answered in time. Open the NVP iPhone app as a worker, then retry.");
        return;
      }
      setMessages((m) => [...m.filter((x) => !x.pending), reply]);
    } catch {
      setMessages((m) => m.filter((x) => !x.pending));
      setError("Network error");
    } finally {
      setSending(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  if (!me) return <main className="center" style={{ minHeight: "100vh" }}>Loading…</main>;

  return (
    <main className="chat-shell">
      <div className={`chat-overlay ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />

      {/* Sidebar */}
      <aside className={`chat-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <div style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}>
            <strong style={{ fontSize: 20 }}><span className="gold">NVP</span> Chat</strong>
          </div>

          <button
            className="btn"
            style={{ margin: "12px", padding: "12px" }}
            onClick={() => { newChat(); setSidebarOpen(false); }}
          >
            + New chat
          </button>

          <a
            href="/dashboard"
            className="btn secondary"
            style={{ textAlign: "center", textDecoration: "none", margin: "0 12px", padding: "10px" }}
          >
            Account & API keys
          </a>

          <div style={{ overflowY: "auto", flex: 1, marginTop: 12, padding: "0 12px" }}>
            {convs.map((c) => (
              <div
                key={c.id}
                onClick={() => openConversation(c.id)}
                style={{
                  padding: "12px",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontSize: 14,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  background: c.id === activeConv ? "var(--bg-elev-2)" : "transparent",
                  marginBottom: 4,
                }}
              >
                {c.title}
              </div>
            ))}
          </div>

          <div style={{ borderTop: "1px solid var(--border)", padding: "12px" }}>
            <div style={{ marginBottom: 8 }}>
              <span className="muted" style={{ fontSize: 12 }}>{me.email}</span>
              <div className="muted" style={{ fontSize: 11 }}>
                Balance: <span style={{ color: "var(--gold)" }}>{usd(me.balance)}</span>
              </div>
            </div>
            {stats && (
              <div style={{ fontSize: 11, color: "var(--green)", marginBottom: 8 }}>
                ● {stats.devices_online} workers online
              </div>
            )}
            <button
              className="btn secondary"
              style={{ width: "100%", padding: "10px", fontSize: 13 }}
              onClick={logout}
            >
              Log out
            </button>
          </div>
        </div>
      </aside>

      {/* Main chat area */}
      <section style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top bar */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-elev)"
        }}>
          <button className="chat-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Menu">☰</button>
          <strong style={{ fontSize: 16 }}><span className="gold">NVP</span> Chat</strong>
          <span style={{ flex: 1 }} />

          {/* Live network badge */}
          {stats && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              background: "var(--elev)",
              borderRadius: 20,
              fontSize: 12
            }}>
              <span style={{ color: "var(--green)", animation: "pulse 2s infinite" }}>●</span>
              <span className="muted">{stats.devices_online} phones</span>
              <span className="gold">·</span>
              <span className="muted">{stats.combined_tops.toLocaleString()} TOPS</span>
            </div>
          )}
        </div>

        {/* Messages area */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "24px 0" }}>
          <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 20px" }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: "center", marginTop: 60 }}>
                {/* Hero section */}
                <div style={{
                  display: "inline-block",
                  padding: "8px 16px",
                  borderRadius: 20,
                  border: "1px solid var(--border)",
                  color: "var(--gold)",
                  fontSize: 13,
                  marginBottom: 24,
                }}>
                  ⚡ Powered by real iPhones
                </div>
                <h2 style={{ fontSize: 36, marginBottom: 12 }}>
                  Ask the <span className="gold">network</span>
                </h2>
                <p className="muted" style={{ fontSize: 16, maxWidth: 400, margin: "0 auto 28px" }}>
                  Answered live by real iPhones running AI models. Free during beta.
                </p>

                {/* Suggestions */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px,1fr))",
                  gap: 12,
                  textAlign: "left",
                  maxWidth: 600,
                  margin: "0 auto"
                }}>
                  {SUGGESTIONS.map((s) => (
                    <div
                      key={s}
                      className="card"
                      style={{ cursor: "pointer", padding: "16px" }}
                      onClick={() => submitText(s)}
                    >
                      <span style={{ fontSize: 14 }}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <MessageBubble key={i} msg={m} onRegenerate={i === messages.length - 1 && m.role === "assistant" && !m.pending ? () => submitText(lastUserText.current) : undefined} />
              ))
            )}
            {error && (
              <div style={{
                textAlign: "center",
                marginTop: 16,
                padding: "12px 20px",
                background: "rgba(239, 68, 68, 0.1)",
                borderRadius: 12,
                color: "var(--red)"
              }}>
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Input area */}
        <form
          onSubmit={(e) => { e.preventDefault(); submitText(input.trim()); }}
          style={{
            borderTop: "1px solid var(--border)",
            padding: "16px",
            background: "var(--bg-elev)"
          }}
        >
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            {/* Controls row */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="input"
                style={{ width: "auto", marginTop: 0, padding: "8px 12px" }}
              >
                {models.length === 0 && <option value="gemma3_1b">Gemma 3 1B</option>}
                {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <Toggle label="🔎 Web" on={webSearch} set={setWebSearch} />
              <Toggle label="💭 Reason" on={reasoning} set={setReasoning} />
              <Toggle label="⚡ Boost" on={boost} set={setBoost} />
            </div>

            {/* Input row */}
            <div style={{ display: "flex", gap: 10 }}>
              <input
                className="input"
                style={{ flex: 1, marginTop: 0 }}
                placeholder="Message the network…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={sending}
              />
              <button
                className="btn"
                disabled={sending || !input.trim()}
                style={{ padding: "12px 20px" }}
              >
                {sending ? (
                  <span className="thinking-dots"><span>.</span><span>.</span><span>.</span></span>
                ) : "Send"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => set(!on)}
      style={{
        padding: "8px 14px",
        borderRadius: 20,
        border: "1px solid var(--border)",
        cursor: "pointer",
        fontSize: 13,
        background: on ? "var(--accent)" : "transparent",
        color: on ? "var(--on-accent)" : "var(--text)",
        fontWeight: 600,
      }}
    >
      {label}
    </button>
  );
}

function MessageBubble({ msg, onRegenerate }: { msg: Msg; onRegenerate?: () => void }) {
  return (
    <div style={{ margin: "20px 0", display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: 12, marginBottom: 6, color: "var(--muted)" }}>
        {msg.role === "user" ? "You" : "📱 Phone worker"}
      </div>
      <div style={{
        padding: "16px 20px",
        background: msg.role === "user" ? "var(--bg-elev-2)" : "var(--bg-elev)",
        borderRadius: 20,
        borderTopLeft: msg.role === "user" ? 20 : 4,
        borderTopRight: msg.role === "user" ? 4 : 20,
      }}>
        {msg.pending ? (
          <span className="muted">
            💭 The AI is thinking
            <span className="thinking-dots"><span>.</span><span>.</span><span>.</span></span>
          </span>
        ) : msg.role === "assistant" ? (
          <Markdown content={msg.content} />
        ) : (
          <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
        )}
      </div>
      {!msg.pending && msg.role === "assistant" && (
        <div style={{ display: "flex", gap: 12, marginTop: 8, alignItems: "center" }}>
          {msg.cost_usd != null && (
            <span className="muted" style={{ fontSize: 11 }}>
              worker earned {usd(msg.cost_usd)} · free for you
            </span>
          )}
          <span style={{ flex: 1 }} />
          <button style={linkBtn} className="muted" onClick={() => navigator.clipboard.writeText(msg.content)}>Copy</button>
          {onRegenerate && (
            <button style={{ ...linkBtn, color: "var(--gold)" }} onClick={onRegenerate}>Regenerate</button>
          )}
        </div>
      )}
    </div>
  );
}

function Markdown({ content }: { content: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
          pre: ({ children }) => <CodeFromPre>{children}</CodeFromPre>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function CodeFromPre({ children }: { children: React.ReactNode }) {
  const codeEl: any = Array.isArray(children) ? children[0] : children;
  const className: string = codeEl?.props?.className ?? "";
  const lang = /language-(\w+)/.exec(className)?.[1] ?? "txt";
  const body = String(codeEl?.props?.children ?? "").replace(/\n$/, "");
  return <CodeBlock lang={lang} body={body} />;
}

function CodeBlock({ lang, body }: { lang: string; body: string }) {
  const ext: Record<string, string> = {
    py: "py", python: "py", js: "js", ts: "ts", tsx: "tsx", swift: "swift",
    json: "json", sh: "sh", bash: "sh", html: "html", css: "css", md: "md", txt: "txt",
  };
  function download() {
    const blob = new Blob([body], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nvp-output.${ext[lang] ?? "txt"}`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span className="muted" style={{ fontSize: 11 }}>{lang}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="muted" style={linkBtn} onClick={() => navigator.clipboard.writeText(body)}>Copy</button>
          <button style={{ ...linkBtn, color: "var(--gold)" }} onClick={download}>Download</button>
        </div>
      </div>
      <pre style={{
        background: "var(--bg-elev-2)",
        padding: 14,
        borderRadius: 12,
        overflowX: "auto",
        fontSize: 13,
        margin: 0
      }}>{body}</pre>
    </div>
  );
}

const linkBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: 12,
  padding: "4px 8px"
};