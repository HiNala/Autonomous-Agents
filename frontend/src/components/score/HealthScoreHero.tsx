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

function gradeGlowColor(grade: string): string {
  const g = grade.charAt(0);
  if (g === "A") return "rgba(34, 197, 94, 0.25)";
  if (g === "B") return "rgba(34, 197, 94, 0.18)";
  if (g === "C") return "rgba(245, 158, 11, 0.22)";
  if (g === "D") return "rgba(239, 68, 68, 0.20)";
  return "rgba(239, 68, 68, 0.28)";
}

function gradeSeverityBg(grade: string): string {
  const g = grade.charAt(0);
  if (g === "A" || g === "B") return "rgba(34, 197, 94, 0.03)";
  if (g === "C") return "rgba(245, 158, 11, 0.03)";
  return "rgba(239, 68, 68, 0.03)";
}

export function HealthScoreHero() {
  const { result } = useAnalysisStore();
  const hs = result?.healthScore;

  // Reveal phases
  const [phase, setPhase] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hs) return;
    // T+0: container appears
    setPhase(1);
    timerRef.current = setTimeout(() => setPhase(2), 300); // T+300: count-up starts
    return () => clearTimeout(timerRef.current ?? undefined);
  }, [hs]);

  const countEnabled = phase >= 2;
  const gradeVisible = phase >= 2;
  const confidenceVisible = phase >= 2;

  const displayScore = useCountUp(hs?.overall ?? 0, 800, countEnabled);
  const color = gradeColor(hs?.letterGrade ?? "");

  if (!hs) return null;

  const glowColor = gradeGlowColor(hs.letterGrade);
  const severityBg = gradeSeverityBg(hs.letterGrade);

  return (
    <div
      style={{
        background: `rgba(17, 17, 22, 0.72)`,
        backdropFilter: "blur(12px) saturate(1.4)",
        WebkitBackdropFilter: "blur(12px) saturate(1.4)",
        border: "1px solid rgba(255, 255, 255, 0.07)",
        borderLeft: `4px solid ${color}`,
        borderRadius: "var(--radius-xl)",
        padding: "var(--space-8) var(--space-5)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-3)",
        position: "relative",
        overflow: "hidden",
        opacity: phase >= 1 ? 1 : 0,
        transition: "opacity 0.3s ease",
        backgroundColor: severityBg,
        boxShadow:
          "0 0 0 1px rgba(255,255,255,0.04) inset, 0 8px 32px rgba(0,0,0,0.4)",
      }}
    >
      {/* Top-edge gradient border */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent 0%, ${color}44 40%, ${color}88 50%, ${color}44 60%, transparent 100%)`,
        }}
      />

      {/* Radial glow ring behind grade */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 220,
          height: 220,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
          pointerEvents: "none",
          animation: "grade-glow-pulse 4s ease-in-out infinite",
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
          fontVariantNumeric: "tabular-nums",
          transform: gradeVisible ? "scale(1)" : "scale(0.3)",
          opacity: gradeVisible ? 1 : 0,
          filter: gradeVisible ? "blur(0)" : "blur(8px)",
          transition:
            "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 1.1s, opacity 0.4s ease 1.1s, filter 0.4s ease 1.1s",
          position: "relative",
          zIndex: 1,
          textShadow: `0 0 40px ${color}44`,
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
          fontVariantNumeric: "tabular-nums",
          position: "relative",
          zIndex: 1,
        }}
      >
        {displayScore}
        <span style={{ fontSize: "1.1rem", color: "var(--text-tertiary)" }}> / 100</span>
      </div>

      {/* Confidence */}
      <div
        style={{
          fontSize: "var(--text-micro)",
          color: "var(--text-tertiary)",
          fontFamily: "var(--font-code)",
          letterSpacing: "0.06em",
          opacity: confidenceVisible ? 1 : 0,
          transform: confidenceVisible ? "translateY(0)" : "translateY(4px)",
          transition: "opacity 0.2s ease 1.8s, transform 0.2s ease 1.8s",
          position: "relative",
          zIndex: 1,
        }}
      >
        {Math.round(hs.confidence * 100)}% confidence
      </div>
    </div>
  );
}
