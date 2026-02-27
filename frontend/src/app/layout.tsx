import type { Metadata, Viewport } from "next";
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
  title: {
    default: "VIBE CHECK — Codebase Intelligence",
    template: "%s | VIBE CHECK",
  },
  description:
    "Autonomous multi-agent GitHub repository analyzer. Clinical precision. Living knowledge graph. Intelligence that compounds.",
  keywords: ["code review", "security", "static analysis", "GitHub", "autonomous agents", "knowledge graph"],
  authors: [{ name: "VIBE CHECK" }],
  creator: "VIBE CHECK",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://vibecheck.dev",
    siteName: "VIBE CHECK",
    title: "VIBE CHECK — Codebase Intelligence",
    description:
      "Autonomous multi-agent GitHub repository analyzer. Clinical precision. Living knowledge graph.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "VIBE CHECK — Codebase Intelligence",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VIBE CHECK — Codebase Intelligence",
    description: "Autonomous multi-agent GitHub repository analyzer.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0B",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${martianMono.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
