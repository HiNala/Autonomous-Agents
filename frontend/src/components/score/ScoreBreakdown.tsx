"use client";
import { useState } from "react";
import { useAnalysisStore } from "@/stores/analysisStore";
import { severityColor } from "@/lib/colors";
import type { CategoryStatus, Severity } from "@/types/shared";

const STATUS_ICONS: Record<CategoryStatus, React.ReactNode> = {
  healthy: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeWidth="1"/>
      <path d="M3.5 6l1.5 1.5 3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  warning: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6 1.5L11 10.5H1L6 1.5Z" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="6" y1="5" x2="6" y2="7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="6" cy="9" r="0.6" fill="currentColor"/>
    </svg>
  ),
  critical: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeWidth="1"/>
      <line x1="4" y1="4" x2="8" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="8" y1="4" x2="4" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
};

const CATEGORY_LABELS: Record<string, string> = {
  codeQuality:  "Code Quality",
  patterns:     "Patterns",
  security:     "Security",
  dependencies: "Dependencies",
  architecture: "Architecture",
};

export function ScoreBreakdown() {
  const { result, findingFilters } = useAnalysisStore();
  const breakdown = result?.healthScore?.breakdown;
  const [hovered, setHovered] = useState<string | null>(null);
  const activeFilter = (findingFilters as { category?: string }).category;

  if (!breakdown) return null;

  function handleCategoryClick(key: string) {
    // Toggle category filter in store — expose via zustand if needed
    // For now we just highlight; full filter wiring is done in FindingsPanel
    const store = require("@/stores/analysisStore").useAnalysisStore;
    store.getState().setFindingFilter?.({ category: activeFilter === key ? undefined : key });
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
      }}
    >
      {Object.entries(breakdown).map(([key, cat], i) => {
        const color = severityColor(cat.status);
        const pct = Math.round((cat.score / cat.max) * 100);
        const isHovered = hovered === key;
        const isActive = activeFilter === key;

        return (
          <div
            key={key}
            onClick={() => handleCategoryClick(key)}
            onMouseEnter={() => setHovered(key)}
            onMouseLeave={() => setHovered(null)}
            style={{
              background: isActive
                ? "rgba(59, 130, 246, 0.06)"
                : "rgba(17, 17, 22, 0.72)",
              backdropFilter: "blur(12px) saturate(1.4)",
              WebkitBackdropFilter: "blur(12px) saturate(1.4)",
              border: isActive
                ? "1px solid var(--color-accent-border)"
                : isHovered
                ? "1px solid var(--border-hover)"
                : "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-3) var(--space-4)",
              cursor: "pointer",
              transform: isHovered && !isActive ? "translateY(-2px)" : "translateY(0)",
              boxShadow: isHovered ? "0 8px 24px rgba(0,0,0,0.35)" : "var(--shadow-card)",
              transition:
                "border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease, background 0.2s ease",
              animationDelay: `${i * 100}ms`,
              position: "relative",
              overflow: "hidden",
            }}
            className="animate-slide-up"
          >
            {/* Active indicator dot */}
            {isActive && (
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--color-accent)",
                  boxShadow: "0 0 8px var(--color-accent-glow)",
                }}
              />
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span
                style={{
                  fontSize: "var(--text-micro)",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  fontFamily: "var(--font-code)",
                }}
              >
                {CATEGORY_LABELS[key] ?? key}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  color,
                  fontSize: "var(--text-micro)",
                  fontFamily: "var(--font-code)",
                  fontWeight: 700,
                }}
              >
                {STATUS_ICONS[cat.status]}
                {cat.score}/{cat.max}
              </span>
            </div>

            {/* Score bar */}
            <div
              style={{
                height: 6,
                borderRadius: 3,
                background: "rgba(255,255,255,0.06)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: color,
                  borderRadius: 3,
                  transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Bar shimmer */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: "-100%",
                    width: "60%",
                    height: "100%",
                    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                    animation: "bar-shimmer 2s 0.5s infinite linear",
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
