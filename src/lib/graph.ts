import Graph from "graphology";
import pagerank from "graphology-metrics/centrality/pagerank";
import betweennessCentrality from "graphology-metrics/centrality/betweenness";
import closeness from "graphology-metrics/centrality/closeness";
import hits from "graphology-metrics/centrality/hits";

export interface NodeMetrics {
  url: string;
  title: string;
  inDegree: number;
  outDegree: number;
  harmonic: number; // normalized 0-1
  harmonicRaw: number;
  pagerank: number;
  betweenness: number;
  closeness: number;
  hub: number;
  authority: number;
  tier: "high" | "medium" | "low";
  cluster: string;
  isOrphan: boolean;
  /** Click depth from homepage (BFS, undirected). -1 = unreachable. */
  depth: number;
}

export interface Diagnostics {
  pagerankDegenerate: boolean;
  /** True when HC values are compressed (variance very low) */
  hcCompressed: boolean;
  /** Rank of homepage in HC (1 = top). null if homepage not found. */
  homepageRank: number | null;
  /** Recommendations (data-driven action items) */
  recommendations: string[];
}

export interface GraphAnalysis {
  nodes: NodeMetrics[];
  edges: Array<{ source: string; target: string }>;
  topPages: NodeMetrics[];
  orphans: NodeMetrics[];
  pagerankDegenerate: boolean;
  density: number;
  totalPages: number;
  totalLinks: number;
  diagnostics: Diagnostics;
  /** Distribution of click depths from homepage */
  depthHistogram: Array<{ depth: number; count: number }>;
}

/**
 * BFS shortest paths from `source` (treating graph as undirected).
 * Returns Map<nodeId, distance>.
 */
function bfsDistances(g: Graph, source: string): Map<string, number> {
  const dist = new Map<string, number>();
  dist.set(source, 0);
  const queue: string[] = [source];
  while (queue.length) {
    const u = queue.shift()!;
    const d = dist.get(u)!;
    g.forEachNeighbor(u, (v) => {
      if (!dist.has(v)) {
        dist.set(v, d + 1);
        queue.push(v);
      }
    });
  }
  return dist;
}

/** Harmonic centrality on undirected: H(v) = Σ 1/d(v,u) for u≠v reachable. */
function computeHarmonic(g: Graph): Map<string, number> {
  const ud = g.copy();
  // graphology types: undirected variant
  const out = new Map<string, number>();
  ud.forEachNode((v) => {
    const dist = bfsDistances(ud, v);
    let sum = 0;
    dist.forEach((d, u) => {
      if (u !== v && d > 0) sum += 1 / d;
    });
    out.set(v, sum);
  });
  return out;
}

/** Cluster a URL by first non-empty path segment. */
function clusterFor(url: string): string {
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean)[0];
    return seg ? seg.slice(0, 32) : "homepage";
  } catch {
    return "other";
  }
}

function computeDepthFromRoot(g: Graph, root: string): Map<string, number> {
  const dist = new Map<string, number>();
  if (!g.hasNode(root)) return dist;
  dist.set(root, 0);
  const queue: string[] = [root];
  while (queue.length) {
    const u = queue.shift()!;
    const d = dist.get(u)!;
    g.forEachNeighbor(u, (v) => {
      if (!dist.has(v)) {
        dist.set(v, d + 1);
        queue.push(v);
      }
    });
  }
  return dist;
}

export function analyzeGraph(
  edges: Array<[string, string]>,
  visited: string[],
  pageInfo: Record<string, { title?: string }>,
  startUrl?: string
): GraphAnalysis {
  const g = new Graph({ type: "directed", multi: false, allowSelfLoops: false });
  for (const u of visited) {
    if (!g.hasNode(u)) g.addNode(u);
  }
  for (const [s, t] of edges) {
    if (s === t) continue;
    if (!g.hasNode(s) || !g.hasNode(t)) continue;
    if (!g.hasEdge(s, t)) g.addEdge(s, t);
  }

  const n = g.order;
  if (n === 0) {
    return {
      nodes: [],
      edges: [],
      topPages: [],
      orphans: [],
      pagerankDegenerate: false,
      density: 0,
      totalPages: 0,
      totalLinks: 0,
      diagnostics: { pagerankDegenerate: false, hcCompressed: false, homepageRank: null, recommendations: [] },
      depthHistogram: [],
    };
  }

  // To undirected for HC + closeness
  const ug = new Graph({ type: "undirected", multi: false, allowSelfLoops: false });
  g.forEachNode((node) => ug.addNode(node));
  g.forEachEdge((_e, _attr, s, t) => {
    if (!ug.hasEdge(s, t)) ug.addEdge(s, t);
  });

  // Compute metrics
  const harmonicRaw = computeHarmonic(ug);
  const maxHc = Math.max(...harmonicRaw.values(), 1e-9);
  const harmonicNorm = new Map<string, number>();
  harmonicRaw.forEach((v, k) => harmonicNorm.set(k, v / maxHc));

  let prMap: Record<string, number> = {};
  try {
    prMap = pagerank(g);
  } catch {
    prMap = Object.fromEntries(g.nodes().map((v) => [v, 1 / n]));
  }
  const prValues = Object.values(prMap);
  const prMin = Math.min(...prValues);
  const prMax = Math.max(...prValues);
  const pagerankDegenerate = prMax - prMin < 1e-9;

  let bcMap: Record<string, number> = {};
  try {
    bcMap = betweennessCentrality(g);
  } catch {
    bcMap = Object.fromEntries(g.nodes().map((v) => [v, 0]));
  }

  let closenessMap: Record<string, number> = {};
  try {
    closenessMap = closeness(ug);
  } catch {
    closenessMap = Object.fromEntries(g.nodes().map((v) => [v, 0]));
  }

  let hubMap: Record<string, number> = {};
  let authMap: Record<string, number> = {};
  try {
    const h = hits(g);
    hubMap = h.hubs;
    authMap = h.authorities;
  } catch {
    hubMap = Object.fromEntries(g.nodes().map((v) => [v, 0]));
    authMap = { ...hubMap };
  }

  // Tiering by harmonic (top 25% high, bottom 25% low)
  const sortedHc = [...harmonicNorm.entries()].sort((a, b) => b[1] - a[1]);
  const highCutoff = sortedHc[Math.floor(sortedHc.length * 0.25)]?.[1] ?? 1;
  const lowCutoff = sortedHc[Math.floor(sortedHc.length * 0.75)]?.[1] ?? 0;

  // Click depth from homepage (BFS over undirected)
  const homepage = startUrl && ug.hasNode(startUrl) ? startUrl : sortedHc[0]?.[0];
  const depthMap = homepage ? computeDepthFromRoot(ug, homepage) : new Map<string, number>();

  const nodes: NodeMetrics[] = g.nodes().map((url) => {
    const inDeg = g.inDegree(url);
    const outDeg = g.outDegree(url);
    const isOrphan = inDeg === 0 && url !== homepage;
    const hc = harmonicNorm.get(url) ?? 0;
    let tier: "high" | "medium" | "low" = "medium";
    if (isOrphan) tier = "low";
    else if (hc >= highCutoff && highCutoff > 0) tier = "high";
    else if (hc <= lowCutoff) tier = "low";
    return {
      url,
      title: pageInfo[url]?.title || "",
      inDegree: inDeg,
      outDegree: outDeg,
      harmonic: hc,
      harmonicRaw: harmonicRaw.get(url) ?? 0,
      pagerank: prMap[url] ?? 0,
      betweenness: bcMap[url] ?? 0,
      closeness: closenessMap[url] ?? 0,
      hub: hubMap[url] ?? 0,
      authority: authMap[url] ?? 0,
      tier,
      cluster: clusterFor(url),
      isOrphan,
      depth: depthMap.has(url) ? (depthMap.get(url) as number) : -1,
    };
  });

  const topPages = [...nodes].sort((a, b) => b.harmonic - a.harmonic).slice(0, 25);
  const orphans = nodes.filter((nd) => nd.isOrphan);
  const density = n > 1 ? g.size / (n * (n - 1)) : 0;

  // Depth histogram
  const depthBuckets = new Map<number, number>();
  nodes.forEach((nd) => {
    const d = nd.depth >= 0 ? nd.depth : -1;
    depthBuckets.set(d, (depthBuckets.get(d) ?? 0) + 1);
  });
  const depthHistogram = [...depthBuckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([depth, count]) => ({ depth, count }));

  // ── Diagnostics ────────────────────────────────────────────────
  // HC compression: stdev / mean. Low ratio = compressed.
  const hcVals = nodes.map((nd) => nd.harmonic);
  const hcMean = hcVals.reduce((a, b) => a + b, 0) / Math.max(hcVals.length, 1);
  const hcVariance = hcVals.reduce((a, b) => a + (b - hcMean) ** 2, 0) / Math.max(hcVals.length, 1);
  const hcStd = Math.sqrt(hcVariance);
  const hcCompressed = hcMean > 0 ? hcStd / hcMean < 0.15 && nodes.length > 5 : false;

  // Homepage rank in HC
  const hcRanked = [...nodes].sort((a, b) => b.harmonic - a.harmonic);
  const hpIdx = homepage ? hcRanked.findIndex((nd) => nd.url === homepage) : -1;
  const homepageRank = hpIdx >= 0 ? hpIdx + 1 : null;

  // Recommendations
  const recommendations: string[] = [];
  if (orphans.length > 0) {
    recommendations.push(
      `${orphans.length} orphan page${orphans.length === 1 ? "" : "s"} have zero internal links pointing to them. Add links from your top-HC pages to make them discoverable.`
    );
  }
  if (homepageRank !== null && homepageRank > 5) {
    recommendations.push(
      `Your homepage ranks #${homepageRank} by harmonic centrality. Healthy sites usually keep the homepage in the top 3 — review which pages are over-linked from your nav.`
    );
  }
  if (hcCompressed) {
    recommendations.push(
      `Harmonic centrality is compressed (std/mean = ${(hcStd / Math.max(hcMean, 1e-9)).toFixed(2)}). Most pages have similar reachability — your site lacks a clear authority hierarchy. Concentrate internal links on a smaller set of strategic pages.`
    );
  }
  if (pagerankDegenerate) {
    recommendations.push(
      `PageRank values are uniform (no rank concentration detected). Likely a small or fully connected site — add more discriminating internal links.`
    );
  }
  // Deep pages
  const deepPages = nodes.filter((nd) => nd.depth > 4).length;
  if (deepPages > 0 && nodes.length > 10) {
    recommendations.push(
      `${deepPages} page${deepPages === 1 ? " sits" : "s sit"} more than 4 clicks from the homepage — Google may crawl them less. Consider linking them from a higher-traffic hub.`
    );
  }
  // High HC, low PR
  const inverted = nodes.filter((nd) => nd.harmonic > 0.7 && nd.pagerank > 0 && nd.pagerank < 1 / Math.max(n, 1));
  if (inverted.length > 0 && !pagerankDegenerate) {
    recommendations.push(
      `${inverted.length} page${inverted.length === 1 ? " has" : "s have"} high HC but low PageRank — easy to discover internally but lacks external authority. Build backlinks to these pages.`
    );
  }

  return {
    nodes,
    edges: edges.map(([s, t]) => ({ source: s, target: t })),
    topPages,
    orphans,
    pagerankDegenerate,
    density,
    totalPages: n,
    totalLinks: g.size,
    diagnostics: {
      pagerankDegenerate,
      hcCompressed,
      homepageRank,
      recommendations,
    },
    depthHistogram,
  };
}
