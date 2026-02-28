"use client";
import { useEffect, useRef, useCallback } from "react";
import cytoscape from "cytoscape";
import type { GraphNode, GraphEdge, GraphViewMode } from "@/types/shared";

function ensureRegistered() {
  // Using Cytoscape built-in layouts only (no external extensions)
}

const NODE_TYPE_COLOR: Record<string, string> = {
  file:      "#A1A1AA",
  directory: "#6366F1",
  function:  "#A78BFA",
  class:     "#C084FC",
  package:   "#3B82F6",
  endpoint:  "#10B981",
};

const CATEGORY_COLOR: Record<string, string> = {
  source:  "#818CF8",
  test:    "#22D3EE",
  config:  "#FBBF24",
  docs:    "#60A5FA",
  build:   "#F97316",
  asset:   "#A78BFA",
  data:    "#2DD4BF",
  "ci-cd": "#F472B6",
  unknown: "#71717A",
};

// Language-specific colors for source files
const LANGUAGE_COLOR: Record<string, string> = {
  Python:     "#3B82F6",   // blue
  JavaScript: "#FBBF24",   // amber/yellow
  TypeScript: "#60A5FA",   // sky blue
  Java:       "#F97316",   // orange
  Go:         "#06B6D4",   // cyan
  Rust:       "#F43F5E",   // rose
  Ruby:       "#EC4899",   // pink
  PHP:        "#A78BFA",   // violet
  "C#":       "#10B981",   // emerald
  "C++":      "#6366F1",   // indigo
  C:          "#8B5CF6",   // purple
  Swift:      "#FB923C",   // orange-400
  Kotlin:     "#7C3AED",   // purple-700
  Vue:        "#34D399",   // emerald-400
  Svelte:     "#F87171",   // red-400
};

const SEVERITY_BORDER: Record<string, string> = {
  critical: "#EF4444",
  warning:  "#F59E0B",
};

const SEVERITY_GLOW: Record<string, string> = {
  critical: "rgba(239,68,68,0.35)",
  warning:  "rgba(245,158,11,0.25)",
};

function nodeSize(findingCount: number, type?: string): number {
  if (type === "directory") return 36;
  if (type === "package") return 38;
  if (findingCount >= 3) return 40;
  if (findingCount >= 1) return 30;
  return 22;
}

function layoutForView(view: GraphViewMode): cytoscape.LayoutOptions {
  if (view === "structure") {
    return {
      name: "cose",
      animate: false,
      fit: true,
      padding: 30,
      nodeRepulsion: () => 8000,
      idealEdgeLength: () => 70,
      edgeElasticity: () => 80,
      gravity: 0.4,
      randomize: true,
      numIter: 400,
    } as cytoscape.LayoutOptions;
  }
  return {
    name: "cose",
    animate: false,
    fit: true,
    padding: 30,
    nodeRepulsion: () => 8000,
    idealEdgeLength: () => 70,
    edgeElasticity: () => 60,
    gravity: 0.4,
    randomize: true,
    numIter: 400,
  } as cytoscape.LayoutOptions;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  label: string;
  type: string;
  severity?: string;
  findingCount: number;
  path?: string;
}

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  view: GraphViewMode;
  selectedNodeId: string | null;
  highlightedChainId: string | null;
  onNodeClick: (nodeId: string) => void;
}

export function GraphCanvas({ nodes, edges, view, selectedNodeId, highlightedChainId, onNodeClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const tooltipStateRef = useRef<TooltipState>({
    visible: false, x: 0, y: 0, label: "", type: "", findingCount: 0,
  });

  const updateTooltip = useCallback((state: Partial<TooltipState>) => {
    const next = { ...tooltipStateRef.current, ...state };
    tooltipStateRef.current = next;
    if (!tooltipRef.current) return;
    const el = tooltipRef.current;
    if (!next.visible) {
      el.style.opacity = "0";
      el.style.pointerEvents = "none";
      return;
    }
    el.style.opacity = "1";
    el.style.pointerEvents = "auto";
    el.style.left = `${next.x + 12}px`;
    el.style.top = `${next.y - 8}px`;
    el.innerHTML = `
      <div style="font-weight:600;color:#F4F4F5;font-size:11px;margin-bottom:3px;">${next.label}</div>
      <div style="color:#71717A;font-size:10px;letter-spacing:0.04em;">${next.type}${next.severity ? ` · <span style="color:${next.severity === "critical" ? "#FCA5A5" : "#FCD34D"}">${next.severity}</span>` : ""}${next.findingCount > 0 ? ` · ${next.findingCount} finding${next.findingCount !== 1 ? "s" : ""}` : ""}</div>
      ${next.path ? `<div style="color:#52525B;font-size:10px;margin-top:2px;font-family:monospace;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${next.path}</div>` : ""}
    `;
  }, []);

  // Init cytoscape
  useEffect(() => {
    if (!containerRef.current) return;
    ensureRegistered();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const style: any[] = [
        // Base node
        {
          selector: "node",
          style: {
            "background-color": (ele: cytoscape.NodeSingular) => {
              const sev = ele.data("severity") as string;
              if (sev === "critical") return "#EF4444";
              if (sev === "warning")  return "#F59E0B";
              const type = ele.data("type") as string;
              if (type === "file") {
                const cat = ele.data("category") as string;
                const lang = ele.data("language") as string;
                // Source files: use language-specific color for richer differentiation
                if (cat === "source" && lang && LANGUAGE_COLOR[lang]) {
                  return LANGUAGE_COLOR[lang];
                }
                return CATEGORY_COLOR[cat] ?? CATEGORY_COLOR.unknown;
              }
              return NODE_TYPE_COLOR[type] ?? "#A1A1AA";
            },
            "width":  (ele: cytoscape.NodeSingular) => nodeSize(Number(ele.data("findingCount") ?? 0), ele.data("type") as string),
            "height": (ele: cytoscape.NodeSingular) => nodeSize(Number(ele.data("findingCount") ?? 0), ele.data("type") as string),
            "border-width": (ele: cytoscape.NodeSingular) => {
              const sev = ele.data("severity") as string;
              if (sev === "critical") return 2.5;
              if (sev === "warning")  return 2;
              return ele.data("findingCount") > 0 ? 1.5 : 1;
            },
            "border-color": (ele: cytoscape.NodeSingular) => {
              const sev = ele.data("severity") as string;
              return SEVERITY_BORDER[sev] ?? "rgba(255,255,255,0.15)";
            },
            "border-opacity": 0.7,
            "label": "data(label)",
            "font-size": 11,
            "font-family": "Martian Mono, JetBrains Mono, monospace",
            "color": "#D4D4D8",
            "text-opacity": 0.85,
            "text-valign": "bottom",
            "text-halign": "center",
            "text-margin-y": 6,
            "text-max-width": "100px",
            "text-wrap": "ellipsis",
            "overlay-color": (ele: cytoscape.NodeSingular) => {
              const sev = ele.data("severity") as string;
              return SEVERITY_GLOW[sev] ?? "transparent";
            },
            "overlay-opacity": (ele: cytoscape.NodeSingular) => {
              const sev = ele.data("severity") as string;
              return sev === "critical" ? 0.25 : sev === "warning" ? 0.15 : 0;
            },
            "transition-property": "background-color, border-color, width, height, border-width, overlay-opacity",
            "transition-duration": 250,
          },
        },

        // Package nodes — hexagon shape
        {
          selector: "node[type='package']",
          style: {
            "shape": "hexagon",
            "background-color": "#1D4ED8",
            "background-opacity": 0.85,
          },
        },

        // Endpoint nodes — circle
        {
          selector: "node[type='endpoint']",
          style: {
            "shape": "ellipse",
            "background-color": "#059669",
          },
        },

        // Function nodes — diamond
        {
          selector: "node[type='function']",
          style: {
            "shape": "diamond",
            "background-color": "#7C3AED",
          },
        },

        // Directory nodes — rectangle with label always visible
        {
          selector: "node[type='directory']",
          style: {
            "shape": "round-rectangle",
            "background-color": "#4F46E5",
            "background-opacity": 0.9,
            "border-color": "#818CF8",
            "border-width": 2,
            "text-opacity": 1,
            "color": "#E0E7FF",
            "font-size": 13,
            "font-weight": "bold" as unknown as number,
            "text-max-width": "120px",
          },
        },

        // Selected
        {
          selector: "node:selected",
          style: {
            "border-color": "#3B82F6",
            "border-width": 3,
            "border-opacity": 1,
            "overlay-color": "#3B82F6",
            "overlay-opacity": 0.2,
            "text-opacity": 1,
            "color": "#93C5FD",
            "z-index": 1000,
          },
        },

        // Hover
        {
          selector: "node.hover",
          style: {
            "text-opacity": 1,
            "color": "#FAFAFA",
            "font-size": 13,
            "overlay-opacity": 0.2,
            "z-index": 999,
          },
        },

        // Dimmed
        {
          selector: "node.dimmed",
          style: {
            "background-opacity": 0.15,
            "border-opacity": 0.1,
            "text-opacity": 0,
            "overlay-opacity": 0,
            "transition-duration": 300,
          },
        },

        // Chain member
        {
          selector: "node.chain-member",
          style: {
            "border-color": "#EF4444",
            "border-width": 3,
            "overlay-color": "#EF4444",
            "overlay-opacity": 0.3,
            "text-opacity": 1,
            "color": "#FCA5A5",
            "z-index": 500,
          },
        },

        // Blast radius hops
        {
          selector: "node.blast-hop-1",
          style: { "border-color": "#F59E0B", "border-width": 2.5, "overlay-color": "#F59E0B", "overlay-opacity": 0.2 },
        },
        {
          selector: "node.blast-hop-2",
          style: { "border-color": "#FCD34D", "border-width": 2, "overlay-color": "#FCD34D", "overlay-opacity": 0.15 },
        },
        {
          selector: "node.blast-hop-3",
          style: { "border-color": "#FDE68A", "border-width": 1.5, "overlay-color": "#FDE68A", "overlay-opacity": 0.1 },
        },

        // Base edge (contains relationship)
        {
          selector: "edge",
          style: {
            "width": 1.5,
            "line-color": "rgba(255,255,255,0.18)",
            "target-arrow-color": "rgba(255,255,255,0.18)",
            "target-arrow-shape": "none",
            "curve-style": "bezier",
            "opacity": 0.7,
            "transition-property": "line-color, width, opacity",
            "transition-duration": 250,
          },
        },

        // Import edges — slightly visible
        {
          selector: "edge[type='imports']",
          style: {
            "line-color": "rgba(161,161,170,0.12)",
            "width": 1,
            "target-arrow-shape": "triangle",
            "target-arrow-color": "rgba(161,161,170,0.12)",
            "arrow-scale": 0.5,
            "opacity": 0.6,
          },
        },

        // Dependency edges
        {
          selector: "edge[type='depends_on']",
          style: {
            "line-color": "rgba(59,130,246,0.15)",
            "width": 1.5,
            "line-style": "dashed",
            "line-dash-pattern": [6, 3],
          },
        },

        // Vulnerability chain edges — THE STAR
        {
          selector: "edge[isVulnerabilityChain='true']",
          style: {
            "line-color": "#EF4444",
            "width": 3,
            "target-arrow-shape": "triangle",
            "target-arrow-color": "#EF4444",
            "arrow-scale": 1.2,
            "opacity": 1,
            "line-style": "solid",
            "z-index": 900,
            "overlay-color": "#EF4444",
            "overlay-opacity": 0.15,
          },
        },

        // Highlighted edges
        {
          selector: "edge.highlighted",
          style: {
            "line-color": "rgba(239,68,68,0.8)",
            "width": 3,
            "opacity": 1,
            "target-arrow-shape": "triangle",
            "target-arrow-color": "rgba(239,68,68,0.8)",
          },
        },

        // Dimmed edges
        {
          selector: "edge.dimmed",
          style: {
            "opacity": 0.05,
            "transition-duration": 300,
          },
        },
    ];

    const cy = cytoscape({
      container: containerRef.current,
      style,
      layout: { name: "preset" },
      wheelSensitivity: 1,
      minZoom: 0.1,
      maxZoom: 5,
    });

    // Hover events
    cy.on("mouseover", "node", (evt) => {
      const node = evt.target;
      node.addClass("hover");
      if (!containerRef.current) return;
      const pos = evt.renderedPosition;
      updateTooltip({
        visible: true,
        x: pos.x,
        y: pos.y,
        label: node.data("label") ?? node.id(),
        type: node.data("type") ?? "node",
        severity: node.data("severity"),
        findingCount: Number(node.data("findingCount") ?? 0),
        path: node.data("path"),
      });
      containerRef.current.style.cursor = "pointer";
    });

    cy.on("mouseout", "node", (evt) => {
      evt.target.removeClass("hover");
      updateTooltip({ visible: false });
      if (containerRef.current) containerRef.current.style.cursor = "default";
    });

    cy.on("tap", "node", (evt) => {
      onNodeClick(evt.target.id() as string);
    });

    cy.on("pan zoom", () => {
      updateTooltip({ visible: false });
    });

    cyRef.current = cy;
    return () => { cy.destroy(); cyRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync nodes & edges
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    // Remove nodes/edges no longer in the visible set (e.g. search filter reduced set)
    const validNodeIds = new Set(nodes.map((n) => n.id));
    const validEdgeIds = new Set(edges.map((e) => e.id));
    cy.nodes().filter((n) => !validNodeIds.has(n.id() as string)).remove();
    cy.edges().filter((e) => !validEdgeIds.has(e.id() as string)).remove();

    const existingIds = new Set(cy.nodes().map((n) => n.id() as string));
    const existingEdgeIds = new Set(cy.edges().map((e) => e.id() as string));

    const newNodes = nodes.filter((n) => !existingIds.has(n.id));
    const newEdges = edges.filter((e) => !existingEdgeIds.has(e.id));

    if (newNodes.length > 0) {
      cy.add(newNodes.map((n) => ({
        group: "nodes" as const,
        data: {
          id: n.id,
          label: n.label,
          type: n.type,
          severity: n.severity,
          findingCount: n.findingCount,
          path: n.path,
          category: n.category,
          language: n.language,
        },
      })));
    }

    if (newEdges.length > 0) {
      const nodeIds = new Set(cy.nodes().map((n) => n.id() as string));
      cy.add(
        newEdges
          .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
          .map((e) => ({
            group: "edges" as const,
            data: {
              id: e.id,
              source: e.source,
              target: e.target,
              type: e.type,
              isVulnerabilityChain: e.isVulnerabilityChain ? "true" : "false",
              chainId: e.chainId,
            },
          }))
      );
    }

    if (newNodes.length > 0 || newEdges.length > 0) {
      const layout = cy.layout(layoutForView(view));
      layout.run();
      layout.on("layoutstop", () => cy.fit(undefined, 20));
    }
  }, [nodes, edges, view]);

  // View change
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || cy.nodes().length === 0) return;

    if (view === "vulnerabilities") {
      cy.elements().addClass("dimmed");
      const chainEdges = cy.edges().filter((e) => e.data("isVulnerabilityChain") === "true");
      const chainNodes = chainEdges.connectedNodes();
      chainEdges.removeClass("dimmed").addClass("highlighted");
      chainNodes.removeClass("dimmed").addClass("chain-member");
    } else {
      cy.elements().removeClass("dimmed highlighted chain-member");
      cy.layout(layoutForView(view)).run();
    }
  }, [view]);

  // Selected node
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().unselect();
    if (selectedNodeId) {
      const node = cy.getElementById(selectedNodeId);
      node.select();
      cy.animate({ fit: { eles: node, padding: 80 }, duration: 400 });
    }
  }, [selectedNodeId]);

  // Chain highlight
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().removeClass("dimmed highlighted chain-member");
    if (highlightedChainId) {
      const chainEdges = cy.edges().filter((e) => e.data("chainId") === highlightedChainId);
      const chainNodes = chainEdges.connectedNodes();
      cy.elements().not(chainEdges).not(chainNodes).addClass("dimmed");
      chainEdges.addClass("highlighted");
      chainNodes.addClass("chain-member");
    }
  }, [highlightedChainId]);

  return (
    <div style={{ position: "absolute", inset: 0, background: "var(--bg-surface)" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        style={{
          position: "absolute",
          padding: "7px 11px",
          background: "rgba(17, 17, 22, 0.96)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-md)",
          fontSize: 11,
          color: "var(--text-secondary)",
          pointerEvents: "none",
          backdropFilter: "blur(8px)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          zIndex: 200,
          opacity: 0,
          transition: "opacity 0.12s ease",
          fontFamily: "var(--font-code)",
          maxWidth: 220,
          whiteSpace: "nowrap",
        }}
      />
    </div>
  );
}
