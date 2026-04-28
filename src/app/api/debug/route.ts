import { NextRequest } from "next/server";
import * as cheerio from "cheerio";

export const runtime = "nodejs";
export const maxDuration = 60;

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url") || "https://wldm.io";
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });
    const finalUrl = r.url;
    const html = await r.text();
    const $ = cheerio.load(html);
    const links: string[] = [];
    $("a[href]").each((_, el) => {
      const href = ($(el).attr("href") || "").trim();
      if (href) links.push(href);
    });
    return Response.json({
      requestedUrl: url,
      finalUrl,
      status: r.status,
      contentType: r.headers.get("content-type"),
      htmlLength: html.length,
      htmlSnippet: html.slice(0, 500),
      title: $("title").first().text(),
      linkCount: links.length,
      firstLinks: links.slice(0, 20),
      hasScraperKey: !!process.env.SCRAPER_API_KEY,
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) });
  }
}
