"use client";
import { useEffect, useRef, useCallback } from "react";
import { useAnalysisStore } from "@/stores/analysisStore";
import { api } from "@/lib/api";
import type { WSMessage } from "@/types/shared";

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";

export function useAnalysisWebSocket(analysisId: string | null) {
  const store = useAnalysisStore();
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxRetries = 5;

  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }, []);

  const startPolling = useCallback((id: string) => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const result = await api.getAnalysis(id);
        store.setResult(result);
        if (result.status === "completed" || result.status === "failed") stopPolling();
      } catch { /* silent */ }
    }, 2000);
  }, [store, stopPolling]);

  const handleMessage = useCallback((msg: WSMessage) => {
    switch (msg.type) {
      case "status":
        store.updateAgentStatus(msg.agent, { name: msg.agent, status: msg.status, progress: msg.progress, message: msg.message });
        store.setStatus(msg.status === "complete" ? "completed" : "analyzing");
        break;
      case "graph_node": store.addGraphNode(msg.node); break;
      case "graph_edge": store.addGraphEdge(msg.edge); break;
      case "finding":    store.addLiveFinding(msg.finding); break;
      case "agent_complete":
        store.updateAgentStatus(msg.agent, { name: msg.agent, status: "complete", progress: 1, message: `${msg.findingsCount} findings`, findingsCount: msg.findingsCount, durationMs: msg.durationMs, provider: msg.provider });
        break;
      case "senso_intelligence": store.addSensoInsight(msg.insight, msg.sourceCount); break;
      case "complete":
        store.setComplete(msg.healthScore, msg.findingsSummary, msg.duration);
        if (analysisId) {
          api.getFindings(analysisId).then((r) => store.setFindings(r.items)).catch(() => null);
          api.getFixes(analysisId).then((r) => store.setFixes(r.fixes, r.summary)).catch(() => null);
          api.getChains(analysisId).then((r) => store.setChains(r.chains)).catch(() => null);
        }
        break;
      case "error":
        if (!msg.recoverable) store.setFailed(msg.message);
        break;
    }
  }, [store, analysisId]);

  useEffect(() => {
    if (!analysisId) return;
    retriesRef.current = 0;

    function connect() {
      const ws = new WebSocket(`${WS_BASE}/ws/analysis/${analysisId}`);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try { handleMessage(JSON.parse(e.data)); } catch { /* silent */ }
      };

      ws.onopen = () => { retriesRef.current = 0; stopPolling(); };

      ws.onclose = () => {
        if (retriesRef.current < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retriesRef.current), 30000);
          retriesRef.current++;
          setTimeout(connect, delay);
        } else {
          startPolling(analysisId);
        }
      };

      ws.onerror = () => ws.close();
    }

    connect();
    return () => { wsRef.current?.close(); stopPolling(); };
  }, [analysisId, handleMessage, startPolling, stopPolling]);
}
