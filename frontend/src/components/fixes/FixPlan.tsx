"use client";
import { useState } from "react";
import { useAnalysisStore } from "@/stores/analysisStore";
import { severityColor } from "@/lib/colors";
import type { Fix } from "@/types/shared";

const TYPE_ICONS: Record<string, string> = {
  dependency_upgrade: "⬆",
  code_patch:         "✦",
  refactor:           "⟳",
};

function exportMarkdown(fixes: Fix[], repoName?: string) {
  const lines = [
    `# Fix Plan — ${repoName ?? "Repository"}`,
    `Generated: ${new Date().toLocaleString()}`,
    "",
    ...fixes.map((fix) => [
      `## ${fix.priority}. ${fix.title}`,
      `**Severity:** ${fix.severity}  **Effort:** ${fix.estimatedEffort}${fix.chainsResolved > 0 ? `  **Resolves:** ${fix.chainsResolved} chains` : ""}`,
      "",
      `### What's Wrong`,
      fix.documentation.whatsWrong,
      "",
      ...(fix.documentation.steps.length > 0 ? ["### Steps", ...fix.documentation.steps.map((s, i) => `${i + 1}. ${s}`), ""] : []),
      ...(fix.documentation.beforeCode ? ["### Before", "```", fix.documentation.beforeCode, "```", ""] : []),
      ...(fix.documentation.afterCode  ? ["### After",  "```", fix.documentation.afterCode,  "```", ""] : []),
    ].join("\n")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = "fix-plan.md";
  a.click();
  URL.revokeObjectURL(url);
}

export function FixPlan() {
  const { fixes, fixSummary, result } = useAnalysisStore();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  if (!fixes.length) return (
    <div
      style={{
        background: "rgba(17, 17, 22, 0.72)",
        backdropFilter: "blur(12px) saturate(1.4)",
        WebkitBackdropFilter: "blur(12px) saturate(1.4)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-5) var(--space-6)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-4)",
        boxShadow: "var(--shadow-panel)",
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "1rem", flexShrink: 0,
      }}>
        ✓
      </div>
      <div>
        <h2 style={{
          fontFamily: "var(--font-code)", fontSize: "var(--text-micro)",
          color: "var(--text-tertiary)", margin: 0, letterSpacing: "0.12em",
          textTransform: "uppercase", fontWeight: 600,
        }}>
          FIX PLAN
        </h2>
        <p style={{
          margin: "4px 0 0", fontSize: "var(--text-small)",
          color: "var(--color-healthy-text)",
        }}>
          No fixes needed — looking good!
        </p>
      </div>
    </div>
  );

  return (
    <div
      style={{
        background: "rgba(17, 17, 22, 0.72)",
        backdropFilter: "blur(12px) saturate(1.4)",
        WebkitBackdropFilter: "blur(12px) saturate(1.4)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        boxShadow: "var(--shadow-panel)",
      }}
    >
      {/* Sticky header */}
      <div
        style={{
          padding: "14px var(--space-4)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          position: "sticky",
          top: 56,
          zIndex: 10,
          background: "rgba(9, 9, 11, 0.92)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: "var(--font-code)",
              fontSize: "var(--text-micro)",
              color: "var(--text-tertiary)",
              margin: 0,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            FIX PLAN
          </h2>
          {fixSummary && (
            <p style={{ margin: "5px 0 0", fontSize: "var(--text-micro)", color: "var(--text-tertiary)", fontFamily: "var(--font-code)" }}>
              <span style={{ color: "var(--text-secondary)" }}>{fixSummary.totalFixes}</span> fixes ·{" "}
              <span style={{ color: "var(--text-secondary)" }}>{fixSummary.estimatedTotalEffort}</span> total ·{" "}
              <span style={{ color: "var(--color-accent-text)" }}>{fixSummary.keystoneFixes} keystone{fixSummary.keystoneFixes !== 1 ? "s" : ""}</span> eliminate{" "}
              <span style={{ color: "var(--text-secondary)" }}>{fixSummary.chainsEliminatedByKeystones}</span> chains
            </p>
          )}
        </div>

        {/* Export dropdown */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setExportOpen((o) => !o)}
            style={{
              background: "transparent",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-sm)",
              padding: "5px 10px",
              fontSize: "var(--text-micro)",
              color: "var(--text-tertiary)",
              fontFamily: "var(--font-code)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border-hover)";
              (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)";
              (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)";
            }}
          >
            Export ▾
          </button>
          {exportOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                background: "rgba(24, 24, 28, 0.98)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                padding: 4,
                backdropFilter: "blur(16px)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                zIndex: 600,
                minWidth: 140,
                animation: "slide-up 0.12s ease-out",
              }}
            >
              {[
                { label: "Markdown (.md)", action: () => { exportMarkdown(fixes, result?.repoName); setExportOpen(false); } },
                { label: "JSON", action: () => {
                    const blob = new Blob([JSON.stringify({ fixes, summary: fixSummary }, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a"); a.href = url; a.download = "fix-plan.json"; a.click(); URL.revokeObjectURL(url);
                    setExportOpen(false);
                  }
                },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: "transparent",
                    border: "none",
                    padding: "8px 10px",
                    fontSize: "var(--text-micro)",
                    color: "var(--text-secondary)",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    fontFamily: "var(--font-code)",
                    transition: "all 0.1s ease",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
                >
                  {item.label}
                </button>
              ))}
            </div>
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
                borderBottom: "1px solid var(--border-subtle)",
                background: isKeystone ? "rgba(59, 130, 246, 0.03)" : "transparent",
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
                  gap: "var(--space-3)",
                  alignItems: "flex-start",
                  transition: "background 0.12s ease",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                {/* Priority number */}
                <span
                  style={{
                    fontFamily: "var(--font-code)",
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    color: "var(--text-quaternary)",
                    minWidth: 28,
                    lineHeight: 1.4,
                    fontVariantNumeric: "tabular-nums",
                    transition: "color 0.15s ease",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-quaternary)"; }}
                >
                  {fix.priority}
                </span>

                {/* Main content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: 4 }}>
                    <span style={{ fontSize: "var(--text-micro)" }}>{TYPE_ICONS[fix.type] ?? "✦"}</span>

                    <span
                      style={{
                        fontSize: "var(--text-micro)",
                        color,
                        padding: "1px 7px",
                        borderRadius: "var(--radius-full)",
                        border: `1px solid ${color}44`,
                        background: `${color}11`,
                        fontFamily: "var(--font-code)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        fontWeight: 600,
                      }}
                    >
                      {fix.severity}
                    </span>

                    {isKeystone && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: "var(--text-micro)",
                          color: "var(--color-accent-text)",
                          background: "var(--color-accent-dim)",
                          border: "1px solid var(--color-accent-border)",
                          borderRadius: "var(--radius-sm)",
                          padding: "1px 7px",
                          fontFamily: "var(--font-code)",
                          fontWeight: 600,
                        }}
                      >
                        ⚡ Keystone · {fix.chainsResolved} chains
                      </span>
                    )}

                    <span style={{ fontSize: "var(--text-small)", fontWeight: 600, color: "var(--text-primary)" }}>
                      {fix.title}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "var(--space-4)",
                      fontSize: "var(--text-micro)",
                      color: "var(--text-tertiary)",
                      fontFamily: "var(--font-code)",
                    }}
                  >
                    <span>⏱ {fix.estimatedEffort}</span>
                    {fix.chainsResolved > 0 && <span>⛓ {fix.chainsResolved} chains</span>}
                    <span>{fix.findingsResolved.length} findings</span>
                  </div>
                </div>

                {/* Expand arrow */}
                <span
                  style={{
                    color: "var(--text-tertiary)",
                    fontSize: 11,
                    flexShrink: 0,
                    transition: "transform 0.2s ease",
                    transform: isExpanded ? "rotate(90deg)" : "rotate(0)",
                    display: "inline-block",
                  }}
                >
                  ▸
                </span>
              </button>

              {/* Expanded documentation */}
              {isExpanded && (
                <div
                  style={{
                    padding: "0 var(--space-4) var(--space-4)",
                    paddingLeft: "calc(var(--space-4) + 28px + var(--space-3))",
                    borderTop: "1px solid var(--border-subtle)",
                    animation: "slide-up 0.2s ease-out",
                  }}
                >
                  <div style={{ paddingTop: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                    <div>
                      <h4 style={subHeading}>What&apos;s Wrong</h4>
                      <p style={{ fontSize: "var(--text-small)", color: "var(--text-primary)", margin: 0, lineHeight: 1.65 }}>
                        {fix.documentation.whatsWrong}
                      </p>
                    </div>
                    {fix.documentation.steps.length > 0 && (
                      <div>
                        <h4 style={subHeading}>Steps</h4>
                        <ol style={{ margin: 0, paddingLeft: "var(--space-5)", display: "flex", flexDirection: "column", gap: 4 }}>
                          {fix.documentation.steps.map((step, i) => (
                            <li key={i} style={{ fontSize: "var(--text-small)", color: "var(--text-primary)", lineHeight: 1.6 }}>
                              {step}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                    {(fix.documentation.beforeCode || fix.documentation.afterCode) && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                        {fix.documentation.beforeCode && (
                          <div>
                            <p style={{ fontSize: "var(--text-micro)", color: "var(--color-critical-text)", fontFamily: "var(--font-code)", margin: "0 0 5px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Before</p>
                            <pre style={{ ...codeStyle, borderLeft: "3px solid var(--color-critical)" }}>{fix.documentation.beforeCode}</pre>
                          </div>
                        )}
                        {fix.documentation.afterCode && (
                          <div>
                            <p style={{ fontSize: "var(--text-micro)", color: "var(--color-healthy-text)", fontFamily: "var(--font-code)", margin: "0 0 5px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>After</p>
                            <pre style={{ ...codeStyle, borderLeft: "3px solid var(--color-healthy)" }}>{fix.documentation.afterCode}</pre>
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

const subHeading: React.CSSProperties = {
  fontSize: "var(--text-micro)",
  color: "var(--text-tertiary)",
  margin: "0 0 var(--space-2)",
  fontFamily: "var(--font-code)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontWeight: 600,
};

const codeStyle: React.CSSProperties = {
  background: "rgba(9, 9, 11, 0.8)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-md)",
  padding: "var(--space-3)",
  fontSize: "var(--text-micro)",
  fontFamily: "var(--font-code)",
  color: "var(--text-secondary)",
  overflow: "auto",
  margin: 0,
  lineHeight: 1.65,
  whiteSpace: "pre-wrap",
};
