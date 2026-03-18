import { useState } from "react";
import { simulateCopyTrading } from "../../utils/copyBotEngine";
import TraderSelector from "./TraderSelector";
import EquityCurve from "./EquityCurve";
import DataBadge from "../shared/DataBadge";

export default function CopyBotSimulator() {
  const [selectedTrader, setSelectedTrader] = useState(null);
  const [initialAmount, setInitialAmount] = useState(1000);
  const [numTrades, setNumTrades] = useState(100);
  const [result, setResult] = useState(null);

  function handleRun() {
    if (!selectedTrader) return;
    const sim = simulateCopyTrading(selectedTrader, initialAmount, numTrades);
    setResult(sim);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <h1
            style={{
              fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            Copy Bot Simulator
          </h1>
          <DataBadge status="demo" label="SIMULATION" />
        </div>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          Simulate copy-trading any top trader to see projected returns, drawdown, and risk metrics
        </p>
      </div>

      {/* Trader selection */}
      <TraderSelector selectedTrader={selectedTrader} onSelect={setSelectedTrader} />

      {/* Config row */}
      {selectedTrader && (
        <div className="animate-fade-in-up glass-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>{selectedTrader.avatar}</span>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                  Copying {selectedTrader.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {selectedTrader.strategy} strategy
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginLeft: "auto", flexWrap: "wrap" }}>
              <div>
                <label
                  style={{
                    display: "block", fontSize: 10, fontFamily: "var(--font-mono)",
                    color: "var(--text-muted)", textTransform: "uppercase",
                    letterSpacing: "0.06em", marginBottom: 4,
                  }}
                >
                  Initial Capital ($)
                </label>
                <input
                  type="number"
                  value={initialAmount}
                  onChange={(e) => setInitialAmount(Math.max(100, Number(e.target.value)))}
                  min={100}
                  step={100}
                  style={{
                    width: 120, padding: "8px 12px",
                    background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)", color: "var(--text-primary)",
                    fontFamily: "var(--font-mono)", fontSize: 13, outline: "none",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block", fontSize: 10, fontFamily: "var(--font-mono)",
                    color: "var(--text-muted)", textTransform: "uppercase",
                    letterSpacing: "0.06em", marginBottom: 4,
                  }}
                >
                  # of Trades
                </label>
                <select
                  value={numTrades}
                  onChange={(e) => setNumTrades(Number(e.target.value))}
                  style={{
                    width: 120, padding: "8px 12px",
                    background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)", color: "var(--text-primary)",
                    fontFamily: "var(--font-mono)", fontSize: 13, outline: "none",
                  }}
                >
                  <option value={50}>50 trades</option>
                  <option value={100}>100 trades</option>
                  <option value={200}>200 trades</option>
                  <option value={500}>500 trades</option>
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button className="btn-primary" onClick={handleRun} style={{ padding: "8px 24px" }}>
                  Run Simulation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="animate-fade-in-up" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            {[
              {
                label: "ROI",
                value: `${result.roi > 0 ? "+" : ""}${result.roi}%`,
                color: result.roi >= 0 ? "var(--accent)" : "var(--negative)",
              },
              {
                label: "Final Equity",
                value: `$${result.finalEquity.toLocaleString()}`,
                color: result.finalEquity >= result.initialAmount ? "var(--accent)" : "var(--negative)",
              },
              {
                label: "Max Drawdown",
                value: `${result.maxDrawdown}%`,
                color: result.maxDrawdown > 20 ? "var(--negative)" : result.maxDrawdown > 10 ? "#ffaa00" : "var(--accent)",
              },
              {
                label: "Sharpe Ratio",
                value: result.sharpeRatio.toFixed(2),
                color: result.sharpeRatio >= 2 ? "var(--accent)" : result.sharpeRatio >= 1 ? "#ffaa00" : "var(--negative)",
              },
              {
                label: "Win Rate",
                value: `${result.winRate}%`,
                color: result.winRate >= 60 ? "var(--accent)" : result.winRate >= 50 ? "#ffaa00" : "var(--negative)",
              },
              {
                label: "W/L Record",
                value: `${result.winCount}W / ${result.lossCount}L`,
                color: "var(--text-primary)",
              },
            ].map((stat) => (
              <div key={stat.label} className="stat-card">
                <div
                  style={{
                    fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)",
                    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6,
                  }}
                >
                  {stat.label}
                </div>
                <div style={{ fontSize: 22, fontFamily: "var(--font-mono)", fontWeight: 700, color: stat.color }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* Equity curve chart */}
          <EquityCurve data={result.equityCurve} initialAmount={result.initialAmount} />

          {/* Strategy insight */}
          <div className="glass-card" style={{ padding: 20 }}>
            <h4 style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
              Simulation Analysis
            </h4>
            <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>
              {result.roi >= 50
                ? `Copying ${result.traderName}'s ${result.strategy} strategy yielded exceptional returns of ${result.roi}% over ${result.numTrades} trades. The Sharpe ratio of ${result.sharpeRatio.toFixed(2)} indicates ${result.sharpeRatio >= 2 ? "excellent" : "acceptable"} risk-adjusted performance.`
                : result.roi >= 0
                ? `Copying ${result.traderName}'s ${result.strategy} strategy generated a positive return of ${result.roi}% over ${result.numTrades} trades. Max drawdown of ${result.maxDrawdown}% suggests ${result.maxDrawdown > 15 ? "moderate" : "manageable"} risk levels.`
                : `Copying ${result.traderName}'s ${result.strategy} strategy resulted in a ${result.roi}% loss over ${result.numTrades} trades. The max drawdown of ${result.maxDrawdown}% indicates significant risk — consider position sizing adjustments.`
              }
              {" "}The win rate of {result.winRate}% {result.winRate >= 60 ? "shows consistency" : "is below optimal thresholds"} for this strategy type.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
