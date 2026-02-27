"use client";
import { useEffect, useRef, useState } from "react";
import { useAnalysisStore } from "@/stores/analysisStore";
import { gradeColor } from "@/lib/colors";

function useCountUp(target: number, duration = 800, enabled = true) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!enabled || target === 0) { setValue(target); return; }
    const start = performance.now();
    const raf = (ts: number) => {
      const elapsed = ts - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }, [target, duration, enabled]);
  return value;
}

export function HealthScoreHero() {
  const { result } = useAnalysisStore();
  const hs = result?.healthScore;
  const [revealed, setRevealed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (hs) { timerRef.current = setTimeout(() => setRevealed(true), 100); }
    return () => clearTimeout(timerRef.current);
  }, [hs]);

  const displayScore = useCountUp(hs?.overall ?? 0, 800, revealed);
  const color = gradeColor(hs?.letterGrade ?? "");

  if (!hs) return null;

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: `1px solid ${color}33`,
        borderRadius: "var(--radius-xl)",
        padding: "var(--space-8) var(--space-6)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-3)",
        position: "relative",
        overflow: "hidden",
        opacity: revealed ? 1 : 0,
        transition: "opacity 0.3s ease",
      }}
    >
      {/* Glow behind grade */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${color}22 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* Letter grade */}
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-hero)",
          fontWeight: 700,
          color,
          lineHeight: 1,
          letterSpacing: "-0.02em",
          transform: revealed ? "scale(1)" : "scale(0.5)",
          transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {hs.letterGrade}
      </div>

      {/* Numeric score */}
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-score-number)",
          fontWeight: 500,
          color: "var(--text-secondary)",
          lineHeight: 1,
        }}
      >
        {displayScore} <span style={{ fontSize: "1.2rem", color: "var(--text-tertiary)" }}>/ 100</span>
      </div>

      {/* Confidence */}
      <div style={{ fontSize: "var(--text-micro)", color: "var(--text-tertiary)", fontFamily: "var(--font-code)" }}>
        {Math.round(hs.confidence * 100)}% confidence
      </div>
    </div>
  );
}
