"use client";
import Link from "next/link";
import { useState, useRef, useEffect, useCallback } from "react";
import { useAnalysisStore } from "@/stores/analysisStore";

const STATUS_LABELS: Record<string, string> = {
  queued:     "Queued",
  cloning:    "Cloning",
  mapping:    "Mapping",
  analyzing:  "Analyzing",
  completing: "Completing",
  completed:  "Completed",
  failed:     "Failed",
};

const STATUS_COLORS: Record<string, string> = {
  queued:     "var(--text-tertiary)",
  cloning:    "var(--color-warning-text)",
  mapping:    "var(--agent-mapper)",
  analyzing:  "var(--color-accent-text)",
  completing: "var(--agent-doctor)",
  completed:  "var(--color-healthy-text)",
  failed:     "var(--color-critical-text)",
};

interface IntegrationResult {
  name: string;
  status: "ok" | "error" | "timeout";
  message?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function ApiTestPanel({ onClose }: { onClose: () => void }) {
  const [results, setResults] = useState<IntegrationResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [overall, setOverall] = useState<string | null>(null);

  const runTests = useCallback(async () => {
    setLoading(true);
    setResults(null);
    setOverall(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/health/integrations`);
      const data = await res.json();
      setResults(data.integrations);
      setOverall(data.overall);
    } catch (e) {
      setResults([{ name: "Backend", status: "error", message: e instanceof Error ? e.message : "Connection failed" }]);
      setOverall("unreachable");
    } finally {
      setLoading(false);
    }
  }, []);

  const statusIcon = (s: string) =>
    s === "ok" ? "✓" : s === "timeout" ? "◷" : "✕";
  const statusColor = (s: string) =>
    s === "ok" ? "#22C55E" : s === "timeout" ? "#F59E0B" : "#EF4444";

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        width: 340,
        background: "rgba(17, 17, 19, 0.97)",
        border: "1px solid var(--border-default, #27272A)",
        borderRadius: 10,
        boxShadow: "0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03)",
        backdropFilter: "blur(20px)",
        zIndex: 1000,
        fontFamily: "var(--font-code)",
        overflow: "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: 12, color: "#A1A1AA", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Integration Tests
        </span>
        <button
          onClick={onClose}
          style={{
            background: "none", border: "none", color: "#71717A", cursor: "pointer",
            fontSize: 16, lineHeight: 1, padding: 0,
          }}
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: "12px 16px" }}>
        {!results && !loading && (
          <button
            onClick={runTests}
            style={{
              width: "100%",
              padding: "10px 0",
              background: "rgba(59,130,246,0.12)",
              border: "1px solid rgba(59,130,246,0.25)",
              borderRadius: 7,
              color: "#93C5FD",
              fontSize: 12,
              fontFamily: "var(--font-code)",
              cursor: "pointer",
              letterSpacing: "0.05em",
              transition: "background 0.15s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "rgba(59,130,246,0.22)")}
            onMouseOut={(e) => (e.currentTarget.style.background = "rgba(59,130,246,0.12)")}
          >
            Run All Tests
          </button>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "16px 0", color: "#71717A", fontSize: 12 }}>
            <span style={{ animation: "pulse-once 1s ease-in-out infinite", display: "inline-block" }}>
              Testing integrations...
            </span>
          </div>
        )}

        {results && (
          <>
            {/* Overall badge */}
            <div style={{
              textAlign: "center", marginBottom: 12, fontSize: 11, letterSpacing: "0.06em",
              color: overall === "healthy" ? "#22C55E" : overall === "degraded" ? "#F59E0B" : "#EF4444",
            }}>
              {overall === "healthy" ? "ALL SYSTEMS GO" : overall === "degraded" ? "DEGRADED — SOME SERVICES DOWN" : "BACKEND UNREACHABLE"}
            </div>

            {/* Results list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {results.map((r) => (
                <div
                  key={r.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "7px 10px",
                    borderRadius: 6,
                    background: `${statusColor(r.status)}08`,
                    border: `1px solid ${statusColor(r.status)}18`,
                  }}
                >
                  <span style={{ color: statusColor(r.status), fontSize: 13, fontWeight: 700, width: 16, textAlign: "center" }}>
                    {statusIcon(r.status)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, color: "#E4E4E7", fontWeight: 500 }}>{r.name}</div>
                    {r.message && (
                      <div style={{
                        fontSize: 10, color: "#71717A", marginTop: 1,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {r.message}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Rerun button */}
            <button
              onClick={runTests}
              style={{
                width: "100%", marginTop: 10, padding: "7px 0",
                background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6, color: "#71717A", fontSize: 11,
                fontFamily: "var(--font-code)", cursor: "pointer",
                letterSpacing: "0.05em",
              }}
              onMouseOver={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)")}
              onMouseOut={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
            >
              Re-run
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function Header() {
  const { result, status, analysisId } = useAnalysisStore();
  const isActive = !!analysisId;
  const repoName = result?.repoName;
  const isRunning = ["queued", "cloning", "mapping", "analyzing", "completing"].includes(status);

  const [menuOpen, setMenuOpen] = useState(false);
  const [showApiTest, setShowApiTest] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setShowApiTest(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "56px",
        background: "rgba(7, 7, 12, 0.72)",
        backdropFilter: "blur(20px) saturate(1.8)",
        WebkitBackdropFilter: "blur(20px) saturate(1.8)",
        borderBottom: "1px solid rgba(255,255,255,0.09)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 var(--space-6)",
        zIndex: "var(--z-header)",
      }}
    >
      {/* Wordmark */}
      <Link
        href="/"
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: "0.875rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          textDecoration: "none",
          background: "linear-gradient(135deg, #FFFFFF 0%, #CBD5E1 60%, #93C5FD 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          filter: "drop-shadow(0 0 10px rgba(147,197,253,0.25))",
        }}
      >
        VIBE CHECK
      </Link>

      {/* Center — active analysis chip */}
      {isActive && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-code)",
              fontSize: "var(--text-small)",
              color: "var(--text-secondary)",
              maxWidth: 220,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {repoName ?? analysisId}
          </span>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: "var(--text-micro)",
              color: STATUS_COLORS[status] ?? "var(--text-secondary)",
              fontFamily: "var(--font-code)",
              padding: "3px 10px",
              borderRadius: "var(--radius-full)",
              border: `1px solid ${STATUS_COLORS[status] ?? "var(--border-default)"}`,
              background: `${STATUS_COLORS[status] ?? "transparent"}11`,
              letterSpacing: "0.04em",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: STATUS_COLORS[status] ?? "var(--text-tertiary)",
                flexShrink: 0,
                animation: isRunning ? "pulse-once 1.5s ease-in-out infinite" : undefined,
              }}
            />
            {STATUS_LABELS[status] ?? status}
          </div>
        </div>
      )}

      {/* Right — Senso indicator + Hamburger menu */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Senso indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: "var(--text-micro)",
            color: "var(--text-tertiary)",
            fontFamily: "var(--font-code)",
            letterSpacing: "0.06em",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--agent-senso)",
              boxShadow: "0 0 8px var(--agent-senso)",
              display: "block",
              animation: "pulse-once 2s ease-in-out infinite",
            }}
          />
          Senso
        </div>

        {/* Hamburger menu */}
        <div ref={menuRef} style={{ position: "relative" }}>
          <button
            onClick={() => { setMenuOpen((v) => !v); if (showApiTest) setShowApiTest(false); }}
            aria-label="Menu"
            style={{
              background: "none",
              border: "1px solid transparent",
              borderRadius: 6,
              padding: "6px 5px",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              gap: 3.5,
              transition: "border-color 0.15s",
              borderColor: menuOpen ? "rgba(255,255,255,0.12)" : "transparent",
            }}
            onMouseOver={(e) => { if (!menuOpen) e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
            onMouseOut={(e) => { if (!menuOpen) e.currentTarget.style.borderColor = "transparent"; }}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  display: "block",
                  width: 16,
                  height: 1.5,
                  background: menuOpen ? "#A1A1AA" : "#71717A",
                  borderRadius: 1,
                  transition: "background 0.15s",
                }}
              />
            ))}
          </button>

          {/* Dropdown */}
          {menuOpen && !showApiTest && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                minWidth: 180,
                background: "rgba(17, 17, 19, 0.97)",
                border: "1px solid var(--border-default, #27272A)",
                borderRadius: 8,
                boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
                backdropFilter: "blur(20px)",
                overflow: "hidden",
                zIndex: 1000,
                fontFamily: "var(--font-code)",
              }}
            >
              <button
                onClick={() => setShowApiTest(true)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  background: "none",
                  border: "none",
                  color: "#A1A1AA",
                  fontSize: 12,
                  fontFamily: "var(--font-code)",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  letterSpacing: "0.03em",
                  transition: "background 0.12s, color 0.12s",
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#E4E4E7"; }}
                onMouseOut={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#A1A1AA"; }}
              >
                <span style={{ fontSize: 14 }}>⚡</span>
                Test APIs
              </button>
            </div>
          )}

          {/* API Test Panel */}
          {showApiTest && (
            <ApiTestPanel onClose={() => { setShowApiTest(false); setMenuOpen(false); }} />
          )}
        </div>
      </div>
    </header>
  );
}
