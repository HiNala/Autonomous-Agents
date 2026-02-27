"use client";
import Link from "next/link";
import { useAnalysisStore } from "@/stores/analysisStore";

const STATUS_LABELS: Record<string, string> = {
  queued:     "Queued",
  cloning:    "Cloning",
  mapping:    "Mapping",
  analyzing:  "Analyzing",
  completing: "Completing",
  completed:  "Completed",
  failed:     "Failed",
};

const STATUS_COLORS: Record<string, string> = {
  queued:     "var(--text-tertiary)",
  cloning:    "var(--color-warning-text)",
  mapping:    "var(--agent-mapper)",
  analyzing:  "var(--color-accent-text)",
  completing: "var(--agent-doctor)",
  completed:  "var(--color-healthy-text)",
  failed:     "var(--color-critical-text)",
};

export function Header() {
  const { result, status, analysisId } = useAnalysisStore();
  const isActive = !!analysisId;
  const repoName = result?.repoName;
  const isRunning = ["queued", "cloning", "mapping", "analyzing", "completing"].includes(status);

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "56px",
        background: "rgba(9, 9, 11, 0.82)",
        backdropFilter: "blur(20px) saturate(1.4)",
        WebkitBackdropFilter: "blur(20px) saturate(1.4)",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 var(--space-6)",
        zIndex: "var(--z-header)",
      }}
    >
      {/* Wordmark */}
      <Link
        href="/"
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: "0.875rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          textDecoration: "none",
          background: "linear-gradient(135deg, #F4F4F5 0%, #A1A1AA 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        VIBE CHECK
      </Link>

      {/* Center — active analysis chip */}
      {isActive && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-code)",
              fontSize: "var(--text-small)",
              color: "var(--text-secondary)",
              maxWidth: 220,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {repoName ?? analysisId}
          </span>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: "var(--text-micro)",
              color: STATUS_COLORS[status] ?? "var(--text-secondary)",
              fontFamily: "var(--font-code)",
              padding: "3px 10px",
              borderRadius: "var(--radius-full)",
              border: `1px solid ${STATUS_COLORS[status] ?? "var(--border-default)"}`,
              background: `${STATUS_COLORS[status] ?? "transparent"}11`,
              letterSpacing: "0.04em",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: STATUS_COLORS[status] ?? "var(--text-tertiary)",
                flexShrink: 0,
                animation: isRunning ? "pulse-once 1.5s ease-in-out infinite" : undefined,
              }}
            />
            {STATUS_LABELS[status] ?? status}
          </div>
        </div>
      )}

      {/* Right — Senso indicator */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          fontSize: "var(--text-micro)",
          color: "var(--text-tertiary)",
          fontFamily: "var(--font-code)",
          letterSpacing: "0.06em",
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "var(--agent-senso)",
            boxShadow: "0 0 8px var(--agent-senso)",
            display: "block",
            animation: "pulse-once 2s ease-in-out infinite",
          }}
        />
        Senso
      </div>
    </header>
  );
}
