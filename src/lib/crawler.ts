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
  /** Max concurrent fetches (default 5) */
  concurrency?: number;
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

const BOT_CHALLENGE_RE = /bot.{0,3}verif|just a moment|checking your browser|attention required|cloudflare|captcha|recaptcha|access denied/i;

function looksLikeBotChallenge(html: string): boolean {
  if (html.length < 5000 && BOT_CHALLENGE_RE.test(html)) return true;
  // Very small HTML with no links is also suspicious
  if (html.length < 2500 && !/<a\s+[^>]*href=/i.test(html)) return true;
  return false;
}

interface FetchOutcome {
  resp: Response | null;
  body: string | null;
  viaProxy: boolean;
}

async function smartFetch(
  url: string,
  apiKey: string | undefined,
  timeoutMs = 12000
): Promise<FetchOutcome> {
  // Try direct
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(url, { headers: DEFAULT_HEADERS, signal: ctrl.signal, redirect: "follow" });
    clearTimeout(timer);
    const ct = r.headers.get("content-type") || "";
    if (r.status === 200 && ct.includes("text/html")) {
      const body = await r.text();
      if (!looksLikeBotChallenge(body)) {
        return { resp: r, body, viaProxy: false };
      }
      // looks like bot challenge → fall through to proxy
    } else if (r.status === 200) {
      // Non-html 200 (e.g., image)
      return { resp: r, body: null, viaProxy: false };
    } else if (!BLOCKED_STATUS.has(r.status)) {
      return { resp: r, body: null, viaProxy: false };
    }
  } catch {
    // network error → fall through
  }
  if (!apiKey) return { resp: null, body: null, viaProxy: false };
  try {
    const r = await proxyFetch(url, apiKey, timeoutMs * 4);
    let body: string | null = null;
    const ct = r.headers.get("content-type") || "";
    if (r.status === 200 && ct.includes("text/html")) {
      body = await r.text();
    }
    return { resp: r, body, viaProxy: true };
  } catch {
    return { resp: null, body: null, viaProxy: false };
  }
}

export async function crawlWebsite(rawStartUrl: string, opts: CrawlOptions = {}): Promise<CrawlResult> {
  const maxPages = opts.maxPages ?? 100;
  const delayMs = opts.delayMs ?? 0;
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 5, 10));
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
  /** URLs that are claimed (in-flight or done) — prevents duplicate fetches */
  const claimed = new Set<string>();
  const edges: Array<[string, string]> = [];
  const pageInfo: Record<string, PageInfo> = {};
  const queue: string[] = [startUrl];
  claimed.add(startUrl);
  let proxyUsed = 0;
  let totalRequests = 0;

  /** Worker fetches one URL, parses it, enqueues new URLs */
  async function processOne(url: string): Promise<void> {
    if (visited.size >= maxPages) return;
    if (opts.signal?.aborted) return;
    totalRequests++;
    const { resp, body, viaProxy } = await smartFetch(url, opts.scraperApiKey);
    if (viaProxy) proxyUsed++;
    if (!resp || resp.status !== 200) {
      visited.add(url);
      return;
    }
    const ct = resp.headers.get("content-type") || "";
    if (!ct.includes("text/html")) return;
    if (!body) {
      visited.add(url);
      return;
    }

    visited.add(url);
    const $ = cheerio.load(body);
    const title = ($("title").first().text() || "").trim();
    const wordCount = ($("body").text() || "").trim().split(/\s+/).filter(Boolean).length;
    pageInfo[url] = { url, title, wordCount, status: resp.status };

    $("a[href]").each((_, el) => {
      const href = ($(el).attr("href") || "").trim();
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:")
      ) {
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
        if (!claimed.has(absUrl) && visited.size + queue.length < maxPages * 2) {
          claimed.add(absUrl);
          queue.push(absUrl);
        }
      }
    });

    opts.onProgress?.({ visited: visited.size, max: maxPages, currentUrl: url, viaProxy });
  }

  /** Worker loop: pulls from queue until empty or budget hit */
  async function worker(): Promise<void> {
    while (true) {
      if (opts.signal?.aborted) return;
      if (visited.size >= maxPages) return;
      const next = queue.shift();
      if (!next) {
        // Queue temporarily empty — wait briefly for other workers to add more
        await new Promise((r) => setTimeout(r, 30));
        if (queue.length === 0) return;
        continue;
      }
      try {
        await processOne(next);
      } catch {
        // ignore per-page errors
      }
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  // Run N parallel workers
  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

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
