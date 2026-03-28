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
        transition: "all 0.5s var(--ease-out)",
      }}
    >
      <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-body)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontSize: 28, fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
          {value}
        </span>
        {trend && (
          <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 500, color: trendUp ? "var(--accent)" : "var(--negative)" }}>
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
