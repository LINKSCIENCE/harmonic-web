"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function HomePage() {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [email, setEmail] = useState("");
  const [maxPages, setMaxPages] = useState(100);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const cleaned = domain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!cleaned || !cleaned.includes(".")) {
      setError("Enter a valid domain like wldm.io");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid email so we can send you the report");
      return;
    }
    setSubmitting(true);
    // Fire-and-forget lead capture — we don't block the audit on it
    fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: cleaned, email: email.trim().toLowerCase(), maxPages }),
    }).catch(() => {});
    router.push(`/audit?domain=${encodeURIComponent(cleaned)}&max=${maxPages}&email=${encodeURIComponent(email.trim().toLowerCase())}`);
  }

  return (
    <main className="flex-1 flex flex-col">
      {/* Top bar with logo */}
      <header className="px-8 py-6 max-w-7xl mx-auto w-full">
        <Image
          src="/wldm-logo.png"
          alt="WLDM"
          width={200}
          height={59}
          priority
          className="h-10 w-auto"
        />
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center max-w-4xl mx-auto w-full">
        <h1 className="font-[family-name:var(--font-chakra-petch)] font-extrabold text-5xl sm:text-6xl md:text-7xl leading-[1.05] tracking-[-0.02em] text-[var(--wldm-black)] mb-6">
          Is your site&apos;s{" "}
          <span className="highlight-fluro whitespace-nowrap">link architecture</span>{" "}
          working against you?
        </h1>

        <p className="text-lg sm:text-xl text-[var(--wldm-ink-60)] max-w-2xl mb-10 leading-relaxed">
          Enter your domain. We&apos;ll crawl your internal link graph and show you
          exactly which pages capture authority — and which are silently starving your SEO.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full max-w-xl mb-6">
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="yourdomain.com"
            disabled={submitting}
            className="px-5 py-4 bg-white border-2 border-[var(--wldm-black)] rounded-full text-base focus:outline-none focus:border-[var(--wldm-blue-dark)] disabled:opacity-60"
          />
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              disabled={submitting}
              className="flex-1 px-5 py-4 bg-white border-2 border-[var(--wldm-black)] rounded-full text-base focus:outline-none focus:border-[var(--wldm-blue-dark)] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={submitting}
              className="btn-pill btn-fluro disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? "Loading…" : "Analyze →"}
            </button>
          </div>
          <p className="text-xs text-[var(--wldm-ink-40)] text-center">
            We&apos;ll send you the full report by email.
          </p>
        </form>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        {/* Crawl size selector */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm">
          <span className="text-[var(--wldm-ink-60)] mr-1">Crawl up to</span>
          {[50, 100, 250, 500].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setMaxPages(n)}
              className={`px-4 py-1.5 rounded-full border-2 font-[family-name:var(--font-chakra-petch)] font-semibold transition ${
                maxPages === n
                  ? "bg-[var(--wldm-black)] text-[var(--wldm-beige-50)] border-[var(--wldm-black)]"
                  : "bg-transparent text-[var(--wldm-black)] border-[var(--wldm-black)] hover:bg-[var(--wldm-black)] hover:text-[var(--wldm-beige-50)]"
              }`}
            >
              {n}
            </button>
          ))}
          <span className="text-[var(--wldm-ink-60)] ml-1">pages</span>
        </div>
        <p className="text-xs text-[var(--wldm-ink-40)] mt-2">
          Bigger crawls take longer. 500 pages can run 3–5 minutes on protected sites.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <span className="chip">Harmonic Centrality</span>
          <span className="chip">Real-time Crawl</span>
          <span className="chip">PDF Export</span>
        </div>
      </section>

      {/* Feature cards */}
      <section className="px-6 py-12 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: "📈",
              title: "See the math",
              desc: "Which pages capture authority? Which bleed it? Six different scores, one clear picture.",
            },
            {
              icon: "🕸️",
              title: "Spin your site",
              desc: "Interactive 3D map of your internal link graph. Orphan pages light up red — instantly.",
            },
            {
              icon: "📄",
              title: "Take it with you",
              desc: "Download a clean report you can share with your team or attach to your next SEO call.",
            },
          ].map((f) => (
            <div key={f.title} className="card-brutal">
              <div className="inline-block bg-[var(--wldm-blue)] border border-[var(--wldm-black)] rounded-lg px-3 py-1 text-2xl mb-3">
                {f.icon}
              </div>
              <h3 className="font-[family-name:var(--font-chakra-petch)] font-bold text-xl mb-2 text-[var(--wldm-black)]">
                {f.title}
              </h3>
              <p className="text-[var(--wldm-ink-60)] text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-12 max-w-4xl mx-auto w-full">
        <div
          className="rounded-2xl p-7 border border-[var(--wldm-black)]"
          style={{
            background: "var(--wldm-blue)",
            boxShadow: "4px 4px 0 var(--wldm-black)",
          }}
        >
          <div className="font-[family-name:var(--font-chakra-petch)] font-bold uppercase tracking-wider text-sm mb-4">
            How it works
          </div>
          <ol className="space-y-2 text-[var(--wldm-black)]">
            <li>
              <strong>1.</strong> Enter your domain — that&apos;s it.
            </li>
            <li>
              <strong>2.</strong> We crawl up to 100 internal pages (BFS, real Chrome UA + proxy fallback).
            </li>
            <li>
              <strong>3.</strong> Build a directed graph and compute harmonic centrality:{" "}
              <code className="bg-[var(--wldm-beige-50)] px-2 py-0.5 rounded border border-[var(--wldm-black)]">
                H(v) = Σ 1/d(v,u)
              </code>
            </li>
            <li>
              <strong>4.</strong> Compare HC vs PageRank, betweenness, HITS, closeness — and spot the orphans.
            </li>
            <li>
              <strong>5.</strong> Download a branded PDF report.
            </li>
          </ol>
        </div>
      </section>

      <footer className="px-8 py-8 text-center text-xs text-[var(--wldm-ink-40)]">
        <Image
          src="/wldm-logo.png"
          alt="WLDM"
          width={120}
          height={35}
          className="h-7 w-auto mx-auto mb-3 opacity-60"
        />
        <p>WLDM.IO · Harmonic Centrality · Internal Link Graph Analysis</p>
      </footer>
    </main>
  );
}
