"use client";
import { useEffect } from "react";
import { use } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { AnalysisProgress } from "@/components/progress/AnalysisProgress";
import { HealthScoreHero } from "@/components/score/HealthScoreHero";
import { ScoreBreakdown } from "@/components/score/ScoreBreakdown";
import { GraphPanel } from "@/components/graph/GraphPanel";
import { FindingsPanel } from "@/components/findings/FindingsPanel";
import { FindingDetail } from "@/components/findings/FindingDetail";
import { FixPlan } from "@/components/fixes/FixPlan";
import { SensoIntelligencePanel } from "@/components/senso/SensoIntelligencePanel";
import { RepoCard } from "@/components/analysis/RepoCard";
import { useAnalysisStore } from "@/stores/analysisStore";
import { useAnalysisWebSocket } from "@/hooks/useAnalysisWebSocket";
import { api } from "@/lib/api";

export default function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { analysisId, status, startAnalysis, setResult, setFindings, setFixes, setChains } = useAnalysisStore();

  useEffect(() => {
    if (analysisId !== id) {
      startAnalysis(id);
      api.getAnalysis(id).then((r) => {
        setResult(r);
        if (r.status === "completed") {
          api.getFindings(id, { limit: 100 }).then((f) => setFindings(f.items)).catch(() => null);
          api.getFixes(id).then((f) => setFixes(f.fixes, f.summary)).catch(() => null);
          api.getChains(id).then((c) => setChains(c.chains)).catch(() => null);
        }
      }).catch(() => null);
    }
  }, [id, analysisId, startAnalysis, setResult, setFindings, setFixes, setChains]);

  useAnalysisWebSocket(id);

  const isScanning  = ["queued", "cloning", "mapping", "analyzing", "completing"].includes(status);
  const isCompleted = status === "completed";
  const isFailed    = status === "failed";

  return (
    <AppShell>
      {/* ── SCANNING VIEW ────────────────────────────────── */}
      {isScanning && <AnalysisProgress />}

      {/* ── COMPLETED DASHBOARD ──────────────────────────── */}
      {isCompleted && (
        <div className="dashboard-grid animate-fade-in">

          {/* Row 1 — Repo header */}
          <div className="dashboard-full-row">
            <RepoCard />
          </div>

          {/* Row 2 — Score hero (left) + breakdown (right) */}
          <div className="dashboard-score-row">
            <HealthScoreHero />
            <ScoreBreakdown />
          </div>

          {/* Row 3 — Graph (wide) + Findings (narrow) */}
          <div className="dashboard-main-row">
            <GraphPanel />
            <FindingsPanel />
          </div>

          {/* Row 4 — Fix plan */}
          <div className="dashboard-full-row">
            <FixPlan />
          </div>

          {/* Row 5 — Senso intelligence */}
          <div className="dashboard-full-row">
            <SensoIntelligencePanel />
          </div>
        </div>
      )}

      {/* Finding detail slide-over */}
      {isCompleted && <FindingDetail />}

      {/* ── FAILED STATE ────────────────────────────────── */}
      {isFailed && <FailedState />}
    </AppShell>
  );
}

function FailedState() {
  const { errorMessage } = useAnalysisStore();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: "var(--space-5)",
        padding: "var(--space-6)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "rgba(239,68,68,0.12)",
          border: "1px solid rgba(239,68,68,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.5rem",
        }}
      >
        ✕
      </div>
      <div>
        <h2
          style={{
            fontSize: "var(--text-h2)",
            color: "var(--color-critical-text)",
            margin: "0 0 var(--space-3)",
            fontFamily: "var(--font-display)",
            letterSpacing: "0.05em",
          }}
        >
          ANALYSIS FAILED
        </h2>
        <p
          style={{
            color: "var(--text-secondary)",
            margin: 0,
            maxWidth: 420,
            lineHeight: 1.7,
            fontSize: "var(--text-small)",
          }}
        >
          {errorMessage ?? "An unexpected error occurred. Please check the repository URL and try again."}
        </p>
      </div>
      <a
        href="/"
        style={{
          background: "var(--color-accent)",
          color: "white",
          padding: "12px 28px",
          borderRadius: "var(--radius-md)",
          textDecoration: "none",
          fontWeight: 600,
          fontSize: "var(--text-small)",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        ← Try Another Repo
      </a>
    </div>
  );
}
