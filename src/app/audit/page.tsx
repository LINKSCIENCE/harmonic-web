"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import TerminalLoader, { type LogLine } from "@/components/TerminalLoader";
import AuditResults from "@/components/AuditResults";
import type { AuditResult, ProgressEvent } from "@/lib/types";

type Phase = "idle" | "running" | "done" | "error";

function tsNow(): string {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function pad(n: number) {
  return String(n).padStart(2, "0");
}

function AuditView() {
  const params = useSearchParams();
  const router = useRouter();
  const domain = params.get("domain") || "";
  const [phase, setPhase] = useState<Phase>("idle");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [progress, setProgress] = useState<ProgressEvent>({ visited: 0, max: 100, currentUrl: "", viaProxy: false });
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string>("");
  const startedRef = useRef(false);

  useEffect(() => {
    if (!domain) {
      router.push("/");
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    const append = (level: LogLine["level"], message: string) =>
      setLogs((prev) => [...prev, { ts: tsNow(), level, message }]);

    setPhase("running");
    append("exec", `Initiating crawl on ${domain}`);

    const ctrl = new AbortController();
    fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, maxPages: 100, delayMs: 200 }),
      signal: ctrl.signal,
    })
      .then(async (resp) => {
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        if (!resp.body) throw new Error("No stream body");

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const evt of events) {
            const lines = evt.split("\n");
            const ev = lines.find((l) => l.startsWith("event:"))?.slice(6).trim();
            const dataLine = lines.find((l) => l.startsWith("data:"))?.slice(5).trim();
            if (!ev || !dataLine) continue;
            const data = JSON.parse(dataLine);

            if (ev === "start") {
              append("info", `Crawl budget: ${data.maxPages} pages, real Chrome UA, proxy fallback armed`);
            } else if (ev === "progress") {
              setProgress(data);
              if (data.viaProxy) {
                append("warn", `[proxy] ${data.currentUrl}`);
              } else if ((data.visited as number) % 10 === 0) {
                append("ok", `${data.currentUrl}`);
              }
            } else if (ev === "analyzing") {
              append("exec", `Computing harmonic centrality, PageRank, betweenness, HITS…`);
            } else if (ev === "done") {
              append("ok", `Done — ${data.analysis.totalPages} pages, ${data.analysis.totalLinks} links, ${(data.elapsedMs / 1000).toFixed(1)}s`);
              setResult(data as AuditResult);
              setPhase("done");
            } else if (ev === "error") {
              append("err", data.message);
              setError(data.message);
              setPhase("error");
            }
          }
        }
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        const msg = err instanceof Error ? err.message : "Unknown error";
        append("err", msg);
        setError(msg);
        setPhase("error");
      });

    return () => ctrl.abort();
  }, [domain, router]);

  return (
    <main className="flex-1 flex flex-col">
      <header className="px-8 py-6 flex items-center justify-between max-w-7xl mx-auto w-full">
        <Image src="/wldm-logo.png" alt="WLDM" width={200} height={59} priority className="h-10 w-auto" />
        <span className="hero-badge">
          <span className="dot" /> WLDM.IO
        </span>
      </header>

      {phase === "running" && (
        <TerminalLoader
          domain={domain}
          logs={logs}
          visited={progress.visited}
          max={progress.max}
          proxyUsed={logs.filter((l) => l.message.startsWith("[proxy]")).length}
        />
      )}

      {phase === "error" && (
        <div className="max-w-2xl mx-auto px-6 py-16 text-center">
          <div className="card-brutal" style={{ background: "var(--wldm-fluro)" }}>
            <h2 className="text-2xl font-[family-name:var(--font-chakra-petch)] font-bold mb-3">
              Crawl failed
            </h2>
            <p className="text-[var(--wldm-black)] mb-5">{error}</p>
            <button onClick={() => router.push("/")} className="btn-pill btn-outline">
              ← Try another domain
            </button>
          </div>
        </div>
      )}

      {phase === "done" && result && <AuditResults result={result} />}
    </main>
  );
}

export default function AuditPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[var(--wldm-ink-60)]">Loading…</span>
        </div>
      }
    >
      <AuditView />
    </Suspense>
  );
}
