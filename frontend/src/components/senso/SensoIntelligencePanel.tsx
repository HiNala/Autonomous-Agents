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

  const EXAMPLE_QUERIES = [
    "What are the most critical security findings?",
    "Which single fix would eliminate the most chains?",
    "What patterns appear across repos?",
  ];

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      {/* Collapsed header — always visible */}
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--space-4)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <span style={{ fontSize: "1rem" }}>🧠</span>
          <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-small)", fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            INTELLIGENCE
          </span>
          {hasIntelligence && (
            <span style={{ fontSize: "var(--text-micro)", color: "var(--color-accent)", fontFamily: "var(--font-code)" }}>
              · {sensoInsights.length} cross-repo pattern{sensoInsights.length !== 1 ? "s" : ""}
            </span>
          )}
          {sensoSummary && (
            <span style={{ fontSize: "var(--text-micro)", color: "var(--text-tertiary)", fontFamily: "var(--font-code)" }}>
              · {sensoSummary.total} findings indexed
            </span>
          )}
        </div>
        <span style={{ color: "var(--text-tertiary)", fontSize: 12, transition: "transform 0.2s ease", transform: expanded ? "rotate(180deg)" : "none" }}>▾</span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderTop: "1px solid var(--border-default)" }}>

          {/* Cross-repo patterns from WebSocket */}
          {hasIntelligence && (
            <div style={{ padding: "var(--space-4)", borderBottom: "1px solid var(--border-default)" }}>
              <h3 style={sectionTitle}>📊 Patterns Observed</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {sensoInsights.map((ins, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "var(--space-3)",
                      padding: "var(--space-3)",
                      background: "var(--bg-surface-raised)",
                      borderRadius: "var(--radius-md)",
                      fontSize: "var(--text-small)",
                      color: "var(--text-secondary)",
                      lineHeight: 1.5,
                    }}
                  >
                    <span style={{ color: "var(--color-accent)", flexShrink: 0 }}>•</span>
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
          <div style={{ padding: "var(--space-4)" }}>
            <h3 style={sectionTitle}>🔍 Ask Your Knowledge Base</h3>

            <form onSubmit={handleSearch} style={{ display: "flex", gap: "var(--space-2)" }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask anything about this codebase..."
                style={{
                  flex: 1,
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-hover)",
                  borderRadius: "var(--radius-md)",
                  padding: "10px 14px",
                  fontFamily: "var(--font-code)",
                  fontSize: "var(--text-small)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
                onFocus={(e) => { e.target.style.borderColor = "var(--color-accent)"; }}
                onBlur={(e) => { e.target.style.borderColor = "var(--border-hover)"; }}
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                style={{
                  background: loading ? "var(--color-accent-dim)" : "var(--color-accent)",
                  color: "white",
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  padding: "10px 16px",
                  cursor: loading || !query.trim() ? "not-allowed" : "pointer",
                  fontSize: "var(--text-small)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flexShrink: 0,
                }}
              >
                {loading ? (
                  <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", display: "inline-block" }} className="animate-spin" />
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
                      background: "var(--bg-surface-raised)",
                      border: "1px solid var(--border-default)",
                      borderRadius: "var(--radius-full)",
                      padding: "4px 10px",
                      fontSize: "var(--text-micro)",
                      color: "var(--text-tertiary)",
                      cursor: "pointer",
                      fontFamily: "var(--font-code)",
                    }}
                    onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "var(--text-secondary)"; }}
                    onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "var(--text-tertiary)"; }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Search error */}
            {searchError && (
              <div style={{ marginTop: "var(--space-3)", padding: "var(--space-3)", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "var(--radius-md)", fontSize: "var(--text-small)", color: "var(--color-critical)" }}>
                {searchError}
              </div>
            )}

            {/* Search results */}
            {searchResult && (
              <div style={{ marginTop: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }} className="animate-slide-up">
                <div>
                  <h4 style={{ ...sectionTitle, marginBottom: "var(--space-2)" }}>ANSWER</h4>
                  <div style={{ background: "var(--bg-surface-raised)", borderRadius: "var(--radius-md)", padding: "var(--space-4)", fontSize: "var(--text-small)", color: "var(--text-primary)", lineHeight: 1.7 }}>
                    {searchResult.answer}
                  </div>
                </div>

                {searchResult.sources.length > 0 && (
                  <div>
                    <h4 style={{ ...sectionTitle, marginBottom: "var(--space-2)" }}>
                      SOURCES ({searchResult.totalResults} found · {searchResult.processingTimeMs}ms)
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                      {searchResult.sources.map((src, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "var(--space-3)",
                            padding: "var(--space-3)",
                            background: "var(--bg-input)",
                            borderRadius: "var(--radius-md)",
                            border: "1px solid var(--border-default)",
                          }}
                        >
                          <span style={{ fontSize: "var(--text-micro)", fontFamily: "var(--font-code)", color: "var(--color-accent)", flexShrink: 0 }}>
                            {(src.score * 100).toFixed(0)}%
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: "var(--text-small)", color: "var(--text-primary)", fontWeight: 500, marginBottom: 2 }}>{src.title}</div>
                            <div style={{ fontSize: "var(--text-micro)", color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
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
                  style={{ alignSelf: "flex-start", background: "transparent", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", padding: "4px 10px", fontSize: "var(--text-micro)", color: "var(--text-tertiary)", cursor: "pointer" }}
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
  fontSize: "var(--text-small)",
  fontFamily: "var(--font-code)",
  fontWeight: 600,
  color: "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  margin: "0 0 var(--space-3)",
};
