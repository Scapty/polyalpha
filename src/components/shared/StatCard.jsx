import { useState, useEffect, useRef } from "react";

export default function StatCard({ label, value, subtext, trend, trendUp, delay = 0 }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      ref={ref}
      className="stat-card"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        transition: "all 0.3s ease",
      }}
    >
      <div className="section-label" style={{ marginBottom: 10, color: "var(--text-muted)" }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span className="data-text" style={{ fontSize: 28, fontWeight: 500, color: "var(--text-bright)", lineHeight: 1 }}>
          {value}
        </span>
        {trend && (
          <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 500, color: trendUp ? "var(--green)" : "var(--red)" }}>
            {trendUp ? "↑" : "↓"} {trend}
          </span>
        )}
      </div>
      {subtext && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, fontFamily: "var(--font-body)" }}>
          {subtext}
        </div>
      )}
    </div>
  );
}
