"use client";
import { useEffect, useRef, useCallback } from "react";
import cytoscape from "cytoscape";
// @ts-expect-error no types
import dagre from "cytoscape-dagre";
// @ts-expect-error no types
import coseBilkent from "cytoscape-cose-bilkent";
import type { GraphNode, GraphEdge, GraphViewMode } from "@/types/shared";

let registered = false;
function ensureRegistered() {
  if (!registered) {
    cytoscape.use(dagre);
    cytoscape.use(coseBilkent);
    registered = true;
  }
}

const NODE_TYPE_COLOR: Record<string, string> = {
  file:      "#A1A1AA",
  directory: "#52525B",
  function:  "#A78BFA",
  class:     "#C084FC",
  package:   "#60A5FA",
  endpoint:  "#34D399",
};

const SEVERITY_BORDER: Record<string, string> = {
  critical: "#EF4444",
  warning:  "#F59E0B",
};

const SEVERITY_SHADOW: Record<string, { color: string; blur: number; opacity: number }> = {
  critical: { color: "#EF4444", blur: 12, opacity: 0.6 },
  warning:  { color: "#F59E0B", blur: 8,  opacity: 0.4 },
};

function nodeSize(findingCount: number): number {
  if (findingCount >= 3) return 28;
  if (findingCount >= 1) return 20;
  return 13;
}

function layoutForView(view: GraphViewMode): cytoscape.LayoutOptions {
  if (view === "structure") {
    return {
      name: "dagre",
      rankDir: "TB",
      nodeSep: 28,
      rankSep: 55,
      animate: true,
      animationDuration: 450,
      fit: true,
      padding: 36,
    } as cytoscape.LayoutOptions;
  }
  if (view === "dependencies") {
    return {
      name: "cose-bilkent",
      animate: true,
      animationDuration: 500,
      randomize: false,
      idealEdgeLength: 80,
      nodeRepulsion: 4500,
      numIter: 2500,
      fit: true,
      padding: 36,
    } as cytoscape.LayoutOptions;
  }
  return {
    name: "cose-bilkent",
    animate: true,
    animationDuration: 500,
    randomize: false,
    fit: true,
    padding: 36,
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
              if (sev === "critical") return "#450A0A";
              if (sev === "warning")  return "#431407";
              return NODE_TYPE_COLOR[ele.data("type") as string] ?? "#A1A1AA";
            },
            "width":  (ele: cytoscape.NodeSingular) => nodeSize(Number(ele.data("findingCount") ?? 0)),
            "height": (ele: cytoscape.NodeSingular) => nodeSize(Number(ele.data("findingCount") ?? 0)),
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
            "font-size": 9,
            "font-family": "Martian Mono, JetBrains Mono, monospace",
            "color": "#71717A",
            "text-opacity": 0,
            "text-valign": "bottom",
            "text-halign": "center",
            "text-margin-y": 5,
            "text-max-width": "80px",
            "text-wrap": "ellipsis",
            "shadow-blur": (ele: cytoscape.NodeSingular) => {
              const sev = ele.data("severity") as string;
              return SEVERITY_SHADOW[sev]?.blur ?? 0;
            },
            "shadow-color": (ele: cytoscape.NodeSingular) => {
              const sev = ele.data("severity") as string;
              return SEVERITY_SHADOW[sev]?.color ?? "#000000";
            },
            "shadow-opacity": (ele: cytoscape.NodeSingular) => {
              const sev = ele.data("severity") as string;
              return SEVERITY_SHADOW[sev]?.opacity ?? 0;
            },
            "shadow-offset-x": 0,
            "shadow-offset-y": 0,
            "transition-property": "background-color, border-color, shadow-blur, shadow-opacity, width, height, border-width",
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

        // Directory nodes — rectangle
        {
          selector: "node[type='directory']",
          style: {
            "shape": "round-rectangle",
            "background-color": "#27272A",
            "background-opacity": 0.6,
          },
        },

        // Selected
        {
          selector: "node:selected",
          style: {
            "border-color": "#3B82F6",
            "border-width": 3,
            "border-opacity": 1,
            "shadow-blur": 20,
            "shadow-color": "#3B82F6",
            "shadow-opacity": 0.7,
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
            "color": "#F4F4F5",
            "font-size": 10,
            "shadow-blur": 16,
            "shadow-opacity": 0.8,
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
            "shadow-opacity": 0,
            "transition-duration": "0.3s",
          },
        },

        // Chain member
        {
          selector: "node.chain-member",
          style: {
            "border-color": "#EF4444",
            "border-width": 3,
            "shadow-blur": 24,
            "shadow-color": "#EF4444",
            "shadow-opacity": 0.9,
            "text-opacity": 1,
            "color": "#FCA5A5",
            "z-index": 500,
          },
        },

        // Blast radius hops
        {
          selector: "node.blast-hop-1",
          style: { "border-color": "#F59E0B", "border-width": 2.5, "shadow-blur": 16, "shadow-color": "#F59E0B", "shadow-opacity": 0.7 },
        },
        {
          selector: "node.blast-hop-2",
          style: { "border-color": "#FCD34D", "border-width": 2, "shadow-blur": 10, "shadow-color": "#FCD34D", "shadow-opacity": 0.5 },
        },
        {
          selector: "node.blast-hop-3",
          style: { "border-color": "#FDE68A", "border-width": 1.5, "shadow-blur": 6, "shadow-color": "#FDE68A", "shadow-opacity": 0.3 },
        },

        // Base edge
        {
          selector: "edge",
          style: {
            "width": 1,
            "line-color": "rgba(255,255,255,0.05)",
            "target-arrow-color": "rgba(255,255,255,0.05)",
            "target-arrow-shape": "none",
            "curve-style": "bezier",
            "opacity": 0.5,
            "transition-property": "line-color, width, opacity",
            "transition-duration": "0.25s",
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
            "shadow-blur": 8,
            "shadow-color": "#EF4444",
            "shadow-opacity": 0.5,
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
      wheelSensitivity: 0.15,
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
      cy.layout(layoutForView(view)).run();
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
    <div style={{ width: "100%", height: "100%", position: "relative", background: "var(--bg-primary)" }}>
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
