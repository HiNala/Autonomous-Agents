"use client";
import { useState } from "react";
import type { GraphViewMode } from "@/types/shared";

const VIEWS: { key: GraphViewMode; label: string; desc: string }[] = [
  { key: "structure",       label: "Structure",       desc: "File & directory hierarchy" },
  { key: "dependencies",    label: "Dependencies",    desc: "Import & package graph" },
  { key: "vulnerabilities", label: "Vulnerabilities", desc: "Attack chains highlighted" },
];

interface Props {
  view: GraphViewMode;
  onViewChange: (v: GraphViewMode) => void;
  onReset: () => void;
  onFullscreen: () => void;
  onSearch?: (q: string) => void;
  nodeCount: number;
  edgeCount: number;
}

export function GraphToolbar({ view, onViewChange, onReset, onFullscreen, onSearch, nodeCount, edgeCount }: Props) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchVal, setSearchVal] = useState("");

  function handleSearch(val: string) {
    setSearchVal(val);
    onSearch?.(val);
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px var(--space-4)",
        borderBottom: "1px solid var(--border-subtle)",
        gap: "var(--space-3)",
        flexWrap: "wrap",
        background: "rgba(9, 9, 11, 0.4)",
      }}
    >
      {/* View tabs */}
      <div
        style={{
          display: "flex",
          gap: 2,
          background: "rgba(9,9,11,0.6)",
          borderRadius: "var(--radius-md)",
          padding: 2,
          border: "1px solid var(--border-subtle)",
        }}
      >
        {VIEWS.map((v) => {
          const isActive = view === v.key;
          const isVuln = v.key === "vulnerabilities";
          return (
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
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                background: isActive ? "var(--bg-surface-2)" : "transparent",
                color: isActive
                  ? isVuln
                    ? "var(--color-critical-text)"
                    : "var(--text-primary)"
                  : "var(--text-tertiary)",
                borderBottom: isActive && isVuln ? "1px solid var(--color-critical-border)" : "none",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)";
              }}
            >
              {isVuln && (
                <span style={{ marginRight: 4, fontSize: 9 }}>⚠</span>
              )}
              {v.label}
            </button>
          );
        })}
      </div>

      {/* Right side controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        {/* Graph stats */}
        {nodeCount > 0 && !searchOpen && (
          <span
            style={{
              fontSize: "var(--text-micro)",
              color: "var(--text-quaternary)",
              fontFamily: "var(--font-code)",
              letterSpacing: "0.06em",
            }}
          >
            {nodeCount} nodes · {edgeCount} edges
          </span>
        )}

        {/* Search input */}
        {searchOpen ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "var(--bg-input)",
              border: "1px solid var(--color-accent-border)",
              borderRadius: "var(--radius-sm)",
              padding: "3px 8px",
              boxShadow: "0 0 0 2px var(--color-accent-dim)",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5">
              <circle cx="7" cy="7" r="5.5"/><path d="M11 11l3 3"/>
            </svg>
            <input
              autoFocus
              value={searchVal}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Filter nodes..."
              style={{
                width: 120,
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: "var(--text-micro)",
                fontFamily: "var(--font-code)",
                color: "var(--text-primary)",
                caretColor: "var(--color-accent)",
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearchOpen(false);
                  setSearchVal("");
                  onSearch?.("");
                }
              }}
            />
            <button
              onClick={() => { setSearchOpen(false); setSearchVal(""); onSearch?.(""); }}
              style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 11, padding: 0, lineHeight: 1 }}
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            title="Search nodes"
            style={{
              background: "transparent",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-sm)",
              padding: "4px 8px",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              fontSize: "var(--text-micro)",
              fontFamily: "var(--font-code)",
              display: "flex",
              alignItems: "center",
              gap: 4,
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
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="5.5"/><path d="M11 11l3 3"/>
            </svg>
          </button>
        )}

        {/* Reset zoom */}
        <button
          onClick={onReset}
          title="Reset zoom"
          style={{
            background: "transparent",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-sm)",
            padding: "4px 8px",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            fontSize: "var(--text-micro)",
            fontFamily: "var(--font-code)",
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
          ↺
        </button>

        {/* Fullscreen */}
        <button
          onClick={onFullscreen}
          title="Fullscreen"
          style={{
            background: "transparent",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-sm)",
            padding: "4px 8px",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            fontSize: "var(--text-micro)",
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
          ⤢
        </button>
      </div>
    </div>
  );
}
