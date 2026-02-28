"use client";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useAnalysisStore } from "@/stores/analysisStore";
import { GraphToolbar } from "./GraphToolbar";
import type { GraphViewMode, GraphNode } from "@/types/shared";

const GraphCanvas = dynamic(
  () => import("./GraphCanvas").then((m) => m.GraphCanvas),
  { ssr: false, loading: () => <GraphLoading /> }
);

function NodeDetailPanel({ node, edges, allNodes, onClose }: {
  node: GraphNode;
  edges: { source: string; target: string; type: string }[];
  allNodes: GraphNode[];
  onClose: () => void;
}) {
  const nodeMap = useMemo(() => new Map(allNodes.map((n) => [n.id, n])), [allNodes]);
  const connections = edges
    .filter((e) => e.source === node.id || e.target === node.id)
    .map((e) => {
      const otherId = e.source === node.id ? e.target : e.source;
      const other = nodeMap.get(otherId);
      return { relationship: e.type, name: other?.label ?? otherId, type: other?.type ?? "unknown" };
    });

  const typeColors: Record<string, string> = {
    file: "var(--color-accent)",
    directory: "#F59E0B",
    function: "#22C55E",
    class: "#EC4899",
    package: "#8B5CF6",
    endpoint: "#3B82F6",
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: 280,
        background: "rgba(9, 9, 11, 0.95)",
        borderLeft: "1px solid var(--border-default)",
        backdropFilter: "blur(16px)",
        display: "flex",
        flexDirection: "column",
        zIndex: 20,
        animation: "slide-in-right 0.2s ease-out",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "12px var(--space-4)", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-micro)", color: "var(--text-tertiary)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>
          NODE DETAIL
        </span>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4, fontSize: 16, lineHeight: 1 }}
        >
          &times;
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-3) var(--space-4)" }}>
        {/* Node type badge + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "var(--space-3)" }}>
          <span style={{
            width: 10, height: 10, borderRadius: node.type === "file" ? 2 : "50%",
            background: typeColors[node.type] ?? "var(--text-quaternary)",
            boxShadow: `0 0 6px ${typeColors[node.type] ?? "transparent"}44`,
            flexShrink: 0,
          }} />
          <span style={{ fontSize: "var(--text-small)", color: "var(--text-primary)", fontWeight: 600, wordBreak: "break-all" }}>
            {node.label}
          </span>
        </div>

        {/* Properties */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: "var(--space-4)" }}>
          <DetailRow label="Type" value={node.type} />
          {node.path && <DetailRow label="Path" value={node.path} />}
          {node.language && <DetailRow label="Language" value={node.language} />}
          {node.lines != null && node.lines > 0 && <DetailRow label="Lines" value={String(node.lines)} />}
          {node.severity && <DetailRow label="Severity" value={node.severity} color={node.severity === "critical" ? "var(--color-critical)" : undefined} />}
        </div>

        {/* Connections */}
        {connections.length > 0 && (
          <>
            <div style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-micro)", color: "var(--text-tertiary)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>
              CONNECTIONS ({connections.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {connections.slice(0, 20).map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--text-micro)", color: "var(--text-secondary)" }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: typeColors[c.type] ?? "var(--text-quaternary)", flexShrink: 0 }} />
                  <span style={{ color: "var(--text-quaternary)", fontFamily: "var(--font-code)", fontSize: "9px", flexShrink: 0 }}>{c.relationship}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                </div>
              ))}
              {connections.length > 20 && (
                <span style={{ fontSize: "var(--text-micro)", color: "var(--text-quaternary)", fontStyle: "italic" }}>+{connections.length - 20} more</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <span style={{ fontFamily: "var(--font-code)", fontSize: "var(--text-micro)", color: "var(--text-quaternary)", minWidth: 60, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: "var(--text-micro)", color: color ?? "var(--text-secondary)", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

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
  const panelRef = useRef<HTMLDivElement>(null);

  // Sync React isFullscreen state with native Fullscreen API changes
  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

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

  const handleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      try {
        await panelRef.current?.requestFullscreen();
      } catch {
        // Fallback: CSS-based fullscreen overlay
        setIsFullscreen((f) => !f);
      }
    } else {
      await document.exitFullscreen();
    }
  }, []);

  // Count node types for stats
  const fileCount = graphNodes.filter((n) => n.type === "file").length;
  const funcCount = graphNodes.filter((n) => n.type === "function" || n.type === "class").length;
  const pkgCount  = graphNodes.filter((n) => n.type === "package").length;
  const critCount = graphNodes.filter((n) => n.severity === "critical").length;

  const isEmpty = graphNodes.length === 0;

  return (
    <div
      ref={panelRef}
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
        height: isFullscreen ? undefined : 600,
        minHeight: isFullscreen ? undefined : 600,
        boxShadow: "var(--shadow-panel)",
      }}
    >
      <GraphToolbar
        view={currentGraphView}
        onViewChange={handleViewChange}
        onReset={handleReset}
        onFullscreen={handleFullscreen}
        onSearch={setSearchQuery}
        nodeCount={graphNodes.length}
        edgeCount={graphEdges.length}
      />

      {/* Canvas area — explicit height so Cytoscape resolves 100% correctly */}
      <div style={{ flex: 1, position: "relative", minHeight: 0, height: "100%" }}>
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

        {/* Structure view color legend */}
        {currentGraphView === "structure" && !isEmpty && (
          <div
            style={{
              position: "absolute",
              bottom: "var(--space-4)",
              right: "var(--space-4)",
              background: "rgba(9, 9, 11, 0.92)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              padding: "8px 12px",
              fontSize: "var(--text-micro)",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-code)",
              backdropFilter: "blur(8px)",
              display: "flex",
              flexWrap: "wrap",
              gap: "8px 14px",
              maxWidth: 340,
            }}
          >
            {[
              { label: "Source", color: "#818CF8" },
              { label: "Test", color: "#22D3EE" },
              { label: "Config", color: "#FBBF24" },
              { label: "Docs", color: "#60A5FA" },
              { label: "Build", color: "#F97316" },
              { label: "Directory", color: "#4F46E5" },
              { label: "Critical", color: "#EF4444" },
              { label: "Warning", color: "#F59E0B" },
            ].map((item) => (
              <span key={item.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{
                  display: "inline-block", width: 8, height: 8, borderRadius: 2,
                  background: item.color, boxShadow: `0 0 4px ${item.color}66`,
                }} />
                <span style={{ color: "var(--text-tertiary)", fontSize: 10 }}>{item.label}</span>
              </span>
            ))}
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

        {/* Node detail slide-in */}
        {selectedNodeId && (() => {
          const node = graphNodes.find((n) => n.id === selectedNodeId);
          if (!node) return null;
          return (
            <NodeDetailPanel
              node={node}
              edges={graphEdges}
              allNodes={graphNodes}
              onClose={() => selectNode(null)}
            />
          );
        })()}

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
