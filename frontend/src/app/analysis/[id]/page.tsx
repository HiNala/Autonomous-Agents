"use client";
import { useEffect } from "react";
import { use } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { AnalysisProgress } from "@/components/progress/AnalysisProgress";
import { HealthScoreHero } from "@/components/score/HealthScoreHero";
import { ScoreBreakdown } from "@/components/score/ScoreBreakdown";
import { FindingsPanel } from "@/components/findings/FindingsPanel";
import { FixPlan } from "@/components/fixes/FixPlan";
import { useAnalysisStore } from "@/stores/analysisStore";
import { useAnalysisWebSocket } from "@/hooks/useAnalysisWebSocket";
import { api } from "@/lib/api";

export default function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { analysisId, status, startAnalysis, setResult } = useAnalysisStore();

  // If navigating directly to this page, initialize the store
  useEffect(() => {
    if (analysisId !== id) {
      startAnalysis(id);
      api.getAnalysis(id)
        .then((result) => setResult(result))
        .catch(() => null);
    }
  }, [id, analysisId, startAnalysis, setResult]);

  // WebSocket connection
  useAnalysisWebSocket(id);

  const isScanning = ["queued", "cloning", "mapping", "analyzing", "completing"].includes(status);
  const isCompleted = status === "completed";
  const isFailed = status === "failed";

  return (
    <AppShell>
      {/* Scanning view */}
      {isScanning && <AnalysisProgress />}

      {/* Completed dashboard */}
      {isCompleted && (
        <div
          style={{
            maxWidth: 1400,
            margin: "0 auto",
            padding: "var(--space-6)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-5)",
          }}
          className="animate-fade-in"
        >
          {/* Score row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "280px 1fr",
              gap: "var(--space-5)",
              alignItems: "start",
            }}
          >
            <HealthScoreHero />
            <ScoreBreakdown />
          </div>

          {/* Graph + Findings row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "60% 40%",
              gap: "var(--space-5)",
            }}
          >
            {/* Graph placeholder */}
            <div
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-lg)",
                minHeight: 400,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ padding: "var(--space-4)", borderBottom: "1px solid var(--border-default)" }}>
                <h2 style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-small)", color: "var(--text-secondary)", margin: 0, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  GRAPH
                </h2>
              </div>
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "var(--space-3)", color: "var(--text-tertiary)", padding: "var(--space-6)" }}>
                <span style={{ fontSize: "2rem" }}>🕸</span>
                <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-small)" }}>
                  Cytoscape.js graph panel coming next
                </span>
                <span style={{ fontSize: "var(--text-micro)" }}>
                  Structure · Dependencies · Vulnerabilities
                </span>
              </div>
            </div>

            <FindingsPanel />
          </div>

          {/* Fix plan */}
          <FixPlan />
        </div>
      )}

      {/* Failed state */}
      {isFailed && <FailedState />}
    </AppShell>
  );
}

function FailedState() {
  const { errorMessage } = useAnalysisStore();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "var(--space-5)", padding: "var(--space-6)" }}>
      <div style={{ fontSize: "3rem" }}>⚠️</div>
      <div style={{ textAlign: "center" }}>
        <h2 style={{ fontSize: "var(--text-h2)", color: "var(--color-critical)", margin: "0 0 var(--space-3)" }}>Analysis Failed</h2>
        <p style={{ color: "var(--text-secondary)", margin: 0, maxWidth: 400 }}>
          {errorMessage ?? "An unexpected error occurred. Please try again."}
        </p>
      </div>
      <a
        href="/"
        style={{
          background: "var(--color-accent)",
          color: "white",
          padding: "10px 24px",
          borderRadius: "var(--radius-md)",
          textDecoration: "none",
          fontWeight: 600,
          fontSize: "var(--text-small)",
        }}
      >
        Try Another Repo
      </a>
    </div>
  );
}
