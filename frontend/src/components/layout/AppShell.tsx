"use client";
import { useAnalysisStore } from "@/stores/analysisStore";
import { Header } from "./Header";
import { SponsorFooter } from "./SponsorFooter";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { status } = useAnalysisStore();
  const isScanning = ["queued", "cloning", "mapping", "analyzing", "completing"].includes(status);

  return (
    <>
      {/* ── LIVING CANVAS BACKGROUND ────────────────────── */}
      {/* Ambient orb 1 — security / danger — deep red drift */}
      <div className="ambient-orb ambient-orb-1" />
      {/* Ambient orb 2 — quality / cognition — deep violet drift */}
      <div className="ambient-orb ambient-orb-2" />
      {/* Ambient orb 3 — architecture / health — deep emerald drift */}
      <div className="ambient-orb ambient-orb-3" />
      {/* Vignette — focuses center of viewport */}
      <div className="bg-vignette" />
      {/* Scan line — only during active analysis */}
      {isScanning && <div className="scan-line" />}

      <Header />
      <main
        style={{
          paddingTop: "56px",
          paddingBottom: "40px",
          minHeight: "100vh",
          position: "relative",
          zIndex: 2,
        }}
      >
        {children}
      </main>
      <SponsorFooter />
    </>
  );
}
