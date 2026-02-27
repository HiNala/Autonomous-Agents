"use client";
import { useState } from "react";
import { useAnalysisStore } from "@/stores/analysisStore";
import { severityColor } from "@/lib/colors";

const TYPE_ICONS: Record<string, string> = {
  dependency_upgrade: "⬆️",
  code_patch:         "🔧",
  refactor:           "🏗️",
};

export function FixPlan() {
  const { fixes, fixSummary } = useAnalysisStore();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!fixes.length) return null;

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ padding: "var(--space-4)", borderBottom: "1px solid var(--border-default)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-small)", color: "var(--text-secondary)", margin: 0, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            FIX PLAN
          </h2>
          {fixSummary && (
            <p style={{ margin: "6px 0 0", fontSize: "var(--text-micro)", color: "var(--text-tertiary)", fontFamily: "var(--font-code)" }}>
              {fixSummary.totalFixes} fixes · {fixSummary.estimatedTotalEffort} total · {fixSummary.keystoneFixes} keystone{fixSummary.keystoneFixes !== 1 ? "s" : ""} eliminate {fixSummary.chainsEliminatedByKeystones} chains
            </p>
          )}
        </div>
      </div>

      {/* Fix list */}
      <div>
        {fixes.map((fix) => {
          const isKeystone = fix.chainsResolved >= 2;
          const isExpanded = expanded === fix.id;
          const color = severityColor(fix.severity);

          return (
            <div
              key={fix.id}
              style={{
                borderLeft: isKeystone ? "3px solid var(--color-accent)" : "3px solid transparent",
                borderBottom: "1px solid var(--border-default)",
              }}
            >
              <button
                onClick={() => setExpanded(isExpanded ? null : fix.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                  padding: "var(--space-4)",
                  cursor: "pointer",
                  display: "flex",
                  gap: "var(--space-4)",
                  alignItems: "flex-start",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-surface-raised)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                {/* Priority number */}
                <span style={{ fontFamily: "var(--font-code)", fontSize: "1.1rem", fontWeight: 700, color: "var(--text-tertiary)", minWidth: 24, lineHeight: 1.4 }}>
                  #{fix.priority}
                </span>

                {/* Main content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                    <span>{TYPE_ICONS[fix.type] ?? "🔧"}</span>
                    <span
                      style={{
                        fontSize: "var(--text-micro)",
                        color,
                        padding: "1px 6px",
                        borderRadius: "var(--radius-full)",
                        border: `1px solid ${color}44`,
                        background: "rgba(0,0,0,0.3)",
                        fontFamily: "var(--font-code)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {fix.severity}
                    </span>
                    {isKeystone && (
                      <span style={{ fontSize: "var(--text-micro)", color: "var(--color-accent)", fontFamily: "var(--font-code)" }}>
                        ⚡ Keystone · {fix.chainsResolved} chains
                      </span>
                    )}
                    <span style={{ fontSize: "var(--text-small)", fontWeight: 600, color: "var(--text-primary)" }}>
                      {fix.title}
                    </span>
                  </div>
                  <div style={{ marginTop: 6, display: "flex", gap: "var(--space-4)", fontSize: "var(--text-micro)", color: "var(--text-tertiary)", fontFamily: "var(--font-code)" }}>
                    <span>⏱ {fix.estimatedEffort}</span>
                    {fix.chainsResolved > 0 && <span>⛓ {fix.chainsResolved} chains</span>}
                    <span>📋 {fix.findingsResolved.length} findings</span>
                  </div>
                  {fix.sensoHistoricalContext && (
                    <div style={{ marginTop: 6, fontSize: "var(--text-micro)", color: "var(--color-accent)", fontStyle: "italic" }}>
                      🧠 {fix.sensoHistoricalContext}
                    </div>
                  )}
                </div>

                <span style={{ color: "var(--text-tertiary)", fontSize: 12, flexShrink: 0 }}>
                  {isExpanded ? "▾" : "▸"}
                </span>
              </button>

              {/* Expanded docs */}
              {isExpanded && (
                <div style={{ padding: "0 var(--space-4) var(--space-4) calc(var(--space-4) + 24px + var(--space-4))", borderTop: "1px solid var(--border-default)" }}>
                  <div style={{ paddingTop: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                    <div>
                      <h4 style={{ fontSize: "var(--text-small)", color: "var(--text-secondary)", margin: "0 0 var(--space-2)", fontFamily: "var(--font-code)", textTransform: "uppercase", letterSpacing: "0.05em" }}>What&apos;s Wrong</h4>
                      <p style={{ fontSize: "var(--text-small)", color: "var(--text-primary)", margin: 0, lineHeight: 1.6 }}>{fix.documentation.whatsWrong}</p>
                    </div>
                    {fix.documentation.steps.length > 0 && (
                      <div>
                        <h4 style={{ fontSize: "var(--text-small)", color: "var(--text-secondary)", margin: "0 0 var(--space-2)", fontFamily: "var(--font-code)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Steps</h4>
                        <ol style={{ margin: 0, paddingLeft: "var(--space-5)", display: "flex", flexDirection: "column", gap: 4 }}>
                          {fix.documentation.steps.map((step, i) => (
                            <li key={i} style={{ fontSize: "var(--text-small)", color: "var(--text-primary)", lineHeight: 1.6 }}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                    {(fix.documentation.beforeCode || fix.documentation.afterCode) && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                        {fix.documentation.beforeCode && (
                          <div>
                            <p style={{ fontSize: "var(--text-micro)", color: "var(--color-critical)", fontFamily: "var(--font-code)", margin: "0 0 6px" }}>Before</p>
                            <pre style={{ background: "var(--bg-input)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "var(--space-3)", fontSize: "var(--text-micro)", fontFamily: "var(--font-code)", color: "var(--text-primary)", overflow: "auto", margin: 0 }}>{fix.documentation.beforeCode}</pre>
                          </div>
                        )}
                        {fix.documentation.afterCode && (
                          <div>
                            <p style={{ fontSize: "var(--text-micro)", color: "var(--color-healthy)", fontFamily: "var(--font-code)", margin: "0 0 6px" }}>After</p>
                            <pre style={{ background: "var(--bg-input)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "var(--space-3)", fontSize: "var(--text-micro)", fontFamily: "var(--font-code)", color: "var(--text-primary)", overflow: "auto", margin: 0 }}>{fix.documentation.afterCode}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
