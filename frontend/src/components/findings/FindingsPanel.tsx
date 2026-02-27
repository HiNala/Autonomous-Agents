"use client";
import { useState } from "react";
import { useAnalysisStore } from "@/stores/analysisStore";
import { severityColor } from "@/lib/colors";
import type { Finding, Severity } from "@/types/shared";

const SEVERITY_ORDER: Severity[] = ["critical", "warning", "info"];
const LABELS: Record<Severity, string> = { critical: "Critical", warning: "Warning", info: "Info" };
const ICONS:  Record<Severity, string> = { critical: "🔴", warning: "🟡", info: "ℹ️" };

function FindingRow({ finding }: { finding: Finding }) {
  const { selectFinding, selectedFindingId } = useAnalysisStore();
  const isSelected = selectedFindingId === finding.id;

  return (
    <button
      onClick={() => selectFinding(isSelected ? null : finding.id)}
      style={{
        width: "100%",
        textAlign: "left",
        background: isSelected ? "var(--bg-surface-hover)" : "transparent",
        border: "none",
        borderLeft: `3px solid ${isSelected ? severityColor(finding.severity) : "transparent"}`,
        padding: "10px var(--space-4)",
        cursor: "pointer",
        transition: "background 0.15s ease",
      }}
      onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "var(--bg-surface-raised)"; }}
      onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-3)" }}>
        <span style={{ fontSize: "var(--text-small)", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4 }}>
          {finding.title}
        </span>
        {finding.chainIds.length > 0 && (
          <span style={{ fontSize: "var(--text-micro)", color: "var(--color-accent)", flexShrink: 0 }}>
            ⛓ {finding.chainIds.length}
          </span>
        )}
      </div>
      <div style={{ marginTop: 4, display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
        <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-micro)", color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {finding.location.primaryFile}
        </span>
        <span style={{ fontSize: "var(--text-micro)", color: "var(--text-tertiary)", flexShrink: 0 }}>
          {finding.blastRadius.filesAffected} files
        </span>
      </div>
    </button>
  );
}

export function FindingsPanel() {
  const { findings, result } = useAnalysisStore();
  const [open, setOpen] = useState<Record<Severity, boolean>>({ critical: true, warning: false, info: false });

  const summary = result?.findings;

  const grouped = SEVERITY_ORDER.reduce<Record<Severity, Finding[]>>(
    (acc, sev) => { acc[sev] = findings.filter((f) => f.severity === sev); return acc; },
    { critical: [], warning: [], info: [] }
  );

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{ padding: "var(--space-4)", borderBottom: "1px solid var(--border-default)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-small)", color: "var(--text-secondary)", margin: 0, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          FINDINGS {summary ? `(${summary.total})` : ""}
        </h2>
      </div>

      {/* Severity groups */}
      {SEVERITY_ORDER.map((sev) => {
        const list = grouped[sev];
        const count = summary ? summary[sev] : list.length;
        const isOpen = open[sev];

        return (
          <div key={sev} style={{ borderBottom: "1px solid var(--border-default)" }}>
            <button
              onClick={() => setOpen((o) => ({ ...o, [sev]: !o[sev] }))}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "var(--space-3) var(--space-4)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-primary)",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-small)", fontWeight: 600 }}>
                <span>{ICONS[sev]}</span>
                <span>{LABELS[sev]}</span>
                <span
                  style={{
                    fontFamily: "var(--font-code)",
                    fontSize: "var(--text-micro)",
                    color: severityColor(sev),
                    background: "rgba(0,0,0,0.3)",
                    padding: "1px 6px",
                    borderRadius: "var(--radius-full)",
                    border: `1px solid ${severityColor(sev)}44`,
                  }}
                >
                  {count}
                </span>
              </span>
              <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>{isOpen ? "▾" : "▸"}</span>
            </button>

            {isOpen && (
              <div style={{ paddingBottom: "var(--space-2)" }}>
                {list.length === 0 ? (
                  <div style={{ padding: "var(--space-3) var(--space-4)", fontSize: "var(--text-small)", color: "var(--text-tertiary)" }}>
                    {count > 0 ? `${count} findings — load full results` : "No findings · Nice work! ✓"}
                  </div>
                ) : (
                  list.map((f) => <FindingRow key={f.id} finding={f} />)
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
