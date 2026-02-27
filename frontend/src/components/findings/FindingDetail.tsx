"use client";
import { useEffect, useRef } from "react";
import { useAnalysisStore } from "@/stores/analysisStore";
import { severityColor } from "@/lib/colors";
import { ChainVisualization } from "./ChainVisualization";

const SEVERITY_LABEL: Record<string, string> = {
  critical: "CRITICAL",
  warning:  "WARNING",
  info:     "INFO",
};

function CodeBlock({ code, variant }: { code: string; variant: "before" | "after" }) {
  const borderColor = variant === "before" ? "var(--color-critical)" : "var(--color-healthy)";
  const labelColor  = variant === "before" ? "var(--color-critical-text)" : "var(--color-healthy-text)";
  const label       = variant === "before" ? "Before" : "After";

  return (
    <div>
      <p
        style={{
          fontSize: "var(--text-micro)",
          color: labelColor,
          fontFamily: "var(--font-code)",
          margin: "0 0 5px",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: borderColor,
          }}
        />
        {label}
      </p>
      <pre
        style={{
          background: "rgba(9, 9, 11, 0.8)",
          border: `1px solid var(--border-default)`,
          borderLeft: `3px solid ${borderColor}`,
          borderRadius: "var(--radius-md)",
          padding: "var(--space-3) var(--space-4)",
          fontSize: "var(--text-micro)",
          fontFamily: "var(--font-code)",
          color: "var(--text-secondary)",
          overflow: "auto",
          margin: 0,
          lineHeight: 1.7,
          whiteSpace: "pre-wrap",
          tabSize: 2,
          boxShadow: `0 0 0 1px ${borderColor}11 inset`,
        }}
      >
        {code}
      </pre>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: "var(--text-micro)",
        fontFamily: "var(--font-code)",
        fontWeight: 600,
        color: "var(--text-tertiary)",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        margin: "0 0 var(--space-3)",
      }}
    >
      {children}
    </h3>
  );
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        fontSize: "var(--text-micro)",
        fontFamily: "var(--font-code)",
        color,
        border: `1px solid ${color}44`,
        background: `${color}11`,
        borderRadius: "var(--radius-full)",
        padding: "2px 8px",
      }}
    >
      {label}
    </span>
  );
}

export function FindingDetail() {
  const { findings, chains, fixes, selectedFindingId, selectFinding } = useAnalysisStore();
  const panelRef = useRef<HTMLDivElement>(null);
  const finding = findings.find((f) => f.id === selectedFindingId) ?? null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") selectFinding(null); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [selectFinding]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) selectFinding(null);
    };
    if (finding) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [finding, selectFinding]);

  if (!finding) return null;

  const relatedChains = chains.filter((c) => finding.chainIds.includes(c.id));
  const fix = finding.fixId ? fixes.find((f) => f.id === finding.fixId) : null;
  const color = severityColor(finding.severity);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => selectFinding(null)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 300,
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
        }}
      />

      {/* Slide-over drawer */}
      <div
        ref={panelRef}
        style={{
          position: "fixed",
          top: "56px",
          right: 0,
          bottom: "40px",
          width: "min(500px, 100vw)",
          background: "rgba(20, 20, 26, 0.96)",
          backdropFilter: "blur(20px) saturate(1.6)",
          WebkitBackdropFilter: "blur(20px) saturate(1.6)",
          borderLeft: `1px solid var(--border-default)`,
          zIndex: 310,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          animation: "slide-in-right 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
          boxShadow: "var(--shadow-drawer)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "var(--space-5)",
            borderBottom: "1px solid var(--border-subtle)",
            background: `${color}08`,
            borderLeft: `4px solid ${color}`,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-3)" }}>
            <span
              style={{
                fontSize: "var(--text-micro)",
                fontFamily: "var(--font-code)",
                fontWeight: 700,
                color,
                letterSpacing: "0.12em",
                padding: "2px 9px",
                border: `1px solid ${color}55`,
                borderRadius: "var(--radius-full)",
                background: `${color}12`,
              }}
            >
              {SEVERITY_LABEL[finding.severity]}
            </span>
            <button
              onClick={() => selectFinding(null)}
              style={{
                background: "transparent",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-tertiary)",
                cursor: "pointer",
                fontSize: 12,
                padding: "3px 7px",
                lineHeight: 1,
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)";
              }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <h2 style={{ fontSize: "var(--text-h2)", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 var(--space-2)", lineHeight: 1.35 }}>
            {finding.title}
          </h2>
          <div style={{ fontSize: "var(--text-micro)", color: "var(--text-tertiary)", fontFamily: "var(--font-code)", display: "flex", gap: "var(--space-3)" }}>
            <span>{Math.round(finding.confidence * 100)}% confidence</span>
            <span>·</span>
            <span style={{ textTransform: "capitalize" }}>{finding.agent} Agent</span>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>

          {/* 1. Plain language — FIRST, always */}
          <section>
            <SectionTitle>In Simple Terms</SectionTitle>
            <div
              style={{
                padding: "var(--space-4)",
                background: "rgba(59, 130, 246, 0.06)",
                border: "1px solid rgba(59, 130, 246, 0.15)",
                borderLeft: "3px solid var(--color-accent)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--text-body)",
                color: "var(--text-primary)",
                lineHeight: 1.65,
              }}
            >
              {finding.plainDescription}
            </div>
          </section>

          {/* 2. Technical description */}
          <section>
            <SectionTitle>Technical Details</SectionTitle>
            <p style={{ fontSize: "var(--text-small)", color: "var(--text-secondary)", lineHeight: 1.7, margin: 0 }}>
              {finding.description}
            </p>
            {finding.cve && (
              <div style={{ marginTop: "var(--space-3)", display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                <Chip label={finding.cve.id} color="var(--color-critical)" />
                <Chip label={`CVSS ${finding.cve.cvssScore}`} color="var(--color-warning)" />
                {finding.cve.exploitAvailable && <Chip label="Exploit Available" color="var(--color-critical)" />}
                {finding.cve.fixedVersion && <Chip label={`Fixed: ${finding.cve.fixedVersion}`} color="var(--color-healthy)" />}
              </div>
            )}
          </section>

          {/* 3. Affected files */}
          <section>
            <SectionTitle>Affected Files</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {finding.location.files.map((file) => (
                <div
                  key={file}
                  style={{
                    fontFamily: "var(--font-code)",
                    fontSize: "var(--text-micro)",
                    color: file === finding.location.primaryFile ? "var(--text-secondary)" : "var(--text-tertiary)",
                    background: "rgba(9, 9, 11, 0.6)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    padding: "4px 9px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    overflow: "hidden",
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {file}
                  </span>
                  {file === finding.location.primaryFile && finding.location.startLine && (
                    <span style={{ color: "var(--text-quaternary)", flexShrink: 0, marginLeft: 8 }}>
                      L{finding.location.startLine}–{finding.location.endLine}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 4. Blast radius */}
          <section>
            <SectionTitle>Blast Radius</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-3)" }}>
              {[
                { label: "Files",     value: finding.blastRadius.filesAffected },
                { label: "Functions", value: finding.blastRadius.functionsAffected },
                { label: "Endpoints", value: finding.blastRadius.endpointsAffected },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    textAlign: "center",
                    background: "rgba(17, 17, 22, 0.72)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-md)",
                    padding: "var(--space-3)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "1.6rem",
                      fontWeight: 700,
                      color,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {s.value}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-micro)",
                      color: "var(--text-tertiary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginTop: 2,
                    }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 5. Vulnerability chains */}
          {relatedChains.length > 0 && (
            <section>
              <SectionTitle>Attack Chains ({relatedChains.length})</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {relatedChains.map((chain) => (
                  <ChainVisualization key={chain.id} chain={chain} />
                ))}
              </div>
            </section>
          )}

          {/* 6. Fix documentation */}
          {fix && (
            <section>
              <SectionTitle>Fix: {fix.title}</SectionTitle>
              <div
                style={{
                  background: "rgba(17, 17, 22, 0.72)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--space-4)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-4)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <div style={{ display: "flex", gap: "var(--space-4)", fontSize: "var(--text-micro)", color: "var(--text-tertiary)", fontFamily: "var(--font-code)" }}>
                  <span>⏱ {fix.estimatedEffort}</span>
                  {fix.chainsResolved > 0 && <span>⛓ Resolves {fix.chainsResolved} chains</span>}
                </div>
                <p style={{ fontSize: "var(--text-small)", color: "var(--text-secondary)", margin: 0, lineHeight: 1.65 }}>
                  {fix.documentation.whatsWrong}
                </p>
                {fix.documentation.steps.length > 0 && (
                  <ol style={{ margin: 0, paddingLeft: "var(--space-5)", display: "flex", flexDirection: "column", gap: 5 }}>
                    {fix.documentation.steps.map((step, i) => (
                      <li key={i} style={{ fontSize: "var(--text-small)", color: "var(--text-primary)", lineHeight: 1.6 }}>{step}</li>
                    ))}
                  </ol>
                )}
                {(fix.documentation.beforeCode || fix.documentation.afterCode) && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                    {fix.documentation.beforeCode && <CodeBlock code={fix.documentation.beforeCode} variant="before" />}
                    {fix.documentation.afterCode && <CodeBlock code={fix.documentation.afterCode} variant="after" />}
                  </div>
                )}
              </div>
            </section>
          )}

        </div>
      </div>
    </>
  );
}
