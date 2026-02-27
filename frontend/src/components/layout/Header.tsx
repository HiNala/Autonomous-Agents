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
  status: "ok" | "error" | "timeout" | "skipped";
  message?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const statusIcon = (s: string) => s === "ok" ? "✓" : s === "skipped" ? "—" : s === "timeout" ? "◷" : "✕";
const statusColor = (s: string) => s === "ok" ? "#22C55E" : s === "skipped" ? "#52525B" : s === "timeout" ? "#F59E0B" : "#EF4444";

export function Header() {
  const { result, status, analysisId } = useAnalysisStore();
  const isActive = !!analysisId;
  const repoName = result?.repoName;
  const isRunning = ["queued", "cloning", "mapping", "analyzing", "completing"].includes(status);

  const [menuOpen, setMenuOpen] = useState(false);
  const [apiResults, setApiResults] = useState<IntegrationResult[] | null>(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiOverall, setApiOverall] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Clicking "Test APIs" immediately fires the request
  const runApiTest = useCallback(async () => {
    if (apiLoading) return;
    setApiLoading(true);
    setApiResults(null);
    setApiOverall(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/health/integrations`);
      const data = await res.json();
      setApiResults(data.integrations);
      setApiOverall(data.overall);
    } catch (e) {
      setApiResults([{ name: "Backend", status: "error", message: e instanceof Error ? e.message : "Connection failed" }]);
      setApiOverall("unreachable");
    } finally {
      setApiLoading(false);
    }
  }, [apiLoading]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setApiResults(null);
    setApiOverall(null);
    setApiLoading(false);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [closeMenu]);

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

      {/* Right — Hamburger menu */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div ref={menuRef} style={{ position: "relative" }}>
          {/* Hamburger button */}
          <button
            onClick={() => { if (menuOpen) { closeMenu(); } else { setMenuOpen(true); } }}
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
              <span key={i} style={{ display: "block", width: 16, height: 1.5, background: menuOpen ? "#A1A1AA" : "#71717A", borderRadius: 1, transition: "background 0.15s" }} />
            ))}
          </button>

          {/* Dropdown — single panel, results appear inline */}
          {menuOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                width: 300,
                background: "rgba(17, 17, 19, 0.97)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10,
                boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
                backdropFilter: "blur(20px)",
                overflow: "hidden",
                zIndex: 1000,
                fontFamily: "var(--font-code)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* "Test APIs" row — clicking it fires immediately */}
              <button
                onClick={runApiTest}
                disabled={apiLoading}
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  background: "none",
                  border: "none",
                  borderBottom: (apiLoading || apiResults) ? "1px solid rgba(255,255,255,0.06)" : "none",
                  color: apiLoading ? "#52525B" : "#A1A1AA",
                  fontSize: 12,
                  fontFamily: "var(--font-code)",
                  cursor: apiLoading ? "default" : "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  letterSpacing: "0.03em",
                  transition: "background 0.12s, color 0.12s",
                }}
                onMouseOver={(e) => { if (!apiLoading) { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#E4E4E7"; } }}
                onMouseOut={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = apiLoading ? "#52525B" : "#A1A1AA"; }}
              >
                <span style={{ fontSize: 13, opacity: apiLoading ? 0.4 : 1 }}>⚡</span>
                {apiLoading ? "Testing..." : "Test APIs"}
                {apiLoading && (
                  <span style={{ marginLeft: "auto", width: 10, height: 10, border: "1.5px solid rgba(255,255,255,0.15)", borderTopColor: "#93C5FD", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                )}
                {apiOverall && !apiLoading && (
                  <span style={{ marginLeft: "auto", fontSize: 10, color: apiOverall === "healthy" ? "#22C55E" : apiOverall === "degraded" ? "#F59E0B" : "#EF4444", letterSpacing: "0.06em" }}>
                    {apiOverall === "healthy" ? "ALL OK" : apiOverall === "degraded" ? "DEGRADED" : "UNREACHABLE"}
                  </span>
                )}
              </button>

              {/* Results — expand inline */}
              {apiResults && (
                <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
                  {apiResults.map((r) => (
                    <div
                      key={r.name}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "5px 8px",
                        borderRadius: 5,
                        background: `${statusColor(r.status)}08`,
                      }}
                    >
                      <span style={{ color: statusColor(r.status), fontSize: 11, fontWeight: 700, width: 12, textAlign: "center", flexShrink: 0 }}>
                        {statusIcon(r.status)}
                      </span>
                      <span style={{ fontSize: 11, color: "#D4D4D8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.name}
                      </span>
                      {r.message && (
                        <span style={{ fontSize: 9.5, color: "#52525B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>
                          {r.message.replace(/^[A-Za-z]+ (OK — |key configured — )/, "")}
                        </span>
                      )}
                    </div>
                  ))}

                  <button
                    onClick={runApiTest}
                    style={{ marginTop: 4, width: "100%", padding: "5px 0", background: "transparent", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 5, color: "#52525B", fontSize: 10, fontFamily: "var(--font-code)", cursor: "pointer", letterSpacing: "0.05em", transition: "border-color 0.12s, color 0.12s" }}
                    onMouseOver={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "#A1A1AA"; }}
                    onMouseOut={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "#52525B"; }}
                  >
                    re-run
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
