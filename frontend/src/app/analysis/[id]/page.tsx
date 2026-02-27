"use client";
import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { AnalysisProgress } from "@/components/progress/AnalysisProgress";
import { HealthScoreHero } from "@/components/score/HealthScoreHero";
import { ScoreBreakdown } from "@/components/score/ScoreBreakdown";
import { GraphPanel } from "@/components/graph/GraphPanel";
import { FindingsPanel } from "@/components/findings/FindingsPanel";
import { FindingDetail } from "@/components/findings/FindingDetail";
import { FixPlan } from "@/components/fixes/FixPlan";
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

  // ── Choreographed reveal sequence ──────────────────────────
  // T+0.0s: score row appears
  // T+0.5s: graph + findings row appears
  // T+1.5s: fix plan appears
  const [revealPhase, setRevealPhase] = useState(0);

  useEffect(() => {
    if (!isCompleted) { setRevealPhase(0); return; }
    const t1 = setTimeout(() => setRevealPhase(1), 50);
    const t2 = setTimeout(() => setRevealPhase(2), 500);
    const t3 = setTimeout(() => setRevealPhase(3), 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [isCompleted]);

  return (
    <AppShell>
      {/* ── SCANNING VIEW ─────────────────────────────────── */}
      {isScanning && <AnalysisProgress />}

      {/* ── COMPLETED DASHBOARD ───────────────────────────── */}
      {isCompleted && (
        <div
          style={{
            maxWidth: 1400,
            margin: "0 auto",
            padding: "var(--space-5) var(--space-6)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-5)",
          }}
        >
          {/* Row 1 — Score hero + breakdown */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "260px 1fr",
              gap: "var(--space-5)",
              alignItems: "start",
              opacity: revealPhase >= 1 ? 1 : 0,
              transform: revealPhase >= 1 ? "translateY(0)" : "translateY(12px)",
              transition: "opacity 0.5s ease, transform 0.5s ease",
            }}
          >
            <HealthScoreHero />
            <ScoreBreakdown />
          </div>

          {/* Row 2 — Graph + Findings */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "60% 1fr",
              gap: "var(--space-5)",
              alignItems: "start",
              opacity: revealPhase >= 2 ? 1 : 0,
              transform: revealPhase >= 2 ? "translateY(0)" : "translateY(16px)",
              transition: "opacity 0.5s ease, transform 0.5s ease",
            }}
          >
            <GraphPanel />
            <FindingsPanel />
          </div>

          {/* Row 3 — Fix plan */}
          <div
            style={{
              opacity: revealPhase >= 3 ? 1 : 0,
              transform: revealPhase >= 3 ? "translateY(0)" : "translateY(16px)",
              transition: "opacity 0.5s ease, transform 0.5s ease",
            }}
          >
            <FixPlan />
          </div>
        </div>
      )}

      {/* Finding detail slide-over — outside grid, overlays everything */}
      {isCompleted && <FindingDetail />}

      {/* ── FAILED STATE ──────────────────────────────────── */}
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
        padding: "var(--space-6)",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          background: "rgba(17, 17, 22, 0.72)",
          backdropFilter: "blur(12px) saturate(1.4)",
          WebkitBackdropFilter: "blur(12px) saturate(1.4)",
          border: "1px solid rgba(245, 158, 11, 0.25)",
          borderLeft: "4px solid var(--color-warning)",
          borderRadius: "var(--radius-xl)",
          padding: "var(--space-8) var(--space-6)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-4)",
          textAlign: "center",
          boxShadow: "var(--shadow-modal), 0 0 40px rgba(245,158,11,0.08)",
          animation: "slide-up 0.3s ease-out",
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "rgba(245, 158, 11, 0.12)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.5rem",
          }}
        >
          ⚠
        </div>

        <div>
          <h2
            style={{
              fontSize: "var(--text-h2)",
              fontWeight: 600,
              color: "var(--text-primary)",
              margin: "0 0 var(--space-2)",
              fontFamily: "var(--font-heading)",
            }}
          >
            Something went wrong
          </h2>
          <p
            style={{
              color: "var(--text-secondary)",
              margin: 0,
              maxWidth: 380,
              lineHeight: 1.65,
              fontSize: "var(--text-body)",
            }}
          >
            {errorMessage ?? "An unexpected error occurred. Please check the repository URL and try again."}
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-2)" }}>
          <Link
            href="/"
            style={{
              background: "rgba(17, 17, 22, 0.8)",
              color: "var(--text-secondary)",
              padding: "10px 20px",
              borderRadius: "var(--radius-md)",
              textDecoration: "none",
              fontWeight: 500,
              fontSize: "var(--text-small)",
              border: "1px solid var(--border-default)",
              transition: "all 0.15s ease",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            ← Try Another Repo
          </Link>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "rgba(59, 130, 246, 0.15)",
              color: "var(--color-accent-text)",
              padding: "10px 20px",
              borderRadius: "var(--radius-md)",
              fontWeight: 500,
              fontSize: "var(--text-small)",
              border: "1px solid var(--color-accent-border)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            ↺ Retry
          </button>
        </div>
      </div>
    </div>
  );
}
