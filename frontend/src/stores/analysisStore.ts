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

interface SensoInsight {
  insight: string;
  sourceCount: number;
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
  findingFilters: { severity?: Severity; agent?: AgentName };
  selectedFindingId: string | null;
  fixes: Fix[];
  fixSummary: FixSummary | null;
  chains: VulnerabilityChain[];
  sensoInsights: SensoInsight[];
  errorMessage: string | null;

  // Actions
  startAnalysis: (id: string) => void;
  updateAgentStatus: (agent: AgentName, status: AgentStatus) => void;
  addGraphNode: (node: GraphNode) => void;
  addGraphEdge: (edge: GraphEdge) => void;
  addLiveFinding: (finding: { id: string; severity: Severity; title: string; agent: AgentName }) => void;
  addSensoInsight: (insight: string, sourceCount: number) => void;
  setComplete: (healthScore: HealthScore, findingsSummary: FindingsSummary, duration: number) => void;
  setFailed: (message: string) => void;
  setResult: (result: AnalysisResult) => void;
  setFindings: (findings: Finding[]) => void;
  setFixes: (fixes: Fix[], summary: FixSummary) => void;
  setChains: (chains: VulnerabilityChain[]) => void;
  setGraphView: (view: GraphViewMode) => void;
  selectNode: (nodeId: string | null) => void;
  selectFinding: (findingId: string | null) => void;
  highlightChain: (chainId: string | null) => void;
  setStatus: (status: AnalysisStatus) => void;
  reset: () => void;
}

const defaultAgentStatuses = (): Record<AgentName, AgentStatus> =>
  Object.fromEntries(
    (["orchestrator", "mapper", "quality", "pattern", "security", "doctor", "senso"] as AgentName[]).map(
      (name) => [name, { name, status: "pending", progress: 0, message: "" }]
    )
  ) as Record<AgentName, AgentStatus>;

export const useAnalysisStore = create<AnalysisStore>((set) => ({
  analysisId: null,
  status: "queued",
  result: null,
  agentStatuses: defaultAgentStatuses(),
  graphNodes: [],
  graphEdges: [],
  currentGraphView: "structure",
  selectedNodeId: null,
  highlightedChainId: null,
  findings: [],
  liveFindings: [],
  findingFilters: {},
  selectedFindingId: null,
  fixes: [],
  fixSummary: null,
  chains: [],
  sensoInsights: [],
  errorMessage: null,

  startAnalysis: (id) => set({ analysisId: id, status: "queued", graphNodes: [], graphEdges: [], liveFindings: [], agentStatuses: defaultAgentStatuses(), errorMessage: null }),

  updateAgentStatus: (agent, status) =>
    set((s) => ({ agentStatuses: { ...s.agentStatuses, [agent]: status } })),

  addGraphNode: (node) => set((s) => ({ graphNodes: [...s.graphNodes, node] })),
  addGraphEdge: (edge) => set((s) => ({ graphEdges: [...s.graphEdges, edge] })),

  addLiveFinding: (finding) =>
    set((s) => ({ liveFindings: [...s.liveFindings.slice(-20), finding] })),

  addSensoInsight: (insight, sourceCount) =>
    set((s) => ({ sensoInsights: [...s.sensoInsights, { insight, sourceCount }] })),

  setComplete: (healthScore, findingsSummary, duration) =>
    set((s) => ({
      status: "completed",
      result: s.result
        ? { ...s.result, status: "completed", healthScore, findings: findingsSummary, timestamps: { ...s.result.timestamps, completedAt: new Date().toISOString(), duration } }
        : null,
    })),

  setFailed: (message) => set({ status: "failed", errorMessage: message }),

  setResult: (result) => set({ result, status: result.status }),

  setFindings: (findings) => set({ findings }),
  setFixes: (fixes, fixSummary) => set({ fixes, fixSummary }),
  setChains: (chains) => set({ chains }),

  setGraphView: (view) => set({ currentGraphView: view }),
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
  selectFinding: (findingId) => set({ selectedFindingId: findingId }),
  highlightChain: (chainId) => set({ highlightedChainId: chainId }),
  setStatus: (status) => set({ status }),

  reset: () => set({
    analysisId: null, status: "queued", result: null,
    agentStatuses: defaultAgentStatuses(),
    graphNodes: [], graphEdges: [], liveFindings: [],
    findings: [], fixes: [], fixSummary: null, chains: [],
    sensoInsights: [], errorMessage: null,
    selectedNodeId: null, selectedFindingId: null, highlightedChainId: null,
  }),
}));
