"use client";
import { useAnalysisStore } from "@/stores/analysisStore";
import { severityColor } from "@/lib/colors";
import type { CategoryStatus } from "@/types/shared";

const ICONS: Record<CategoryStatus, string> = { healthy: "✓", warning: "⚠", critical: "✗" };
const CATEGORY_LABELS: Record<string, string> = {
  codeQuality:   "Code Quality",
  patterns:      "Patterns",
  security:      "Security",
  dependencies:  "Dependencies",
  architecture:  "Architecture",
};

export function ScoreBreakdown() {
  const { result } = useAnalysisStore();
  const breakdown = result?.healthScore?.breakdown;
  if (!breakdown) return null;

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

        return (
          <div
            key={key}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-3) var(--space-4)",
              animationDelay: `${i * 100}ms`,
            }}
            className="animate-slide-up"
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: "var(--text-small)", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                {CATEGORY_LABELS[key] ?? key}
              </span>
              <span style={{ color, fontSize: "var(--text-micro)", fontFamily: "var(--font-code)", fontWeight: 700 }}>
                {ICONS[cat.status]} {cat.score}/{cat.max}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "var(--bg-surface-raised)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: color,
                  borderRadius: 3,
                  transition: "width 0.6s ease",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
