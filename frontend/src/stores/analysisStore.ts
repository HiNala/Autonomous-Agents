"use client";
import { create } from "zustand";
import type {
  AnalysisStatus,
  AnalysisResult,
  AgentName,
  AgentStatus,
  GraphNode,
  GraphEdge,
  GraphViewMode,
  Finding,
  Fix,
  FixSummary,
  VulnerabilityChain,
  Severity,
  HealthScore,
  FindingsSummary,
} from "@/types/shared";

export interface ActivityLogEntry {
  id: string;
  agent: string;
  message: string;
  provider: string;
  timestamp: string;
}

interface AnalysisStore {
  analysisId: string | null;
  status: AnalysisStatus;
  result: AnalysisResult | null;
  agentStatuses: Record<AgentName, AgentStatus>;
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  currentGraphView: GraphViewMode;
  selectedNodeId: string | null;
  highlightedChainId: string | null;
  findings: Finding[];
  liveFindings: Array<{ id: string; severity: Severity; title: string; agent: AgentName }>;
  activityLog: ActivityLogEntry[];
  findingFilters: { severity?: Severity; agent?: AgentName; category?: string };
  selectedFindingId: string | null;
  fixes: Fix[];
  fixSummary: FixSummary | null;
  chains: VulnerabilityChain[];
  errorMessage: string | null;

  // Actions
  startAnalysis: (id: string) => void;
  updateAgentStatus: (agent: AgentName, status: AgentStatus) => void;
  addGraphNode: (node: GraphNode) => void;
  addGraphEdge: (edge: GraphEdge) => void;
  addLiveFinding: (finding: { id: string; severity: Severity; title: string; agent: AgentName }) => void;
  addActivity: (entry: ActivityLogEntry) => void;
  setComplete: (healthScore: HealthScore, findingsSummary: FindingsSummary, duration: number) => void;
  setFailed: (message: string) => void;
  setResult: (result: AnalysisResult) => void;
  setFindings: (findings: Finding[]) => void;
  setFixes: (fixes: Fix[], summary: FixSummary) => void;
  setChains: (chains: VulnerabilityChain[]) => void;
  setGraphData: (nodes: GraphNode[], edges: GraphEdge[]) => void;
  setFindingFilter: (filter: Partial<{ severity?: Severity; agent?: AgentName; category?: string }>) => void;
  setGraphView: (view: GraphViewMode) => void;
  selectNode: (nodeId: string | null) => void;
  selectFinding: (findingId: string | null) => void;
  highlightChain: (chainId: string | null) => void;
  setStatus: (status: AnalysisStatus) => void;
  reset: () => void;
}

const defaultAgentStatuses = (): Record<AgentName, AgentStatus> =>
  Object.fromEntries(
    (["orchestrator", "mapper", "quality", "pattern", "security", "doctor"] as AgentName[]).map(
      (name) => [name, { name, status: "pending", progress: 0, message: "" }]
    )
  ) as Record<AgentName, AgentStatus>;

export const useAnalysisStore = create<AnalysisStore>((set) => ({
  analysisId: null,
  status: "idle",
  result: null,
  agentStatuses: defaultAgentStatuses(),
  graphNodes: [],
  graphEdges: [],
  currentGraphView: "structure",
  selectedNodeId: null,
  highlightedChainId: null,
  findings: [],
  liveFindings: [],
  activityLog: [],
  findingFilters: {},
  selectedFindingId: null,
  fixes: [],
  fixSummary: null,
  chains: [],
  errorMessage: null,

  startAnalysis: (id) => set({ analysisId: id, status: "idle", graphNodes: [], graphEdges: [], liveFindings: [], activityLog: [], agentStatuses: defaultAgentStatuses(), errorMessage: null }),

  updateAgentStatus: (agent, status) =>
    set((s) => ({ agentStatuses: { ...s.agentStatuses, [agent]: status } })),

  addGraphNode: (node) => set((s) => ({ graphNodes: [...s.graphNodes, node] })),
  addGraphEdge: (edge) => set((s) => ({ graphEdges: [...s.graphEdges, edge] })),

  addLiveFinding: (finding) =>
    set((s) => ({ liveFindings: [...s.liveFindings.slice(-20), finding] })),

  addActivity: (entry) =>
    set((s) => ({ activityLog: [...s.activityLog.slice(-50), entry] })),

  setComplete: (healthScore, findingsSummary, duration) =>
    set((s) => ({
      status: "completed",
      result: s.result
        ? { ...s.result, status: "completed" as AnalysisStatus, healthScore, findings: findingsSummary, timestamps: { ...s.result.timestamps, completedAt: new Date().toISOString(), duration } }
        : {
            analysisId: s.analysisId ?? "",
            status: "completed" as AnalysisStatus,
            repoUrl: "",
            repoName: "",
            branch: "main",
            healthScore,
            findings: findingsSummary,
            vulnerabilityChains: 0,
            fixesGenerated: 0,
            timestamps: { startedAt: "", completedAt: new Date().toISOString(), duration },
          },
    })),

  setFailed: (message) => set({ status: "failed", errorMessage: message }),

  setResult: (result) => set((s) => {
    const mergedResult = s.result?.healthScore && !result.healthScore
      ? { ...result, healthScore: s.result.healthScore }
      : result;
    const newStatus = (s.status === "completed" || s.status === "failed")
      ? s.status
      : result.status;
    return { result: mergedResult, status: newStatus };
  }),

  setFindings: (findings) => set({ findings }),
  setFixes: (fixes, fixSummary) => set({ fixes, fixSummary }),
  setChains: (chains) => set({ chains }),
  setGraphData: (nodes, edges) => set({ graphNodes: nodes, graphEdges: edges }),

  setFindingFilter: (filter) => set((s) => ({ findingFilters: { ...s.findingFilters, ...filter } })),
  setGraphView: (view) => set({ currentGraphView: view }),
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
  selectFinding: (findingId) => set({ selectedFindingId: findingId }),
  highlightChain: (chainId) => set({ highlightedChainId: chainId }),
  setStatus: (status) => set({ status }),

  reset: () => set({
    analysisId: null, status: "idle", result: null,
    agentStatuses: defaultAgentStatuses(),
    graphNodes: [], graphEdges: [], liveFindings: [], activityLog: [],
    findings: [], fixes: [], fixSummary: null, chains: [],
    errorMessage: null,
    selectedNodeId: null, selectedFindingId: null, highlightedChainId: null,
  }),
}));
