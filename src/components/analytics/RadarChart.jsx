import { Radar, RadarChart as RechartsRadar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from "recharts";
import { radarData } from "../../data/mockAnalytics";
import DataBadge from "../shared/DataBadge";

export default function RadarChartComponent() {
  return (
    <div className="glass-card" style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>Market Type Performance</h3>
        <DataBadge status="demo" label="ILLUSTRATIVE" />
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>Accuracy by market category</p>
      <ResponsiveContainer width="100%" height={300}>
        <RechartsRadar data={radarData} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="rgba(255,255,255,0.06)" />
          <PolarAngleAxis dataKey="category" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
          <PolarRadiusAxis domain={[40, 100]} tick={{ fontSize: 9 }} axisLine={false} />
          <Radar name="Bot" dataKey="bot" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} strokeWidth={2} dot={{ r: 3, fill: "#8b5cf6" }} />
          <Radar name="Human" dataKey="human" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={2} dot={{ r: 3, fill: "#3b82f6" }} />
        </RechartsRadar>
      </ResponsiveContainer>
      <div style={{ display: "flex", gap: 20, justifyContent: "center", marginTop: 4 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, background: "#8b5cf6", borderRadius: 2 }} /> Bot
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, background: "#3b82f6", borderRadius: 2 }} /> Human
        </span>
      </div>
    </div>
  );
}
