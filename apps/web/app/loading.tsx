export default function Loading() {
  return (
    <div
      style={{
        paddingTop: 52,
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <style>{`
        @keyframes loading-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: "2.5px solid var(--border)",
          borderTopColor: "var(--amber)",
          animation: "loading-spin 0.75s linear infinite",
        }}
        aria-label="Loading"
        role="status"
      />
    </div>
  );
}
