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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://autonomix.dev"),
  title: {
    default: "Autonomix — Codebase Intelligence",
    template: "%s | Autonomix",
  },
  description:
    "Autonomous multi-agent GitHub repository analyzer. Clinical precision. Living knowledge graph. Intelligence that compounds.",
  keywords: ["code review", "security", "static analysis", "GitHub", "autonomous agents", "knowledge graph"],
  authors: [{ name: "Autonomix" }],
  creator: "Autonomix",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://autonomix.dev",
    siteName: "Autonomix",
    title: "Autonomix — Codebase Intelligence",
    description:
      "Autonomous multi-agent GitHub repository analyzer. Clinical precision. Living knowledge graph.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Autonomix — Codebase Intelligence",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Autonomix — Codebase Intelligence",
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
