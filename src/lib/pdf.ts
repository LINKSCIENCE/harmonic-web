import jsPDF from "jspdf";
import type { AuditResult } from "./types";

const COLOR = {
  black: "#2a2b29",
  blue: "#b8d3d8",
  blueDark: "#6b9ba4",
  fluro: "#e1ff01",
  beige: "#f7f5ee",
  taupe: "#bfc0b6",
};

function urlPath(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

export async function generateAuditPdf(result: AuditResult): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;

  // ── COVER ─────────────────────────────────────────────────────────
  doc.setFillColor(COLOR.beige);
  doc.rect(0, 0, W, H, "F");

  // Header bar
  doc.setFillColor(COLOR.black);
  doc.rect(0, 0, W, 60, "F");
  doc.setTextColor(COLOR.beige);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("WLDM.IO  ·  HARMONIC CENTRALITY", M, 36);

  // Title block
  doc.setTextColor(COLOR.black);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(36);
  doc.text("Internal Link", M, 180);
  doc.text("Architecture Report", M, 220);

  // Domain pill
  doc.setFillColor(COLOR.fluro);
  doc.setDrawColor(COLOR.black);
  doc.setLineWidth(1);
  const domainText = result.domain;
  doc.setFontSize(20);
  const domW = doc.getTextWidth(domainText) + 30;
  doc.roundedRect(M, 250, domW, 38, 8, 8, "FD");
  doc.setTextColor(COLOR.black);
  doc.text(domainText, M + 15, 277);

  // Divider
  doc.setDrawColor(COLOR.black);
  doc.line(M, 320, W - M, 320);

  // KPI summary
  const kpis = [
    ["Pages", String(result.analysis.totalPages)],
    ["Links", String(result.analysis.totalLinks)],
    ["Density", result.analysis.density.toFixed(3)],
    ["Orphans", String(result.analysis.orphans.length)],
  ];
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  let kpiX = M;
  const kpiCardW = (W - 2 * M - 30) / 4;
  kpis.forEach(([label, value]) => {
    doc.setFillColor("#ffffff");
    doc.setDrawColor(COLOR.black);
    doc.roundedRect(kpiX, 350, kpiCardW, 70, 8, 8, "FD");
    doc.setTextColor(COLOR.black);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(value, kpiX + 12, 388);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(COLOR.taupe);
    doc.text(label.toUpperCase(), kpiX + 12, 405);
    kpiX += kpiCardW + 10;
  });

  // Crawl summary line
  doc.setTextColor(COLOR.black);
  doc.setFontSize(9);
  doc.text(
    `Crawled in ${(result.elapsedMs / 1000).toFixed(1)}s · ${result.totalRequests} requests · ${result.proxyUsed} via proxy`,
    M,
    450
  );

  // Footer
  doc.setTextColor(COLOR.taupe);
  doc.setFontSize(8);
  const today = new Date().toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
  doc.text(`Generated ${today} · WLDM.IO`, M, H - 30);

  // ── PAGE 2: TOP PAGES ─────────────────────────────────────────────
  doc.addPage();
  doc.setFillColor(COLOR.beige);
  doc.rect(0, 0, W, H, "F");

  doc.setTextColor(COLOR.black);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Top pages by harmonic centrality", M, 60);
  doc.setDrawColor(COLOR.black);
  doc.setLineWidth(2);
  doc.line(M, 70, W - M, 70);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLOR.taupe);
  doc.text("Higher HC = more reachable, more crawl-budget, more SEO link equity.", M, 90);

  // Table header
  let y = 120;
  doc.setFillColor(COLOR.blue);
  doc.rect(M, y - 14, W - 2 * M, 20, "F");
  doc.setTextColor(COLOR.black);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("#", M + 8, y);
  doc.text("PATH", M + 30, y);
  doc.text("HC", W - M - 130, y);
  doc.text("PR", W - M - 90, y);
  doc.text("IN", W - M - 50, y);
  doc.text("OUT", W - M - 18, y);

  // Rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  y += 18;
  result.analysis.topPages.slice(0, 25).forEach((node, i) => {
    if (y > H - 60) {
      doc.addPage();
      doc.setFillColor(COLOR.beige);
      doc.rect(0, 0, W, H, "F");
      y = 60;
    }
    doc.setTextColor(COLOR.taupe);
    doc.text(String(i + 1), M + 8, y);
    doc.setTextColor(COLOR.black);
    const path = urlPath(node.url).slice(0, 60);
    doc.text(path, M + 30, y);
    doc.text(node.harmonic.toFixed(2), W - M - 130, y);
    doc.text(node.pagerank.toFixed(4), W - M - 90, y);
    doc.text(String(node.inDegree), W - M - 50, y);
    doc.text(String(node.outDegree), W - M - 18, y);
    y += 16;
  });

  // ── PAGE 3+: ORPHANS (if any) ─────────────────────────────────────
  if (result.analysis.orphans.length > 0) {
    doc.addPage();
    doc.setFillColor(COLOR.beige);
    doc.rect(0, 0, W, H, "F");

    doc.setTextColor(COLOR.black);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Orphan pages", M, 60);
    doc.setDrawColor(COLOR.black);
    doc.setLineWidth(2);
    doc.line(M, 70, W - M, 70);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(COLOR.black);
    const introLines = doc.splitTextToSize(
      `${result.analysis.orphans.length} pages have zero internal links pointing to them. They're invisible to crawlers — fix by adding internal links from high-HC pages.`,
      W - 2 * M
    );
    doc.text(introLines, M, 95);

    let oy = 130;
    doc.setFontSize(9);
    result.analysis.orphans.slice(0, 60).forEach((o) => {
      if (oy > H - 60) {
        doc.addPage();
        doc.setFillColor(COLOR.beige);
        doc.rect(0, 0, W, H, "F");
        oy = 60;
      }
      doc.setTextColor(COLOR.black);
      doc.text(`• ${urlPath(o.url).slice(0, 80)}`, M, oy);
      oy += 14;
    });
  }

  // ── METHODOLOGY footer page ──────────────────────────────────────
  doc.addPage();
  doc.setFillColor(COLOR.beige);
  doc.rect(0, 0, W, H, "F");
  doc.setTextColor(COLOR.black);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Methodology", M, 60);
  doc.setDrawColor(COLOR.black);
  doc.setLineWidth(2);
  doc.line(M, 70, W - M, 70);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(COLOR.black);
  const methodology = [
    "1. The crawler starts at the homepage and follows internal links breadth-first up to 100 pages.",
    "2. We use a real Chrome User-Agent and fall back to a residential proxy on Cloudflare-style anti-bot blocks.",
    "3. Each discovered URL becomes a node; each link becomes a directed edge.",
    "4. Harmonic Centrality is the sum of inverse shortest-path distances from each node:",
    "         H(v) = Σ 1/d(v,u)   for all reachable u ≠ v",
    "5. PageRank, betweenness, closeness, and HITS are computed for cross-validation.",
    "6. Pages are tiered: top 25% by HC = 'high authority', bottom 25% = 'low'. Pages with zero",
    "   incoming links are flagged as orphans regardless of tier.",
  ];
  let my = 100;
  methodology.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, W - 2 * M);
    doc.text(wrapped, M, my);
    my += 16 * wrapped.length + 4;
  });

  // Save
  const safeDomain = result.domain.replace(/[^a-z0-9]+/gi, "-");
  const date = new Date().toISOString().slice(0, 10);
  doc.save(`harmonic-${safeDomain}-${date}.pdf`);
}
