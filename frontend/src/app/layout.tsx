import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VIBE CHECK — Codebase Intelligence",
  description: "Autonomous multi-agent GitHub repository analyzer. Clinical precision. Living knowledge graph.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
