"use client";
import { useState } from "react";
import { useAnalysisStore } from "@/stores/analysisStore";

const SPONSORS: Array<{
  name: string;
  color: string;
  agent: string;
  tagline: string;
}> = [
  { name: "Neo4j",   color: "#018BFF", agent: "mapper",    tagline: "Knowledge graph engine" },
  { name: "Fastino", color: "#F59E0B", agent: "mapper",    tagline: "High-speed LLM inference" },
  { name: "OpenAI",  color: "#22C55E", agent: "security",  tagline: "Security & quality analysis" },
  { name: "Senso",   color: "#9333EA", agent: "senso",     tagline: "Cross-repo intelligence" },
  { name: "Tavily",  color: "#3B82F6", agent: "security",  tagline: "CVE & research search" },
  { name: "Yutori",  color: "#EC4899", agent: "quality",   tagline: "Code quality analysis" },
];

export function SponsorFooter() {
  const { agentStatuses, status } = useAnalysisStore();
  const isScanning   = ["cloning", "mapping", "analyzing", "completing"].includes(status);
  const isCompleted  = status === "completed";
  const [hoveredSponsor, setHoveredSponsor] = useState<string | null>(null);

  return (
    <footer
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "40px",
        background: "rgba(9, 9, 11, 0.88)",
        backdropFilter: "blur(16px) saturate(1.4)",
        WebkitBackdropFilter: "blur(16px) saturate(1.4)",
        borderTop: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-5)",
        zIndex: "var(--z-footer)",
        padding: "0 var(--space-6)",
      }}
    >
      <span
        style={{
          fontSize: "var(--text-micro)",
          color: "var(--text-quaternary)",
          fontFamily: "var(--font-code)",
          letterSpacing: "0.06em",
        }}
      >
        Powered by
      </span>

      {SPONSORS.map((s) => {
        const agentStatus = agentStatuses[s.agent as keyof typeof agentStatuses];
        const isActive = isScanning && agentStatus?.status === "running";
        const isHovered = hoveredSponsor === s.name;
        const showColor = isActive || isCompleted || isHovered;

        return (
          <div
            key={s.name}
            style={{ position: "relative" }}
            onMouseEnter={() => setHoveredSponsor(s.name)}
            onMouseLeave={() => setHoveredSponsor(null)}
          >
            {/* Activity dot */}
            <span
              style={{
                position: "absolute",
                top: -3,
                right: -3,
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: isActive ? s.color : "transparent",
                boxShadow: isActive ? `0 0 6px ${s.color}` : "none",
                animation: isActive ? "dot-blink 0.8s ease-in-out infinite" : undefined,
                transition: "background 0.3s ease, box-shadow 0.3s ease",
              }}
            />

            <span
              style={{
                fontSize: "var(--text-micro)",
                fontFamily: "var(--font-code)",
                fontWeight: 600,
                color: showColor ? s.color : "var(--text-quaternary)",
                letterSpacing: "0.06em",
                filter: showColor ? `drop-shadow(0 0 4px ${s.color}44)` : "none",
                transition: "color 0.3s ease, filter 0.3s ease",
                animation: isActive ? "sponsor-pulse 1.5s ease-in-out infinite" : undefined,
                cursor: "default",
              }}
            >
              {s.name}
            </span>

            {/* Hover tooltip */}
            {isHovered && (
              <div
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 8px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  padding: "5px 10px",
                  background: "rgba(17, 17, 22, 0.96)",
                  border: `1px solid ${s.color}33`,
                  borderRadius: "var(--radius-sm)",
                  fontSize: "var(--text-micro)",
                  color: "var(--text-secondary)",
                  whiteSpace: "nowrap",
                  fontFamily: "var(--font-code)",
                  backdropFilter: "blur(8px)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                  animation: "slide-up 0.12s ease-out",
                  zIndex: 200,
                  pointerEvents: "none",
                }}
              >
                {s.tagline}
                {isActive && (
                  <span style={{ marginLeft: 8, color: s.color, fontWeight: 600 }}>
                    · active
                  </span>
                )}
                {/* Arrow */}
                <div
                  style={{
                    position: "absolute",
                    bottom: -5,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 0,
                    height: 0,
                    borderLeft: "5px solid transparent",
                    borderRight: "5px solid transparent",
                    borderTop: `5px solid rgba(17,17,22,0.96)`,
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </footer>
  );
}
