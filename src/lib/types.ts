import type { NodeMetrics } from "./graph";

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
  };
}

export interface ProgressEvent {
  visited: number;
  max: number;
  currentUrl: string;
  viaProxy: boolean;
}
