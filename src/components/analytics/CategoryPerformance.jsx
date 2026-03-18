import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { radarData } from "../../data/mockAnalytics";
import DataBadge from "../shared/DataBadge";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--bg-surface-elevated)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-sm)",
        padding: "10px 14px",
        fontSize: 12,
        fontFamily: "var(--font-mono)",
      }}
    >
      <div style={{ color: "var(--text-muted)", marginBottom: 6 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.fill, display: "flex", gap: 12, justifyContent: "space-between" }}>
          <span>{p.dataKey === "bot" ? "Bot" : "Human"}</span>
          <span style={{ fontWeight: 600 }}>{p.value}%</span>
        </div>
      ))}
      {payload.length === 2 && (
        <div style={{ marginTop: 4, paddingTop: 4, borderTop: "1px solid var(--border-subtle)", color: "var(--text-muted)", fontSize: 11 }}>
          Gap: {(payload[0].value - payload[1].value).toFixed(0)}pp
        </div>
      )}
    </div>
  );
};

export default function CategoryPerformance() {
  return (
    <div className="glass-card" style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>Category Performance</h3>
        <DataBadge status="demo" label="ILLUSTRATIVE" />
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
        Bot vs Human accuracy by market category
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={radarData} margin={{ top: 5, right: 5, bottom: 5, left: -5 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="category" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {value === "bot" ? "Bot" : "Human"}
              </span>
            )}
          />
          <Bar dataKey="bot" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="human" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
