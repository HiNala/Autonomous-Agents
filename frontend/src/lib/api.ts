import type {
  AnalyzeRequest,
  AnalyzeResponse,
  AnalysisResult,
  Finding,
  Fix,
  FixSummary,
  VulnerabilityChain,
  GraphNode,
  GraphEdge,
  SensoSearchResult,
  SensoGenerateResult,
} from "@/types/shared";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const API = `${BASE}/api/v1`;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  health: () => request<{ status: string }>("/health"),

  analyze: (body: AnalyzeRequest) =>
    request<AnalyzeResponse>("/analyze", { method: "POST", body: JSON.stringify(body) }),

  getAnalysis: (id: string) =>
    request<AnalysisResult>(`/analysis/${id}`),

  getFindings: (id: string, params?: { severity?: string; agent?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))
    ).toString();
    return request<{ items: Finding[]; total: number; limit: number; offset: number }>(
      `/analysis/${id}/findings${qs ? `?${qs}` : ""}`
    );
  },

  getChains: (id: string) =>
    request<{ chains: VulnerabilityChain[] }>(`/analysis/${id}/chains`),

  getFixes: (id: string) =>
    request<{ fixes: Fix[]; summary: FixSummary }>(`/analysis/${id}/fixes`),

  getGraph: (id: string, view?: string, depth?: number) => {
    const qs = new URLSearchParams({
      view: view ?? "structure",
      ...(depth ? { depth: String(depth) } : {}),
    }).toString();
    return request<{ nodes: GraphNode[]; edges: GraphEdge[]; layout: { type: string; direction?: string } }>(
      `/analysis/${id}/graph?${qs}`
    );
  },

  sensoSearch: (id: string, query: string, maxResults = 5) =>
    request<SensoSearchResult>(
      `/analysis/${id}/senso/search`,
      { method: "POST", body: JSON.stringify({ query, maxResults }) }
    ),

  sensoGenerate: (id: string, contentType: string, instructions: string, save = true, maxResults = 10) =>
    request<SensoGenerateResult>(
      `/analysis/${id}/senso/generate`,
      {
        method: "POST",
        body: JSON.stringify({ contentType, instructions, save, maxResults }),
      }
    ),
};
