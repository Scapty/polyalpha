import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { strategyData } from "../../data/mockAnalytics";
import DataBadge from "../shared/DataBadge";

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "10px 14px", fontSize: 12, fontFamily: "var(--font-mono)" }}>
      <div style={{ color: "var(--text-primary)", fontWeight: 600, marginBottom: 4 }}>{d.name}</div>
      <div style={{ color: d.type === "bot" ? "#8b5cf6" : "#3b82f6" }}>
        Accuracy: {d.accuracy}%
      </div>
      <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 2 }}>
        {d.type === "bot" ? "AI Strategy" : "Human Strategy"}
      </div>
    </div>
  );
};

export default function StrategyChart() {
  return (
    <div className="glass-card" style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>Strategy Comparison</h3>
        <DataBadge status="demo" label="ILLUSTRATIVE" />
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>Accuracy by trading strategy</p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={strategyData} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
          <Bar dataKey="accuracy" radius={[0, 4, 4, 0]} barSize={18}>
            {strategyData.map((entry, i) => (
              <Cell key={i} fill={entry.type === "bot" ? "#8b5cf6" : "#3b82f6"} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", gap: 20, justifyContent: "center", marginTop: 8 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, background: "#8b5cf6", borderRadius: 2 }} /> AI Strategy
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, background: "#3b82f6", borderRadius: 2 }} /> Human Strategy
        </span>
      </div>
    </div>
  );
}
