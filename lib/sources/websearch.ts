export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export class NoSearchBackend extends Error {}

/**
 * Web search for Topic Sources. Uses whichever backend is configured; DuckDuckGo's
 * HTML endpoint is the keyless default so a Topic Map works with no extra setup.
 */
export async function webSearch(query: string, maxResults = 6): Promise<SearchResult[]> {
  const provider = (process.env.WEB_SEARCH_PROVIDER || "duckduckgo").toLowerCase();
  if (provider === "tavily") return tavily(query, maxResults);
  if (provider === "brave") return brave(query, maxResults);
  if (provider === "duckduckgo") return duckduckgo(query, maxResults);
  if (provider === "none") throw new NoSearchBackend("Web search is disabled (WEB_SEARCH_PROVIDER=none).");
  throw new NoSearchBackend(`Unknown WEB_SEARCH_PROVIDER "${provider}".`);
}

async function tavily(query: string, maxResults: number): Promise<SearchResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new NoSearchBackend("TAVILY_API_KEY is not set.");
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: key, query, max_results: maxResults }),
  });
  if (!response.ok) throw new Error(`Tavily search failed: ${response.status}`);
  const data = (await response.json()) as { results?: { title: string; url: string; content: string }[] };
  return (data.results ?? []).map((result) => ({
    title: result.title,
    url: result.url,
    snippet: result.content,
  }));
}

async function brave(query: string, maxResults: number): Promise<SearchResult[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) throw new NoSearchBackend("BRAVE_SEARCH_API_KEY is not set.");
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(maxResults));
  const response = await fetch(url, {
    headers: { accept: "application/json", "x-subscription-token": key },
  });
  if (!response.ok) throw new Error(`Brave search failed: ${response.status}`);
  const data = (await response.json()) as {
    web?: { results?: { title: string; url: string; description: string }[] };
  };
  return (data.web?.results ?? []).map((result) => ({
    title: result.title,
    url: result.url,
    snippet: result.description,
  }));
}

async function duckduckgo(query: string, maxResults: number): Promise<SearchResult[]> {
  const url = new URL("https://html.duckduckgo.com/html/");
  url.searchParams.set("q", query);
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    },
  });
  if (!response.ok) throw new Error(`DuckDuckGo search failed: ${response.status}`);
  const html = await response.text();
  const results: SearchResult[] = [];
  const linkPattern =
    /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetPattern = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  const snippets: string[] = [];
  let snippetMatch: RegExpExecArray | null;
  while ((snippetMatch = snippetPattern.exec(html)) !== null) {
    snippets.push(stripTags(snippetMatch[1]));
  }
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(html)) !== null && results.length < maxResults) {
    results.push({
      title: stripTags(match[2]),
      url: decodeDuckDuckGoUrl(match[1]),
      snippet: snippets[results.length] ?? "",
    });
  }
  return results;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeDuckDuckGoUrl(href: string): string {
  // DuckDuckGo wraps result links as /l/?uddg=<encoded target>.
  const match = /[?&]uddg=([^&]+)/.exec(href);
  if (match) return decodeURIComponent(match[1]);
  return href.startsWith("//") ? `https:${href}` : href;
}
