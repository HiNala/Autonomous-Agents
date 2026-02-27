"use client";
import { useAnalysisStore } from "@/stores/analysisStore";
import { agentColor, providerColor, severityColor } from "@/lib/colors";
import type { AgentName, AgentStatus, LLMProvider } from "@/types/shared";

const AGENTS: AgentName[] = ["orchestrator", "mapper", "quality", "pattern", "security", "doctor", "senso"];

const AGENT_LABELS: Record<AgentName, string> = {
  orchestrator: "Orchestrator",
  mapper:       "Mapper",
  quality:      "Quality",
  pattern:      "Pattern",
  security:     "Security",
  doctor:       "Doctor",
  senso:        "Senso",
};

const PROVIDER_LABELS: Record<LLMProvider, string> = {
  fastino: "⚡ Fastino",
  openai:  "🧠 OpenAI",
  tavily:  "🔍 Tavily",
  senso:   "💾 Senso",
  yutori:  "🌐 Yutori",
};

function AgentRow({ agent, status }: { agent: AgentName; status: AgentStatus }) {
  const color = agentColor(agent);
  const isRunning = status.status === "running";
  const isDone    = status.status === "complete";
  const isError   = status.status === "error";
  const isPending = status.status === "pending";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "10px var(--space-4)",
        borderRadius: "var(--radius-md)",
        background: isRunning ? "var(--bg-surface-raised)" : "transparent",
        transition: "background 0.2s ease",
        opacity: isPending ? 0.4 : 1,
      }}
    >
      {/* Status icon */}
      <div style={{ width: 20, display: "flex", justifyContent: "center", flexShrink: 0 }}>
        {isDone  && <span style={{ color: "var(--color-healthy)", fontSize: 14 }}>✓</span>}
        {isError && <span style={{ color: "var(--color-critical)", fontSize: 14 }}>✗</span>}
        {isRunning && (
          <span
            style={{
              width: 12, height: 12, border: "2px solid rgba(255,255,255,0.2)",
              borderTopColor: color, borderRadius: "50%", display: "inline-block",
            }}
            className="animate-spin"
          />
        )}
        {isPending && (
          <span style={{ width: 10, height: 10, borderRadius: "50%", border: "1px solid var(--border-default)", display: "inline-block" }} />
        )}
      </div>

      {/* Agent name */}
      <span
        style={{
          width: 88,
          fontSize: "var(--text-small)",
          fontFamily: "var(--font-code)",
          color: isDone || isRunning ? "var(--text-primary)" : "var(--text-tertiary)",
          flexShrink: 0,
        }}
      >
        {AGENT_LABELS[agent]}
      </span>

      {/* Progress / message */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {isRunning && status.progress > 0 && (
          <div style={{ marginBottom: 4 }}>
            <div style={{ height: 3, borderRadius: 2, background: "var(--bg-surface-raised)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.round(status.progress * 100)}%`,
                  background: color,
                  borderRadius: 2,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        )}
        <span style={{ fontSize: "var(--text-micro)", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>
          {status.message || (isPending ? "Pending" : isDone ? `${status.findingsCount ?? 0} findings` : "")}
        </span>
      </div>

      {/* Provider badge */}
      {isRunning && status.provider && (
        <span
          style={{
            fontSize: "var(--text-micro)",
            fontFamily: "var(--font-code)",
            color: providerColor(status.provider),
            padding: "2px 6px",
            borderRadius: "var(--radius-full)",
            border: `1px solid ${providerColor(status.provider)}`,
            background: "rgba(0,0,0,0.3)",
            flexShrink: 0,
          }}
        >
          {PROVIDER_LABELS[status.provider] ?? status.provider}
        </span>
      )}
      {isDone && status.durationMs && (
        <span style={{ fontSize: "var(--text-micro)", color: "var(--text-tertiary)", fontFamily: "var(--font-code)", flexShrink: 0 }}>
          {(status.durationMs / 1000).toFixed(1)}s
        </span>
      )}
    </div>
  );
}

export function AnalysisProgress() {
  const { agentStatuses, liveFindings, graphNodes } = useAnalysisStore();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "400px 1fr",
        gap: "var(--space-5)",
        padding: "var(--space-6)",
        maxWidth: 1400,
        margin: "0 auto",
      }}
    >
      {/* Left: agent status */}
      <div>
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "var(--space-4) var(--space-4) var(--space-2)", borderBottom: "1px solid var(--border-default)" }}>
            <h2 style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-small)", color: "var(--text-secondary)", margin: 0, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              AGENTS
            </h2>
          </div>
          <div style={{ padding: "var(--space-2) 0" }}>
            {AGENTS.map((agent) => (
              <AgentRow key={agent} agent={agent} status={agentStatuses[agent]} />
            ))}
          </div>

          {/* Graph counter */}
          {graphNodes.length > 0 && (
            <div style={{ padding: "var(--space-3) var(--space-4)", borderTop: "1px solid var(--border-default)", fontSize: "var(--text-micro)", color: "var(--text-tertiary)", fontFamily: "var(--font-code)" }}>
              {graphNodes.length} nodes discovered
            </div>
          )}
        </div>

        {/* Live findings feed */}
        {liveFindings.length > 0 && (
          <div
            style={{
              marginTop: "var(--space-4)",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-lg)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-default)" }}>
              <h2 style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-small)", color: "var(--text-secondary)", margin: 0, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                LIVE FINDINGS
              </h2>
            </div>
            <div style={{ padding: "var(--space-2) 0" }}>
              {liveFindings.slice(-5).reverse().map((f, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    padding: "8px var(--space-4)",
                  }}
                  className="animate-slide-up"
                >
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: severityColor(f.severity), flexShrink: 0 }} />
                  <span style={{ fontSize: "var(--text-micro)", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right: graph placeholder */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 400,
          color: "var(--text-tertiary)",
          gap: "var(--space-3)",
        }}
      >
        {graphNodes.length === 0 ? (
          <>
            <div
              style={{
                width: 48, height: 48, border: "2px solid var(--border-default)",
                borderTopColor: "var(--color-accent)", borderRadius: "50%",
              }}
              className="animate-spin"
            />
            <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-small)" }}>
              Waiting for graph data...
            </span>
          </>
        ) : (
          <>
            <div
              style={{
                width: 40, height: 40, background: "var(--color-accent)",
                borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.2rem",
              }}
            >
              🕸
            </div>
            <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-small)", color: "var(--text-secondary)" }}>
              {graphNodes.length} nodes · Building graph...
            </span>
            <span style={{ fontSize: "var(--text-micro)", color: "var(--text-tertiary)" }}>
              Graph visualization loads after analysis completes
            </span>
          </>
        )}
      </div>
    </div>
  );
}
