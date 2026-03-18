import StatCard from "../shared/StatCard";
import DataBadge from "../shared/DataBadge";
import WinRateChart from "./WinRateChart";
import PnLChart from "./PnLChart";
import StrategyChart from "./StrategyChart";
import ScatterPlotChart from "./ScatterPlot";
import RadarChartComponent from "./RadarChart";
import CategoryPerformance from "./CategoryPerformance";
import Leaderboard from "./Leaderboard";
import { insightStats } from "../../data/mockAnalytics";

export default function Analytics() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, marginBottom: 6, letterSpacing: "-0.02em" }}>
          Bot vs Human Analytics
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          Performance analysis across Polymarket — Leaderboard is live, charts use illustrative data
        </p>
      </div>

      {/* Key Insight Stats — labeled as demo */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>Key Statistics</span>
          <DataBadge status="demo" label="ILLUSTRATIVE" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {insightStats.map((stat, i) => (
            <StatCard key={stat.label} {...stat} delay={i * 80} />
          ))}
        </div>
      </div>

      {/* Charts Grid — all demo data */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        <WinRateChart />
        <PnLChart />
        <StrategyChart />
        <CategoryPerformance />
        <ScatterPlotChart />
        <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          <RadarChartComponent />
          <div className="glass-card" style={{ padding: 24, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 16 }}>
            <div style={{ fontSize: 48, lineHeight: 1 }}>🤖</div>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, textAlign: "center" }}>
              AI Dominates Prediction Markets
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", maxWidth: 300, lineHeight: 1.6 }}>
              Evidence suggests automated bots dominate Polymarket. Use Wallet Stalker to analyze any trader's behavior.
            </p>
            <DataBadge status="demo" label="ILLUSTRATIVE" />
          </div>
        </div>
        <Leaderboard />
      </div>
    </div>
  );
}
