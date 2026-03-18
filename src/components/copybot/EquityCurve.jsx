import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
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
      <div style={{ color: "var(--text-muted)", marginBottom: 6 }}>Trade #{d.trade}</div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <span style={{ color: "var(--text-muted)" }}>Equity</span>
        <span style={{ fontWeight: 600, color: "var(--accent)" }}>${d.equity.toLocaleString()}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginTop: 2 }}>
        <span style={{ color: "var(--text-muted)" }}>Drawdown</span>
        <span style={{ fontWeight: 600, color: d.drawdown > 10 ? "var(--negative)" : "var(--text-secondary)" }}>
          {d.drawdown.toFixed(1)}%
        </span>
      </div>
    </div>
  );
};

export default function EquityCurve({ data, initialAmount }) {
  return (
    <div className="glass-card" style={{ padding: 24 }}>
      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
        Equity Curve
      </h3>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
        Simulated portfolio value over time
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -5 }}>
          <defs>
            <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00d4aa" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#00d4aa" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="trade"
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => (v % 20 === 0 ? `#${v}` : "")}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={initialAmount}
            stroke="rgba(255,255,255,0.15)"
            strokeDasharray="4 4"
            label={{ value: "Initial", position: "left", fontSize: 9, fill: "var(--text-muted)" }}
          />
          <Area
            type="monotone"
            dataKey="equity"
            stroke="#00d4aa"
            strokeWidth={2}
            fill="url(#equityGrad)"
            dot={false}
            activeDot={{ r: 4, fill: "#00d4aa" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
