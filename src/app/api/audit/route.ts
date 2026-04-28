import { NextRequest } from "next/server";
import { crawlWebsite } from "@/lib/crawler";
import { analyzeGraph } from "@/lib/graph";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min max for crawl

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const domain: string = (body.domain || "").trim();
  const maxPages: number = Math.min(Math.max(body.maxPages ?? 100, 5), 500);
  const delayMs: number = Math.max(body.delayMs ?? 200, 0);

  if (!domain) {
    return new Response(JSON.stringify({ error: "domain required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const apiKey = process.env.SCRAPER_API_KEY?.trim() || undefined;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        send("start", { domain, maxPages });

        const result = await crawlWebsite(domain, {
          maxPages,
          delayMs,
          scraperApiKey: apiKey,
          onProgress: ({ visited, max, currentUrl, viaProxy }) => {
            send("progress", { visited, max, currentUrl, viaProxy });
          },
        });

        if (result.visited.length < 2) {
          send("error", {
            message:
              "Could not crawl enough pages (fewer than 2). The site may block automated access or have very few internal links.",
          });
          controller.close();
          return;
        }

        send("analyzing", { pages: result.visited.length, links: result.edges.length });

        const analysis = analyzeGraph(result.edges, result.visited, result.pageInfo, result.startUrl);

        send("done", {
          domain: result.baseDomain,
          startUrl: result.startUrl,
          elapsedMs: result.elapsedMs,
          proxyUsed: result.proxyUsed,
          totalRequests: result.totalRequests,
          analysis: {
            totalPages: analysis.totalPages,
            totalLinks: analysis.totalLinks,
            density: analysis.density,
            pagerankDegenerate: analysis.pagerankDegenerate,
            topPages: analysis.topPages,
            orphans: analysis.orphans,
            nodes: analysis.nodes,
            edges: analysis.edges,
            diagnostics: analysis.diagnostics,
            depthHistogram: analysis.depthHistogram,
          },
        });
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send("error", { message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
