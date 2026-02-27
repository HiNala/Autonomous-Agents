"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { useAnalysisStore } from "@/stores/analysisStore";
import { GraphToolbar } from "./GraphToolbar";
import type { GraphViewMode } from "@/types/shared";

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
  const {
    graphNodes, graphEdges, currentGraphView,
    selectedNodeId, highlightedChainId,
    setGraphView, selectNode,
  } = useAnalysisStore();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // Filtered nodes based on search
  const visibleNodes = searchQuery
    ? graphNodes.filter((n) =>
        n.label?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.path?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : graphNodes;

  const visibleEdges = searchQuery
    ? (() => {
        const ids = new Set(visibleNodes.map((n) => n.id));
        return graphEdges.filter((e) => ids.has(e.source) && ids.has(e.target));
      })()
    : graphEdges;

  const handleReset = useCallback(() => setResetKey((k) => k + 1), []);
  const handleViewChange = useCallback((v: GraphViewMode) => setGraphView(v), [setGraphView]);
  const handleNodeClick = useCallback((id: string) => selectNode(id === selectedNodeId ? null : id), [selectNode, selectedNodeId]);

  // Count node types for stats
  const fileCount = graphNodes.filter((n) => n.type === "file").length;
  const funcCount = graphNodes.filter((n) => n.type === "function" || n.type === "class").length;
  const pkgCount  = graphNodes.filter((n) => n.type === "package").length;
  const critCount = graphNodes.filter((n) => n.severity === "critical").length;

  const isEmpty = graphNodes.length === 0;

  return (
    <div
      style={{
        background: "rgba(17, 17, 22, 0.72)",
        backdropFilter: "blur(12px) saturate(1.4)",
        WebkitBackdropFilter: "blur(12px) saturate(1.4)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: isFullscreen ? "fixed" : "relative",
        inset: isFullscreen ? "56px 0 40px" : undefined,
        zIndex: isFullscreen ? 40 : undefined,
        minHeight: isFullscreen ? undefined : 440,
        boxShadow: "var(--shadow-panel)",
      }}
    >
      <GraphToolbar
        view={currentGraphView}
        onViewChange={handleViewChange}
        onReset={handleReset}
        onFullscreen={() => setIsFullscreen((f) => !f)}
        onSearch={setSearchQuery}
        nodeCount={graphNodes.length}
        edgeCount={graphEdges.length}
      />

      {/* Canvas area */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        {isEmpty ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--space-3)",
              color: "var(--text-tertiary)",
            }}
          >
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" opacity="0.3">
              <circle cx="20" cy="10" r="4" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="8"  cy="30" r="4" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="32" cy="30" r="4" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="20" y1="14" x2="8"  y2="26" stroke="currentColor" strokeWidth="1"/>
              <line x1="20" y1="14" x2="32" y2="26" stroke="currentColor" strokeWidth="1"/>
              <line x1="12" y1="30" x2="28" y2="30" stroke="currentColor" strokeWidth="1"/>
            </svg>
            <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-small)" }}>Graph will appear here</span>
            <span style={{ fontSize: "var(--text-micro)" }}>Nodes build live during analysis</span>
          </div>
        ) : (
          <GraphCanvas
            key={resetKey}
            nodes={visibleNodes}
            edges={visibleEdges}
            view={currentGraphView}
            selectedNodeId={selectedNodeId}
            highlightedChainId={highlightedChainId}
            onNodeClick={handleNodeClick}
          />
        )}

        {/* Graph stats overlay — bottom-left */}
        {!isEmpty && (
          <div
            style={{
              position: "absolute",
              bottom: "var(--space-4)",
              left: "var(--space-4)",
              display: "flex",
              gap: "var(--space-3)",
              fontSize: "var(--text-micro)",
              color: "var(--text-quaternary)",
              fontFamily: "var(--font-code)",
              letterSpacing: "0.06em",
              pointerEvents: "none",
            }}
          >
            {fileCount > 0 && <span><span style={{ color: "var(--text-tertiary)" }}>{fileCount}</span> files</span>}
            {funcCount > 0 && <span>· <span style={{ color: "var(--text-tertiary)" }}>{funcCount}</span> functions</span>}
            {pkgCount > 0  && <span>· <span style={{ color: "var(--text-tertiary)" }}>{pkgCount}</span> deps</span>}
            {critCount > 0 && (
              <span style={{ color: "var(--color-critical-text)" }}>
                · {critCount} critical
              </span>
            )}
          </div>
        )}

        {/* Vulnerability tab legend */}
        {currentGraphView === "vulnerabilities" && !isEmpty && (
          <div
            style={{
              position: "absolute",
              bottom: "var(--space-4)",
              right: "var(--space-4)",
              background: "rgba(9, 9, 11, 0.9)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              padding: "8px 12px",
              fontSize: "var(--text-micro)",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-code)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ display: "inline-block", width: 20, height: 2, background: "var(--color-critical)", boxShadow: "0 0 6px var(--color-critical)" }} />
              <span style={{ color: "var(--color-critical-text)" }}>Attack chain</span>
            </span>
            <span style={{ color: "var(--text-tertiary)" }}>· Click node for details</span>
          </div>
        )}

        {/* Search active indicator */}
        {searchQuery && (
          <div
            style={{
              position: "absolute",
              top: "var(--space-3)",
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(59,130,246,0.15)",
              border: "1px solid var(--color-accent-border)",
              borderRadius: "var(--radius-full)",
              padding: "3px 12px",
              fontSize: "var(--text-micro)",
              color: "var(--color-accent-text)",
              fontFamily: "var(--font-code)",
              backdropFilter: "blur(8px)",
              animation: "fade-in 0.2s ease-out",
            }}
          >
            Showing {visibleNodes.length} of {graphNodes.length} nodes
          </div>
        )}
      </div>
    </div>
  );
}
