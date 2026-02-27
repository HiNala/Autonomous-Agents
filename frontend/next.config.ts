import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack (and webpack) need to transpile CJS-only cytoscape layout packages
  transpilePackages: ["cytoscape-dagre", "cytoscape-cose-bilkent"],
};

export default nextConfig;
