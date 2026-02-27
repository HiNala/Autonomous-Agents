import type {
  AnalyzeRequest,
  AnalyzeResponse,
  AnalysisResult,
  Finding,
  Fix,
  FixSummary,
  VulnerabilityChain,
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
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<{ items: Finding[]; total: number; limit: number; offset: number }>(
      `/analysis/${id}/findings${qs ? `?${qs}` : ""}`
    );
  },

  getChains: (id: string) =>
    request<{ chains: VulnerabilityChain[] }>(`/analysis/${id}/chains`),

  getFixes: (id: string) =>
    request<{ fixes: Fix[]; summary: FixSummary }>(`/analysis/${id}/fixes`),

  getGraph: (id: string, view?: string, depth?: number) => {
    const qs = new URLSearchParams({ view: view ?? "structure", ...(depth ? { depth: String(depth) } : {}) }).toString();
    return request<{ nodes: unknown[]; edges: unknown[]; layout: unknown }>(`/analysis/${id}/graph?${qs}`);
  },

  sensoSearch: (id: string, query: string, maxResults = 5) =>
    request<{ answer: string; sources: unknown[]; processingTimeMs: number; totalResults: number }>(
      `/analysis/${id}/senso/search`,
      { method: "POST", body: JSON.stringify({ query, maxResults }) }
    ),
};
