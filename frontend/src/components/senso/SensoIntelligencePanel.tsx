"use client";
import { useState } from "react";
import { useAnalysisStore } from "@/stores/analysisStore";
import { api } from "@/lib/api";

interface SearchResult {
  answer: string;
  sources: Array<{ contentId: string; title: string; score: number; chunkText: string }>;
  processingTimeMs: number;
  totalResults: number;
}

const EXAMPLE_QUERIES = [
  "What are the most critical security findings?",
  "Which single fix eliminates the most chains?",
  "What patterns appear across repos?",
];

const SENSO_PURPLE = "rgba(147, 51, 234, 0.15)";
const SENSO_BORDER = "rgba(147, 51, 234, 0.2)";
const SENSO_ACCENT = "#9333EA";
const SENSO_TEXT   = "#D8B4FE";

export function SensoIntelligencePanel() {
  const { analysisId, result, sensoInsights } = useAnalysisStore();
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const sensoSummary = result?.findings;
  const hasIntelligence = sensoInsights.length > 0;

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || !analysisId) return;
    setLoading(true);
    setSearchError(null);
    setSearchResult(null);
    try {
      const res = await api.sensoSearch(analysisId, query.trim());
      setSearchResult(res as SearchResult);
    } catch (err: unknown) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        background: "rgba(17, 17, 22, 0.72)",
        backdropFilter: "blur(12px) saturate(1.4)",
        WebkitBackdropFilter: "blur(12px) saturate(1.4)",
        border: `1px solid ${SENSO_BORDER}`,
        borderTop: `1px solid rgba(147, 51, 234, 0.25)`,
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        boxShadow: "var(--glow-senso), var(--shadow-panel)",
      }}
    >
      {/* Collapsed bar — always visible */}
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--space-4) var(--space-5)",
          background: expanded ? SENSO_PURPLE : "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          transition: "background 0.2s ease",
        }}
        onMouseEnter={(e) => { if (!expanded) (e.currentTarget as HTMLElement).style.background = "rgba(147, 51, 234, 0.08)"; }}
        onMouseLeave={(e) => { if (!expanded) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          {/* Brain icon with glow */}
          <span
            style={{ fontSize: "1.1rem" }}
            className="animate-brain"
          >
            🧠
          </span>
          <span
            style={{
              fontFamily: "var(--font-code)",
              fontSize: "var(--text-micro)",
              fontWeight: 700,
              color: SENSO_TEXT,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            INTELLIGENCE
          </span>

          {hasIntelligence && (
            <span
              style={{
                fontSize: "var(--text-micro)",
                color: SENSO_TEXT,
                fontFamily: "var(--font-code)",
                opacity: 0.8,
              }}
            >
              · {sensoInsights.length} cross-repo pattern{sensoInsights.length !== 1 ? "s" : ""}
            </span>
          )}
          {sensoSummary && (
            <span
              style={{
                fontSize: "var(--text-micro)",
                color: "var(--text-tertiary)",
                fontFamily: "var(--font-code)",
              }}
            >
              · {sensoSummary.total} findings indexed
            </span>
          )}
        </div>

        <span
          style={{
            color: SENSO_TEXT,
            fontSize: 11,
            transition: "transform 0.2s ease",
            transform: expanded ? "rotate(180deg)" : "none",
            display: "inline-block",
            opacity: 0.7,
          }}
        >
          ▾
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div
          style={{
            borderTop: `1px solid ${SENSO_BORDER}`,
            animation: "slide-up 0.2s ease-out",
          }}
        >
          {/* Cross-repo patterns */}
          {hasIntelligence && (
            <div style={{ padding: "var(--space-4) var(--space-5)", borderBottom: `1px solid ${SENSO_BORDER}` }}>
              <h3 style={sectionTitle}>Patterns Observed</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {sensoInsights.map((ins, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "var(--space-3)",
                      padding: "var(--space-3) var(--space-4)",
                      background: SENSO_PURPLE,
                      border: `1px solid ${SENSO_BORDER}`,
                      borderRadius: "var(--radius-md)",
                      fontSize: "var(--text-small)",
                      color: "var(--text-secondary)",
                      lineHeight: 1.55,
                    }}
                  >
                    <span style={{ color: SENSO_TEXT, flexShrink: 0, marginTop: 2 }}>•</span>
                    <div>
                      <span>{ins.insight}</span>
                      {ins.sourceCount > 0 && (
                        <span style={{ marginLeft: 8, fontSize: "var(--text-micro)", color: "var(--text-tertiary)", fontFamily: "var(--font-code)" }}>
                          ({ins.sourceCount} sources)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ask anything */}
          <div style={{ padding: "var(--space-4) var(--space-5)" }}>
            <h3 style={sectionTitle}>Ask Your Knowledge Base</h3>

            <form onSubmit={handleSearch} style={{ display: "flex", gap: "var(--space-2)" }}>
              {/* Query input — purple theme */}
              <div style={{ flex: 1, position: "relative" }}>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask anything about this codebase..."
                  style={{
                    width: "100%",
                    height: 44,
                    background: "rgba(147, 51, 234, 0.08)",
                    border: `1px solid ${SENSO_BORDER}`,
                    borderRadius: "var(--radius-md)",
                    padding: "0 16px",
                    fontFamily: "var(--font-code)",
                    fontSize: "var(--text-small)",
                    color: "var(--text-primary)",
                    outline: "none",
                    caretColor: SENSO_ACCENT,
                    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "rgba(147, 51, 234, 0.5)";
                    e.target.style.boxShadow = "0 0 0 3px rgba(147, 51, 234, 0.12)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = SENSO_BORDER;
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>

              {/* Submit button — purple */}
              <button
                type="submit"
                disabled={loading || !query.trim()}
                style={{
                  width: 44,
                  height: 44,
                  background: loading || !query.trim() ? "rgba(147, 51, 234, 0.1)" : "rgba(147, 51, 234, 0.2)",
                  border: `1px solid ${loading || !query.trim() ? "rgba(147, 51, 234, 0.15)" : "rgba(147, 51, 234, 0.4)"}`,
                  borderRadius: "var(--radius-md)",
                  color: loading || !query.trim() ? "rgba(216, 180, 254, 0.4)" : SENSO_TEXT,
                  cursor: loading || !query.trim() ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "all 0.2s ease",
                  fontSize: "var(--text-body)",
                }}
                onMouseEnter={(e) => {
                  if (!loading && query.trim()) {
                    (e.currentTarget as HTMLElement).style.background = "rgba(147, 51, 234, 0.3)";
                    (e.currentTarget as HTMLElement).style.transform = "scale(1.05)";
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(147, 51, 234, 0.2)";
                  (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                }}
              >
                {loading ? (
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      border: "2px solid rgba(216,180,254,0.3)",
                      borderTopColor: SENSO_TEXT,
                      borderRadius: "50%",
                      display: "inline-block",
                    }}
                    className="animate-spin"
                  />
                ) : "→"}
              </button>
            </form>

            {/* Example queries */}
            {!searchResult && !loading && (
              <div style={{ marginTop: "var(--space-3)", display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                {EXAMPLE_QUERIES.map((q) => (
                  <button
                    key={q}
                    onClick={() => setQuery(q)}
                    style={{
                      background: SENSO_PURPLE,
                      border: `1px solid ${SENSO_BORDER}`,
                      borderRadius: "var(--radius-full)",
                      padding: "4px 11px",
                      fontSize: "var(--text-micro)",
                      color: "var(--text-tertiary)",
                      cursor: "pointer",
                      fontFamily: "var(--font-code)",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(147, 51, 234, 0.35)";
                      (e.currentTarget as HTMLElement).style.color = SENSO_TEXT;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = SENSO_BORDER;
                      (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)";
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Error */}
            {searchError && (
              <div
                style={{
                  marginTop: "var(--space-3)",
                  padding: "var(--space-3)",
                  background: "var(--color-critical-dim)",
                  border: "1px solid var(--color-critical-border)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "var(--text-small)",
                  color: "var(--color-critical-text)",
                }}
              >
                {searchError}
              </div>
            )}

            {/* Answer */}
            {searchResult && (
              <div
                style={{
                  marginTop: "var(--space-4)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-4)",
                  animation: "fade-in 0.4s ease-out",
                }}
              >
                {/* Answer card */}
                <div
                  style={{
                    padding: "var(--space-4)",
                    background: SENSO_PURPLE,
                    border: `1px solid ${SENSO_BORDER}`,
                    borderLeft: `3px solid ${SENSO_ACCENT}`,
                    borderRadius: "var(--radius-md)",
                    fontSize: "var(--text-small)",
                    color: "var(--text-primary)",
                    lineHeight: 1.7,
                  }}
                >
                  <div
                    style={{
                      fontSize: "var(--text-micro)",
                      fontWeight: 600,
                      color: SENSO_TEXT,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      fontFamily: "var(--font-code)",
                      marginBottom: "var(--space-2)",
                    }}
                  >
                    Answer
                  </div>
                  {searchResult.answer}
                </div>

                {/* Sources */}
                {searchResult.sources.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: "var(--text-micro)",
                        fontWeight: 600,
                        color: "var(--text-tertiary)",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        fontFamily: "var(--font-code)",
                        marginBottom: "var(--space-2)",
                      }}
                    >
                      Sources ({searchResult.totalResults} found · {searchResult.processingTimeMs}ms)
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                      {searchResult.sources.map((src, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "var(--space-3)",
                            padding: "var(--space-3) var(--space-4)",
                            background: "rgba(9, 9, 11, 0.6)",
                            borderRadius: "var(--radius-md)",
                            border: "1px solid var(--border-subtle)",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "var(--text-micro)",
                              fontFamily: "var(--font-code)",
                              color: SENSO_TEXT,
                              flexShrink: 0,
                              fontWeight: 600,
                            }}
                          >
                            {(src.score * 100).toFixed(0)}%
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: "var(--text-small)", color: "var(--text-primary)", fontWeight: 500, marginBottom: 3 }}>
                              {src.title}
                            </div>
                            <div
                              style={{
                                fontSize: "var(--text-micro)",
                                color: "var(--text-tertiary)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                lineHeight: 1.5,
                              }}
                            >
                              {src.chunkText}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => { setSearchResult(null); setQuery(""); }}
                  style={{
                    alignSelf: "flex-start",
                    background: "transparent",
                    border: `1px solid ${SENSO_BORDER}`,
                    borderRadius: "var(--radius-sm)",
                    padding: "4px 10px",
                    fontSize: "var(--text-micro)",
                    color: "var(--text-tertiary)",
                    cursor: "pointer",
                    fontFamily: "var(--font-code)",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = SENSO_TEXT; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)"; }}
                >
                  ✕ Clear
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const sectionTitle: React.CSSProperties = {
  fontSize: "var(--text-micro)",
  fontFamily: "var(--font-code)",
  fontWeight: 600,
  color: "#D8B4FE",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  margin: "0 0 var(--space-3)",
};
