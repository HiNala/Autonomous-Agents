"use client";
import type { GraphViewMode } from "@/types/shared";

const VIEWS: { key: GraphViewMode; label: string; desc: string }[] = [
  { key: "structure",        label: "Structure",       desc: "File & directory hierarchy" },
  { key: "dependencies",     label: "Dependencies",    desc: "Import & package graph" },
  { key: "vulnerabilities",  label: "Vulnerabilities", desc: "Attack chains highlighted" },
];

interface Props {
  view: GraphViewMode;
  onViewChange: (v: GraphViewMode) => void;
  onReset: () => void;
  onFullscreen: () => void;
  nodeCount: number;
  edgeCount: number;
}

export function GraphToolbar({ view, onViewChange, onReset, onFullscreen, nodeCount, edgeCount }: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px var(--space-4)",
        borderBottom: "1px solid var(--border-default)",
        gap: "var(--space-3)",
        flexWrap: "wrap",
      }}
    >
      {/* View tabs */}
      <div style={{ display: "flex", gap: 2, background: "var(--bg-primary)", borderRadius: "var(--radius-md)", padding: 2 }}>
        {VIEWS.map((v) => (
          <button
            key={v.key}
            title={v.desc}
            onClick={() => onViewChange(v.key)}
            style={{
              padding: "5px 12px",
              borderRadius: "calc(var(--radius-md) - 2px)",
              border: "none",
              cursor: "pointer",
              fontSize: "var(--text-micro)",
              fontFamily: "var(--font-code)",
              fontWeight: 600,
              letterSpacing: "0.04em",
              background: view === v.key ? "var(--bg-surface-raised)" : "transparent",
              color: view === v.key
                ? v.key === "vulnerabilities" ? "var(--color-critical)" : "var(--text-primary)"
                : "var(--text-tertiary)",
              transition: "all 0.15s ease",
              textTransform: "uppercase",
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Stats + controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
        {nodeCount > 0 && (
          <span style={{ fontSize: "var(--text-micro)", color: "var(--text-tertiary)", fontFamily: "var(--font-code)" }}>
            {nodeCount} nodes · {edgeCount} edges
          </span>
        )}
        <button
          onClick={onReset}
          title="Reset zoom"
          style={{ background: "transparent", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", padding: "4px 8px", color: "var(--text-tertiary)", cursor: "pointer", fontSize: "var(--text-micro)" }}
        >
          ↺ Reset
        </button>
        <button
          onClick={onFullscreen}
          title="Fullscreen"
          style={{ background: "transparent", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", padding: "4px 8px", color: "var(--text-tertiary)", cursor: "pointer", fontSize: "var(--text-micro)" }}
        >
          ⤢
        </button>
      </div>
    </div>
  );
}
