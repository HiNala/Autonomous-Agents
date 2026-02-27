import type { Metadata } from "next";
import { Martian_Mono, DM_Sans } from "next/font/google";
import "./globals.css";

const martianMono = Martian_Mono({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "600", "700"],
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "VIBE CHECK — Codebase Intelligence",
  description: "Autonomous multi-agent GitHub repository analyzer. Clinical precision. Living knowledge graph.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${martianMono.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
