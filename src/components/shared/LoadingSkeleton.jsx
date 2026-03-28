export default function LoadingSkeleton({ count = 6 }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-card" style={{ padding: 24 }}>
          <div className="skeleton" style={{ height: 18, width: "80%", marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 14, width: "60%", marginBottom: 20 }} />
          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            <div className="skeleton" style={{ height: 36, width: 80 }} />
            <div className="skeleton" style={{ height: 36, width: 80 }} />
          </div>
          <div className="skeleton" style={{ height: 4, width: "100%", marginBottom: 16 }} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div className="skeleton" style={{ height: 12, width: 60 }} />
            <div className="skeleton" style={{ height: 28, width: 100 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
