"use client";
import Link from "next/link";
import { useAnalysisStore } from "@/stores/analysisStore";

const STATUS_LABELS: Record<string, string> = {
  queued: "Queued",
  cloning: "Cloning",
  mapping: "Mapping",
  analyzing: "Analyzing",
  completing: "Completing",
  completed: "Completed",
  failed: "Failed",
};

const STATUS_COLORS: Record<string, string> = {
  queued: "var(--text-tertiary)",
  cloning: "var(--color-warning)",
  mapping: "var(--agent-mapper)",
  analyzing: "var(--color-accent)",
  completing: "var(--agent-doctor)",
  completed: "var(--color-healthy)",
  failed: "var(--color-critical)",
};

export function Header() {
  const { result, status, analysisId } = useAnalysisStore();
  const isActive = !!analysisId;
  const repoName = result?.repoName;

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "56px",
        background: "rgba(10,10,11,0.85)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border-default)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 var(--space-6)",
        zIndex: 50,
      }}
    >
      {/* Wordmark */}
      <Link
        href="/"
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: "0.9375rem",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "var(--text-primary)",
          textDecoration: "none",
        }}
      >
        VIBE CHECK
      </Link>

      {/* Center — repo info */}
      {isActive && (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-small)", color: "var(--text-secondary)" }}>
            {repoName ?? analysisId}
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "var(--text-micro)",
              color: STATUS_COLORS[status] ?? "var(--text-secondary)",
              fontFamily: "var(--font-code)",
              padding: "2px 8px",
              borderRadius: "var(--radius-full)",
              border: `1px solid ${STATUS_COLORS[status] ?? "var(--border-default)"}`,
              background: "rgba(0,0,0,0.3)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: STATUS_COLORS[status] ?? "var(--text-tertiary)",
                animation: ["analyzing", "mapping", "cloning", "completing"].includes(status) ? "pulse-once 1.5s ease-in-out infinite" : undefined,
              }}
            />
            {STATUS_LABELS[status] ?? status}
          </span>
        </div>
      )}

      {/* Right — Senso status */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "var(--text-micro)", color: "var(--text-tertiary)" }}>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "var(--agent-senso)",
            boxShadow: "0 0 6px var(--agent-senso)",
          }}
        />
        <span style={{ fontFamily: "var(--font-code)" }}>Senso</span>
      </div>
    </header>
  );
}
