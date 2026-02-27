"use client";
import { useState } from "react";
import { useAnalysisStore } from "@/stores/analysisStore";
import { severityColor } from "@/lib/colors";
import type { Finding, Severity } from "@/types/shared";

const CATEGORY_LABELS: Record<string, string> = {
  codeQuality:  "Code Quality",
  patterns:     "Patterns",
  security:     "Security",
  dependencies: "Dependencies",
  architecture: "Architecture",
};

const SEVERITY_ORDER: Severity[] = ["critical", "warning", "info"];

const LABELS: Record<Severity, string> = { critical: "Critical", warning: "Warning", info: "Info" };

function SeverityIcon({ severity }: { severity: Severity }) {
  if (severity === "critical") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <circle cx="6" cy="6" r="5.5" fill="rgba(239,68,68,0.2)" stroke="#EF4444" strokeWidth="1"/>
        <line x1="4" y1="4" x2="8" y2="8" stroke="#EF4444" strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="8" y1="4" x2="4" y2="8" stroke="#EF4444" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    );
  }
  if (severity === "warning") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M6 1.5L11 10.5H1L6 1.5Z" fill="rgba(245,158,11,0.2)" stroke="#F59E0B" strokeWidth="1"/>
        <line x1="6" y1="5" x2="6" y2="7.5" stroke="#F59E0B" strokeWidth="1.2" strokeLinecap="round"/>
        <circle cx="6" cy="9" r="0.55" fill="#F59E0B"/>
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="5.5" fill="rgba(113,113,122,0.15)" stroke="#52525B" strokeWidth="1"/>
      <line x1="6" y1="4" x2="6" y2="6.5" stroke="#71717A" strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="6" cy="8.5" r="0.55" fill="#71717A"/>
    </svg>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  const { selectFinding, selectNode, selectedFindingId } = useAnalysisStore();
  const isSelected = selectedFindingId === finding.id;
  const [hovered, setHovered] = useState(false);

  function handleShowInGraph(e: React.MouseEvent) {
    e.stopPropagation();
    if (finding.location?.primaryFile) {
      // Find node ID by file path — best effort
      selectNode(finding.location.primaryFile);
    }
  }

  return (
    <button
      onClick={() => selectFinding(isSelected ? null : finding.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        textAlign: "left",
        background: isSelected ? "rgba(59,130,246,0.06)" : hovered ? "rgba(255,255,255,0.03)" : "transparent",
        border: "none",
        borderLeft: `3px solid ${isSelected ? severityColor(finding.severity) : hovered ? `${severityColor(finding.severity)}55` : "transparent"}`,
        padding: "11px var(--space-4)",
        cursor: "pointer",
        transition: "background 0.12s ease, border-left-color 0.15s ease",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-3)" }}>
        <span style={{ fontSize: "var(--text-small)", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4 }}>
          {finding.title}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexShrink: 0 }}>
          {finding.chainIds.length > 0 && (
            <span
              style={{
                fontSize: "var(--text-micro)",
                color: "var(--color-accent-text)",
                background: "var(--color-accent-dim)",
                border: "1px solid var(--color-accent-border)",
                borderRadius: 3,
                padding: "1px 6px",
                fontFamily: "var(--font-code)",
                animation: finding.severity === "critical" ? "chain-pulse 1.5s ease-in-out infinite" : undefined,
              }}
            >
              ⛓ {finding.chainIds.length}
            </span>
          )}
        </div>
      </div>
      <div style={{ marginTop: 4, display: "flex", gap: "var(--space-3)", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontFamily: "var(--font-code)",
            fontSize: "var(--text-micro)",
            color: "var(--text-tertiary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "60%",
          }}
        >
          {finding.location.primaryFile}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexShrink: 0 }}>
          <span style={{ fontSize: "var(--text-micro)", color: "var(--text-quaternary)" }}>
            {finding.blastRadius.filesAffected} files
          </span>
          {/* Show in graph button — reveals on hover */}
          <button
            onClick={handleShowInGraph}
            style={{
              background: "rgba(59,130,246,0.1)",
              border: "1px solid var(--color-accent-border)",
              borderRadius: "var(--radius-sm)",
              padding: "2px 7px",
              fontSize: "var(--text-micro)",
              color: "var(--color-accent-text)",
              fontFamily: "var(--font-code)",
              cursor: "pointer",
              opacity: hovered ? 1 : 0,
              transform: hovered ? "translateX(0)" : "translateX(4px)",
              transition: "opacity 0.15s ease, transform 0.15s ease",
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              lineHeight: 1,
            }}
          >
            <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="3" cy="3" r="2"/><circle cx="9" cy="3" r="2"/><circle cx="6" cy="9" r="2"/>
              <line x1="3" y1="5" x2="6" y2="7"/><line x1="9" y1="5" x2="6" y2="7"/>
            </svg>
            Graph
          </button>
        </div>
      </div>
    </button>
  );
}

const AGENT_FILTER_LABELS: Record<string, string> = {
  security: "Security",
  quality:  "Quality",
  pattern:  "Pattern",
  mapper:   "Mapper",
  doctor:   "Doctor",
};

export function FindingsPanel() {
  const { findings, result, findingFilters, setFindingFilter } = useAnalysisStore();
  const [open, setOpen] = useState<Record<Severity, boolean>>({ critical: true, warning: false, info: false });

  const summary = result?.findings;
  const activeCategory = findingFilters.category;
  const activeAgent = findingFilters.agent;

  // Compute which agents have findings
  const agentsWithFindings = Array.from(new Set(findings.map((f) => f.agent))).filter(
    (a) => a && AGENT_FILTER_LABELS[a as string]
  );

  const filteredFindings = findings.filter((f) => {
    if (activeCategory && f.agent !== activeCategory && (f as Finding & { category?: string }).category !== activeCategory) return false;
    if (activeAgent && f.agent !== activeAgent) return false;
    return true;
  });

  const grouped = SEVERITY_ORDER.reduce<Record<Severity, Finding[]>>(
    (acc, sev) => { acc[sev] = filteredFindings.filter((f) => f.severity === sev); return acc; },
    { critical: [], warning: [], info: [] }
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
        display: "flex",
        flexDirection: "column",
        boxShadow: "var(--shadow-panel)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px var(--space-4)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "var(--space-2)",
          flexWrap: "wrap",
        }}
      >
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
          FINDINGS{summary ? ` (${activeCategory ? filteredFindings.length : summary.total})` : ""}
        </h2>
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          {activeCategory && (
            <button
              onClick={() => setFindingFilter({ category: undefined })}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: "var(--text-micro)",
                color: "var(--color-accent-text)",
                fontFamily: "var(--font-code)",
                background: "var(--color-accent-dim)",
                border: "1px solid var(--color-accent-border)",
                borderRadius: "var(--radius-full)",
                padding: "1px 8px",
                cursor: "pointer",
                animation: "badge-pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            >
              {CATEGORY_LABELS[activeCategory] ?? activeCategory}
              <span style={{ opacity: 0.7 }}>✕</span>
            </button>
          )}
          {!activeCategory && summary && summary.critical > 0 && (
            <span
              style={{
                fontSize: "var(--text-micro)",
                color: "var(--color-critical-text)",
                fontFamily: "var(--font-code)",
                background: "var(--color-critical-dim)",
                border: "1px solid var(--color-critical-border)",
                borderRadius: "var(--radius-full)",
                padding: "1px 8px",
                animation: "badge-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            >
              {summary.critical} critical
            </span>
          )}
        </div>
      </div>

      {/* Agent quick-filter tabs */}
      {agentsWithFindings.length > 1 && (
        <div
          style={{
            padding: "8px var(--space-4)",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            gap: "var(--space-2)",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => setFindingFilter({ agent: undefined })}
            style={{
              padding: "2px 9px",
              borderRadius: "var(--radius-full)",
              border: `1px solid ${!activeAgent ? "var(--border-hover)" : "var(--border-default)"}`,
              background: !activeAgent ? "rgba(255,255,255,0.06)" : "transparent",
              color: !activeAgent ? "var(--text-primary)" : "var(--text-tertiary)",
              fontSize: "var(--text-micro)",
              fontFamily: "var(--font-code)",
              cursor: "pointer",
              transition: "all 0.12s ease",
            }}
          >
            All
          </button>
          {agentsWithFindings.map((agent) => {
            const isActive = activeAgent === agent;
            return (
              <button
                key={agent}
                onClick={() => setFindingFilter({ agent: isActive ? undefined : agent as Finding["agent"] })}
                style={{
                  padding: "2px 9px",
                  borderRadius: "var(--radius-full)",
                  border: `1px solid ${isActive ? "var(--border-hover)" : "var(--border-subtle)"}`,
                  background: isActive ? "rgba(255,255,255,0.06)" : "transparent",
                  color: isActive ? "var(--text-secondary)" : "var(--text-quaternary)",
                  fontSize: "var(--text-micro)",
                  fontFamily: "var(--font-code)",
                  cursor: "pointer",
                  transition: "all 0.12s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)";
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.color = "var(--text-quaternary)";
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)";
                  }
                }}
              >
                {AGENT_FILTER_LABELS[agent as string] ?? agent}
              </button>
            );
          })}
        </div>
      )}

      {/* Severity groups */}
      {SEVERITY_ORDER.map((sev) => {
        const list = grouped[sev];
        const count = summary ? summary[sev] : list.length;
        const isOpen = open[sev];
        const color = severityColor(sev);

        return (
          <div key={sev} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <button
              onClick={() => setOpen((o) => ({ ...o, [sev]: !o[sev] }))}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px var(--space-4)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-primary)",
                transition: "background 0.12s ease",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-small)", fontWeight: 600 }}>
                <SeverityIcon severity={sev} />
                <span style={{ color: "var(--text-secondary)" }}>{LABELS[sev]}</span>
                <span
                  style={{
                    fontFamily: "var(--font-code)",
                    fontSize: "var(--text-micro)",
                    color,
                    background: `${color}15`,
                    padding: "1px 7px",
                    borderRadius: "var(--radius-full)",
                    border: `1px solid ${color}33`,
                  }}
                >
                  {count}
                </span>
              </span>
              <span
                style={{
                  color: "var(--text-tertiary)",
                  fontSize: 11,
                  transition: "transform 0.2s ease",
                  transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                  display: "inline-block",
                }}
              >
                ▸
              </span>
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
