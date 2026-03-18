import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { winRateData } from "../../data/mockAnalytics";
import DataBadge from "../shared/DataBadge";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "10px 14px", fontSize: 12, fontFamily: "var(--font-mono)" }}>
      <div style={{ color: "var(--text-muted)", marginBottom: 6 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color, display: "flex", gap: 8, justifyContent: "space-between" }}>
          <span>{p.dataKey === "bot" ? "Bot" : "Human"}</span>
          <span style={{ fontWeight: 600 }}>{p.value}%</span>
        </div>
      ))}
    </div>
  );
};

export default function WinRateChart() {
  return (
    <div className="glass-card" style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>Win Rate Over Time</h3>
        <DataBadge status="demo" label="ILLUSTRATIVE" />
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>Bot vs Human accuracy trend</p>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={winRateData} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
          <defs>
            <linearGradient id="botGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="humanGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
          <YAxis domain={[40, 95]} tick={{ fontSize: 10 }} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="bot" stroke="#8b5cf6" strokeWidth={2} fill="url(#botGrad)" dot={{ r: 3, fill: "#8b5cf6" }} />
          <Area type="monotone" dataKey="human" stroke="#3b82f6" strokeWidth={2} fill="url(#humanGrad)" dot={{ r: 3, fill: "#3b82f6" }} />
        </AreaChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", gap: 20, justifyContent: "center", marginTop: 8 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 3, background: "#8b5cf6", borderRadius: 1 }} /> Bot
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 3, background: "#3b82f6", borderRadius: 1 }} /> Human
        </span>
      </div>
    </div>
  );
}
