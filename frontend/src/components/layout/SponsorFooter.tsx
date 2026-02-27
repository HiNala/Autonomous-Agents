"use client";
import { useAnalysisStore } from "@/stores/analysisStore";

const SPONSORS = [
  { name: "Neo4j",   abbrev: "NEO4J",   color: "#4ED1A0", agent: "mapper",   icon: "⬡" },
  { name: "Fastino", abbrev: "FASTINO", color: "#F59E0B", agent: "mapper",   icon: "⚡" },
  { name: "Yutori",  abbrev: "YUTORI",  color: "#EC4899", agent: "quality",  icon: "◈" },
  { name: "OpenAI",  abbrev: "OPENAI",  color: "#22C55E", agent: "security", icon: "⊛" },
  { name: "Senso",   abbrev: "SENSO",   color: "#8B5CF6", agent: "senso",    icon: "◉" },
  { name: "Tavily",  abbrev: "TAVILY",  color: "#3B82F6", agent: "security", icon: "◎" },
] as const;

type AgentName = "mapper" | "quality" | "security" | "senso";

export function SponsorFooter() {
  const { agentStatuses, status } = useAnalysisStore();
  const isScanning = ["cloning", "mapping", "analyzing", "completing"].includes(status);

  return (
    <footer
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "40px",
        background: "rgba(9,9,11,0.90)",
        backdropFilter: "blur(16px) saturate(1.3)",
        WebkitBackdropFilter: "blur(16px) saturate(1.3)",
        borderTop: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-6)",
        zIndex: 50,
        padding: "0 var(--space-6)",
      }}
    >
      <span
        style={{
          fontSize: "9px",
          color: "var(--text-tertiary)",
          fontFamily: "var(--font-code)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          flexShrink: 0,
        }}
      >
        Powered by
      </span>

      {/* Thin divider */}
      <div style={{ width: 1, height: 16, background: "var(--border-default)", flexShrink: 0 }} />

      {SPONSORS.map((s) => {
        const agentStatus = agentStatuses[s.agent as AgentName];
        const isActive    = isScanning && agentStatus?.status === "running";

        return (
          <div
            key={s.name}
            title={s.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              cursor: "default",
            }}
          >
            {/* Color dot / pulsing icon */}
            <span
              style={{
                fontSize: 10,
                color: isActive ? s.color : "var(--border-active)",
                transition: "color 0.3s ease, text-shadow 0.3s ease",
                textShadow: isActive ? `0 0 8px ${s.color}` : "none",
                animation: isActive ? "pulse-once 1.4s ease-in-out infinite" : undefined,
              }}
            >
              {s.icon}
            </span>
            <span
              style={{
                fontSize: "9px",
                fontFamily: "var(--font-code)",
                fontWeight: 700,
                letterSpacing: "0.10em",
                color: isActive ? s.color : "var(--text-tertiary)",
                transition: "color 0.3s ease",
              }}
            >
              {s.abbrev}
            </span>
          </div>
        );
      })}
    </footer>
  );
}
