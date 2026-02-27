"use client";
import { useState } from "react";
import { useAnalysisStore } from "@/stores/analysisStore";

const SPONSORS: Array<{
  name: string;
  color: string;
  agent: string;
  tagline: string;
}> = [
  { name: "Yutori",  color: "#EC4899", agent: "security",  tagline: "Primary reasoning engine" },
  { name: "Senso",   color: "#9333EA", agent: "senso",     tagline: "Context OS — cross-repo intelligence" },
  { name: "Neo4j",   color: "#018BFF", agent: "mapper",    tagline: "Knowledge graph engine" },
  { name: "Tavily",  color: "#3B82F6", agent: "security",  tagline: "Fast supplemental web search" },
  { name: "OpenAI",  color: "#22C55E", agent: "doctor",    tagline: "Backup reasoning & structured outputs" },
  { name: "Fastino", color: "#F59E0B", agent: "mapper",    tagline: "Fast entity pre-extraction" },
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
        background: "rgba(7, 7, 12, 0.75)",
        backdropFilter: "blur(16px) saturate(1.8)",
        WebkitBackdropFilter: "blur(16px) saturate(1.8)",
        borderTop: "1px solid rgba(255,255,255,0.09)",
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
              color: isActive || isHovered ? s.color : `${s.color}BB`,
              letterSpacing: "0.06em",
              filter: isActive || isHovered
                ? `drop-shadow(0 0 6px ${s.color}66)`
                : `drop-shadow(0 0 3px ${s.color}33)`,
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
