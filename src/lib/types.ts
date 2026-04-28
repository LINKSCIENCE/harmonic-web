import type { NodeMetrics, Diagnostics } from "./graph";

export interface AuditResult {
  domain: string;
  startUrl: string;
  elapsedMs: number;
  proxyUsed: number;
  totalRequests: number;
  analysis: {
    totalPages: number;
    totalLinks: number;
    density: number;
    pagerankDegenerate: boolean;
    topPages: NodeMetrics[];
    orphans: NodeMetrics[];
    nodes: NodeMetrics[];
    edges: Array<{ source: string; target: string }>;
    diagnostics: Diagnostics;
    depthHistogram: Array<{ depth: number; count: number }>;
  };
}

export interface ProgressEvent {
  visited: number;
  max: number;
  currentUrl: string;
  viaProxy: boolean;
}
