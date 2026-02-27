"use client";
import { useEffect, useRef, useCallback } from "react";
import cytoscape from "cytoscape";
// @ts-expect-error no types
import dagre from "cytoscape-dagre";
// @ts-expect-error no types
import coseBilkent from "cytoscape-cose-bilkent";
import type { GraphNode, GraphEdge, GraphViewMode } from "@/types/shared";

// Register layouts once
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
  directory: "#71717A",
  function:  "#A78BFA",
  class:     "#C084FC",
  package:   "#60A5FA",
  endpoint:  "#34D399",
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#EF4444",
  warning:  "#F59E0B",
  healthy:  "#22C55E",
};

function nodeSize(findingCount: number): number {
  if (findingCount >= 3) return 32;
  if (findingCount >= 1) return 22;
  return 14;
}

function layoutForView(view: GraphViewMode): cytoscape.LayoutOptions {
  if (view === "structure") {
    return { name: "dagre", rankDir: "TB", nodeSep: 30, rankSep: 60, animate: true, animationDuration: 400 } as cytoscape.LayoutOptions;
  }
  if (view === "dependencies") {
    return { name: "cose-bilkent", animate: true, animationDuration: 500, randomize: false, idealEdgeLength: 80, nodeRepulsion: 4500, numIter: 2500 } as cytoscape.LayoutOptions;
  }
  return { name: "cose-bilkent", animate: true, animationDuration: 500, randomize: false } as cytoscape.LayoutOptions;
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
  const cyRef = useRef<cytoscape.Core | null>(null);

  // Init cytoscape
  useEffect(() => {
    if (!containerRef.current) return;
    ensureRegistered();

    const cy = cytoscape({
      container: containerRef.current,
      style: [
        {
          selector: "node",
          style: {
            "background-color": (ele) => {
              const sev = ele.data("severity") as string;
              if (sev && SEVERITY_COLOR[sev]) return SEVERITY_COLOR[sev];
              return NODE_TYPE_COLOR[ele.data("type") as string] ?? "#A1A1AA";
            },
            "width": (ele) => nodeSize(Number(ele.data("findingCount") ?? 0)),
            "height": (ele) => nodeSize(Number(ele.data("findingCount") ?? 0)),
            "border-width": (ele) => (ele.data("findingCount") > 0 ? 2 : 0),
            "border-color": (ele) => {
              const sev = ele.data("severity") as string;
              return sev ? (SEVERITY_COLOR[sev] ?? "transparent") : "transparent";
            },
            "label": "data(label)",
            "font-size": 9,
            "font-family": "JetBrains Mono, monospace",
            "color": "#71717A",
            "text-valign": "bottom",
            "text-halign": "center",
            "text-margin-y": 4,
            "text-max-width": "80px",
            "text-wrap": "ellipsis",
            "transition-property": "background-color, width, height, border-width",
            "transition-duration": "0.2s",
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 3,
            "border-color": "#3B82F6",
            "background-color": "#3B82F6",
          },
        },
        {
          selector: "node:hover",
          style: {
            "background-color": "#FAFAFA",
            "color": "#FAFAFA",
          },
        },
        {
          selector: "edge",
          style: {
            "width": 1,
            "line-color": "#27272A",
            "target-arrow-color": "#27272A",
            "target-arrow-shape": "triangle",
            "arrow-scale": 0.6,
            "curve-style": "bezier",
            "opacity": 0.6,
          },
        },
        {
          selector: "edge[isVulnerabilityChain='true']",
          style: {
            "width": 2.5,
            "line-color": "#EF4444",
            "target-arrow-color": "#EF4444",
            "line-style": "dashed",
            "opacity": 1,
          },
        },
        {
          selector: ".dimmed",
          style: { "opacity": 0.1 },
        },
        {
          selector: ".highlighted",
          style: {
            "opacity": 1,
            "line-color": "#EF4444",
            "target-arrow-color": "#EF4444",
            "width": 3,
          },
        },
      ],
      layout: { name: "preset" },
      wheelSensitivity: 0.3,
    });

    cy.on("tap", "node", (evt) => {
      onNodeClick(evt.target.id() as string);
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

  // Re-run layout on view change
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || cy.nodes().length === 0) return;

    if (view === "vulnerabilities") {
      const chainEdges = cy.edges().filter((e) => e.data("isVulnerabilityChain") === "true");
      const nonChainEdges = cy.edges().filter((e) => e.data("isVulnerabilityChain") !== "true");
      nonChainEdges.addClass("dimmed");
      chainEdges.removeClass("dimmed").addClass("highlighted");
    } else {
      cy.elements().removeClass("dimmed").removeClass("highlighted");
      cy.layout(layoutForView(view)).run();
    }
  }, [view]);

  // Handle selected node highlight
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().unselect();
    if (selectedNodeId) {
      cy.getElementById(selectedNodeId).select();
      cy.animate({ fit: { eles: cy.getElementById(selectedNodeId), padding: 80 }, duration: 400 });
    }
  }, [selectedNodeId]);

  // Handle chain highlight
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().removeClass("dimmed").removeClass("highlighted");
    if (highlightedChainId) {
      const chainEdges = cy.edges().filter((e) => e.data("chainId") === highlightedChainId);
      const chainNodes = chainEdges.connectedNodes();
      cy.elements().not(chainEdges).not(chainNodes).addClass("dimmed");
      chainEdges.addClass("highlighted");
    }
  }, [highlightedChainId]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", background: "var(--bg-primary)" }} />
  );
}
