"use client";
import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { HealthScoreHero } from "@/components/score/HealthScoreHero";
import { ScoreBreakdown } from "@/components/score/ScoreBreakdown";
import { GraphPanel } from "@/components/graph/GraphPanel";
import { FindingsPanel } from "@/components/findings/FindingsPanel";
import { FindingDetail } from "@/components/findings/FindingDetail";
import { FixPlan } from "@/components/fixes/FixPlan";
import { useAnalysisStore } from "@/stores/analysisStore";
import { useAnalysisWebSocket } from "@/hooks/useAnalysisWebSocket";
import { api } from "@/lib/api";
import type { AgentName } from "@/types/shared";
import { agentColor } from "@/lib/colors";

const AGENT_ORDER: AgentName[] = ["orchestrator", "mapper", "quality", "pattern", "security", "doctor"];

export default function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { analysisId, status, startAnalysis, setResult, setFindings, setFixes, setChains, setGraphData } = useAnalysisStore();

  useEffect(() => {
    if (analysisId !== id) {
      startAnalysis(id);
      api.getAnalysis(id).then((r) => {
        setResult(r);
        if (r.status === "completed") {
          api.getFindings(id, { limit: 100 }).then((f) => setFindings(f.items)).catch(() => null);
          api.getFixes(id).then((f) => setFixes(f.fixes, f.summary)).catch(() => null);
          api.getChains(id).then((c) => setChains(c.chains)).catch(() => null);
          api.getGraph(id, "structure").then((g) => setGraphData(g.nodes, g.edges)).catch(() => null);
        }
      }).catch(() => null);
    }
  }, [id, analysisId, startAnalysis, setResult, setFindings, setFixes, setChains, setGraphData]);

  useAnalysisWebSocket(id);

  const isIdle      = status === "idle";
  const isScanning  = ["queued", "cloning", "mapping", "analyzing", "completing"].includes(status);
  const isCompleted = status === "completed";
  const isFailed    = status === "failed";

  // Reveal score + breakdown only once we have a health score
  const { result } = useAnalysisStore();
  const hasScore = !!result?.healthScore;

  if (isIdle) {
    return (
      <AppShell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={{ width: 40, height: 40, border: "2px solid var(--border-default)", borderTopColor: "var(--color-accent)", borderRadius: "50%" }} className="animate-spin" />
          <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-small)", color: "var(--text-tertiary)" }}>Loading analysis...</span>
        </div>
      </AppShell>
    );
  }

  if (isFailed) {
    return (
      <AppShell>
        <FailedState />
      </AppShell>
    );
  }

  return (
    <AppShell>
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
        {/* ── Scanning status bar (visible while running) ─────────── */}
        {isScanning && <ScanningStatusBar />}

        {/* ── Summary banner (visible once completed) ─────────────── */}
        {isCompleted && <AnalysisSummaryBanner />}

        {/* ── Score row ─────────────────────────────────────────────
            Show placeholder cards while scanning, real data when complete */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "240px 1fr",
            gap: "var(--space-5)",
            alignItems: "start",
          }}
        >
          {hasScore ? (
            <>
              <HealthScoreHero />
              <ScoreBreakdown />
            </>
          ) : (
            <>
              <ScorePlaceholder />
              <BreakdownPlaceholder />
            </>
          )}
        </div>

        {/* ── Knowledge graph (builds live) ───────────────────────── */}
        <GraphPanel />

        {/* ── Findings (stream in live) ────────────────────────────── */}
        <FindingsPanel />

        {/* ── Fix plan (appears once doctor agent is done) ─────────── */}
        {isCompleted && <FixPlan />}
      </div>

      {/* Finding detail slide-over */}
      <FindingDetail />
    </AppShell>
  );
}

// ── Scanning status bar ──────────────────────────────────────────
function ScanningStatusBar() {
  const { agentStatuses, graphNodes, liveFindings } = useAnalysisStore();

  const activeAgent = AGENT_ORDER.find(
    (a) => agentStatuses[a]?.status === "running"
  );
  const doneCount = AGENT_ORDER.filter((a) => agentStatuses[a]?.status === "complete").length;
  const activeMsg = activeAgent ? agentStatuses[activeAgent]?.message : null;

  return (
    <div
      style={{
        background: "rgba(17, 17, 22, 0.72)",
        backdropFilter: "blur(12px) saturate(1.4)",
        WebkitBackdropFilter: "blur(12px) saturate(1.4)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: "12px var(--space-5)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-5)",
        boxShadow: "var(--shadow-panel)",
        animation: "slide-up 0.3s ease-out",
      }}
    >
      {/* Pulsing dot */}
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "var(--color-accent)",
          flexShrink: 0,
          animation: "pulse-once 1s ease-in-out infinite",
          boxShadow: "0 0 8px var(--color-accent)",
        }}
      />

      {/* Agent dots */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {AGENT_ORDER.map((agent) => {
          const s = agentStatuses[agent];
          const isDone    = s?.status === "complete";
          const isRunning = s?.status === "running";
          const color = agentColor(agent);
          return (
            <div key={agent} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: isDone ? color : isRunning ? color : "var(--border-default)",
                  opacity: isDone ? 1 : isRunning ? 1 : 0.3,
                  boxShadow: isRunning ? `0 0 6px ${color}` : undefined,
                  transition: "all 0.3s ease",
                }}
              />
              <span
                style={{
                  fontSize: 8,
                  fontFamily: "var(--font-code)",
                  color: isDone || isRunning ? "var(--text-tertiary)" : "var(--border-default)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  opacity: isDone || isRunning ? 1 : 0.3,
                }}
              >
                {agent.slice(0, 3)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <span style={{ width: 1, height: 28, background: "var(--border-subtle)" }} />

      {/* Current message */}
      <span
        style={{
          fontSize: "var(--text-small)",
          color: "var(--text-secondary)",
          fontFamily: "var(--font-code)",
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {activeMsg ?? "Analyzing..."}
      </span>

      {/* Live stats */}
      <div style={{ display: "flex", gap: "var(--space-4)", flexShrink: 0 }}>
        <Stat label="agents" value={`${doneCount}/${AGENT_ORDER.length}`} />
        {graphNodes.length > 0 && <Stat label="nodes" value={String(graphNodes.length)} />}
        {liveFindings.length > 0 && (
          <Stat
            label="findings"
            value={String(liveFindings.length)}
            color={liveFindings.some((f) => f.severity === "critical") ? "var(--color-critical-text)" : undefined}
          />
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
      <span style={{ fontSize: "var(--text-micro)", fontFamily: "var(--font-code)", color: color ?? "var(--text-primary)", fontWeight: 600 }}>{value}</span>
      <span style={{ fontSize: 9, fontFamily: "var(--font-code)", color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
    </span>
  );
}

// ── Score placeholders ───────────────────────────────────────────
function ScorePlaceholder() {
  return (
    <div
      style={{
        background: "rgba(17,17,22,0.72)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        height: 180,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "pulse-placeholder 1.8s ease-in-out infinite",
      }}
    >
      <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-micro)", color: "var(--text-quaternary)" }}>Calculating score...</span>
    </div>
  );
}

function BreakdownPlaceholder() {
  return (
    <div
      style={{
        background: "rgba(17,17,22,0.72)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        height: 180,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "pulse-placeholder 1.8s ease-in-out infinite",
      }}
    >
      <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-micro)", color: "var(--text-quaternary)" }}>Running analysis...</span>
    </div>
  );
}

// ── Summary banner ───────────────────────────────────────────────
function AnalysisSummaryBanner() {
  const { result, findings } = useAnalysisStore();
  if (!result) return null;

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const s = result.stats as any;
  const totalFiles    = s?.totalFiles ?? s?.total_files ?? 0;
  const duration      = result.timestamps?.duration ?? 0;
  const findingCount  = findings.length || (result.findings as any)?.total || 0;
  const criticalCount = findings.filter((f) => f.severity === "critical").length || (result.findings as any)?.critical || 0;
  const repoName      = result.repoName || "repository";
  /* eslint-enable @typescript-eslint/no-explicit-any */

  let summaryText: string;
  if (findingCount === 0) {
    summaryText = `Scanned ${totalFiles} files in ${repoName} — clean bill of health!`;
  } else if (criticalCount > 0) {
    summaryText = `Found ${findingCount} issues (${criticalCount} critical) across ${totalFiles} files in ${repoName}`;
  } else {
    summaryText = `Found ${findingCount} issues across ${totalFiles} files in ${repoName}`;
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px var(--space-5)",
        background: findingCount === 0
          ? "rgba(34, 197, 94, 0.06)"
          : criticalCount > 0
            ? "rgba(239, 68, 68, 0.06)"
            : "rgba(59, 130, 246, 0.06)",
        border: `1px solid ${findingCount === 0 ? "rgba(34,197,94,0.18)" : criticalCount > 0 ? "rgba(239,68,68,0.18)" : "rgba(59,130,246,0.18)"}`,
        borderRadius: "var(--radius-lg)",
        animation: "slide-up 0.4s ease-out",
      }}
    >
      <span style={{ fontSize: "var(--text-body)", color: "var(--text-secondary)", fontWeight: 500 }}>
        {summaryText}
      </span>
      {duration > 0 && (
        <span
          style={{
            fontFamily: "var(--font-code)",
            fontSize: "var(--text-micro)",
            color: "var(--text-tertiary)",
            background: "rgba(255,255,255,0.04)",
            padding: "4px 10px",
            borderRadius: "var(--radius-full)",
            border: "1px solid var(--border-subtle)",
            flexShrink: 0,
          }}
        >
          {duration}s
        </span>
      )}
    </div>
  );
}

// ── Failed state ─────────────────────────────────────────────────
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
