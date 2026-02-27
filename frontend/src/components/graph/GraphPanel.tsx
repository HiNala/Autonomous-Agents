"use client";
import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useAnalysisStore } from "@/stores/analysisStore";
import { GraphToolbar } from "./GraphToolbar";
import type { GraphViewMode } from "@/types/shared";

// Load Cytoscape only client-side — no SSR
const GraphCanvas = dynamic(
  () => import("./GraphCanvas").then((m) => m.GraphCanvas),
  { ssr: false, loading: () => <GraphLoading /> }
);

function GraphLoading() {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "var(--space-3)", color: "var(--text-tertiary)" }}>
      <div style={{ width: 40, height: 40, border: "2px solid var(--border-default)", borderTopColor: "var(--color-accent)", borderRadius: "50%" }} className="animate-spin" />
      <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-small)" }}>Loading graph engine...</span>
    </div>
  );
}

export function GraphPanel() {
  const { graphNodes, graphEdges, currentGraphView, selectedNodeId, highlightedChainId, setGraphView, selectNode } = useAnalysisStore();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const handleReset = useCallback(() => setResetKey((k) => k + 1), []);
  const handleViewChange = useCallback((v: GraphViewMode) => setGraphView(v), [setGraphView]);
  const handleNodeClick = useCallback((id: string) => selectNode(id === selectedNodeId ? null : id), [selectNode, selectedNodeId]);

  const isEmpty = graphNodes.length === 0;

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: isFullscreen ? "fixed" : "relative",
        inset: isFullscreen ? "56px 0 40px" : undefined,
        zIndex: isFullscreen ? 40 : undefined,
        minHeight: isFullscreen ? undefined : 420,
      }}
    >
      <GraphToolbar
        view={currentGraphView}
        onViewChange={handleViewChange}
        onReset={handleReset}
        onFullscreen={() => setIsFullscreen((f) => !f)}
        nodeCount={graphNodes.length}
        edgeCount={graphEdges.length}
      />

      {/* Canvas area */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        {isEmpty ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "var(--space-3)", color: "var(--text-tertiary)" }}>
            <span style={{ fontSize: "2.5rem" }}>🕸</span>
            <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-small)" }}>Graph will appear here</span>
            <span style={{ fontSize: "var(--text-micro)" }}>Nodes build live during analysis</span>
          </div>
        ) : (
          <GraphCanvas
            key={resetKey}
            nodes={graphNodes}
            edges={graphEdges}
            view={currentGraphView}
            selectedNodeId={selectedNodeId}
            highlightedChainId={highlightedChainId}
            onNodeClick={handleNodeClick}
          />
        )}

        {/* Vulnerability overlay legend */}
        {currentGraphView === "vulnerabilities" && !isEmpty && (
          <div
            style={{
              position: "absolute",
              bottom: "var(--space-4)",
              left: "var(--space-4)",
              background: "rgba(10,10,11,0.85)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              padding: "8px 12px",
              fontSize: "var(--text-micro)",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-code)",
              backdropFilter: "blur(8px)",
            }}
          >
            <span style={{ color: "var(--color-critical)" }}>━━</span> Attack chain &nbsp;
            <span style={{ color: "var(--text-tertiary)" }}>·</span> &nbsp;Click node for details
          </div>
        )}
      </div>
    </div>
  );
}
