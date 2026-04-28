"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { AuditResult } from "@/lib/types";
import { generateAuditPdf } from "@/lib/pdf";
import {
  TopPagesChart,
  TopBottomComparison,
  DistributionChart,
  DistributionStats,
  HcVsPrChart,
  TierDonut,
  CentralityRadar,
  DepthChart,
  LinkProfileChart,
} from "./Charts";
import ScienceCard from "./ScienceCard";

const HCGraph3D = dynamic(() => import("./HCGraph3D"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] rounded-2xl bg-[var(--wldm-black)] flex items-center justify-center text-[var(--wldm-taupe)]">
      Loading 3D graph…
    </div>
  ),
});

const HCSkyline3D = dynamic(() => import("./HCSkyline3D"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] rounded-2xl bg-[var(--wldm-black)] flex items-center justify-center text-[var(--wldm-taupe)]">
      Loading skyline…
    </div>
  ),
});

const QualityScatter3D = dynamic(() => import("./QualityScatter3D"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] rounded-2xl bg-[var(--wldm-black)] flex items-center justify-center text-[var(--wldm-taupe)]">
      Loading scatter…
    </div>
  ),
});

interface Props {
  result: AuditResult;
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "top", label: "Top Pages" },
  { id: "distribution", label: "Distribution" },
  { id: "scatter", label: "HC vs PageRank" },
  { id: "depth", label: "Click Depth" },
  { id: "link-profile", label: "Link Profile" },
  { id: "tier", label: "Tier Breakdown" },
  { id: "radar", label: "Centrality Radar" },
  { id: "graph3d", label: "3D Network" },
  { id: "quality3d", label: "3D Quality" },
  { id: "skyline", label: "3D Skyline" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const TIER_BADGE: Record<string, string> = {
  high: "bg-[var(--wldm-fluro)] border-[var(--wldm-black)]",
  medium: "bg-[var(--wldm-blue)] border-[var(--wldm-black)]",
  low: "bg-white border-[var(--wldm-black)]",
};

export default function AuditResults({ result }: Props) {
  const { analysis, domain, elapsedMs, proxyUsed } = result;
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const stats = useMemo(() => {
    const tiers = { high: 0, medium: 0, low: 0 };
    analysis.nodes.forEach((n) => tiers[n.tier]++);
    return tiers;
  }, [analysis.nodes]);

  const clusters = useMemo(() => {
    const m = new Map<string, number>();
    analysis.nodes.forEach((n) => m.set(n.cluster, (m.get(n.cluster) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [analysis.nodes]);

  async function handleDownloadPdf() {
    setGeneratingPdf(true);
    try {
      await generateAuditPdf(result);
    } catch (e) {
      console.error("PDF generation failed", e);
      alert("Could not generate PDF. Try refresh.");
    } finally {
      setGeneratingPdf(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8 pb-6 border-b border-[var(--wldm-ink-40)]">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-[var(--wldm-ink-40)] font-[family-name:var(--font-chakra-petch)] font-semibold">
            Harmonic Centrality Report
          </div>
          <h1 className="text-4xl font-[family-name:var(--font-chakra-petch)] font-bold text-[var(--wldm-black)]">
            {domain}
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDownloadPdf}
            disabled={generatingPdf}
            className="btn-pill btn-fluro disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {generatingPdf ? "Building PDF…" : "Download PDF ↓"}
          </button>
          <Link href="/" className="btn-pill btn-outline">
            ← New audit
          </Link>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Kpi label="Pages" value={analysis.totalPages} />
        <Kpi label="Links" value={analysis.totalLinks} />
        <Kpi label="Density" value={analysis.density.toFixed(3)} />
        <Kpi label="Orphans" value={analysis.orphans.length} highlight={analysis.orphans.length > 0} />
        <Kpi label="Crawl time" value={`${(elapsedMs / 1000).toFixed(1)}s`} />
      </div>

      {/* Diagnostic warnings */}
      {analysis.diagnostics.recommendations.length > 0 && (
        <Section title="Findings & Recommendations">
          <div className="space-y-3">
            {analysis.diagnostics.recommendations.map((rec, i) => (
              <div
                key={i}
                className="rounded-2xl p-4 border border-[var(--wldm-black)] flex gap-3 items-start"
                style={{
                  background: i === 0 ? "var(--wldm-fluro)" : "var(--wldm-blue)",
                  boxShadow: "4px 4px 0 var(--wldm-black)",
                }}
              >
                <span className="font-[family-name:var(--font-chakra-petch)] font-bold text-2xl tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-sm text-[var(--wldm-black)] leading-relaxed flex-1">{rec}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Tabs */}
      <div className="mb-1 mt-4 flex flex-wrap gap-1 border-b-2 border-[var(--wldm-black)]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-t-lg font-[family-name:var(--font-chakra-petch)] font-semibold text-sm transition border-2 border-b-0 ${
              activeTab === tab.id
                ? "bg-[var(--wldm-blue)] border-[var(--wldm-black)] text-[var(--wldm-black)]"
                : "bg-transparent border-transparent text-[var(--wldm-ink-60)] hover:text-[var(--wldm-black)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="pt-6">
        {activeTab === "overview" && (
          <>
            <Overview analysis={analysis} stats={stats} clusters={clusters} />
            <ScienceCard tabId="overview" />
          </>
        )}

        {activeTab === "top" && (
          <Section title="Top Pages by Harmonic Centrality">
            <TopPagesChart nodes={analysis.nodes} n={20} />
            <h3 className="text-lg font-[family-name:var(--font-chakra-petch)] font-bold mt-8 mb-3">
              Top vs Bottom — head-to-head
            </h3>
            <TopBottomComparison nodes={analysis.nodes} />
            <TopPagesTable result={result} />
            <ScienceCard tabId="top" />
          </Section>
        )}

        {activeTab === "distribution" && (
          <Section title="Harmonic Centrality Distribution">
            <DistributionChart nodes={analysis.nodes} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div>
                <h3 className="text-sm font-[family-name:var(--font-chakra-petch)] uppercase tracking-wider font-bold mb-2">
                  Statistics
                </h3>
                <DistributionStats nodes={analysis.nodes} />
              </div>
              <div>
                <h3 className="text-sm font-[family-name:var(--font-chakra-petch)] uppercase tracking-wider font-bold mb-2">
                  Verdict
                </h3>
                <div
                  className="card-brutal !p-5"
                  style={{
                    background: analysis.diagnostics.hcCompressed ? "var(--wldm-fluro)" : "var(--wldm-blue)",
                  }}
                >
                  <p className="text-sm text-[var(--wldm-black)] leading-relaxed">
                    {analysis.diagnostics.hcCompressed
                      ? "⚠️ Distribution is compressed — most pages have similar HC. Your site lacks a clear authority hierarchy. Healthy sites show a long-tail with a few high-authority hubs."
                      : "Healthy distribution — long tail with most pages at low HC, a few high-HC hubs at the right end. Your site has a clear authority hierarchy."}
                  </p>
                </div>
              </div>
            </div>
            <ScienceCard tabId="distribution" />
          </Section>
        )}

        {activeTab === "scatter" && (
          <Section title="HC vs PageRank">
            <HcVsPrChart nodes={analysis.nodes} degenerate={analysis.diagnostics.pagerankDegenerate} />
            <ScienceCard tabId="scatter" />
          </Section>
        )}

        {activeTab === "depth" && (
          <Section title="Click Depth from Homepage">
            <DepthChart histogram={analysis.depthHistogram} />
            <ScienceCard tabId="depth" />
          </Section>
        )}

        {activeTab === "link-profile" && (
          <Section title="In-Links vs Out-Links">
            <LinkProfileChart nodes={analysis.nodes} />
            <ScienceCard tabId="link-profile" />
          </Section>
        )}

        {activeTab === "tier" && (
          <Section title="Authority Tier Breakdown">
            <TierDonut nodes={analysis.nodes} />
            <ScienceCard tabId="tier" />
          </Section>
        )}

        {activeTab === "radar" && (
          <Section title="Top 5 Pages — Centrality Radar">
            <CentralityRadar nodes={analysis.nodes} />
            <ScienceCard tabId="radar" />
          </Section>
        )}

        {activeTab === "graph3d" && (
          <Section title="Your Link Graph in 3D">
            <HCGraph3D nodes={analysis.nodes} edges={analysis.edges} />
            <ScienceCard tabId="graph3d" />
          </Section>
        )}

        {activeTab === "quality3d" && (
          <Section title="3D Quality Scatter">
            <p className="text-sm text-[var(--wldm-ink-60)] mb-4">
              Each sphere = one page positioned by <strong>out-links × in-links × betweenness</strong>. Bigger = higher HC. Spot link hubs (top-right-back), specialists (high in, low out), and dead-ends (low everything) at a glance.
            </p>
            <QualityScatter3D nodes={analysis.nodes} />
            <ScienceCard tabId="link-profile" />
          </Section>
        )}

        {activeTab === "skyline" && (
          <Section title="HC Skyline by URL Cluster">
            <HCSkyline3D nodes={analysis.nodes} />
            <ScienceCard tabId="skyline" />
          </Section>
        )}
      </div>

      <div className="mt-12 pt-6 border-t border-[var(--wldm-ink-40)] text-xs text-[var(--wldm-ink-40)] flex flex-wrap justify-between gap-2">
        <span>
          Crawl summary: {result.totalRequests} requests, {proxyUsed} via proxy fallback,{" "}
          {(elapsedMs / 1000).toFixed(1)}s total.
        </span>
        <span>WLDM.IO · Harmonic Centrality</span>
      </div>
    </div>
  );
}

function Overview({
  analysis,
  stats,
  clusters,
}: {
  analysis: AuditResult["analysis"];
  stats: Record<string, number>;
  clusters: Array<[string, number]>;
}) {
  return (
    <>
      <Section title="Authority Tiers">
        <div className="flex gap-2 mb-3">
          {(["high", "medium", "low"] as const).map((t) => {
            const pct = (stats[t] / Math.max(analysis.totalPages, 1)) * 100;
            return (
              <div
                key={t}
                className={`h-12 rounded border border-[var(--wldm-black)] flex items-center justify-center font-[family-name:var(--font-chakra-petch)] font-bold text-sm ${TIER_BADGE[t]}`}
                style={{ flex: pct, minWidth: "60px" }}
              >
                {t.toUpperCase()} {stats[t]}
              </div>
            );
          })}
        </div>
        <p className="text-sm text-[var(--wldm-ink-60)]">
          <strong>{stats.high}</strong> high-authority pages capture most of your internal link equity.{" "}
          {stats.low > 0 && (
            <>
              <strong>{stats.low}</strong> low-tier pages — likely orphans or dead-ends — are silently bleeding crawl budget.
            </>
          )}
        </p>
      </Section>

      <Section title="URL Clusters">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {clusters.map(([name, count]) => (
            <div key={name} className="card-brutal text-center">
              <div className="text-3xl font-[family-name:var(--font-chakra-petch)] font-bold text-[var(--wldm-black)]">
                {count}
              </div>
              <div className="text-xs uppercase tracking-wider text-[var(--wldm-ink-40)] mt-1 font-[family-name:var(--font-chakra-petch)] font-semibold">
                /{name}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {analysis.orphans.length > 0 && (
        <Section title={`${analysis.orphans.length} Orphan Pages — Zero Internal Links`}>
          <div
            className="rounded-2xl p-5 border border-[var(--wldm-black)]"
            style={{ background: "var(--wldm-fluro)", boxShadow: "4px 4px 0 var(--wldm-black)" }}
          >
            <p className="text-sm text-[var(--wldm-black)] mb-3">
              These pages have zero incoming internal links. They&apos;re invisible to crawlers — fix by adding internal links from high-HC pages.
            </p>
            <ul className="text-sm space-y-1 max-h-48 overflow-y-auto">
              {analysis.orphans.slice(0, 20).map((o) => (
                <li key={o.url} className="break-all">
                  <a href={o.url} target="_blank" rel="noopener noreferrer" className="text-[var(--wldm-black)] hover:underline">
                    {o.title || urlPath(o.url)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}
    </>
  );
}

function TopPagesTable({ result }: { result: AuditResult }) {
  return (
    <div className="card-brutal !p-0 overflow-hidden mt-6">
      <table className="w-full text-sm">
        <thead className="bg-[var(--wldm-blue-pale)] font-[family-name:var(--font-chakra-petch)] uppercase tracking-wider text-xs">
          <tr>
            <th className="text-left p-3 w-10">#</th>
            <th className="text-left p-3">URL</th>
            <th className="text-right p-3">HC</th>
            <th className="text-right p-3">PR</th>
            <th className="text-right p-3 hidden sm:table-cell">In</th>
            <th className="text-right p-3 hidden sm:table-cell">Out</th>
          </tr>
        </thead>
        <tbody>
          {result.analysis.topPages.slice(0, 20).map((n, i) => (
            <tr key={n.url} className="border-t border-[var(--wldm-blue-pale)] hover:bg-[var(--wldm-beige-50)]">
              <td className="p-3 text-[var(--wldm-ink-40)] tabular-nums">{i + 1}</td>
              <td className="p-3">
                <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-[var(--wldm-blue-dark)] hover:underline break-all">
                  {n.title || urlPath(n.url)}
                </a>
                <div className="text-xs text-[var(--wldm-ink-40)] truncate max-w-md">{urlPath(n.url)}</div>
              </td>
              <td className="p-3 text-right tabular-nums font-semibold">
                <HCBar value={n.harmonic} />
              </td>
              <td className="p-3 text-right tabular-nums text-[var(--wldm-ink-60)]">{n.pagerank.toFixed(4)}</td>
              <td className="p-3 text-right tabular-nums hidden sm:table-cell">{n.inDegree}</td>
              <td className="p-3 text-right tabular-nums hidden sm:table-cell">{n.outDegree}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div
      className="card-brutal text-center"
      style={highlight ? { background: "var(--wldm-fluro)" } : undefined}
    >
      <div className="text-3xl font-[family-name:var(--font-chakra-petch)] font-bold text-[var(--wldm-black)] tabular-nums">
        {value}
      </div>
      <div className="text-xs uppercase tracking-wider text-[var(--wldm-ink-40)] mt-1 font-[family-name:var(--font-chakra-petch)] font-semibold">
        {label}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-[family-name:var(--font-chakra-petch)] font-bold text-[var(--wldm-black)] pb-2 mb-4 border-b-2 border-[var(--wldm-black)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function HCBar({ value }: { value: number }) {
  return (
    <div className="inline-flex items-center gap-2 justify-end w-full">
      <div className="flex-1 h-2 bg-[var(--wldm-blue-pale)] rounded-full overflow-hidden border border-[var(--wldm-black)] max-w-[80px]">
        <div className="h-full bg-[var(--wldm-blue-dark)]" style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className="text-xs tabular-nums w-10 text-right">{value.toFixed(2)}</span>
    </div>
  );
}

function urlPath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname || "/";
  } catch {
    return url;
  }
}
