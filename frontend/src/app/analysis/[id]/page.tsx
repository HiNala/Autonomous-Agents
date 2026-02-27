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
import { useAnalysisStore } from "@/stores/analysisStore";
import { useAnalysisWebSocket } from "@/hooks/useAnalysisWebSocket";
import { api } from "@/lib/api";

export default function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { analysisId, status, startAnalysis, setResult, setFindings, setFixes, setChains } = useAnalysisStore();

  // Boot store if navigating directly to URL
  useEffect(() => {
    if (analysisId !== id) {
      startAnalysis(id);
      api.getAnalysis(id).then((r) => {
        setResult(r);
        // If already completed, load all sub-resources
        if (r.status === "completed") {
          api.getFindings(id, { limit: 100 }).then((f) => setFindings(f.items)).catch(() => null);
          api.getFixes(id).then((f) => setFixes(f.fixes, f.summary)).catch(() => null);
          api.getChains(id).then((c) => setChains(c.chains)).catch(() => null);
        }
      }).catch(() => null);
    }
  }, [id, analysisId, startAnalysis, setResult, setFindings, setFixes, setChains]);

  useAnalysisWebSocket(id);

  const isScanning   = ["queued", "cloning", "mapping", "analyzing", "completing"].includes(status);
  const isCompleted  = status === "completed";
  const isFailed     = status === "failed";

  return (
    <AppShell>
      {/* ── SCANNING VIEW ─────────────────────────────────── */}
      {isScanning && <AnalysisProgress />}

      {/* ── COMPLETED DASHBOARD ───────────────────────────── */}
      {isCompleted && (
        <div
          style={{ maxWidth: 1400, margin: "0 auto", padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}
          className="animate-fade-in"
        >
          {/* Row 1 — Score hero + breakdown */}
          <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "var(--space-5)", alignItems: "start" }}>
            <HealthScoreHero />
            <ScoreBreakdown />
          </div>

          {/* Row 2 — Graph + Findings (with FindingDetail slide-over) */}
          <div style={{ display: "grid", gridTemplateColumns: "60% 1fr", gap: "var(--space-5)", alignItems: "start" }}>
            <GraphPanel />
            <FindingsPanel />
          </div>

          {/* Row 3 — Fix plan */}
          <FixPlan />

          {/* Row 4 — Senso intelligence panel */}
          <SensoIntelligencePanel />
        </div>
      )}

      {/* Finding detail slide-over — rendered outside the grid so it overlays */}
      {isCompleted && <FindingDetail />}

      {/* ── FAILED STATE ──────────────────────────────────── */}
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
        <p style={{ color: "var(--text-secondary)", margin: 0, maxWidth: 420, lineHeight: 1.6 }}>
          {errorMessage ?? "An unexpected error occurred. Please check the repository URL and try again."}
        </p>
      </div>
      <a
        href="/"
        style={{ background: "var(--color-accent)", color: "white", padding: "10px 24px", borderRadius: "var(--radius-md)", textDecoration: "none", fontWeight: 600, fontSize: "var(--text-small)" }}
      >
        ← Try Another Repo
      </a>
    </div>
  );
}
