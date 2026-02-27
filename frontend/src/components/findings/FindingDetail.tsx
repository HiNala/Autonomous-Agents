"use client";
import { useEffect, useRef } from "react";
import { useAnalysisStore } from "@/stores/analysisStore";
import { severityColor, severityBg } from "@/lib/colors";
import { ChainVisualization } from "./ChainVisualization";

const SEVERITY_LABEL: Record<string, string> = { critical: "CRITICAL", warning: "WARNING", info: "INFO" };

export function FindingDetail() {
  const { findings, chains, fixes, selectedFindingId, selectFinding } = useAnalysisStore();
  const panelRef = useRef<HTMLDivElement>(null);
  const finding = findings.find((f) => f.id === selectedFindingId) ?? null;

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") selectFinding(null); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [selectFinding]);

  // Click outside to close
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
  const bg = severityBg(finding.severity);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => selectFinding(null)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          zIndex: 60,
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Slide-over panel */}
      <div
        ref={panelRef}
        style={{
          position: "fixed",
          top: "56px",
          right: 0,
          bottom: "40px",
          width: "min(520px, 100vw)",
          background: "var(--bg-surface)",
          borderLeft: "1px solid var(--border-default)",
          zIndex: 70,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          animation: "slide-in-right 0.28s ease-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "var(--space-5) var(--space-5) var(--space-4)",
            borderBottom: "1px solid var(--border-default)",
            background: bg,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span
              style={{
                fontSize: "var(--text-micro)",
                fontFamily: "var(--font-code)",
                fontWeight: 700,
                color,
                letterSpacing: "0.12em",
                padding: "2px 8px",
                border: `1px solid ${color}`,
                borderRadius: "var(--radius-full)",
              }}
            >
              {SEVERITY_LABEL[finding.severity]}
            </span>
            <button
              onClick={() => selectFinding(null)}
              style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: "1.1rem", padding: 4 }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <h2 style={{ fontSize: "var(--text-h2)", fontWeight: 600, color: "var(--text-primary)", margin: "var(--space-3) 0 var(--space-2)", lineHeight: 1.4 }}>
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

          {/* 1. Plain language — FIRST (van Rossum mandate) */}
          <section>
            <h3 style={sectionTitle}>💬 In Simple Terms</h3>
            <div style={{ background: "var(--bg-surface-raised)", borderRadius: "var(--radius-md)", padding: "var(--space-4)", fontSize: "var(--text-body)", color: "var(--text-primary)", lineHeight: 1.6 }}>
              {finding.plainDescription}
            </div>
          </section>

          {/* 2. Technical description */}
          <section>
            <h3 style={sectionTitle}>📋 Technical Details</h3>
            <p style={{ fontSize: "var(--text-small)", color: "var(--text-secondary)", lineHeight: 1.7, margin: 0 }}>
              {finding.description}
            </p>
            {finding.cve && (
              <div style={{ marginTop: "var(--space-3)", display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                <Chip label={finding.cve.id} color="var(--color-critical)" />
                <Chip label={`CVSS ${finding.cve.cvssScore}`} color="var(--color-warning)" />
                {finding.cve.exploitAvailable && <Chip label="Exploit Available" color="var(--color-critical)" />}
                <Chip label={`Fixed: ${finding.cve.fixedVersion}`} color="var(--color-healthy)" />
              </div>
            )}
          </section>

          {/* 3. Affected files */}
          <section>
            <h3 style={sectionTitle}>📁 Affected Files</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {finding.location.files.map((file) => (
                <div key={file} style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-micro)", color: "var(--text-secondary)", background: "var(--bg-input)", borderRadius: "var(--radius-sm)", padding: "4px 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {file}
                  {file === finding.location.primaryFile && (
                    <span style={{ marginLeft: 8, color: "var(--text-tertiary)" }}>
                      lines {finding.location.startLine}–{finding.location.endLine}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 4. Blast radius */}
          <section>
            <h3 style={sectionTitle}>💥 Blast Radius</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-3)" }}>
              {[
                { label: "Files",    value: finding.blastRadius.filesAffected },
                { label: "Funcs",    value: finding.blastRadius.functionsAffected },
                { label: "Endpoints",value: finding.blastRadius.endpointsAffected },
              ].map((s) => (
                <div key={s.label} style={{ textAlign: "center", background: "var(--bg-surface-raised)", borderRadius: "var(--radius-md)", padding: "var(--space-3)" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: "var(--text-micro)", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 5. Vulnerability chains */}
          {relatedChains.length > 0 && (
            <section>
              <h3 style={sectionTitle}>⛓ Attack Chains ({relatedChains.length})</h3>
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
              <h3 style={sectionTitle}>🔧 Fix: {fix.title}</h3>
              <div style={{ background: "var(--bg-surface-raised)", borderRadius: "var(--radius-md)", padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <div style={{ display: "flex", gap: "var(--space-4)", fontSize: "var(--text-micro)", color: "var(--text-tertiary)", fontFamily: "var(--font-code)" }}>
                  <span>⏱ {fix.estimatedEffort}</span>
                  {fix.chainsResolved > 0 && <span>⛓ Resolves {fix.chainsResolved} chains</span>}
                </div>
                <p style={{ fontSize: "var(--text-small)", color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
                  {fix.documentation.whatsWrong}
                </p>
                {fix.documentation.steps.length > 0 && (
                  <ol style={{ margin: 0, paddingLeft: "var(--space-5)", display: "flex", flexDirection: "column", gap: 4 }}>
                    {fix.documentation.steps.map((step, i) => (
                      <li key={i} style={{ fontSize: "var(--text-small)", color: "var(--text-primary)", lineHeight: 1.6 }}>{step}</li>
                    ))}
                  </ol>
                )}
                {(fix.documentation.beforeCode || fix.documentation.afterCode) && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                    {fix.documentation.beforeCode && (
                      <div>
                        <p style={{ fontSize: "var(--text-micro)", color: "var(--color-critical)", fontFamily: "var(--font-code)", margin: "0 0 4px" }}>Before</p>
                        <pre style={codeStyle}>{fix.documentation.beforeCode}</pre>
                      </div>
                    )}
                    {fix.documentation.afterCode && (
                      <div>
                        <p style={{ fontSize: "var(--text-micro)", color: "var(--color-healthy)", fontFamily: "var(--font-code)", margin: "0 0 4px" }}>After</p>
                        <pre style={codeStyle}>{fix.documentation.afterCode}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 7. Senso historical context */}
          {fix?.sensoHistoricalContext && (
            <section>
              <h3 style={sectionTitle}>🧠 Intelligence from Previous Scans</h3>
              <div style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: "var(--radius-md)", padding: "var(--space-4)", fontSize: "var(--text-small)", color: "var(--color-accent)", lineHeight: 1.6, fontStyle: "italic" }}>
                {fix.sensoHistoricalContext}
              </div>
            </section>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ fontSize: "var(--text-micro)", fontFamily: "var(--font-code)", color, border: `1px solid ${color}44`, background: `${color}11`, borderRadius: "var(--radius-full)", padding: "2px 8px" }}>
      {label}
    </span>
  );
}

const sectionTitle: React.CSSProperties = {
  fontSize: "var(--text-small)",
  fontFamily: "var(--font-code)",
  fontWeight: 600,
  color: "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  margin: "0 0 var(--space-3)",
};

const codeStyle: React.CSSProperties = {
  background: "var(--bg-input)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-md)",
  padding: "var(--space-3)",
  fontSize: "var(--text-micro)",
  fontFamily: "var(--font-code)",
  color: "var(--text-primary)",
  overflow: "auto",
  margin: 0,
  lineHeight: 1.6,
  whiteSpace: "pre-wrap",
};
