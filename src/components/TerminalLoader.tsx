"use client";

import { useEffect, useRef } from "react";

export interface LogLine {
  ts: string;
  level: "info" | "exec" | "ok" | "warn" | "err";
  message: string;
}

interface Props {
  domain: string;
  logs: LogLine[];
  visited: number;
  max: number;
  proxyUsed: number;
}

const LEVEL_COLOR: Record<LogLine["level"], string> = {
  info: "text-[var(--wldm-blue)]",
  exec: "text-[var(--wldm-fluro)]",
  ok: "text-emerald-400",
  warn: "text-yellow-400",
  err: "text-red-400",
};

const LEVEL_PREFIX: Record<LogLine["level"], string> = {
  info: "·",
  exec: "▶",
  ok: "✓",
  warn: "!",
  err: "✗",
};

export default function TerminalLoader({ domain, logs, visited, max, proxyUsed }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [logs]);

  const pct = Math.min(100, Math.round((visited / max) * 100));

  return (
    <div className="max-w-4xl mx-auto w-full px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-[var(--wldm-ink-40)] font-[family-name:var(--font-chakra-petch)] font-semibold">
            Crawling
          </div>
          <h2 className="text-3xl font-[family-name:var(--font-chakra-petch)] font-bold text-[var(--wldm-black)]">
            {domain}
          </h2>
        </div>
        <div className="text-right">
          <div className="text-3xl font-[family-name:var(--font-chakra-petch)] font-bold text-[var(--wldm-black)]">
            {visited}
            <span className="text-[var(--wldm-ink-40)] text-xl">/{max}</span>
          </div>
          <div className="text-xs text-[var(--wldm-ink-40)]">pages</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-3 bg-white border border-[var(--wldm-black)] rounded-full overflow-hidden mb-6">
        <div
          className="h-full transition-[width] duration-300 ease-out"
          style={{
            width: `${pct}%`,
            background: "var(--wldm-fluro)",
            boxShadow: "0 0 12px var(--wldm-fluro-glow)",
          }}
        />
      </div>

      {/* Stats chips */}
      <div className="flex gap-3 mb-4 flex-wrap text-xs font-[family-name:var(--font-chakra-petch)] font-semibold uppercase tracking-wider">
        <span className="chip">Pages {visited}</span>
        {proxyUsed > 0 && (
          <span className="chip" style={{ background: "var(--wldm-blue)" }}>
            Proxy {proxyUsed}
          </span>
        )}
        <span className="chip">{pct}%</span>
      </div>

      {/* Terminal */}
      <div className="terminal-bg p-5 max-h-[500px] overflow-y-auto" ref={scrollRef}>
        <div className="text-xs space-y-1">
          {logs.map((line, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-[var(--wldm-taupe)] tabular-nums shrink-0">{line.ts}</span>
              <span className={`${LEVEL_COLOR[line.level]} shrink-0 w-3`}>{LEVEL_PREFIX[line.level]}</span>
              <span className="text-[var(--wldm-beige-50)] break-all">{line.message}</span>
            </div>
          ))}
          <div className="text-[var(--wldm-fluro)] flex gap-3 pt-1">
            <span className="text-[var(--wldm-taupe)] tabular-nums shrink-0">--:--:--</span>
            <span className="shrink-0 w-3 animate-pulse">▮</span>
          </div>
        </div>
      </div>
    </div>
  );
}
