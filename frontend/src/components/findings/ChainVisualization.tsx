"use client";
import type { VulnerabilityChain } from "@/types/shared";
import { useAnalysisStore } from "@/stores/analysisStore";

const STEP_COLORS: Record<string, string> = {
  entry:          "var(--color-accent)",
  flow:           "var(--text-tertiary)",
  vulnerability:  "var(--color-critical)",
  impact:         "var(--color-warning)",
};

const STEP_LABELS: Record<string, string> = {
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
        background: "var(--bg-input)",
        border: `1px solid ${isHighlighted ? "var(--color-critical)" : "var(--border-default)"}`,
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
        transition: "border-color 0.2s ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span style={{ fontSize: "var(--text-micro)", color: "var(--color-critical)", fontFamily: "var(--font-code)", padding: "1px 6px", border: "1px solid var(--color-critical)", borderRadius: "var(--radius-full)", textTransform: "uppercase" }}>
            {chain.severity}
          </span>
          <span style={{ fontSize: "var(--text-small)", color: "var(--text-secondary)" }}>
            {chain.description}
          </span>
        </div>
        <button
          onClick={() => highlightChain(isHighlighted ? null : chain.id)}
          style={{
            background: isHighlighted ? "rgba(239,68,68,0.15)" : "transparent",
            border: `1px solid ${isHighlighted ? "var(--color-critical)" : "var(--border-default)"}`,
            borderRadius: "var(--radius-sm)",
            padding: "3px 8px",
            fontSize: "var(--text-micro)",
            color: isHighlighted ? "var(--color-critical)" : "var(--text-tertiary)",
            cursor: "pointer",
            fontFamily: "var(--font-code)",
          }}
        >
          {isHighlighted ? "★ In graph" : "☆ Show in graph"}
        </button>
      </div>

      {/* Step flow */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto", paddingBottom: 4 }}>
        {chain.steps.map((step, i) => {
          const color = STEP_COLORS[step.type] ?? "var(--text-tertiary)";
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  maxWidth: 120,
                }}
              >
                <span
                  style={{
                    fontSize: "var(--text-micro)",
                    fontFamily: "var(--font-code)",
                    color: "var(--text-micro)",
                    background: "rgba(0,0,0,0.4)",
                    border: `1px solid ${color}`,
                    borderRadius: "var(--radius-sm)",
                    padding: "1px 5px",
                    letterSpacing: "0.05em",
                    color,
                  }}
                >
                  {STEP_LABELS[step.type]}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-code)",
                    fontSize: "var(--text-micro)",
                    color: "var(--text-primary)",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: 110,
                  }}
                  title={step.node}
                >
                  {step.node}
                </span>
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
                {step.cve && (
                  <span style={{ fontSize: 9, color: "var(--color-critical)", fontFamily: "var(--font-code)" }}>
                    {step.cve}
                  </span>
                )}
              </div>
              {i < chain.steps.length - 1 && (
                <div style={{ display: "flex", alignItems: "center", padding: "0 6px", color: "var(--text-tertiary)", fontSize: "var(--text-small)", flexShrink: 0 }}>
                  →
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Blast radius */}
      <div style={{ marginTop: "var(--space-3)", display: "flex", gap: "var(--space-4)", fontSize: "var(--text-micro)", color: "var(--text-tertiary)", fontFamily: "var(--font-code)" }}>
        <span>💥 {chain.blastRadius.files} files</span>
        <span>⚙ {chain.blastRadius.functions} functions</span>
        <span>🔌 {chain.blastRadius.endpoints} endpoints</span>
      </div>
    </div>
  );
}
