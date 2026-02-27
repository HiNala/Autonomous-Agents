export default function Loading() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        flexDirection: "column",
        gap: 20,
        background: "var(--bg-primary)",
      }}
    >
      {/* Spinner */}
      <div
        style={{
          width: 40,
          height: 40,
          border: "2px solid rgba(255,255,255,0.08)",
          borderTopColor: "var(--color-accent)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-code, monospace)",
          fontSize: "0.7rem",
          color: "var(--text-tertiary, #71717A)",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
        }}
      >
        Loading
      </span>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
