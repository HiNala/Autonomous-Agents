import type { Severity, CategoryStatus, LLMProvider, AgentName } from "@/types/shared";

export function severityColor(severity: Severity | CategoryStatus | undefined): string {
  switch (severity) {
    case "critical": return "var(--color-critical)";
    case "warning":  return "var(--color-warning)";
    case "info":
    case "healthy":  return "var(--color-healthy)";
    default:         return "var(--text-tertiary)";
  }
}

export function severityBg(severity: Severity | undefined): string {
  switch (severity) {
    case "critical": return "rgba(239,68,68,0.1)";
    case "warning":  return "rgba(245,158,11,0.1)";
    case "info":     return "rgba(59,130,246,0.1)";
    default:         return "transparent";
  }
}

export function gradeColor(letterGrade: string): string {
  const first = letterGrade[0]?.toUpperCase();
  if (first === "A") return "var(--color-healthy)";
  if (first === "B") return "var(--color-warning)";
  return "var(--color-critical)";
}

export function scoreToGrade(score: number): string {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 60) return "D";
  return "F";
}

export function providerColor(provider: LLMProvider): string {
  switch (provider) {
    case "fastino": return "#F59E0B";
    case "openai":  return "#22C55E";
    case "tavily":  return "#3B82F6";
    case "yutori":  return "#EC4899";
    default:        return "var(--text-secondary)";
  }
}

export function agentColor(agent: AgentName): string {
  switch (agent) {
    case "orchestrator": return "var(--agent-orchestrator)";
    case "mapper":       return "var(--agent-mapper)";
    case "quality":      return "var(--agent-quality)";
    case "pattern":      return "var(--agent-pattern)";
    case "security":     return "var(--agent-security)";
    case "doctor":       return "var(--agent-doctor)";
    default:             return "var(--text-secondary)";
  }
}
