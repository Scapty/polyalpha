export default function FactorBreakdown({ factors }) {
  return (
    <div className="glass-card" style={{ padding: 24 }}>
      <h3
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 15,
          fontWeight: 600,
          marginBottom: 4,
        }}
      >
        6-Factor Analysis
      </h3>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
        Behavioral signals scored 0-100
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {factors.map((factor, i) => {
          const color = factor.score >= 70 ? "#8b5cf6" : factor.score >= 40 ? "#ffaa00" : "#3b82f6";
          const colorDim = factor.score >= 70 ? "rgba(139,92,246,0.15)" : factor.score >= 40 ? "rgba(255,170,0,0.15)" : "rgba(59,130,246,0.15)";

          return (
            <div
              key={factor.name}
              style={{
                animation: `fadeInUp 0.4s var(--ease-out) ${i * 60}ms both`,
              }}
            >
              {/* Header row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14 }}>{factor.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                    {factor.name}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-muted)",
                    }}
                  >
                    ({(factor.weight * 100).toFixed(0)}%)
                  </span>
                </div>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 14,
                    fontWeight: 700,
                    color,
                  }}
                >
                  {factor.score}
                </span>
              </div>

              {/* Progress bar */}
              <div
                style={{
                  height: 6,
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: 3,
                  overflow: "hidden",
                  marginBottom: 4,
                }}
              >
                <div
                  style={{
                    width: `${factor.score}%`,
                    height: "100%",
                    background: `linear-gradient(90deg, ${colorDim}, ${color})`,
                    borderRadius: 3,
                    transition: "width 0.8s var(--ease-out)",
                  }}
                />
              </div>

              {/* Detail text */}
              <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4, margin: 0 }}>
                {factor.detail}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
