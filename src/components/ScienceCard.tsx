"use client";

interface ScienceContent {
  what: string;
  how: string;
  whyItMatters: string;
  action: string;
}

export const SCIENCE: Record<string, ScienceContent> = {
  overview: {
    what: "A snapshot of your site's internal link health: page count, link density, orphan pages, and authority tiers.",
    how: "We crawl your site, build a directed graph of every internal link, and score each page on six centrality metrics. Tiers are computed from harmonic centrality.",
    whyItMatters:
      "Link architecture decides which pages Google crawls often, which AI assistants cite, and which capture the value of your backlinks. A flat or broken architecture leaves SEO budget on the table.",
    action:
      "Read findings on top, then dive into Top Pages, Click Depth, and Orphans for the most actionable signals.",
  },
  top: {
    what: "Pages ranked by Harmonic Centrality (HC), with PageRank, in-links, and out-links shown alongside.",
    how: "HC = Σ 1/d(v,u) over all reachable u ≠ v. Higher = closer to all other pages = more crawl budget and link equity flow.",
    whyItMatters:
      "These are the pages Google crawls most often, that capture the most internal link equity, and that AI assistants are most likely to cite. They're also the ones most worth optimizing — small changes have outsized impact.",
    action:
      "If your homepage isn't in the top 3, fix your nav. If a money page (pricing, signup) isn't in the top 10, add internal links pointing to it.",
  },
  distribution: {
    what: "Histogram of HC scores across all crawled pages — shows how authority is distributed.",
    how: "Each bar = number of pages whose HC falls in that bucket. The dotted line shows the cumulative density.",
    whyItMatters:
      "Healthy sites show a long-tail: many pages with low HC, a few high-HC hubs at the right edge. A flat (compressed) distribution means you have no clear authority hierarchy — Google can't tell which pages matter most.",
    action:
      "If the distribution is compressed, concentrate internal links on a smaller set of strategic pages. Don't link to everything from everywhere.",
  },
  scatter: {
    what: "Each dot = one page, plotting HC (internal reachability) against PageRank (overall authority).",
    how: "HC measures distance in the link graph. PageRank measures authority weighted by source authority. They usually correlate but disagree on outliers — and the outliers are interesting.",
    whyItMatters:
      "Top-right pages are your strongest assets. High HC + low PR = easy to find but no external authority — needs backlinks. Low HC + high PR = receives authority but hard to discover internally — fix internal linking.",
    action:
      "Build backlinks to the bottom-right cluster. Add internal links to the top-left cluster.",
  },
  depth: {
    what: "How many clicks each page is from your homepage (BFS over the link graph).",
    how: "We walk outward from the homepage one hop at a time. A page at depth 4 means you have to click 4 links from homepage to reach it.",
    whyItMatters:
      "Google's crawler doesn't follow links forever — it has a budget. Pages more than 3-4 clicks deep get crawled less, indexed slower, and updated less frequently. Deep pages = invisible pages.",
    action:
      "Pull deep pages closer by linking them from your blog index, footer, or related-content widgets. Aim for max depth 3 on important content.",
  },
  "link-profile": {
    what: "In-links (pages linking TO this page) vs Out-links (pages this page links to). Bubble size = HC.",
    how: "Each bubble is one page. The X axis counts how many links this page sends out. The Y axis counts how many links it receives.",
    whyItMatters:
      "Top-right pages are link hubs — they receive AND send many internal links. Bottom-left pages are isolated leaves. Healthy sites have a clear ratio: hubs on top, content on the leaves.",
    action:
      "Look for high-out-degree, low-in-degree pages — those are link wasters. Look for high-in-degree, low-out-degree pages — those are link reservoirs that aren't pushing equity downstream.",
  },
  tier: {
    what: "Pages bucketed into HIGH (top 25% by HC), MEDIUM (middle 50%), LOW (bottom 25% + orphans).",
    how: "Hard cutoffs at the 25th and 75th percentile of harmonic centrality. Orphans are forced to LOW regardless of percentile.",
    whyItMatters:
      "A handful of HIGH pages capture most of your internal link equity. Bottom-tier pages bleed crawl budget without returning value. The ratio between tiers tells you how concentrated (or scattered) your authority is.",
    action:
      "Focus optimization effort on HIGH and MEDIUM tiers. Trim, redirect, or noindex the LOW tier if it's bloated.",
  },
  radar: {
    what: "Top 5 pages compared across all six centrality metrics — Harmonic, PageRank, Betweenness, Closeness, Hub, Authority.",
    how: "Each axis is normalized 0-1. A page that fills the entire radar is a structural pillar. A page that spikes on one axis only is specialized.",
    whyItMatters:
      "A single number never tells the full story. A page might be high HC (easy to find) but low Authority (no one points at it). The radar surfaces these mismatches at a glance.",
    action:
      "Pages that fill the radar = your structural pillars. Pages that spike on Hub but flatline on Authority = great connectors that need backlinks.",
  },
  graph3d: {
    what: "Your full internal link graph rendered in 3D. Each node = one page. Each line = one link.",
    how: "Built using a force-directed simulation: links pull connected pages together, repulsion pushes everything apart. Color encodes tier; size encodes HC. Orphans pulse red.",
    whyItMatters:
      "Numbers are abstract. Seeing your link architecture in 3D makes structural problems obvious — clusters disconnect, orphans float at the edges, hubs dominate the center.",
    action:
      "Spin the graph. If your structure has clear hubs and tight clusters, you're good. If it looks like a fuzzy cloud or scattered islands, your internal linking needs work.",
  },
  skyline: {
    what: "A 3D bar chart: bar height = HC, grouped by URL cluster (e.g. /blog, /products, /about).",
    how: "We bucket pages by their first URL path segment, take the top 5-8 by HC per cluster, and stack them as bars. Higher bar = more authority.",
    whyItMatters:
      "Tells you instantly which sections of your site capture the most authority. If your /blog cluster towers over /products, you're investing crawl budget in the wrong place for an e-commerce site.",
    action:
      "Compare cluster heights to your business priorities. The tallest cluster should match your highest-revenue intent.",
  },
};

export default function ScienceCard({ tabId }: { tabId: string }) {
  const data = SCIENCE[tabId];
  if (!data) return null;
  return (
    <div className="card-brutal mt-6 !p-5 bg-[var(--wldm-beige)]">
      <div className="font-[family-name:var(--font-chakra-petch)] font-bold text-xs uppercase tracking-[0.2em] text-[var(--wldm-blue-dark)] mb-3">
        Science behind it
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        <Block label="What you're seeing" body={data.what} />
        <Block label="How it's computed" body={data.how} />
        <Block label="Why it matters" body={data.whyItMatters} />
        <Block label="Take action" body={data.action} highlight />
      </div>
    </div>
  );
}

function Block({ label, body, highlight }: { label: string; body: string; highlight?: boolean }) {
  return (
    <div>
      <div
        className={`font-[family-name:var(--font-chakra-petch)] font-semibold text-[10px] uppercase tracking-wider mb-1 ${
          highlight ? "text-[var(--wldm-black)]" : "text-[var(--wldm-ink-40)]"
        }`}
      >
        {label}
      </div>
      <p className={`text-sm leading-relaxed ${highlight ? "text-[var(--wldm-black)] font-medium" : "text-[var(--wldm-ink-60)]"}`}>
        {body}
      </p>
    </div>
  );
}
