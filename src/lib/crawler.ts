import * as cheerio from "cheerio";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent": BROWSER_UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

const BLOCKED_STATUS = new Set([401, 403, 429, 503]);

export interface PageInfo {
  url: string;
  title: string;
  wordCount: number;
  status: number;
}

export interface CrawlResult {
  startUrl: string;
  baseDomain: string;
  edges: Array<[string, string]>;
  visited: string[];
  pageInfo: Record<string, PageInfo>;
  elapsedMs: number;
  proxyUsed: number;
  totalRequests: number;
}

export interface CrawlOptions {
  maxPages?: number;
  delayMs?: number;
  scraperApiKey?: string;
  onProgress?: (state: { visited: number; max: number; currentUrl: string; viaProxy: boolean }) => void;
  signal?: AbortSignal;
}

function normalizeUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    u.hash = "";
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return "";
  }
}

function stripWww(host: string): string {
  return host.startsWith("www.") ? host.slice(4) : host;
}

function isInternal(rawUrl: string, baseDomain: string): boolean {
  try {
    return stripWww(new URL(rawUrl).hostname) === stripWww(baseDomain);
  } catch {
    return false;
  }
}

async function proxyFetch(url: string, apiKey: string, timeoutMs = 60000): Promise<Response> {
  const proxyUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(proxyUrl, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function smartFetch(
  url: string,
  apiKey: string | undefined,
  timeoutMs = 12000
): Promise<{ resp: Response | null; viaProxy: boolean }> {
  // Try direct
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(url, { headers: DEFAULT_HEADERS, signal: ctrl.signal, redirect: "follow" });
    clearTimeout(timer);
    if (r.status === 200) return { resp: r, viaProxy: false };
    if (!BLOCKED_STATUS.has(r.status)) return { resp: r, viaProxy: false };
    // blocked → fall through
  } catch {
    // network error → fall through
  }
  if (!apiKey) return { resp: null, viaProxy: false };
  try {
    const r = await proxyFetch(url, apiKey, timeoutMs * 4);
    return { resp: r, viaProxy: true };
  } catch {
    return { resp: null, viaProxy: false };
  }
}

export async function crawlWebsite(rawStartUrl: string, opts: CrawlOptions = {}): Promise<CrawlResult> {
  const maxPages = opts.maxPages ?? 100;
  const delayMs = opts.delayMs ?? 200;
  const t0 = Date.now();

  // Add protocol if missing
  let startUrl = rawStartUrl.trim();
  if (!/^https?:\/\//.test(startUrl)) startUrl = "https://" + startUrl;
  startUrl = normalizeUrl(startUrl);
  if (!startUrl) {
    throw new Error("Invalid start URL");
  }
  const baseDomain = new URL(startUrl).hostname;

  const visited = new Set<string>();
  const edges: Array<[string, string]> = [];
  const pageInfo: Record<string, PageInfo> = {};
  const queue: string[] = [startUrl];
  let proxyUsed = 0;
  let totalRequests = 0;

  while (queue.length > 0 && visited.size < maxPages) {
    if (opts.signal?.aborted) break;
    const url = queue.shift()!;
    if (visited.has(url)) continue;

    totalRequests++;
    const { resp, viaProxy } = await smartFetch(url, opts.scraperApiKey);
    if (viaProxy) proxyUsed++;
    if (!resp || resp.status !== 200) {
      visited.add(url); // mark to avoid retry
      continue;
    }
    const ct = resp.headers.get("content-type") || "";
    if (!ct.includes("text/html")) continue;

    let html: string;
    try {
      html = await resp.text();
    } catch {
      continue;
    }

    visited.add(url);
    const $ = cheerio.load(html);
    const title = ($("title").first().text() || "").trim();
    const wordCount = ($("body").text() || "").trim().split(/\s+/).filter(Boolean).length;
    pageInfo[url] = { url, title, wordCount, status: resp.status };

    $("a[href]").each((_, el) => {
      const href = ($(el).attr("href") || "").trim();
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
        return;
      }
      let absUrl: string;
      try {
        absUrl = normalizeUrl(new URL(href, url).toString());
      } catch {
        return;
      }
      if (!absUrl) return;
      if (isInternal(absUrl, baseDomain)) {
        edges.push([url, absUrl]);
        if (!visited.has(absUrl) && !queue.includes(absUrl)) {
          queue.push(absUrl);
        }
      }
    });

    opts.onProgress?.({ visited: visited.size, max: maxPages, currentUrl: url, viaProxy });

    if (delayMs > 0 && queue.length > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return {
    startUrl,
    baseDomain,
    edges,
    visited: Array.from(visited),
    pageInfo,
    elapsedMs: Date.now() - t0,
    proxyUsed,
    totalRequests,
  };
}
