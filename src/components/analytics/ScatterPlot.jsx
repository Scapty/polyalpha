import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } from "recharts";
import { scatterData } from "../../data/mockAnalytics";
import DataBadge from "../shared/DataBadge";

const botData = scatterData.filter((d) => d.type === "bot");
const humanData = scatterData.filter((d) => d.type === "human");

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "10px 14px", fontSize: 12, fontFamily: "var(--font-mono)" }}>
      <div style={{ color: "var(--text-primary)", fontWeight: 600, marginBottom: 6 }}>{d.name}</div>
      <div style={{ color: "var(--text-muted)" }}>Trades: {d.trades.toLocaleString()}</div>
      <div style={{ color: "var(--text-muted)" }}>Accuracy: {d.accuracy}%</div>
      <div style={{ color: d.type === "bot" ? "#8b5cf6" : "#3b82f6" }}>P&L: ${(d.pnl / 1000).toFixed(0)}K</div>
    </div>
  );
};

export default function ScatterPlotChart() {
  return (
    <div className="glass-card" style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>Accuracy vs Volume</h3>
        <DataBadge status="demo" label="ILLUSTRATIVE" />
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>Bubble size = P&L</p>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" dataKey="trades" name="Trades" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
          <YAxis type="number" dataKey="accuracy" name="Accuracy" domain={[40, 95]} tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
          <ZAxis type="number" dataKey="pnl" range={[60, 400]} />
          <Tooltip content={<CustomTooltip />} />
          <Scatter name="Bots" data={botData} fill="#8b5cf6" fillOpacity={0.7} />
          <Scatter name="Humans" data={humanData} fill="#3b82f6" fillOpacity={0.7} />
        </ScatterChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", gap: 20, justifyContent: "center", marginTop: 8 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, background: "#8b5cf6", borderRadius: "50%" }} /> Bot
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, background: "#3b82f6", borderRadius: "50%" }} /> Human
        </span>
      </div>
    </div>
  );
}
