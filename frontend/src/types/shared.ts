// ── VIBE CHECK — Shared TypeScript Types (from contracts.md) ──

export type Severity = "critical" | "warning" | "info";
export type AgentName = "quality" | "pattern" | "security" | "orchestrator" | "doctor" | "senso" | "mapper";
export type GraphViewMode = "structure" | "dependencies" | "vulnerabilities";
export type AnalysisStatus = "queued" | "cloning" | "mapping" | "analyzing" | "completing" | "completed" | "failed";
export type CategoryStatus = "healthy" | "warning" | "critical";
export type LLMProvider = "fastino" | "openai" | "tavily" | "senso" | "yutori";

export interface HealthScore {
  overall: number;
  letterGrade: string;
  breakdown: Record<string, CategoryScore>;
  confidence: number;
}

export interface CategoryScore {
  score: number;
  max: number;
  status: CategoryStatus;
}

export interface Finding {
  id: string;
  type: string;
  severity: Severity;
  agent: AgentName;
  title: string;
  description: string;
  plainDescription: string;
  location: FindingLocation;
  blastRadius: BlastRadius;
  cve?: CVEInfo;
  chainIds: string[];
  fixId?: string;
  sensoContentId?: string;
  confidence: number;
}

export interface FindingLocation {
  files: string[];
  primaryFile: string;
  startLine: number;
  endLine: number;
}

export interface BlastRadius {
  filesAffected: number;
  functionsAffected: number;
  endpointsAffected: number;
}

export interface CVEInfo {
  id: string;
  cvssScore: number;
  exploitAvailable: boolean;
  fixedVersion: string;
}

export interface Fix {
  id: string;
  priority: number;
  title: string;
  severity: Severity;
  type: string;
  estimatedEffort: string;
  chainsResolved: number;
  findingsResolved: string[];
  documentation: FixDocumentation;
  sensoContentId?: string;
  sensoHistoricalContext?: string;
}

export interface FixDocumentation {
  whatsWrong: string;
  affectedCode: AffectedCode[];
  steps: string[];
  beforeCode?: string;
  afterCode?: string;
  migrationGuideUrl?: string;
}

export interface AffectedCode {
  file: string;
  lines: string;
  context: string;
}

export interface FixSummary {
  totalFixes: number;
  criticalFixes: number;
  estimatedTotalEffort: string;
  keystoneFixes: number;
  chainsEliminatedByKeystones: number;
}

export interface VulnerabilityChain {
  id: string;
  severity: "critical" | "high" | "medium";
  description: string;
  steps: ChainStep[];
  blastRadius: { files: number; functions: number; endpoints: number };
  keystoneFix: string;
  findingIds: string[];
}

export interface ChainStep {
  type: "entry" | "flow" | "vulnerability" | "impact";
  node: string;
  file?: string;
  cve?: string;
  description: string;
}

export interface GraphNode {
  id: string;
  type: "file" | "directory" | "function" | "class" | "package" | "endpoint";
  label: string;
  path?: string;
  category?: string;
  language?: string;
  lines?: number;
  severity?: CategoryStatus;
  findingCount: number;
  metadata: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: "contains" | "imports" | "depends_on" | "calls" | "handles";
  isVulnerabilityChain: boolean;
  chainId?: string;
}

export interface AgentStatus {
  name: AgentName;
  status: "pending" | "running" | "complete" | "error";
  progress: number;
  message: string;
  findingsCount?: number;
  durationMs?: number;
  provider?: LLMProvider;
}

export interface DetectedStack {
  languages: string[];
  frameworks: string[];
  packageManager: string;
  buildSystem: string;
}

export interface RepoStats {
  totalFiles: number;
  totalLines: number;
  totalDependencies: number;
  totalDevDependencies: number;
  totalFunctions: number;
  totalEndpoints: number;
}

export interface FindingsSummary {
  critical: number;
  warning: number;
  info: number;
  total: number;
}

export interface AnalysisResult {
  analysisId: string;
  status: AnalysisStatus;
  repoUrl: string;
  repoName: string;
  branch: string;
  detectedStack?: DetectedStack;
  stats?: RepoStats;
  healthScore?: HealthScore;
  findings: FindingsSummary;
  vulnerabilityChains: number;
  fixesGenerated: number;
  timestamps: {
    startedAt: string;
    completedAt: string | null;
    duration: number | null;
  };
}

export interface AnalyzeRequest {
  repoUrl: string;
  branch?: string;
  scope?: "full" | "security-only" | "quality-only";
  maxFiles?: number;
  useSensoIntelligence?: boolean;
}

export interface AnalyzeResponse {
  analysisId: string;
  status: string;
  repoName: string;
  estimatedDuration: number;
  websocketUrl: string;
}

// WebSocket message union
export type WSMessage =
  | WSStatusUpdate
  | WSFinding
  | WSGraphNode
  | WSGraphEdge
  | WSAgentComplete
  | WSSensoIntelligence
  | WSComplete
  | WSError;

export interface WSStatusUpdate {
  type: "status";
  agent: AgentName;
  status: "pending" | "running" | "complete" | "error";
  progress: number;
  message: string;
}

export interface WSFinding {
  type: "finding";
  finding: { id: string; severity: Severity; title: string; agent: AgentName };
}

export interface WSGraphNode { type: "graph_node"; node: GraphNode; }
export interface WSGraphEdge { type: "graph_edge"; edge: GraphEdge; }

export interface WSAgentComplete {
  type: "agent_complete";
  agent: AgentName;
  findingsCount: number;
  durationMs: number;
  provider: LLMProvider;
}

export interface WSSensoIntelligence {
  type: "senso_intelligence";
  insight: string;
  sourceCount: number;
}

export interface WSComplete {
  type: "complete";
  healthScore: HealthScore;
  findingsSummary: FindingsSummary;
  duration: number;
}

export interface WSError {
  type: "error";
  agent?: AgentName;
  message: string;
  recoverable: boolean;
}
