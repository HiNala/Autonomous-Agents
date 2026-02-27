"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAnalysisStore } from "@/stores/analysisStore";
import { api } from "@/lib/api";

const GITHUB_RE = /^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+(\/.*)?$/;

export function AnalysisInput() {
  const router = useRouter();
  const { startAnalysis } = useAnalysisStore();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [flashGreen, setFlashGreen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").trim();
    if (GITHUB_RE.test(pasted)) {
      setFlashGreen(true);
      setError(null);
      setTimeout(() => setFlashGreen(false), 600);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUrl(e.target.value);
    if (error) setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!GITHUB_RE.test(trimmed)) {
      setError("Enter a valid GitHub repository URL");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await api.analyze({ repoUrl: trimmed, scope: "full", maxFiles: 500, useSensoIntelligence: true });
      startAnalysis(resp.analysisId);
      router.push(`/analysis/${resp.analysisId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      if (msg.includes("not found")) setError("Repository not found or is private");
      else if (msg.includes("429") || msg.includes("rate")) setError("Too many requests. Try again in a moment.");
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const borderColor = error ? "var(--color-critical)" : flashGreen ? "var(--color-healthy)" : "var(--border-hover)";

  return (
    <div
      style={{
        minHeight: "calc(100vh - 96px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-6)",
      }}
      className="bg-grid"
    >
      {/* Atmospheric overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(59,130,246,0.04) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", width: "100%", maxWidth: "520px", display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-6)" }}>
        {/* Wordmark */}
        <div style={{ textAlign: "center", marginBottom: "var(--space-2)" }}>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "2rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            VIBE CHECK
          </h1>
          <p style={{ fontSize: "var(--text-small)", color: "var(--text-tertiary)", marginTop: "var(--space-2)", fontFamily: "var(--font-code)" }}>
            Autonomous agents. Living knowledge graph. Intelligence that compounds.
          </p>
        </div>

        {/* Input card */}
        <form
          onSubmit={handleSubmit}
          style={{
            width: "100%",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-xl)",
            padding: "var(--space-5)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <label style={{ fontSize: "var(--text-small)", color: "var(--text-secondary)", fontWeight: 500 }}>
            GitHub Repository URL
          </label>

          <div style={{ position: "relative" }}>
            {/* GitHub icon prefix */}
            <div
              style={{
                position: "absolute",
                left: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-tertiary)",
                display: "flex",
                alignItems: "center",
                pointerEvents: "none",
                transition: "transform 0.2s ease",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
              </svg>
            </div>
            <input
              ref={inputRef}
              type="url"
              value={url}
              onChange={handleChange}
              onPaste={handlePaste}
              placeholder="https://github.com/user/repo"
              autoComplete="off"
              style={{
                width: "100%",
                background: "var(--bg-input)",
                border: `1px solid ${borderColor}`,
                borderRadius: "var(--radius-md)",
                padding: "12px 14px 12px 42px",
                fontFamily: "var(--font-code)",
                fontSize: "var(--text-small)",
                color: "var(--text-primary)",
                outline: "none",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                boxShadow: flashGreen ? "var(--shadow-glow-healthy)" : error ? "var(--shadow-glow-critical)" : "none",
              }}
              onFocus={(e) => { if (!error && !flashGreen) e.target.style.borderColor = "var(--color-accent)"; }}
              onBlur={(e) => { if (!error && !flashGreen) e.target.style.borderColor = "var(--border-hover)"; }}
            />
          </div>

          {error && (
            <p style={{ fontSize: "var(--text-small)", color: "var(--color-critical)", margin: "-var(--space-2) 0 0" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? "var(--color-accent-dim)" : "var(--color-accent)",
              color: "white",
              border: "none",
              borderRadius: "var(--radius-md)",
              padding: "12px",
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              fontSize: "var(--text-body)",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "background 0.2s ease, transform 0.1s ease",
            }}
            onMouseEnter={(e) => { if (!loading) (e.target as HTMLButtonElement).style.background = "#2563EB"; }}
            onMouseLeave={(e) => { if (!loading) (e.target as HTMLButtonElement).style.background = "var(--color-accent)"; }}
          >
            {loading ? (
              <>
                <span
                  style={{
                    width: 16,
                    height: 16,
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "white",
                    borderRadius: "50%",
                    display: "inline-block",
                  }}
                  className="animate-spin"
                />
                Analyzing...
              </>
            ) : (
              <>
                <span>⚡</span>
                Analyze
              </>
            )}
          </button>
        </form>

        {/* Footer hint */}
        <p style={{ fontSize: "var(--text-micro)", color: "var(--text-tertiary)", textAlign: "center", fontFamily: "var(--font-code)" }}>
          Up to 500 files · Autonomous agents · Real-time progress
        </p>
      </div>
    </div>
  );
}
