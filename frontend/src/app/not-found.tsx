import Link from "next/link";

export default function NotFound() {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          background: "#0A0A0B",
          color: "#FAFAFA",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          flexDirection: "column",
          gap: "24px",
          textAlign: "center",
        }}
      >
        {/* Ambient glow */}
        <div
          style={{
            position: "fixed",
            top: "30%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 480,
            height: 480,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            fontFamily: "monospace",
            fontSize: "clamp(5rem, 15vw, 8rem)",
            fontWeight: 700,
            lineHeight: 1,
            background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          404
        </div>

        <div>
          <p
            style={{
              fontFamily: "monospace",
              fontSize: "0.75rem",
              color: "#71717A",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              margin: "0 0 8px",
            }}
          >
            PAGE NOT FOUND
          </p>
          <p style={{ color: "#A1A1AA", margin: 0, maxWidth: 340, lineHeight: 1.6, fontSize: "0.9rem" }}>
            This page doesn&apos;t exist or has been moved. Head back and check a repository instead.
          </p>
        </div>

        <Link
          href="/"
          style={{
            background: "#3B82F6",
            color: "white",
            padding: "12px 28px",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "0.875rem",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          ← Back to VIBE CHECK
        </Link>
      </body>
    </html>
  );
}
