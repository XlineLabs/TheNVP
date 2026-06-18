/**
 * Free web search via DuckDuckGo's HTML endpoint — no API key, no cost
 * (per the requirement). Best-effort HTML scraping; fragile to layout changes
 * but dependency-free. Used to give the chatbot internet access ("agent" mode).
 */
export type SearchResult = { title: string; url: string; snippet: string };

const ENDPOINT = "https://html.duckduckgo.com/html/";

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

/** Resolve DuckDuckGo's redirect links (//duckduckgo.com/l/?uddg=ENCODED). */
function resolveUrl(href: string): string {
  const m = href.match(/[?&]uddg=([^&]+)/);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return href;
    }
  }
  return href.startsWith("//") ? "https:" + href : href;
}

export async function webSearch(query: string, limit = 5): Promise<SearchResult[]> {
  const body = new URLSearchParams({ q: query }).toString();
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "Mozilla/5.0 (compatible; NVPNode/0.1)",
    },
    body,
  });
  if (!res.ok) return [];
  const html = await res.text();

  const results: SearchResult[] = [];
  // Each result: <a ... class="result__a" href="...">TITLE</a> ... snippet block
  const linkRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRe = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  const snippets: string[] = [];
  let sm: RegExpExecArray | null;
  while ((sm = snippetRe.exec(html))) snippets.push(stripTags(sm[1]));

  let lm: RegExpExecArray | null;
  let i = 0;
  while ((lm = linkRe.exec(html)) && results.length < limit) {
    const url = resolveUrl(lm[1]);
    const title = stripTags(lm[2]);
    if (!title || !url.startsWith("http")) continue;
    results.push({ title, url, snippet: snippets[i] ?? "" });
    i++;
  }
  return results;
}

/** Compact context block to inject into a prompt. */
export function formatResults(results: SearchResult[]): string {
  if (results.length === 0) return "(no web results found)";
  return results
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\n(${r.url})`)
    .join("\n\n");
}
