"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { AnalysisProgress } from "@/components/progress/AnalysisProgress";
import { useAnalysisWebSocket } from "@/hooks/useAnalysisWebSocket";
import { useAnalysisStore } from "@/stores/analysisStore";

export default function AnalysisPage() {
  const params = useParams<{ id: string }>();
  const analysisId = params.id;
  const { status, startAnalysis } = useAnalysisStore();

  useEffect(() => {
    if (analysisId) startAnalysis(analysisId);
  }, [analysisId, startAnalysis]);

  useAnalysisWebSocket(analysisId);

  return (
    <AppShell>
      <div
        style={{
          minHeight: "calc(100vh - 96px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "var(--space-6)",
        }}
      >
        <div style={{ width: "100%", maxWidth: "960px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              marginBottom: "var(--space-6)",
            }}
          >
            <h1
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "var(--text-xl)",
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: 0,
              }}
            >
              Analysis
            </h1>
            <code
              style={{
                fontFamily: "var(--font-code)",
                fontSize: "var(--text-small)",
                color: "var(--text-tertiary)",
                background: "var(--bg-surface)",
                padding: "2px 8px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-default)",
              }}
            >
              {analysisId}
            </code>
            <span
              style={{
                fontSize: "var(--text-micro)",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                padding: "2px 10px",
                borderRadius: "var(--radius-full)",
                background:
                  status === "completed"
                    ? "rgba(34,197,94,0.1)"
                    : status === "failed"
                      ? "rgba(239,68,68,0.1)"
                      : "rgba(59,130,246,0.1)",
                color:
                  status === "completed"
                    ? "var(--color-healthy)"
                    : status === "failed"
                      ? "var(--color-critical)"
                      : "var(--color-accent)",
              }}
            >
              {status}
            </span>
          </div>

          <AnalysisProgress />
        </div>
      </div>
    </AppShell>
  );
}
