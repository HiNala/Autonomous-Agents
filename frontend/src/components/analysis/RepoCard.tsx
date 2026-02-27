"use client";
import { useAnalysisStore } from "@/stores/analysisStore";
import { gradeColor } from "@/lib/colors";

const LANG_COLORS: Record<string, string> = {
  TypeScript:  "#3178C6",
  JavaScript:  "#F7DF1E",
  Python:      "#3572A5",
  Go:          "#00ADD8",
  Rust:        "#DEA584",
  Java:        "#B07219",
  Ruby:        "#701516",
  PHP:         "#4F5D95",
  "C#":        "#178600",
  "C++":       "#F34B7D",
  Swift:       "#FA7343",
  Kotlin:      "#A97BFF",
};

function LangPill({ lang }: { lang: string }) {
  const color = LANG_COLORS[lang] ?? "var(--text-tertiary)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: "var(--text-micro)",
        color: "var(--text-secondary)",
        fontFamily: "var(--font-code)",
        padding: "2px 8px",
        borderRadius: "var(--radius-full)",
        background: "var(--bg-surface-raised)",
        border: "1px solid var(--border-default)",
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
      {lang}
    </span>
  );
}

function StatChip({ icon, value, label }: { icon: string; value: number | string; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
      <span style={{ fontSize: "var(--text-micro)", color: "var(--text-tertiary)", fontFamily: "var(--font-code)", letterSpacing: "0.06em" }}>
        {icon} {label}
      </span>
      <span style={{ fontFamily: "var(--font-code)", fontWeight: 700, fontSize: "var(--text-small)", color: "var(--text-primary)" }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
    </div>
  );
}

export function RepoCard() {
  const { result } = useAnalysisStore();
  if (!result) return null;

  const hs     = result.healthScore;
  const stack  = result.detectedStack;
  const stats  = result.stats;
  const color  = hs ? gradeColor(hs.letterGrade) : "var(--text-tertiary)";
  const repoUrl = result.repoUrl;

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-5)",
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--space-5)",
        flexWrap: "wrap",
      }}
    >
      {/* Left — repo name & URL */}
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-2)" }}>
          {/* GitHub icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--text-tertiary)">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
          </svg>
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: "var(--font-code)",
              fontSize: "var(--text-body)",
              fontWeight: 700,
              color: "var(--text-primary)",
              textDecoration: "none",
              letterSpacing: "-0.01em",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-accent-text)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
          >
            {result.repoName}
          </a>
          <span style={{ fontSize: "var(--text-micro)", color: "var(--text-tertiary)", fontFamily: "var(--font-code)" }}>
            {result.branch}
          </span>
        </div>

        {/* Language pills */}
        {stack?.languages && stack.languages.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
            {stack.languages.slice(0, 5).map((lang) => (
              <LangPill key={lang} lang={lang} />
            ))}
            {stack.frameworks && stack.frameworks.slice(0, 3).map((fw) => (
              <span
                key={fw}
                style={{ fontSize: "var(--text-micro)", color: "var(--text-tertiary)", fontFamily: "var(--font-code)", padding: "2px 8px", borderRadius: "var(--radius-full)", background: "var(--bg-surface-raised)", border: "1px solid var(--border-default)" }}
              >
                {fw}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Center — stats */}
      {stats && (
        <div
          style={{
            display: "flex",
            gap: "var(--space-6)",
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          <StatChip icon="📄" value={stats.totalFiles}        label="Files"     />
          <StatChip icon="📝" value={stats.totalLines}        label="Lines"     />
          <StatChip icon="⚙" value={stats.totalFunctions}    label="Functions" />
          <StatChip icon="📦" value={stats.totalDependencies} label="Packages"  />
          {stats.totalEndpoints > 0 && (
            <StatChip icon="🔌" value={stats.totalEndpoints}  label="Endpoints" />
          )}
        </div>
      )}

      {/* Right — grade badge */}
      {hs && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            padding: "var(--space-3) var(--space-4)",
            borderRadius: "var(--radius-lg)",
            border: `1px solid ${color}33`,
            background: `${color}0D`,
          }}
        >
          <div style={{ fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 700, color, lineHeight: 1 }}>
            {hs.letterGrade}
          </div>
          <div>
            <div style={{ fontSize: "var(--text-micro)", color: "var(--text-tertiary)", fontFamily: "var(--font-code)" }}>Health Score</div>
            <div style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-small)", fontWeight: 700, color: "var(--text-primary)" }}>
              {hs.overall} / 100
            </div>
          </div>
        </div>
      )}

      {/* Timestamps */}
      {result.timestamps?.completedAt && (
        <div style={{ width: "100%", display: "flex", gap: "var(--space-5)", fontSize: "var(--text-micro)", color: "var(--text-tertiary)", fontFamily: "var(--font-code)", borderTop: "1px solid var(--border-default)", paddingTop: "var(--space-3)", marginTop: "var(--space-2)" }}>
          {result.timestamps.startedAt && (
            <span>Started: {new Date(result.timestamps.startedAt).toLocaleString()}</span>
          )}
          <span>Completed: {new Date(result.timestamps.completedAt).toLocaleString()}</span>
          {result.timestamps.duration && (
            <span>Duration: {(result.timestamps.duration / 1000).toFixed(1)}s</span>
          )}
          <span style={{ marginLeft: "auto" }}>
            {result.findings.total} findings · {result.vulnerabilityChains} chains · {result.fixesGenerated} fixes
          </span>
        </div>
      )}
    </div>
  );
}
