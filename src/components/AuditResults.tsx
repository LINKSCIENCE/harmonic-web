"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { AuditResult } from "@/lib/types";
import { generateAuditPdf } from "@/lib/pdf";

const HCGraph3D = dynamic(() => import("./HCGraph3D"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] rounded-2xl bg-[var(--wldm-black)] flex items-center justify-center text-[var(--wldm-taupe)]">
      Loading 3D graph…
    </div>
  ),
});

const TIER_BADGE: Record<string, string> = {
  high: "bg-[var(--wldm-fluro)] border-[var(--wldm-black)]",
  medium: "bg-[var(--wldm-blue)] border-[var(--wldm-black)]",
  low: "bg-white border-[var(--wldm-black)]",
};

interface Props {
  result: AuditResult;
}

export default function AuditResults({ result }: Props) {
  const { analysis, domain, elapsedMs, proxyUsed } = result;
  const [generatingPdf, setGeneratingPdf] = useState(false);

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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
        <Kpi label="Pages" value={analysis.totalPages} />
        <Kpi label="Links" value={analysis.totalLinks} />
        <Kpi label="Density" value={analysis.density.toFixed(3)} />
        <Kpi label="Orphans" value={analysis.orphans.length} highlight={analysis.orphans.length > 0} />
        <Kpi label="Crawl time" value={`${(elapsedMs / 1000).toFixed(1)}s`} />
      </div>

      {/* Tier bar */}
      <Section title="Authority Tiers">
        <div className="flex gap-2 mb-3">
          {(["high", "medium", "low"] as const).map((t) => {
            const pct = (stats[t] / analysis.totalPages) * 100;
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
              <strong>{stats.low}</strong> low-tier pages — likely orphans or dead-ends —
              are silently bleeding crawl budget.
            </>
          )}
        </p>
      </Section>

      {/* 3D graph */}
      <Section title="Your Link Graph in 3D">
        <p className="text-sm text-[var(--wldm-ink-60)] mb-4">
          Drag to rotate · scroll to zoom · click any node for details. Pulsing red nodes are{" "}
          <strong>orphans</strong> with zero incoming links.
        </p>
        <HCGraph3D nodes={analysis.nodes} edges={analysis.edges} />
      </Section>

      {/* Top pages */}
      <Section title="Top Pages by Harmonic Centrality">
        <div className="card-brutal !p-0 overflow-hidden">
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
              {analysis.topPages.slice(0, 15).map((n, i) => (
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
      </Section>

      {/* Clusters */}
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

      {/* Orphans warning */}
      {analysis.orphans.length > 0 && (
        <Section title="Orphan Pages — No Internal Links Pointing To Them">
          <div
            className="rounded-2xl p-5 border border-[var(--wldm-black)]"
            style={{ background: "var(--wldm-fluro)", boxShadow: "4px 4px 0 var(--wldm-black)" }}
          >
            <p className="text-sm text-[var(--wldm-black)] mb-3">
              These <strong>{analysis.orphans.length}</strong> pages have zero incoming internal links.
              They&apos;re invisible to crawlers and harvesters — fix by adding internal links from high-HC pages.
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

      {/* Footer */}
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
