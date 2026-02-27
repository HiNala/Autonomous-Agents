"use client";
import { useAnalysisStore } from "@/stores/analysisStore";

const SPONSORS = [
  { name: "Neo4j",   color: "#4ED1A0", agent: "mapper"       },
  { name: "Fastino", color: "#F59E0B", agent: "mapper"       },
  { name: "Yutori",  color: "#EC4899", agent: "quality"      },
  { name: "OpenAI",  color: "#22C55E", agent: "security"     },
  { name: "Senso",   color: "#8B5CF6", agent: "senso"        },
  { name: "Tavily",  color: "#3B82F6", agent: "security"     },
];

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
        background: "rgba(10,10,11,0.85)",
        backdropFilter: "blur(12px)",
        borderTop: "1px solid var(--border-default)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-5)",
        zIndex: 50,
        padding: "0 var(--space-6)",
      }}
    >
      <span style={{ fontSize: "var(--text-micro)", color: "var(--text-tertiary)", fontFamily: "var(--font-code)", marginRight: "var(--space-2)" }}>
        Powered by
      </span>
      {SPONSORS.map((s) => {
        const agentStatus = agentStatuses[s.agent as keyof typeof agentStatuses];
        const isActive = isScanning && agentStatus?.status === "running";
        return (
          <span
            key={s.name}
            style={{
              fontSize: "var(--text-micro)",
              fontFamily: "var(--font-code)",
              fontWeight: 600,
              color: isActive ? s.color : "var(--text-tertiary)",
              transition: "color 0.3s ease",
              animation: isActive ? "pulse-once 1.5s ease-in-out infinite" : undefined,
              letterSpacing: "0.05em",
            }}
          >
            {s.name}
          </span>
        );
      })}
    </footer>
  );
}
