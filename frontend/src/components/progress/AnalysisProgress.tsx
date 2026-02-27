"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useAnalysisStore } from "@/stores/analysisStore";
import { agentColor, providerColor, severityColor } from "@/lib/colors";
import type { AgentName, AgentStatus, LLMProvider } from "@/types/shared";

// Lazy-load Cytoscape for live graph during scan
const GraphCanvas = dynamic(
  () => import("@/components/graph/GraphCanvas").then((m) => m.GraphCanvas),
  { ssr: false }
);

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
  openai:  "OpenAI",
  tavily:  "Tavily",
  senso:   "Senso",
  yutori:  "Yutori",
};

// ── Fastino Speed Toast ──────────────────────────────────────
interface ToastItem {
  id: string;
  message: string;
}

function FastinoToastSystem({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: "60px",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        zIndex: 500,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            background: "rgba(245, 158, 11, 0.12)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            borderRadius: "var(--radius-md)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            fontSize: "var(--text-micro)",
            color: "#FF9870",
            fontFamily: "var(--font-code)",
            whiteSpace: "nowrap",
            animation: "slide-up 0.2s ease-out",
            boxShadow: "0 4px 16px rgba(245,158,11,0.15)",
          }}
        >
          <span>⚡</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

// ── Agent Row ────────────────────────────────────────────────
function AgentRow({ agent, status, index }: { agent: AgentName; status: AgentStatus; index: number }) {
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
        background: isRunning ? "rgba(255,255,255,0.04)" : "transparent",
        transition: "background 0.2s ease",
        opacity: isPending ? 0.38 : 1,
        animation: `slide-up 0.3s ease-out ${index * 80}ms both`,
      }}
    >
      {/* Status icon */}
      <div style={{ width: 20, display: "flex", justifyContent: "center", flexShrink: 0 }}>
        {isDone && (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6.5" stroke="var(--color-healthy)" strokeWidth="1"/>
            <path d="M4 7l2 2 4-4" stroke="var(--color-healthy)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
        {isError && (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6.5" stroke="var(--color-critical)" strokeWidth="1"/>
            <path d="M5 5l4 4M9 5l-4 4" stroke="var(--color-critical)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        )}
        {isRunning && (
          <span
            style={{
              width: 12, height: 12,
              border: "2px solid rgba(255,255,255,0.15)",
              borderTopColor: color,
              borderRadius: "50%",
              display: "inline-block",
              position: "relative",
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
          width: 90,
          fontSize: "var(--text-small)",
          fontFamily: "var(--font-code)",
          color: isDone || isRunning ? "var(--text-primary)" : "var(--text-quaternary)",
          flexShrink: 0,
          letterSpacing: "0.02em",
        }}
      >
        {AGENT_LABELS[agent]}
      </span>

      {/* Progress + message */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {isRunning && status.progress > 0 && (
          <div style={{ marginBottom: 4 }}>
            <div
              style={{
                height: 3,
                borderRadius: 2,
                background: "rgba(255,255,255,0.06)",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.round(status.progress * 100)}%`,
                  background: color,
                  borderRadius: 2,
                  transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: "-100%",
                    width: "60%",
                    height: "100%",
                    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)",
                    animation: "bar-shimmer 1.2s infinite linear",
                  }}
                />
              </div>
            </div>
          </div>
        )}
        <span
          style={{
            fontSize: "var(--text-micro)",
            color: isDone ? "var(--text-tertiary)" : "var(--text-secondary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "block",
          }}
        >
          {status.message || (isPending ? "Waiting..." : isDone ? `${status.findingsCount ?? 0} findings` : "")}
        </span>
      </div>

      {/* Provider badge */}
      {isRunning && status.provider && (
        <span
          style={{
            fontSize: "var(--text-micro)",
            fontFamily: "var(--font-code)",
            color: providerColor(status.provider),
            padding: "2px 7px",
            borderRadius: "var(--radius-full)",
            border: `1px solid ${providerColor(status.provider)}44`,
            background: `${providerColor(status.provider)}11`,
            flexShrink: 0,
          }}
        >
          {PROVIDER_LABELS[status.provider as LLMProvider] ?? status.provider}
        </span>
      )}

      {/* Duration */}
      {isDone && status.durationMs && (
        <span style={{ fontSize: "var(--text-micro)", color: "var(--text-tertiary)", fontFamily: "var(--font-code)", flexShrink: 0 }}>
          {(status.durationMs / 1000).toFixed(1)}s
        </span>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────
export function AnalysisProgress() {
  const { agentStatuses, liveFindings, graphNodes, graphEdges } = useAnalysisStore();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Show Fastino toast when mapper or pattern agents complete
  useEffect(() => {
    const mapper = agentStatuses.mapper;
    const mapperDone = mapper.status === "complete" && mapper.durationMs;
    if (mapperDone && mapper.provider === "fastino") {
      const id = `fastino-${Date.now()}`;
      const msg = `Fastino: ${graphNodes.length} nodes classified in ${mapper.durationMs}ms`;
      setToasts((t) => [...t, { id, message: msg }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
    }
  }, [agentStatuses.mapper.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasGraph = graphNodes.length > 0;

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "380px 1fr",
          gap: "var(--space-5)",
          padding: "var(--space-6)",
          maxWidth: 1400,
          margin: "0 auto",
        }}
      >
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {/* Agent status card */}
          <div
            style={{
              background: "rgba(17, 17, 22, 0.72)",
              backdropFilter: "blur(12px) saturate(1.4)",
              WebkitBackdropFilter: "blur(12px) saturate(1.4)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-lg)",
              overflow: "hidden",
              boxShadow: "var(--shadow-panel)",
            }}
          >
            <div
              style={{
                padding: "12px var(--space-4)",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h2
                style={{
                  fontFamily: "var(--font-code)",
                  fontSize: "var(--text-micro)",
                  color: "var(--text-tertiary)",
                  margin: 0,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                AGENTS
              </h2>
              {/* Running indicator */}
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "var(--text-micro)", color: "var(--text-tertiary)", fontFamily: "var(--font-code)" }}>
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "var(--color-accent)",
                    animation: "pulse-once 1s ease-in-out infinite",
                  }}
                />
                Running
              </div>
            </div>
            <div style={{ padding: "var(--space-2) 0" }}>
              {AGENTS.map((agent, i) => (
                <AgentRow key={agent} agent={agent} status={agentStatuses[agent]} index={i} />
              ))}
            </div>
            {hasGraph && (
              <div
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  borderTop: "1px solid var(--border-subtle)",
                  fontSize: "var(--text-micro)",
                  color: "var(--text-quaternary)",
                  fontFamily: "var(--font-code)",
                  letterSpacing: "0.06em",
                }}
              >
                <span style={{ color: "var(--text-tertiary)" }}>{graphNodes.length}</span> nodes · <span style={{ color: "var(--text-tertiary)" }}>{graphEdges.length}</span> edges discovered
              </div>
            )}
          </div>

          {/* Live findings feed */}
          {liveFindings.length > 0 && (
            <div
              style={{
                background: "rgba(17, 17, 22, 0.72)",
                backdropFilter: "blur(12px) saturate(1.4)",
                WebkitBackdropFilter: "blur(12px) saturate(1.4)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-lg)",
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "12px var(--space-4)", borderBottom: "1px solid var(--border-subtle)" }}>
                <h2 style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-micro)", color: "var(--text-tertiary)", margin: 0, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
                  LIVE FINDINGS
                </h2>
              </div>
              <div style={{ padding: "var(--space-2) 0" }}>
                {liveFindings.slice(-5).reverse().map((f, i) => (
                  <div
                    key={f.id ?? i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-3)",
                      padding: "8px var(--space-4)",
                      borderLeft: f.severity === "critical" ? "3px solid var(--color-critical)" : "3px solid transparent",
                      animation: "slide-up 0.25s ease-out",
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: severityColor(f.severity),
                        flexShrink: 0,
                        boxShadow: f.severity === "critical" ? "0 0 8px var(--color-critical-glow)" : undefined,
                      }}
                    />
                    <span
                      style={{
                        fontSize: "var(--text-micro)",
                        color: f.severity === "critical" ? "var(--color-critical-text)" : "var(--text-secondary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {f.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column — LIVE CYTOSCAPE GRAPH */}
        <div
          style={{
            background: "rgba(17, 17, 22, 0.72)",
            backdropFilter: "blur(12px) saturate(1.4)",
            WebkitBackdropFilter: "blur(12px) saturate(1.4)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            minHeight: 440,
            boxShadow: "var(--shadow-panel)",
          }}
        >
          {/* Live graph header */}
          <div
            style={{
              padding: "12px var(--space-4)",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h2 style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-micro)", color: "var(--text-tertiary)", margin: 0, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
              KNOWLEDGE GRAPH
            </h2>
            {hasGraph && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "var(--text-micro)", fontFamily: "var(--font-code)", color: "var(--color-accent-text)" }}>
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "var(--color-accent)",
                    animation: "pulse-once 1s ease-in-out infinite",
                  }}
                />
                Building live
              </div>
            )}
          </div>

          {/* Canvas */}
          <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
            {!hasGraph ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "var(--space-3)",
                  color: "var(--text-tertiary)",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    border: "2px solid var(--border-default)",
                    borderTopColor: "var(--color-accent)",
                    borderRadius: "50%",
                  }}
                  className="animate-spin"
                />
                <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-small)", letterSpacing: "0.04em" }}>
                  Waiting for graph data...
                </span>
              </div>
            ) : (
              <GraphCanvas
                nodes={graphNodes}
                edges={graphEdges}
                view="structure"
                selectedNodeId={null}
                highlightedChainId={null}
                onNodeClick={() => {}}
              />
            )}
          </div>
        </div>
      </div>

      {/* Fastino speed toasts */}
      <FastinoToastSystem toasts={toasts} />
    </>
  );
}
