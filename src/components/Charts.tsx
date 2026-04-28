"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
  PieChart,
  Pie,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
} from "recharts";
import type { NodeMetrics } from "@/lib/graph";

const COLORS = {
  black: "#2a2b29",
  blue: "#b8d3d8",
  blueDark: "#6b9ba4",
  bluePale: "#e0ecee",
  beige: "#eeeade",
  beige50: "#f7f5ee",
  taupe: "#bfc0b6",
  fluro: "#e1ff01",
  red: "#ef4444",
};

const TIER_COLOR: Record<string, string> = {
  high: COLORS.fluro,
  medium: COLORS.blue,
  low: COLORS.taupe,
};

function urlPath(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

const tooltipStyle = {
  background: COLORS.black,
  border: `1px solid ${COLORS.black}`,
  borderRadius: 8,
  color: COLORS.beige,
  fontSize: 12,
  padding: "8px 12px",
} as const;

/* ── 1. TOP PAGES BAR CHART ────────────────────────────────────── */

export function TopPagesChart({ nodes, n = 20 }: { nodes: NodeMetrics[]; n?: number }) {
  const data = useMemo(
    () =>
      [...nodes]
        .sort((a, b) => b.harmonic - a.harmonic)
        .slice(0, n)
        .map((node) => ({
          path: urlPath(node.url).slice(0, 35),
          hc: Number((node.harmonic * 100).toFixed(1)),
          tier: node.tier,
        }))
        .reverse(),
    [nodes, n]
  );

  if (data.length < 2) return <Empty msg="Need at least 2 pages" />;

  return (
    <div className="card-brutal !p-4 bg-white">
      <ResponsiveContainer width="100%" height={Math.max(data.length * 24, 280)}>
        <BarChart data={data} layout="vertical" margin={{ left: 20, right: 30, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={COLORS.bluePale} />
          <XAxis type="number" stroke={COLORS.taupe} tick={{ fontSize: 11 }} domain={[0, 100]} />
          <YAxis
            type="category"
            dataKey="path"
            stroke={COLORS.taupe}
            tick={{ fontSize: 11, fill: COLORS.black }}
            width={250}
          />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: COLORS.bluePale, opacity: 0.5 }} />
          <Bar dataKey="hc" name="HC %" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={TIER_COLOR[d.tier]} stroke={COLORS.black} strokeWidth={1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── 2. HC DISTRIBUTION HISTOGRAM ──────────────────────────────── */

export function DistributionChart({ nodes }: { nodes: NodeMetrics[] }) {
  const histogram = useMemo(() => {
    const bins = 20;
    const counts = new Array(bins).fill(0);
    nodes.forEach((nd) => {
      const idx = Math.min(bins - 1, Math.floor(nd.harmonic * bins));
      counts[idx]++;
    });
    return counts.map((count, i) => ({
      bucket: `${(i / bins).toFixed(2)}-${((i + 1) / bins).toFixed(2)}`,
      count,
      mid: (i + 0.5) / bins,
    }));
  }, [nodes]);

  if (nodes.length < 5) return <Empty msg="Need at least 5 pages" />;

  return (
    <div className="card-brutal !p-4 bg-white">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={histogram} margin={{ left: 5, right: 10, top: 10, bottom: 30 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={COLORS.bluePale} />
          <XAxis
            dataKey="bucket"
            stroke={COLORS.taupe}
            tick={{ fontSize: 9, fill: COLORS.black }}
            angle={-30}
            textAnchor="end"
            height={50}
          />
          <YAxis stroke={COLORS.taupe} tick={{ fontSize: 11, fill: COLORS.black }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="count" fill={COLORS.blueDark} stroke={COLORS.black} strokeWidth={1} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-[var(--wldm-ink-60)] mt-2 text-center">
        Distribution of harmonic centrality values across {nodes.length} pages.
      </p>
    </div>
  );
}

/* ── 3. HC vs PAGERANK SCATTER ─────────────────────────────────── */

export function HcVsPrChart({ nodes, degenerate }: { nodes: NodeMetrics[]; degenerate: boolean }) {
  const data = useMemo(
    () =>
      nodes.map((nd) => ({
        x: Number((nd.harmonic * 100).toFixed(2)),
        y: Number((nd.pagerank * 1000).toFixed(3)),
        path: urlPath(nd.url).slice(0, 40),
        tier: nd.tier,
      })),
    [nodes]
  );

  if (degenerate) {
    return (
      <div className="card-brutal !p-5 bg-[var(--wldm-fluro)]">
        <p className="text-sm font-semibold text-[var(--wldm-black)]">
          PageRank values are uniform — scatter would be a vertical line. Skipping this chart.
        </p>
      </div>
    );
  }
  if (data.length < 3) return <Empty msg="Need at least 3 pages" />;

  return (
    <div className="card-brutal !p-4 bg-white">
      <ResponsiveContainer width="100%" height={360}>
        <ScatterChart margin={{ left: 5, right: 20, top: 20, bottom: 40 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={COLORS.bluePale} />
          <XAxis
            type="number"
            dataKey="x"
            name="HC"
            stroke={COLORS.taupe}
            tick={{ fontSize: 11, fill: COLORS.black }}
            label={{ value: "Harmonic Centrality (×100)", position: "bottom", offset: 0, fill: COLORS.black, fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="PR"
            stroke={COLORS.taupe}
            tick={{ fontSize: 11, fill: COLORS.black }}
            label={{ value: "PageRank (×1000)", angle: -90, position: "insideLeft", fill: COLORS.black, fontSize: 11 }}
          />
          <ZAxis range={[60, 180]} />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ strokeDasharray: "3 3" }}
            content={({ payload }) => {
              if (!payload?.length) return null;
              const p = payload[0].payload;
              return (
                <div style={tooltipStyle}>
                  <div className="font-semibold mb-1">{p.path}</div>
                  <div>HC: {p.x}</div>
                  <div>PR: {p.y}</div>
                </div>
              );
            }}
          />
          <Scatter data={data} fill={COLORS.blueDark}>
            {data.map((d, i) => (
              <Cell key={i} fill={TIER_COLOR[d.tier]} stroke={COLORS.black} strokeWidth={1} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── 4. TIER DONUT ─────────────────────────────────────────────── */

export function TierDonut({ nodes }: { nodes: NodeMetrics[] }) {
  const data = useMemo(() => {
    const m = { high: 0, medium: 0, low: 0 };
    nodes.forEach((nd) => m[nd.tier]++);
    return [
      { name: "High", value: m.high, color: COLORS.fluro },
      { name: "Medium", value: m.medium, color: COLORS.blue },
      { name: "Low", value: m.low, color: COLORS.taupe },
    ];
  }, [nodes]);

  if (nodes.length < 2) return <Empty msg="Need at least 2 pages" />;

  return (
    <div className="card-brutal !p-4 bg-white flex items-center gap-6">
      <ResponsiveContainer width={220} height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={50} outerRadius={90} paddingAngle={2}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} stroke={COLORS.black} strokeWidth={1.5} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-2">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-3 text-sm">
            <span className="w-4 h-4 rounded border border-[var(--wldm-black)]" style={{ background: d.color }} />
            <span className="font-[family-name:var(--font-chakra-petch)] font-semibold uppercase tracking-wider text-xs">
              {d.name}
            </span>
            <span className="text-[var(--wldm-black)] tabular-nums ml-auto font-bold">
              {d.value}{" "}
              <span className="text-[var(--wldm-ink-40)] font-normal">
                ({((d.value / Math.max(nodes.length, 1)) * 100).toFixed(0)}%)
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 5. CENTRALITY RADAR (TOP 10) ──────────────────────────────── */

export function CentralityRadar({ nodes }: { nodes: NodeMetrics[] }) {
  const data = useMemo(() => {
    const top = [...nodes].sort((a, b) => b.harmonic - a.harmonic).slice(0, 5);
    if (top.length < 3) return [];
    const maxPr = Math.max(...nodes.map((n) => n.pagerank), 1e-9);
    const maxBc = Math.max(...nodes.map((n) => n.betweenness), 1e-9);
    const maxClose = Math.max(...nodes.map((n) => n.closeness), 1e-9);
    const maxHub = Math.max(...nodes.map((n) => n.hub), 1e-9);
    const maxAuth = Math.max(...nodes.map((n) => n.authority), 1e-9);
    return ["Harmonic", "PageRank", "Betweenness", "Closeness", "Hub", "Authority"].map((metric) => {
      const row: Record<string, string | number> = { metric };
      top.forEach((nd, i) => {
        const key = `p${i + 1}`;
        if (metric === "Harmonic") row[key] = nd.harmonic;
        else if (metric === "PageRank") row[key] = nd.pagerank / maxPr;
        else if (metric === "Betweenness") row[key] = nd.betweenness / maxBc;
        else if (metric === "Closeness") row[key] = nd.closeness / maxClose;
        else if (metric === "Hub") row[key] = nd.hub / maxHub;
        else if (metric === "Authority") row[key] = nd.authority / maxAuth;
      });
      return row;
    });
  }, [nodes]);

  if (data.length === 0) return <Empty msg="Need at least 3 pages" />;
  const top = [...nodes].sort((a, b) => b.harmonic - a.harmonic).slice(0, 5);
  const palette = [COLORS.fluro, COLORS.blueDark, COLORS.blue, "#a84b2f", "#ffc553"];

  return (
    <div className="card-brutal !p-4 bg-white">
      <ResponsiveContainer width="100%" height={420}>
        <RadarChart data={data} outerRadius="75%">
          <PolarGrid stroke={COLORS.bluePale} />
          <PolarAngleAxis
            dataKey="metric"
            tick={{ fontSize: 11, fill: COLORS.black, fontWeight: 600 }}
          />
          <PolarRadiusAxis angle={90} domain={[0, 1]} tick={{ fontSize: 9, fill: COLORS.taupe }} />
          {top.map((nd, i) => (
            <Radar
              key={nd.url}
              name={urlPath(nd.url).slice(0, 30) || "/"}
              dataKey={`p${i + 1}`}
              stroke={palette[i]}
              fill={palette[i]}
              fillOpacity={0.18}
              strokeWidth={2}
            />
          ))}
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} />
        </RadarChart>
      </ResponsiveContainer>
      <p className="text-xs text-[var(--wldm-ink-60)] mt-2 text-center">
        Top 5 pages compared across six centrality metrics (each axis normalized 0-1).
      </p>
    </div>
  );
}

/* ── 6. CLICK DEPTH HISTOGRAM ──────────────────────────────────── */

export function DepthChart({ histogram }: { histogram: Array<{ depth: number; count: number }> }) {
  const data = useMemo(
    () =>
      histogram.map((d) => ({
        label: d.depth === -1 ? "unreachable" : d.depth === 0 ? "homepage" : `${d.depth} click${d.depth === 1 ? "" : "s"}`,
        count: d.count,
        color: d.depth === -1 ? COLORS.red : d.depth === 0 ? COLORS.fluro : d.depth <= 3 ? COLORS.blueDark : COLORS.taupe,
      })),
    [histogram]
  );

  if (data.length === 0) return <Empty msg="No depth data" />;

  return (
    <div className="card-brutal !p-4 bg-white">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ left: 5, right: 10, top: 10, bottom: 30 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={COLORS.bluePale} />
          <XAxis
            dataKey="label"
            stroke={COLORS.taupe}
            tick={{ fontSize: 11, fill: COLORS.black }}
            angle={-15}
            textAnchor="end"
            height={50}
          />
          <YAxis stroke={COLORS.taupe} tick={{ fontSize: 11, fill: COLORS.black }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="count" stroke={COLORS.black} strokeWidth={1} radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-[var(--wldm-ink-60)] mt-2 text-center">
        Click depth from homepage. Pages more than 3 clicks deep get crawled less by Google.
      </p>
    </div>
  );
}

/* ── 7. LINK PROFILE HEATMAP (in × out by tier) ────────────────── */

export function LinkProfileChart({ nodes }: { nodes: NodeMetrics[] }) {
  const data = useMemo(
    () =>
      nodes.map((nd) => ({
        x: nd.outDegree,
        y: nd.inDegree,
        size: 8 + nd.harmonic * 30,
        path: urlPath(nd.url).slice(0, 40),
        tier: nd.tier,
        hc: nd.harmonic,
      })),
    [nodes]
  );
  if (data.length < 3) return <Empty msg="Need at least 3 pages" />;
  return (
    <div className="card-brutal !p-4 bg-white">
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ left: 5, right: 20, top: 20, bottom: 40 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={COLORS.bluePale} />
          <XAxis
            type="number"
            dataKey="x"
            name="Out-links"
            stroke={COLORS.taupe}
            tick={{ fontSize: 11, fill: COLORS.black }}
            label={{ value: "Out-links", position: "bottom", offset: 0, fill: COLORS.black, fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="In-links"
            stroke={COLORS.taupe}
            tick={{ fontSize: 11, fill: COLORS.black }}
            label={{ value: "In-links", angle: -90, position: "insideLeft", fill: COLORS.black, fontSize: 11 }}
          />
          <ZAxis dataKey="size" range={[40, 240]} />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ strokeDasharray: "3 3" }}
            content={({ payload }) => {
              if (!payload?.length) return null;
              const p = payload[0].payload;
              return (
                <div style={tooltipStyle}>
                  <div className="font-semibold mb-1">{p.path}</div>
                  <div>In: {p.y} · Out: {p.x}</div>
                  <div>HC: {p.hc.toFixed(2)}</div>
                </div>
              );
            }}
          />
          <Scatter data={data}>
            {data.map((d, i) => (
              <Cell key={i} fill={TIER_COLOR[d.tier]} stroke={COLORS.black} strokeWidth={1} fillOpacity={0.75} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <p className="text-xs text-[var(--wldm-ink-60)] mt-2 text-center">
        Each bubble = one page. Bigger = higher HC. Top-right = link hubs (in &amp; out heavy).
      </p>
    </div>
  );
}

/* ── EMPTY STATE ────────────────────────────────────────────────── */

function Empty({ msg }: { msg: string }) {
  return (
    <div className="card-brutal !p-8 bg-white text-center">
      <p className="text-[var(--wldm-ink-60)] text-sm">{msg}</p>
    </div>
  );
}
