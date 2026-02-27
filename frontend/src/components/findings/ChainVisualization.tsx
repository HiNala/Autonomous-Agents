"use client";
import type { VulnerabilityChain } from "@/types/shared";
import { useAnalysisStore } from "@/stores/analysisStore";

const STEP_COLORS: Record<string, string> = {
  entry:         "var(--color-accent)",
  flow:          "var(--text-tertiary)",
  vulnerability: "var(--color-critical)",
  impact:        "var(--color-warning)",
};

const STEP_BG: Record<string, string> = {
  entry:         "var(--color-accent-dim)",
  flow:          "rgba(255,255,255,0.04)",
  vulnerability: "var(--color-critical-dim)",
  impact:        "var(--color-warning-dim)",
};

const STEP_BORDER: Record<string, string> = {
  entry:         "var(--color-accent-border)",
  flow:          "var(--border-default)",
  vulnerability: "var(--color-critical-border)",
  impact:        "var(--color-warning-border)",
};

const STEP_TYPE_LABELS: Record<string, string> = {
  entry:         "Entry",
  flow:          "Flow",
  vulnerability: "CVE",
  impact:        "Impact",
};

export function ChainVisualization({ chain }: { chain: VulnerabilityChain }) {
  const { highlightChain, highlightedChainId } = useAnalysisStore();
  const isHighlighted = highlightedChainId === chain.id;

  return (
    <div
      style={{
        background: isHighlighted
          ? "rgba(239, 68, 68, 0.06)"
          : "rgba(9, 9, 11, 0.6)",
        border: `1px solid ${isHighlighted ? "var(--color-critical-border)" : "var(--border-default)"}`,
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
        transition: "border-color 0.2s ease, background 0.2s ease",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--space-4)",
          gap: "var(--space-3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", minWidth: 0 }}>
          <span
            style={{
              fontSize: "var(--text-micro)",
              color: "var(--color-critical-text)",
              fontFamily: "var(--font-code)",
              fontWeight: 700,
              padding: "2px 7px",
              border: "1px solid var(--color-critical-border)",
              borderRadius: "var(--radius-full)",
              background: "var(--color-critical-dim)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              flexShrink: 0,
            }}
          >
            {chain.severity}
          </span>
          <span
            style={{
              fontSize: "var(--text-small)",
              color: "var(--text-secondary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {chain.description}
          </span>
        </div>
        <button
          onClick={() => highlightChain(isHighlighted ? null : chain.id)}
          style={{
            background: isHighlighted ? "rgba(239,68,68,0.15)" : "transparent",
            border: `1px solid ${isHighlighted ? "var(--color-critical-border)" : "var(--border-default)"}`,
            borderRadius: "var(--radius-sm)",
            padding: "4px 9px",
            fontSize: "var(--text-micro)",
            color: isHighlighted ? "var(--color-critical-text)" : "var(--text-tertiary)",
            cursor: "pointer",
            fontFamily: "var(--font-code)",
            flexShrink: 0,
            transition: "all 0.15s ease",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
          onMouseEnter={(e) => {
            if (!isHighlighted) {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--color-critical-border)";
              (e.currentTarget as HTMLElement).style.color = "var(--color-critical-text)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isHighlighted) {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)";
              (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)";
            }
          }}
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="3" cy="3" r="2"/><circle cx="9" cy="3" r="2"/><circle cx="6" cy="9" r="2"/>
            <line x1="3" y1="5" x2="6" y2="7"/><line x1="9" y1="5" x2="6" y2="7"/>
          </svg>
          {isHighlighted ? "In graph" : "Show"}
        </button>
      </div>

      {/* Step flow */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          overflowX: "auto",
          paddingBottom: 4,
        }}
      >
        {chain.steps.map((step, i) => {
          const color  = STEP_COLORS[step.type] ?? "var(--text-tertiary)";
          const bg     = STEP_BG[step.type] ?? "rgba(255,255,255,0.04)";
          const border = STEP_BORDER[step.type] ?? "var(--border-default)";
          const isVuln = step.type === "vulnerability";

          return (
            <div key={i} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
              {/* Step node */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  maxWidth: 120,
                  minWidth: 80,
                }}
              >
                {/* Type label */}
                <span
                  style={{
                    fontSize: "var(--text-micro)",
                    fontFamily: "var(--font-code)",
                    color,
                    background: bg,
                    border: `1px solid ${border}`,
                    borderRadius: "var(--radius-sm)",
                    padding: "1px 6px",
                    letterSpacing: "0.06em",
                    fontWeight: 600,
                    textTransform: "uppercase",
                  }}
                >
                  {STEP_TYPE_LABELS[step.type] ?? step.type}
                </span>

                {/* Node name */}
                <div
                  style={{
                    background: isVuln ? "rgba(239,68,68,0.08)" : "rgba(17,17,22,0.6)",
                    border: `1px solid ${isVuln ? "var(--color-critical-border)" : "var(--border-subtle)"}`,
                    borderRadius: "var(--radius-sm)",
                    padding: "4px 8px",
                    fontFamily: "var(--font-code)",
                    fontSize: "var(--text-micro)",
                    color: isVuln ? "var(--color-critical-text)" : "var(--text-primary)",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: 110,
                  }}
                  title={step.node}
                >
                  {step.node}
                </div>

                {/* Description */}
                {step.description && (
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--text-tertiary)",
                      textAlign: "center",
                      maxWidth: 110,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={step.description}
                  >
                    {step.description}
                  </span>
                )}

                {/* CVE tag */}
                {step.cve && (
                  <span
                    style={{
                      fontSize: 9,
                      color: "var(--color-critical-text)",
                      fontFamily: "var(--font-code)",
                      background: "var(--color-critical-dim)",
                      padding: "1px 5px",
                      borderRadius: 3,
                    }}
                  >
                    {step.cve}
                  </span>
                )}
              </div>

              {/* Arrow connector */}
              {i < chain.steps.length - 1 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "0 4px",
                    flexShrink: 0,
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 1,
                      background: `linear-gradient(90deg, var(--border-default), ${STEP_COLORS[chain.steps[i + 1]?.type] ?? "var(--text-tertiary)"}55)`,
                    }}
                  />
                  <span
                    style={{
                      color: STEP_COLORS[chain.steps[i + 1]?.type] ?? "var(--text-tertiary)",
                      fontSize: 9,
                      lineHeight: 1,
                    }}
                  >
                    ▶
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Blast stats */}
      <div
        style={{
          marginTop: "var(--space-3)",
          display: "flex",
          gap: "var(--space-4)",
          fontSize: "var(--text-micro)",
          color: "var(--text-quaternary)",
          fontFamily: "var(--font-code)",
        }}
      >
        <span>
          <span style={{ color: "var(--text-tertiary)" }}>{chain.blastRadius.files}</span> files
        </span>
        <span>·
          <span style={{ color: "var(--text-tertiary)" }}> {chain.blastRadius.functions}</span> functions
        </span>
        <span>·
          <span style={{ color: "var(--text-tertiary)" }}> {chain.blastRadius.endpoints}</span> endpoints
        </span>
      </div>
    </div>
  );
}
