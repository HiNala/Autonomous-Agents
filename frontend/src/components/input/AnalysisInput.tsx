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
  const [pasteFlash, setPasteFlash] = useState(false);
  const [iconFlash, setIconFlash] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").trim();
    if (GITHUB_RE.test(pasted)) {
      setPasteFlash(true);
      setIconFlash(true);
      setError(null);
      setTimeout(() => setPasteFlash(false), 800);
      setTimeout(() => setIconFlash(false), 600);
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
      inputRef.current?.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-5px)" },
          { transform: "translateX(5px)" },
          { transform: "translateX(-4px)" },
          { transform: "translateX(4px)" },
          { transform: "translateX(0)" },
        ],
        { duration: 400, easing: "ease-out" }
      );
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

  const inputBorderColor = error
    ? "var(--color-critical-border)"
    : pasteFlash
    ? "var(--color-healthy-border)"
    : "var(--border-default)";

  const inputBoxShadow = error
    ? "0 0 0 3px var(--color-critical-dim)"
    : pasteFlash
    ? "0 0 0 3px var(--color-healthy-dim)"
    : "none";

  return (
    <div
      style={{
        minHeight: "calc(100vh - 96px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-6)",
        position: "relative",
      }}
      className="bg-grid"
    >
      {/* Blue radial atmosphere */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 70% 60% at 50% 45%, rgba(59,130,246,0.05) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "520px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-5)",
        }}
      >
        {/* Hero wordmark */}
        <div style={{ textAlign: "center" }}>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "2.25rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              margin: "0 0 var(--space-2)",
              background: "linear-gradient(135deg, #F4F4F5 0%, #A1A1AA 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            VIBE CHECK
          </h1>
          <p
            style={{
              fontSize: "var(--text-micro)",
              color: "var(--text-tertiary)",
              fontFamily: "var(--font-code)",
              margin: 0,
              letterSpacing: "0.04em",
            }}
          >
            Autonomous agents · Living knowledge graph · Intelligence that compounds
          </p>
        </div>

        {/* Input card — dark glassmorphism */}
        <form
          onSubmit={handleSubmit}
          style={{
            width: "100%",
            background: "rgba(17, 17, 22, 0.72)",
            backdropFilter: "blur(12px) saturate(1.4)",
            WebkitBackdropFilter: "blur(12px) saturate(1.4)",
            border: "1px solid rgba(255, 255, 255, 0.07)",
            borderRadius: "var(--radius-xl)",
            padding: "var(--space-5)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.04) inset, 0 8px 32px rgba(0,0,0,0.48), 0 1px 0 rgba(255,255,255,0.05) inset",
            position: "relative",
          }}
        >
          {/* Top-edge inner glow */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 1,
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 20%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.06) 80%, transparent 100%)",
              borderRadius: "var(--radius-xl) var(--radius-xl) 0 0",
            }}
          />

          <label
            style={{
              fontSize: "var(--text-micro)",
              fontWeight: 600,
              color: "var(--text-tertiary)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontFamily: "var(--font-code)",
            }}
          >
            GitHub Repository URL
          </label>

          {/* URL input with icon prefix */}
          <div style={{ position: "relative" }}>
            <div
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                display: "flex",
                alignItems: "center",
                pointerEvents: "none",
                transition: "color 0.25s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                color: iconFlash ? "var(--color-healthy)" : "var(--text-tertiary)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
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
                height: 52,
                background: "var(--bg-input)",
                border: `1px solid ${inputBorderColor}`,
                borderRadius: "var(--radius-md)",
                padding: "0 16px 0 46px",
                fontFamily: "var(--font-code)",
                fontSize: "var(--text-small)",
                color: "var(--text-primary)",
                outline: "none",
                transition:
                  "border-color 0.2s ease, box-shadow 0.2s ease",
                boxShadow: inputBoxShadow,
                caretColor: "var(--color-accent)",
              }}
              onFocus={(e) => {
                if (!error && !pasteFlash)
                  e.target.style.borderColor = "var(--color-accent-border)";
                if (!error && !pasteFlash)
                  e.target.style.boxShadow = "0 0 0 3px var(--color-accent-dim)";
              }}
              onBlur={(e) => {
                if (!error && !pasteFlash) {
                  e.target.style.borderColor = "var(--border-default)";
                  e.target.style.boxShadow = "none";
                }
              }}
            />
          </div>

          {/* Error message */}
          {error && (
            <p
              style={{
                fontSize: "var(--text-small)",
                color: "var(--color-critical-text)",
                margin: "-var(--space-2) 0 0",
                fontFamily: "var(--font-code)",
                animation: "fade-in 0.2s ease-out",
              }}
            >
              {error}
            </p>
          )}

          {/* Analyze button — 56px, full-width gradient */}
          <button
            type="submit"
            disabled={loading}
            style={{
              height: 56,
              width: "100%",
              padding: "0 24px",
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-body)",
              fontWeight: 600,
              letterSpacing: "0.04em",
              color: "#FFFFFF",
              background: loading
                ? "rgba(29,78,216,0.6)"
                : "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 50%, #1D4ED8 100%)",
              backgroundSize: "200% 100%",
              border: "1px solid rgba(96, 165, 250, 0.4)",
              borderRadius: "var(--radius-lg)",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              position: "relative",
              overflow: "hidden",
              transition: "box-shadow 0.3s ease, transform 0.15s ease",
              boxShadow: "0 0 0 1px rgba(59,130,246,0.2), 0 4px 16px rgba(59,130,246,0.25), 0 1px 0 rgba(255,255,255,0.1) inset",
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                const btn = e.currentTarget;
                btn.style.boxShadow =
                  "0 0 0 1px rgba(59,130,246,0.35), 0 8px 32px rgba(59,130,246,0.45), 0 1px 0 rgba(255,255,255,0.15) inset";
                btn.style.transform = "translateY(-1px)";
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                const btn = e.currentTarget;
                btn.style.boxShadow =
                  "0 0 0 1px rgba(59,130,246,0.2), 0 4px 16px rgba(59,130,246,0.25), 0 1px 0 rgba(255,255,255,0.1) inset";
                btn.style.transform = "translateY(0)";
              }
            }}
            onMouseDown={(e) => {
              const btn = e.currentTarget;
              btn.style.transform = "translateY(0) scale(0.99)";
              btn.style.boxShadow =
                "0 0 0 1px rgba(59,130,246,0.25), 0 2px 8px rgba(59,130,246,0.3)";
            }}
            onMouseUp={(e) => {
              const btn = e.currentTarget;
              btn.style.transform = "translateY(-1px)";
            }}
          >
            {/* Shimmer overlay during loading */}
            {loading && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)",
                  backgroundSize: "200% 100%",
                  animation: "btn-shimmer 1.5s infinite linear",
                }}
              />
            )}
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
                    position: "relative",
                    zIndex: 1,
                  }}
                  className="animate-spin"
                />
                <span style={{ position: "relative", zIndex: 1 }}>Analyzing...</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: "1rem" }}>⚡</span>
                Analyze
              </>
            )}
          </button>
        </form>

        {/* Sub-label */}
        <p
          style={{
            fontSize: "var(--text-micro)",
            color: "var(--text-quaternary)",
            textAlign: "center",
            fontFamily: "var(--font-code)",
            margin: 0,
            letterSpacing: "0.04em",
          }}
        >
          Up to 500 files · Autonomous agents · Real-time progress
        </p>
      </div>
    </div>
  );
}
