import { useState, useEffect, useRef } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { simulateWalletCopyTrading, simulateFromPositions } from "../../utils/walletCopyEngine";

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const isProfit = d.isWin;
  return (
    <div
      style={{
        background: "var(--bg-surface-elevated)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-sm)",
        padding: "10px 14px",
        fontSize: 12,
        fontFamily: "var(--font-mono)",
        maxWidth: 260,
      }}
    >
      {d.market && (
        <div style={{ color: "var(--text-primary)", fontWeight: 600, marginBottom: 4, lineHeight: 1.3, fontSize: 11 }}>
          {d.market.length > 60 ? d.market.slice(0, 57) + "…" : d.market}
        </div>
      )}
      <div style={{ color: "var(--text-muted)", marginBottom: 6, fontSize: 10 }}>
        {d.date ? d.date : `Trade #${d.trade}`}
        {d.isWin !== undefined && (
          <span style={{ marginLeft: 6, color: isProfit ? "#00d4aa" : "#ff4466", fontWeight: 700 }}>
            {isProfit ? "WIN" : "LOSS"}
          </span>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <span style={{ color: "var(--text-muted)" }}>Equity</span>
        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
          ${d.equity.toLocaleString()}
        </span>
      </div>
      {d.drawdown > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginTop: 2 }}>
          <span style={{ color: "var(--text-muted)" }}>Drawdown</span>
          <span style={{ fontWeight: 600, color: d.drawdown > 10 ? "#ff4466" : "var(--text-secondary)" }}>
            {d.drawdown.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
};

export default function CopyTradingSimulator({ trades, positions, traderName, marketResolutions, resolutionsLoading }) {
  const [initialAmount, setInitialAmount] = useState(1000);
  const [result, setResult] = useState(null);
  // Track whether user has clicked Run at least once, so we can auto-rerun
  // when resolutions finish loading and improve the result.
  const hasRun = useRef(false);
  const prevResolutionsLoading = useRef(resolutionsLoading);

  if (!trades || trades.length < 5) return null;

  function runSim(amount = initialAmount) {
    // Prefer positions-based simulation: uses Polymarket's own cashPnl data,
    // which correctly handles positions sold before resolution.
    const posSim = simulateFromPositions(positions || [], amount);
    if (posSim && posSim.numTrades > 0) {
      setResult(posSim);
      return;
    }
    // Fallback: reconstruct from trades + gamma resolution prices.
    // Only run if resolutions are loaded (otherwise we'd get 0 resolution trades).
    if (resolutionsLoading) {
      // Show a placeholder result so the user knows a run is pending
      setResult({ _pending: true });
      return;
    }
    const sim = simulateWalletCopyTrading(trades, amount, marketResolutions || new Map());
    if (sim.numTrades === 0) {
      setResult({ ...sim, _noClosedTrades: true });
    } else {
      setResult(sim);
    }
  }

  function handleRun() {
    hasRun.current = true;
    runSim();
  }

  // Auto-rerun when resolutions finish loading (if user already clicked Run)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (prevResolutionsLoading.current && !resolutionsLoading && hasRun.current) {
      runSim();
    }
    prevResolutionsLoading.current = resolutionsLoading;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolutionsLoading]);

  const isProfit = result && result.finalEquity >= result.initialAmount;
  const curveColor = isProfit ? "#00d4aa" : "#ff4466";

  return (
    <div className="glass-card" style={{ padding: 24 }}>
      <h3
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 15,
          fontWeight: 600,
          marginBottom: 4,
        }}
      >
        Copy Trading Simulator
      </h3>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
        Simulates copying {traderName || "this trader"}'s <b>closed positions</b> using Polymarket P&amp;L data, in chronological order
      </p>

      {/* Config row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 14,
          flexWrap: "wrap",
          marginBottom: result ? 20 : 0,
        }}
      >
        <div>
          <label
            style={{
              display: "block",
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 4,
            }}
          >
            Starting Capital ($)
          </label>
          <input
            type="number"
            value={initialAmount}
            onChange={(e) => setInitialAmount(Math.max(100, Number(e.target.value)))}
            min={100}
            step={100}
            style={{
              width: 120,
              padding: "8px 12px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              outline: "none",
            }}
          />
        </div>

        <button
          className="btn-primary"
          onClick={handleRun}
          disabled={resolutionsLoading && !((positions || []).some(p => p.redeemable))}
          style={{ padding: "8px 24px", whiteSpace: "nowrap" }}
        >
          {resolutionsLoading && !((positions || []).some(p => p.redeemable)) ? "Loading data…" : "Run Simulation"}
        </button>
      </div>

      {/* Pending state — waiting for resolutions to load */}
      {result?._pending && (
        <div style={{ padding: "16px 0", fontSize: 12, color: "var(--accent)", fontStyle: "italic" }}>
          Loading market resolution data… simulation will run automatically when ready.
        </div>
      )}

      {/* Results */}
      {result && !result._pending && (
        <div
          className="animate-fade-in"
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          {/* Stats row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 10,
            }}
          >
            {[
              {
                label: "Final Equity",
                value: `$${result.initialAmount.toLocaleString()} \u2192 $${result.finalEquity.toLocaleString()}`,
                color: isProfit ? "var(--accent)" : "var(--negative)",
              },
              {
                label: "ROI",
                value: `${result.roi > 0 ? "+" : ""}${result.roi}%`,
                color: isProfit ? "var(--accent)" : "var(--negative)",
              },
              {
                label: "Max Drawdown",
                value: `${result.maxDrawdown.toFixed(1)}%`,
                color:
                  result.maxDrawdown > 20
                    ? "var(--negative)"
                    : result.maxDrawdown > 10
                      ? "#ffaa00"
                      : "var(--accent)",
              },
              {
                label: "Win / Loss",
                value: `${result.winCount}W / ${result.lossCount}L`,
                color: "var(--text-primary)",
              },
              {
                label: "Closed Trades",
                value: `${result.numTrades}`,
                color: "var(--text-muted)",
              },
              {
                label: "Est. Slippage",
                value: `$${(result.estimatedSlippageCost || 0).toLocaleString()}`,
                color: "var(--warning)",
              },
            ].map((stat) => (
              <div key={stat.label} className="stat-card">
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-mono)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 6,
                  }}
                >
                  {stat.label}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 700,
                    color: stat.color,
                  }}
                >
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* Equity curve */}
          <div style={{ marginTop: 4 }}>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart
                data={result.equityCurve}
                margin={{ top: 5, right: 5, bottom: 5, left: -5 }}
              >
                <defs>
                  <linearGradient id="walletEquityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={curveColor} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={curveColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="trade"
                  tick={{ fontSize: 9 }}
                  tickFormatter={(v) => {
                    const point = result.equityCurve.find((p) => p.trade === v);
                    return point?.date || "";
                  }}
                  interval={Math.max(0, Math.ceil(result.numTrades / 6) - 1)}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) =>
                    `$${v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(0)}`
                  }
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={result.initialAmount}
                  stroke="rgba(255,255,255,0.15)"
                  strokeDasharray="4 4"
                  label={{
                    value: "Initial",
                    position: "left",
                    fontSize: 9,
                    fill: "var(--text-muted)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="equity"
                  stroke={curveColor}
                  strokeWidth={2}
                  fill="url(#walletEquityGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: curveColor }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Disclaimer */}
          <p
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              lineHeight: 1.5,
              fontStyle: "italic",
              margin: 0,
            }}
          >
            {result._noClosedTrades
              ? "No closed positions found. This wallet may have no resolved markets yet."
              : result.source === "positions"
                ? `Simulation based on ${result.numTrades} closed positions (Polymarket P&L data). Past performance does not guarantee future results.`
                : `Simulation based on ${result.numTrades} closed positions (${result.resolutionTrades} market resolutions + ${result.pairTrades} manual exits). Past performance does not guarantee future results.`}
          </p>
        </div>
      )}
    </div>
  );
}
